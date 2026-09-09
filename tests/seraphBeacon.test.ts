import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Tower } from '../src/game/towers.ts'
import { Game } from '../src/game/game.ts'
import { towerTrees } from '../src/game/towerDefs.ts'
import { createProjectile, clearBurnZones, type Projectile } from '../src/game/projectiles.ts'
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
    sfx: vi.fn(), shake: vi.fn(), impact: vi.fn(), floater: vi.fn(), shatterUnit: vi.fn(), onEnemyKilled: vi.fn(),
    particles: { stunStars: vi.fn(), hitSpark: vi.fn(), magicImpact: vi.fn(), buildDust: vi.fn() },
    fireProjectile: (spec: ProjectileSpec) => shots.push(createProjectile(spec)),
  } as unknown as World
  return { world, shots }
}
function ray(world: World, targets = 3, extra: Partial<Extract<ProjectileSpec, { kind: 'ray' }>> = {}) {
  return createProjectile({ kind: 'ray', from: new THREE.Vector3(0, 1, 0),
    targets: world.enemies.filter(e => e.targetable).slice(0, targets), damage: 10, damageType: 'physical', color: 0xffd166, width: 0.05, world, ...extra })
}

describe('Seraph independent beams', () => {
  it('keeps both signatures effective without a camera jolt, hit stop, or tower scale pulse', () => {
    for (const branch of [0, 1]) {
      const e = enemy(1), { world, shots } = fixture([e])
      const tower = new Tower('seraph', plot(), world)
      for (let level = 1; level < 5; level++) { tower.upgrade(level === 3 ? branch : 0, world); tower.update(0.2, world) }
      tower.update(1, world)
      const hp = e.hp
      vi.mocked(world.sfx).mockClear()
      const signature = tower as unknown as { dawnfall(w: World): void, eclipse(w: World): void, signatureFlashT: number }
      if (branch === 0) signature.dawnfall(world)
      else signature.eclipse(world)
      if (branch === 0) expect(hp - e.hp).toBe(600)
      else expect(e.stunUntil).toBe(world.time + 1.5)
      expect(world.shake).not.toHaveBeenCalled()
      expect(world.impact).not.toHaveBeenCalled()
      expect(world.sfx).not.toHaveBeenCalledWith('signature', expect.anything())
      expect(signature.signatureFlashT).toBe(0)
      const effect = shots.at(-1)!
      expect(effect.mesh.name).toBe(branch === 0 ? 'dawnfall-light' : 'eclipse-halo')
      effect.update(0.2)
      expect(effect.done).toBe(false)
      effect.update(0.7)
      expect(effect.done).toBe(true)
      for (const shot of shots) shot.dispose?.()
      clearBurnZones(world)
    }
  })
  it('lets enemy colors recover between rapid volleys', () => {
    const e = enemy(0), { world } = fixture([e])
    const materials: THREE.MeshStandardMaterial[] = []
    e.group.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) materials.push(o.material) })
    const baseIntensity = materials[0].emissiveIntensity
    e.takeDamage(1, 'true', world)
    expect(materials[0].emissiveIntensity).toBe(0.24)
    world.time += 0.04
    e.takeDamage(1, 'true', world)
    // Isolate presentation expiry from movement and combat.
    e.state = 'gone'
    e.update(0.07, world)
    e.state = 'walking'
    world.time += 0.04
    e.takeDamage(1, 'true', world)
    expect(materials[0].emissiveIntensity).toBe(baseIntensity)
    expect(materials[0].emissive.getHex()).toBe(0)
    world.time += 0.12
    e.takeDamage(1, 'true', world)
    expect(materials[0].emissiveIntensity).toBe(0.24)
  })
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
      expect((shots[0].mesh.getObjectByName('ray-core') as THREE.InstancedMesh).count).toBe((tier + 2) * 3)
      shots[0].dispose?.()
    }
  })

  it('reaches enemies on opposite sides without bouncing, skipping hidden and distant targets', () => {
    const first = enemy(-3), phased = enemy(0.1), dead = enemy(0.2)
    phased.phased = true
    dead.state = 'gone'
    const flyer = enemy(3, 'gargoyle'), third = enemy(0), distant = enemy(4.5)
    const { world, shots } = fixture([first, phased, dead, flyer, third, distant])
    const tower = new Tower('seraph', plot(), world)
    tower.update(1 / 60, world)
    for (const e of [first, flyer, third]) expect(e.hp).toBeLessThan(e.maxHp)
    for (const e of [phased, dead, distant]) expect(e.hp).toBe(e.maxHp)
    const core = shots[0].mesh.getObjectByName('ray-core') as THREE.InstancedMesh
    const matrix = new THREE.Matrix4()
    const starts = [0, 3, 6].map(i => {
      core.getMatrixAt(i, matrix)
      return new THREE.Vector3(0, 0, -0.5).applyMatrix4(matrix)
    })
    expect(starts[0].distanceTo(starts[1])).toBeLessThan(1e-6)
    expect(starts[0].distanceTo(starts[2])).toBeLessThan(1e-6)
    shots[0].update(0.09)
    expect(shots[0].done).toBe(true)
    shots[0].dispose?.()
  })

  it('checks each beam for terrain, and applies range bonuses to the whole volley', () => {
    const first = enemy(1), hidden = enemy(2), far = enemy(4.3)
    const { world, shots } = fixture([first, hidden, far])
    world.sightBlocked = (_x, _z, _y, x) => x === 2
    const tower = new Tower('seraph', plot(), world)
    tower.auraRange = 0.25
    tower.update(1 / 60, world)
    expect(first.hp).toBeLessThan(first.maxHp)
    expect(far.hp).toBeLessThan(far.maxHp)
    expect(hidden.hp).toBe(hidden.maxHp)
    shots[0].dispose?.()
  })

  it('carries magic damage and armor shred to each beam and credits kills once', () => {
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
    const { world, shots } = fixture([enemy(0), enemy(10)])
    const tower = new Tower('seraph', plot(), world)
    tower.update(1 / 60, world)
    const shot = shots[0]
    expect(world.enemies[0].hp).toBeLessThan(10000)
    expect(world.enemies[1].hp).toBe(10000)
    shot.dispose?.()
  })
})

