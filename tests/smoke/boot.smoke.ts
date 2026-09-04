/**
 * Does the shipped bundle come up at all?
 *
 * Everything here is about the first ten seconds of a stranger's visit: the
 * page paints, the boot screen hands over to a menu, nothing throws, and the
 * layout does not spill sideways on a small laptop.
 */
import { test, expect, bootToMenu, playButton } from './fixtures.ts'

test('boots to the main menu with a clean console', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await expect(page.locator('.game-title')).toHaveText('BLOCKHOLD')
  await expect(playButton(page)).toBeEnabled()
  // the service worker registers and telemetry flushes shortly after the menu
  // paints; give the late arrivals a chance to fail before declaring silence
  await page.waitForTimeout(1500)
  expect(consoleErrors, `browser reported errors:\n${consoleErrors.join('\n')}`).toEqual([])
})

test('the boot screen is removed once the menu renders', async ({ page, request }) => {
  // it is inlined in index.html so it paints before the bundle exists; racing
  // the browser for a glimpse of it would be flaky, so the shipped document is
  // checked directly and the live page is checked for its absence
  const html = await (await request.get('/')).text()
  expect(html, 'index.html no longer ships the inline boot screen').toContain('id="loading"')

  await bootToMenu(page)
  await expect(page.locator('#loading')).toHaveCount(0)
  await expect(page.locator('.menu-screen')).toBeVisible()
})

test('the daily result is copyable and carries a ?hold= challenge link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await bootToMenu(page)
  // A real daily run is ~16 waves and minutes long, which does not belong in a
  // smoke suite; the end card is rendered from a finished run's result, so the
  // test hands it one and checks the sharing path the player actually uses.
  await page.evaluate(() => {
    window.vg.screens.dailySeedForShare = 987654
    window.vg.screens.show('defeat', {
      levelId: 'daily',
      stats: {
        endless: false,
        daily: { day: 42, outcomes: ['held', 'leaked'], totalWaves: 12, wavesReached: 5, lives: 3, won: false },
      },
    })
  })
  await expect(page.locator('.end-title')).toHaveText('Daily Hold #42')
  await expect(page.locator('.daily-blocks')).toHaveText(/[█▒░]{12}/)

  const copy = page.locator('.end-actions .btn.primary', { hasText: /Copy result/ })
  await copy.click()

  // the clipboard is the real path; a browser that blocks it drops the same
  // text into a textarea, and either way the player ends up with the link
  const copied = await page.evaluate(async () => {
    const box = document.querySelector<HTMLTextAreaElement>('.daily-fallback')
    if (box) return box.value
    return navigator.clipboard.readText()
  })
  expect(copied).toContain('Blockhold Daily 42')
  expect(copied).toContain('?hold=')
  expect(copied).toMatch(/\?hold=[0-9a-z]+&r=\d+/)
})

test('a 800x450 viewport does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 450 })
  await bootToMenu(page)
  const menu = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }))
  expect(menu.scroll, `menu overflows: ${JSON.stringify(menu)}`).toBeLessThanOrEqual(menu.client)
  expect(menu.body).toBeLessThanOrEqual(menu.client)

  // the level select is the widest screen in the game
  await playButton(page).click()
  await page.waitForSelector('.levels-screen, .topbar', { timeout: 30_000 })
  const inGame = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(inGame.scroll, `overflows after Play: ${JSON.stringify(inGame)}`).toBeLessThanOrEqual(inGame.client)
})
