import * as THREE from 'three'
import { Soldier } from './units.ts'
import { World } from './world.ts'
import { HeroDef, HeroId, SoldierDef } from './types.ts'
import { lerpAngle, randRange, simRandom } from '../core/utils.ts'
import { icon } from '../ui/icons.ts'
import { heroPath, type HeroPathId } from './heroPaths.ts'

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
    moveSpeed: 1.75, model: 'hero', scale: 1.85,
    ability: { kind: 'slam', name: 'Valor Slam', cooldown: 13, blurb: 'Shockwave: true damage + stun around him.' },
  },
  liora: {
    id: 'liora', name: 'Liora', title: 'the Gale Warden', icon: 'bow',
    blurb: 'A ranger who strikes from range — the only hero who can shoot flyers from the ground.',
    hp: 215, damage: [15, 24], attackInterval: 0.75, armor: 0.1, regen: 6,
    moveSpeed: 2.0, model: 'liora', scale: 1.72, attackRange: 2.3, projectile: 'arrow',
    ability: { kind: 'volley', name: 'Piercing Volley', cooldown: 14, blurb: 'Looses arrows at up to seven foes, gate-runners first.' },
  },
  zephyra: {
    id: 'zephyra', name: 'Zephyra', title: 'the Stormcaller', icon: 'lightning',
    blurb: 'A tempest mage whose bolts ignore armor — and whose nova freezes whole packs in place.',
    hp: 190, damage: [14, 21], attackInterval: 0.95, armor: 0.05, regen: 6,
    moveSpeed: 1.9, model: 'zephyra', scale: 1.72, attackRange: 2.1, projectile: 'bolt',
    ability: { kind: 'nova', name: 'Static Nova', cooldown: 15, blurb: 'Shocks and slows everything around her.' },
  },
}

/**
 * A player-controlled hero. Reuses Soldier's combat bookkeeping for melee
 * heroes (enemies treat them as blockers); ranged heroes skirmish without
 * blocking. Adds move orders (A* waypoints), XP levels, an auto-cast
 * signature ability, and self-respawn.
 */
/**
 * What the hero says. Kingdom Rush's heroes answer every order out loud, and
 * that voice is most of why a player feels the hero is *theirs*; ours speak
 * in captions by the portrait. Presentation only, so Math.random is right.
 */
const BARKS: Record<string, { move: string[], signature: string[], level: string[] }> = {
  aldric: {
    move: ['On my way.', 'Hold the road!', 'Moving up.', 'For the Hold.'],
    signature: ['Valor!', 'Stand and fight!'],
    level: ['Stronger yet.', 'The Hold endures.'],
  },
  liora: {
    move: ['As you wish.', 'Quickly, then.', 'I see it.', 'Nocked.'],
    signature: ['Loose!', 'Every arrow.'],
    level: ['Sharper now.', 'Nothing slips past.'],
  },
  zephyra: {
    move: ['The wind carries me.', 'Going.', 'Watch the sky.', 'Swiftly.'],
    signature: ['Storm, rise!', 'Feel the gale.'],
    level: ['The storm grows.', 'Higher still.'],
  },
}
const FALLBACK_BARKS = BARKS.aldric

function bark(heroId: string, kind: 'move' | 'signature' | 'level'): string {
  const lines = (BARKS[heroId] ?? FALLBACK_BARKS)[kind]
  return lines[Math.floor(Math.random() * lines.length)]
}

export class Hero extends Soldier {

  moveOrder: THREE.Vector3 | null = null
  private waypoints: THREE.Vector3[] = []
  level = 1
  xp = 0
  kills = 0
  /** health removed from enemies by this building, overkill excluded */
  damage = 0
  respawnCountdown = 0
  private deathPos = new THREE.Vector3()
  private walkT = 0
  abilityCooldown = 6
  protected moveSpeed: number
  specialization: HeroPathId | null = null
  private signatureField: {
    kind: 'bulwark' | 'gale' | 'tempest' | 'riftbinder'
    center: THREE.Vector3
    direction: THREE.Vector2
    radius: number
    until: number
    nextPulse: number
    pulses: number
    power: number
    visual: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  } | null = null

  get abilityName(): string { return heroPath(this.heroDef.id, this.specialization)?.abilityName ?? this.heroDef.ability.name }
  get abilityBlurb(): string { return heroPath(this.heroDef.id, this.specialization)?.blurb ?? this.heroDef.ability.blurb }
  get hasActiveField(): boolean { return this.signatureField !== null }

  /** Selection is validated again at the entity boundary, including imported loadouts. */
  setSpecialization(path: string | null): void {
    this.clearSignatureField()
    this.specialization = heroPath(this.heroDef.id, path)?.id ?? null
  }

