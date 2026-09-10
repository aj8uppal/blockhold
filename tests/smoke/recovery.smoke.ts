import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import { readFileSync } from 'node:fs'
import type { BattleSession } from '../../src/game/session.ts'
const historicalBattle = JSON.parse(readFileSync(new URL('../fixtures/seraph-v9-battle.json', import.meta.url), 'utf8')) as BattleSession

test('a real pre-rebalance Seraph save restores from the menu and exports the whole battle', async ({ page, consoleErrors }) => {
  await page.addInitScript(battle => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 5000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.session.v1', JSON.stringify(battle))
  }, historicalBattle)
  await bootToMenu(page)
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
