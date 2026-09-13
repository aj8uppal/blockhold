import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Tower } from '../src/game/towers.ts'
import { Enemy } from '../src/game/units.ts'
import { Hero, HERO_DEFS, heroRankGold, heroRankCost } from '../src/game/hero.ts'
import { HERO_PATHS } from '../src/game/heroPaths.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { LanePath } from '../src/game/path.ts'
import { mythicFor } from '../src/game/mythics.ts'
import { MYTHIC_POWER_MODELS } from '../src/game/mythicPowers.ts'
import { addBurnZone, clearBurnZones, createProjectile, detonateBurnZones } from '../src/game/projectiles.ts'
import type { World, ProjectileSpec } from '../src/game/world.ts'
import type { HeroId, TowerKind } from '../src/game/types.ts'

const lane = new LanePath([new THREE.Vector2(0, 0), new THREE.Vector2(100, 0)])
function foe(x = 2, id = 'brute', z = 0) {
  const e = new Enemy({ ...enemyDef(id), speed: 0 }, lane, 0, x)
  e.pos.set(x, e.def.flying ? 1 : 0, z)
  e.dist = x
  e.hp = e.maxHp = 10000
  return e
}
function world(): World & { shots: ProjectileSpec[] } {
  const shots: ProjectileSpec[] = []
  const w = {
    balanceRuleset: 17, time: 1, dynamic: new THREE.Group(), lanes: [lane], enemies: [], soldiers: [], towers: [], shots,
    cameraQuat: new THREE.Quaternion(), isBellfoundry: false, sellRefund: .7, shards: 0, heroReviveMult: 1,
    towerDamageMult: () => 1, armoryTier: () => 0, soldierHpMult: () => 1, splashMult: () => 1,
    sightBlocked: () => false, groundY: () => 0, cuttingAt: () => false, findPath: () => [],
    sfx: vi.fn(), shake: vi.fn(), impact: vi.fn(), floater: vi.fn(), shatterUnit: vi.fn(), spawnEnemyAt: vi.fn(), onEnemyLeaked: vi.fn(), rewardMythicReserve: vi.fn(),
    particles: new Proxy({}, { get: () => vi.fn() }),
    fireProjectile: (p: ProjectileSpec) => shots.push(p),
    onEnemyKilled: (e: Enemy) => { for (const t of w.towers) t.mythicAbility.onKill(e, w) },
  } as unknown as World & { shots: ProjectileSpec[] }
  return w
}
function tower(w: World, kind: TowerKind, branch: 0 | 1, y = 0) {
  const t = new Tower(kind, { index: w.towers.length, cell: [0, 0], pos: new THREE.Vector3(0, y, 0), occupied: true, mesh: new THREE.Group(), raised: y > 0 }, w)
  w.towers.push(t); w.dynamic.add(t.group)
  for (let level = 1; level < 6; level++) { t.upgrade(level === 3 ? branch : 0, w); t.update(.2, w) }
  t.update(1, w)
  return t
}
function activate(t: Tower, w: World) { t.mythicAbility.readyAt = w.time; t.mythicAbility.update(1 / 60, w) }

