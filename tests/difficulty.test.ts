import { describe, expect, it } from 'vitest'
import { levels } from '../src/game/levels.ts'
import { judgeLevel, campaignScale } from '../src/game/balanceModel.ts'
import type { Difficulty } from '../src/game/types.ts'

const median = (a: number[]) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)]

/** median pressure of the first and last third of a map */
function shape(id: string, difficulty: Difficulty) {
  const lvl = levels.find(l => l.id === id)!
  const r = judgeLevel(lvl, difficulty).map(v => v.worstRatio)
  const t = Math.floor(r.length / 3)
  return { early: median(r.slice(0, t)), late: median(r.slice(-t)), all: r }
}

describe('the campaign difficulty curve', () => {
  /**
   * The measured failure this exists to prevent. Every map used to front-load
   * its tension and then decay to roughly a third of it, because affordable
   * damage grows far faster than the authored waves do - the 28-wave finale
   * map was easier at the end than at the start.
   */
  it('does not get easier as a map goes on', () => {
    for (const lvl of levels) {
      const s = shape(lvl.id, 'normal')
      expect(s.late / s.early, `${lvl.id} decays across its own waves`).toBeGreaterThan(0.6)
    }
  })

  it('leaves no wave that asks nothing of the player', () => {
    for (const lvl of levels) {
      const trivial = shape(lvl.id, 'normal').all.filter(r => r < 0.16)
      expect(trivial.length, `${lvl.id} has waves that teach nothing`).toBe(0)
    }
  })

  it('keeps the hardest wave inside what a good defense can answer', () => {
    for (const lvl of levels) {
      const peak = Math.max(...shape(lvl.id, 'normal').all)
      expect(peak, `${lvl.id} has an unfair spike`).toBeLessThan(1.65)
    }
  })

  it('keeps the difficulties ordered', () => {
    for (const lvl of levels) {
      const casual = median(judgeLevel(lvl, 'casual').map(v => v.worstRatio))
      const normal = median(judgeLevel(lvl, 'normal').map(v => v.worstRatio))
      const veteran = median(judgeLevel(lvl, 'veteran').map(v => v.worstRatio))
      expect(casual, `${lvl.id} casual`).toBeLessThan(normal)
      expect(normal, `${lvl.id} normal`).toBeLessThan(veteran)
    }
  })

  it('escalates gently at first and bites in the back half', () => {
    // a player is still learning the board early; the ramp should not punish that
    expect(campaignScale(0, 20)).toBe(1)
    expect(campaignScale(6, 20)).toBeLessThan(1.35)
    expect(campaignScale(19, 20)).toBeGreaterThan(2)
  })

  it('scales longer maps harder, since they compound more income', () => {
    expect(campaignScale(27, 28)).toBeGreaterThan(campaignScale(15, 16))
  })
})
