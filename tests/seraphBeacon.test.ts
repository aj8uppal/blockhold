import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Tower } from '../src/game/towers.ts'
import { Game } from '../src/game/game.ts'
import { towerTrees } from '../src/game/towerDefs.ts'
import { createProjectile, type Projectile } from '../src/game/projectiles.ts'
import { Enemy } from '../src/game/units.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { LanePath } from '../src/game/path.ts'
import type { PlotInfo } from '../src/game/terrain.ts'
import type { World, ProjectileSpec } from '../src/game/world.ts'

const lane = new LanePath([new THREE.Vector2(0, 0), new THREE.Vector2(100, 0)])
const plot = (x = 0): PlotInfo => ({ index: x, cell: [x, 0], pos: new THREE.Vector3(x, 0, 0), occupied: true, mesh: new THREE.Group(), raised: false })
function enemy(x: number, id = 'husk'): Enemy {
  const e = new Enemy(enemyDef(id), lane, 0)
  e.pos.set(x, id === 'gargoyle' ? 1 : 0, 0)
  e.hp = e.maxHp = 10000
  return e
}
function fixture(enemies: Enemy[] = []) {
  const shots: Projectile[] = []
  const world = {
    time: 1, dynamic: new THREE.Group(), lanes: [lane], enemies, soldiers: [], towers: [],
    cameraQuat: new THREE.Quaternion(), isBellfoundry: false,
    towerDamageMult: () => 1, armoryTier: () => 0, soldierHpMult: () => 1,
    sightBlocked: () => false, groundY: () => 0,
    sfx: vi.fn(), floater: vi.fn(), shatterUnit: vi.fn(), onEnemyKilled: vi.fn(),
    particles: { hitSpark: vi.fn(), magicImpact: vi.fn(), buildDust: vi.fn() },
    fireProjectile: (spec: ProjectileSpec) => shots.push(createProjectile(spec)),
  } as unknown as World
  return { world, shots }
}
function ray(world: World, targets = 3, extra: Partial<Extract<ProjectileSpec, { kind: 'ray' }>> = {}) {
  return createProjectile({ kind: 'ray', from: new THREE.Vector3(0, 1, 0), target: world.enemies[0],
    targets, damage: 10, damageType: 'physical', color: 0xffd166, width: 0.05, world, ...extra })
}

describe('Seraph arcs', () => {
  it('hits 3 through 7 distinct enemies as either branch upgrades, at full damage', () => {
    for (const branch of [0, 1]) for (let tier = 1; tier <= 5; tier++) {
      const enemies = Array.from({ length: 8 }, (_, i) => enemy(1 + i * 0.2))
      const { world, shots } = fixture(enemies)
      const tower = new Tower('seraph', plot(), world)
      for (let level = 1; level < tier; level++) {
        tower.upgrade(level === 3 ? branch : 0, world)
        tower.update(0.2, world) // complete the model reveal
      }
      tower.update(1 / 60, world)
      expect(shots).toHaveLength(1)
      const damage = enemies.map(e => e.maxHp - e.hp).filter(d => d > 0)
      expect(damage, `tier ${tier}, branch ${branch}`).toHaveLength(tier + 2)
      expect(damage.every(d => d === damage[0])).toBe(true)
      expect(tower.damage).toBeCloseTo(damage[0] * damage.length)
      expect((shots[0].mesh as THREE.InstancedMesh).count).toBe(tier + 2)
      shots[0].dispose?.()
    }
  })

  it('jumps between nearby enemies, skipping dead and phased targets and reaching flyers', () => {
    const first = enemy(0), phased = enemy(0.1), dead = enemy(0.2)
    phased.phased = true
    dead.state = 'gone'
    const flyer = enemy(2, 'gargoyle'), third = enemy(4), distant = enemy(9)
    const { world } = fixture([first, phased, dead, flyer, third, distant])
    const shot = ray(world, 7)
    expect(first.hp).toBeLessThan(first.maxHp)
    expect(flyer.hp).toBeLessThan(flyer.maxHp)
    expect(third.hp).toBeLessThan(third.maxHp)
    for (const e of [phased, dead, distant]) expect(e.hp).toBe(e.maxHp)
    expect((shot.mesh as THREE.InstancedMesh).count).toBe(3)
    shot.update(0.11)
    expect(shot.done).toBe(true)
    shot.dispose?.()
  })

  it('carries magic damage and armor shred through the chain and credits kills once', () => {
    const enemies = [enemy(0), enemy(1), enemy(2)]
    enemies.forEach(e => { e.armor = 0.5; e.magicResistNow = 0; e.hp = 15 })
    const { world } = fixture(enemies)
    const credit = { kills: 0, damage: 0 }
    const first = ray(world, 3, { damageType: 'magic', armorShred: 0.04, credit })
    expect(enemies.every(e => e.hp === 5 && Math.abs(e.armor - 0.46) < 1e-9)).toBe(true)
    const second = ray(world, 3, { damageType: 'magic', credit })
    expect(credit).toEqual({ kills: 3, damage: 45 })
    first.dispose?.(); second.dispose?.()
  })

  it('keeps single-target damage when no other enemy can be reached', () => {
    const { world } = fixture([enemy(0), enemy(10)])
    const shot = ray(world, 7)
    expect(world.enemies[0].hp).toBe(9990)
    expect(world.enemies[1].hp).toBe(10000)
    shot.dispose?.()
  })
})

