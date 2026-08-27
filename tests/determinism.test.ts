import { describe, it, expect, afterEach } from 'vitest'
import { setSimSeed, simRandom, simChance, randRange, randInt, pick } from '../src/core/utils.ts'
import { generateEndlessWaves } from '../src/game/levels.ts'
import { levels } from '../src/game/levels.ts'
import { dailySeed, dailyNumber, runStamp, RULESET_VERSION } from '../src/game/ruleset.ts'

/** cheap order-sensitive digest, so a changed draw order fails loudly */
function digest(nums: number[]): number {
  let h = 2166136261 >>> 0
  for (const n of nums) {
    h ^= Math.round(n * 1e6) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** a fixed script shaped like real combat draws */
function drawScript(): number[] {
  const out: number[] = []
  for (let i = 0; i < 40; i++) {
    out.push(simRandom())
    out.push(simChance(0.35) ? 1 : 0)
    out.push(randRange(12, 40))
    out.push(randInt(0, 7))
    out.push(pick([1, 2, 3, 5, 8]))
  }
  return out
}

afterEach(() => setSimSeed(null))

describe('simulation determinism', () => {
  it('reproduces an identical draw stream from the same seed', () => {
    setSimSeed(12345)
    const a = drawScript()
    setSimSeed(12345)
    const b = drawScript()
    expect(b).toEqual(a)
  })

  it('produces a different stream for a different seed', () => {
    setSimSeed(12345)
    const a = digest(drawScript())
    setSimSeed(12346)
    const b = digest(drawScript())
    expect(b).not.toBe(a)
  })

  it('routes every shared helper through the seeded stream', () => {
    // if any helper still called Math.random, re-seeding could not reproduce it
    setSimSeed(99)
    const first = [randRange(0, 1), randInt(0, 1000), pick([...Array(50).keys()]), simRandom()]
    setSimSeed(99)
    const second = [randRange(0, 1), randInt(0, 1000), pick([...Array(50).keys()]), simRandom()]
    expect(second).toEqual(first)
  })

  it('returns to unseeded play when the seed is cleared', () => {
    setSimSeed(7)
    const seeded = drawScript()
    setSimSeed(null)
    const free = drawScript()
    expect(free).not.toEqual(seeded)
  })

  /**
   * Pinned digest. This is meant to fail when the simulation's draw order
   * changes - that is a ruleset change, so bump RULESET_VERSION (and this
   * value) deliberately rather than quietly rewriting old results.
   */
  it('holds a stable digest for a pinned seed', () => {
    setSimSeed(0xB10CC)
    expect(digest(drawScript())).toBe(1996632675)
  })
})

describe('endless generation', () => {
  it('generates an identical wave list for the same seed', () => {
    const level = levels[0]
    const a = generateEndlessWaves(level, 60, 4242)
    const b = generateEndlessWaves(level, 60, 4242)
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a))
  })

  it('generates a different wave list for a different seed', () => {
    const level = levels[0]
    const a = generateEndlessWaves(level, 60, 1)
    const b = generateEndlessWaves(level, 60, 2)
    expect(JSON.stringify(b)).not.toEqual(JSON.stringify(a))
  })
})

describe('ruleset stamping', () => {
  it('stamps a run with the ruleset it was simulated under', () => {
    const s = runStamp('greenhollow', 'normal', 'campaign', 777)
    expect(s).toEqual({ ruleset: RULESET_VERSION, seed: 777, levelId: 'greenhollow', difficulty: 'normal', mode: 'campaign' })
  })

  it('derives the same daily seed from the same UTC date, without a server', () => {
    const a = dailySeed(new Date(Date.UTC(2026, 7, 26, 3, 0, 0)))
    const b = dailySeed(new Date(Date.UTC(2026, 7, 26, 22, 30, 0)))
    expect(b).toBe(a)
  })

  it('changes the daily seed across UTC days', () => {
    const a = dailySeed(new Date(Date.UTC(2026, 7, 26)))
    const b = dailySeed(new Date(Date.UTC(2026, 7, 27)))
    expect(b).not.toBe(a)
  })

  it('counts daily numbers forward from launch', () => {
    expect(dailyNumber(new Date(Date.UTC(2026, 7, 1)))).toBe(1)
    expect(dailyNumber(new Date(Date.UTC(2026, 7, 26)))).toBe(26)
  })
})
