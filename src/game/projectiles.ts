import * as THREE from 'three'
import { World, ProjectileSpec, KillCredit } from './world.ts'
import { Enemy, Soldier } from './units.ts'
import { buildModel } from '../voxel/builder.ts'
import * as env from '../voxel/models_env.ts'
import { randRange } from '../core/utils.ts'

export interface Projectile {
  mesh: THREE.Object3D
  done: boolean
  update(dt: number): void
  /** release instance-owned GPU resources (cached/shared ones stay) */
  dispose?(): void
}

/** ballistic hop from A to B over a fixed flight time, arcing */
abstract class Ballistic implements Projectile {
  mesh: THREE.Object3D
  done = false
  protected t = 0
  protected from: THREE.Vector3
  protected flightTime: number

  constructor(mesh: THREE.Object3D, from: THREE.Vector3, dist: number, speed: number, protected arc: number) {
    this.mesh = mesh
    this.from = from.clone()
    this.flightTime = Math.max(0.12, dist / speed)
    mesh.position.copy(from)
  }

  protected abstract targetPos(): THREE.Vector3
  protected abstract impact(): void

  update(dt: number): void {
    this.t += dt / this.flightTime
    if (this.t >= 1) {
      this.done = true
      this.impact()
      return
    }
    const to = this.targetPos()
    const p = this.from.clone().lerp(to, this.t)
    p.y += Math.sin(this.t * Math.PI) * this.arc
    // face along velocity
    const next = this.from.clone().lerp(to, Math.min(1, this.t + 0.05))
    next.y += Math.sin(Math.min(1, this.t + 0.05) * Math.PI) * this.arc
    this.mesh.position.copy(p)
    this.mesh.lookAt(next)
  }
}

class ArrowProjectile extends Ballistic {
  constructor(private spec: Extract<ProjectileSpec, { kind: 'arrow' }>) {
    super(
      buildModel(env.arrowProjectile(), 'proj:arrow', { castShadow: false }),
      spec.from,
      spec.from.distanceTo(spec.target.pos),
      9,
      spec.crit ? 0.35 : 0.25,
    )
  }
  protected targetPos(): THREE.Vector3 {
    const t = this.spec.target
    return t.state !== 'gone' ? t.pos.clone().setY(t.pos.y + 0.35) : this.mesh.position.clone()
  }
  protected impact(): void {
    const { target, world, damage, crit, poison, credit } = this.spec
    if (target.alive) {
      const dealt = target.takeDamage(damage, 'physical', world, { crit, credit })
      if (dealt > 0 && poison) target.applyPoison(poison.dps, poison.duration, world, credit)
      if (dealt > 0) {
        world.particles.hitSpark(target.pos.x, target.pos.y + 0.4, target.pos.z)
        world.sfx('hit', 0.5)
      }
    }
  }
}

class BoltProjectile implements Projectile {
  mesh: THREE.Object3D
  done = false
  private pos: THREE.Vector3
  constructor(private spec: Extract<ProjectileSpec, { kind: 'bolt' }>) {
    this.mesh = buildModel(env.boltProjectile(spec.color), `proj:bolt:${spec.color}`, { castShadow: false })
    this.pos = spec.from.clone()
    this.mesh.position.copy(this.pos)
  }
  update(dt: number): void {
    const { target, world } = this.spec
    const to = target.state !== 'gone'
      ? target.pos.clone().setY(target.pos.y + 0.35)
      : this.pos.clone().add(new THREE.Vector3(0, -1, 0))
    const d = this.pos.distanceTo(to)
    const step = 7.5 * dt
    world.particles.trail(this.pos.x, this.pos.y, this.pos.z, this.spec.color, 0.22)
    if (d <= step) {
      this.done = true
      if (target.alive) {
        const dealt = target.takeDamage(this.spec.damage, 'magic', world, { mrPierce: this.spec.mrPierce, credit: this.spec.credit })
        if (dealt > 0) {
          if (this.spec.armorShred) target.shredArmor(this.spec.armorShred)
          world.particles.magicImpact(to.x, to.y, to.z, this.spec.color)
          world.sfx('hit', 0.4)
        }
      }
      return
    }
    this.pos.lerp(to, step / d)
    this.mesh.position.copy(this.pos)
    this.mesh.lookAt(to)
  }
}

