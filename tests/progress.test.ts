import { describe, expect, it } from 'vitest'
import {
  UNLOCKS, MAX_LEVEL, xpForLevel, levelForXp, levelProgress, battleXp,
  isUnlocked, unlockLevel, nextUnlock, unlocksBetween, seedXpFromProgress,
} from '../src/game/progress.ts'
import { levels } from '../src/game/levels.ts'
import { HERO_DEFS } from '../src/game/hero.ts'
import { towerTrees } from '../src/game/towerDefs.ts'

describe('the experience curve', () => {
  it('starts at level 1 with nothing and only ever climbs', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(levelForXp(0)).toBe(1)
    for (let l = 2; l <= MAX_LEVEL; l++) expect(xpForLevel(l)).toBeGreaterThan(xpForLevel(l - 1))
  })

  it('maps experience back to the level whose floor it crossed', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(levelForXp(xpForLevel(l))).toBe(l)
      if (l < MAX_LEVEL) expect(levelForXp(xpForLevel(l + 1) - 1)).toBe(l)
    }
    expect(levelForXp(1e9)).toBe(MAX_LEVEL)
  })

  it('reports progress inside the current level as a fraction that fills', () => {
    const p = levelProgress(xpForLevel(4) + 10)
    expect(p.level).toBe(4)
    expect(p.into).toBe(10)
    expect(p.span).toBe(xpForLevel(5) - xpForLevel(4))
  })

  /**
   * The design intent, checked against the real campaign: level 5 by about
   * the second map, 10 by about the fifth, 15 near the end of the ten, and 20
   * out of reach of a single normal run - so the last unlock needs Veteran or
   * the Long Night, which is what gives those modes a reason after the credits.
   */
  it('paces the ladder against a normal campaign', () => {
    let xp = 0
    const levelAfterMap: number[] = []
    for (const lvl of levels) {
      xp += battleXp({ mode: 'campaign', difficulty: 'normal', wavesHeld: lvl.waves.length, won: true, firstClear: true })
      levelAfterMap.push(levelForXp(xp))
    }
    expect(levelAfterMap[1], 'two maps').toBeGreaterThanOrEqual(5)
    expect(levelAfterMap[4], 'five maps').toBeGreaterThanOrEqual(10)
    expect(levelAfterMap[9], 'the whole campaign').toBeGreaterThanOrEqual(15)
    expect(levelAfterMap[9], 'the last unlock is not free').toBeLessThan(20)
  })

  it('pays for waves held even in defeat, and more on Veteran', () => {
    const lost = battleXp({ mode: 'campaign', difficulty: 'normal', wavesHeld: 9, won: false, firstClear: false })
    const won = battleXp({ mode: 'campaign', difficulty: 'normal', wavesHeld: 16, won: true, firstClear: false })
    const vet = battleXp({ mode: 'campaign', difficulty: 'veteran', wavesHeld: 16, won: true, firstClear: false })
    expect(lost).toBeGreaterThan(0)
    expect(won).toBeGreaterThan(lost)
    expect(vet).toBeGreaterThan(won)
  })
})

describe('the unlock ladder', () => {
  it('names only things that exist, in ascending order', () => {
    let last = 0
    for (const u of UNLOCKS) {
      expect(u.level).toBeGreaterThan(last)
      last = u.level
      if (u.kind === 'hero') expect(u.id in HERO_DEFS, u.id).toBe(true)
      else expect(u.id in towerTrees, u.id).toBe(true)
    }
  })

  it('leaves the first hero and the four original towers always available', () => {
    const fresh = { xp: 0 }
    expect(isUnlocked(fresh, 'hero', 'aldric')).toBe(true)
    for (const k of ['arrow', 'mage', 'cannon', 'barracks']) expect(isUnlocked(fresh, 'tower', k)).toBe(true)
    expect(isUnlocked(fresh, 'hero', 'liora')).toBe(false)
    expect(isUnlocked(fresh, 'tower', 'ballista')).toBe(false)
  })

  it('opens exactly at the named level and reports what opened', () => {
    for (const u of UNLOCKS) {
      expect(isUnlocked({ xp: xpForLevel(u.level) - 1 }, u.kind, u.id)).toBe(false)
      expect(isUnlocked({ xp: xpForLevel(u.level) }, u.kind, u.id)).toBe(true)
      expect(unlockLevel(u.kind, u.id)).toBe(u.level)
    }
    expect(unlocksBetween(0, xpForLevel(10)).map(u => u.id)).toEqual(['liora', 'zephyra'])
    expect(nextUnlock(10)?.id).toBe('ballista')
    expect(nextUnlock(99)).toBeNull()
  })

  /** nobody who already had a hero opens the game to find them locked */
  it('seeds an older save with enough to keep what it was using', () => {
    const veteran = { stars: { a: 3, b: 3, c: 3, d: 3, e: 3, f: 3, g: 3 }, unlocked: 8, medals: { a: ['noleak', 'veteran'] }, bestEndless: { a: 40 } }
    expect(levelForXp(seedXpFromProgress(veteran))).toBeGreaterThanOrEqual(10)
    expect(seedXpFromProgress({ stars: {}, unlocked: 1, medals: {}, bestEndless: {} })).toBe(0)
  })
})
