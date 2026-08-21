import * as THREE from 'three'
import { EnemyDef, SoldierDef, DamageType } from './types.ts'
import { LanePath } from './path.ts'
import { World, KillCredit } from './world.ts'
import { buildModel, setFlash, getPart, VoxModel } from '../voxel/builder.ts'
import * as units from '../voxel/models_units.ts'
import { clamp, lerpAngle, randRange } from '../core/utils.ts'

export const enemyModelFactories: Record<string, () => VoxModel> = {
  husk: units.huskModel,
  sprinter: units.sprinterModel,
  shield: units.shieldGruntModel,
  acolyte: units.acolyteModel,
  gargoyle: units.gargoyleModel,
  brute: units.bruteModel,
  spiderling: () => units.spiderModel(false),
  broodmother: () => units.spiderModel(true),
  warlock: units.warlockModel,
  juggernaut: units.juggernautModel,
  shardback: units.shardbackModel,
  mistwalker: units.mistwalkerModel,
  veilqueen: units.veilqueenModel,
}

const soldierModelFactories: Record<string, () => VoxModel> = {
  militia: units.militiaModel,
  footman: units.footmanModel,
  knight: units.knightModel,
  paladin: units.paladinModel,
  berserker: units.berserkerModel,
  reinforcement: units.reinforcementModel,
  hero: units.heroModel,
  liora: units.lioraModel,
  zephyra: units.zephyraModel,
}

// ---------------- health bars ----------------

// all transparent so they share the transparent render pass; renderOrder layers fg over bg
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false })
const barFgMat = new THREE.MeshBasicMaterial({ color: 0x62d84a, transparent: true, depthTest: false, depthWrite: false })
const barFgMatHurt = new THREE.MeshBasicMaterial({ color: 0xe8b23c, transparent: true, depthTest: false, depthWrite: false })
const barFgMatCrit = new THREE.MeshBasicMaterial({ color: 0xd8452f, transparent: true, depthTest: false, depthWrite: false })
// shared across every unit: must never be disposed with an instance
for (const m of [barBgMat, barFgMat, barFgMatHurt, barFgMatCrit]) m.userData.shared = true
const barGeo = new THREE.PlaneGeometry(1, 1)

export class HealthBar {
  group = new THREE.Group()
  private fg: THREE.Mesh
  private width: number
  private static tmpQuat = new THREE.Quaternion()

  constructor(width = 0.55) {
    this.width = width
    const bg = new THREE.Mesh(barGeo, barBgMat)
    bg.scale.set(width + 0.04, 0.09, 1)
    bg.renderOrder = 20
    this.fg = new THREE.Mesh(barGeo, barFgMat)
    this.fg.scale.set(width, 0.06, 1)
    this.fg.position.z = 0.001
    this.fg.renderOrder = 21
    this.group.add(bg, this.fg)
    this.group.visible = false
  }

  set(frac: number, camQuat: THREE.Quaternion): void {
    const f = clamp(frac, 0, 1)
    this.group.visible = f < 0.999
    if (!this.group.visible) return
    this.fg.scale.x = Math.max(0.001, this.width * f)
    this.fg.position.x = -this.width * (1 - f) / 2
    this.fg.material = f > 0.55 ? barFgMat : f > 0.25 ? barFgMatHurt : barFgMatCrit
    // counteract the (rotated) parent so the bar faces the camera in world space
    const q = HealthBar.tmpQuat
    if (this.group.parent) {
      this.group.parent.getWorldQuaternion(q).invert()
      this.group.quaternion.copy(q).multiply(camQuat)
    } else {
      this.group.quaternion.copy(camQuat)
    }
  }
}

// ---------------- Enemy ----------------

export type EnemyState = 'walking' | 'dying' | 'gone'

export interface EnemySpawnOpts {
  hpMult?: number
  speedMult?: number
  elite?: boolean
  surged?: boolean
  /** which wave this enemy belongs to (streak/promise tracking); -1 = untracked */
  waveTag?: number
  /** summoned while the summoner lives: no bounty/shards/XP (anti-farming) */
  noReward?: boolean
}

