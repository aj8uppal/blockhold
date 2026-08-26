import { describe, expect, it, vi, beforeEach } from 'vitest'
import { writeCheckpoint, readCheckpoint, clearCheckpoint, hasCheckpoint, type Checkpoint } from '../src/game/checkpoint.ts'
import { RULESET_VERSION } from '../src/game/ruleset.ts'

let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

const sample = (over: Partial<Checkpoint> = {}): Checkpoint => ({
  ruleset: RULESET_VERSION,
  levelId: 'greenhollow', difficulty: 'normal', heroId: 'aldric', endless: false,
  seed: 12345, waveIndex: 6, gold: 640, lives: 18, shards: 5, time: 214,
  goldEarned: 900, shardsEarned: 5, killCount: 88, perfectWaves: 4,
  defenseStreak: 2, bestStreak: 3, earlyCallSeconds: 31, heroLevel: 3, heroXp: 40,
  towers: [{ plot: 2, kind: 'arrow', level: 3, branch: null, perk: null, policy: 'strong' }],
  traps: [{ spot: 1, kind: 'frost' }],
  savedAt: 214,
  ...over,
})

describe('mid-battle checkpoints', () => {
  it('round-trips a battle in progress', () => {
    expect(writeCheckpoint(sample())).toBe(true)
    const c = readCheckpoint()!
    expect(c.waveIndex).toBe(6)
    expect(c.seed).toBe(12345)
    expect(c.towers[0].policy).toBe('strong')
    expect(c.traps[0].kind).toBe('frost')
    expect(hasCheckpoint()).toBe(true)
  })

  /**
   * A seed only reproduces a run against the rules it was taken under, so a
   * balance patch must discard the checkpoint rather than quietly continue
   * the battle under different numbers.
   */
  it('discards a checkpoint from a different ruleset', () => {
    writeCheckpoint(sample({ ruleset: RULESET_VERSION + 1 }))
    expect(readCheckpoint()).toBeNull()
    expect(store['blockhold.checkpoint.v1']).toBeUndefined()   // and cleans up
  })

  it('ignores a battle that had not really started', () => {
    writeCheckpoint(sample({ waveIndex: 0 }))
    expect(readCheckpoint()).toBeNull()
  })

  it('survives corrupt or foreign data without throwing', () => {
    store['blockhold.checkpoint.v1'] = 'not json'
    expect(readCheckpoint()).toBeNull()
    store['blockhold.checkpoint.v1'] = JSON.stringify({ ruleset: RULESET_VERSION, levelId: 5 })
    expect(readCheckpoint()).toBeNull()
    store['blockhold.checkpoint.v1'] = JSON.stringify(
      { ...sample(), towers: 'nope' })
    expect(readCheckpoint()).toBeNull()
  })

  it('clears when a run ends', () => {
    writeCheckpoint(sample())
    clearCheckpoint()
    expect(readCheckpoint()).toBeNull()
    expect(hasCheckpoint()).toBe(false)
  })
})
