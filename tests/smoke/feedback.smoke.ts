import { test, expect, bootToMenu, startBattle } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Mesh, MeshStandardMaterial } from 'three'

test('XP remaining stays visible on a small landscape screen, including max level', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 })
  await bootToMenu(page)
  await startBattle(page)
  const remaining = page.locator('.stat.xp .xp-remaining')
  await expect(remaining).toHaveText(/\d[\d,]* XP to Lv 2/)
  await expect(remaining).toBeVisible()
  const bounds = await remaining.boundingBox()
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(740)
  expect(await remaining.evaluate(e => {
    const r = e.getBoundingClientRect()
    return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
  }), 'XP text must not be covered by the wave controls').toBe(true)
  const bar = page.getByRole('progressbar', { name: 'Account level progress' })
  await expect(bar).toHaveAttribute('aria-valuetext', /of 64 XP/)
  await page.screenshot({ path: 'tests/smoke/output/xp-small-screen.png' })
  await page.evaluate(() => {
    const game = window.vg.game as unknown as Game
    game.save.xp = 50000
  })
  await expect(remaining).toHaveText('Max level')
  await expect(bar).toHaveAttribute('aria-valuenow', '100')
})

test('rapid tower upgrades preserve authored colors and reveal the finished model', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await startBattle(page)
  await page.evaluate(() => {
    const game = window.vg.game as unknown as Game
    game.gold = 10000
    const plot = game.terrain!.plots.find(p => !p.occupied)!
    game.buildTower('arrow', plot)
    const tower = game.towers[0]
    for (let i = 0; i < 4; i++) game.upgradeTower(tower, 0)
  })
  await page.waitForFunction(() => {
    const game = window.vg.game as unknown as Game
    return game.towers[0]?.level === 5 && game.towers[0].model.visible
  })
  const colors = await page.evaluate(() => {
    const game = window.vg.game as unknown as Game
    const result: { emissive: number, opacity: number }[] = []
    game.towers[0].model.traverse(o => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined
      if (m?.isMeshStandardMaterial) result.push({ emissive: m.emissive.getHex(), opacity: m.opacity })
    })
    return result
  })
  expect(colors.length).toBeGreaterThan(0)
  expect(colors.every(c => c.emissive === 0 && c.opacity === 1)).toBe(true)
  expect(consoleErrors).toEqual([])
})
