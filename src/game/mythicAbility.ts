import * as THREE from 'three'
import type { Tower } from './towers.ts'
import type { Enemy } from './units.ts'
import type { World } from './world.ts'
import { MYTHIC_POWERS, type MythicPowerId } from './mythicPowers.ts'
import { detonateBurnZones } from './projectiles.ts'

const runeBox = new THREE.BoxGeometry(1, 1, 1)

/** Bounded state owned by a tower. A sell/reset disposes its one active field. */
export class MythicAbility {
  readyAt = 0
  until = 0
  kills = 0
  private nextPulse = 0
  private beganAt = 0
  private at: THREE.Vector3 | null = null
  private prey: Enemy | null = null
  private direction = new THREE.Vector2(0, 1)
  private roadDist = 0
  private visual: THREE.InstancedMesh | null = null
  private touched = new Set<Enemy>()
  private bursting = false

  constructor(private owner: Tower) {}

  state(world: World): number[] {
    if (!this.owner.def.mythicAbility) return []
    return [this.readyAt, this.until, this.kills, this.nextPulse, this.beganAt, this.at?.x ?? 0,
      this.at?.z ?? 0, this.roadDist, this.direction.x, this.direction.y, this.prey ? world.enemies.indexOf(this.prey) : -1,
      ...world.enemies.map(e => this.touched.has(e) ? 1 : 0)]
  }

  readout(time: number): { text: string, next: boolean } | null {
    const id = this.owner.def.mythicAbility
    if (!id) return null
    const power = MYTHIC_POWERS[id]
    if (this.at && time < this.until) return { text: `${power.name} · active`, next: true }
    if (id === 'warDividend') return { text: `${power.name} · ${this.kills}/20 kills${this.readyAt > time ? ` · ${Math.ceil(this.readyAt - time)}s` : ''}`, next: this.kills >= 18 && this.readyAt <= time }
    const left = Math.max(0, this.readyAt - time)
    return { text: left > 0 ? `${power.name} in ${Math.ceil(left)}s` : `${power.name} ready`, next: left < 3 }
  }