class BombProjectile extends Ballistic {
  constructor(private spec: Extract<ProjectileSpec, { kind: 'bomb' }>, arcOverride?: number, speed = 6) {
    super(
      buildModel(env.bombProjectile(), 'proj:bomb', { castShadow: false }),
      spec.from,
      spec.from.distanceTo(spec.at),
      speed,
      arcOverride ?? 0.9,
    )
  }
  protected targetPos(): THREE.Vector3 { return this.spec.at }
  update(dt: number): void {
    super.update(dt)
    if (!this.done) {
      this.mesh.rotation.x += dt * 6
      this.spec.world.particles.smokeTrail(this.mesh.position.x, this.mesh.position.y + 0.1, this.mesh.position.z)
    }
  }
  protected impact(): void {
    const { at, world, damage, splash, cluster, burn, stunChance, credit } = this.spec
    explode(world, at, damage, splash, stunChance, credit)
    if (cluster) {
      for (let i = 0; i < cluster.count; i++) {
        const angle = Math.random() * Math.PI * 2
        const r = 0.45 + Math.random() * 0.7
        const to = at.clone().add(new THREE.Vector3(Math.sin(angle) * r, 0, Math.cos(angle) * r))
        world.fireProjectile({
          kind: 'bomb',
          from: at.clone().setY(at.y + 0.25),
          at: to,
          damage: randRange(...cluster.damage),
          splash: cluster.radius,
          credit,
          world,
        })
      }
    }
    if (burn) {
      addBurnZone(world, at, burn.radius, burn.dps, burn.duration, credit)
    }
  }
}

function explode(world: World, at: THREE.Vector3, damage: number, splash: number, stunChance = 0, credit?: KillCredit): void {
  world.particles.explosion(at.x, at.y + 0.15, at.z, Math.max(0.7, splash))
  world.sfx('explosion', 0.8)
  world.shake(0.05 + splash * 0.05)
  for (const e of world.enemies) {
    if (!e.targetable || e.def.flying) continue
    const d = e.pos.distanceTo(at)
    if (d <= splash + e.radius) {
      const falloff = 1 - 0.5 * (d / (splash + e.radius))
      const dealt = e.takeDamage(damage * falloff, 'physical', world, { credit })
      if (dealt > 0 && stunChance > 0 && Math.random() < stunChance) e.applyStun(0.5, world)
    }
  }
}

class WarlockBolt implements Projectile {
  mesh: THREE.Object3D
  done = false
  private pos: THREE.Vector3
  constructor(private spec: Extract<ProjectileSpec, { kind: 'warlockBolt' }>) {
    this.mesh = buildModel(env.boltProjectile(0xff4f6b), 'proj:bolt:warlock', { castShadow: false })
    this.mesh.scale.setScalar(0.8)
    this.pos = spec.from.clone()
    this.mesh.position.copy(this.pos)
  }
  update(dt: number): void {
    const { target, world, damage } = this.spec
    const to = target.group.position.clone().setY(0.35)
    const d = this.pos.distanceTo(to)
    const step = 5.5 * dt
    world.particles.trail(this.pos.x, this.pos.y, this.pos.z, 0xff4f6b, 0.18)
    if (d <= step) {
      this.done = true
      if (target.alive) target.takeDamage(damage, world)
      world.particles.magicImpact(to.x, to.y, to.z, 0xff4f6b)
      return
    }
    this.pos.lerp(to, step / d)
    this.mesh.position.copy(this.pos)
  }
}

/** instant chain lightning: applies damage now, draws fading jagged bolts */
class ChainLightning implements Projectile {
  mesh: THREE.Group
  done = false
  private life = 0.22
  constructor(spec: Extract<ProjectileSpec, { kind: 'chain' }>) {
    this.mesh = new THREE.Group()
    const { world } = spec
    const hits: Enemy[] = [spec.first]
    let damage = spec.damage
    // gather chain targets by proximity
    while (hits.length < spec.targets) {
      const last = hits[hits.length - 1]
      let next: Enemy | null = null
      let bestD = 1.6
      for (const e of world.enemies) {
        if (!e.targetable || hits.includes(e)) continue
        const d = e.pos.distanceTo(last.pos)
        if (d < bestD) { bestD = d; next = e }
      }
      if (!next) break
      hits.push(next)
    }
    let from = spec.from
    for (const e of hits) {
      const to = e.pos.clone().setY(e.pos.y + 0.35)
      this.mesh.add(makeLightningMesh(from, to))
      const dealt = e.takeDamage(damage, 'magic', world, { mrPierce: spec.mrPierce, credit: spec.credit })
      if (dealt > 0 && Math.random() < spec.stunChance) e.applyStun(spec.stunDur, world)
      world.particles.magicImpact(to.x, to.y, to.z, 0x9fe8ff)
      damage *= spec.falloff
      from = to
    }
    world.sfx('lightning', 0.8)
  }
  update(dt: number): void {
    this.life -= dt
    if (this.life <= 0) { this.done = true; return }
    this.mesh.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) {
        o.material.opacity = this.life / 0.22
      }
    })
  }

  dispose(): void {
    this.mesh.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
  }
}

