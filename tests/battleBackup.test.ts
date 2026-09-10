import { describe, it, expect, vi } from 'vitest'
import { exportBattleBackup, parseBattleBackup } from '../src/game/battleBackup.ts'
import { parseSave } from '../src/core/save.ts'
import oldBattle from './fixtures/seraph-v9-battle.json'
import { mergeSaves, sanitizeCloudSave } from '../src/core/saveMerge.ts'

describe('battle recovery backups', () => {
  it('round-trips the untouched historical battle and separate account progress', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(oldBattle) })
    const account = parseSave({ xp: 18251, honors: ['mastery:seraph:ossuary', 'mastery:seraph:empress'], xpClaims: { '911:greenhollow:base': 12 } })!
    const text = exportBattleBackup(account)
    const restored = parseBattleBackup(text)!
    expect(restored.progress).toEqual(account)
    expect(restored.battle?.stateHash).toBe(oldBattle.stateHash)
    expect(restored.battle?.commands).toEqual(oldBattle.commands)
    expect(restored.battle?.ruleset).toBe(9)
    expect(restored.progress.xpClaims).toEqual({ '911:greenhollow:base': 12 })
    vi.unstubAllGlobals()
  })

  it('keeps XP receipts through cloud merge so restoring a backup cannot pay them again', () => {
    const a = sanitizeCloudSave({ xp: 100, xpClaims: { '911:greenhollow:base': 12 }, updatedAt: 1 })
    const b = sanitizeCloudSave({ xp: 112, xpClaims: { '911:greenhollow:base': 24 }, updatedAt: 2 })
    expect(mergeSaves(a, b).xpClaims).toEqual({ '911:greenhollow:base': 24 })
    expect(mergeSaves(b, a).xpClaims).toEqual({ '911:greenhollow:base': 24 })
    expect(mergeSaves(a, b).xp).toBe(112)
  })
})
