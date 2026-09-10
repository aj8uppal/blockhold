import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Tower } from '../src/game/towers.ts'
import { towerTrees, investedGold } from '../src/game/towerDefs.ts'
import { mythicFor, SOLAR_WARNING, RIFT_DURATION, LEGION_COOLDOWN, LEGION_DURATION } from '../src/game/mythics.ts'
import { towerModel, muzzleHeights } from '../src/voxel/models_towers.ts'
import { Enemy } from '../src/game/units.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { LanePath } from '../src/game/path.ts'
import type { PlotInfo } from '../src/game/terrain.ts'
import type { World, ProjectileSpec } from '../src/game/world.ts'
import type { TowerKind } from '../src/game/types.ts'

const lane = new LanePath([new THREE.Vector2(0, 0), new THREE.Vector2(100, 0)])
function enemy(x: number): Enemy {
  const e = new Enemy(enemyDef('husk'), lane, 0)
  e.pos.set(x, 0, 0)
  e.hp = e.maxHp = 10000
  return e
}
function fixture(kind: TowerKind = 'seraph', branch: 0 | 1 = 0, enemies: Enemy[] = []) {
  const specs: ProjectileSpec[] = []
  const world = {
    time: 1, dynamic: new THREE.Group(), lanes: [lane], enemies, soldiers: [], towers: [],
    cameraQuat: new THREE.Quaternion(), isBellfoundry: false, sellRefund: 0.7,
    towerDamageMult: () => 1, armoryTier: () => 0, soldierHpMult: () => 1,
    sightBlocked: () => false, groundY: () => 0,
    sfx: vi.fn(), shake: vi.fn(), impact: vi.fn(), floater: vi.fn(), shatterUnit: vi.fn(), onEnemyKilled: vi.fn(),
    particles: { stunStars: vi.fn(), hitSpark: vi.fn(), magicImpact: vi.fn(), buildDust: vi.fn(), healSparkle: vi.fn() },
    fireProjectile: (spec: ProjectileSpec) => specs.push(spec),
  } as unknown as World
  const plot: PlotInfo = { index: 0, cell: [0, 0], pos: new THREE.Vector3(), occupied: true, mesh: new THREE.Group(), raised: false }
  const tower = new Tower(kind, plot, world)
  world.towers.push(tower)
  for (let level = 1; level < 6; level++) {
    tower.upgrade(level === 3 ? branch : 0, world)
    tower.update(0.2, world)
  }
  return { world, tower, specs }
}
const mechanics = (tower: Tower) => tower as unknown as {
  fire(e: Enemy, w: World): void
  updateMythic(dt: number, w: World): void
  mythicAt: THREE.Vector3 | null
  mythicCharge: number
  mythicReadyAt: number
  mythicUntil: number
}

describe('bounded Mythic roster', () => {
  it('only transforms the three selected branches and includes their additional investment', () => {
    const roster = []
    for (const kind of Object.keys(towerTrees) as TowerKind[]) for (const branch of [0, 1] as const) {
      const mythic = mythicFor(kind, branch)
      if (!mythic) continue
      roster.push(mythic.name)
      const cap = towerTrees[kind].capstones[branch]
      expect(mythic.damage).toEqual(cap.damage)
      expect(mythic.attackInterval).toEqual(cap.attackInterval)
      expect(investedGold(kind, 6, branch) - investedGold(kind, 5, branch)).toBe(mythic.cost)
      expect(mythic.signature).not.toBe(cap.signature)
      const { tower } = fixture(kind, branch)
      expect(tower.level).toBe(6)
      expect(tower.def.name).toBe(mythic.name)
      expect(tower.upgradeOptions).toEqual([])
      expect(tower.sellValue).toBe(Math.round(investedGold(kind, 6, branch) * 0.7))
      const model = towerModel(mythic.model)
      expect(Number.isFinite(muzzleHeights[mythic.model])).toBe(true)
      expect(model.parts).not.toEqual(towerModel(cap.model).parts)
      for (const boxes of Object.values(model.parts)) for (const b of boxes) {
        expect([b.x, b.y, b.z, b.sx, b.sy, b.sz].every(Number.isFinite)).toBe(true)
      }
      tower.update(0.4, (tower as unknown as { world: World }).world)
      expect(tower.model.scale.toArray().every(Number.isFinite)).toBe(true)
    }
    expect(roster.sort()).toEqual(['Event Horizon', 'Helios Engine', 'Last Legion'])
  })

  it('rejects unsupported branches and invalid option indices', () => {
    const { tower, world } = fixture('barracks', 1)
    expect(tower.level).toBe(5)
    expect(tower.upgradeOptions).toEqual([])
    tower.upgrade(0, world)
    tower.upgrade(-1, world)
    tower.upgrade(99, world)
    expect(tower.level).toBe(5)
  })
})