const ELITE_TINT = 0x9f3aff

export class Enemy {
  group: THREE.Group
  hp: number
  maxHp: number
  armor: number
  dist: number
  offset: number
  state: EnemyState = 'walking'
  blockers: Soldier[] = []
  stunUntil = 0
  poisons: { dps: number, until: number, credit?: KillCredit }[] = []
  slowUntil = 0
  slowFactor = 1
  readonly elite: boolean
  readonly surged: boolean
  readonly waveTag: number
  readonly noReward: boolean
  private speedMult: number
  phased = false
  private phaseTimer = 0
  private summonTimer = 0
  private attackTimer: number
  private healAuraTimer = 0
  private animT = Math.random() * 10
  private flash = 0
  private dyingT = 0
  private yaw = 0
  private bar: HealthBar
  private parts: Record<string, THREE.Object3D | undefined>
  readonly barY: number
  readonly radius: number

  constructor(readonly def: EnemyDef, readonly lane: LanePath, readonly laneIndex: number, startDist = 0, opts: EnemySpawnOpts = {}) {
    this.elite = opts.elite ?? false
    this.surged = opts.surged ?? false
    this.waveTag = opts.waveTag ?? -1
    this.noReward = opts.noReward ?? false
    this.speedMult = opts.speedMult ?? 1
    const hpMult = (opts.hpMult ?? 1) * (this.elite ? 1.9 : 1)
    this.hp = this.maxHp = Math.round(def.hp * hpMult)
    this.armor = def.armor
    this.dist = startDist
    this.offset = randRange(-0.27, 0.27)
    this.attackTimer = def.attackInterval * Math.random()
    this.summonTimer = (def.summons?.interval ?? 0) * 0.6
    const factory = enemyModelFactories[def.model]
    this.group = buildModel(factory(), `enemy:${def.model}`, { cloneMaterials: true })
    const s = (def.scale ?? 1) * 1.12 * (this.elite ? 1.15 : 1)
    this.group.scale.setScalar(s)
    if (this.elite || this.surged || def.tint !== undefined) this.applyTint()
    this.barY = (def.model === 'juggernaut' ? 1.35 : def.model === 'brute' ? 1.0 : 0.75) * s + (def.yOffset ?? 0)
    this.radius = 0.22 * s
    this.parts = {}
    for (const name of ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'wingL', 'wingR', 'legsL', 'legsR', 'legFL', 'legFR', 'legBL', 'legBR']) {
      this.parts[name] = getPart(this.group, name)
    }
    this.bar = new HealthBar(def.boss ? 0.9 : 0.5 * Math.max(1, s))
    this.bar.group.position.y = this.barY
    this.group.add(this.bar.group)
    const start = lane.sample(startDist, this.offset)
    this.group.position.set(start.x, def.yOffset ?? 0, start.z)
    this.yaw = Math.atan2(start.dirX, start.dirZ)
    this.group.rotation.y = this.yaw
  }

  get pos(): THREE.Vector3 { return this.group.position }
  get alive(): boolean { return this.state === 'walking' }
  /** alive AND currently hittable (mistwalkers phase out) */
  get targetable(): boolean { return this.alive && !this.phased }
  get remaining(): number { return this.lane.length - this.dist }

  private applyTint(): void {
    const color = this.elite ? ELITE_TINT : this.surged ? 0x6f2aaf : this.def.tint
    if (color === undefined) return
    const intensity = this.elite ? 0.32 : this.surged ? 0.2 : 0.28
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && !o.material.userData.shared) {
        o.material.emissive.set(color)
        o.material.emissiveIntensity = intensity
      }
    })
  }

  private setPhaseOpacity(opacity: number): void {
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh && !o.material.userData?.shared) {
        const m = o.material as THREE.Material
        m.transparent = opacity < 1
        m.opacity = opacity
      }
    })
  }

  /** returns damage actually dealt */
  takeDamage(amount: number, type: DamageType, world: World, opts: { crit?: boolean, silent?: boolean, mrPierce?: number, credit?: KillCredit } = {}): number {
    if (!this.alive || this.phased) return 0
    let mult = 1
    if (type === 'physical') mult = 1 - this.armor
    else if (type === 'magic') mult = 1 - this.def.magicResist * (1 - (opts.mrPierce ?? 0))
    const dealt = Math.max(0, amount * mult)
    this.hp -= dealt
    if (!opts.silent) {
      this.flash = 0.16
      setFlash(this.group, 0.65)
    }
    if (opts.crit) {
      world.floater(this.pos.x, this.pos.y + this.barY + 0.15, this.pos.z, `${Math.round(dealt)}!`, 'crit')
      world.sfx('crit', 0.8)
    }
    if (this.hp <= 0) {
      if (opts.credit) opts.credit.kills++
      this.die(world)
    }
    return dealt
  }

  applyPoison(dps: number, duration: number, world: World, credit?: KillCredit): void {
    this.poisons.push({ dps, until: world.time + duration, credit })
    if (this.poisons.length > 4) this.poisons.shift()
  }

  applyStun(duration: number, world: World): void {
    this.stunUntil = Math.max(this.stunUntil, world.time + duration)
    world.particles.stunStars(this.pos.x, this.pos.y + this.barY, this.pos.z)
  }

  /** a weaker slow never overwrites a stronger active one; equal slows extend */
  applySlow(factor: number, duration: number, world: World): void {
    const active = world.time < this.slowUntil
    if (!active || factor < this.slowFactor) {
      this.slowFactor = factor
      this.slowUntil = world.time + duration
    } else if (factor === this.slowFactor) {
      this.slowUntil = Math.max(this.slowUntil, world.time + duration)
    }
  }

  shredArmor(amount: number): void {
    this.armor = Math.max(0, this.armor - amount)
  }

  heal(amount: number): void {
    if (!this.alive) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  private die(world: World): void {
    if (this.state !== 'walking') return
    this.state = 'dying'
    this.dyingT = 0
    this.releaseBlockers()
    this.bar.group.visible = false
    world.onEnemyKilled(this)
  }

  forceRemove(): void {
    this.state = 'gone'
  }

  private releaseBlockers(): void {
    for (const s of this.blockers) { if (s.target === this) s.target = null }
    this.blockers.length = 0
  }

  update(dt: number, world: World): void {
    this.animT += dt
    if (this.flash > 0) {
      this.flash -= dt
      if (this.flash <= 0) {
        setFlash(this.group, 0)
        if (this.elite || this.surged || this.def.tint !== undefined) this.applyTint()
      }
    }

    // phasing (mistwalkers): periodically slip out of reach
    if (this.def.phasing && this.state === 'walking') {
      this.phaseTimer += dt
      const cycle = this.def.phasing.interval + this.def.phasing.duration
      const inPhase = (this.phaseTimer % cycle) > this.def.phasing.interval
      if (inPhase !== this.phased) {
        this.phased = inPhase
        this.setPhaseOpacity(inPhase ? 0.25 : 1)
        if (inPhase) {
          this.releaseBlockers()
          world.particles.magicImpact(this.pos.x, this.pos.y + 0.4, this.pos.z, 0xbfffe8)
        }
      }
    }

    // boss summons
    if (this.def.summons && this.state === 'walking') {
      this.summonTimer += dt
      if (this.summonTimer >= this.def.summons.interval) {
        this.summonTimer = 0
        for (let i = 0; i < this.def.summons.count; i++) {
          world.spawnEnemyAt(this.def.summons.id, this.laneIndex, Math.max(0, this.dist - 0.25 - i * 0.2), { waveTag: this.waveTag, noReward: true })
        }
        world.particles.magicImpact(this.pos.x, this.pos.y + 0.5, this.pos.z, 0xdd6bff)
        world.sfx('magic', 0.8)
      }
    }

    if (this.state === 'dying') {
      this.dyingT += dt
      const t = this.dyingT / 0.55
      this.group.rotation.x = -t * Math.PI / 2 * 0.9
      this.group.position.y = Math.max((this.def.yOffset ?? 0) * (1 - t * 2), 0) + Math.sin(Math.min(t, 1) * Math.PI) * 0.1
      const s = (this.def.scale ?? 1) * Math.max(0.01, 1 - Math.max(0, t - 0.5) * 2)
      this.group.scale.setScalar(s)
      if (this.dyingT > 0.7) this.state = 'gone'
      return
    }
    if (this.state !== 'walking') return

    const stunned = world.time < this.stunUntil

    // poison ticks (true damage); a poison kill credits its strongest source
    if (this.poisons.length) {
      this.poisons = this.poisons.filter(p => p.until > world.time)
      let dps = 0
      let strongest: KillCredit | undefined
      for (const p of this.poisons) {
        if (p.dps > dps) { dps = p.dps; strongest = p.credit }
      }
      if (dps > 0) {
        this.hp -= dps * dt
        if (Math.random() < dt * 6) world.particles.poisonDrip(this.pos.x, this.pos.y + 0.3, this.pos.z)
        if (this.hp <= 0) {
          if (strongest) strongest.kills++
          this.die(world)
          return
        }
      }
    }
    if (this.def.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt)
    if (this.def.healAura) {
      this.healAuraTimer -= dt
      if (this.healAuraTimer <= 0) {
        this.healAuraTimer = 0.6
        for (const e of world.enemies) {
          if (e !== this && e.alive && e.hp < e.maxHp && e.pos.distanceTo(this.pos) < this.def.healAura.radius) {
            e.heal(this.def.healAura.hps * 0.6)
            world.particles.healSparkle(e.pos.x, e.pos.y + 0.4, e.pos.z)
          }
        }
      }
    }

    // combat with blockers
    const engaged = this.blockers.some(s => s.alive && s.group.position.distanceTo(this.pos) < 0.62)
    this.blockers = this.blockers.filter(s => s.alive && s.target === this)

    if (engaged && !stunned) {
      const target = this.blockers.find(s => s.alive)
      if (target) {
        this.yaw = lerpAngle(this.yaw, Math.atan2(target.group.position.x - this.pos.x, target.group.position.z - this.pos.z), dt * 8)
        this.attackTimer -= dt
        if (this.attackTimer <= 0) {
          this.attackTimer = this.def.attackInterval
          target.takeDamage(randRange(...this.def.attackDamage), world)
          world.sfx('hit', 0.5)
        }
        // fight pose
        this.animFight()
      }
    } else if (!stunned) {
      // ranged enemies stop to bombard nearby soldiers
      if (this.def.ranged) {
        const victim = world.soldiers.find(s => s.alive && s.group.position.distanceTo(this.pos) < 1.7)
        if (victim) {
          this.yaw = lerpAngle(this.yaw, Math.atan2(victim.group.position.x - this.pos.x, victim.group.position.z - this.pos.z), dt * 6)
          this.attackTimer -= dt
          if (this.attackTimer <= 0) {
            this.attackTimer = this.def.attackInterval
            world.fireProjectile({
              kind: 'warlockBolt',
              from: this.pos.clone().add(new THREE.Vector3(0, 0.45, 0)),
              target: victim,
              damage: randRange(...this.def.attackDamage),
              world,
            })
          }
          this.animFight()
          this.group.rotation.y = this.yaw
          this.bar.set(this.hp / this.maxHp, world.cameraQuat)
          return
        }
      }
      // walk
      const speed = this.def.speed * this.speedMult * (world.time < this.slowUntil ? this.slowFactor : 1)
      this.dist += speed * dt
      if (this.dist >= this.lane.length) {
        this.state = 'gone'
        this.releaseBlockers()
        world.onEnemyLeaked(this)
        return
      }
      const s = this.lane.sample(this.dist, this.offset)
      this.group.position.x = s.x
      this.group.position.z = s.z
      const targetYaw = Math.atan2(s.dirX, s.dirZ)
      this.yaw = lerpAngle(this.yaw, targetYaw, dt * 7)
      this.animWalk(dt, speed)
    }

    this.group.rotation.y = this.yaw
    this.bar.set(this.hp / this.maxHp, world.cameraQuat)
  }

  private animWalk(dt: number, speed: number): void {
    const m = this.def.model
    const t = this.animT
    if (m === 'veilqueen') {
      const flap = Math.sin(t * 6.5)
      if (this.parts.wingL) this.parts.wingL.rotation.z = flap * 0.45
      if (this.parts.wingR) this.parts.wingR.rotation.z = -flap * 0.45
      if (this.parts.head) this.parts.head.rotation.x = Math.sin(t * 1.8) * 0.08
      this.group.position.y = (this.def.yOffset ?? 0.9) + Math.sin(t * 1.7) * 0.09
      return
    }
    if (m === 'gargoyle') {
      const flap = Math.sin(t * 9)
      if (this.parts.wingL) this.parts.wingL.rotation.z = flap * 0.55
      if (this.parts.wingR) this.parts.wingR.rotation.z = -flap * 0.55
      this.group.position.y = (this.def.yOffset ?? 0.8) + Math.sin(t * 2.2) * 0.07
      return
    }
    const cycle = Math.sin(t * (4.5 + speed * 5))
    const bob = Math.abs(Math.sin(t * (4.5 + speed * 5))) * 0.035
    this.group.position.y = bob
    if (m === 'sprinter') {
      for (const [name, phase] of [['legFL', 0], ['legBR', 0], ['legFR', Math.PI], ['legBL', Math.PI]] as const) {
        const p = this.parts[name]
        if (p) p.rotation.x = Math.sin(t * 11 + phase) * 0.7
      }
      if (this.parts.head) this.parts.head.rotation.x = Math.sin(t * 5) * 0.08
      return
    }
    if (m === 'spiderling' || m === 'broodmother' || m === 'shardback') {
      if (this.parts.legsL) this.parts.legsL.rotation.y = cycle * 0.22
      if (this.parts.legsR) this.parts.legsR.rotation.y = -cycle * 0.22
      return
    }
    if (m === 'mistwalker') {
      if (this.parts.body) this.parts.body.rotation.z = Math.sin(t * 2.6) * 0.06
      if (this.parts.armL) this.parts.armL.rotation.x = -0.4 + Math.sin(t * 2.6) * 0.15
      if (this.parts.armR) this.parts.armR.rotation.x = -0.4 - Math.sin(t * 2.6) * 0.15
      this.group.position.y = 0.06 + Math.sin(t * 2.2) * 0.05
      return
    }
    if (m === 'acolyte' || m === 'warlock') {
      if (this.parts.body) this.parts.body.rotation.z = Math.sin(t * 3) * 0.05
      if (this.parts.armL) this.parts.armL.rotation.x = -0.3 + Math.sin(t * 3) * 0.1
      if (this.parts.armR) this.parts.armR.rotation.x = -0.3 - Math.sin(t * 3) * 0.1
      return
    }
    // humanoids
    const swing = cycle * 0.55
    if (this.parts.legL) this.parts.legL.rotation.x = swing
    if (this.parts.legR) this.parts.legR.rotation.x = -swing
    if (m === 'husk') {
      // arms out, zombie style
      if (this.parts.armL) { this.parts.armL.rotation.x = -1.15 + cycle * 0.12 }
      if (this.parts.armR) { this.parts.armR.rotation.x = -1.15 - cycle * 0.12 }
      if (this.parts.head) this.parts.head.rotation.z = Math.sin(t * 2.1) * 0.12
    } else {
      if (this.parts.armL) this.parts.armL.rotation.x = -swing * 0.7
      if (this.parts.armR) this.parts.armR.rotation.x = swing * 0.7
    }
  }

  private animFight(): void {
    const t = this.animT
    const strike = Math.max(0, Math.sin(t * 6))
    if (this.parts.armR) this.parts.armR.rotation.x = -0.4 - strike * 1.1
    if (this.parts.armL) this.parts.armL.rotation.x = -0.25
    if (this.parts.legL) this.parts.legL.rotation.x = 0.12
    if (this.parts.legR) this.parts.legR.rotation.x = -0.12
  }
}

