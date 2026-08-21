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
import { randRange, lerpAngle, clamp } from '../core/utils.ts'

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
  cooldown = 0
  target: Enemy | null = null
  soldiers: Soldier[] = []
  rallyPoint = new THREE.Vector3()
  rallyFlag: THREE.Group | null = null
  /** count of same-family neighbors (0-2), set by Game.recomputeResonance */
  resonance = 0
  /** enemies this building (and its soldiers) has slain */
  kills = 0
  perk: PerkDef | null = null
  overchargeUntil = 0
  overchargeCdUntil = 0
  private crownMesh: THREE.Mesh | null = null
  private chargeRing: THREE.Mesh | null = null
  private turretYaw = 0
  private recoil = 0
  private buildT = 0
  private sizeMult = 1
  /** seconds spent ready-with-target but blocked by the aim gate */
  private stallT = 0
  private crystalT = Math.random() * 10

  constructor(readonly kind: TowerKind, readonly plot: PlotInfo, world: World) {
    this.group = new THREE.Group()
    this.group.position.copy(plot.pos)
    this.applyLevel(towerTrees[kind].levels[0], world, true)
  }

  get pos(): THREE.Vector3 { return this.group.position }
  get isBarracks(): boolean { return this.kind === 'barracks' }

  /** effective range including perks */
  get range(): number {
    return this.def.range + (this.perk?.id === 'hawkeye' ? 0.8 : 0)
  }

  /** resonance damage bonus from same-family neighbors */
  get resonanceMult(): number {
    return 1 + 0.06 * this.resonance
  }

  isOvercharged(world: World): boolean { return world.time < this.overchargeUntil }

  canOvercharge(world: { time: number, shards: number }): boolean {
    return !this.isBarracks && world.time >= this.overchargeCdUntil && world.shards >= OVERCHARGE_SHARD_COST
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
    return Math.round(investedGold(this.kind, this.level, this.branch) * SELL_REFUND)
  }

  private applyLevel(def: TowerLevelDef, world: World, initial = false): void {
    if (this.model) this.group.remove(this.model)
    this.def = def
    this.model = buildModel(towerModel(def.model), `tower:${def.model}`)
    this.group.add(this.model)
    this.sizeMult = TIER_SCALE[this.level - 1]
    this.buildT = 0
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
    for (const m of [this.crownMesh, this.chargeRing]) {
      if (m) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    }
    this.crownMesh = null
    this.chargeRing = null
  }

  /** live-update soldier max HP when resonance or perks change */
  refreshSoldierStats(world: World): void {
    if (!this.isBarracks || !this.def.soldier) return
    const base = this.def.soldier
    const hpMult = world.soldierHpMult()
      * (this.perk?.id === 'vanguard' ? 1.25 : 1)
      * (1 + 0.08 * this.resonance)
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
    const angle = (i / (this.def.soldierCount ?? 3)) * Math.PI * 2 + 0.6
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
      * (1 + 0.08 * this.resonance)
    const dmgMult = this.perk?.id === 'whetstone' ? 1.25 : 1
    const def = {
      ...base,
      hp: Math.round(base.hp * hpMult),
      damage: [Math.round(base.damage[0] * dmgMult), Math.round(base.damage[1] * dmgMult)] as [number, number],
    }
    for (let i = 0; i < (this.def.soldierCount ?? 3); i++) {
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

  private acquireTarget(world: World): void {
    if (this.target) {
      const t = this.target
      const inRange = t.targetable && Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) <= this.range + t.radius
      if (!inRange) this.target = null
    }
    if (this.target) return
    let best: Enemy | null = null
    let bestRemaining = Infinity
    for (const e of world.enemies) {
      if (!e.targetable) continue
      if (e.def.flying && !this.def.flying) continue
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z)
      if (d > this.range + e.radius) continue
      if (e.remaining < bestRemaining) { bestRemaining = e.remaining; best = e }
    }
    this.target = best
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
      return
    }

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
        const rate = this.isOvercharged(world) ? 1 + OVERCHARGE_RATE_BONUS : 1
        this.cooldown = this.def.attackInterval! / rate
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

  /** one arrow with this tree's crit/poison rolls applied per-arrow */
  private fireArrowAt(target: Enemy, dmg: number, from: THREE.Vector3, world: World): void {
    const def = this.def
    let damage = dmg
    let crit = false
    if (def.special?.kind === 'crit' && Math.random() < def.special.chance) {
      damage *= def.special.mult
      crit = true
    }
    const poison = def.special?.kind === 'poison' && Math.random() < def.special.chance
      ? { dps: def.special.dps, duration: def.special.duration }
      : undefined
    world.fireProjectile({ kind: 'arrow', from, target, damage, crit, poison, credit: this, world })
  }

  private fire(target: Enemy, world: World, isEcho = false): void {
    const def = this.def
    let dmg = randRange(...def.damage!) * world.towerDamageMult(this.kind) * this.resonanceMult
    if (this.perk?.id === 'serrated') dmg *= 1.2
    const from = this.muzzle()
    switch (this.kind) {
      case 'arrow': {
        this.fireArrowAt(target, dmg, from, world)
        world.sfx('arrow', 0.7)
        // Crown Volley: every fifth attack showers up to 5 more foes at 65%
        if (this.level === 5 && ++this.signatureCount >= 5) {
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
          world.fireProjectile({ kind: 'bolt', from, target, damage: dmg, color: boltColors[def.model] ?? 0x8f5aff, armorShred: shred, mrPierce, credit: this, world })
          world.sfx('magic', 0.7)
        }
        world.particles.magicImpact(from.x, from.y, from.z, boltColors[def.model] ?? 0x8f5aff)
        // Convergence Rune: every fifth cast anchors a pulsing rune (echoes don't count)
        if (this.level === 5 && !isEcho && ++this.signatureCount >= 5) {
          this.signatureCount = 0
          addConvergenceRune(world, target.pos.x, target.pos.z, this)
        }
        // Echo Casting: chance to immediately cast again
        if (!isEcho && this.perk?.id === 'echo' && Math.random() < 0.18) {
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
        const cluster = def.special?.kind === 'cluster' ? def.special : undefined
        const burn = def.special?.kind === 'burnGround' ? def.special : undefined
        const splashMult = world.splashMult() * (this.perk?.id === 'napalm' ? 1.3 : 1)
        world.fireProjectile({
          kind: 'bomb', from, at, damage: dmg, splash: def.splash! * splashMult,
          cluster: cluster ? { count: cluster.count, damage: cluster.damage, radius: cluster.radius * splashMult } : undefined,
          burn: burn ? { dps: burn.dps, duration: burn.duration, radius: burn.radius * splashMult } : undefined,
          // Faultline Arsenal: every shell buries a seismic charge in the crater
          mine: this.level === 5 ? {
            damage: [52 * this.resonanceMult, 78 * this.resonanceMult], radius: 0.95 * splashMult, trigger: 0.65,
            armTime: 1, life: 10, maxActive: 3,
            stunChance: this.perk?.id === 'tremor' ? 0.3 : 0,
            owner: this,
          } : undefined,
          stunChance: this.perk?.id === 'tremor' ? 0.3 : undefined,
          credit: this,
          world,
        })
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
          if (this.level === 5 && world.time >= this.musterReadyAt) {
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
      * (1 + 0.08 * this.resonance)
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
