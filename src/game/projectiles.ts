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

/** Presentation only: smooth signature light with no hit stop or combat timing changes. */
class SeraphBloom implements Projectile {
  mesh = new THREE.Group()
  done = false
  private age = 0
  private column?: THREE.Mesh
  private halo: THREE.Mesh
  private materials: THREE.MeshBasicMaterial[] = []
  constructor(private spec: Extract<ProjectileSpec, { kind: 'seraphBloom' }>) {
    const material = (color: number) => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
      this.materials.push(mat)
      return mat
    }
    this.mesh.name = spec.solar ? 'dawnfall-light' : 'eclipse-halo'
    this.mesh.position.copy(spec.at)
    if (spec.solar) {
      this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 4, 12, 1, true), material(0xfff3bb))
      this.column.position.y = 1.8
      this.mesh.add(this.column)
    }
    this.halo = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), material(spec.solar ? 0xffd982 : 0xb995ff))
    if (spec.solar) this.halo.rotation.x = -Math.PI / 2
    else this.halo.quaternion.copy(spec.world.cameraQuat)
    this.halo.position.y = spec.solar ? 0.15 : 0
    this.mesh.add(this.halo)
    this.update(0)
  }
  update(dt: number): void {
    this.age += dt
    const t = Math.min(1, this.age / 0.85)
    const eased = t * t * (3 - 2 * t)
    // Zero opacity at both endpoints; a gentle attack and longer release.
    const envelope = Math.sin(Math.PI * Math.min(1, t / 0.35) / 2) * (1 - eased)
    this.materials.forEach((m, i) => { m.opacity = envelope * (i === 0 && this.column ? 0.38 : 0.65) })
    this.halo.scale.setScalar(0.3 + eased * (this.spec.solar ? 0.95 : 1.5))
    if (this.column) this.column.scale.set(1 - eased * 0.6, 1, 1 - eased * 0.6)
    this.done = t >= 1
  }
  dispose(): void {
    this.halo.geometry.dispose()
    this.column?.geometry.dispose()
    this.materials.forEach(m => m.dispose())
  }
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
  /** where the target was last seen; the point the bolt flies to if it dies */
  private lastAim: THREE.Vector3
  constructor(private spec: Extract<ProjectileSpec, { kind: 'bolt' }>) {
    this.mesh = buildModel(env.boltProjectile(spec.color), `proj:bolt:${spec.color}`, { castShadow: false })
    this.pos = spec.from.clone()
    this.lastAim = spec.target.pos.clone().setY(spec.target.pos.y + 0.35)
    this.mesh.position.copy(this.pos)
  }
  update(dt: number): void {
    const { target, world } = this.spec
    // A bolt whose target is gone flies on to where that target last was and
    // breaks there. It used to aim one unit below its own position every
    // frame instead, which is a point it can never reach: the bolt chased it
    // downward forever, drawing and updating long after the fight moved on.
    if (target.state !== 'gone') this.lastAim.copy(target.pos).setY(target.pos.y + 0.35)
    const to = this.lastAim
    const d = this.pos.distanceTo(to)
    const step = 7.5 * dt
    world.particles.trail(this.pos.x, this.pos.y, this.pos.z, this.spec.color, 0.22)
    if (d <= step) {
      this.done = true
      if (this.spec.splash) {
        for (const enemy of world.enemies) {
          if (!enemy.targetable || enemy.airborne || Math.hypot(enemy.pos.x - to.x, enemy.pos.z - to.z) > this.spec.splash + enemy.radius) continue
          const dealt = enemy.takeDamage(this.spec.damage, 'magic', world, { credit: this.spec.credit })
          if (dealt > 0 && this.spec.slow) enemy.applySlow(this.spec.slow.factor, this.spec.slow.duration, world)
          if (dealt > 0 && this.spec.knockback) enemy.shove(this.spec.knockback)
        }
        world.particles.magicImpact(to.x, to.y, to.z, this.spec.color)
        world.sfx('hit', .5)
        return
      }
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
      // slower and higher than an arrow: it is thrown, and it has to be
      // in the air long enough to be seen tumbling
      5.2,
      1.0,
    )
    this.mesh.scale.setScalar(1.45)
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
  // is exactly the hitch that made cluster bombards feel like they lagged. So
  // only the *presentation* is skipped for a bomblet - the early return that
  // used to live here skipped the damage loop too, and the Cluster Bombard's
  // whole branch dealt nothing but its shell for as long as that stood.
  if (!submunition) {
    world.shake(0.05 + splash * 0.05)
    if (splash >= 0.6) world.impact('heavy')
  }
  for (const e of world.enemies) {
    if (!e.targetable || e.airborne) continue
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
      const dealt = e.takeDamage(damage, 'magic', world, { mrPierce: spec.mrPierce, credit: spec.credit, flavor: 'shock' })
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
      if (e.airborne && !this.spec.hitsAir) continue
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
    if (e.airborne && this.spec.airMult) dmg *= this.spec.airMult
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
      if ((world.balanceRuleset ?? 12) <= 11) e.applyStun(1.5, world)
      else e.ground(1.5, world)
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

/** Short Tesla-like pulses: a colored edge and a narrow white core.
 * All beams share two instanced draws per volley, including at tier five.
 * Bends use visual math only; rendering never consumes combat randomness.
 */
const RAY_GEO = new THREE.BoxGeometry(1, 1, 1)
const VOID_RING = new THREE.RingGeometry(.93, 1, 48)
/** One laser and one impact circle, regardless of how many enemies are hit. */
class VoidPulse implements Projectile {
  mesh = new THREE.Group()
  done = false
  private age = 0
  private materials: THREE.MeshBasicMaterial[] = []
  private beams: THREE.Mesh[] = []
  private origin: THREE.Vector3
  private end: THREE.Vector3
  private distance: number
  private ring: THREE.Mesh
  private radius: number
  constructor(spec: Extract<ProjectileSpec, { kind: 'voidPulse' }>) {
    const { world, from, at } = spec
    this.mesh.name = 'void-pulse'
    const mat = (color: number) => {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0,
        depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
      this.materials.push(material)
      return material
    }
    const impact = new THREE.Vector3(at.x, world.groundY(at.x, at.z) + .08, at.z)
    const end = impact.clone().setY(Math.max(impact.y + .2, at.y + .3))
    this.origin = from.clone(); this.end = end
    this.distance = from.distanceTo(end); this.radius = spec.splash
    for (const [color, width] of [[0x8250b8, .18], [0x21132f, .10]]) {
      const beam = new THREE.Mesh(RAY_GEO, mat(color))
      beam.position.copy(from).add(end).multiplyScalar(.5)
      beam.lookAt(end)
      beam.scale.set(width, width, Math.max(.001, from.distanceTo(end)))
      this.mesh.add(beam)
      this.beams.push(beam)
    }
    const ring = new THREE.Mesh(VOID_RING, mat(0x9262c4))
    ring.position.copy(impact); ring.rotation.x = -Math.PI / 2
    ring.scale.setScalar(spec.splash)
    this.mesh.add(ring)
    this.ring = ring
    this.update(0)
    // Snapshot eligibility before deaths can summon enemies or change the list.
    // This is an area in the map plane; both ground and air units can be hit.
    const hits = world.enemies.filter(e => e.targetable
      && Math.hypot(e.pos.x - at.x, e.pos.z - at.z) <= spec.splash + e.radius)
    for (const enemy of hits) {
      const dealt = enemy.takeDamage(spec.damage, 'magic', world, { mrPierce: 1, credit: spec.credit, flavor: 'magic' })
      if (dealt > 0 && spec.armorShred) enemy.shredArmor(spec.armorShred)
    }
  }
  update(dt: number): void {
    this.age += dt
    // A compact packet travels down the firing line, leaving visible darkness
    // behind it. The next shot has a clear gap, even at the fastest fire rate.
    const travel = Math.min(1, this.age / .14)
    const head = Math.min(1, travel * 1.25), tail = Math.max(0, travel * 1.25 - .25)
    const envelope = Math.sin(Math.PI * travel)
    for (const [i, beam] of this.beams.entries()) {
      beam.position.lerpVectors(this.origin, this.end, (head + tail) / 2)
      const width = (i === 0 ? .24 : .14) * (.65 + .35 * envelope)
      beam.scale.set(width, width, Math.max(.001, this.distance * (head - tail)))
    }
    this.materials[0].opacity = envelope * .85
    this.materials[1].opacity = envelope
    const impact = Math.max(0, Math.min(1, (this.age - .10) / .18))
    this.ring.scale.setScalar(this.radius * (.35 + .65 * (1 - (1 - impact) ** 2)))
    this.materials[2].opacity = Math.sin(Math.PI * impact) * .6
    if (this.age >= .28) this.done = true
  }
  dispose(): void { this.materials.forEach(material => material.dispose()) }
}
const RAY_LIFE = 0.085
class RayProjectile implements Projectile {
  mesh = new THREE.Group()
  done = false
  private life = 0
  private edge: THREE.InstancedMesh
  private core: THREE.InstancedMesh
  constructor(spec: Extract<ProjectileSpec, { kind: 'ray' }>) {
    const { world, from } = spec
    const hits = [...new Set(spec.targets)].filter(e => e.targetable)
    const material = (color: number, opacity: number) => new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, toneMapped: false, depthWrite: false,
    })
    this.edge = new THREE.InstancedMesh(RAY_GEO, material(spec.color, 0.38), hits.length * 3)
    this.core = new THREE.InstancedMesh(RAY_GEO, material(0xffffff, 0.95), hits.length * 3)
    this.edge.name = 'ray-edge'; this.core.name = 'ray-core'
    this.core.renderOrder = 1
    this.mesh.add(this.edge, this.core)
    const segment = new THREE.Object3D()
    hits.forEach((e, i) => {
      const to = e.pos.clone().setY(e.pos.y + 0.4)
      const side = new THREE.Vector3(to.z - from.z, 0, from.x - to.x).normalize()
      const bend = Math.min(0.10, from.distanceTo(to) * 0.025) * (i % 2 ? -1 : 1)
      const points = [from, from.clone().lerp(to, 0.34).addScaledVector(side, bend),
        from.clone().lerp(to, 0.68).addScaledVector(side, -bend * 0.65), to]
      for (let j = 0; j < 3; j++) {
        const a = points[j], b = points[j + 1]
        segment.position.copy(a).add(b).multiplyScalar(0.5)
        segment.lookAt(b)
        segment.scale.set(spec.width * 1.8, spec.width * 1.8, Math.max(0.001, a.distanceTo(b)))
        segment.updateMatrix()
        this.edge.setMatrixAt(i * 3 + j, segment.matrix)
        segment.scale.x = segment.scale.y = spec.width * 0.6
        segment.updateMatrix()
        this.core.setMatrixAt(i * 3 + j, segment.matrix)
      }
      const dealt = e.takeDamage(spec.damage, spec.damageType, world, { mrPierce: spec.mrPierce, crit: spec.crit, credit: spec.credit, flavor: spec.damageType === 'magic' ? 'magic' : 'fire' })
      if (dealt > 0) {
        if (spec.armorShred) e.shredArmor(spec.armorShred)
        // One small contact spark, even on critical volleys. Large burst
        // clouds at every endpoint hid both the rays and enemy silhouettes.
        world.particles.hitSpark(to.x, to.y, to.z, spec.color)
      }
    })
    this.edge.instanceMatrix.needsUpdate = this.core.instanceMatrix.needsUpdate = true
  }
  update(dt: number): void {
    this.life += dt
    const fade = Math.max(0, 1 - this.life / RAY_LIFE)
    ;(this.edge.material as THREE.MeshBasicMaterial).opacity = 0.38 * fade
    ;(this.core.material as THREE.MeshBasicMaterial).opacity = 0.95 * Math.min(1, fade * 2)
    if (this.life >= RAY_LIFE) this.done = true
  }
  dispose(): void {
    for (const beam of [this.edge, this.core]) {
      beam.dispose()
      ;(beam.material as THREE.Material).dispose()
    }
  }
}

export function createProjectile(spec: ProjectileSpec): Projectile {
  switch (spec.kind) {
    case 'voidPulse': return new VoidPulse(spec)
    case 'ray': return new RayProjectile(spec)
    case 'arrow': return new ArrowProjectile(spec)
    case 'bolt': return new BoltProjectile(spec)
    case 'bomb': return new BombProjectile(spec)
    case 'chain': return new ChainLightning(spec)
    case 'warlockBolt': return new WarlockBolt(spec)
    case 'seraphBloom': return new SeraphBloom(spec)
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
      if (!e.alive || e.airborne) continue
      if (Math.hypot(e.pos.x - z.pos.x, e.pos.z - z.pos.z) < z.radius + e.radius) {
        e.takeDamage(z.dps * dt, 'true', world, { silent: true, credit: z.credit, flavor: 'fire' })
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
      if (!e.targetable || e.airborne) continue
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
