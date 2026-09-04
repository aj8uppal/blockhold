import * as THREE from 'three'
import { World, ProjectileSpec, KillCredit, MineSpec } from './world.ts'
import { Enemy, Soldier } from './units.ts'
import { buildModel } from '../voxel/builder.ts'
import * as env from '../voxel/models_env.ts'
import { randRange, simChance, simRandom } from '../core/utils.ts'

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
    const { target, world, damage, crit, poison, credit, armorPierce } = this.spec
    if (target.alive) {
      const dealt = target.takeDamage(damage, 'physical', world, { crit, credit, armorPierce })
      if (dealt > 0 && poison) target.applyPoison(poison.dps, poison.duration, world, credit)
      if (dealt > 0) {
        world.particles.hitSpark(target.pos.x, target.pos.y + 0.4, target.pos.z)
        world.sfx('hit', 0.5)
      }
    } else {
      // The target died while this was in the air. The arrow already flies on to
      // where it was aimed rather than blinking out - but it used to arrive at
      // nothing and simply disappear, so a volley loosed at a dying enemy ended
      // in silence. It lands: a spark in the dirt and a quieter thud.
      const p = this.mesh.position
      world.particles.hitSpark(p.x, p.y, p.z)
      world.sfx('hit', 0.22)
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
          if (this.spec.resistShred) target.shredResist(this.spec.resistShred)
          world.particles.magicImpact(to.x, to.y, to.z, this.spec.color)
          world.sfx('hit', 0.4)
        }
      } else {
        // outlived its target: the bolt still breaks where it was aimed
        world.particles.magicImpact(to.x, to.y, to.z, this.spec.color)
        world.sfx('hit', 0.18)
      }
      return
    }
    this.pos.lerp(to, step / d)
    this.mesh.position.copy(this.pos)
    this.mesh.lookAt(to)
  }
}

/**
 * A Stormhowl's axe.
 *
 * The Warcamp's whole promise is "the only barracks that can touch a flyer",
 * and for a long time the thing it threw was an arrow: the capstone's one
 * visible idea was invisible. This is the axe. It leaves a soldier's hand,
 * arcs high because it is thrown rather than shot, and tumbles end over end
 * the whole way, which is the one motion that reads as "thrown axe" from any
 * distance.
 */
class AxeProjectile extends Ballistic {
  private spin = 0
  constructor(private spec: Extract<ProjectileSpec, { kind: 'axe' }>) {
    super(
      buildModel(env.axeProjectile(), 'proj:axe', { castShadow: false }),
      spec.from,
      spec.from.distanceTo(spec.target.pos),
      7.5,
      0.7,
    )
  }
  protected targetPos(): THREE.Vector3 {
    const t = this.spec.target
    return t.state !== 'gone' ? t.pos.clone().setY(t.pos.y + 0.3) : this.mesh.position.clone()
  }
  update(dt: number): void {
    super.update(dt)
    if (this.done) return
    // Ballistic.update re-aims the haft along the flight every frame with
    // lookAt, so the accumulated tumble is re-applied on top of that aim
    this.spin += dt * 16
    this.mesh.rotateX(this.spin)
  }
  protected impact(): void {
    const { target, world, damage, credit, armorPierce } = this.spec
    if (target.alive) {
      const dealt = target.takeDamage(damage, 'physical', world, { credit, armorPierce })
      if (dealt > 0) {
        world.particles.hitSpark(target.pos.x, target.pos.y + 0.4, target.pos.z, 0xd8452f)
        world.sfx('hit', 0.6)
      }
    } else {
      const p = this.mesh.position
      world.particles.hitSpark(p.x, p.y, p.z)
      world.sfx('hit', 0.2)
    }
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
    explode(world, at, damage, splash, stunChance, credit, this.spec.slow, !!this.spec.submunition)
    if (cluster) {
      for (let i = 0; i < cluster.count; i++) {
        const angle = simRandom() * Math.PI * 2
        const r = 0.45 + simRandom() * 0.7
        const to = at.clone().add(new THREE.Vector3(Math.sin(angle) * r, 0, Math.cos(angle) * r))
        world.fireProjectile({
          kind: 'bomb',
          from: at.clone().setY(at.y + 0.25),
          at: to,
          damage: randRange(...cluster.damage),
          splash: cluster.radius,
          submunition: true,
          credit,
          world,
        })
      }
    }
    if (burn) {
      addBurnZone(world, at, burn.radius, burn.dps, burn.duration, credit)
    }
    if (this.spec.mine) {
      addMine(world, at, this.spec.mine)
    }
  }
}

