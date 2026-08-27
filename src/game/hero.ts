import * as THREE from 'three'
import { Soldier } from './units.ts'
import { World } from './world.ts'
import { HeroDef, HeroId, SoldierDef } from './types.ts'
import { lerpAngle, randRange, simRandom } from '../core/utils.ts'
import { icon } from '../ui/icons.ts'

const RESPAWN_TIME = 16
const XP_LEVELS = [0, 60, 150, 280, 450, 660, 920, 1240, 1620, 2100]

/** how far a signature can be sharpened, and what each rank costs in shards */
export const HERO_RANK_MAX = 3
export const heroRankCost = (rank: number): number => 4 + rank * 2

export const HERO_DEFS: Record<HeroId, HeroDef> = {
  aldric: {
    id: 'aldric', name: 'Sir Aldric', title: 'the Bulwark', icon: 'helmPlume',
    blurb: 'A frontline champion who pins groups in place and shatters them with Valor Slam.',
    hp: 320, damage: [18, 30], attackInterval: 0.85, armor: 0.35, regen: 7,
    moveSpeed: 1.75, model: 'hero', scale: 2.3,
    ability: { kind: 'slam', name: 'Valor Slam', cooldown: 13, blurb: 'Shockwave: true damage + stun around him.' },
  },
  liora: {
    id: 'liora', name: 'Liora', title: 'the Gale Warden', icon: 'bow',
    blurb: 'A ranger who strikes from range — the only hero who can shoot flyers from the ground.',
    hp: 215, damage: [15, 24], attackInterval: 0.75, armor: 0.1, regen: 6,
    moveSpeed: 2.0, model: 'liora', scale: 2.15, attackRange: 2.3, projectile: 'arrow',
    ability: { kind: 'volley', name: 'Piercing Volley', cooldown: 14, blurb: 'Looses arrows at up to seven foes, gate-runners first.' },
  },
  zephyra: {
    id: 'zephyra', name: 'Zephyra', title: 'the Stormcaller', icon: 'lightning',
    blurb: 'A tempest mage whose bolts ignore armor — and whose nova freezes whole packs in place.',
    hp: 190, damage: [14, 21], attackInterval: 0.95, armor: 0.05, regen: 6,
    moveSpeed: 1.9, model: 'zephyra', scale: 2.15, attackRange: 2.1, projectile: 'bolt',
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
  /**
   * The hero's height is composed, not written by whichever animation happens
   * to run. `baseY` is the ground under their feet and `bobY` is the walk
   * bounce; update() adds them. Letting the animations set `position.y`
   * directly meant a melee hero standing still ran no animation at all, so he
   * kept whatever height he last had and stood buried in any raised ground.
   */
  private baseY = 0
  private bobY = 0

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

  /** radius the hero holds: melee leash around the post, or attack range */
  get guardRange(): number { return this.heroDef.attackRange ?? 1.9 }

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
      world.floater(this.group.position.x, 1.1, this.group.position.z, `${icon('swords')} Level ${this.level}!`, 'gold')
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
    // Second Wind halves the wait; the full-health return is handled on revive
    this.respawnCountdown = RESPAWN_TIME * (world.heroReviveMult ?? 1)
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

    // melee: the hero guards a post (his last move order) instead of drifting —
    // he engages what enters the leash and breaks off if a fight drags him away
    if (this.target && this.target.pos.distanceTo(this.home) > this.guardRange * 1.5) {
      const i = this.target.blockers.indexOf(this)
      if (i >= 0) this.target.blockers.splice(i, 1)
      this.target = null
    }
    super.update(dt, world)
    // raised ground is scenery the hero stands on, not something to sink into
    this.baseY = world.groundY(this.group.position.x, this.group.position.z)
    this.group.position.y = this.baseY + this.bobY
  }

  /**
   * Signature ranks, bought with shards.
   *
   * The hero was the only thing on the board the player could not invest in:
   * towers had five tiers and two ascensions, and the named, illustrated
   * champion had nothing. Each rank shortens the cooldown and widens the
   * effect, so a hero built around can genuinely carry a lane.
   */
  signatureRank = 0

  get signatureCooldown(): number {
    return this.heroDef.ability.cooldown * (1 - this.signatureRank * 0.12)
  }

  /** how much wider and harder the signature lands at this rank */
  get signaturePower(): number {
    return 1 + this.signatureRank * 0.28
  }

  get signatureReach(): number {
    return 1 + this.signatureRank * 0.18
  }

  /** the hero's signature is the player's to spend, not the AI's */
  get signatureReady(): boolean { return this.abilityCooldown <= 0 && this.alive && !this.dead }

  /**
   * Cast the hero's signature. Returns false when there is nothing to hit, so
   * a mistimed press costs the player nothing rather than burning the cooldown.
   */
  castSignature(world: World): boolean {
    if (!this.signatureReady) return false
    const pos = this.group.position
    const kind = this.heroDef.ability.kind
    if (kind === 'slam') {
      const victims = world.enemies.filter(e => e.targetable && !e.def.flying && e.pos.distanceTo(pos) < 1.35 * this.signatureReach)
      if (!victims.length) return false
      this.abilityCooldown = this.signatureCooldown
      const dmg = (26 + this.level * 6) * this.signaturePower
      for (const v of victims) {
        v.takeDamage(dmg * (0.85 + simRandom() * 0.3), 'true', world, { credit: this })
        v.applyStun(0.8, world)
      }
      world.particles.explosion(pos.x, 0.15, pos.z, 0.55)
      world.floater(pos.x, 0.9, pos.z, 'Valor Slam!', 'gold')
      world.sfx('crit', 1)
      world.shake(0.09)
      world.impact('heavy')
      return true
    }
    if (kind === 'volley') {
      const range = this.heroDef.attackRange ?? 3
      const victims = world.enemies
        .filter(e => e.targetable && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < range + 0.5)
        .sort((a, b) => a.remaining - b.remaining)
      if (!victims.length) return false
      this.abilityCooldown = this.signatureCooldown
      for (const v of victims.slice(0, 7 + this.signatureRank * 2)) {
        world.fireProjectile({
          kind: 'arrow',
          from: pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
          target: v,
          damage: randRange(...this.def.damage) * 1.25 * this.signaturePower,
          crit: true,
          credit: this,
          world,
        })
      }
      world.floater(pos.x, 0.9, pos.z, 'Piercing Volley!', 'gold')
      world.sfx('crit', 1)
      return true
    }
    // nova
    const victims = world.enemies.filter(e => e.targetable && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 2.0 * this.signatureReach)
    if (!victims.length) return false
    this.abilityCooldown = this.signatureCooldown
    const dmg = (18 + this.level * 5) * this.signaturePower
    for (const v of victims) {
      v.takeDamage(dmg * (0.85 + simRandom() * 0.3), 'magic', world, { credit: this })
      v.applySlow(0.45, 2.5, world)
    }
    world.particles.magicImpact(pos.x, 0.4, pos.z, 0x9fe8ff)
    world.particles.explosion(pos.x, 0.2, pos.z, 0.5)
    world.floater(pos.x, 0.9, pos.z, 'Static Nova!', 'gold')
    world.sfx('lightning', 1)
    world.impact('heavy')
    return true
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
    this.bobY = Math.abs(Math.sin(this.walkT * 9.5)) * 0.03
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
    this.bobY = 0
  }
}
