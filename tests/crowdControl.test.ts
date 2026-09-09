import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Enemy } from '../src/game/units.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { LanePath } from '../src/game/path.ts'
import { Trap } from '../src/game/traps.ts'
import type { World } from '../src/game/world.ts'

const lane = new LanePath([new THREE.Vector2(0, 0), new THREE.Vector2(100, 0)])
function worldFor(enemies: Enemy[]): World {
  return {
    time: 0, enemies, soldiers: [], towers: [], cameraQuat: new THREE.Quaternion(),
    cuttingAt: () => false, groundY: () => 0,
    particles: { stunStars: vi.fn(), buildDust: vi.fn() },
  } as unknown as World
}

describe('boss crowd control', () => {
  it('keeps a Veilqueen advancing under continuous stun attempts', () => {
    const queen = new Enemy(enemyDef('veilqueen'), lane, 0)
    const world = worldFor([queen])
    for (let i = 0; i < 300; i++) {
      world.time = i / 60
      queen.applyStun(1.5, world)
      queen.update(1 / 60, world)
    }
    expect(queen.dist).toBeGreaterThan(queen.def.speed * 3)
    expect(queen.dist).toBeLessThan(queen.def.speed * 5)
  })

  it('animates hovering wings during a stun and resumes travel afterwards', () => {
    const queen = new Enemy(enemyDef('veilqueen'), lane, 0)
    const world = worldFor([queen])
    const wing = queen.group.getObjectByName('wingL')!
    queen.applyStun(1.5, world)
    queen.update(1 / 60, world)
    const angle = wing.rotation.z
    world.time = 0.1
    queen.update(0.1, world)
    expect(queen.dist).toBe(0)
    expect(wing.rotation.z).not.toBe(angle)
    world.time = 0.7
    queen.update(1 / 60, world)
    expect(queen.dist).toBeGreaterThan(0)
    expect(queen.pos.y).toBeGreaterThan(0.8)
  })

  it('preserves ordinary stun duration while limiting boss slows', () => {
    const husk = new Enemy(enemyDef('husk'), lane, 0)
    const queen = new Enemy(enemyDef('veilqueen'), lane, 0)
    const world = worldFor([husk, queen])
    husk.applyStun(1.5, world)
    expect(husk.stunUntil).toBe(1.5)
    husk.applySlow(0.3, 2, world)
    queen.applySlow(0.3, 2, world)
    expect(husk.slowFactor).toBe(0.3)
    expect(queen.slowFactor).toBe(0.65)
  })

  it('frost runes affect walkers but never flying enemies', () => {
    const enemies = ['husk', 'gargoyle', 'veilqueen'].map(id => new Enemy(enemyDef(id), lane, 0))
    const world = worldFor(enemies)
    const trap = new Trap('frost', {
      index: 0, cell: [0, 0], pos: new THREE.Vector3(), occupied: true, mesh: new THREE.Group(),
    }, world)
    trap.update(1 / 60, world)
    expect(enemies[0].slowUntil).toBeGreaterThan(0)
    for (const flyer of enemies.slice(1)) {
      expect(flyer.slowUntil).toBe(0)
      flyer.update(1 / 60, world)
      expect(flyer.dist).toBeGreaterThan(0)
    }
  })
})
