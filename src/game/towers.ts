import * as THREE from 'three'
import {
  TowerKind, TowerLevelDef, PerkDef, PERKS,
  OVERCHARGE_SHARD_COST, OVERCHARGE_DURATION, OVERCHARGE_COOLDOWN, OVERCHARGE_RATE_BONUS,
} from './types.ts'
import { towerTrees, investedGold, resolveCapstone, SELL_REFUND, RETAINER, MUSTER_COOLDOWN, MUSTER_LIFETIME } from './towerDefs.ts'
import { addConvergenceRune } from './projectiles.ts'
import { World } from './world.ts'
import { Enemy, Soldier } from './units.ts'
import { PlotInfo } from './terrain.ts'
import { buildModel, getPart, disposeClonedMaterials } from '../voxel/builder.ts'
import { towerModel, muzzleHeights, rallyFlagModel } from '../voxel/models_towers.ts'
import { randRange, lerpAngle, clamp, simChance } from '../core/utils.ts'
import { RAMPART_RANGE_BONUS, RAMPART_DAMAGE_BONUS } from './earthworks.ts'
import { onBeat, BEAT_BONUS } from './beat.ts'

/**
 * Cross-family reactions replace the old same-family resonance.
 *
 * The previous rule gave +6% damage per adjacent tower of the *same* family,
 * capped at two. It was invisible at the numbers involved and it rewarded
 * building four of the same thing in a clump - the opposite of a placement
 * decision. Reactions pay for mixing families instead, and each one does
 * something nameable rather than nudging a percentage.
 */
/**
 * How close two towers must stand to react.
 *
 * The old resonance used 2.3, which was shorter than the plot spacing on
 * Greenhollow and Emberwastes (3.0) - the mechanic was literally unreachable
 * on the tutorial map and on map three. 3.1 makes it reachable on every map
 * while staying selective; see tests/towers.test.ts.
 */
export const REACTION_RADIUS = 3.1
/** how fast a tower works while a hazard is sitting on top of it */
export const SUPPRESSED_RATE = 0.55

export type ReactionId = 'enchanted' | 'runic' | 'ranging' | 'shieldwall' | 'longshot'

export interface ReactionDef {
  id: ReactionId
  name: string
  icon: string
  pair: [TowerKind, TowerKind]
  description: string
}

export const REACTIONS: ReactionDef[] = [
  { id: 'enchanted', name: 'Enchanted Shafts', icon: 'sparkle', pair: ['arrow', 'mage'],
    description: 'Arrows ignore 30% of armor.' },
  { id: 'runic', name: 'Runic Shells', icon: 'rune', pair: ['cannon', 'mage'],
    description: 'Cannon blasts leave survivors slowed for 1.5s.' },
  { id: 'ranging', name: 'Ranging Crews', icon: 'range', pair: ['arrow', 'cannon'],
    description: 'Both towers gain +12% range.' },
  { id: 'shieldwall', name: 'Shield Wall', icon: 'shield', pair: ['barracks', 'barracks'],
    description: 'Soldiers guarded by a neighbouring tower gain +18% health.' },
  { id: 'longshot', name: 'Longshot Drill', icon: 'target', pair: ['ballista', 'arrow'],
    description: 'Archers spot for the engine: both gain +10% range.' },
]

/** the reaction a pair of adjacent families produces, if any */
export function reactionFor(a: TowerKind, b: TowerKind): ReactionDef | null {
  if (a === b) return null
  for (const r of REACTIONS) {
    if (r.id === 'shieldwall') continue
    if ((r.pair[0] === a && r.pair[1] === b) || (r.pair[0] === b && r.pair[1] === a)) return r
  }
  return null
}

/** how hard an echo of a past watch hits, relative to a live tower */
export const GHOST_POWER = 0.55

/** wash a model out so it reads as a memory rather than a tower */
export function applyGhostLook(model: THREE.Object3D): void {
  model.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) {
      if (m.userData.shared) continue
      m.transparent = true
      m.opacity = 0.42
      m.depthWrite = false
      if (m instanceof THREE.MeshStandardMaterial) {
        m.emissive.setHex(0x6fb8ff)
        m.emissiveIntensity = 0.25
      }
    }
  })
}

export type TargetPolicy = 'first' | 'last' | 'strong' | 'weak'
export const TARGET_POLICY_LABEL: Record<TargetPolicy, string> = {
  first: 'First', last: 'Last', strong: 'Strongest', weak: 'Weakest',
}
export const TARGET_POLICY_ORDER: TargetPolicy[] = ['first', 'last', 'strong', 'weak']

/** lower wins. Pure so the policies can be tested without a scene. */
export function targetScore(policy: TargetPolicy, e: { remaining: number, hp: number }): number {
  switch (policy) {
    case 'last': return -e.remaining
    case 'strong': return -e.hp
    case 'weak': return e.hp
    default: return e.remaining
  }
}

const boltColors: Record<string, number> = {
  mage1: 0x8f5aff, mage2: 0x7a6aff, mage3: 0x5aa0ff, mage4a: 0xb37aff, mage4b: 0x9fe8ff,
  mage5a: 0xd8a5ff, mage5b: 0xbfefff,
}

/** each upgrade visibly grows the building: presence tracks power */
const TIER_SCALE = [0.9, 1.0, 1.1, 1.2, 1.3]