// ---------------- Soldier ----------------

export class Soldier {
  group: THREE.Group
  hp: number
  maxHp: number
  target: Enemy | null = null
  home: THREE.Vector3
  dead = false
  respawnTimer = 0
  expiresAt: number | null = null
  /** Last Muster: each death may rally retainers exactly once */
  musterConsumed = false
  /** kills by this soldier are credited here (its barracks, or the hero itself) */
  credit: KillCredit | null = null
  private attackTimer = 0
  private healPulseTimer = 0
  private animT = Math.random() * 10
  private flash = 0
  private yaw = 0
  protected bar: HealthBar

  constructor(readonly def: SoldierDef, spawnPos: THREE.Vector3, home: THREE.Vector3) {
    this.hp = this.maxHp = def.hp
    this.home = home.clone()
    const factory = soldierModelFactories[def.model]
    this.group = buildModel(factory(), `soldier:${def.model}`, { cloneMaterials: true })
    if (def.scale) this.group.scale.setScalar(def.scale)
    this.group.position.copy(spawnPos)
    this.bar = new HealthBar(0.45)
    this.bar.group.position.y = 0.72   // local; group scale applies
    this.group.add(this.bar.group)
  }

  get alive(): boolean { return !this.dead }

  takeDamage(amount: number, world: World): void {
    if (this.dead) return
    const dealt = Math.max(1, amount * (1 - this.def.armor))
    this.hp -= dealt
    this.flash = 0.14
    setFlash(this.group, 0.6)
    world.particles.bloodHit(this.group.position.x, this.group.position.y + 0.35, this.group.position.z)
    if (this.hp <= 0) this.die(world)
  }