  private clearSignatureField(): void {
    if (!this.signatureField) return
    const mesh = this.signatureField.visual
    mesh.removeFromParent()
    mesh.geometry.dispose()
    mesh.material.dispose()
    this.signatureField = null
  }

  removeQuietly(): void {
    this.clearSignatureField()
    super.removeQuietly()
  }

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

  get xpProgress(): { into: number, span: number } {
    if (this.xpToNext === Infinity) return { into: 1, span: 1 }
    const floor = XP_LEVELS[this.level - 1]
    return { into: this.xp - floor, span: this.xpToNext - floor }
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
      world.sfx('heroLevel')
      world.heroBark?.(bark(this.heroDef.id, 'level'))
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
    world.sfx('heroAck', 0.8)
    world.heroBark?.(bark(this.heroDef.id, 'move'))
    return true
  }

  die(world: World): void {
    if (this.dead) return
    this.clearSignatureField()
    this.deathPos.copy(this.group.position)
    // Second Wind halves the wait; the full-health return is handled on revive
    this.respawnCountdown = RESPAWN_TIME * (world.heroReviveMult ?? 1)
    this.moveOrder = null
    this.waypoints = []
    super.die(world)
  }

  update(dt: number, world: World): void {
    this.updateSignatureField(world)
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
        // this branch returns before Soldier.update composes height, so it
        // has to compose its own or a hero walking up a terrace sinks into it
        this.baseY = world.groundY(pos.x, pos.z)
        pos.y = this.baseY + this.bobY
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
    const cast = this.castSignatureInner(world)
    if (cast) world.heroBark?.(bark(this.heroDef.id, 'signature'))
    return cast
  }

