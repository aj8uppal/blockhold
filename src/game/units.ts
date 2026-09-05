import * as THREE from 'three'
import { EnemyDef, SoldierDef, DamageType } from './types.ts'
import { LanePath } from './path.ts'
import { World, KillCredit } from './world.ts'
import type { Tower } from './towers.ts'
import { buildModel, setFlash, getPart, VoxModel } from '../voxel/builder.ts'
import * as units from '../voxel/models_units.ts'
import { clamp, isCoarsePointer, lerpAngle, randRange, simRandom } from '../core/utils.ts'
import { CUTTING_SLOW, CUTTING_VULN } from './earthworks.ts'
import { HP_BAR_NAME } from './debris.ts'
import { AFFIXES, COMMANDER_RADIUS, COMMANDER_WARD, ELITE_HP, type AffixDef, type AffixId } from './affixes.ts'

/** how often a boss throws its blockers off */
export const BOSS_SWEEP_INTERVAL = 5.5

export const enemyModelFactories: Record<string, () => VoxModel> = {
  husk: units.huskModel,
  sprinter: units.sprinterModel,
  shield: units.shieldGruntModel,
  acolyte: units.acolyteModel,
  gargoyle: units.gargoyleModel,
  brute: units.bruteModel,
  hollowking: units.hollowKingModel,
  spiderling: () => units.spiderModel(false),
  broodmother: () => units.spiderModel(true),
  warlock: units.warlockModel,
  juggernaut: units.juggernautModel,
  shardback: units.shardbackModel,
  mistwalker: units.mistwalkerModel,
  veilqueen: units.veilqueenModel,
  hexling: units.hexlingModel,
  wardbearer: units.wardbearerModel,
  // the long tail's bosses, each with its own silhouette
  veilregent: units.veilRegentModel,
  ossuary: units.ossuaryModel,
  veilempress: () => units.veilEmpressModel(false),
  veilempressLanded: () => units.veilEmpressModel(true),
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

const _measureBox = new THREE.Box3()

/**
 * How high a health bar should float: the top of the model plus a small,
 * scale-aware gap. Derived rather than authored, so a new model never ends up
 * wearing its bar in the wrong place.
 */
export function measuredBarHeight(group: THREE.Object3D): number {
  group.updateMatrixWorld(true)
  _measureBox.setFromObject(group)
  const top = _measureBox.max.y - group.position.y
  if (!Number.isFinite(top) || top <= 0) return 0.75
  return top + 0.14
}

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
  affix?: AffixId | null
  surged?: boolean
  /** which wave this enemy belongs to (streak/promise tracking); -1 = untracked */
  waveTag?: number
  /** summoned while the summoner lives: no bounty/shards/XP (anti-farming) */
  noReward?: boolean
  /** deep-endless hardening added to armor and magic resistance */
  toughness?: number
  /** stood back up by the Ossuary: never again, and never for gold */
  raised?: boolean
}

const ELITE_TINT = 0x9f3aff

/**
 * How large a unit is drawn, over and above its own authored scale.
 *
 * On a phone in landscape the board is roughly 13 screen pixels per world
 * unit, which put a Husk at about twelve pixels tall - two millimetres on the
 * device this game forces into landscape and ships as an installed app. At that
 * size a Husk, a Sprinter and a Shieldbearer are the same grey smudge, and the
 * whole readable-counters design goes with them.
 *
 * The camera cannot fix this alone: pulling in far enough to read a unit loses
 * the lanes, and a tower defense played without seeing the road is a worse
 * trade than a slightly toy-like scale. So models are simply drawn larger where
 * the pixels are small. It is a rendering constant only - it touches no
 * collision radius, no lane offset, no targeting distance, and therefore no
 * balance: the simulation keeps using the authored size (see `sim` in the Enemy
 * constructor) and only the drawn mesh is affected. Health bars derive from
 * measured model height, so they follow on their own.
 */
const UNIT_SCALE = isCoarsePointer() ? 1.28 : 1