  die(world: World): void {
    if (this.dead) return
    this.dead = true
    this.respawnTimer = 0
    if (this.target) {
      const i = this.target.blockers.indexOf(this)
      if (i >= 0) this.target.blockers.splice(i, 1)
      this.target = null
    }
    world.particles.deathPuff(this.group.position.x, this.group.position.y + 0.3, this.group.position.z, 0x9aa2ae)
    world.sfx('die', 0.5)
    this.group.visible = false
  }

  /** teardown without death effects (level dispose / menu transitions) */
  removeQuietly(): void {
    this.dead = true
    if (this.target) {
      const i = this.target.blockers.indexOf(this)
      if (i >= 0) this.target.blockers.splice(i, 1)
      this.target = null
    }
    this.group.visible = false
  }

  revive(spawnPos: THREE.Vector3): void {
    this.dead = false
    this.musterConsumed = false
    this.hp = this.maxHp
    this.flash = 0
    setFlash(this.group, 0)
    this.group.position.copy(spawnPos)
    this.group.visible = true
    this.group.rotation.set(0, 0, 0)
  }

  /** decay the damage flash; safe to call from any update path */
  protected tickFlash(dt: number): void {
    if (this.flash > 0) {
      this.flash -= dt
      if (this.flash <= 0) setFlash(this.group, 0)
    }
  }