describe('mythic masterworks', () => {
  it('adds thirteen distinct battlefield powers and preserves the three existing transformations and old battle rules', () => {
    expect(new Set(Object.values(MYTHIC_POWER_MODELS)).size).toBe(13)
    for (const kind of ['arrow', 'mage', 'cannon', 'beacon', 'ballista', 'barracks', 'tidecaller', 'seraph'] as const) for (const branch of [0, 1] as const) {
      const old = mythicFor(kind, branch, 16)!, next = mythicFor(kind, branch, 17)!
      expect(old.mythicAbility).toBeUndefined()
      expect(next.mythicAbility ?? next.signature).toBeTruthy()
      expect(next.cost).toBe(old.cost)
      expect(next.damage).toEqual(old.damage)
    }
  })

  it('fires Thousandwing from its actual bow after yaw, high ground and tier scaling', () => {
    const w = world(), t = tower(w, 'arrow', 1, 2)
    const turret = t.model.getObjectByName('turret')!
    turret.rotation.y = .8
    const muzzle = (t as unknown as { muzzle(): THREE.Vector3 }).muzzle()
    const bow = t.model.getObjectByName('muzzle')!.getWorldPosition(new THREE.Vector3())
    expect(muzzle.distanceTo(bow)).toBeLessThan(1e-8)
    expect(new THREE.Box3().setFromObject(turret).expandByScalar(.01).containsPoint(muzzle)).toBe(true)
    expect(muzzle.y - t.pos.y).toBeLessThan(2)
    expect(Math.hypot(muzzle.x - t.pos.x, muzzle.z - t.pos.z)).toBeGreaterThan(.1)
    const old = world(); Object.assign(old, { balanceRuleset: 16 })
    const legacy = tower(old, 'arrow', 1)
    expect((legacy as unknown as { muzzle(): THREE.Vector3 }).muzzle().y).toBeCloseTo(2.3 * 1.38)
  })

  it('draws every archer tier from the bow in old saves without changing arrow impact timing', () => {
    for (const balanceRuleset of [16, 17]) for (const branch of [0, 1]) {
      const w = world(); w.balanceRuleset = balanceRuleset
      const t = new Tower('arrow', { index: 0, cell: [0, 0], pos: new THREE.Vector3(0, 2, 0), occupied: true, mesh: new THREE.Group(), raised: true }, w)
      w.towers.push(t); w.dynamic.add(t.group)
      for (let tier = 1; tier <= 6; tier++) {
        if (tier > 1) t.upgrade(tier === 4 ? branch : 0, w)
        t.update(2, w)
        t.model.getObjectByName('turret')!.rotation.y = .8
        const bow = t.model.getObjectByName('muzzle')!.getWorldPosition(new THREE.Vector3())
        const legacyFrom = (t as unknown as { muzzle(): THREE.Vector3 }).muzzle()
        const target = foe(3), baselineTarget = foe(3)
        ;(t as unknown as { fireArrowAt(e: Enemy, d: number, at: THREE.Vector3, w: World): void }).fireArrowAt(target, 10, legacyFrom, w)
        const shot = w.shots.at(-1)!
        expect(shot.kind).toBe('arrow')
        if (shot.kind !== 'arrow') throw new Error('Expected an arrow')
        const visual = createProjectile(shot), baseline = createProjectile({ ...shot, visualFrom: undefined, target: baselineTarget })
        expect(visual.mesh.position.distanceTo(bow)).toBeLessThan(1e-8)
        if (tier === 6 && balanceRuleset === 16) expect(legacyFrom.y - bow.y).toBeGreaterThan(1)
        visual.update(.001); baseline.update(.001)
        expect(visual.mesh.position.distanceTo(bow)).toBeLessThan(.02)
        for (let tick = 0; tick < 300 && !baseline.done; tick++) {
          visual.update(1 / 60); baseline.update(1 / 60)
          expect(visual.done).toBe(baseline.done)
          expect(target.hp).toBe(baselineTarget.hp)
        }
        expect(visual.done).toBe(true)
      }
      t.dismantle(w, true)
    }
  })

  it('Deathmark follows only its strongest prey and vulnerability never multiplies with Event Horizon', () => {
    const w = world(), t = tower(w, 'arrow', 0), e = foe(), other = foe(2.1)
    other.hp = 4000; w.enemies.push(other, e)
    activate(t, w)
    expect(e.takeDamage(100, 'true', w)).toBe(125)
    expect(other.takeDamage(100, 'true', w)).toBe(100)
    e.mythicExposedUntil = 10
    expect(e.takeDamage(100, 'true', w)).toBe(130)
    const hp = e.hp
    e.receiveAuraHealing(100, w)
    expect(e.hp).toBe(hp)
    e.pos.x = 7; w.time = 2; t.mythicAbility.update(.1, w)
    expect(e.markedUntil).toBeGreaterThan(w.time)
    w.time = 8; t.mythicAbility.update(.1, w)
    expect(w.dynamic.getObjectByName('mythic-deathmark')).toBeUndefined()
  })

  it('venom groves poison unlimited clustered targets and death bursts cannot recurse', () => {
    const w = world(), t = tower(w, 'arrow', 1)
    w.enemies.push(...Array.from({ length: 12 }, (_, i) => foe(2 + i * .03)))
    activate(t, w)
    expect(w.enemies.every(e => e.poisons.length === 1)).toBe(true)
    const victim = w.enemies[0]; victim.hp = 1
    victim.takeDamage(2, 'true', w)
    expect(w.enemies[1].hp).toBe(9840)
    expect(w.enemies[1].poisons.length).toBe(2)
    expect(t.damage).toBe(160 * 11)
  })

  it('Null Zone suppresses magic resistance, wards, healing and summons only inside its field', () => {
    const w = world(), t = tower(w, 'mage', 0), e = foe(2, 'ossuary'), far = foe(15)
    e.magicResistNow = .6; e.wardedUntil = 100; e.hp = 7000
    e.def = { ...e.def, regen: 1000, summons: { id: 'husk', count: 3, interval: .01 } }
    w.enemies.push(e, far); activate(t, w)
    expect(e.takeDamage(100, 'magic', w)).toBe(100)
    e.receiveAuraHealing(1000, w); e.update(.01, w)
    expect(e.hp).toBe(6900)
    expect(w.spawnEnemyAt).not.toHaveBeenCalled()
    expect(far.nullifiedUntil).toBe(0)
    w.time = 7; t.mythicAbility.update(.1, w)
    expect(e.takeDamage(100, 'magic', w)).toBeCloseTo(20)
    t.dismantle(w, true)
    expect(w.dynamic.children.some(o => o.name.startsWith('mythic-'))).toBe(false)
  })

  it('Storm Prison gathers ordinary enemies along their road and never displaces a boss', () => {
    const w = world(), t = tower(w, 'mage', 1), e = foe(2), center = foe(3), boss = foe(2.5, 'ossuary')
    w.enemies.push(e, center, boss); activate(t, w)
    expect(e.dist).toBeCloseTo(2.7)
    expect(boss.dist).toBe(2.5)
    expect(boss.revealed).toBe(true)
  })

  it('Flashover consumes only its own live fire and cannot detonate it twice', () => {
    const w = world(), t = tower(w, 'cannon', 0), other = tower(w, 'cannon', 0), e = foe()
    w.enemies.push(e)
    addBurnZone(w, e.pos, 1, 50, 4, t)
    addBurnZone(w, e.pos, 1, 50, 4, other)
    expect(detonateBurnZones(w, t)).toBe(1)
    expect(e.hp).toBe(9150)
    expect(detonateBurnZones(w, t)).toBe(0)
    expect(w.dynamic.children.filter(o => o.name === 'mortar-fire')).toHaveLength(1)
    clearBurnZones(w)
  })

  it('Continental Fault pushes once, exposes armor and does not push a boss', () => {
    const w = world(), t = tower(w, 'cannon', 1), e = foe(), boss = foe(2.2, 'ossuary')
    e.armor = .75; w.enemies.push(e, boss); activate(t, w)
    expect(e.dist).toBeCloseTo(.8)
    expect(e.takeDamage(100, 'physical', w)).toBe(100)
    expect(boss.dist).toBe(2.2)
    w.time = 2; t.mythicAbility.update(.1, w)
    expect(e.dist).toBeCloseTo(.8)
  })

  it('Daybreak reaches beyond the aura, heals living allies and preserves paid overcharge cooldowns', () => {
    const w = world(), t = tower(w, 'beacon', 0), gun = tower(w, 'arrow', 0)
    gun.pos.x = 25; gun.overcharge(w)
    const until = gun.overchargeUntil, cooldown = gun.overchargeCdUntil
    const h = new Hero(HERO_DEFS.aldric, new THREE.Vector3(25, 0, 0)); h.hp = 100
    w.soldiers.push(h); w.enemies.push(foe()); activate(t, w)
    expect(h.hp).toBe(212)
    expect(gun.overchargeUntil).toBe(until)
    expect(gun.overchargeCdUntil).toBe(cooldown)
    const fresh = tower(w, 'arrow', 1); fresh.kindle(w)
    expect(fresh.overchargeUntil).toBe(w.time + 5)
    expect(fresh.overchargeCdUntil).toBe(0)
  })

  it('Royal Reserves counts paid kills only and enforces a payout cooldown', () => {
    const w = world(), t = tower(w, 'beacon', 1), e = foe()
    e.noReward = true
    for (let i = 0; i < 20; i++) t.mythicAbility.onKill(e, w)
    t.mythicAbility.update(.1, w)
    expect(w.rewardMythicReserve).not.toHaveBeenCalled()
    e.noReward = false
    for (let i = 0; i < 40; i++) t.mythicAbility.onKill(e, w)
    t.mythicAbility.update(.1, w)
    expect(w.rewardMythicReserve).toHaveBeenCalledExactlyOnceWith(5)
    for (let i = 0; i < 20; i++) t.mythicAbility.onKill(e, w)
    t.mythicAbility.update(.1, w)
    expect(w.rewardMythicReserve).toHaveBeenCalledTimes(1)
    w.time += 20; t.mythicAbility.update(.1, w)
    expect(w.rewardMythicReserve).toHaveBeenCalledTimes(2)
  })

  it('Skylock opens flyers to ground weapons while respecting boss recovery', () => {
    const w = world(), t = tower(w, 'ballista', 0), flyer = foe(2, 'gargoyle'), boss = foe(2.2, 'veilqueen')
    w.enemies.push(flyer, boss); activate(t, w)
    expect(flyer.airborne).toBe(false)
    const until = boss.groundedUntil
    expect(until).toBeLessThanOrEqual(w.time + .6)
    w.time += 1; t.mythicAbility.update(.1, w)
    expect(boss.groundedUntil).toBe(until)
  })

  it('Breach Corridor follows the held bearing, bypasses wards and leaves foes outside it untouched', () => {
    const w = world(), t = tower(w, 'ballista', 1), inside = foe(), outside = foe(2, 'brute', 2)
    t.holdLine = { x: 1, z: 0 }; inside.armor = .8; inside.wardedUntil = 100
    w.enemies.push(inside, outside); activate(t, w)
    expect(inside.takeDamage(100, 'physical', w)).toBe(100)
    expect(outside.brittleUntil).toBe(0)
  })

  it('Blood Oath prevents death temporarily, does not resurrect, and ends when the hall is sold', () => {
    const w = world(), t = tower(w, 'barracks', 1), guard = t.soldiers[0], dead = t.soldiers[1]
    guard.group.position.copy(t.rallyPoint); dead.dead = true
    w.enemies.push(foe()); activate(t, w)
    guard.takeDamage(100000, w)
    expect(guard.hp).toBe(1); expect(guard.alive).toBe(true); expect(dead.alive).toBe(false)
    expect(guard.def.cleave).toBe(.45)
    w.time += 5
    guard.takeDamage(100000, w)
    expect(guard.alive).toBe(false)
    t.dismantle(w, true)
    expect(w.dynamic.getObjectByName('mythic-bloodOath')).toBeUndefined()
  })

  it('Tsunami travels down the road and marks ground troops without hitting natural flyers', () => {
    const w = world(), t = tower(w, 'tidecaller', 0), e = foe(2), flyer = foe(2, 'gargoyle')
    w.enemies.push(e, flyer); activate(t, w)
    expect(e.markedUntil).toBeGreaterThan(w.time)
    expect(flyer.markedUntil).toBe(0)
    const visual = w.dynamic.getObjectByName('mythic-worldtide')!
    const x = visual.position.x; w.time += 2; t.mythicAbility.update(.1, w)
    expect(visual.position.x - x).toBeCloseTo(3)
  })

  it('Absolute Zero lets physical towers exploit armor while leaving magic resistance intact', () => {
    const w = world(), t = tower(w, 'tidecaller', 1), e = foe()
    e.armor = .8; e.magicResistNow = .5; w.enemies.push(e); activate(t, w)
    expect(e.stunUntil).toBeGreaterThan(w.time)
    expect(e.takeDamage(100, 'physical', w)).toBe(100)
    expect(e.takeDamage(100, 'magic', w)).toBe(50)
    w.time += 5; t.mythicAbility.update(.1, w)
    expect(e.takeDamage(100, 'physical', w)).toBeCloseTo(20)
  })
})

