import { levels } from '../src/game/levels.ts'
import { describe, expect, it } from 'vitest'
import { ARMORY_TRACKS, ARMORY_TOTAL_COST, armoryTier, buyTier, respec, starsAvailable, starsEarned, starsSpent } from '../src/game/armory.ts'
import type { SaveData } from '../src/core/save.ts'

const mkSave = (overrides: Partial<SaveData> = {}): SaveData => ({
  unlocked: 3,
  stars: { greenhollow: 3, frostmere: 3, emberwastes: 3 },
  armory: {},
  sfxMuted: false,
  musicMuted: false,
  ...overrides,
})

describe('armory', () => {
  it('earns the sum of level stars', () => {
    expect(starsEarned(mkSave())).toBe(9)
    expect(starsEarned(mkSave({ stars: {} }))).toBe(0)
  })

  it('buys tiers and tracks spent stars', () => {
    const save = mkSave()
    expect(buyTier(save, 'coffers')).toBe(true)   // costs 1
    expect(buyTier(save, 'coffers')).toBe(true)   // costs 2
    expect(buyTier(save, 'coffers')).toBe(false)  // maxed
    expect(starsSpent(save)).toBe(3)
    expect(starsAvailable(save)).toBe(6)
  })

  it('refuses purchases beyond available stars', () => {
    const save = mkSave({ stars: { greenhollow: 1 } })
    expect(buyTier(save, 'comet')).toBe(false)      // costs 2, only 1 earned
    expect(buyTier(save, 'coffers')).toBe(true)     // costs 1
    expect(buyTier(save, 'fletching')).toBe(false)  // nothing left
  })

  it('clamps corrupt over-tier values so UI math never goes negative', () => {
    const save = mkSave({ armory: { comet: 4, fletching: 99, nonsense: 2 } })
    for (const track of ARMORY_TRACKS) {
      const tier = armoryTier(save, track.id)
      expect(tier).toBeGreaterThanOrEqual(0)
      expect(tier).toBeLessThanOrEqual(track.tierCosts.length)
      expect(track.tierCosts.length - tier).toBeGreaterThanOrEqual(0)
    }
    expect(armoryTier(save, 'nonsense')).toBe(0)
    expect(Number.isFinite(starsSpent(save))).toBe(true)
  })

  it('respec refunds everything', () => {
    const save = mkSave()
    buyTier(save, 'fletching')
    buyTier(save, 'arcane')
    respec(save)
    expect(starsSpent(save)).toBe(0)
    expect(starsAvailable(save)).toBe(9)
  })
})

describe('the armory board', () => {
  // The old board cost exactly the 21 stars the campaign yields, so finishing
  // the campaign bought everything and the free respec had nothing to decide.
  it('costs more than the campaign can pay for', () => {
    const campaignStars = levels.length * 3
    expect(ARMORY_TOTAL_COST).toBeGreaterThan(campaignStars)
  })

  it('sells effects rather than percentages', () => {
    for (const t of ARMORY_TRACKS) {
      expect(t.tierCosts.length).toBeGreaterThan(0)
      expect(t.desc.length).toBeGreaterThan(10)
    }
    // the four flat-damage tracks are gone
    const ids = ARMORY_TRACKS.map(t => t.id)
    for (const gone of ['fletching', 'arcane', 'powder']) expect(ids).not.toContain(gone)
  })
})
