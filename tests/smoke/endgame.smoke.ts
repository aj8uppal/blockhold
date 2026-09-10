import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

const snapshot = (g: Game) => ({
  time: g.time, gold: g.gold, lives: g.lives, shards: g.shards,
  wave: g.waves!.waveIndex,
  towers: g.towers.map(t => ({ kind: t.kind, level: t.level, branch: t.branch, policy: t.targetPolicy, damage: t.damage })),
  enemies: g.enemies.map(e => ({ id: e.def.id, hp: e.hp, dist: e.dist })),
  hero: { hp: g.hero!.hp, xp: g.hero!.xp, signatureRank: g.hero!.signatureRank, cooldown: g.hero!.abilityCooldown },
})

test('Save & exit restores the current wave after a real page reload', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.taughtBasics = true
    ;(window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign')
    const plot = g.terrain!.plots[0]
    g.buildTower('arrow', plot)
    g.cycleTargetPolicy(g.towers[0])
    g.callWave()
  })
  await page.waitForFunction(() => window.vg.game.enemies.length >= 2)
  await page.evaluate(() => (window.vg.game as unknown as Game).togglePause())
  // Serialize the same observable state on both sides, including transient enemy health.
  const takeSnapshot = async () => page.evaluate(`(${snapshot.toString()})(window.vg.game)`)
  const before = await takeSnapshot()
  await page.getByRole('button', { name: 'Save & exit', exact: true }).click()
  await expect(page.locator('.menu-screen')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
  await page.waitForFunction(() => {
    const g = window.vg.game as unknown as Game
    return g.phase === 'playing' && g.paused && g.towers.length === 1
  }, undefined, { timeout: 30000 })
  expect(await takeSnapshot()).toEqual(before)
  expect(consoleErrors).toEqual([])
})

test('earned hero paths equip and carry into a hunt', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.xp = 10000
    g.save.honors = ['hero:aldric:ossuary']
    g.save.taughtBasics = true
    ;(window.vg.screens as unknown as Screens).show('hunts')
  })
  await page.locator('.endgame-paths > summary').click()
  const bulwark = page.locator('.path-option').filter({ hasText: 'Guardian Standard' })
  const vanguard = page.locator('.path-option').filter({ hasText: 'Breachmaker' })
  await expect(bulwark).toBeEnabled()
  await expect(vanguard).toBeDisabled()
  await bulwark.click()
  await expect(bulwark).toContainText('Equipped')
  await page.getByLabel('Hunt difficulty').selectOption('normal')
  await page.getByRole('button', { name: 'Start The Bone Procession', exact: true }).click()
  await page.waitForFunction(() => (window.vg.game as unknown as Game).hunt?.id === 'ossuary')
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).hero!.specialization)).toBe('bulwark')
  await expect(page.locator('.hunt-status')).toContainText('The Bone Procession')
  await page.screenshot({ path: 'tests/smoke/output/boss-hunt.png' })
  expect(consoleErrors).toEqual([])
})

test('Mythics require earned mastery and only one can stand', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  const result = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.xp = 20000; g.save.taughtBasics = true
    ;(window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign')
    g.gold = 100000
    g.buildTower('seraph', g.terrain!.plots[0])
    const t = g.towers[0]
    for (let i = 0; i < 4; i++) g.upgradeTower(t, 0)
    const before = g.gold
    g.upgradeTower(t, 0)
    const locked = t.level === 5 && g.gold === before
    g.roster.honors = ['mastery:seraph:ossuary', 'mastery:seraph:empress', 'mastery:barracks:ossuary', 'mastery:barracks:empress']
    g.upgradeTower(t, 0)
    g.buildTower('barracks', g.terrain!.plots[1])
    const second = g.towers[1]
    for (let i = 0; i < 4; i++) g.upgradeTower(second, 0)
    const remaining = g.gold
    g.upgradeTower(second, 0)
    g.paused = true
    return { locked, tier: t.level, second: second.level, charged: remaining - g.gold, message: g.mythicLock(second) }
  })
  expect(result).toMatchObject({ locked: true, tier: 6, second: 5, charged: 0 })
  expect(result.message).toContain('One Mythic')
  expect(consoleErrors).toEqual([])
})


test('hunt hub leads with one next step and keeps optional upgrades collapsed on landscape phones', async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await bootToMenu(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.xp = 10000; g.save.honors = []; g.save.lastHero = 'aldric'
    ;(window.vg.screens as unknown as Screens).show('hunts')
  })
  await expect(page.locator('.endgame-next')).toContainText('Next: win The Bone Procession with Sir Aldric')
  await expect(page.getByLabel('Hunt difficulty')).toHaveValue('casual')
  await expect(page.locator('.endgame-paths')).not.toHaveAttribute('open', '')
  await expect(page.locator('.endgame-mastery')).not.toHaveAttribute('open', '')
  await expect(page.getByRole('button', { name: 'Start The Bone Procession', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Start The Bone Procession', exact: true })).toBeInViewport({ ratio: 1 })
  expect(await page.locator('.endgame-screen').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: 'tests/smoke/output/hunt-hub-landscape.png' })
  expect(consoleErrors).toEqual([])
})