  update(dt: number, world: World): void {
    if (this.dead) return
    if (this.expiresAt !== null && world.time > this.expiresAt) { this.die(world); return }
    this.animT += dt
    this.tickFlash(dt)

    // regen & heal pulse
    if (this.def.regen && this.hp < this.maxHp && !this.target) {
      this.hp = Math.min(this.maxHp, this.hp + this.def.regen * dt)
    }
    if (this.def.healPulse) {
      this.healPulseTimer -= dt
      if (this.healPulseTimer <= 0) {
        this.healPulseTimer = this.def.healPulse.interval
        let healed = false
        for (const s of world.soldiers) {
          if (s.alive && s.hp < s.maxHp && s.group.position.distanceTo(this.group.position) < this.def.healPulse.radius) {
            s.hp = Math.min(s.maxHp, s.hp + this.def.healPulse.amount)
            world.particles.healSparkle(s.group.position.x, s.group.position.y + 0.4, s.group.position.z)
            healed = true
          }
        }
        if (healed) world.sfx('heal', 0.5)
      }
    }

    // acquire target (phased enemies slip free of melee)
    if (this.target && (!this.target.targetable)) {
      const bi = this.target.blockers.indexOf(this)
      if (bi >= 0) this.target.blockers.splice(bi, 1)
      this.target = null
    }
    if (!this.target) {
      let best: Enemy | null = null
      let bestScore = Infinity
      for (const e of world.enemies) {
        if (!e.targetable || e.def.flying) continue
        if (e.def.boss && this.def.shunBosses) continue
        if (e.blockers.length >= 3) continue
        const dHome = e.pos.distanceTo(this.home)
        if (dHome > 1.9) continue
        const score = dHome + e.blockers.length * 0.8
        if (score < bestScore) { bestScore = score; best = e }
      }
      if (best) {
        this.target = best
        best.blockers.push(this)
      }
    }

    const pos = this.group.position
    if (this.target) {
      // stand shoulder-to-shoulder around the enemy
      const idx = Math.max(0, this.target.blockers.indexOf(this))
      const angle = Math.atan2(pos.x - this.target.pos.x, pos.z - this.target.pos.z) + (idx - 1) * 0.5
      const standAt = new THREE.Vector3(
        this.target.pos.x + Math.sin(angle) * 0.42,
        0,
        this.target.pos.z + Math.cos(angle) * 0.42,
      )
      const d = pos.distanceTo(standAt)
      if (d > 0.1) {
        const step = Math.min(d, 1.5 * dt)
        pos.x += (standAt.x - pos.x) / d * step
        pos.z += (standAt.z - pos.z) / d * step
        this.animWalk()
      }
      this.yaw = lerpAngle(this.yaw, Math.atan2(this.target.pos.x - pos.x, this.target.pos.z - pos.z), dt * 9)
      if (pos.distanceTo(this.target.pos) < 0.68) {
        this.attackTimer -= dt
        this.animFight()
        if (this.attackTimer <= 0) {
          this.attackTimer = this.def.attackInterval
          const dmg = randRange(...this.def.damage)
          const dealt = this.target.takeDamage(dmg, 'physical', world, { credit: this.credit ?? undefined })
          if (this.def.lifesteal) this.hp = Math.min(this.maxHp, this.hp + dealt * this.def.lifesteal)
          world.sfx('hit', 0.4)
        }
      }
    } else {
      const d = pos.distanceTo(this.home)
      if (d > 0.08) {
        const step = Math.min(d, 1.5 * dt)
        pos.x += (this.home.x - pos.x) / d * step
        pos.z += (this.home.z - pos.z) / d * step
        this.yaw = lerpAngle(this.yaw, Math.atan2(this.home.x - pos.x, this.home.z - pos.z), dt * 9)
        this.animWalk()
      } else {
        this.animIdle()
      }
    }
    this.group.rotation.y = this.yaw
    this.bar.set(this.hp / this.maxHp, world.cameraQuat)
  }