export class Enemy {
  group: THREE.Group
  hp: number
  maxHp: number
  armor: number
  /** magic resistance can be stripped, so it cannot live on the shared def */
  magicResistNow: number
  dist: number
  offset: number
  state: EnemyState = 'walking'
  blockers: Soldier[] = []
  stunUntil = 0
  poisons: { dps: number, until: number, credit?: KillCredit }[] = []
  slowUntil = 0
  slowFactor = 1
  readonly elite: boolean
  /** which named elite this is, when it is one; see game/affixes.ts */
  readonly affix: AffixDef | null
  readonly surged: boolean
  readonly waveTag: number
  readonly noReward: boolean
  /** raised once by the Ossuary; a raised thing does not rise twice */
  readonly raised: boolean
  private speedMult: number
  phased = false
  private phaseTimer = 0
  private summonTimer = 0
  private attackTimer: number
  /** strike feedback: 1 at the moment damage lands, decays to 0 */
  private strikeT = 0
  /** what last landed on this unit, so its debris carries that damage type */
  private lastHitType: DamageType = 'physical'
  private lastHitForce = 1
  /** down inside a player-dug cutting */
  private inCutting = false
  /** bosses periodically clear whoever is holding them */
  private sweepTimer = BOSS_SWEEP_INTERVAL
  private hitCount = 0
  /** hexling: the tower this imp is perched on, silencing */
  hexTarget: Tower | null = null
  private hexUntil = 0
  /** wardbearer protection: shielded while world.time < wardedUntil */
  wardedUntil = -1
  private wardTimer = 0
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
    this.affix = opts.affix ? AFFIXES[opts.affix] : null
    this.surged = opts.surged ?? false
    this.waveTag = opts.waveTag ?? -1
    this.noReward = opts.noReward ?? false
    this.raised = opts.raised ?? false
    this.speedMult = (opts.speedMult ?? 1) * (this.affix?.speed ?? 1)
    const hpMult = (opts.hpMult ?? 1) * (this.elite ? ELITE_HP * (this.affix?.hp ?? 1) : 1)
    this.hp = this.maxHp = Math.round(def.hp * hpMult)
    // deep-endless hardening: the same creatures, but progressively harder to
    // hurt, so one damage type stops being an answer forever
    const tough = opts.toughness ?? 0
    // an affix shifts what beats this enemy, so it lands on the resistances
    // themselves rather than on a flat damage multiplier; the same 0.8 ceiling
    // applies, and the floor stops a negative affix creating healing
    this.armor = Math.max(0, Math.min(0.8, def.armor + tough + (this.affix?.armor ?? 0)))
    this.magicResistNow = Math.max(0, Math.min(0.8, def.magicResist + tough + (this.affix?.magicResist ?? 0)))
    this.dist = startDist
    this.offset = randRange(-0.27, 0.27)
    this.attackTimer = def.attackInterval * simRandom()
    this.summonTimer = (def.summons?.interval ?? 0) * 0.6
    const factory = enemyModelFactories[def.model]
    this.group = buildModel(factory(), `enemy:${def.model}`, { cloneMaterials: true })
    // `sim` is the authored size the simulation reasons about; `s` is what gets
    // drawn. They differ only by UNIT_SCALE, and nothing derived from `sim` may
    // ever be computed from `s` - a collision radius that grew on phones would
    // make blocking, and therefore balance, different on a phone than a laptop.
    const sim = (def.scale ?? 1) * 1.12 * (this.elite ? 1.15 : 1)
    const s = sim * UNIT_SCALE
    this.group.scale.setScalar(s)
    if (this.elite || this.surged || def.tint !== undefined) this.applyTint()
    // Sit the bar just above whatever this thing actually is, measured rather
    // than guessed per model.
    //
    // The bar is a child of a group already scaled by `s`, and the old height
    // was *also* multiplied by `s` - so bars floated at s-squared height and
    // big units wore theirs absurdly high, which at close zoom pushed them off
    // the top of the screen. Width had the same double-scaling, which is why
    // boss bars were enormous. barY stays in world units for floaters; the
    // bar's own transform is divided back out.
    this.barY = measuredBarHeight(this.group) + (def.yOffset ?? 0)
    this.radius = 0.22 * sim
    this.parts = {}
    for (const name of ['body', 'head', 'legL', 'legR', 'armL', 'armR', 'wingL', 'wingR', 'legsL', 'legsR', 'legFL', 'legFR', 'legBL', 'legBR']) {
      this.parts[name] = getPart(this.group, name)
    }
    this.bar = new HealthBar((def.boss ? 0.85 : 0.5) / s)
    this.bar.group.name = HP_BAR_NAME
    this.bar.group.position.y = this.barY / s
    this.group.add(this.bar.group)
    const start = lane.sample(startDist, this.offset)
    this.group.position.set(start.x, def.yOffset ?? 0, start.z)
    this.yaw = Math.atan2(start.dirX, start.dirZ)
    this.group.rotation.y = this.yaw
  }

  get pos(): THREE.Vector3 { return this.group.position }
  get alive(): boolean { return this.state === 'walking' }
  /** alive AND currently hittable (mistwalkers phase out) */
  /** standing in a Watchfire's light: a phasing enemy can still be shot */
  revealed = false
  get targetable(): boolean { return this.alive && (!this.phased || this.revealed) }
  /** perched out of melee reach (soldiers must not chase a hexing imp) */
  get unreachable(): boolean { return this.hexTarget !== null }
  get remaining(): number { return this.lane.length - this.dist }

  private applyTint(): void {
    const color = this.affix ? this.affix.tint : this.elite ? ELITE_TINT : this.surged ? 0x6f2aaf : this.def.tint
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
  takeDamage(amount: number, type: DamageType, world: World, opts: { crit?: boolean, silent?: boolean, mrPierce?: number, armorPierce?: number, credit?: KillCredit } = {}): number {
    if (!this.alive || (this.phased && !this.revealed)) return 0
    let mult = 1
    if (type === 'physical') mult = 1 - this.armor * (1 - (opts.armorPierce ?? 0))
    else if (type === 'magic') mult = 1 - this.magicResistNow * (1 - (opts.mrPierce ?? 0))
    // a wardbearer's banner half-shields the horde ahead of it
    if (world.time < this.wardedUntil) {
      mult *= 0.5
      if (!opts.silent && Math.random() < 0.35) {
        world.particles.magicImpact(this.pos.x, this.pos.y + 0.45, this.pos.z, 0x8fdfff)
      }
    }
    if (this.inCutting) mult *= 1 + CUTTING_VULN
    const dealt = Math.max(0, amount * mult)
    this.hp -= dealt
    this.lastHitType = type
    this.lastHitForce = Math.max(0.7, Math.min(2.4, dealt / Math.max(24, this.maxHp * 0.16)))
    if (!opts.silent) {
      this.flash = 0.16
      // an elite flashes in its own colour, so the hit does not erase the one
      // cue that says what it is; everything else flashes white
      setFlash(this.group, 0.65, this.affix ? this.affix.tint : 0xffffff)
      // a resisted hit looks different from a clean one: plate turns arrows
      // with a dull metallic spark, a ward swallows magic in its own colour,
      // so the player can see a wrong damage type without opening a panel
      if (mult < 0.55 && world.time >= this.nextResistSparkAt) {
        this.nextResistSparkAt = world.time + 0.3
        if (type === 'physical') world.particles.hitSpark(this.pos.x, this.pos.y + 0.45, this.pos.z, 0xb7bcc4)
        else if (type === 'magic') world.particles.magicImpact(this.pos.x, this.pos.y + 0.45, this.pos.z, 0x6f5fbf)
      }
    }
    if (opts.crit) {
      // a crit is its own event and always gets its own number, immediately
      this.pendingDamage = 0
      world.floater(this.pos.x, this.pos.y + this.barY + 0.15, this.pos.z, `${Math.round(dealt)}!`, 'crit')
      world.sfx('crit', 0.8)
    } else if (!opts.silent && dealt > 0) {
      this.showDamage(dealt, world)
    }
    if (this.hp <= 0) {
      if (this.def.phaseInto) {
        // a second phase: the body is replaced on the spot by the next
        // definition, with its own health, and nothing is paid for the first
        this.phaseOut(world)
        return dealt
      }
      if (opts.credit) opts.credit.kills++
      this.die(world)
    }
    return dealt
  }

  /**
   * Become the next phase. The current enemy leaves quietly - no bounty, no
   * shatter, no wave resolution - and its successor is spawned where it stood,
   * carrying the wave tag so the wave still knows it is not over.
   */
  private phaseOut(world: World): void {
    const next = this.def.phaseInto!
    this.state = 'gone'
    this.group.visible = false
    for (const s of this.blockers) s.target = null
    this.blockers = []
    world.particles.explosion(this.pos.x, this.pos.y + 0.6, this.pos.z, 1.2)
    world.particles.magicImpact(this.pos.x, this.pos.y + 0.8, this.pos.z, 0x9fe8ff)
    world.sfx('explosion', 0.9)
    world.shake(0.28)
    world.floater(this.pos.x, this.pos.y + this.barY + 0.4, this.pos.z, 'She lands!', 'crit')
    world.spawnEnemyAt(next, this.laneIndex, this.dist, { waveTag: this.waveTag, hpScale: this.phaseHpScale })
  }

  /** the health scaling this enemy was spawned with, so a second phase inherits it */
  phaseHpScale = 1

  /** damage taken since the last number was shown above this enemy */
  private pendingDamage = 0
  private nextResistSparkAt = 0
  private nextDamageFloaterAt = 0

  /**
   * The player's own effectiveness, in numbers, for every hit and not only crits.
   *
   * Until now the only readout of how hard a tower hit was an 8-pixel health
   * bar, and the one time a number appeared was a crit - so the most common
   * event in the game, a tower doing its job, produced no legible feedback at
   * all.
   *
   * The reason it was only crits is real, though: forty arrows a second against
   * a swarm would empty a forty-element floater pool instantly and read as
   * confetti. So damage accumulates per enemy and surfaces as one number a few
   * times a second. That is also *better* than one number per hit - "148" tells
   * a player how fast something is dying; four separate "37"s do not.
   */
  private showDamage(dealt: number, world: World): void {
    this.pendingDamage += dealt
    if (world.time < this.nextDamageFloaterAt) return
    this.nextDamageFloaterAt = world.time + 0.26
    const n = Math.round(this.pendingDamage)
    this.pendingDamage = 0
    if (n < 1) return
    world.floater(this.pos.x, this.pos.y + this.barY + 0.1, this.pos.z, `${n}`, 'damage')
  }

  /**
   * Shoved back along the road by a ballista bolt. Bosses are too heavy to
   * move; a shove on a boss is simply a hit. Never pushes past the spawn.
   */
  shove(dist: number): void {
    if (this.def.boss || !this.alive) return
    this.dist = Math.max(0, this.dist - dist)
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

  /** The Unmaking strips resistance as well as plate */
  shredResist(amount: number): void {
    this.magicResistNow = Math.max(0, this.magicResistNow - amount)
  }

  heal(amount: number): void {
    if (!this.alive) return
    this.hp = Math.min(this.maxHp, this.hp + amount)
  }

  private die(world: World): void {
    if (this.state !== 'walking') return
    this.state = 'dying'
    this.dyingT = 0
    this.releaseHex()
    // a slain wardbearer's shield shatters off those it covered (wards lapse
    // within a beat on their own, so overlapping bearers keep theirs)
    if (this.def.wardAura) {
      for (const e of world.enemies) {
        if (e !== this && e.alive && world.time < e.wardedUntil) {
          world.particles.magicImpact(e.pos.x, e.pos.y + 0.5, e.pos.z, 0x8fdfff)
        }
      }
      world.sfx('lightning', 0.5)
    }
    this.releaseBlockers()
    this.bar.group.visible = false
    // come apart into the blocks this thing was built from
    world.shatterUnit(this.group, {
      force: this.lastHitForce * (this.def.boss ? 1.5 : 1),
      flavor: this.lastHitType === 'magic' ? 'magic' : 'physical',
      scale: this.def.scale ?? 1,
    })
    world.onEnemyKilled(this)
  }

  private releaseHex(): void {
    if (this.hexTarget) {
      if (this.hexTarget.hexedBy === this) this.hexTarget.hexedBy = null
      this.hexTarget = null
    }
  }

  /** knocked off (or done with) its perch: return to the road immediately */
  dropFromPerch(): void {
    if (!this.hexTarget) return
    this.releaseHex()
    const s = this.lane.sample(this.dist, this.offset)
    this.group.position.set(s.x, 0, s.z)
  }

  forceRemove(): void {
    this.releaseHex()
    this.state = 'gone'
  }

  private releaseBlockers(): void {
    for (const s of this.blockers) { if (s.target === this) s.target = null }
    this.blockers.length = 0
  }

  update(dt: number, world: World): void {
    this.animT += dt
    this.strikeT = Math.max(0, this.strikeT - dt * 4.5)
    if (this.flash > 0) {
      this.flash -= dt
      // the flash ends by putting the enemy's own look back, not by zeroing
      // the material: an elite's tint and a surge's violet live in the same
      // emissive channel, and zeroing it erased them on the first hit
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
      const s = (this.def.scale ?? 1) * UNIT_SCALE * Math.max(0.01, 1 - Math.max(0, t - 0.5) * 2)
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
        // the ward halves poison the same as every other damage source
        if (world.time < this.wardedUntil) dps *= 0.5
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

    // hexling: leap onto a nearby attacking tower and silence it
    if (this.def.hexer) {
      if (this.hexTarget) {
        if (world.time >= this.hexUntil) {
          // the hex runs dry: hop off and resume the march
          this.dropFromPerch()
        } else {
          // perch on the roof, cackling
          const t = this.hexTarget
          this.group.position.set(t.pos.x, t.perchY + Math.sin(this.animT * 5) * 0.05, t.pos.z)
          this.group.rotation.y += dt * 2.5
          this.bar.set(this.hp / this.maxHp, world.cameraQuat)
          return
        }
      } else if (world.time >= this.stunUntil) {
        const hexedCount = world.towers.reduce((n, t) => n + (t.hexedBy ? 1 : 0), 0)
        if (hexedCount < 2) {
          let best: Tower | null = null
          let bestD = this.def.hexer.range
          for (const t of world.towers) {
            if (t.isBarracks || t.hexedBy) continue
            const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z)
            if (d < bestD) { bestD = d; best = t }
          }
          if (best) {
            this.hexTarget = best
            best.hexedBy = this
            this.hexUntil = world.time + this.def.hexer.duration
            this.releaseBlockers()
            world.particles.magicImpact(best.pos.x, best.perchY, best.pos.z, 0xb37aff)
            world.floater(best.pos.x, best.perchY + 0.3, best.pos.z, 'Hexed!', 'shard')
            world.sfx('magic', 0.9)
          }
        }
      }
    }

    // wardbearer: the banner half-shields everyone marching ahead of it
    // (marked at 4Hz so a crowd of bearers stays cheap in deep endless)
    if (this.def.wardAura) {
      this.wardTimer -= dt
      if (this.wardTimer <= 0) {
        this.wardTimer = 0.25
        const a = this.def.wardAura
        for (const e of world.enemies) {
          if (e !== this && e.alive && !e.def.wardAura && !e.def.boss
            && e.remaining < this.remaining
            && e.pos.distanceTo(this.pos) < a.radius) {
            e.wardedUntil = world.time + 0.45
          }
        }
      }
    }

    // A Commander elite carries the same shield a Wardbearer does, in every
    // direction rather than only forward, and dies with it. It reuses the ward
    // rather than inventing a second shield mechanic, so a player who has
    // already learned "kill the banner" reads this instantly.
    if (this.affix?.id === 'commander') {
      this.wardTimer -= dt
      if (this.wardTimer <= 0) {
        this.wardTimer = 0.25
        for (const e of world.enemies) {
          if (e !== this && e.alive && !e.def.boss && e.pos.distanceTo(this.pos) < COMMANDER_RADIUS) {
            e.wardedUntil = world.time + COMMANDER_WARD
          }
        }
      }
    }

    // combat with blockers
    const engaged = this.blockers.some(s => s.alive && s.group.position.distanceTo(this.pos) < 0.72)
    this.blockers = this.blockers.filter(s => s.alive && s.target === this)

    // A boss held forever by one blocker is not a fight, it is a lock. The
    // Juggernaut could be soloed by a single Paladin because nothing it does
    // ever breaks a block. Bosses now sweep: periodically they hurl their
    // blockers clear and keep walking, so soldiers buy time rather than
    // replacing the defense.
    if (this.def.boss && engaged && !stunned) {
      this.sweepTimer -= dt
      if (this.sweepTimer <= 0) {
        this.sweepTimer = BOSS_SWEEP_INTERVAL
        for (const s of this.blockers) {
          if (!s.alive) continue
          s.takeDamage(randRange(this.def.attackDamage[0] * 1.6, this.def.attackDamage[1] * 1.8), world)
          s.knockBack(this.pos, world)
        }
        this.releaseBlockers()
        world.particles.explosion(this.pos.x, this.pos.y + 0.2, this.pos.z, 0.8)
        world.shake(0.14)
        world.impact('heavy')
        world.floater(this.pos.x, this.pos.y + this.barY, this.pos.z, 'Swept aside!', 'crit')
        return
      }
    }

    if (engaged && !stunned) {
      const target = this.blockers.find(s => s.alive)
      if (target) {
        this.yaw = lerpAngle(this.yaw, Math.atan2(target.group.position.x - this.pos.x, target.group.position.z - this.pos.z), dt * 8)
        this.attackTimer -= dt
        if (this.attackTimer <= 0) {
          this.attackTimer = this.def.attackInterval
          target.takeDamage(randRange(...this.def.attackDamage), world)
          this.strikeT = 1
          this.hitCount++
          world.sfx('hit', 0.5)
        }
        // fight pose
        this.animFight(dt)
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
            this.strikeT = 1
            this.hitCount++
            world.fireProjectile({
              kind: 'warlockBolt',
              from: this.pos.clone().add(new THREE.Vector3(0, 0.45, 0)),
              target: victim,
              damage: randRange(...this.def.attackDamage),
              world,
            })
          }
          this.animFight(dt)
          this.group.rotation.y = this.yaw
          this.bar.set(this.hp / this.maxHp, world.cameraQuat)
          return
        }
      }
      // walk
      let speed = this.def.speed * this.speedMult * (world.time < this.slowUntil ? this.slowFactor : 1)
      // a cutting is a killing ditch: slower going, and no cover down there
      this.inCutting = !this.def.flying && world.cuttingAt(this.pos.x, this.pos.z)
      if (this.inCutting) speed *= CUTTING_SLOW
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
    // shed any leftover strike lean from a fight that just ended
    if (this.parts.body && Math.abs(this.parts.body.rotation.x) > 0.001) {
      this.parts.body.rotation.x *= Math.max(0, 1 - dt * 8)
    }
    // Anything that flies, flies: this used to be keyed on two model names,
    // so a new flyer fell through to the ground-walker branch below - static
    // wings, and a height of zero regardless of its yOffset. Big wings beat
    // slowly and hover deep; small ones beat fast and hover light.
    if (this.def.flying) {
      const big = m === 'veilqueen' || m === 'veilempress'
      const flap = Math.sin(t * (big ? 6.5 : 9))
      const span = big ? 0.45 : 0.55
      if (this.parts.wingL) this.parts.wingL.rotation.z = flap * span
      if (this.parts.wingR) this.parts.wingR.rotation.z = -flap * span
      if (big && this.parts.head) this.parts.head.rotation.x = Math.sin(t * 1.8) * 0.08
      this.group.position.y = (this.def.yOffset ?? 0.85) + Math.sin(t * (big ? 1.7 : 2.2)) * (big ? 0.09 : 0.07)
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

  /** strike-synced combat: wind up as the attack timer runs, whip on the hit,
   *  with per-creature character instead of one generic arm circle.
   *  The snap peaks at strikeT = 1, which is the frame damage lands. Using a
   *  full sine put the visible peak 111ms *after* the health dropped, so the
   *  player saw the damage and then the weapon. */
  private animFight(_dt: number): void {
    const p = clamp(1 - this.attackTimer / this.def.attackInterval, 0, 1)
    const snap = Math.sin(Math.min(1, this.strikeT) * Math.PI / 2)
    const P = this.parts
    const m = this.def.model
    if (m === 'spiderling' || m === 'broodmother' || m === 'shardback') {
      // mandible splay, then a whole-body bite lunge
      if (P.legsL) P.legsL.rotation.y = 0.28 + snap * 0.3
      if (P.legsR) P.legsR.rotation.y = -0.28 - snap * 0.3
      if (P.body) P.body.rotation.x = -p * 0.15 + snap * 0.42
      this.group.position.y = snap * 0.09
      return
    }
    if (m === 'sprinter') {
      // rearing pounce on the forelegs
      for (const n of ['legFL', 'legFR'] as const) {
        if (P[n]) P[n]!.rotation.x = -p * 0.9 + snap * 1.4
      }
      if (P.head) P.head.rotation.x = -p * 0.3 + snap * 0.55
      this.group.position.y = snap * 0.13
      return
    }
    if (m === 'brute' || m === 'juggernaut') {
      // slow two-handed overhead slam
      for (const a of [P.armL, P.armR]) {
        if (a) a.rotation.x = -0.3 - p * 1.7 + snap * 2.6
      }
      if (P.body) P.body.rotation.x = -p * 0.12 + snap * 0.3
      return
    }
    if (m === 'husk') {
      // alternating zombie claw rakes
      const [a, b] = this.hitCount % 2 ? [P.armL, P.armR] : [P.armR, P.armL]
      if (a) a.rotation.x = -1.15 - p * 0.5 + snap * 1.7
      if (b) b.rotation.x = -1.15
      if (P.head) P.head.rotation.z = Math.sin(this.animT * 2.1) * 0.12
      return
    }
    if (m === 'acolyte' || m === 'warlock' || m === 'mistwalker') {
      // a rising incantation released on the strike
      if (P.armR) P.armR.rotation.x = -0.3 - p * 1.5 + snap * 1.8
      if (P.armL) P.armL.rotation.x = -0.4 - snap * 0.5
      if (P.body) P.body.rotation.z = Math.sin(this.animT * 3) * 0.05
      return
    }
    // armored grunts: braced shoulder bash
    if (P.armR) P.armR.rotation.x = -0.4 - p * 1.1 + snap * 1.9
    if (P.armL) P.armL.rotation.x = -0.35
    if (P.body) P.body.rotation.x = snap * 0.16
    if (P.legL) P.legL.rotation.x = 0.12
    if (P.legR) P.legR.rotation.x = -0.12
  }
}

// ---------------- Soldier ----------------

export class Soldier {
  /**
   * Height is composed, never written by an animation.
   *
   * `baseY` is the ground under the unit and `bobY` is its walk bounce; update
   * adds them. Animations used to set `position.y` outright, which meant a unit
   * standing on raised ground was buried in it - and a unit whose current
   * animation happens not to touch height kept whatever it last had.
   */
  protected baseY = 0
  protected bobY = 0
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
  private strikeT = 0
  private hitCount = 0
  private healPulseTimer = 0
  /** 1 at the moment an axe leaves the hand, decaying: the throw pose */
  private throwT = 0
  /** world time before which this soldier cannot take a new block */
  reengageAt = 0
  /** how much room this soldier takes up, so fighters do not stand inside each other */
  readonly radius: number = 0.2
  private animT = Math.random() * 10
  private flash = 0
  private yaw = 0
  protected bar: HealthBar

  constructor(readonly def: SoldierDef, spawnPos: THREE.Vector3, home: THREE.Vector3) {
    this.hp = this.maxHp = def.hp
    this.home = home.clone()
    const factory = soldierModelFactories[def.model]
    this.group = buildModel(factory(), `soldier:${def.model}`, { cloneMaterials: true })
    // soldiers share the board with enemies, so they share the legibility scale;
    // their own `radius` is a fixed constant and is deliberately left alone
    this.group.scale.setScalar((def.scale ?? 1) * UNIT_SCALE)
    this.group.position.copy(spawnPos)
    this.bar = new HealthBar(0.45)
    this.bar.group.name = HP_BAR_NAME
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

  /** thrown clear by a boss sweep: pushed back, and briefly unable to re-block */
  knockBack(from: THREE.Vector3, world: World): void {
    if (!this.alive) return
    const dx = this.group.position.x - from.x
    const dz = this.group.position.z - from.z
    const len = Math.hypot(dx, dz) || 1
    this.group.position.x += (dx / len) * 0.9
    this.group.position.z += (dz / len) * 0.9
    this.target = null
    this.reengageAt = world.time + 1.4
    world.particles.hitSpark(this.group.position.x, this.group.position.y + 0.4, this.group.position.z, 0xffd24a)
  }

  revive(spawnPos: THREE.Vector3): void {
    this.dead = false
    this.musterConsumed = false
    this.strikeT = 0
    this.hp = this.maxHp
    this.flash = 0
    setFlash(this.group, 0)
    this.group.position.copy(spawnPos)
    this.group.visible = true
    this.group.rotation.set(0, 0, 0)
  }

  /**
   * Throw. Called by the Warcamp when this soldier is the one hurling the
   * axe, so the arm goes back and snaps forward as the projectile appears -
   * the axe visibly comes from somebody rather than from the roof.
   */
  throwAxe(at?: THREE.Vector3): void {
    this.throwT = 1
    // face what is being thrown at, and hold that facing for the throw
    if (at) this.faceUntil = { yaw: Math.atan2(at.x - this.group.position.x, at.z - this.group.position.z), t: 0.6 }
  }

  /** a facing the throw holds, overriding the walk/idle facing while it lasts */
  private faceUntil: { yaw: number, t: number } | null = null

  /** where a thrown thing leaves this soldier's hand */
  get handPos(): THREE.Vector3 {
    const p = this.group.position
    return new THREE.Vector3(p.x + Math.sin(this.yaw) * 0.12, p.y + 0.42, p.z + Math.cos(this.yaw) * 0.12)
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
    this.strikeT = Math.max(0, this.strikeT - dt * 4.5)
    this.throwT = Math.max(0, this.throwT - dt * 3.2)
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
        if (healed) {
          world.sfx('heal', 0.5)
          world.particles.healRing(
            this.group.position.x, this.group.position.y, this.group.position.z,
            this.def.healPulse.radius,
          )
        }
      }
    }

    // acquire target (phased enemies slip free of melee)
    if (this.target && (!this.target.targetable)) {
      const bi = this.target.blockers.indexOf(this)
      if (bi >= 0) this.target.blockers.splice(bi, 1)
      this.target = null
    }
    // a soldier just thrown clear by a boss needs a beat before it can grab on
    // again, or the sweep changes nothing
    if (!this.target && world.time >= this.reengageAt) {
      let best: Enemy | null = null
      let bestScore = Infinity
      for (const e of world.enemies) {
        if (!e.targetable || e.def.flying || e.unreachable) continue
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
    // Movement decisions are made on the ground plane only. A soldier spawns
    // at its barracks door, which sits on the plot at y=0.1, while its home is
    // authored at y=0 - so the 3D distance between "here" and "home" could
    // never drop below 0.1, the arrival test never passed, and every idle
    // soldier in the game marched in place forever, a tenth of a unit from
    // where it was trying to stand.
    const flat = (a: THREE.Vector3, b: THREE.Vector3) => Math.hypot(a.x - b.x, a.z - b.z)
    if (this.target) {
      /**
       * Take a fixed slot in front of the enemy and hold it.
       *
       * The angle used to be derived from the soldier's own live position, so
       * every frame it recomputed and every fighter slowly orbited its
       * opponent - the endless circling that made melee look aimless. The
       * slot is anchored to the enemy's facing instead, so soldiers plant
       * themselves and actually stand and fight.
       *
       * The stand-off distance accounts for both bodies, so they line up
       * against each other rather than standing inside one another.
       */
      const idx = Math.max(0, this.target.blockers.indexOf(this))
      const facing = Math.atan2(this.target.pos.x - pos.x, this.target.pos.z - pos.z)
      const angle = facing + Math.PI + (idx - 1) * 0.62
      const standOff = 0.34 + this.target.radius + this.radius
      const standAt = new THREE.Vector3(
        this.target.pos.x + Math.sin(angle) * standOff,
        0,
        this.target.pos.z + Math.cos(angle) * standOff,
      )
      const d = flat(pos, standAt)
      if (d > 0.1) {
        const step = Math.min(d, 1.5 * dt)
        pos.x += (standAt.x - pos.x) / d * step
        pos.z += (standAt.z - pos.z) / d * step
        this.animWalk()
      }
      this.yaw = lerpAngle(this.yaw, Math.atan2(this.target.pos.x - pos.x, this.target.pos.z - pos.z), dt * 9)
      if (flat(pos, this.target.pos) < standOff + 0.22) {
        this.animFight(dt)
        this.attackTimer -= dt
        if (this.attackTimer <= 0) {
          this.attackTimer = this.def.attackInterval
          const dmg = randRange(...this.def.damage)
          const dealt = this.target.takeDamage(dmg, 'physical', world, { credit: this.credit ?? undefined })
          if (this.def.lifesteal) this.hp = Math.min(this.maxHp, this.hp + dealt * this.def.lifesteal)
          this.strikeT = 1
          this.hitCount++
          world.sfx('hit', 0.4)
        }
      }
    } else {
      const d = flat(pos, this.home)
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
    if (this.throwT > 0) {
      // A full overhand throw: the arm goes right back over the shoulder in
      // the first third and whips through past horizontal in the rest, with
      // the body leaning into it. Big on purpose - a subtle throw at the scale
      // the game is played at is an invisible throw.
      const k = 1 - this.throwT
      const armR = this.part('armR')
      if (armR) armR.rotation.x = k < 0.35 ? -2.6 * (k / 0.35) : -2.6 + (k - 0.35) / 0.65 * 4.0
      const armL = this.part('armL')
      if (armL) armL.rotation.x = -0.8 * Math.sin(k * Math.PI)
      const body = this.part('body')
      if (body) body.rotation.x = k < 0.35 ? -0.25 : 0.35 * Math.sin((k - 0.35) / 0.65 * Math.PI)
    }
    if (this.faceUntil) {
      this.faceUntil.t -= dt
      this.yaw = lerpAngle(this.yaw, this.faceUntil.yaw, dt * 14)
      if (this.faceUntil.t <= 0) this.faceUntil = null
    }
    this.group.rotation.y = this.yaw
    // height is composed here and nowhere else: the ground under the unit plus
    // whatever its walk cycle adds, so a terrace lifts it and a hop stays a hop
    this.baseY = world.groundY(pos.x, pos.z)
    pos.y = this.baseY + this.bobY
    this.bar.set(this.hp / this.maxHp, world.cameraQuat)
  }

  private part(name: string): THREE.Object3D | undefined { return getPart(this.group, name) }

  private animWalk(): void {
    const swing = Math.sin(this.animT * 9) * 0.5
    const legL = this.part('legL'), legR = this.part('legR')
    const armL = this.part('armL'), armR = this.part('armR')
    const body = this.part('body')
    if (legL) legL.rotation.x = swing
    if (legR) legR.rotation.x = -swing
    if (armL) armL.rotation.x = -swing * 0.6
    if (armR) armR.rotation.x = swing * 0.6
    if (body) body.rotation.x *= 0.85
    this.bobY = Math.abs(Math.sin(this.animT * 9)) * 0.03
  }

  /** strike-synced swings with per-soldier character */
  private animFight(_dt: number): void {
    const p = clamp(1 - this.attackTimer / this.def.attackInterval, 0, 1)
    const snap = Math.sin(Math.min(1, this.strikeT) * Math.PI / 2)
    const armR = this.part('armR'), armL = this.part('armL'), body = this.part('body')
    const m = this.def.model
    if (m === 'berserker') {
      // frenzied alternating axes
      const [a, b] = this.hitCount % 2 ? [armL, armR] : [armR, armL]
      if (a) a.rotation.x = -0.5 - p * 1.3 + snap * 2.2
      if (b) b.rotation.x = -0.3 + snap * 0.4
    } else if (m === 'paladin') {
      // two-handed consecrated slam
      for (const a of [armL, armR]) {
        if (a) a.rotation.x = -0.4 - p * 1.6 + snap * 2.4
      }
    } else {
      // sword raised as the blow winds up, shield braced
      if (armR) armR.rotation.x = -0.4 - p * 1.1 + snap * 1.9
      if (armL) armL.rotation.x = -0.55
    }
    if (body) body.rotation.x = snap * 0.17
    const legL = this.part('legL'), legR = this.part('legR')
    if (legL) legL.rotation.x = 0.12
    if (legR) legR.rotation.x = -0.12
    this.bobY = 0
  }

  private animIdle(): void {
    const legL = this.part('legL'), legR = this.part('legR')
    const armL = this.part('armL'), armR = this.part('armR')
    const body = this.part('body')
    if (legL) legL.rotation.x = 0
    if (legR) legR.rotation.x = 0
    if (armL) armL.rotation.x = Math.sin(this.animT * 1.8) * 0.05
    if (armR) armR.rotation.x = -Math.sin(this.animT * 1.8) * 0.05
    if (body) body.rotation.x = 0
    this.bobY = 0
  }
}