  private castSignatureInner(world: World): boolean {
    const pos = this.group.position
    const kind = this.heroDef.ability.kind
    if (this.specialization === 'gale' || this.specialization === 'tempest' || this.specialization === 'riftbinder') {
      const radius = (this.specialization === 'gale' ? 3.5 : this.specialization === 'tempest' ? 3 : 2.1) * this.signatureReach
      const nearby = world.enemies.filter(e => e.alive && (e.targetable || this.specialization === 'riftbinder') && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < radius)
        .sort((a, b) => a.remaining - b.remaining)
      if (!nearby.length) return false
      this.abilityCooldown = this.signatureCooldown
      this.plantSignatureField(this.specialization, world, radius, nearby[0].pos)
      world.floater(pos.x, 0.9, pos.z, `${this.abilityName}!`, 'gold')
      world.sfx('lightning', 0.8)
      this.updateSignatureField(world)
      return true
    }
    if (kind === 'slam') {
      const victims = world.enemies.filter(e => e.targetable && !e.def.flying && e.pos.distanceTo(pos) < 1.35 * this.signatureReach)
      const wounded = this.specialization === 'bulwark' && [this, ...world.soldiers].some(s => s.alive && s.hp < s.maxHp && s.group.position.distanceTo(pos) < 2.2 * this.signatureReach)
      if (!victims.length && !wounded) return false
      this.abilityCooldown = this.signatureCooldown
      const dmg = (26 + this.level * 6) * this.signaturePower
      const priority = this.specialization === 'vanguard' ? [...victims].sort((a, b) => b.maxHp - a.maxHp || a.remaining - b.remaining)[0] : null
      for (const v of victims) {
        if (v === priority) v.shredArmor(0.2)
        v.takeDamage(dmg * (v === priority ? 2 : 1) * (0.85 + simRandom() * 0.3), 'true', world, { credit: this })
        v.applyStun(0.8, world)
      }
      if (this.specialization === 'bulwark') {
        this.plantSignatureField('bulwark', world, 2.2 * this.signatureReach)
        this.updateSignatureField(world)
      }
      world.particles.explosion(pos.x, 0.15, pos.z, 0.55)
      world.floater(pos.x, 0.9, pos.z, `${this.abilityName}!`, 'gold')
      world.sfx('crit', 1)
      world.shake(0.09)
      world.impact('heavy')
      return true
    }
    if (kind === 'volley') {
      const range = this.heroDef.attackRange ?? 3
      const victims = world.enemies
        .filter(e => e.targetable && Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < range + 0.5)
        .sort((a, b) => this.specialization === 'hawkeye' ? b.maxHp - a.maxHp || a.remaining - b.remaining : a.remaining - b.remaining)
      if (!victims.length) return false
      this.abilityCooldown = this.signatureCooldown
      for (const v of victims.slice(0, this.specialization === 'hawkeye' ? 3 : 7 + this.signatureRank * 2)) {
        world.fireProjectile({
          kind: 'arrow',
          from: pos.clone().add(new THREE.Vector3(0, 0.5, 0)),
          target: v,
          damage: randRange(...this.def.damage) * (this.specialization === 'hawkeye' ? 3.2 : 1.25) * this.signaturePower,
          armorPierce: this.specialization === 'hawkeye' ? 0.65 : undefined,
          crit: true,
          credit: this,
          world,
        })
      }
      world.floater(pos.x, 0.9, pos.z, `${this.abilityName}!`, 'gold')
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

  private plantSignatureField(kind: 'bulwark' | 'gale' | 'tempest' | 'riftbinder', world: World, radius: number, aim?: THREE.Vector3): void {
    this.clearSignatureField()
    const center = this.group.position.clone()
    const direction = new THREE.Vector2(aim ? aim.x - center.x : 1, aim ? aim.z - center.z : 0).normalize()
    if (!direction.lengthSq()) direction.set(1, 0)
    const corridor = kind === 'gale'
    const geometry = corridor ? new THREE.PlaneGeometry(radius, 1.5 * this.signatureReach) : new THREE.RingGeometry(radius * 0.95, radius, 48)
    const color = kind === 'bulwark' ? 0xffd985 : kind === 'riftbinder' ? 0xbc8cff : kind === 'tempest' ? 0x73baff : 0x91efce
    const visual = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: corridor ? 0.18 : 0.65, depthWrite: false, side: THREE.DoubleSide }))
    visual.name = `hero-field-${kind}`
    visual.rotation.x = -Math.PI / 2
    if (corridor) visual.rotation.z = -Math.atan2(direction.y, direction.x)
    visual.position.set(center.x + (corridor ? direction.x * radius / 2 : 0), world.groundY(center.x, center.z) + 0.06, center.z + (corridor ? direction.y * radius / 2 : 0))
    world.dynamic.add(visual)
    this.signatureField = { kind, center, direction, radius, until: world.time + (kind === 'tempest' ? 3 : 5), nextPulse: world.time, pulses: 0, power: this.signaturePower, visual }
  }

  private updateSignatureField(world: World): void {
    const field = this.signatureField
    if (!field) return
    if (world.time + 1e-6 >= field.until || this.dead) { this.clearSignatureField(); return }
    const contains = (p: THREE.Vector3, radius = field.radius): boolean => {
      const x = p.x - field.center.x, z = p.z - field.center.z
      if (field.kind !== 'gale') return Math.hypot(x, z) <= radius
      const along = x * field.direction.x + z * field.direction.y
      const across = Math.abs(x * field.direction.y - z * field.direction.x)
      return along >= -0.15 && along <= field.radius && across <= 0.75 * this.signatureReach
    }
    if (field.kind === 'riftbinder') {
      for (const enemy of world.enemies) {
        if (!enemy.alive || !contains(enemy.pos)) continue
        enemy.revealedUntil = Math.max(enemy.revealedUntil, world.time + 0.15)
        enemy.revealed = true
      }
    }
    if (field.pulses >= (field.kind === 'tempest' ? 3 : 5) || world.time + 1e-6 < field.nextPulse) return
    field.nextPulse += 1
    field.pulses++
    const radius = field.kind === 'tempest' ? field.radius * field.pulses / 3 : field.radius
    if (field.kind === 'tempest') field.visual.scale.setScalar(field.pulses / 3)
    if (field.kind === 'bulwark') {
      for (const soldier of new Set([this, ...world.soldiers])) {
        if (!soldier.alive || !contains(soldier.group.position) || soldier.hp >= soldier.maxHp) continue
        soldier.hp = Math.min(soldier.maxHp, soldier.hp + (12 + this.level * 2) * field.power)
        world.particles.healSparkle(soldier.group.position.x, 0.5, soldier.group.position.z)
      }
      return
    }
    const amount = (field.kind === 'tempest' ? 18 + this.level * 5 : field.kind === 'riftbinder' ? 10 + this.level * 3 : 8 + this.level * 2) * field.power
    for (const enemy of world.enemies) {
      if (!enemy.targetable || !contains(enemy.pos, radius)) continue
      enemy.takeDamage(amount, 'magic', world, { credit: this })
      if (field.kind !== 'riftbinder') enemy.applySlow(field.kind === 'gale' ? 0.6 : 0.5, 1.15, world)
    }
    world.particles.magicImpact(field.center.x, 0.25, field.center.z, field.kind === 'riftbinder' ? 0xbc8cff : 0x91dcff)
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
      this.idleAnim(dt)
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

  private idleAnim(dt: number): void {
    this.walkT += dt
    const armL = this.heroPart('armL'), armR = this.heroPart('armR')
    const legL = this.heroPart('legL'), legR = this.heroPart('legR')
    if (armL) armL.rotation.x = Math.sin(this.walkT * 1.8) * 0.05
    if (armR) armR.rotation.x = -Math.sin(this.walkT * 1.8) * 0.05
    if (legL) legL.rotation.x = 0
    if (legR) legR.rotation.x = 0
    this.bobY = 0
  }
}