function explode(
  world: World, at: THREE.Vector3, damage: number, splash: number,
  stunChance = 0, credit?: KillCredit, slow = false, submunition = false,
): void {
  world.particles.explosion(at.x, at.y + 0.15, at.z, Math.max(submunition ? 0.45 : 0.7, splash))
  world.sfx('explosion', submunition ? 0.4 : 0.8)
  // A cluster shell bursts into five of these at once. Letting each one take a
  // heavy impact hold and a full shake stacked five holds on one frame, which
  // is exactly the hitch that made cluster bombards feel like they lagged.
  if (submunition) return
  world.shake(0.05 + splash * 0.05)
  if (splash >= 0.6) world.impact('heavy')
  for (const e of world.enemies) {
    if (!e.targetable || e.def.flying) continue
    const d = e.pos.distanceTo(at)
    if (d <= splash + e.radius) {
      const falloff = 1 - 0.5 * (d / (splash + e.radius))
      const dealt = e.takeDamage(damage * falloff, 'physical', world, { credit })
      if (dealt > 0 && stunChance > 0 && simChance(stunChance)) e.applyStun(0.5, world)
      if (dealt > 0 && slow) e.applySlow(0.6, 1.5, world)
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
      if (dealt > 0 && simChance(spec.stunChance)) e.applyStun(spec.stunDur, world)
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

/**
 * A ballista bolt.
 *
 * Every other projectile in the game resolves at a point: an arrow at its
 * target, a shell at a spot on the ground. This one resolves along a line. It
 * flies straight from the muzzle through where it was aimed and on to the
 * tower's full reach, and anything whose body it passes through is struck -
 * once, the first at full weight and the rest at `falloff`. That is what makes
 * a ballista's placement a question of *direction*: the same plot is worthless
 * across a road and superb along one.
 */
class SpearProjectile implements Projectile {
  mesh: THREE.Object3D
  done = false
  private pos: THREE.Vector3
  private dir: THREE.Vector3
  private travelled = 0
  private hits = 0
  private struck = new Set<Enemy>()
  private static readonly SPEED = 14
  private static readonly HIT_RADIUS = 0.42

  constructor(private spec: Extract<ProjectileSpec, { kind: 'spear' }>) {
    this.mesh = buildModel(env.spearProjectile(spec.pierceAll ? 0xffd24a : 0xc8cdd6), `proj:spear:${spec.pierceAll ? 'great' : 'bolt'}`, { castShadow: false })
    this.pos = spec.from.clone()
    this.dir = spec.aim.clone().sub(spec.from)
    this.dir.y = 0
    if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1)
    this.dir.normalize()
    this.mesh.position.copy(this.pos)
    this.mesh.lookAt(this.pos.clone().add(this.dir))
  }

  update(dt: number): void {
    const { world } = this.spec
    const step = SpearProjectile.SPEED * dt
    const next = this.pos.clone().addScaledVector(this.dir, step)
    // sweep the segment we just crossed, so a fast bolt cannot skip a body
    for (const e of world.enemies) {
      if (!e.targetable || this.struck.has(e)) continue
      if (e.def.flying && !this.spec.hitsAir) continue
      const d = distToSegmentXZ(e.pos, this.pos, next)
      if (d > SpearProjectile.HIT_RADIUS + e.radius) continue
      this.strike(e)
    }
    this.pos.copy(next)
    this.travelled += step
    this.mesh.position.copy(this.pos)
    if (this.travelled >= this.spec.reach) {
      this.done = true
      // it lands somewhere: a bolt that hit nothing still thuds into the dirt
      if (this.hits === 0) {
        world.particles.hitSpark(this.pos.x, 0.05, this.pos.z)
        world.sfx('hit', 0.18)
      }
    }
  }

  private strike(e: Enemy): void {
    const { world, credit, armorPierce } = this.spec
    this.struck.add(e)
    const order = this.hits++
    let dmg = this.spec.damage * (this.spec.pierceAll || order === 0 ? 1 : Math.pow(this.spec.falloff, order))
    if (e.def.flying && this.spec.airMult) dmg *= this.spec.airMult
    const dealt = e.takeDamage(dmg, 'physical', world, { credit, armorPierce })
    if (dealt <= 0) return
    world.particles.hitSpark(e.pos.x, e.pos.y + 0.4, e.pos.z)
    world.sfx('hit', order === 0 ? 0.6 : 0.35)
    if (this.spec.knockback) {
      e.shove(this.spec.knockback)
      world.particles.buildDust(e.pos.x, e.pos.y + 0.1, e.pos.z)
    }
    // Heavensplitter: a flyer struck is knocked out of the air
    if (this.spec.skyfall && e.def.flying && e.alive) {
      e.applyStun(1.5, world)
    }
  }

  dispose(): void { /* the mesh is a cached model; nothing instance-owned */ }
}

/** distance from a point to a segment, on the ground plane */
function distToSegmentXZ(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number {
  const abx = b.x - a.x, abz = b.z - a.z
  const apx = p.x - a.x, apz = p.z - a.z
  const len2 = abx * abx + abz * abz
  const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / len2)) : 0
  const cx = a.x + abx * t, cz = a.z + abz * t
  return Math.hypot(p.x - cx, p.z - cz)
}

export function createProjectile(spec: ProjectileSpec): Projectile {
  switch (spec.kind) {
    case 'arrow': return new ArrowProjectile(spec)
    case 'bolt': return new BoltProjectile(spec)
    case 'bomb': return new BombProjectile(spec)
    case 'chain': return new ChainLightning(spec)
    case 'warlockBolt': return new WarlockBolt(spec)
    case 'meteor': return new Meteor(spec)
    case 'spear': return new SpearProjectile(spec)
    case 'axe': return new AxeProjectile(spec)
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

function removeBurnZone(world: World, z: BurnZone): void {
  z.done = true
  world.dynamic.remove(z.mesh)
  z.mesh.geometry.dispose()
  ;(z.mesh.material as THREE.Material).dispose()
}

export function addBurnZone(world: World, at: THREE.Vector3, radius: number, dps: number, duration: number, credit?: KillCredit): void {
  // per-tower cap: overcharged mortars must not layer unbounded true DPS on a choke
  if (credit) {
    const own = burnZones.filter(z => !z.done && z.credit === credit)
    if (own.length >= 3) removeBurnZone(world, own[0])
  }
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
      removeBurnZone(world, z)
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
    if (!z.done) removeBurnZone(world, z)
  }
  burnZones.length = 0
}

/** a sold tower takes its buried charges, runes, and burning ground with it */
export function clearOwnedEffects(world: World, owner: KillCredit): void {
  for (const m of mines) { if (!m.done && m.spec.owner === owner) removeMine(world, m) }
  for (const r of runes) { if (!r.done && r.owner === owner) removeRune(world, r) }
  for (const z of burnZones) { if (!z.done && z.credit === owner) removeBurnZone(world, z) }
}

// ---------------- seismic charges (cannon capstone) ----------------

interface Mine {
  mesh: THREE.Mesh
  pos: THREE.Vector3
  spec: MineSpec
  armedAt: number
  until: number
  done: boolean
}

const mines: Mine[] = []

function removeMine(world: World, m: Mine): void {
  m.done = true
  world.dynamic.remove(m.mesh)
  m.mesh.geometry.dispose()
  ;(m.mesh.material as THREE.Material).dispose()
}

export function addMine(world: World, at: THREE.Vector3, spec: MineSpec): void {
  // per-tower cap: planting beyond it defuses the oldest quietly
  const own = mines.filter(m => !m.done && m.spec.owner === spec.owner)
  if (own.length >= spec.maxActive) removeMine(world, own[0])
  const geo = new THREE.BoxGeometry(0.26, 0.12, 0.26)
  const mat = new THREE.MeshBasicMaterial({ color: 0x3a2d24, toneMapped: false })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(at.x, 0.06, at.z)
  mesh.rotation.y = Math.random() * Math.PI
  world.dynamic.add(mesh)
  mines.push({ mesh, pos: at.clone().setY(0), spec, armedAt: world.time + spec.armTime, until: world.time + spec.life, done: false })
}

export function updateMines(dt: number, world: World): void {
  for (const m of mines) {
    if (m.done) continue
    if (world.time > m.until) { removeMine(world, m); continue }
    const armed = world.time >= m.armedAt
    const mat = m.mesh.material as THREE.MeshBasicMaterial
    // cracks glow orange while arming, then pulse when live
    mat.color.set(armed
      ? (Math.sin(world.time * 6) > 0 ? 0xff7a3c : 0xb84a20)
      : 0x6b4a30)
    if (!armed) continue
    for (const e of world.enemies) {
      if (!e.targetable || e.def.flying) continue
      if (Math.hypot(e.pos.x - m.pos.x, e.pos.z - m.pos.z) < m.spec.trigger + e.radius) {
        removeMine(world, m)
        explode(world, m.pos, randRange(...m.spec.damage), m.spec.radius, m.spec.stunChance, m.spec.owner)
        break
      }
    }
  }
  if (mines.length > 24) {
    for (let i = mines.length - 1; i >= 0; i--) {
      if (mines[i].done) mines.splice(i, 1)
    }
  }
}

export function clearMines(world: World): void {
  for (const m of mines) { if (!m.done) removeMine(world, m) }
  mines.length = 0
}

// ---------------- convergence runes (mage capstone) ----------------

/** what the rune needs to know about its tower without importing Tower */
export interface RuneOwner extends KillCredit {
  perk: { id: string } | null
  resonanceMult: number
}

interface Rune {
  mesh: THREE.Group
  pos: THREE.Vector3
  owner: RuneOwner
  pulsesLeft: number
  nextPulseAt: number
  done: boolean
}

const runes: Rune[] = []
const RUNE_RADIUS = 1.4
const RUNE_PULSES = 4
const RUNE_PULSE_GAP = 1
const RUNE_BASE_DAMAGE = 30
const RUNE_MAX_PER_TOWER = 2

function removeRune(world: World, r: Rune): void {
  r.done = true
  world.dynamic.remove(r.mesh)
  r.mesh.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
  })
}

