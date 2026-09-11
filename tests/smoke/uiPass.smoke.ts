import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test('battle setup selects hero and difficulty before an explicit start, with keyboard dismissal', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.getByRole('button', { name: 'Sandbox', exact: true }).click()
  await page.locator('.level-card').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.locator('.hero-option').filter({ hasText: 'Zephyra' }).click()
  await page.locator('.diff-option.casual').click()
  await expect(page.locator('.hero-option').filter({ hasText: 'Zephyra' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.diff-option.casual')).toHaveAttribute('aria-pressed', 'true')
  expect(await page.evaluate(() => window.vg.game.phase)).not.toBe('playing')
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).focus()
  await page.keyboard.press('Tab')
  expect(await page.evaluate(() => !!document.activeElement?.closest('.difficulty-card'))).toBe(true)
  await page.screenshot({ path: 'tests/smoke/output/ui-setup-desktop.png' })
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click()
  await page.waitForFunction(() => window.vg.game.phase === 'playing')
  expect(await page.evaluate(() => { const g = window.vg.game as unknown as Game; return [g.hero!.heroDef.id, g.difficulty] })).toEqual(['zephyra', 'casual'])
  expect(consoleErrors).toEqual([])
})

test('nested help consumes Escape and gameplay keys; focused HUD Space never calls a wave', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox'))
  await page.getByRole('button', { name: 'Game speed', exact: true }).focus()
  const wave = await page.evaluate(() => window.vg.game.waves!.waveIndex)
  await page.keyboard.press('Space')
  expect(await page.evaluate(() => window.vg.game.waves!.waveIndex)).toBe(wave)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Field guide', exact: true }).click()
  await expect(page.locator('.guide-overlay')).toBeVisible()
  await page.keyboard.press('p')
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).paused)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.locator('.guide-overlay')).toHaveCount(0)
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).paused)).toBe(true)
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).paused)).toBe(false)
  await page.locator('.sandbox-tools summary').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.sandbox-tools')).not.toHaveAttribute('open', '')
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).paused)).toBe(false)
  expect(consoleErrors).toEqual([])
})

test.describe('compact touch controls', () => {
  test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true })
  test('mooring selection toggles, open water refuses boats, and build controls keep 44px targets', async ({ page, consoleErrors }) => {
    await bootToMenu(page)
    await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox'))
    await page.waitForTimeout(1200)
    const point = await page.evaluate(() => {
      const g = window.vg.game as unknown as Game, plot = g.terrain!.plots.find(p => p.water && p.cell[0] === 9)!
      return g.projectToScreen(plot.pos.x, -.1, plot.pos.z)!
    })
    await page.touchscreen.tap(point.x, point.y)
    await expect(page.locator('.build-menu')).toBeVisible()
    await expect(page.locator('.build-menu')).toContainText('One Tidecaller per mooring')
    await page.screenshot({ path: 'tests/smoke/output/ui-mooring-phone.png' })
    await page.touchscreen.tap(point.x, point.y)
    await expect(page.locator('.build-menu')).toBeHidden()
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).terrain!.waterPlot(11, 5))).toBeNull()
    await page.evaluate(() => { const g = window.vg.game as unknown as Game; g.selectPlot(g.terrain!.plots[0], 300, 200) })
    const tooSmall = await page.locator('.build-menu button').evaluateAll(buttons => buttons.filter(b => {
      const rect = b.getBoundingClientRect(); return rect.width < 44 || rect.height < 44
    }).map(b => b.textContent))
    expect(tooSmall).toEqual([])
    await page.screenshot({ path: 'tests/smoke/output/ui-build-small-phone.png' })
    expect(consoleErrors).toEqual([])
  })
})
