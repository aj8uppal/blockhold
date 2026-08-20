import { describe, expect, it, vi } from 'vitest'
import { levels } from '../src/game/levels.ts'
import type { LevelDef } from '../src/game/types.ts'
import { WaveManager } from '../src/game/waves.ts'

const testLevel: LevelDef = {
  ...levels[0],
  id: 'wave-test',
  waves: [
    {
      groups: [
        { enemy: 'husk', count: 2, interval: 0.5, delay: 0, lane: 0 },
        { enemy: 'husk', count: 3, interval: 0.5, delay: 0.25, lane: 1 },
        { enemy: 'sprinter', count: 1, interval: 1, delay: 0.5, lane: 0 },
      ],
    },
    {
      groups: [
        { enemy: 'shield', count: 2, interval: 0.4, delay: 0, lane: 1 },
        { enemy: 'husk', count: 4, interval: 0.3, delay: 0.2, lane: 0 },
      ],
    },
  ],
}

describe('WaveManager', () => {
  it('starts wave 0 after the initial countdown', () => {
    const onWaveStart = vi.fn()
    const manager = new WaveManager(testLevel, vi.fn(), onWaveStart)

    expect(manager.phase).toBe('countdown')
    expect(manager.waveIndex).toBe(-1)
    manager.update(13)
    expect(onWaveStart).not.toHaveBeenCalled()
    manager.update(1)

    expect(manager.phase).toBe('spawning')
    expect(manager.waveIndex).toBe(0)
    expect(onWaveStart).toHaveBeenCalledWith(0)
  })

  it('fires the spawn callback for every group member in each wave', () => {
    const spawned: { enemy: string, lane: number }[] = []
    const manager = new WaveManager(testLevel, (enemy, lane) => spawned.push({ enemy, lane }), vi.fn())

    manager.callNext()
    manager.update(10)
    expect(spawned).toHaveLength(6)
    expect(spawned.filter(s => s.enemy === 'husk')).toHaveLength(5)
    expect(spawned.filter(s => s.enemy === 'sprinter')).toHaveLength(1)

    spawned.length = 0
    manager.callNext()
    manager.update(10)
    expect(spawned).toHaveLength(6)
    expect(spawned.filter(s => s.enemy === 'shield')).toHaveLength(2)
    expect(spawned.filter(s => s.enemy === 'husk')).toHaveLength(4)
  })

  it('awards a positive bonus and starts the next wave when called early', () => {
    const onWaveStart = vi.fn()
    const manager = new WaveManager(testLevel, vi.fn(), onWaveStart)
    manager.callNext()
    manager.update(10)
    manager.update(2)

    const bonus = manager.callNext()

    expect(bonus).toBeGreaterThan(0)
    expect(manager.waveIndex).toBe(1)
    expect(manager.phase).toBe('spawning')
    expect(onWaveStart.mock.calls.map(([index]) => index)).toEqual([0, 1])
  })

  it('finishes after the final wave has fully spawned', () => {
    const manager = new WaveManager(testLevel, vi.fn(), vi.fn())

    manager.callNext()
    manager.update(10)
    manager.callNext()
    expect(manager.phase).toBe('spawning')
    manager.update(10)

    expect(manager.phase).toBe('finished')
    expect(manager.allSpawned).toBe(true)
  })

  it('aggregates duplicate enemy groups in the next-wave preview', () => {
    const manager = new WaveManager(testLevel, vi.fn(), vi.fn())

    expect(manager.nextWavePreview()).toEqual([
      { name: 'Husk', count: 5 },
      { name: 'Ashhound', count: 1 },
    ])

    manager.callNext()
    manager.update(10)
    expect(manager.nextWavePreview()).toEqual([
      { name: 'Ironclad', count: 2 },
      { name: 'Husk', count: 4 },
    ])
  })
})
