import { describe, expect, it, vi } from 'vitest'
import { Game } from '../src/game/game.ts'
import { WaveManager } from '../src/game/waves.ts'
import { levels } from '../src/game/levels.ts'
import { buildPaths } from '../src/game/path.ts'
import { Enemy } from '../src/game/units.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'

function fixture(leaked: boolean) {
  const level = levels[0]
  const wave = new WaveManager(level, () => {}, () => {})
  wave.callNext()
  while (wave.phase === 'spawning') wave.update(1)
  const game = Object.assign(Object.create(Game.prototype), {
    level, waves: wave, gold: 0, goldEarned: 0,
    waveTracks: new Map([[0, { spawned: 2, gone: 0, leaked }]]),
    waveOutcomes: [], defenseStreak: 0, bestStreak: 0, perfectWaves: 0,
    isFreeplay: false, liveXp: 0,
    floater: vi.fn(), waveXpValue: () => 0, killXp: () => 0,
    hud: { xpTick: vi.fn(), showBanner: vi.fn() },
  }) as Game
  const enemy = new Enemy(enemyDef('husk'), buildPaths(level).lanes[0], 0, 0, { waveTag: 0 })
  const resolve = (leaked: boolean) => (game as unknown as { resolveWaveEnemy(e: Enemy, leaked: boolean): void }).resolveWaveEnemy(enemy, leaked)
  return { game, resolve }
}

describe('wave recovery income', () => {
  it('pays the basic clear reward after a leak, once every enemy is resolved', () => {
    const { game, resolve } = fixture(true)
    resolve(true)
    expect(game.gold).toBe(0)
    resolve(false)
    expect(game.gold).toBe(13)
    expect(game.perfectWaves).toBe(0)
    expect(game.defenseStreak).toBe(0)
    resolve(false)
    expect(game.gold).toBe(13)
  })
  it('preserves the extra payment and progression for perfect defense', () => {
    const { game, resolve } = fixture(false)
    resolve(false)
    resolve(false)
    expect(game.gold).toBe(17)
    expect(game.perfectWaves).toBe(1)
    expect(game.defenseStreak).toBe(1)
    expect(game.waveOutcomes).toEqual(['held'])
  })
})
