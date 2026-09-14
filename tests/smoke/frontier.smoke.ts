import { test, expect, bootToMenu } from './fixtures.ts'

/**
 * The Frontier ships in its own chunk, so the parts worth proving in a real
 * browser are the seams: the menu lists the boards without loading them, a
 * card fetches the chunk before its setup sheet opens, and the battle that
 * follows stands enemies on a road that climbs.
 */
test('the Frontier lists its boards by tier and starts a battle on a board loaded on demand', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.getByRole('button', { name: 'Frontier maps' }).click()
  await expect(page.getByRole('heading', { name: 'Beyond the campaign road' })).toBeVisible()
  for (const tier of ['Gentle', 'Testing', 'Brutal']) {
    await expect(page.locator('.frontier-tier-name', { hasText: tier })).toBeVisible()
  }
  await expect(page.locator('.frontier-card')).toHaveCount(10)
  // the campaign is one tab away, and back
  await page.getByRole('button', { name: 'Campaign', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your battlefield' })).toBeVisible()
  await page.getByRole('button', { name: 'Frontier', exact: true }).click()

  await page.getByRole('button', { name: /^Starfall Drift, Testing/ }).click()
  await expect(page.getByRole('dialog', { name: 'Starfall Drift' })).toBeVisible()
  await page.getByRole('button', { name: 'Start battle', exact: true }).click()
  await page.waitForFunction(() => window.vg.game.phase === 'playing', undefined, { timeout: 30_000 })

  // enemies spawned on the first asteroid's bridge walk up it, not through it
  const heights = await page.evaluate(async () => {
    const g = window.vg.game as unknown as { lanes: { length: number, sample(d: number): { y: number } }[], spawnEnemyAt(id: string, lane: number, dist: number): void, enemies: { pos: { y: number }, update(dt: number, w: unknown): void }[] }
    const lane = g.lanes[0]
    g.spawnEnemyAt('husk', 0, lane.length * 0.18)
    const e = g.enemies[g.enemies.length - 1]
    e.update(1 / 60, g)
    return { enemy: e.pos.y, road: lane.sample(lane.length * 0.18).y }
  })
  expect(heights.road).toBeGreaterThan(0.3)
  expect(Math.abs(heights.enemy - heights.road)).toBeLessThan(0.15)
  expect(consoleErrors).toEqual([])
})
