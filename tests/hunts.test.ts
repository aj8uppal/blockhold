import { describe, expect, it, vi } from 'vitest'
import { Game } from '../src/game/game.ts'
import { WaveManager } from '../src/game/waves.ts'
import { Enemy } from '../src/game/units.ts'
import { HUNTS, huntLevel, huntClearGold } from '../src/game/hunts.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { investedGold } from '../src/game/towerDefs.ts'
import { buildPaths } from '../src/game/path.ts'
import { levelById } from '../src/game/levels.ts'

describe('authored boss hunts', () => {
  it('uses ten legal, independently authored waves with the advertised boss at the end', () => {
    for (const hunt of HUNTS) {
      const level = huntLevel(hunt.id)
      const lanes = buildPaths(level).lanes
      expect(level.flatScale).toBe(true)
      expect(level.waves).toHaveLength(10)
      expect(level.waves.at(-1)!.groups.some(g => g.enemy === hunt.boss && g.count === 1)).toBe(true)
      for (const wave of level.waves) for (const group of wave.groups) {
        expect(enemyDef(group.enemy)).toBeTruthy()
        expect(lanes[group.lane ?? 0]).toBeDefined()
        expect(group.count).toBeGreaterThan(0)
        expect(group.hpMult).toBeGreaterThan(0)
        expect(group.interval).toBeGreaterThan(0)
      }
      // A hunt must not mutate or health-scale its source campaign.
      expect(level.waves).not.toBe(levelById(hunt.map).waves)
      expect(levelById(hunt.map).id).not.toContain('hunt-')
    }
  })

  it('earns the Seraph capstone budget over the approach instead of granting it at the start', () => {
    for (const hunt of HUNTS) {
      const level = huntLevel(hunt.id)
      expect(level.startGold).toBeLessThan(investedGold('seraph', 5, 0))
      const approach = level.waves.slice(0, -1)
      const bounty = approach.reduce((sum, w) => sum + w.groups.reduce((n, g) => n + enemyDef(g.enemy).bounty * g.count, 0), 0)
      const funding = approach.reduce((n, _, i) => n + huntClearGold(i + 1) + 10 + (i + 1) * 3, 0)
      // Includes a modest legal supporting defense, without Armory or summons.
      expect(level.startGold + bounty + funding).toBeGreaterThanOrEqual(investedGold('seraph', 5, 0) + 2200)
    }
  })


  it('pays earned funding through the real wave resolver once, including a recovered wave', () => {
    const level = huntLevel('ossuary')
    const waves = new WaveManager(level, () => {}, () => {})
    waves.callNext()
    while (waves.phase === 'spawning') waves.update(1)
    const game = Object.assign(Object.create(Game.prototype), {
      hunt: HUNTS[0], level, waves, gold: 0, goldEarned: 0,
      waveTracks: new Map([[0, { spawned: 2, gone: 0, leaked: true }]]),
      waveOutcomes: [], defenseStreak: 0, bestStreak: 0, perfectWaves: 0,
      isFreeplay: false, liveXp: 0, floater: vi.fn(),
      waveXpValue: () => 0, killXp: () => 0,
      hud: { xpTick: vi.fn(), showBanner: vi.fn() },
    }) as Game
    const foe = new Enemy(enemyDef('husk'), buildPaths(level).lanes[0], 0, 0, { waveTag: 0 })
    const resolve = () => (game as unknown as { resolveWaveEnemy(e: Enemy, leaked: boolean): void }).resolveWaveEnemy(foe, false)
    resolve()
    expect(game.gold).toBe(0)
    resolve()
    expect(game.gold).toBe(913)
    resolve()
    expect(game.gold).toBe(913)
    expect(game.perfectWaves).toBe(0)
  })

  it('never grants approach funding for the final wave, freeplay, or malformed wave numbers', () => {
    expect(Array.from({ length: 9 }, (_, i) => huntClearGold(i + 1)).reduce((a, b) => a + b)).toBe(8100)
    for (const wave of [-1, 0, 1.5, 10, 11, 100, NaN, Infinity]) expect(huntClearGold(wave)).toBe(0)
  })
})
