/**
 * Can somebody actually play?
 *
 * Pressing Play has to end in a battle that is running - enemies on the road
 * and the wave counter moving - and a plot has to turn into a tower for gold.
 * Those two are the whole game; if either is unreachable through the DOM,
 * nothing else in the build matters.
 */
import { test, expect, bootToMenu, startBattle, openBuildMenu, hudGold, hudWave } from './fixtures.ts'

test('pressing Play reaches a running battle with enemies and a moving wave counter', async ({ page }) => {
  await bootToMenu(page)
  await startBattle(page)

  const waveBefore = await hudWave(page)

  // the first wave marches on its own after a ~14s grace countdown; poll rather
  // than sleep so a faster start does not cost the suite 40 seconds
  await page.waitForFunction(
    (before: number) => {
      const g = window.vg.game
      const shown = Number(document.querySelector('.topbar .stat.wave b')?.textContent?.split('/')[0] ?? 0)
      return (g.waves?.waveIndex ?? -1) >= 0 && g.enemies.length > 0 && shown > before
    },
    waveBefore,
    { timeout: 40_000, polling: 500 },
  )

  const state = await page.evaluate(() => ({
    phase: window.vg.game.phase,
    enemies: window.vg.game.enemies.length,
    waveIndex: window.vg.game.waves?.waveIndex ?? -1,
  }))
  expect(state.phase).toBe('playing')
  expect(state.enemies).toBeGreaterThan(0)
  expect(state.waveIndex).toBeGreaterThanOrEqual(0)
  // and the player can see it happen
  expect(await hudWave(page)).toBeGreaterThan(waveBefore)
})

test('a plot plus a build option builds a tower and spends gold', async ({ page }) => {
  await bootToMenu(page)
  await startBattle(page)

  const goldBefore = await hudGold(page)
  expect(goldBefore).toBeGreaterThan(0)

  await openBuildMenu(page)
  const options = page.locator('.build-menu .build-option')
  expect(await options.count()).toBeGreaterThan(0)
  await options.first().click()

  await expect.poll(() => page.evaluate(() => window.vg.game.towers.length), {
    message: 'the build option did not produce a tower',
    timeout: 10_000,
  }).toBeGreaterThan(0)

  // the HUD repaints on the next frame, so the number the player reads lags the
  // model by a tick or two
  await expect.poll(() => hudGold(page), {
    message: `the HUD gold never dropped from ${goldBefore}`,
    timeout: 10_000,
  }).toBeLessThan(goldBefore)
})
