import { describe, it, expect } from 'vitest'
import { starThresholds, starsFor } from '../src/game/stars.ts'
import { nextObjective } from '../src/ui/screens.ts'
import { levels } from '../src/game/levels.ts'
import type { SaveData } from '../src/core/save.ts'

describe('star thresholds', () => {
  it('keep 22/25, 18/20 and 14/15 for three stars', () => {
    expect(starThresholds(25).three).toBe(22)
    expect(starThresholds(20).three).toBe(18)
    expect(starThresholds(15).three).toBe(14)
  })
  it('grades Normal as 18 -> 3, 17 -> 2, 9 -> 1', () => {
    expect(starsFor(18, 20)).toBe(3)
    expect(starsFor(17, 20)).toBe(2)
    expect(starsFor(10, 20)).toBe(2)
    expect(starsFor(9, 20)).toBe(1)
  })
})

const fake = (over: Partial<SaveData> = {}): SaveData => ({
  stars: {}, medals: {}, bestFreeplay: {}, bestEndless: {}, ...over,
} as unknown as SaveData)

describe('the next objective', () => {
  const a = levels[0].id, b = levels[1].id
  it('a loss retries the failure by name', () => {
    const o = nextObjective(fake(), { won: false, levelId: a, stars: 0, leak: { name: 'Brute', wave: 7 } })
    expect(o.action).toBe('retry')
    expect(o.text).toContain('Brute')
    expect(o.text).toContain('wave 7')
  })
  it('a first clear points at the next map', () => {
    const o = nextObjective(fake({ stars: { [a]: 2 } }), { won: true, levelId: a, stars: 2, firstClear: true })
    expect(o.action).toBe('next')
    expect(o.levelId).toBe(b)
  })
  it('a repeat clear below three stars says how many lives to keep', () => {
    const o = nextObjective(fake({ stars: { [a]: 2 } }), { won: true, levelId: a, stars: 2, livesShort: 3 })
    expect(o.action).toBe('replay')
    expect(o.text).toContain('3 more lives')
  })
  it('three stars without the crown asks for Veteran', () => {
    const o = nextObjective(fake({ stars: { [a]: 3, [b]: 3 } }), { won: true, levelId: a, stars: 3 })
    expect(o.action).toBe('veteran')
  })
  it('a completed account is sent to hold the line past the next boss', () => {
    const stars: Record<string, number> = {}, medals: Record<string, string[]> = {}
    for (const l of levels) { stars[l.id] = 3; medals[l.id] = ['veteran', 'noleak'] }
    const o = nextObjective(fake({ stars, medals, bestFreeplay: { [`${a}:normal`]: 14 } }), { won: true, levelId: a, stars: 3 })
    expect(o.action).toBe('hold')
    expect(o.text).toContain('+20')
  })
})
