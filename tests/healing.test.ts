import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Enemy } from '../src/game/units.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { LanePath } from '../src/game/path.ts'
import type { World } from '../src/game/world.ts'

const lane = new LanePath([new THREE.Vector2(0, 0), new THREE.Vector2(20, 0)])
const world = () => ({ time: 1, particles: { healSparkle: vi.fn() } } as unknown as World)
const target = () => {
  const e = new Enemy(enemyDef('brute'), lane, 0)
  e.hp = 100
  return e
}

describe('overlapping enemy healers', () => {
  it('thirty nearby Acolytes give the same healing as one', () => {
    const w = world(), e = target()
    for (let i = 0; i < 30; i++) e.receiveAuraHealing(6, w)
    expect(e.hp).toBeCloseTo(103.6)
    expect(w.particles.healSparkle).toHaveBeenCalledTimes(1)
  })
  it('caps staggered pulses and permits healing again in the next window', () => {
    const w = world(), e = target()
    e.receiveAuraHealing(6, w)
    w.time += 0.3
    e.receiveAuraHealing(6, w)
    expect(e.hp).toBeCloseTo(103.6)
    w.time += 0.3
    e.receiveAuraHealing(6, w)
    expect(e.hp).toBeCloseTo(107.2)
  })
  it('takes only the stronger aura in either order and never overheals', () => {
    for (const sequence of [[6, 10], [10, 6]]) {
      const w = world(), e = target()
      for (const hps of sequence) e.receiveAuraHealing(hps, w)
      expect(e.hp).toBeCloseTo(106)
      e.hp = e.maxHp - 1
      w.time += 1
      e.receiveAuraHealing(10, w)
      expect(e.hp).toBe(e.maxHp)
    }
  })
  it('never revives an enemy already killed', () => {
    const e = target()
    e.state = 'gone'
    e.hp = 0
    e.receiveAuraHealing(6, world())
    expect(e.hp).toBe(0)
  })
})