describe('hero endgame progression', () => {
  function champion(id: HeroId, path?: string) {
    const w = world(), h = new Hero(HERO_DEFS[id], new THREE.Vector3(), 17)
    w.soldiers.push(h)
    h.gainXp(30000, w)
    if (path) h.setSpecialization(path)
    for (let i = 0; i < 6; i++) expect(h.upgradeSignature()).toBe(true)
    h.abilityCooldown = 0
    return { w, h }
  }

  it('keeps old heroes at ten levels and three ranks; gates new weapon ranks by battle level', () => {
    const w = world(), old = new Hero(HERO_DEFS.aldric, new THREE.Vector3(), 16), h = new Hero(HERO_DEFS.aldric, new THREE.Vector3(), 17)
    old.gainXp(30000, w); expect(old.level).toBe(10)
    for (let i = 0; i < 3; i++) { old.upgradeSignature(); h.upgradeSignature() }
    expect(old.upgradeSignature()).toBe(false); expect(h.upgradeSignature()).toBe(false)
    expect(h.signatureRank).toBe(3)
    h.gainXp(30000, w)
    expect(h.level).toBe(20); expect(h.xpToNext).toBe(Infinity)
    expect(heroRankGold(5)).toBe(6500); expect(heroRankCost(5)).toBe(20)
    expect(h.upgradeSignature()).toBe(true)
    expect(h.def.cleave).toBe(.55)
  })

  it('keeps hero definitions independent and prevents upgrades from resurrecting a dead hero', () => {
    const { h } = champion('aldric')
    const fresh = new Hero(HERO_DEFS.aldric, new THREE.Vector3())
    expect(fresh.maxHp).toBe(320); expect(fresh.def.damage).toEqual([18, 30])
    expect(h.def.damage[0]).toBeGreaterThan(500); expect(h.maxHp).toBeGreaterThan(8000)
    fresh.level = 20; fresh.dead = true; fresh.hp = 0
    for (let i = 0; i < 6; i++) fresh.upgradeSignature()
    expect(fresh.hp).toBe(0); expect(fresh.dead).toBe(true)
  })

  it('evolves ranged basic attacks into separate arrows and three-target chains', () => {
    for (const id of ['liora', 'zephyra'] as const) {
      const { h, w } = champion(id); w.enemies.push(foe(1), foe(1.5))
      h.update(.1, w)
      if (id === 'liora') {
        expect(w.shots.filter(s => s.kind === 'arrow')).toHaveLength(2)
        expect(w.shots.every(s => s.kind === 'arrow' && s.armorPierce === .5)).toBe(true)
      } else expect(w.shots[0]).toMatchObject({ kind: 'chain', targets: 3 })
    }
  })

  it('gives each hero path a usable legendary signature and preserves boss crowd-control resistance', () => {
    for (const id of ['aldric', 'liora', 'zephyra'] as const) for (const path of [undefined, ...HERO_PATHS[id].map(p => p.id)]) {
      const { h, w } = champion(id, path), boss = foe(.7, 'ossuary')
      boss.hp = boss.maxHp = 1_000_000; w.enemies.push(boss)
      expect(h.castSignature(w), `${id}/${path}`).toBe(true)
      for (const p of w.shots) createProjectile(p).update(10)
      expect(boss.hp, `${id}/${path}`).toBeLessThan(999000)
      expect(h.signatureCooldown).toBeGreaterThan(6)
      expect(boss.stunUntil).toBeLessThanOrEqual(w.time + .6)
      h.removeQuietly()
      expect(h.hasActiveField).toBe(false)
    }
  })
})