export function addConvergenceRune(world: World, x: number, z: number, owner: RuneOwner): void {
  const own = runes.filter(r => !r.done && r.owner === owner)
  if (own.length >= RUNE_MAX_PER_TOWER) removeRune(world, own[0])
  const group = new THREE.Group()
  const mkRing = (radius: number, color: number, opacity: number) => {
    const geo = new THREE.RingGeometry(radius * 0.86, radius, 32)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 2
    return mesh
  }
  group.add(mkRing(RUNE_RADIUS * 0.55, 0xb37aff, 0.55), mkRing(RUNE_RADIUS, 0x8fdfff, 0.35))
  group.position.set(x, 0.05, z)
  world.dynamic.add(group)
  world.particles.magicImpact(x, 0.3, z, 0xb37aff)
  world.sfx('magic', 0.6)
  runes.push({ mesh: group, pos: new THREE.Vector3(x, 0, z), owner, pulsesLeft: RUNE_PULSES, nextPulseAt: world.time, done: false })
}

export function updateRunes(dt: number, world: World): void {
  for (const r of runes) {
    if (r.done) continue
    r.mesh.children[0].rotation.y += dt * 1.8
    r.mesh.children[1].rotation.y -= dt * 1.2
    if (world.time < r.nextPulseAt) continue
    r.pulsesLeft--
    r.nextPulseAt = world.time + RUNE_PULSE_GAP
    // pulse: strike the nearest foe in the circle, arcing outward from it
    let nearest: Enemy | null = null
    let bestD = Infinity
    for (const e of world.enemies) {
      if (!e.targetable) continue
      const d = Math.hypot(e.pos.x - r.pos.x, e.pos.z - r.pos.z)
      if (d < RUNE_RADIUS + e.radius && d < bestD) { bestD = d; nearest = e }
    }
    if (nearest) {
      world.fireProjectile({
        kind: 'chain',
        from: r.pos.clone().setY(0.15),
        first: nearest,
        damage: RUNE_BASE_DAMAGE * world.towerDamageMult('mage') * r.owner.resonanceMult,
        targets: 3,
        falloff: 0.7,
        stunChance: 0,
        stunDur: 0,
        mrPierce: r.owner.perk?.id === 'deepveil' ? 0.5 : undefined,
        credit: r.owner,
        world,
      })
    }
    if (r.pulsesLeft <= 0) removeRune(world, r)
  }
  if (runes.length > 24) {
    for (let i = runes.length - 1; i >= 0; i--) {
      if (runes[i].done) runes.splice(i, 1)
    }
  }
}

export function clearRunes(world: World): void {
  for (const r of runes) { if (!r.done) removeRune(world, r) }
  runes.length = 0
}