  update(dt: number, world: World): void {
    const id = this.owner.def.mythicAbility
    if (!id || this.owner.isGhost) return
    if (this.at && world.time >= this.until) this.clearField()
    if (this.at) this.updateField(id, dt, world)
    if (this.owner.hexedBy?.alive) return
    if (id === 'warDividend') {
      if (this.kills >= 20 && world.time >= this.readyAt) {
        this.kills = 0
        this.readyAt = world.time + MYTHIC_POWERS[id].cooldown
        world.rewardMythicReserve?.(5)
        this.announce(id, world, this.owner.pos)
      }
      return
    }
    if (!this.readyAt) this.readyAt = world.time + 2
    if (world.time < this.readyAt || this.at) return
    const range = this.owner.isBeacon ? Infinity : this.owner.range
    const enemies = world.enemies.filter(e => e.alive && (e.targetable || ['nullZone', 'vortex', 'worldtide'].includes(id))
      && Math.hypot(e.pos.x - this.owner.pos.x, e.pos.z - this.owner.pos.z) <= range + e.radius
      && (this.owner.isBeacon || !world.sightBlocked(this.owner.pos.x, this.owner.pos.z, this.owner.footing, e.pos.x, e.pos.z))
      && (id !== 'gravityNet' || e.airborne)
      && (!['ignition', 'faultline', 'worldtide', 'absoluteZero', 'bloodOath'].includes(id) || !e.airborne))
    if (!enemies.length) return
    const strongest = ['deathmark', 'nullZone'].includes(id)
    enemies.sort((a, b) => strongest ? b.hp - a.hp || a.remaining - b.remaining : a.remaining - b.remaining)
    this.readyAt = world.time + MYTHIC_POWERS[id].cooldown
    if (id === 'ignition') {
      if (!detonateBurnZones(world, this.owner)) { this.readyAt = world.time + 1; return }
      this.announce(id, world, this.owner.pos)
      return
    }
    if (id === 'dawnRelay') {
      for (const t of world.towers) if (!t.isBeacon && !t.isBarracks && !t.isGhost) t.kindle(world)
      for (const s of world.soldiers) if (s.alive) {
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * .35)
        world.particles.healSparkle(s.group.position.x, s.group.position.y + .5, s.group.position.z)
      }
      this.announce(id, world, this.owner.pos)
      return
    }
    this.prey = enemies[0]
    this.at = id === 'bloodOath' ? this.owner.rallyPoint.clone() : this.prey.pos.clone()
    this.roadDist = this.prey.dist
    this.direction.set(this.prey.pos.x - this.owner.pos.x, this.prey.pos.z - this.owner.pos.z).normalize()
    if (id === 'breach') {
      if (this.owner.holdLine) this.direction.set(this.owner.holdLine.x, this.owner.holdLine.z)
      this.at.copy(this.owner.pos).add(new THREE.Vector3(this.direction.x * 3, 0, this.direction.y * 3))
    }
    this.beganAt = this.nextPulse = world.time
    this.until = world.time + MYTHIC_POWERS[id].duration
    this.makeVisual(id, world)
    this.announce(id, world, this.at)
    this.updateField(id, dt, world)
  }

  onKill(e: Enemy, world: World): void {
    const id = this.owner.def.mythicAbility
    if (this.owner.isGhost) return
    if (id === 'warDividend' && !e.noReward && Math.hypot(e.pos.x - this.owner.pos.x, e.pos.z - this.owner.pos.z) <= this.owner.auraReach)
      this.kills = Math.min(20, this.kills + 1)
    // The first grove poisons the pack; a burst propagates poison, not another
    // death-burst tag. This bounds work and prevents recursive detonation chains.
    if (id !== 'venomBloom' || !this.at || world.time >= this.until || this.bursting || !this.touched.has(e)) return
    this.bursting = true
    for (const other of world.enemies) {
      if (other === e || !other.targetable || Math.hypot(other.pos.x - e.pos.x, other.pos.z - e.pos.z) > 1.3 + other.radius) continue
      other.takeDamage(160, 'true', world, { credit: this.owner, silent: true })
      if (other.alive) other.applyPoison(85, 4, world, this.owner)
    }
    this.bursting = false
    world.particles.magicImpact(e.pos.x, e.pos.y + .3, e.pos.z, MYTHIC_POWERS.venomBloom.color)
  }

  private updateField(id: MythicPowerId, dt: number, world: World): void {
    const at = this.at!, power = MYTHIC_POWERS[id]
    if (id === 'deathmark') {
      if (!this.prey?.alive) { this.clearField(); return }
      at.copy(this.prey.pos)
    } else if (id === 'worldtide' && this.prey) {
      const p = this.prey.lane.sample(Math.min(this.prey.lane.length, this.roadDist + (world.time - this.beganAt) * 1.5), this.prey.offset)
      at.set(p.x, 0, p.z)
    }
    const pulse = world.time + 1e-6 >= this.nextPulse
    if (pulse) this.nextPulse += 1
    const hold = Math.min(this.until, world.time + dt + .02)
    if (id === 'bloodOath') {
      for (const s of world.soldiers) if (s.alive && Math.hypot(s.group.position.x - at.x, s.group.position.z - at.z) <= power.radius)
        s.oathUntil = Math.max(s.oathUntil, hold)
    } else for (const e of world.enemies) {
      if (!e.alive || id === 'deathmark' && e !== this.prey) continue
      const dx = e.pos.x - at.x, dz = e.pos.z - at.z
      const inside = id === 'breach'
        ? Math.abs(dx * this.direction.x + dz * this.direction.y) <= 3 + e.radius && Math.abs(dx * this.direction.y - dz * this.direction.x) <= .7 + e.radius
        : Math.hypot(dx, dz) <= power.radius + e.radius
      if (!inside || ['faultline', 'absoluteZero', 'worldtide'].includes(id) && e.airborne) continue
      if (['nullZone', 'vortex', 'worldtide', 'gravityNet'].includes(id)) {
        e.revealedUntil = Math.max(e.revealedUntil, hold)
        e.revealed = true
      }
      if (!e.targetable) continue
      if (id === 'deathmark' || id === 'worldtide') e.markedUntil = Math.max(e.markedUntil, hold)
      if (id === 'deathmark' || id === 'nullZone') e.healBlockedUntil = Math.max(e.healBlockedUntil, hold)
      if (id === 'nullZone') e.nullifiedUntil = Math.max(e.nullifiedUntil, hold)
      if (['faultline', 'breach', 'absoluteZero'].includes(id)) e.brittleUntil = Math.max(e.brittleUntil, hold)
      if (id === 'breach') e.wardBrokenUntil = Math.max(e.wardBrokenUntil, hold)
      if (pulse) {
        if (id === 'venomBloom') { e.applyPoison(85, 4, world, this.owner); e.applySlow(.65, 1.2, world) }
        if (id === 'vortex') {
          if (!e.def.boss) {
            const center = e.lane.closestDistance(at.x, at.z)
            e.dist += Math.max(-.7, Math.min(.7, center - e.dist))
          }
          e.applySlow(.55, 1.2, world)
        }
        if (id === 'gravityNet' && e.def.flying) e.ground(1.25, world)
        if (id === 'absoluteZero') e.applyStun(.65, world)
        if (id === 'faultline') e.applySlow(.55, 1.2, world)
        if (!this.touched.has(e) && ['faultline', 'breach', 'worldtide'].includes(id)) e.shove(id === 'worldtide' ? .65 : 1.2)
      }
      if (pulse) this.touched.add(e)
    }
    if (this.visual) {
      this.visual.position.set(at.x, world.groundY(at.x, at.z) + .065, at.z)
      const fade = Math.max(0, Math.min(1, (world.time - this.beganAt) / .2, (this.until - world.time) / .4))
      ;(this.visual.material as THREE.MeshBasicMaterial).opacity = fade * (.5 + .08 * Math.sin(world.time * 3))
    }
  }

  private announce(id: MythicPowerId, world: World, at: THREE.Vector3): void {
    world.floater(at.x, world.groundY(at.x, at.z) + .9, at.z, MYTHIC_POWERS[id].name, 'gold')
    world.particles.magicImpact(at.x, at.y + .25, at.z, MYTHIC_POWERS[id].color)
    world.sfx('signature', .5)
  }

  private makeVisual(id: MythicPowerId, world: World): void {
    const power = MYTHIC_POWERS[id]
    this.visual = new THREE.InstancedMesh(runeBox, new THREE.MeshBasicMaterial({ color: power.color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), 32)
    this.visual.name = `mythic-${id}`
    const pose = new THREE.Object3D()
    for (let i = 0; i < 32; i++) {
      const angle = i / 32 * Math.PI * 2
      let x = Math.round(Math.sin(angle) * power.radius * 8) / 8, z = Math.round(Math.cos(angle) * power.radius * 8) / 8
      if (id === 'breach') {
        const along = (i % 16) / 15 * 6 - 3, across = i < 16 ? -.7 : .7
        x = this.direction.x * along - this.direction.y * across
        z = this.direction.y * along + this.direction.x * across
      }
      pose.position.set(x, 0, z); pose.scale.set(.16, .045, .16); pose.updateMatrix()
      this.visual.setMatrixAt(i, pose.matrix)
    }
    this.visual.instanceMatrix.needsUpdate = true
    this.visual.frustumCulled = false
    world.dynamic.add(this.visual)
  }

  clearField(): void {
    if (this.visual) {
      this.visual.removeFromParent()
      this.visual.dispose()
      ;(this.visual.material as THREE.Material).dispose()
      this.visual = null
    }
    this.at = null; this.prey = null; this.touched.clear()
  }
}
