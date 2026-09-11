import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('blockhold.save.v1')) localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 20000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'low')
  })
})

test('tap water to build a Tidecaller, upgrade both branches, and continue it after reload', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox'))
  await page.waitForTimeout(1000)
  for (const branch of [0, 1]) {
    const point = await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      g.clearSelection()
      for (let r = 0; r < g.level!.height; r++) for (let c = 0; c < g.level!.width; c++) {
        const plot = g.terrain!.waterPlot(c, r)
        if (!plot) continue
        const point = g.projectToScreen(plot.pos.x, -.4, plot.pos.z)
        if (point && point.x > 70 && point.x < innerWidth - 70 && point.y > 100 && point.y < innerHeight - 80) return point
      }
      throw new Error('No visible water site')
    })
    await page.touchscreen.tap(point.x, point.y)
    await expect(page.locator('.build-menu')).toContainText('Build on water')
    await expect(page.locator('.build-menu')).not.toContainText('Raise ground')
    await page.locator('.build-option').filter({ hasText: 'Tidecaller' }).tap()
    await expect.poll(() => page.evaluate(() => window.vg.game.towers.length)).toBe(branch + 1)
    await page.evaluate(branch => {
      const g = window.vg.game as unknown as Game, tower = g.towers[branch]
      for (let i = 0; i < 5; i++) g.upgradeTower(tower, tower.level === 3 ? branch : 0)
    }, branch)
    await expect(page.locator('.tower-panel')).not.toContainText('Raise ground')
  }
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).towers.map(t => t.def.name))).toEqual(['Worldtide', 'Heart of Winter'])
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.clearSelection(); g.togglePause(); g.saveSession()
  })
  await page.reload()
  await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
  await page.waitForFunction(() => (window.vg.game as unknown as Game).paused && !(window.vg.game as unknown as Game).isRecovering)
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).towers.map(t => ({ water: t.plot.water, level: t.level })))).toEqual([{ water: true, level: 6 }, { water: true, level: 6 }])
  expect(consoleErrors).toEqual([])
})

test('manual wave flow survives reload and Reinforcements / Meteor use 3 / 4', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign'))
  await page.getByRole('button', { name: 'Pause', exact: true }).tap()
  await page.getByLabel('Wave flow', { exact: true }).selectOption('manual')
  await page.getByRole('button', { name: 'Save & exit', exact: true }).tap()
  await page.reload()
  await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
  await expect(page.getByLabel('Wave flow', { exact: true })).toHaveValue('manual')
  await page.evaluate(() => (window.vg.game as unknown as Game).togglePause())
  await expect(page.locator('.wave-call')).toHaveText(/Begin assault/)
  await expect(page.locator('.wave-call')).not.toContainText('early bonus')
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).autoWaves)).toBe(false)
  await expect(page.getByRole('button', { name: 'Reinforcements', exact: true }).locator('.hotkey')).toHaveText('3')
  await expect(page.getByRole('button', { name: 'Meteor Storm', exact: true }).locator('.hotkey')).toHaveText('4')
  expect(consoleErrors).toEqual([])
})
