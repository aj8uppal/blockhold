import * as THREE from 'three'
import { Soldier } from './units.ts'
import { World } from './world.ts'
import { HeroDef, HeroId, SoldierDef } from './types.ts'
import { lerpAngle, randRange } from '../core/utils.ts'

const RESPAWN_TIME = 16
const XP_LEVELS = [0, 60, 150, 280, 450, 660, 920, 1240, 1620, 2100]

export const HERO_DEFS: Record<HeroId, HeroDef> = {
  aldric: {
    id: 'aldric', name: 'Sir Aldric', title: 'the Bulwark', icon: 'helmPlume',
    blurb: 'A frontline champion who pins groups in place and shatters them with Valor Slam.',
    hp: 320, damage: [18, 30], attackInterval: 0.85, armor: 0.35, regen: 7,
    moveSpeed: 1.75, model: 'hero', scale: 1.18,
    ability: { kind: 'slam', name: 'Valor Slam', cooldown: 13, blurb: 'Shockwave: true damage + stun around him.' },
  },
  liora: {
    id: 'liora', name: 'Liora', title: 'the Gale Warden', icon: 'bow',
    blurb: 'A ranger who strikes from range — the only hero who can shoot flyers from the ground.',
    hp: 215, damage: [15, 24], attackInterval: 0.75, armor: 0.1, regen: 6,
    moveSpeed: 2.0, model: 'liora', scale: 1.12, attackRange: 2.3, projectile: 'arrow',
    ability: { kind: 'volley', name: 'Piercing Volley', cooldown: 14, blurb: 'Looses arrows at up to seven foes, gate-runners first.' },
  },
  zephyra: {
    id: 'zephyra', name: 'Zephyra', title: 'the Stormcaller', icon: 'lightning',
    blurb: 'A tempest mage whose bolts ignore armor — and whose nova freezes whole packs in place.',
    hp: 190, damage: [14, 21], attackInterval: 0.95, armor: 0.05, regen: 6,
    moveSpeed: 1.9, model: 'zephyra', scale: 1.12, attackRange: 2.1, projectile: 'bolt',
    ability: { kind: 'nova', name: 'Static Nova', cooldown: 15, blurb: 'Shocks and slows everything around her.' },
  },
}

/**
 * A player-controlled hero. Reuses Soldier's combat bookkeeping for melee
 * heroes (enemies treat them as blockers); ranged heroes skirmish without
 * blocking. Adds move orders (A* waypoints), XP levels, an auto-cast
 * signature ability, and self-respawn.
 */
export class Hero extends Soldier {
  moveOrder: THREE.Vector3 | null = null
  private waypoints: THREE.Vector3[] = []
  level = 1
  xp = 0
  kills = 0
  respawnCountdown = 0
  private deathPos = new THREE.Vector3()
  private walkT = 0
  abilityCooldown = 6
  protected moveSpeed: number

  get abilityFraction(): number {
    return Math.max(0, this.abilityCooldown / this.heroDef.ability.cooldown)
  }

  constructor(readonly heroDef: HeroDef, spawnPos: THREE.Vector3) {
    const soldierDef: SoldierDef = {
      name: heroDef.name, hp: heroDef.hp, damage: [...heroDef.damage],
      attackInterval: heroDef.attackInterval, armor: heroDef.armor,
      regen: heroDef.regen, model: heroDef.model, scale: heroDef.scale,
    }
    super(soldierDef, spawnPos, spawnPos)
    this.moveSpeed = heroDef.moveSpeed
    this.credit = this   // melee hero kills land on the hero's own tally
  }

  get ranged(): boolean { return this.heroDef.attackRange !== undefined }

  get xpToNext(): number {
    return this.level >= XP_LEVELS.length ? Infinity : XP_LEVELS[this.level]
  }

  get respawnFraction(): number {
    return this.dead ? Math.max(0, this.respawnCountdown / RESPAWN_TIME) : 0
  }

