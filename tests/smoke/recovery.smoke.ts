import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import { readFileSync } from 'node:fs'
import type { BattleSession } from '../../src/game/session.ts'
import { enemyDefs } from '../../src/game/enemyDefs.ts'
const historicalBattle = JSON.parse(readFileSync(new URL('../fixtures/seraph-v9-battle.json', import.meta.url), 'utf8')) as BattleSession

test('a real pre-rebalance Seraph save restores from the menu and exports the whole battle', async ({ page, consoleErrors }) => {
  await page.addInitScript(battle => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 5000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.session.v1', JSON.stringify(battle))
  }, historicalBattle)
  await bootToMenu(page)
  await page.locator('.menu-settings summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download saved battle', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('blockhold-battle.json')
  const stream = await file.createReadStream()
  let text = ''
  for await (const chunk of stream!) text += chunk.toString()
  const backup = JSON.parse(text)
  expect(backup.battle.stateHash).toBe(historicalBattle.stateHash)
  expect(backup.battle.commands).toEqual(historicalBattle.commands)
  await page.getByRole('button', { name: /Continue The Bone Procession/ }).click()
  await page.waitForFunction(() => {
    const g = window.vg.game as unknown as Game
    return g.phase === 'playing' && !g.isRecovering && g.paused && g.towers[0]?.level === 5
  }, undefined, { timeout: 45000 })
  const restored = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { legacy: g.legacyCombat, hash: (g as unknown as { sessionStateHash(ruleset: number): number }).sessionStateHash(9),
      targets: g.towers[0].def.beamTargets, accountXp: g.save.xp, preview: g.xpPreview() }
  })
  expect(restored.legacy).toBe(true)
  expect(restored.hash).toBe(historicalBattle.stateHash)
  expect(restored.targets).toBe(7)
  expect(restored.accountXp).toBeLessThan(10000) // never overwrite this player's level with the host's 20,000 XP
  expect(restored.preview).toBeGreaterThanOrEqual(restored.accountXp)
  await page.getByRole('button', { name: 'Save & exit', exact: true }).click()
  const paid = await page.evaluate(() => (window.vg.game as unknown as Game).save.xp)
  expect(paid).toBe(restored.preview)
  await page.getByRole('button', { name: /Continue The Bone Procession/ }).click()
  await page.waitForFunction(() => (window.vg.game as unknown as Game).legacyCombat && !(window.vg.game as unknown as Game).isRecovering)
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).xpPreview())).toBe(paid)
  expect(consoleErrors).toEqual([])
})

test('account mastery unlocks the restored tower inspector and survives another Continue', async ({ page, consoleErrors }) => {
  await page.addInitScript(({ battle, seenEnemies }) => {
    if (localStorage.getItem('blockhold.mastery-recovery-test')) return
    localStorage.setItem('blockhold.mastery-recovery-test', '1')
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 20000, taughtBasics: true, sfxMuted: true, musicMuted: true,
      // This account has completed both hunts; enemy introductions must not
      // race the inspector click when a slower renderer reaches a new spawn.
      seenEnemies, honors: ['mastery:seraph:ossuary', 'mastery:seraph:empress'] }))
    localStorage.setItem('blockhold.session.v1', JSON.stringify(battle))
  }, { battle: historicalBattle, seenEnemies: [...enemyDefs.keys()] })
  await bootToMenu(page)
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: /Continue The Bone Procession/ }).click()
    await page.waitForFunction(() => {
      const g = window.vg.game as unknown as Game
      return g.phase === 'playing' && !g.isRecovering && g.paused
    })
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      g.togglePause(); g.selectTower(g.towers[0])
    })
    await expect(page.locator('.tower-panel')).not.toContainText('0/2 Normal or Veteran hunts mastered')
    await page.locator('.tp-mastery summary').click()
    await expect(page.locator('.tp-mastery')).toContainText('Unlocked permanently')
    await expect(page.locator('.tp-mastery')).toContainText('✓ The Bone Procession')
    await expect(page.locator('.tp-mastery')).toContainText('✓ The Fallen Crown')
    if (i === 0) {
      await page.evaluate(() => {
        const g = window.vg.game as unknown as Game
        g.clearSelection(); g.togglePause(); g.saveSession()
      })
      await page.reload()
    }
  }
  // Fund the purchase directly here; the reload above uses the unmodified journal.
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.gold = g.towers[0].upgradeOptions[0].cost
  })
  await page.locator('.tower-panel .upgrade').first().click()
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).towers[0].level)).toBe(6)
  expect(consoleErrors).toEqual([])
})
