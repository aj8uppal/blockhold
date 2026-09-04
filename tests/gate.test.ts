import { describe, expect, it } from 'vitest'
import { levels } from '../src/game/levels.ts'
import { judgeLevel, PRE_GRIND, FULL_KIT } from '../src/game/balanceModel.ts'
import { difficultyMods, GATE_MAP_IDS, isGateMap } from '../src/game/difficulty.ts'
import { ARMORY_TOTAL_COST, crownStars, starsEarned } from '../src/game/armory.ts'
import type { SaveData } from '../src/core/save.ts'

/**
 * The long tail's central promise, as a regression alarm.
 *
 * The owner's intent: the last maps on Veteran should not fall until the
 * roster and the Armory are complete. The static model cannot *prove* that -
 * it knows nothing about placement, pierce or blocking - but it can catch a
 * balance change that quietly makes the gate maps holdable with the starter
 * kit, or unholdable with everything. Both directions are checked, so a
 * future tune cannot drift the gate open or slam it shut without this
 * failing.
 */
describe('the Veteran gate', () => {
  const gates = levels.filter(l => isGateMap(l.id))

  it('names the three maps past the finale', () => {
    expect(GATE_MAP_IDS).toEqual(['sunderfall', 'emberwind', 'tidereach'])
    expect(gates).toHaveLength(3)
  })

  it('bites harder on each late map than the flat table did', () => {
    let last = 1.3
    for (const id of GATE_MAP_IDS) {
      const v = difficultyMods(id, 'veteran')
      expect(v.enemyHp).toBeGreaterThanOrEqual(last)
      expect(v.eliteChance).toBeGreaterThanOrEqual(0.12)
      last = v.enemyHp
    }
    // the campaign rule does not leak into other modes or difficulties
    expect(difficultyMods('tidereach', 'veteran', 'endless').enemyHp).toBe(1.3)
    expect(difficultyMods('tidereach', 'normal').enemyHp).toBe(1)
    expect(difficultyMods('greenhollow', 'veteran').enemyHp).toBe(1.3)
  })

  it('does not fall to the starter kit', () => {
    for (const lvl of gates) {
      const peak = Math.max(...judgeLevel(lvl, 'veteran', PRE_GRIND).map(v => v.worstRatio))
      expect(peak, `${lvl.id} on Veteran holds with four families and no Armory`).toBeGreaterThan(1.15)
    }
  })

  it('is meaningfully easier with the full kit than without it', () => {
    for (const lvl of gates) {
      const before = judgeLevel(lvl, 'veteran', PRE_GRIND).map(v => v.worstRatio)
      const after = judgeLevel(lvl, 'veteran', FULL_KIT).map(v => v.worstRatio)
      const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
      expect(sum(after) / sum(before), `${lvl.id} kit makes no difference`).toBeLessThan(0.8)
    }
  })

  it('still lets Normal be finished with the starter kit', () => {
    for (const lvl of levels) {
      const peak = Math.max(...judgeLevel(lvl, 'normal', PRE_GRIND).map(v => v.worstRatio))
      expect(peak, `${lvl.id} on Normal is unwinnable without the grind`).toBeLessThan(1.7)
    }
  })
})

describe('crown stars', () => {
  const save = (over: Partial<SaveData>): SaveData => ({
    unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestFreeplay: {}, bestScore: {}, medals: {}, seenEnemies: [],
    taughtBasics: true, lastHero: 'aldric', sfxMuted: false, musicMuted: false, xp: 0, ...over,
  })

  it('adds one star per map conquered on Veteran, from the medal that already exists', () => {
    const s = save({ stars: { a: 3, b: 2 }, medals: { a: ['veteran', 'noleak'], b: ['noleak'] } })
    expect(crownStars(s)).toBe(1)
    expect(starsEarned(s)).toBe(6)
  })

  it('keeps the board out of reach of a plain campaign but within a Veteran one', () => {
    const plain = 3 * levels.length
    const grind = 4 * levels.length
    expect(ARMORY_TOTAL_COST).toBeGreaterThan(plain)
    expect(ARMORY_TOTAL_COST).toBeGreaterThan(grind)   // even the grind leaves a choice
    expect(ARMORY_TOTAL_COST).toBeLessThanOrEqual(grind * 1.6)
  })
})
