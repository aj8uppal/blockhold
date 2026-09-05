import { describe, it, expect } from 'vitest'
import { familiesCompleted, holdPieces, holdCacheKey } from '../src/game/hold.ts'
import type { SaveData } from '../src/core/save.ts'

describe('capstone cards and the Hold', () => {
  it('a family is mastered only with both crowns stamped', () => {
    expect(familiesCompleted([])).toBe(0)
    expect(familiesCompleted(['arrow:0'])).toBe(0)
    expect(familiesCompleted(['arrow:0', 'arrow:1'])).toBe(1)
    expect(familiesCompleted(['arrow:0', 'arrow:1', 'mage:1', 'cannon:0', 'cannon:1'])).toBe(2)
  })
  it('pennants ride the cache key, so the keep is rebuilt when a family is mastered', () => {
    const base = { stars: {}, medals: {}, trials: {}, capstones: [] } as unknown as SaveData
    const a = holdPieces(base)
    const b = holdPieces({ ...base, capstones: ['beacon:0', 'beacon:1'] } as SaveData)
    expect(a.pennants).toBe(0)
    expect(b.pennants).toBe(1)
    expect(holdCacheKey(a)).not.toBe(holdCacheKey(b))
  })
})