/** where the ascension sigil floats, per tower model */
function towerCrownHeight(model: string): number {
  const t5 = model.includes('5')
  if (model.startsWith('arrow')) return t5 ? 2.1 : 1.6
  if (model.startsWith('mage')) return t5 ? 2.0 : 1.75
  if (model.startsWith('cannon')) return t5 ? 1.35 : 1.15
  if (model.startsWith('beacon')) return t5 ? 1.75 : 1.5
  if (model.startsWith('ballista')) return t5 ? 1.2 : 1.0
  return t5 ? 1.45 : 1.25
}

export class Tower {
  group: THREE.Group
  model!: THREE.Group
  def!: TowerLevelDef
  level: 1 | 2 | 3 | 4 | 5 = 1
  branch: 0 | 1 | null = null
  /** capstone: attack counter driving Crown Volley / Convergence Rune */
  private signatureCount = 0
  /** capstone: Last Muster cooldown gate */
  private musterReadyAt = 0
  /** Emberthrone's second shell, queued during the first */
  private pendingTwin: THREE.Vector3 | null = null
  cooldown = 0
  target: Enemy | null = null
  soldiers: Soldier[] = []
  rallyPoint = new THREE.Vector3()
  targetPolicy: TargetPolicy = 'first'
  /** standing on raised ground or the map's own high ground: further sight, heavier shots */
  onHighGround = false
  /** the height this tower shoots from: it sees over anything not above this */
  footing = 0
  /** inside a hazard that slows its crew; cleared when the hazard moves on */
  suppressed = false
  /** an echo of a previous watch: it fights, but faintly, and cannot be touched */
  isGhost = false
  rallyFlag: THREE.Group | null = null
  /** count of same-family neighbors (0-2), set by Game.recomputeResonance */
  resonance = 0
  /** cross-family reactions currently active on this tower */
  reactions = new Set<ReactionId>()
  /**
   * What the strongest beacon in reach is doing for this tower. Beacons do not
   * stack: two next to each other light the same towers, they do not double
   * the light. Set by Game.recomputeResonance alongside the reactions.
   */
  auraDamage = 0
  auraRange = 0
  auraRate = 0
  /** Crownfire: when this beacon next kindles the towers in its light */
  private kindleAt = 0
  has(r: ReactionId): boolean { return this.reactions.has(r) }
  /** enemies this building (and its soldiers) has slain */
  kills = 0
  perk: PerkDef | null = null
  overchargeUntil = 0
  overchargeCdUntil = 0
  /** the hexling silencing this tower, if any */
  hexedBy: Enemy | null = null
  /** riftlight: empowered attack rate while world.time < riftUntil */
  riftUntil = 0
  private hexRing: THREE.Mesh | null = null
  private crownMesh: THREE.Mesh | null = null
  private chargeRing: THREE.Mesh | null = null
  private turretYaw = 0
  private recoil = 0
  private buildT = 0
  private sizeMult = 1
  /** seconds spent ready-with-target but blocked by the aim gate */
  private stallT = 0
  private crystalT = Math.random() * 10

  constructor(readonly kind: TowerKind, readonly plot: PlotInfo, private readonly world: World) {
    this.group = new THREE.Group()
    this.group.position.copy(plot.pos)
    this.applyLevel(towerTrees[kind].levels[0], world, true)
  }

  get pos(): THREE.Vector3 { return this.group.position }
  get isBarracks(): boolean { return this.kind === 'barracks' }
  get isBeacon(): boolean { return this.kind === 'beacon' }
  /** the beacon's light reaches this far; the perk widens it */
  get auraReach(): number {
    return this.def.range + (this.perk?.id === 'farsight' ? 0.6 : 0) + 0.3 * this.world.armoryTier('lamplighters')
  }

  /** how many soldiers this barracks fields: its tier's squad plus the Muster Roll */
  get squadSize(): number {
    return (this.def.soldierCount ?? 3) + (this.isBarracks ? this.world.armoryTier('musterroll') : 0)
  }

  /**
   * Tier presence. Tiers 1-3 were distinguished only by model and a little
   * scale, so an expensive board did not look expensive. From tier 4 the
   * stonework catches light, and a capstone wears a slow halo - visible at the
   * distance the game is actually played at, without adding a draw call.
   */
  private tierHalo: THREE.Mesh | null = null

