import { describe, expect, it } from 'vitest'
import { holdPieces, holdSummary, holdIsEmpty, holdModel } from '../src/game/hold.ts'
import type { SaveData } from '../src/core/save.ts'

const save = (over: Partial<SaveData> = {}): SaveData => ({
  unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {},
  lastHero: 'aldric', sfxMuted: false, musicMuted: false, ...over,
})

const boxCount = (s: SaveData) =>
  Object.values(holdModel(holdPieces(s)).parts).reduce((n, part) => n + part.length, 0)

describe('the Chronicle Hold', () => {
  it('is bare on a fresh save', () => {
    const p = holdPieces(save())
    expect(holdIsEmpty(p)).toBe(true)
    expect(holdSummary(p)).toContain('bare')
  })

  it('earns a tower per map cleared and a banner per three-star', () => {
    const p = holdPieces(save({ stars: { greenhollow: 3, frostmere: 1 } }))
    expect(p.towers).toBe(2)
    expect(p.banners).toBe(1)
  })

  it('earns statues for flawless clears and gilding for Veteran', () => {
    const p = holdPieces(save({
      stars: { greenhollow: 3 },
      medals: { greenhollow: ['noleak', 'veteran'] },
    }))
    expect(p.statues).toBe(1)
    expect(p.gilding).toBe(1)
  })

  it('sets a veilcrystal in the gate only after a daily is won', () => {
    expect(holdPieces(save()).relics).toBe(0)
    expect(holdPieces(save({ dailyBest: { day: 1, wave: 12, won: true, score: 10 } })).relics).toBe(1)
    expect(holdPieces(save({ dailyBest: { day: 1, wave: 4, won: false, score: 10 } })).relics).toBe(0)
  })

  /** the whole point: a late save cannot look like a fresh one */
  it('builds a visibly larger keep as the campaign is beaten', () => {
    const fresh = boxCount(save())
    const veteran = boxCount(save({
      stars: { greenhollow: 3, frostmere: 3, emberwastes: 3, mistfen: 2 },
      medals: { greenhollow: ['noleak', 'veteran'], frostmere: ['noleak'] },
      dailyBest: { day: 1, wave: 12, won: true, score: 10 },
    }))
    expect(veteran).toBeGreaterThan(fresh)
  })

  it('still stands on a fresh save rather than rendering nothing', () => {
    expect(boxCount(save())).toBeGreaterThan(0)
  })
})