function makeLightningMesh(from: THREE.Vector3, to: THREE.Vector3): THREE.Group {
  const g = new THREE.Group()
  const segs = 5
  let prev = from.clone()
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const p = from.clone().lerp(to, t)
    if (i < segs) {
      p.x += (Math.random() - 0.5) * 0.18
      p.y += (Math.random() - 0.5) * 0.18
      p.z += (Math.random() - 0.5) * 0.18
    }
    const len = prev.distanceTo(p)
    const geo = new THREE.BoxGeometry(0.045, 0.045, len)
    const mat = new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, toneMapped: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(prev.clone().lerp(p, 0.5))
    mesh.lookAt(p)
    g.add(mesh)
    prev = p
  }
  return g
}

class Meteor implements Projectile {
  mesh: THREE.Object3D
  done = false
  private vel: THREE.Vector3
  constructor(private spec: Extract<ProjectileSpec, { kind: 'meteor' }>) {
    this.mesh = buildModel(env.meteorProjectile(), 'proj:meteor', { castShadow: false })
    const at = spec.at
    this.mesh.position.set(at.x + randRange(-1.5, 1.5), 6.5, at.z + randRange(1.0, 2.2))
    this.vel = at.clone().sub(this.mesh.position).normalize().multiplyScalar(11)
  }
  update(dt: number): void {
    const { world, at, damage } = this.spec
    this.mesh.position.addScaledVector(this.vel, dt)
    this.mesh.rotation.x += dt * 5
    this.mesh.rotation.y += dt * 3
    world.particles.trail(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z, 0xff8c42, 0.5)
    world.particles.smokeTrail(this.mesh.position.x, this.mesh.position.y + 0.2, this.mesh.position.z)
    if (this.mesh.position.y <= 0.1) {
      this.done = true
      world.particles.explosion(at.x, 0.15, at.z, 1.4)
      world.sfx('explosion', 1)
      world.shake(0.22)
      for (const e of world.enemies) {
        if (!e.targetable) continue
        const d = Math.hypot(e.pos.x - this.mesh.position.x, e.pos.z - this.mesh.position.z)
        if (d < 1.15) {
          const dealt = e.takeDamage(damage, 'true', world)
          if (dealt > 0) e.applyStun(0.6, world)
        }
      }
    }
  }
}

export function createProjectile(spec: ProjectileSpec): Projectile {
  switch (spec.kind) {
    case 'arrow': return new ArrowProjectile(spec)
    case 'bolt': return new BoltProjectile(spec)
    case 'bomb': return new BombProjectile(spec)
    case 'chain': return new ChainLightning(spec)
    case 'warlockBolt': return new WarlockBolt(spec)
    case 'meteor': return new Meteor(spec)
  }
}

// ---------------- burn zones ----------------

export interface BurnZone {
  mesh: THREE.Mesh
  pos: THREE.Vector3
  radius: number
  dps: number
  until: number
  done: boolean
  credit?: KillCredit
}

const burnZones: BurnZone[] = []

export function addBurnZone(world: World, at: THREE.Vector3, radius: number, dps: number, duration: number, credit?: KillCredit): void {
  const geo = new THREE.CircleGeometry(radius, 24)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({ color: 0xff6a2f, transparent: true, opacity: 0.4, toneMapped: false, depthWrite: false })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(at.x, 0.04, at.z)
  mesh.renderOrder = 2
  world.dynamic.add(mesh)
  burnZones.push({ mesh, pos: at.clone(), radius, dps, until: world.time + duration, done: false, credit })
}

export function updateBurnZones(dt: number, world: World): void {
  for (const z of burnZones) {
    if (z.done) continue
    if (world.time > z.until) {
      z.done = true
      world.dynamic.remove(z.mesh)
      z.mesh.geometry.dispose()
      ;(z.mesh.material as THREE.Material).dispose()
      continue
    }
    const mat = z.mesh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.25 + Math.sin(world.time * 6) * 0.1
    if (Math.random() < dt * 20) {
      world.particles.burnEmber(
        z.pos.x + (Math.random() - 0.5) * z.radius * 1.6,
        0.05,
        z.pos.z + (Math.random() - 0.5) * z.radius * 1.6,
      )
    }
    for (const e of world.enemies) {
      if (!e.alive || e.def.flying) continue
      if (Math.hypot(e.pos.x - z.pos.x, e.pos.z - z.pos.z) < z.radius + e.radius) {
        e.takeDamage(z.dps * dt, 'true', world, { silent: true, credit: z.credit })
      }
    }
  }
  // periodic cleanup
  if (burnZones.length > 32) {
    for (let i = burnZones.length - 1; i >= 0; i--) {
      if (burnZones[i].done) burnZones.splice(i, 1)
    }
  }
}

export function clearBurnZones(world: World): void {
  for (const z of burnZones) {
    if (!z.done) {
      world.dynamic.remove(z.mesh)
      z.mesh.geometry.dispose()
      ;(z.mesh.material as THREE.Material).dispose()
    }
  }
  burnZones.length = 0
}
