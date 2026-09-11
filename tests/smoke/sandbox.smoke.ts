import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test('mobile sandbox opens from the menu, spawns enemies and survives a page reload', async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await bootToMenu(page)
  await page.getByRole('button', { name: 'Sandbox', exact: true }).click()
  await expect(page.locator('.level-card.locked')).toHaveCount(0)
  await page.locator('.level-card').first().click()
  await expect(page.locator('.hero-option:disabled')).toHaveCount(0)
  await page.locator('.diff-option.normal').click()
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click()
  await page.waitForFunction(() => (window.vg.game as unknown as Game).isSandbox)
  await expect(page.locator('.callwave')).toBeHidden()
  await page.locator('.sandbox-tools summary').click()
  await page.getByLabel('Enemy', { exact: true }).selectOption('brute')
  await page.getByLabel('Count', { exact: true }).selectOption('10')
  await page.getByLabel('Health', { exact: true }).selectOption('100')
  await page.getByRole('button', { name: 'Send enemies', exact: true }).click()
  await page.waitForFunction(() => window.vg.game.enemies.length >= 2)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.buildTower('seraph', g.terrain!.plots[0])
    for (let i = 0; i < 5; i++) g.upgradeTower(g.towers[0], 0)
    g.clearSelection()
    g.togglePause()
  })
  const before = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { account: JSON.stringify(g.save), hash: g.exportBattleSession()!.stateHash }
  })
  await page.getByRole('button', { name: 'Save & exit', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
  await page.waitForFunction(() => {
    const g = window.vg.game as unknown as Game
    return g.isSandbox && !g.isRecovering && g.towers.length === 1
  })
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).exportBattleSession()!.stateHash)).toBe(before.hash)
  expect(await page.evaluate(() => JSON.stringify((window.vg.game as unknown as Game).save))).toBe(before.account)
  await page.evaluate(() => (window.vg.game as unknown as Game).togglePause())
  await page.locator('.sandbox-tools summary').click()
  const drawer = page.locator('.sandbox-tools')
  await expect(drawer).toBeInViewport({ ratio: 1 })
  for (const target of await drawer.locator('button, select').all()) expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: 'tests/smoke/output/sandbox-mobile.png' })
  await page.getByRole('button', { name: 'Clear enemies', exact: true }).click()
  await page.waitForFunction(() => window.vg.game.enemies.length === 0)
  expect(consoleErrors).toEqual([])
})

test('tower panels keep details optional and track damage for the current hunt live', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.xp = 20000; g.save.honors = []; g.save.taughtBasics = true
    ;(window.vg.screens as unknown as Screens).onPlayHunt('ossuary', 'normal', 'aldric')
    g.gold = 100000
    g.buildTower('seraph', g.terrain!.plots[0])
    for (let i = 0; i < 4; i++) g.upgradeTower(g.towers[0], 0)
    g.towers[0].damage = 3999
    g.selectTower(g.towers[0])
  })
  await expect(page.locator('.tp-details').filter({ has: page.locator('summary', { hasText: 'Combat details' }) })).not.toHaveAttribute('open', '')
  await page.locator('.tp-mastery summary').click()
  await expect(page.locator('.tp-mastery')).toContainText('3,999 / 4,000 damage')
  await expect(page.locator('.tp-mastery')).toContainText('The Bone Procession')
  await expect(page.locator('.tp-mastery')).toContainText('The Fallen Crown')
  await expect(page.locator('.tp-mastery')).not.toContainText('Ready — win')
  await page.evaluate(() => { (window.vg.game as unknown as Game).towers[0].damage = 4000 })
  await expect(page.locator('.tp-mastery')).toContainText('Ready — win The Bone Procession')
  await expect(page.getByRole('progressbar', { name: 'Damage toward mastery' })).toHaveAttribute('value', '4000')
  const backgrounds = await page.locator('.tp-combat-stats .chip.lit').evaluateAll(chips => chips.map(c => getComputedStyle(c).backgroundColor))
  expect(backgrounds.every(c => c === 'rgba(0, 0, 0, 0)')).toBe(true)
  await page.screenshot({ path: 'tests/smoke/output/mythic-progress-desktop.png' })
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    ;(window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign')
    g.buildTower('arrow', g.terrain!.plots[0])
  })
  await page.waitForFunction(() => document.querySelector('.tower-panel')!.getAnimations().length === 0)
  const summary = page.locator('.tp-mastery summary')
  const beforeHover = (await summary.boundingBox())!
  await page.locator('.tower-panel .raise').hover()
  const positions = await summary.evaluate(async element => {
    const ys: number[] = []
    for (let i = 0; i < 6; i++) {
      await new Promise(requestAnimationFrame)
      ys.push(element.getBoundingClientRect().y)
    }
    return ys
  })
  expect(positions.every(y => Math.abs(y - beforeHover.y) < 1), 'hovering Raise Ground must not move the inspector controls').toBe(true)
  await page.locator('.tp-mastery summary').click()
  await expect(page.locator('.tp-mastery')).toContainText('Campaign battles do not count')
  await expect(page.locator('.tp-mastery progress')).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})
