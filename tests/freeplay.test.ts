import { describe, expect, it } from 'vitest'
import { levels, generateFreeplayChunk, ladderRung, FREEPLAY_CHUNK, ASCENDANT_AFFIXES } from '../src/game/levels.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { AFFIX_IDS } from '../src/game/affixes.ts'

describe('the boss ladder', () => {
  it('climbs through the campaign bosses, then the two the campaign never shows', () => {
    expect([10, 20, 30, 40, 50, 60].map(d => ladderRung(d)!.boss))
      .toEqual(['hollowking', 'juggernaut', 'veilqueen', 'veilregent', 'ossuary', 'veilempress'])
    expect(ladderRung(5)).toBeNull()
    expect(ladderRung(0)).toBeNull()
  })

  /**
   * The early rungs carry multipliers because the Hollow King's base health
   * would be a speed bump at wave 10 of a maxed board. Each rung's effective
   * base health has to exceed the last, or it is a rotation, not a ladder.
   */
  it('gets heavier at every rung before the repeat', () => {
    let last = 0
    for (const d of [10, 20, 30, 40, 50, 60]) {
      const r = ladderRung(d)!
      // a two-phase boss is its phases together: the Empress is 4,000 in the
      // air and 3,500 on the ground, and the player fights both
      const def = enemyDef(r.boss)
      const hp = (def.hp + (def.phaseInto ? enemyDef(def.phaseInto).hp : 0)) * r.hpMult
      expect(hp, `rung at wave ${d}`).toBeGreaterThan(last)
      last = hp
    }
  })

  it('repeats from the Veilqueen as Ascendants, with a second boss from wave 80', () => {
    const r70 = ladderRung(70)!
    expect(r70.boss).toBe('veilqueen')
    expect(r70.ascendant).toBe(true)
    expect(r70.hpMult).toBeCloseTo(1.55 * 1.6, 5)
    expect(r70.second).toBeUndefined()
    const r80 = ladderRung(80)!
    expect(r80.second).toBeDefined()
    expect(r80.second!.hpMult).toBeLessThan(r80.hpMult)
  })

  it('names only real affixes for Ascendants', () => {
    for (const a of ASCENDANT_AFFIXES) expect(AFFIX_IDS).toContain(a)
  })
})

describe('freeplay chunks', () => {
  const lvl = levels[0]

  it('are the same for the same run, map and depth', () => {
    const a = generateFreeplayChunk(lvl, 777, 0)
    const b = generateFreeplayChunk(lvl, 777, 0)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a).toHaveLength(FREEPLAY_CHUNK)
  })

  it('differ by run and by depth, so a resumed run and a fresh one do not collide', () => {
    const a = generateFreeplayChunk(lvl, 777, 0)
    const b = generateFreeplayChunk(lvl, 778, 0)
    const c = generateFreeplayChunk(lvl, 777, FREEPLAY_CHUNK)
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })

  it('places the ladder boss on every tenth wave and no other boss', () => {
    const waves = [...generateFreeplayChunk(lvl, 5, 0), ...generateFreeplayChunk(lvl, 5, 20), ...generateFreeplayChunk(lvl, 5, 40)]
    waves.forEach((w, i) => {
      const depth = i + 1
      const bosses = w.groups.filter(g => enemyDef(g.enemy).boss)
      const rung = ladderRung(depth)
      if (rung) {
        expect(bosses.map(g => g.enemy), `depth ${depth}`).toContain(rung.boss)
        expect(bosses[0].hpMult).toBe(rung.hpMult)
      } else {
        expect(bosses, `depth ${depth} has a stray boss`).toHaveLength(0)
      }
    })
  })

  it('only ever names enemies that exist', () => {
    for (const w of generateFreeplayChunk(levels[9], 99, 60)) {
      for (const g of w.groups) expect(() => enemyDef(g.enemy)).not.toThrow()
    }
  })
})

describe('the new bosses', () => {
  it('give the Regent its own model and the Empress a second phase that exists', () => {
    expect(enemyDef('veilregent').model).toBe('veilregent')
    expect(enemyDef('veilempress').phaseInto).toBe('veilempressLanded')
    const landed = enemyDef('veilempressLanded')
    expect(landed.flying).toBeFalsy()
    expect(landed.boss).toBe(true)
    expect(enemyDef('ossuary').raises?.id).toBe('husk')
  })
})