  gainXp(amount: number, world: World): void {
    if (this.level >= XP_LEVELS.length) return
    this.xp += amount
    while (this.level < XP_LEVELS.length && this.xp >= XP_LEVELS[this.level]) {
      this.level++
      this.maxHp = Math.round(this.maxHp * 1.14)
      this.hp = this.maxHp
      const d = this.def as { damage: [number, number] }
      d.damage = [Math.round(d.damage[0] * 1.13), Math.round(d.damage[1] * 1.13)]
      world.particles.healSparkle(this.group.position.x, 0.6, this.group.position.z)
      world.floater(this.group.position.x, 1.1, this.group.position.z, `⚔ Level ${this.level}!`, 'gold')
      world.sfx('upgrade')
    }
  }

  /** returns false when no route exists */
  orderMove(to: THREE.Vector3, world: World): boolean {
    if (this.dead) return false
    const pos = this.group.position
    const path = world.findPath(pos.x, pos.z, to.x, to.z)
    if (!path || path.length === 0) return false
    this.waypoints = path
    this.moveOrder = path[path.length - 1].clone()
    this.moveOrder.y = 0
    if (this.target) {
      const i = this.target.blockers.indexOf(this)
      if (i >= 0) this.target.blockers.splice(i, 1)
      this.target = null
    }
    world.sfx('click')
    return true
  }

  die(world: World): void {
    if (this.dead) return
    this.deathPos.copy(this.group.position)
    this.respawnCountdown = RESPAWN_TIME
    this.moveOrder = null
    this.waypoints = []
    super.die(world)
  }

  update(dt: number, world: World): void {
    if (this.dead) {
      this.respawnCountdown -= dt
      if (this.respawnCountdown <= 0) {
        this.revive(this.deathPos)
        world.particles.healSparkle(this.deathPos.x, 0.5, this.deathPos.z)
        world.sfx('reinforce')
      }
      return
    }
    this.abilityCooldown -= dt

    // move order takes priority over everything; follow the A* waypoints
    if (this.moveOrder) {
      const pos = this.group.position
      while (this.waypoints.length > 1 && Math.hypot(this.waypoints[0].x - pos.x, this.waypoints[0].z - pos.z) < 0.14) {
        this.waypoints.shift()
      }
      const next = this.waypoints[0] ?? this.moveOrder
      const d = Math.hypot(next.x - pos.x, next.z - pos.z)
      if (this.waypoints.length <= 1 && d < 0.08) {
        this.moveOrder = null
        this.waypoints = []
        this.home.copy(pos)
        // fall through to the combat paths below, which tick the flash
      } else {
        this.tickFlash(dt)
        const step = Math.min(d, this.moveSpeed * dt)
        if (d > 1e-5) {
          pos.x += (next.x - pos.x) / d * step
          pos.z += (next.z - pos.z) / d * step
          this.group.rotation.y = lerpAngle(this.group.rotation.y, Math.atan2(next.x - pos.x, next.z - pos.z), dt * 9)
        }
        this.walkT += dt
        this.walkAnim()
        this.bar.set(this.hp / this.maxHp, world.cameraQuat)
        return
      }
    }

    if (this.ranged) {
      this.updateRanged(dt, world)
      return
    }

    // melee: home follows the hero so base aggro works wherever he stands
    this.home.copy(this.group.position)
    super.update(dt, world)

    // Valor Slam: auto-cast shockwave when engaged, scales with level
    if (this.abilityCooldown <= 0 && this.target) {
      const pos = this.group.position
      const victims = world.enemies.filter(e => e.targetable && !e.def.flying && e.pos.distanceTo(pos) < 1.0)
      if (victims.length >= 1) {
        this.abilityCooldown = this.heroDef.ability.cooldown
        const dmg = 26 + this.level * 6
        for (const v of victims) {
          v.takeDamage(dmg * (0.85 + Math.random() * 0.3), 'true', world, { credit: this })
          v.applyStun(0.8, world)
        }
        world.particles.explosion(pos.x, 0.15, pos.z, 0.55)
        world.floater(pos.x, 0.9, pos.z, 'Valor Slam!', 'gold')
        world.sfx('crit', 1)
        world.shake(0.06)
      }
    }
  }

  private rangedAttackTimer = 0