  private part(name: string): THREE.Object3D | undefined { return getPart(this.group, name) }

  private animWalk(): void {
    const swing = Math.sin(this.animT * 9) * 0.5
    const legL = this.part('legL'), legR = this.part('legR')
    const armL = this.part('armL'), armR = this.part('armR')
    if (legL) legL.rotation.x = swing
    if (legR) legR.rotation.x = -swing
    if (armL) armL.rotation.x = -swing * 0.6
    if (armR) armR.rotation.x = swing * 0.6
    this.group.position.y = Math.abs(Math.sin(this.animT * 9)) * 0.03
  }

  private animFight(): void {
    const strike = Math.max(0, Math.sin(this.animT * 7))
    const armR = this.part('armR'), armL = this.part('armL')
    if (armR) armR.rotation.x = -0.5 - strike * 1.2
    if (armL) armL.rotation.x = -0.3
    this.group.position.y = 0
  }

  private animIdle(): void {
    const legL = this.part('legL'), legR = this.part('legR')
    const armL = this.part('armL'), armR = this.part('armR')
    if (legL) legL.rotation.x = 0
    if (legR) legR.rotation.x = 0
    if (armL) armL.rotation.x = Math.sin(this.animT * 1.8) * 0.05
    if (armR) armR.rotation.x = -Math.sin(this.animT * 1.8) * 0.05
    this.group.position.y = 0
  }
}
