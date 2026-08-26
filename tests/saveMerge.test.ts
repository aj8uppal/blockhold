import { describe, expect, it } from 'vitest'
import { mergeSaves, sanitizeCloudSave, type CloudSave } from '../src/core/saveMerge.ts'

const base = (over: Partial<CloudSave> = {}): CloudSave => sanitizeCloudSave({
  unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {},
  medals: {}, lastHero: 'aldric', updatedAt: 1000, ...over,
})

describe('merging progress across devices', () => {
  /** the failure this exists to prevent: a clear vanishing on another device */
  it('never loses a map cleared on the other device', () => {
    const phone = base({ stars: { greenhollow: 3, frostmere: 2 }, unlocked: 3, updatedAt: 2000 })
    const laptop = base({ stars: { greenhollow: 1 }, unlocked: 1, updatedAt: 1000 })
    const m = mergeSaves(laptop, phone)
    expect(m.stars).toEqual({ greenhollow: 3, frostmere: 2 })
    expect(m.unlocked).toBe(3)
  })

  it('keeps the best of every record, whichever device set it', () => {
    const a = base({ bestScore: { 'greenhollow:normal': 9000 }, bestEndless: { greenhollow: 41 } })
    const b = base({ bestScore: { 'greenhollow:normal': 4000, 'frostmere:normal': 700 }, bestEndless: { greenhollow: 12 } })
    const m = mergeSaves(a, b)
    expect(m.bestScore).toEqual({ 'greenhollow:normal': 9000, 'frostmere:normal': 700 })
    expect(m.bestEndless.greenhollow).toBe(41)
  })

  it('unions medals rather than replacing them', () => {
    const a = base({ medals: { greenhollow: ['noleak'] } })
    const b = base({ medals: { greenhollow: ['veteran'], frostmere: ['noleak'] } })
    const m = mergeSaves(a, b)
    expect(new Set(m.medals.greenhollow)).toEqual(new Set(['noleak', 'veteran']))
    expect(m.medals.frostmere).toEqual(['noleak'])
  })

  /**
   * The Armory is a loadout, not an achievement. Taking the maximum would
   * resurrect tiers a player deliberately refunded, and silently overspend
   * their stars.
   */
  it('lets a respec survive the merge', () => {
    const before = base({ armory: { coffers: 2, runesmith: 1 }, updatedAt: 1000 })
    const afterRespec = base({ armory: {}, updatedAt: 5000 })
    expect(mergeSaves(before, afterRespec).armory).toEqual({})
    expect(mergeSaves(afterRespec, before).armory).toEqual({})
  })

  it('takes the more recent hero choice', () => {
    const older = base({ lastHero: 'aldric', updatedAt: 1000 })
    const newer = base({ lastHero: 'zephyra', updatedAt: 9000 })
    expect(mergeSaves(older, newer).lastHero).toBe('zephyra')
  })

  it('keeps the better daily result, preferring the later day', () => {
    const a = base({ dailyBest: { day: 25, wave: 12, won: true, score: 9000 } })
    const b = base({ dailyBest: { day: 26, wave: 4, won: false, score: 100 } })
    expect(mergeSaves(a, b).dailyBest?.day).toBe(26)
  })

  it('is order independent for everything that only climbs', () => {
    const a = base({ stars: { greenhollow: 3 }, medals: { greenhollow: ['noleak'] }, updatedAt: 1 })
    const b = base({ stars: { frostmere: 2 }, medals: { greenhollow: ['veteran'] }, updatedAt: 2 })
    const ab = mergeSaves(a, b), ba = mergeSaves(b, a)
    expect(ab.stars).toEqual(ba.stars)
    expect(new Set(ab.medals.greenhollow)).toEqual(new Set(ba.medals.greenhollow))
  })
})

describe('validating what a client sends', () => {
  it('clamps a hand-edited save rather than trusting it', () => {
    const evil = sanitizeCloudSave({ unlocked: 9999, stars: { greenhollow: 99 }, bestScore: { x: 1e12 } })
    expect(evil.unlocked).toBeLessThanOrEqual(16)
    expect(evil.stars.greenhollow).toBeLessThanOrEqual(3)
    expect(evil.bestScore.x).toBeLessThanOrEqual(99_999_999)
  })

  it('refuses unbounded junk under a player account', () => {
    const many: Record<string, number> = {}
    for (let i = 0; i < 500; i++) many[`k${i}`] = 1
    expect(Object.keys(sanitizeCloudSave({ stars: many }).stars).length).toBeLessThanOrEqual(64)
  })

  it('drops a nonsense hero id', () => {
    expect(sanitizeCloudSave({ lastHero: '<script>' }).lastHero).toBe('aldric')
  })

  it('survives complete garbage', () => {
    expect(() => sanitizeCloudSave(null)).not.toThrow()
    expect(() => sanitizeCloudSave('nope')).not.toThrow()
    expect(sanitizeCloudSave(undefined).unlocked).toBe(1)
  })
})