describe('Beacon value and high ground', () => {
  it('lights spaced plots immediately after its foundation is raised', () => {
    const { world } = fixture()
    const beacon = new Tower('beacon', plot(), world)
    const arrow = new Tower('arrow', plot(4), world)
    world.towers.push(beacon, arrow)
    const game = Object.assign(Object.create(Game.prototype), world, {
      gold: 1000, paused: false, coop: null,
      terrain: { plots: [beacon.plot, arrow.plot], isOnHill: () => false, cellTop: () => 0,
        raisePlot: (p: PlotInfo) => { p.raised = true; p.pos.y += 0.45 } },
      engine: { addShake: vi.fn() }, replay: { record: vi.fn() }, selectTower: vi.fn(),
    }) as Game
    game.recomputeHighGround()
    expect(beacon.auraReach).toBe(3.6)
    expect(arrow.auraDamage).toBe(0)
    game.raisePlot(beacon.plot)
    expect(beacon.auraReach).toBeCloseTo(4.14)
    expect(beacon.range).toBe(beacon.auraReach)
    expect(arrow.auraDamage).toBe(0.1)
  })

  it('placement and upgrade rings include high ground, Armory and Far Sight', () => {
    const { world } = fixture()
    world.armoryTier = id => id === 'lamplighters' ? 2 : 0
    const beacon = new Tower('beacon', plot(), world)
    const arrow = new Tower('arrow', plot(4.5), world)
    beacon.plot.raised = true
    beacon.onHighGround = true
    world.towers.push(arrow)
    const ring = new THREE.Object3D()
    const game = Object.assign(Object.create(Game.prototype), world, {
      selectedPlot: beacon.plot, rangeRing: ring, upgradeRing: new THREE.Object3D(),
      previewLinks: new THREE.Group(),
    }) as Game
    expect(game.placementPreview('beacon').lights).toEqual([arrow])
    game.previewRange('beacon')
    expect(ring.scale.x).toBeCloseTo(beacon.auraReach)
    beacon.perk = { id: 'farsight', name: 'Far Sight', icon: 'eye', description: '' }
    game.previewUpgradeRange(beacon, towerTrees.beacon.levels[1])
    const upgradeRing = (game as unknown as { upgradeRing: THREE.Object3D }).upgradeRing
    expect(upgradeRing.scale.x).toBeCloseTo((4 + 0.6 + 0.6) * 1.15)
  })

  it('actually grants its advertised range bonus to nearby attacking towers', () => {
    const { world } = fixture()
    const arrow = new Tower('arrow', plot(), world)
    const base = arrow.range
    arrow.auraRange = 0.1
    expect(arrow.range).toBeCloseTo(base * 1.1)
    arrow.onHighGround = true
    expect(arrow.range).toBeCloseTo(base * 1.15 * 1.1)
  })
})
