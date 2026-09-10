import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Hero, HERO_DEFS } from '../src/game/hero.ts'
import { HERO_PATHS } from '../src/game/heroPaths.ts'
import { Enemy } from '../src/game/units.ts'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { LanePath } from '../src/game/path.ts'
import type { HeroId } from '../src/game/types.ts'
import type { ProjectileSpec, World } from '../src/game/world.ts'

const lane = new LanePath([new THREE.Vector2(0, 0), new THREE.Vector2(100, 0)])
function foe(x: number, z = 0, id = 'brute'): Enemy {
  const enemy = new Enemy(enemyDef(id), lane, 0)
  enemy.pos.set(x, 0, z)
  enemy.hp = enemy.maxHp = 10000
  return enemy
}
function fixture(id: HeroId, path: string, enemies: Enemy[] = []) {
  const hero = new Hero(HERO_DEFS[id], new THREE.Vector3())
  hero.setSpecialization(path)
  hero.abilityCooldown = 0
  const shots: ProjectileSpec[] = []
  const world = {
    time: 0, dynamic: new THREE.Group(), enemies, soldiers: [hero], towers: [],
    cameraQuat: new THREE.Quaternion(), groundY: () => 0,
    sfx: vi.fn(), shake: vi.fn(), impact: vi.fn(), floater: vi.fn(), shatterUnit: vi.fn(), onEnemyKilled: vi.fn(),
    particles: { stunStars: vi.fn(), hitSpark: vi.fn(), magicImpact: vi.fn(), explosion: vi.fn(), healSparkle: vi.fn(), deathPuff: vi.fn() },
    fireProjectile: (spec: ProjectileSpec) => shots.push(spec),
  } as unknown as World
  const pulse = (time: number) => {
    world.time = time
    ;(hero as unknown as { updateSignatureField(world: World): void }).updateSignatureField(world)
  }
  return { hero, world, shots, pulse }
}

describe('hero specialization combat', () => {
  it('exposes six evolved signatures and rejects another hero’s path', () => {
    for (const id of ['aldric', 'liora', 'zephyra'] as const) {
      for (const path of HERO_PATHS[id]) {
        const { hero } = fixture(id, path.id)
        expect(hero.abilityName).toBe(path.abilityName)
        expect(hero.abilityBlurb).toBe(path.blurb)
      }
    }
    const { hero } = fixture('aldric', 'riftbinder')
    expect(hero.specialization).toBeNull()
    expect(hero.abilityName).toBe('Valor Slam')
  })

  it('plants a fixed healing standard with five pulses, no duplicate self-heal or resurrection', () => {
    const { hero, world, pulse } = fixture('aldric', 'bulwark')
    hero.hp = 100
    const ally = new Hero(HERO_DEFS.aldric, new THREE.Vector3(1, 0, 0))
    const dead = new Hero(HERO_DEFS.aldric, new THREE.Vector3(1, 0, 0))
    ally.hp = 100
    dead.hp = 0; dead.dead = true
    world.soldiers.push(ally, dead)
    expect(hero.castSignature(world)).toBe(true)
    expect(hero.hp).toBe(114)
    hero.group.position.x = 10
    for (let time = 1; time <= 5; time++) pulse(time)
    expect(hero.hp).toBe(114)
    expect(ally.hp).toBe(170)
    expect(dead.hp).toBe(0)
    expect(hero.hasActiveField).toBe(false)
    expect(world.dynamic.children).toHaveLength(0)
  })

  it('breaches the strongest ground target while retaining boss stun recovery', () => {
    const boss = foe(0.5, 0, 'ossuary'), escort = foe(0.8)
    escort.maxHp = 5000
    const { hero, world } = fixture('aldric', 'vanguard', [escort, boss])
    const bossArmor = boss.armor, escortArmor = escort.armor
    expect(hero.castSignature(world)).toBe(true)
    expect(boss.armor).toBeCloseTo(bossArmor - 0.2)
    expect(escort.armor).toBe(escortArmor)
    expect(10000 - boss.hp).toBeGreaterThan(1.3 * (10000 - escort.hp))
    expect(boss.stunUntil).toBeLessThanOrEqual(0.6)
    const stunUntil = boss.stunUntil
    hero.abilityCooldown = 0
    world.time = 0.1
    hero.castSignature(world)
    expect(boss.stunUntil).toBe(stunUntil)
  })

  it('concentrates Hawkeye arrows on three strong targets and pierces armor', () => {
    const enemies = Array.from({ length: 6 }, (_, i) => {
      const enemy = foe(0.5 + i * 0.1)
      enemy.maxHp = 100 + i * 100
      return enemy
    })
    const { hero, world, shots } = fixture('liora', 'hawkeye', enemies)
    expect(hero.castSignature(world)).toBe(true)
    expect(shots).toHaveLength(3)
    expect(shots.map(s => s.kind === 'arrow' ? s.target : null)).toEqual(enemies.slice(3).reverse())
    expect(shots.every(s => s.kind === 'arrow' && s.armorPierce === 0.65)).toBe(true)
  })

  it('holds a directional corridor, catches flying newcomers, and leaves its flanks clear', () => {
    const front = foe(1), flank = foe(1, 2), flyer = foe(2, 0, 'veilqueen')
    const { hero, world, pulse } = fixture('liora', 'gale', [front, flank])
    expect(hero.castSignature(world)).toBe(true)
    expect(front.hp).toBeLessThan(10000)
    expect(flank.hp).toBe(10000)
    world.enemies.push(flyer)
    hero.group.position.set(10, 0, 10)
    pulse(1)
    expect(flyer.hp).toBeLessThan(10000)
    expect(flyer.slowFactor).toBe(0.65)
    pulse(5)
    const hp = flyer.hp
    pulse(6)
    expect(flyer.hp).toBe(hp)
  })

  it('expands Tempest through three rings without extra pulses at floating-point boundaries', () => {
    const near = foe(0.8), mid = foe(1.8), far = foe(2.8)
    const { hero, world, pulse } = fixture('zephyra', 'tempest', [near, mid, far])
    hero.castSignature(world)
    expect(near.hp).toBeLessThan(10000)
    expect(mid.hp).toBe(10000)
    pulse(1)
    expect(mid.hp).toBeLessThan(10000)
    expect(far.hp).toBe(10000)
    pulse(2)
    expect(far.hp).toBeLessThan(10000)
    const hp = near.hp
    pulse(2.999999999999)
    expect(near.hp).toBe(hp)
    expect(hero.hasActiveField).toBe(false)
  })

  it('can anchor on phased enemies, exposes them to allies, and stops renewing on death', () => {
    const enemy = foe(1, 0, 'mistwalker')
    enemy.phased = true
    const { hero, world, pulse } = fixture('zephyra', 'riftbinder', [enemy])
    expect(enemy.targetable).toBe(false)
    expect(hero.castSignature(world)).toBe(true)
    expect(enemy.targetable).toBe(true)
    expect(enemy.hp).toBeLessThan(10000)
    pulse(1)
    const until = enemy.revealedUntil
    expect(until).toBeCloseTo(1.15)
    hero.die(world)
    pulse(2)
    expect(enemy.revealedUntil).toBe(until)
    expect(world.dynamic.children).toHaveLength(0)
  })

  it('does not consume a signature when it cannot affect any target', () => {
    for (const id of ['aldric', 'liora', 'zephyra'] as const) {
      for (const path of HERO_PATHS[id]) {
        const { hero, world } = fixture(id, path.id)
        expect(hero.castSignature(world)).toBe(false)
        expect(hero.signatureReady).toBe(true)
      }
    }
  })
})