  private applyTierPresence(): void {
    if (!this.model) return
    const lit = this.level >= 4
    if (lit) {
      // tuned now that the material actually takes the value: the old 0.34
      // was set against clones that ignored it, and washed the authored
      // colours out to beige once they stopped ignoring it
      const glow = this.level >= 5 ? 0.16 : 0.07
      const hue = this.level >= 5 ? 0xffd98f : 0xffc76a
      this.model.traverse(o => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          if (o.material.userData.shared) return
          o.material.emissive.setHex(hue)
          o.material.emissiveIntensity = glow
        }
      })
    }
    if (this.level >= 5 && !this.tierHalo) {
      const geo = new THREE.RingGeometry(0.46, 0.6, 40)
      geo.rotateX(-Math.PI / 2)
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd98f, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false,
      })
      this.tierHalo = new THREE.Mesh(geo, mat)
      this.tierHalo.position.y = 0.07
      this.tierHalo.renderOrder = 3
      this.group.add(this.tierHalo)
    }
  }

  /** effective range including perks */
  get range(): number {
    return this.rangeFor(this.def)
  }

  /** retained so capstone specials keep a single damage scalar to multiply by */
  get resonanceMult(): number {
    return 1
  }

  /**
   * The stats this tower actually fights with.
   *
   * The panel used to print the definition's numbers, which is what a tower
   * would do standing alone on flat ground with nothing next to it - and no
   * tower in a real defense is that. A beacon, a rampart, a perk and a
   * reaction all change the answer, and a panel that ignored them told the
   * player their lit tower was doing exactly what an unlit one does. These
   * are the same multipliers `fire()` and `update()` apply, kept in one place
   * so the panel cannot drift from the fight.
   */
  get damageMult(): number {
    return (1 + this.auraDamage)
      * (this.onHighGround ? 1 + RAMPART_DAMAGE_BONUS : 1)
      * (this.perk?.id === 'serrated' || this.perk?.id === 'heavybolts' ? 1.2 : 1)
      * (this.isGhost ? GHOST_POWER : 1)
  }

  /** shots per second, relative to the definition's own rate */
  get rateMult(): number {
    return (1 + this.auraRate) * (this.perk?.id === 'windlass' ? 1 / 0.85 : 1)
  }

  /** what a given tier would deal from this plot, with everything that applies */
  effectiveDamage(def: TowerLevelDef = this.def): [number, number] | null {
    if (!def.damage) return null
    return [Math.round(def.damage[0] * this.damageMult), Math.round(def.damage[1] * this.damageMult)]
  }

  effectiveInterval(def: TowerLevelDef = this.def): number | null {
    if (!def.attackInterval) return null
    return def.attackInterval / this.rateMult
  }

  /** the reach a given tier would have from this plot */
  rangeFor(def: TowerLevelDef): number {
    if (def.aura) return def.range + (this.perk?.id === 'farsight' ? 0.6 : 0) + 0.3 * this.world.armoryTier('lamplighters')
    return (def.range + (this.perk?.id === 'hawkeye' ? 0.8 : 0))
      * (this.kind === 'ballista' ? 1 + 0.06 * this.world.armoryTier('siegecraft') : 1)
      * (this.has('ranging') ? 1.12 : 1)
      * (this.has('longshot') ? 1.10 : 1)
      * (this.onHighGround ? 1 + RAMPART_RANGE_BONUS : 1)
      * (1 + this.auraRange)
  }

  /** where the bonuses come from, in the player's words; empty when there are none */
  modifierNotes(): string[] {
    const out: string[] = []
    if (this.auraDamage || this.auraRange || this.auraRate) {
      const bits: string[] = []
      if (this.auraDamage) bits.push(`+${Math.round(this.auraDamage * 100)}% damage`)
      if (this.auraRange) bits.push(`+${Math.round(this.auraRange * 100)}% range`)
      if (this.auraRate) bits.push(`+${Math.round(this.auraRate * 100)}% attack speed`)
      out.push(`Lit by a beacon: ${bits.join(', ')}`)
    }
    if (this.onHighGround) out.push(`High ground: +${Math.round(RAMPART_DAMAGE_BONUS * 100)}% damage, +${Math.round(RAMPART_RANGE_BONUS * 100)}% range, sees over low ridges`)
    return out
  }

  /** where a hexling sits when it silences this tower */
  get perchY(): number {
    return towerCrownHeight(this.def.model) * this.sizeMult * 0.8
  }

  isOvercharged(world: World): boolean { return world.time < this.overchargeUntil }

  canOvercharge(world: { time: number, shards: number }): boolean {
    return !this.isBarracks && !this.isBeacon && world.time >= this.overchargeCdUntil && world.shards >= OVERCHARGE_SHARD_COST
  }

  /** Crownfire's gift: five free seconds of Overcharge, no shard, no cooldown */
  kindle(world: World): void {
    this.overchargeUntil = Math.max(this.overchargeUntil, world.time + 5)
    if (!this.chargeRing) this.overcharge(world)   // builds the ring; then undo the cooldown it set
    this.overchargeUntil = Math.max(this.overchargeUntil, world.time + 5)
    this.overchargeCdUntil = Math.min(this.overchargeCdUntil, world.time)
    this.chargeRing!.visible = true
  }

  overcharge(world: World): void {
    this.overchargeUntil = world.time + OVERCHARGE_DURATION
    this.overchargeCdUntil = world.time + OVERCHARGE_COOLDOWN
    if (!this.chargeRing) {
      const geo = new THREE.RingGeometry(0.42, 0.5, 32)
      geo.rotateX(-Math.PI / 2)
      const mat = new THREE.MeshBasicMaterial({ color: 0x8fdfff, transparent: true, opacity: 0.7, toneMapped: false, depthWrite: false })
      this.chargeRing = new THREE.Mesh(geo, mat)
      this.chargeRing.position.y = 0.05
      this.chargeRing.renderOrder = 3
      this.group.add(this.chargeRing)
    }
    this.chargeRing.visible = true
    world.particles.magicImpact(this.pos.x, this.pos.y + 0.6, this.pos.z, 0x8fdfff)
    world.sfx('upgrade')
  }

  ascend(perkIndex: 0 | 1, world: World): void {
    this.perk = PERKS[this.kind][perkIndex]
    this.refreshSoldierStats(world)
    // floating sigil crown marks an ascended tower
    const geo = new THREE.OctahedronGeometry(0.09)
    const mat = new THREE.MeshBasicMaterial({ color: 0x8fdfff, toneMapped: false })
    this.crownMesh = new THREE.Mesh(geo, mat)
    this.crownMesh.position.y = towerCrownHeight(this.def.model) * this.sizeMult
    this.group.add(this.crownMesh)
    if (this.isBarracks) this.respawnAllSoldiers(world)
    world.particles.magicImpact(this.pos.x, this.pos.y + 0.8, this.pos.z, 0x8fdfff)
    world.sfx('victory', 0.5)
  }

  get upgradeOptions(): TowerLevelDef[] {
    const tree = towerTrees[this.kind]
    if (this.level === 1 || this.level === 2) return [tree.levels[this.level]]
    if (this.level === 3) return [...tree.branches]
    if (this.level === 4 && this.branch !== null) return [resolveCapstone(this.kind, this.branch)]
    return []
  }

  get sellValue(): number {
    return Math.round(investedGold(this.kind, this.level, this.branch) * this.world.sellRefund)
  }

  private applyLevel(def: TowerLevelDef, world: World, initial = false): void {
    if (this.model) {
      this.group.remove(this.model)
      disposeClonedMaterials(this.model)
    }
    if (this.tierHalo) { this.group.remove(this.tierHalo); this.tierHalo = null }
    this.def = def
    // Every tower gets its own materials. Tier glow and the ghost wash are
    // per-tower effects, and writing either onto a cached shared material
    // would change every tower built from the same model.
    this.model = buildModel(towerModel(def.model), `tower:${def.model}`, { cloneMaterials: true })
    if (this.isGhost) applyGhostLook(this.model)
    this.group.add(this.model)
    this.sizeMult = TIER_SCALE[this.level - 1]
    this.buildT = 0
    this.applyTierPresence()
    if (this.isBarracks) {
      if (initial) this.pickDefaultRally(world)
      this.respawnAllSoldiers(world)
      this.updateRallyFlag(world)
    }
  }

  upgrade(optionIndex: number, world: World): void {
    const tree = towerTrees[this.kind]
    if (this.level < 3) {
      this.level = (this.level + 1) as 2 | 3
      this.applyLevel(tree.levels[this.level - 1], world)
    } else if (this.level === 3) {
      this.branch = optionIndex as 0 | 1
      this.level = 4
      this.applyLevel(tree.branches[optionIndex], world)
    } else if (this.level === 4 && this.branch !== null) {
      this.level = 5
      this.applyLevel(resolveCapstone(this.kind, this.branch), world)
      // the ascension sigil rides the new silhouette
      if (this.crownMesh) this.crownMesh.position.y = towerCrownHeight(this.def.model) * this.sizeMult
      world.particles.magicImpact(this.pos.x, this.pos.y + 1.0, this.pos.z, 0xffe89f)
    }
    world.particles.buildDust(this.pos.x, this.pos.y + 0.15, this.pos.z)
    world.sfx('upgrade')
  }

  dismantle(world: World, silent = false): void {
    for (const s of this.soldiers) {
      if (s.alive) {
        if (silent) s.removeQuietly()
        else s.die(world)
      }
      world.dynamic.remove(s.group)
      disposeClonedMaterials(s.group)
      const i = world.soldiers.indexOf(s)
      if (i >= 0) world.soldiers.splice(i, 1)
    }
    this.soldiers = []
    if (this.rallyFlag) world.dynamic.remove(this.rallyFlag)
    // a sold tower shrugs its imp off onto the road
    if (this.hexedBy) {
      this.hexedBy.dropFromPerch()
      this.hexedBy = null
    }
    for (const m of [this.crownMesh, this.chargeRing, this.hexRing]) {
      if (m) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    }
    this.crownMesh = null
    this.chargeRing = null
    this.hexRing = null
  }

  /** live-update soldier max HP when resonance or perks change */
  refreshSoldierStats(world: World): void {
    if (!this.isBarracks || !this.def.soldier) return
    const base = this.def.soldier
    const hpMult = world.soldierHpMult()
      * (this.perk?.id === 'vanguard' ? 1.25 : 1)
      * (this.has('shieldwall') ? 1.18 : 1)
    const newMax = Math.round(base.hp * hpMult)
    for (const s of this.soldiers) {
      if (s.maxHp === newMax) continue
      const frac = s.maxHp > 0 ? s.hp / s.maxHp : 1
      s.maxHp = newMax
      if (s.alive) s.hp = Math.max(1, Math.round(newMax * frac))
    }
  }

  // ---------------- barracks ----------------

  private pickDefaultRally(world: World): void {
    let best: THREE.Vector3 | null = null
    let bestD = Infinity
    for (const lane of world.lanes) {
      const d = lane.closestDistance(this.pos.x, this.pos.z)
      const s = lane.sample(d)
      const dist = Math.hypot(s.x - this.pos.x, s.z - this.pos.z)
      if (dist < bestD) { bestD = dist; best = new THREE.Vector3(s.x, 0, s.z) }
    }
    this.rallyPoint.copy(best ?? this.pos)
  }

  /** valid if within range of tower and close to a lane */
  isValidRally(x: number, z: number, world: World): boolean {
    if (Math.hypot(x - this.pos.x, z - this.pos.z) > this.def.range) return false
    return world.lanes.some(l => l.distanceToPath(x, z) < 0.75)
  }

  setRally(x: number, z: number, world: World): void {
    this.rallyPoint.set(x, 0, z)
    this.soldiers.forEach((s, i) => {
      s.home.copy(this.soldierHome(i))
      if (s.target && s.target.pos.distanceTo(s.home) > 1.9) {
        const bi = s.target.blockers.indexOf(s)
        if (bi >= 0) s.target.blockers.splice(bi, 1)
        s.target = null
      }
    })
    this.updateRallyFlag(world)
    world.sfx('click')
  }

  soldierHome(i: number): THREE.Vector3 {
    const angle = (i / this.squadSize) * Math.PI * 2 + 0.6
    return new THREE.Vector3(
      this.rallyPoint.x + Math.sin(angle) * 0.3,
      0,
      this.rallyPoint.z + Math.cos(angle) * 0.3,
    )
  }

  private doorPos(): THREE.Vector3 {
    return this.pos.clone().add(new THREE.Vector3(0, 0, 0.55))
  }

  private respawnAllSoldiers(world: World): void {
    // remove old
    for (const s of this.soldiers) {
      if (s.alive && s.target) {
        const i = s.target.blockers.indexOf(s)
        if (i >= 0) s.target.blockers.splice(i, 1)
      }
      world.dynamic.remove(s.group)
      disposeClonedMaterials(s.group)
      const i = world.soldiers.indexOf(s)
      if (i >= 0) world.soldiers.splice(i, 1)
    }
    this.soldiers = []
    const base = this.def.soldier!
    const hpMult = world.soldierHpMult()
      * (this.perk?.id === 'vanguard' ? 1.25 : 1)
      * (this.has('shieldwall') ? 1.18 : 1)
    const dmgMult = this.perk?.id === 'whetstone' ? 1.25 : 1
    const def = {
      ...base,
      hp: Math.round(base.hp * hpMult),
      damage: [Math.round(base.damage[0] * dmgMult), Math.round(base.damage[1] * dmgMult)] as [number, number],
    }
    for (let i = 0; i < this.squadSize; i++) {
      const s = new Soldier(def, this.doorPos(), this.soldierHome(i))
      s.credit = this   // soldiers fight for their barracks' tally
      this.soldiers.push(s)
      world.soldiers.push(s)
      world.dynamic.add(s.group)
    }
  }

  private updateRallyFlag(world: World): void {
    if (!this.rallyFlag) {
      this.rallyFlag = buildModel(rallyFlagModel(), 'rallyflag', { castShadow: false })
      world.dynamic.add(this.rallyFlag)
    }
    this.rallyFlag.position.set(this.rallyPoint.x, 0.02, this.rallyPoint.z)
  }

  // ---------------- combat ----------------

  private muzzle(): THREE.Vector3 {
    return this.pos.clone().add(new THREE.Vector3(0, muzzleHeights[this.def.model] * this.sizeMult, 0))
  }

  /**
   * Targeting was a single hardcoded sort on remaining distance, so every
   * tower in the game always shot whatever was closest to the gate. The
   * comparator is the whole decision, so letting the player pick it is very
   * nearly free - and it is real tactical expression rather than more breadth.
   */
  /**
   * Can this tower actually see that enemy?
   *
   * A flyer is above the terrain and always visible; a ground enemy behind a
   * ridge taller than the tower's own footing is not. This is what makes a
   * terrace worth paying for and a hollow worth avoiding.
   */
  private canSee(e: Enemy, world: World): boolean {
    if (e.def.flying) return true
    return !world.sightBlocked(this.pos.x, this.pos.z, this.footing, e.pos.x, e.pos.z)
  }

  private acquireTarget(world: World): void {
    if (this.target) {
      const t = this.target
      const inRange = t.targetable && Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) <= this.range + t.radius
      if (!inRange || !this.canSee(t, world)) this.target = null
    }
    if (this.target) return
    let best: Enemy | null = null
    let bestScore = Infinity
    for (const e of world.enemies) {
      if (!e.targetable) continue
      if (e.def.flying && !this.def.flying) continue
      if (this.def.airOnly && !e.def.flying) continue
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z)
      if (d > this.range + e.radius) continue
      if (!this.canSee(e, world)) continue
      const score = targetScore(this.targetPolicy, e)
      if (score < bestScore) { bestScore = score; best = e }
    }
    this.target = best
  }

  cycleTargetPolicy(): TargetPolicy {
    const order = TARGET_POLICY_ORDER
    this.targetPolicy = order[(order.indexOf(this.targetPolicy) + 1) % order.length]
    this.target = null      // re-acquire under the new rule immediately
    return this.targetPolicy
  }

  update(dt: number, world: World): void {
    // build pop-in (settles at the tier's presence scale)
    if (this.buildT < 1) {
      this.buildT = Math.min(1, this.buildT + dt * 3)
      const overshoot = 1 + Math.sin(this.buildT * Math.PI) * 0.12
      this.model.scale.setScalar(clamp(this.buildT * 1.15, 0.05, 1) * overshoot * this.sizeMult)
    }

    // ambient part animation
    const crystal = getPart(this.model, 'crystal')
    if (crystal) {
      this.crystalT += dt
      crystal.rotation.y += dt * 1.5
      crystal.position.y = (crystal.userData.baseY ??= crystal.position.y) + Math.sin(this.crystalT * 2) * 0.035
    }
    const flag = getPart(this.model, 'flag')
    if (flag) flag.rotation.y = Math.sin(world.time * 2.5 + this.pos.x) * 0.22

    // ascension sigil + overcharge ring
    if (this.crownMesh) {
      this.crownMesh.rotation.y += dt * 2.2
      this.crownMesh.position.y = towerCrownHeight(this.def.model) * this.sizeMult + Math.sin(world.time * 2.4) * 0.04
    }
    if (this.chargeRing) {
      const on = this.isOvercharged(world)
      this.chargeRing.visible = on
      if (on) {
        const t = (this.overchargeUntil - world.time) / OVERCHARGE_DURATION
        this.chargeRing.scale.setScalar(this.sizeMult * (1 + Math.sin(world.time * 8) * 0.08))
        ;(this.chargeRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + t * 0.4
      }
    }

    if (this.isBarracks) {
      this.updateBarracks(dt, world)
      // Stormhowl Warcamp keeps going: its soldiers hold the road while the
      // camp itself throws. Every other barracks stops here.
      if (!this.def.damage) return
    }
    if (this.isBeacon) {
      // Crownfire: on a timer, every tower in the light is overcharged for free
      if (this.def.signature === 'kindling' && !this.isGhost) {
        if (this.kindleAt === 0) this.kindleAt = world.time + 20
        if (world.time >= this.kindleAt) {
          this.kindleAt = world.time + 20
          let lit = 0
          for (const t of world.towers) {
            if (t === this || t.isBeacon || t.isBarracks) continue
            if (Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) > this.auraReach) continue
            t.kindle(world); lit++
          }
          if (lit) {
            world.sfx('upgrade', 0.7)
            world.particles.magicImpact(this.pos.x, this.pos.y + 1.2, this.pos.z, 0xffe89f)
            world.floater(this.pos.x, this.pos.y + 1.4, this.pos.z, 'Crownfire!', 'gold')
          }
        }
      }
      return
    }

    // hexed: the perched imp silences the tower until dislodged
    if (this.hexedBy && (!this.hexedBy.alive || this.hexedBy.hexTarget !== this)) this.hexedBy = null
    if (this.hexedBy) {
      if (!this.hexRing) {
        const geo = new THREE.RingGeometry(0.4, 0.5, 32)
        geo.rotateX(-Math.PI / 2)
        const mat = new THREE.MeshBasicMaterial({ color: 0xb37aff, transparent: true, opacity: 0.65, toneMapped: false, depthWrite: false })
        this.hexRing = new THREE.Mesh(geo, mat)
        this.hexRing.position.y = 0.06
        this.hexRing.renderOrder = 3
        this.group.add(this.hexRing)
      }
      this.hexRing.visible = true
      this.hexRing.rotation.y += dt * 4
      this.hexRing.scale.setScalar(this.sizeMult * (1 + Math.sin(world.time * 6) * 0.1))
      return
    }
    if (this.hexRing) this.hexRing.visible = false

    this.cooldown -= dt
    const prevTarget = this.target
    this.acquireTarget(world)
    if (this.target !== prevTarget) this.stallT = 0
    const turret = getPart(this.model, 'turret')

    if (this.target) {
      const t = this.target
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z
      const desired = Math.atan2(dx, dz)
      // a poisoned yaw (NaN from any upstream glitch) must heal, not stall forever
      if (!Number.isFinite(this.turretYaw)) this.turretYaw = desired
      this.turretYaw = lerpAngle(this.turretYaw, desired, dt * 10)
      if (turret) turret.rotation.y = this.turretYaw
      // true angular distance, correct for any accumulated yaw winding
      let aimDiff = Math.abs(desired - this.turretYaw) % (Math.PI * 2)
      if (aimDiff > Math.PI) aimDiff = Math.PI * 2 - aimDiff
      // crystals don't swivel; point-blank foes shuffle faster than any turret tracks
      if (this.kind === 'mage' || dx * dx + dz * dz < 1.7) aimDiff = 0
      // watchdog: a ready tower staring at a live target must never stall out
      if (this.cooldown <= 0 && aimDiff >= 0.35) {
        this.stallT += dt
        if (this.stallT > 4) {
          console.warn('[blockhold] anti-stall fire', this.kind, this.def.model,
            'yaw', this.turretYaw.toFixed(2), 'want', desired.toFixed(2), 'd', Math.hypot(dx, dz).toFixed(2))
          aimDiff = 0
        }
      } else {
        this.stallT = 0
      }
      if (this.cooldown <= 0 && aimDiff < 0.35) {
        this.stallT = 0
        // overcharge and riftlight don't stack — the stronger boost wins
        const rate = (1 + Math.max(
          this.isOvercharged(world) ? OVERCHARGE_RATE_BONUS : 0,
          world.time < this.riftUntil ? 0.4 : 0))
          * (this.suppressed ? SUPPRESSED_RATE : 1)
        this.cooldown = this.def.attackInterval! / (rate * (1 + this.auraRate))
          * (this.perk?.id === 'windlass' ? 0.85 : 1)
        this.fire(t, world)
        this.recoil = 1
      }
    }
    if (turret && this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 5)
      const k = Math.sin(this.recoil * Math.PI) * 0.06
      turret.position.x = -Math.sin(this.turretYaw) * k
      turret.position.z = -Math.cos(this.turretYaw) * k
    }
  }

  /** the foe standing directly behind a target, for Kingsreach's pass-through */
  private behind(target: Enemy, world: World): Enemy | null {
    let best: Enemy | null = null
    let bestGap = Infinity
    for (const e of world.enemies) {
      if (e === target || !e.targetable) continue
      if (e.laneIndex !== target.laneIndex) continue
      const gap = e.dist - target.dist          // further from the gate = behind
      if (gap <= 0 || gap > 1.6) continue
      if (gap < bestGap) { bestGap = gap; best = e }
    }
    return best
  }

  /** one arrow with this tree's crit/poison rolls applied per-arrow */
  private fireArrowAt(target: Enemy, dmg: number, from: THREE.Vector3, world: World, allowPierce = true): void {
    const def = this.def
    let damage = dmg
    let crit = false
    if (def.special?.kind === 'crit' && simChance(def.special.chance)) {
      damage *= def.special.mult
      crit = true
    }
    // Kingsreach: a critical arrow does not stop at the first body
    if (crit && allowPierce && def.signature === 'passThrough') {
      const next = this.behind(target, world)
      if (next) this.fireArrowAt(next, dmg, from, world, false)
    }
    const poison = def.special?.kind === 'poison' && simChance(def.special.chance)
      ? { dps: def.special.dps, duration: def.special.duration }
      : undefined
    world.fireProjectile({ kind: 'arrow', from, target, damage, crit, poison, credit: this, world,
      armorPierce: this.has('enchanted') ? 0.3 : undefined })
  }

  private fire(target: Enemy, world: World, isEcho = false): void {
    const def = this.def
    // the Bellfoundry never withholds a shot; it rewards the ones that land
    // on the beat, so a defense can be arranged to ring rather than clatter
    const rang = world.isBellfoundry && onBeat(world.time)
    let dmg = randRange(...def.damage!) * world.towerDamageMult(this.kind) * this.resonanceMult
      * (this.onHighGround ? 1 + RAMPART_DAMAGE_BONUS : 1)
      * (this.isGhost ? GHOST_POWER : 1)
      * (rang ? 1 + BEAT_BONUS : 1)
    if (rang) {
      world.sfx('crit', 0.28)
      world.particles.hitSpark(this.pos.x, this.pos.y + 0.9, this.pos.z, 0xffd24a)
    }
    if (this.perk?.id === 'serrated') dmg *= 1.2
    if (this.perk?.id === 'heavybolts') dmg *= 1.2
    dmg *= 1 + this.auraDamage
    const from = this.muzzle()
    switch (this.kind) {
      case 'beacon': break   // a beacon never reaches fire(); guarded in update()
      case 'ballista': {
        // Aim through the target and out to full reach: the bolt is a line.
        const aim = new THREE.Vector3(target.pos.x, from.y, target.pos.z)
        const special = def.special
        const airMult = special?.kind === 'airbane' ? special.mult : undefined
        const knock = special?.kind === 'knockback' ? special : undefined
        // Godsbane Ram: every fourth shot loses nothing along the line
        const great = def.signature === 'greatbolt' && ++this.signatureCount >= 4
        if (great) this.signatureCount = 0
        world.fireProjectile({
          kind: 'spear', from, aim, reach: this.range + 0.6,
          damage: dmg * (great ? 2 : 1), falloff: 0.55, pierceAll: great,
          hitsAir: !!def.flying, airMult,
          armorPierce: knock?.armorPierce ?? (this.has('enchanted') ? 0.3 : undefined),
          knockback: knock?.dist,
          skyfall: def.signature === 'skyfall',
          credit: this, world,
        })
        world.sfx('arrow', great ? 1 : 0.85)
        world.particles.buildDust(from.x, from.y, from.z)
        if (great) world.particles.magicImpact(from.x, from.y + 0.2, from.z, 0xffd24a)
        break
      }
      case 'barracks': {
        // Stormhowl Warcamp: the only barracks that answers the sky. The axe
        // comes from the nearest living berserker's hand, and that berserker
        // throws it; if every one of them is down, the camp itself hurls one.
        let thrower: Soldier | null = null
        let best = Infinity
        for (const s of this.soldiers) {
          if (!s.alive) continue
          const d = Math.hypot(s.group.position.x - target.pos.x, s.group.position.z - target.pos.z)
          if (d < best) { best = d; thrower = s }
        }
        const origin = thrower ? thrower.handPos : from
        thrower?.throwAxe(target.pos)
        world.fireProjectile({
          kind: 'axe', from: origin, target, damage: dmg, credit: this, world,
          armorPierce: this.has('enchanted') ? 0.3 : undefined,
        })
        // the release is marked where it happens, so the eye is drawn to the
        // thrower's hand and not to the roof of the building
        world.particles.hitSpark(origin.x, origin.y, origin.z, 0xff8c42)
        world.sfx('arrow', 0.8)
        break
      }
      case 'arrow': {
        this.fireArrowAt(target, dmg, from, world)
        world.sfx('arrow', 0.7)
        // Crown Volley: every fifth attack showers up to 5 more foes at 65%
        if (def.signature === 'crownVolley' && ++this.signatureCount >= 5) {
          this.signatureCount = 0
          const extras: Enemy[] = []
          for (const e of world.enemies) {
            if (!e.targetable || e === target) continue
            if (e.def.flying && !def.flying) continue
            if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) > this.range + e.radius) continue
            extras.push(e)
          }
          extras.sort((a, b) => a.remaining - b.remaining)
          for (const e of extras.slice(0, 5)) this.fireArrowAt(e, dmg * 0.75, from, world)
          if (extras.length > 0) {
            world.sfx('arrow', 0.9)
            world.particles.magicImpact(from.x, from.y + 0.3, from.z, 0xffe89f)
          }
        }
        break
      }
      case 'mage': {
        const mrPierce = this.perk?.id === 'deepveil' ? 0.5 : undefined
        if (def.special?.kind === 'chain') {
          world.fireProjectile({
            kind: 'chain', from, first: target, damage: dmg,
            targets: def.special.targets, falloff: def.special.falloff,
            stunChance: def.special.stunChance, stunDur: def.special.stunDur, mrPierce, credit: this, world,
          })
        } else {
          const shred = def.special?.kind === 'armorShred' ? def.special.amount : undefined
          // The Unmaking: what it hits stops resisting anything, and a target
          // already stripped bare takes the full weight of it
          let boltDamage = dmg
          let resistShred: number | undefined
          if (def.signature === 'unmaking') {
            resistShred = shred
            if (target.armor <= 0.001 && target.magicResistNow <= 0.001) boltDamage *= 1.3
          }
          world.fireProjectile({ kind: 'bolt', from, target, damage: boltDamage, color: boltColors[def.model] ?? 0x8f5aff, armorShred: shred, resistShred, mrPierce, credit: this, world })
          world.sfx('magic', 0.7)
        }
        world.particles.magicImpact(from.x, from.y, from.z, boltColors[def.model] ?? 0x8f5aff)
        // Convergence Rune: every fifth cast anchors a pulsing rune (echoes don't count)
        if (def.signature === 'convergenceRune' && !isEcho && ++this.signatureCount >= 5) {
          this.signatureCount = 0
          addConvergenceRune(world, target.pos.x, target.pos.z, this)
        }
        // Echo Casting: chance to immediately cast again
        if (!isEcho && this.perk?.id === 'echo' && simChance(0.18)) {
          this.fire(target, world, true)
        }
        break
      }
      case 'cannon': {
        // lead the target
        const flightTime = Math.max(0.25, Math.hypot(target.pos.x - this.pos.x, target.pos.z - this.pos.z) / 6)
        const predicted = target.lane.sample(
          Math.min(target.lane.length - 0.01, target.dist + target.def.speed * flightTime * 0.85),
          target.offset,
        )
        const at = new THREE.Vector3(predicted.x, 0.02, predicted.z)
        // Emberthrone: a second shell lands a stride further down the lane, so
        // the pair leaves one long burning scar instead of a single crater
        if (def.signature === 'twinShells') {
          const second = target.lane.sample(
            Math.max(0, Math.min(target.lane.length - 0.01, target.dist - 0.9)),
            target.offset,
          )
          this.pendingTwin = new THREE.Vector3(second.x, 0.02, second.z)
        }
        const cluster = def.special?.kind === 'cluster' ? def.special : undefined
        const burn = def.special?.kind === 'burnGround' ? def.special : undefined
        const splashMult = world.splashMult() * (this.perk?.id === 'napalm' ? 1.3 : 1)
        world.fireProjectile({
          kind: 'bomb', from, at, damage: dmg, splash: def.splash! * splashMult, slow: this.has('runic'),
          cluster: cluster ? { count: cluster.count, damage: cluster.damage, radius: cluster.radius * splashMult } : undefined,
          burn: burn ? { dps: burn.dps, duration: burn.duration, radius: burn.radius * splashMult } : undefined,
          // Faultline Arsenal: every shell buries a seismic charge in the crater
          mine: def.signature === 'seismicCharge' ? {
            damage: [52 * this.resonanceMult, 78 * this.resonanceMult], radius: 0.95 * splashMult, trigger: 0.65,
            armTime: 1, life: 10, maxActive: 3,
            stunChance: this.perk?.id === 'tremor' ? 0.3 : 0,
            owner: this,
          } : undefined,
          stunChance: this.perk?.id === 'tremor' ? 0.3 : undefined,
          credit: this,
          world,
        })
        if (this.pendingTwin) {
          const twinAt = this.pendingTwin
          this.pendingTwin = null
          world.fireProjectile({
            kind: 'bomb', from, at: twinAt, damage: dmg, splash: def.splash! * splashMult, slow: this.has('runic'),
            burn: burn ? { dps: burn.dps, duration: burn.duration, radius: burn.radius * splashMult } : undefined,
            stunChance: this.perk?.id === 'tremor' ? 0.3 : undefined,
            credit: this,
            world,
          })
        }
        world.sfx('cannon', 0.85)
        world.particles.explosion(from.x + Math.sin(this.turretYaw) * 0.3, from.y + 0.12, from.z + Math.cos(this.turretYaw) * 0.3, 0.35)
        break
      }
    }
  }

  private updateBarracks(dt: number, world: World): void {
    for (const s of this.soldiers) {
      if (s.dead) {
        // Last Muster: a fallen veteran rallies two short-lived retainers
        if (!s.musterConsumed) {
          s.musterConsumed = true
          if (this.def.signature === 'lastMuster' && world.time >= this.musterReadyAt) {
            this.musterReadyAt = world.time + MUSTER_COOLDOWN
            this.lastMuster(world)
          }
        }
        s.respawnTimer += dt
        if (s.respawnTimer >= (this.def.respawnTime ?? 10)) {
          s.revive(this.doorPos())
          world.particles.healSparkle(s.group.position.x, 0.4, s.group.position.z)
        }
      }
    }
  }

  private lastMuster(world: World): void {
    // retainers honor the same soldier bonuses the panel advertises
    const hpMult = world.soldierHpMult()
      * (this.perk?.id === 'vanguard' ? 1.25 : 1)
      * (this.has('shieldwall') ? 1.18 : 1)
    const dmgMult = this.perk?.id === 'whetstone' ? 1.25 : 1
    const def = {
      ...RETAINER,
      hp: Math.round(RETAINER.hp * hpMult),
      damage: [Math.round(RETAINER.damage[0] * dmgMult), Math.round(RETAINER.damage[1] * dmgMult)] as [number, number],
    }
    for (let i = 0; i < 2; i++) {
      const spawn = this.doorPos().add(new THREE.Vector3(randRange(-0.25, 0.25), 0, randRange(0, 0.2)))
      const home = new THREE.Vector3(
        this.rallyPoint.x + randRange(-0.3, 0.3), 0, this.rallyPoint.z + randRange(-0.3, 0.3))
      const r = new Soldier(def, spawn, home)
      r.expiresAt = world.time + MUSTER_LIFETIME
      r.credit = this
      world.soldiers.push(r)
      world.dynamic.add(r.group)
      world.particles.healSparkle(spawn.x, 0.4, spawn.z)
    }
    world.sfx('reinforce', 0.8)
    world.floater(this.pos.x, this.pos.y + 1.1, this.pos.z, 'Last Muster!', 'gold')
  }
}