describe('Beacon value and high ground', () => {
  it('never charges for raising a naturally elevated plot', () => {
    const raise = vi.fn(), route = vi.fn()
    const game = Object.assign(Object.create(Game.prototype), {
      paused: false, gold: 1000, terrain: { isOnHill: () => true, raisePlot: raise }, route,
    }) as Game
    const p = plot()
    game.raisePlot(p)
    expect(game.gold).toBe(1000)
    expect(p.raised).toBe(false)
    expect(raise).not.toHaveBeenCalled()
    expect(route).not.toHaveBeenCalled()
  })
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
    const ring = new THREE.Mesh()
    const upgradeRing = new THREE.Mesh()
    const radiusOf = (mesh: THREE.Mesh) => {
      const p = mesh.geometry.getAttribute('position')
      return Math.max(...Array.from({ length: p.count }, (_, i) => Math.hypot(p.getX(i), p.getZ(i))))
    }
    const game = Object.assign(Object.create(Game.prototype), world, {
      selectedPlot: beacon.plot, rangeRing: ring, upgradeRing,
      terrain: { level: { width: 30, height: 30, voids: [] }, cellTop: () => 0.5 },
      previewLinks: new THREE.Group(),
    }) as Game
    expect(game.placementPreview('beacon').lights).toEqual([arrow])
    game.previewRange('beacon')
    expect(radiusOf(ring)).toBeCloseTo(beacon.auraReach)
    beacon.perk = { id: 'farsight', name: 'Far Sight', icon: 'eye', description: '' }
    game.previewUpgradeRange(beacon, towerTrees.beacon.levels[1])
    expect(radiusOf(upgradeRing)).toBeCloseTo((4 + 0.6 + 0.6) * 1.15)
    ring.geometry.dispose(); upgradeRing.geometry.dispose()
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

describe('Beacon support combinations', () => {
  it('buffs existing and upgraded soldiers without stacking or changing shared definitions', () => {
    const { world } = fixture()
    const barracks = new Tower('barracks', plot(1), world)
    const beacon = new Tower('beacon', plot(0), world)
    beacon.upgrade(0, world); beacon.upgrade(0, world)
    world.towers.push(barracks, beacon)
    const game = Object.assign(Object.create(Game.prototype), world) as Game
    const base = towerTrees.barracks.levels[0].soldier!
    const soldier = barracks.soldiers[0]
    soldier.hp = soldier.maxHp / 2
    const health = soldier.hp
    game.recomputeAuras()
    expect(soldier.supportDamage).toBeCloseTo(1.22)
    expect(soldier.supportRate).toBeCloseTo(1.08)
    expect(soldier.hp).toBe(health) // applying light is not a free heal
    expect(base.damage).toEqual([2, 5])
    game.recomputeAuras()
    expect(soldier.supportDamage).toBeCloseTo(1.22)
    barracks.upgrade(0, world)
    expect(barracks.soldiers.every(s => s.supportDamage === 1.22 && s.supportRate === 1.08)).toBe(true)
    game.towers.splice(game.towers.indexOf(beacon), 1)
    game.recomputeAuras()
    expect(barracks.soldiers.every(s => s.supportDamage === 1 && s.supportRate === 1)).toBe(true)
  })

  it('chooses one aura by damage and speed together, independent of build order', () => {
    const { world } = fixture()
    const arrow = new Tower('arrow', plot(1), world)
    const watch = new Tower('beacon', plot(0), world)
    const tithe = new Tower('beacon', plot(2), world)
    for (let i = 0; i < 3; i++) watch.upgrade(0, world)
    for (let i = 0; i < 4; i++) tithe.upgrade(i === 2 ? 1 : 0, world)
    const game = Object.assign(Object.create(Game.prototype), world) as Game
    for (const towers of [[arrow, tithe, watch], [arrow, watch, tithe]]) {
      game.towers = towers
      game.recomputeAuras()
      expect(arrow.auraRate).toBe(0.2) // equal damage, better attack speed
      expect(arrow.auraDamage).toBe(0.22)
      expect(arrow.auraRange).toBe(0.08) // no cherry-picking a second aura's range
    }
  })

  it('uses the lit rally range when validating a Barracks order', () => {
    const { world } = fixture()
    const barracks = new Tower('barracks', plot(0), world)
    expect(barracks.isValidRally(2.3, 0, world)).toBe(false)
    barracks.auraRange = 0.1
    expect(barracks.isValidRally(2.3, 0, world)).toBe(true)
    expect(barracks.isValidRally(3, 0, world)).toBe(false)
  })
})
