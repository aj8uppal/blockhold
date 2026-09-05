import { describe, it, expect } from 'vitest'
import { levels } from '../src/game/levels.ts'
import { judgeLevel } from '../src/game/balanceModel.ts'
import { trialFor, trialLevel, trialProfile, reliefWaves, silentWave, TRIAL_KINDS, TRIAL_HP } from '../src/game/trials.ts'

/**
 * Every map's two trials, held to the model's verdict on the campaign's own
 * finale: with its arsenal, its bank and no Armory, a Relief Siege may be a
 * fifth harder than the last waves of the campaign are with everything - it
 * is a trial, and one life is the point - but no more, and it must not be a
 * walkover either.
 */
describe('the trials', () => {
  for (const level of levels) {
    const finale = judgeLevel(level, 'normal').slice(-reliefWaves(level).length)
    const finaleWorst = Math.max(...finale.map(v => v.worstRatio))
    for (const kind of TRIAL_KINDS) {
      it(`${level.name} / ${kind} has a sane bank and one life`, () => {
        const t = trialFor(level, kind)
        expect(t.lives).toBe(1)
        expect(t.shards).toBe(6)
        expect(t.maxTier).toBe(4)
        expect(t.startGold).toBeGreaterThanOrEqual(400)
        expect(t.startGold).toBeLessThan(8000)
        expect(t.startGold % 50).toBe(0)
      })
    }
    it(`${level.name} / relief is no harder than the campaign's finale, and not a walkover`, () => {
      const t = trialFor(level, 'relief')
      const verdicts = judgeLevel(trialLevel(level, 'relief', t.startGold), 'normal', trialProfile(level, 'relief'))
      const worst = Math.max(...verdicts.map(v => v.worstRatio))
      expect(worst).toBeLessThanOrEqual(finaleWorst * 1.2 + 1e-9)
      expect(worst).toBeGreaterThan(0.15)
    })
  }

  it('Greenhollow pays about what the design asked for', () => {
    expect(trialFor(levels[0], 'relief').startGold).toBeGreaterThanOrEqual(1000)
    expect(trialFor(levels[0], 'relief').startGold).toBeLessThanOrEqual(1200)
    expect(trialFor(levels[0], 'silent').startGold).toBeGreaterThanOrEqual(1200)
    expect(trialFor(levels[0], 'silent').startGold).toBeLessThanOrEqual(1800)
  })

  it('a Relief Siege is the last waves of the map, at least five, carrying their own scaling', () => {
    const g = levels[0]
    const w = reliefWaves(g)
    expect(w.length).toBeGreaterThanOrEqual(5)
    expect(w[w.length - 1].groups.map(x => x.enemy)).toEqual(g.waves[g.waves.length - 1].groups.map(x => x.enemy))
    // the finale's scaling, thinned by the Armory's share
    expect(w[w.length - 1].groups[0].hpMult).toBeGreaterThan(TRIAL_HP)
    expect(w[w.length - 1].groups[0].hpMult).toBeLessThan(2)
  })

  it('Silent Guns is every group of the map, in order, five seconds apart', () => {
    const g = levels[0]
    const w = silentWave(g)
    const total = g.waves.reduce((n, x) => n + x.groups.length, 0)
    expect(w.groups.length).toBe(total)
    let last = -1
    let idx = 0
    for (const src of g.waves) {
      const firstDelay = Math.min(...w.groups.slice(idx, idx + src.groups.length).map(x => x.delay))
      expect(firstDelay).toBeGreaterThan(last)
      last = firstDelay
      idx += src.groups.length
    }
  })

  it('the arsenals: silent has no cannons or engines; relief opens everything only on the late maps', () => {
    expect(trialFor(levels[0], 'silent').kinds).toEqual(['arrow', 'mage', 'barracks'])
    expect(trialFor(levels[0], 'relief').kinds).toEqual(['arrow', 'mage', 'cannon', 'barracks'])
    expect(trialFor(levels[levels.length - 1], 'relief').kinds).toHaveLength(6)
  })
})
