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

test('Seraph chains render and the panel shows target growth with upgrades', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await startBattle(page)
  const hitCount = await page.evaluate(() => {
    const game = window.vg.game as unknown as Game
    game.save.xp = 9264
    game.gold = 30000
    const plot = game.terrain!.plots.find(p => !p.occupied)!
    game.buildTower('seraph', plot)
    const tower = game.towers[0]
    game.paused = true
    tower.update(1, game) // settle the build animation before inspecting the shot
    for (let i = 0; i < 4; i++) {
      game.spawnEnemyAt('husk', 0, 0)
      const e = game.enemies[game.enemies.length - 1]
      e.pos.set(tower.pos.x + 0.8 + i * 0.4, 0, tower.pos.z + (i % 2) * 0.6)
      e.hp = e.maxHp = 10000
    }
    tower.update(1 / 60, game)
    return game.enemies.filter(e => e.hp < e.maxHp).length
  })
  expect(hitCount).toBe(3)
  const panel = page.locator('.tower-panel')
  await expect(panel).toContainText('Targets3')
  await expect(panel.locator('.u-delta')).toContainText('Targets3 → 4')
  await page.screenshot({ path: 'tests/smoke/output/seraph-chain.png' })
  expect(consoleErrors).toEqual([])
})

test('Beacon range and high-ground benefit are visible in the tower panel', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await startBattle(page)
  const reach = await page.evaluate(() => {
    const game = window.vg.game as unknown as Game
    game.save.xp = 9264
    game.gold = 10000
    const plot = game.terrain!.plots.find(p => !p.occupied && !game.terrain!.isOnHill(...p.cell))!
    game.buildTower('beacon', plot)
    const tower = game.towers[0]
    game.raisePlot(plot)
    return tower.auraReach
  })
  expect(reach).toBeCloseTo(4.14)
  await expect(page.locator('.tower-panel')).toContainText('High ground: +15% aura reach')
  await expect(page.locator('.tower-panel .stat-chips')).toContainText('Reach')
  await expect(page.locator('.tower-panel .stat-chips')).toContainText('4.1')
  expect(consoleErrors).toEqual([])
})