describe('Mythic combat identities', () => {
  it('keeps seven separate beams and charges a ground strike with an escape window', () => {
    const enemies = Array.from({ length: 7 }, (_, i) => enemy(1 + i * 0.1))
    const { world, tower, specs } = fixture('seraph', 0, enemies)
    const state = mechanics(tower)
    for (let i = 0; i < 12; i++) state.fire(enemies[0], world)
    const rays = specs.filter(s => s.kind === 'ray')
    expect(rays).toHaveLength(12)
    expect(rays.every(r => r.targets.length === 7 && new Set(r.targets).size === 7)).toBe(true)
    expect(state.mythicAt).not.toBeNull()
    state.updateMythic(0.1, world)
    expect(enemies.every(e => e.hp === 10000)).toBe(true)
    enemies[0].pos.x = 20
    world.time += SOLAR_WARNING
    state.updateMythic(0.1, world)
    expect(enemies[0].hp).toBe(10000)
    expect(enemies[1].hp).toBe(7600)
    expect(tower.damage).toBe(2400 * 6)
    expect(state.mythicAt).toBeNull()
    expect(specs.at(-1)?.kind).toBe('seraphBloom')
  })

  it('opens a bounded rift on phased foes, exposes them to the defense, and expires without stunning', () => {
    const hidden = enemy(1), distant = enemy(9)
    hidden.phased = true
    const { tower, world } = fixture('seraph', 1, [hidden, distant])
    const state = mechanics(tower)
    state.updateMythic(0.1, world)
    world.time = state.mythicReadyAt
    state.updateMythic(0.1, world)
    expect(hidden.targetable).toBe(true)
    expect(hidden.revealedUntil).toBeGreaterThan(world.time)
    expect(distant.mythicExposedUntil).toBe(0)
    expect(hidden.takeDamage(100, 'true', world)).toBe(130)
    expect(hidden.stunUntil).toBe(0)
    const openedAt = world.time
    world.time = openedAt + RIFT_DURATION
    state.updateMythic(0.1, world)
    hidden.revealed = world.time < hidden.revealedUntil
    expect(hidden.targetable).toBe(false)
    expect(state.mythicAt).toBeNull()
    expect(hidden.mythicExposedUntil).toBeLessThan(world.time)
    expect(state.mythicReadyAt).toBeGreaterThan(world.time)
  })

  it('relocates and restores the Legion once per cooldown; healing stays at its planted standard', () => {
    const { tower, world } = fixture('barracks', 0)
    const state = mechanics(tower)
    const soldier = tower.soldiers[0]
    const foe = enemy(0)
    soldier.target = foe
    foe.blockers.push(soldier)
    soldier.hp = 1
    tower.soldiers[1].dead = true
    tower.setRally(2, 0, world)
    expect(tower.activateMythic(world)).toBe(true)
    expect(soldier.target).toBeNull()
    expect(foe.blockers).not.toContain(soldier)
    expect(tower.soldiers.every(s => s.alive && s.hp === s.maxHp)).toBe(true)
    expect(soldier.group.position.distanceTo(tower.soldierHome(0))).toBeLessThan(0.001)
    expect(tower.activateMythic(world)).toBe(false)
    soldier.hp = 100
    state.updateMythic(1, world)
    expect(soldier.hp).toBeCloseTo(100 + soldier.maxHp * 0.12)
    tower.setRally(4, 0, world)
    expect(state.mythicAt?.x).toBe(2)
    world.time += LEGION_DURATION
    state.updateMythic(1, world)
    expect(state.mythicAt).toBeNull()
    expect(tower.activateMythic(world)).toBe(false)
    world.time = 1 + LEGION_COOLDOWN
    expect(tower.activateMythic(world)).toBe(true)
    expect(state.mythicAt?.x).toBe(4)
  })

  it('ghost echoes cannot activate a Mythic standard', () => {
    const { tower, world } = fixture('barracks', 0)
    tower.isGhost = true
    expect(tower.activateMythic(world)).toBe(false)
  })
})
