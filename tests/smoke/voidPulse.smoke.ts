import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test('Void shows an uncapped splash attack, renders pulses, and continues after reload on mobile', async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await page.addInitScript(() => {
    if (!localStorage.getItem('blockhold.save.v1')) localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 20000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'low')
  })
  await bootToMenu(page)
  await page.evaluate(() => {
    (window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox')
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game, point = g.lanes[0].sample(5)
    const plot = [...g.terrain!.plots].sort((a, b) => Math.hypot(a.pos.x - point.x, a.pos.z - point.z) - Math.hypot(b.pos.x - point.x, b.pos.z - point.z))[0]
    g.buildTower('seraph', plot)
    for (let i = 0; i < 5; i++) g.upgradeTower(g.towers[0], i === 2 ? 1 : 0)
    g.sandboxOrder({ kind: 'sandboxSpawn', enemy: 'gargoyle', count: 20, hp: 100, lane: 0 })
  })
  await expect(page.locator('.tp-combat-stats')).toContainText('All in area')
  await expect(page.locator('.tp-combat-stats')).toContainText('Splash radius')
  await page.waitForFunction(() => (window.vg.game as unknown as Game).projectiles.some(p => p.mesh.name === 'void-pulse'))
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).projectiles.some(p => p.mesh.getObjectByName('ray-core')))).toBe(false)
  await page.screenshot({ path: 'tests/smoke/output/void-pulse-mobile.png' })
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.clearSelection(); g.togglePause(); g.saveSession()
  })
  await page.reload()
  await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
  await page.waitForFunction(() => !(window.vg.game as unknown as Game).isRecovering && window.vg.game.towers.length === 1)
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).towers[0].def.splash)).toBe(1.65)
  expect(consoleErrors).toEqual([])
})