describe('weapon presentation and air volleys', () => {
  it('uses the visible crystal, barrel, or bow at every firing tier, including old saves', () => {
    for (const rules of [16, 17]) for (const kind of ['mage', 'cannon', 'ballista', 'tidecaller'] as const) for (const branch of [0, 1]) {
      const w = world(); w.balanceRuleset = rules
      const t = new Tower(kind, { index: 0, cell: [0, 0], pos: new THREE.Vector3(0, 2, 0), occupied: true, mesh: new THREE.Group(), raised: true }, w)
      w.towers.push(t); w.dynamic.add(t.group)
      for (let tier = 1; tier <= 6; tier++) {
        if (tier > 1) t.upgrade(tier === 4 ? branch : 0, w)
        t.update(2, w)
        const turret = t.model.getObjectByName('turret'); if (turret) turret.rotation.y = .7
        const emitter = t.model.getObjectByName('emitter') ?? t.model.getObjectByName('muzzle') ?? t.model.getObjectByName('crystal')!
        let at = emitter.getWorldPosition(new THREE.Vector3())
        const enemy = foe(3); w.enemies = [enemy]; w.shots.length = 0
        ;(t as unknown as { fire(e: Enemy, w: World): void }).fire(enemy, w)
        const shot = w.shots[0]
        expect(shot, `${rules}:${t.def.model}`).toBeTruthy()
        if (kind === 'cannon') {
          const muzzles = ['emitter', 'emitter2', 'muzzle', 'muzzle2', 'muzzle3'].map(name => t.model.getObjectByName(name)).filter(Boolean)
          at = muzzles.map(o => o!.getWorldPosition(new THREE.Vector3())).sort((a, b) => a.distanceTo(shot.visualFrom!) - b.distanceTo(shot.visualFrom!))[0]
        }
        expect(shot.visualFrom?.distanceTo(at), `${rules}:${t.def.model}`).toBeLessThan(1e-8)
        const projectile = createProjectile(shot)
        if (shot.kind !== 'chain') {
          expect(projectile.mesh.position.distanceTo(at)).toBeLessThan(1e-8)
          projectile.update(.001)
          expect(projectile.mesh.position.distanceTo(at)).toBeLessThan(.03)
        }
        projectile.dispose?.(); w.enemies = []
      }
      t.dismantle(w, true)
    }
  })

  it('keeps moving-projectile damage and lifetime identical when only the rendering origin changes', () => {
    for (const kind of ['arrow', 'axe', 'bolt', 'bomb', 'spear', 'warlockBolt'] as const) {
      const w = world(), old = world(), a = foe(3), b = foe(3)
      w.enemies = [a]; old.enemies = [b]
      const source = tower(w, 'barracks', 1).soldiers[0], baseline = tower(old, 'barracks', 1).soldiers[0]
      source.group.position.set(3, 0, 0); baseline.group.position.copy(source.group.position)
      const common = { from: new THREE.Vector3(0, 3, 0), damage: 10, world: w }
      const shot = {
        arrow: { ...common, kind: 'arrow', target: a, crit: false },
        axe: { ...common, kind: 'axe', target: a },
        bolt: { ...common, kind: 'bolt', target: a, color: 0x99ccff },
        bomb: { ...common, kind: 'bomb', at: a.pos.clone(), splash: 1 },
        spear: { ...common, kind: 'spear', aim: a.pos.clone(), reach: 5, falloff: .5, hitsAir: true },
        warlockBolt: { ...common, kind: 'warlockBolt', target: source },
      }[kind] as ProjectileSpec
      const visualFrom = new THREE.Vector3(.3, .7, .4)
      const newer = createProjectile({ ...shot, visualFrom })
      const original = createProjectile({ ...shot, world: old, ...('target' in shot ? { target: kind === 'warlockBolt' ? baseline : b } : {}) } as ProjectileSpec)
      expect(newer.mesh.position.distanceTo(visualFrom)).toBeLessThan(1e-8)
      for (let tick = 0; tick < 300 && !original.done; tick++) {
        newer.update(1 / 60); original.update(1 / 60)
        expect(newer.done, kind).toBe(original.done)
        expect(a.hp, kind).toBe(b.hp)
        expect(source.hp, kind).toBe(baseline.hp)
      }
      expect(newer.done).toBe(true)
      newer.dispose?.(); original.dispose?.()
    }
  })

  it('rotates the squad’s visible thrower without adding shots, and releases from the animated hand', () => {
    const w = world(), t = tower(w, 'barracks', 1), target = foe(2, 'veilempress')
    t.soldiers.forEach((s, i) => s.group.position.set(i * .3, 0, 0))
    const seen = new Set<number>()
    for (let i = 0; i < t.soldiers.length; i++) {
      w.shots.length = 0
      ;(t as unknown as { fire(e: Enemy, w: World): void }).fire(target, w)
      expect(w.shots).toHaveLength(1)
      const shot = w.shots[0]
      expect(shot.kind).toBe('axe')
      const actor = t.soldiers[i]
      expect(shot.visualFrom?.distanceTo(actor.weaponPos)).toBeLessThan(1e-8)
      expect(actor.group.getObjectByName('weaponR')!.scale.x).toBe(0)
      seen.add(i)
      for (let j = 0; j < 30; j++) { w.time += 1 / 60; actor.update(1 / 60, w) }
      expect(actor.group.getObjectByName('weaponR')!.scale.x).toBe(1)
    }
    expect(seen.size).toBe(t.soldiers.length)
    const actor = t.soldiers[0]
    actor.showThrow(target.pos); actor.die(w); actor.revive(new THREE.Vector3())
    expect(actor.group.getObjectByName('weaponR')!.scale.x).toBe(1)
    expect(actor.group.getObjectByName('armR')!.rotation.x).toBe(0)
    t.soldiers.forEach(s => s.die(w)); w.shots.length = 0
    ;(t as unknown as { fire(e: Enemy, w: World): void }).fire(target, w)
    expect(w.shots[0].visualFrom?.distanceTo(t.model.getObjectByName('campEmitter')!.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8)
  })

  it('answers an airborne Empress, stops for her phasing/landing, and resumes when she is visible in range', () => {
    const w = world(), t = tower(w, 'barracks', 1), empress = foe(2, 'veilempress')
    w.enemies = [empress]
    const tick = () => { w.shots.length = 0; for (let i = 0; i < 120; i++) { w.time += 1 / 60; t.update(1 / 60, w) } return w.shots.filter(s => s.kind === 'axe').length }
    expect(tick()).toBeGreaterThan(0)
    Object.assign(empress, { phased: true }); expect(tick()).toBe(0)
    Object.assign(empress, { phased: false }); expect(tick()).toBeGreaterThan(0)
    empress.pos.x = t.range + 2; expect(tick()).toBe(0)
    w.enemies = [foe(2, 'veilempressLanded')]; expect(tick()).toBe(0)
    w.enemies = [foe(2, 'veilempress')]; expect(tick()).toBeGreaterThan(0)
  })
})