  private updateRanged(dt: number, world: World): void {
    this.tickFlash(dt)
    const pos = this.group.position
    if (this.def.regen && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt * 0.6)
    }
    const range = this.heroDef.attackRange!
    // nearest targetable enemy in range — flyers included, that's her niche
    let best = null as import('./units.ts').Enemy | null
    let bestD = Infinity
    for (const e of world.enemies) {
      if (!e.targetable) continue
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z)
      if (d < range && d < bestD) { bestD = d; best = e }
    }
    this.rangedAttackTimer -= dt
    if (best) {
      this.group.rotation.y = lerpAngle(this.group.rotation.y, Math.atan2(best.pos.x - pos.x, best.pos.z - pos.z), dt * 10)
      if (this.rangedAttackTimer <= 0) {
        this.rangedAttackTimer = this.def.attackInterval
        const from = pos.clone().add(new THREE.Vector3(0, 0.45, 0))
        if (this.heroDef.projectile === 'bolt') {
          world.fireProjectile({ kind: 'bolt', from, target: best, damage: randRange(...this.def.damage), color: 0x9fe8ff, credit: this, world })
          world.sfx('magic', 0.6)
        } else {
          world.fireProjectile({ kind: 'arrow', from, target: best, damage: randRange(...this.def.damage), crit: false, credit: this, world })
          world.sfx('arrow', 0.7)
        }
        this.drawBowAnim()
      }
      if (this.abilityCooldown <= 0) {
        if (this.heroDef.ability.kind === 'volley') {
          // Piercing Volley: arrows at up to seven foes, gate-runners first
          const victims = world.enemies
            .filter(e => e.targetable && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < range + 0.5)
            .sort((a, b) => a.remaining - b.remaining)
          if (victims.length >= 3) {
            this.abilityCooldown = this.heroDef.ability.cooldown
            for (const v of victims.slice(0, 7)) {
              world.fireProjectile({
                kind: 'arrow',
                from: pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
                target: v,
                damage: randRange(...this.def.damage) * 1.25,
                crit: true,
                credit: this,
                world,
              })
            }
            world.floater(pos.x, 0.9, pos.z, 'Piercing Volley!', 'gold')
            world.sfx('crit', 1)
          }
        } else if (this.heroDef.ability.kind === 'nova') {
          // Static Nova: magic burst + heavy slow around her
          const victims = world.enemies.filter(e => e.targetable && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 1.6)
          if (victims.length >= 2) {
            this.abilityCooldown = this.heroDef.ability.cooldown
            const dmg = 18 + this.level * 5
            for (const v of victims) {
              v.takeDamage(dmg * (0.85 + Math.random() * 0.3), 'magic', world, { credit: this })
              v.applySlow(0.45, 2.5, world)
            }
            world.particles.magicImpact(pos.x, 0.4, pos.z, 0x9fe8ff)
            world.particles.explosion(pos.x, 0.2, pos.z, 0.5)
            world.floater(pos.x, 0.9, pos.z, 'Static Nova!', 'gold')
            world.sfx('lightning', 1)
          }
        }
      }
    } else {
      this.idleAnim()
    }
    this.bar.set(this.hp / this.maxHp, world.cameraQuat)
  }

  private heroPart(name: string): THREE.Object3D | undefined {
    return this.group.children.find(c => c.name === name)
  }

  private walkAnim(): void {
    const swing = Math.sin(this.walkT * 9.5) * 0.55
    for (const [name, rot] of [['legL', swing], ['legR', -swing], ['armL', -swing * 0.6], ['armR', swing * 0.6]] as const) {
      const p = this.heroPart(name)
      if (p) p.rotation.x = rot
    }
    this.group.position.y = Math.abs(Math.sin(this.walkT * 9.5)) * 0.03
  }

  private drawBowAnim(): void {
    const armL = this.heroPart('armL'), armR = this.heroPart('armR')
    if (armL) armL.rotation.x = -1.3
    if (armR) armR.rotation.x = -1.1
  }

  private idleAnim(): void {
    this.walkT += 0.016
    const armL = this.heroPart('armL'), armR = this.heroPart('armR')
    const legL = this.heroPart('legL'), legR = this.heroPart('legR')
    if (armL) armL.rotation.x = Math.sin(this.walkT * 1.8) * 0.05
    if (armR) armR.rotation.x = -Math.sin(this.walkT * 1.8) * 0.05
    if (legL) legL.rotation.x = 0
    if (legR) legR.rotation.x = 0
    this.group.position.y = 0
  }
}
