import * as THREE from 'three'
import { HazardId } from './types.ts'
import { randRange, pick, simRandom, simChance } from '../core/utils.ts'
import type { Game } from './game.ts'

/**
 * Map signature mechanics. Design rule: hazards are OPPORTUNITY WINDOWS the
 * player can play into, never chores — they slow enemies, damage enemies,
 * pay the hero, or empower towers. Threat comes from enemies, not the map.
 */
export interface Hazard {
  /** runs inside the fixed sim step, so it pauses with the game */
  update(dt: number, game: Game): void
  dispose(game: Game): void
}

/** Frostmere: a telegraphed aurora sweep that slows every ground enemy —
 *  players learn to call waves INTO the chill */
class DeepChill implements Hazard {
  private nextAt = 26
  private chillUntil = 0
  private telegraphUntil = 0
  private announced = false

  update(dt: number, game: Game): void {
    const t = game.time
    if (t >= this.nextAt && this.telegraphUntil === 0 && t >= this.chillUntil) {
      this.telegraphUntil = t + 3.5
      game.hud.showBanner('DEEP CHILL', 'surge')
      if (!this.announced) {
        this.announced = true
        game.hud.showToast('The aurora burns — every ground foe slows while the chill holds. Call your waves into it!', 6)
      }
      game.sfx('magic', 0.7)
    }
    if (this.telegraphUntil > 0 && t >= this.telegraphUntil) {
      this.telegraphUntil = 0
      this.chillUntil = t + 9
      this.nextAt = t + randRange(38, 50)
      game.sfx('lightning', 0.5)
    }
    const active = t < this.chillUntil
    game.engine.setChillBlend(active ? 1 : this.telegraphUntil > 0 ? 0.45 : 0)
    if (active) {
      for (const e of game.enemies) {
        if (e.alive && !e.def.flying) e.applySlow(0.65, 0.4, game)
      }
      if (Math.random() < dt * 30 && game.level) {
        game.particles.normal.emit({
          x: (Math.random() - 0.5) * game.level.width * 0.9,
          y: 2.6 + Math.random() * 2, z: (Math.random() - 0.5) * game.level.height * 0.9,
          count: 1, color: 0xbfe8ff, speed: 0.08, gravity: 0.5, drag: 0.2,
          life: 4, size: 0.13, sizeEnd: 0.1, dirY: 0.1, spread: 0.3,
        })
      }
    }
  }

  dispose(game: Game): void {
    game.engine.setChillBlend(0)
  }
}

/** Emberwastes: cracks telegraph on the road, then erupt under the horde */
class Eruption implements Hazard {
  private nextAt = 30
  private cracks: { mesh: THREE.Mesh, pos: THREE.Vector3, at: number }[] = []
  private announced = false

  constructor(private damage: number) {}

  update(dt: number, game: Game): void {
    const t = game.time
    if (t >= this.nextAt) {
      this.nextAt = t + randRange(30, 42)
      const count = 2 + Math.floor(simRandom() * 2)
      for (let i = 0; i < count; i++) {
        const lane = pick(game.lanes)
        const s = lane.sample(randRange(lane.length * 0.15, lane.length * 0.85))
        const geo = new THREE.CircleGeometry(0.55, 20)
        geo.rotateX(-Math.PI / 2)
        const mat = new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(s.x, 0.05, s.z)
        mesh.renderOrder = 2
        game.dynamic.add(mesh)
        this.cracks.push({ mesh, pos: new THREE.Vector3(s.x, 0, s.z), at: t + 3 })
      }
      if (!this.announced) {
        this.announced = true
        game.hud.showToast('The ground splits along the road — the wastes erupt beneath the horde. Herd foes onto the glow!', 6)
      }
      game.sfx('horn', 0.4)
    }
    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const c = this.cracks[i]
      const m = c.mesh.material as THREE.MeshBasicMaterial
      m.opacity = 0.35 + Math.sin(t * 10) * 0.2
      if (t >= c.at) {
        game.particles.explosion(c.pos.x, 0.15, c.pos.z, 0.85)
        game.sfx('explosion', 0.7)
        game.shake(0.08)
        for (const e of game.enemies) {
          if (e.targetable && !e.def.flying && e.pos.distanceTo(c.pos) < 0.85 + e.radius) {
            e.takeDamage(this.damage * randRange(0.85, 1.15), 'true', game)
          }
        }
        game.dynamic.remove(c.mesh)
        c.mesh.geometry.dispose()
        m.dispose()
        this.cracks.splice(i, 1)
      }
    }
  }

  dispose(game: Game): void {
    for (const c of this.cracks) {
      game.dynamic.remove(c.mesh)
      c.mesh.geometry.dispose()
      ;(c.mesh.material as THREE.Material).dispose()
    }
    this.cracks = []
  }
}

/** Mistfen: wisps rise during wave breaks; the hero collects them for gold —
 *  a little job between fights */
class Witchlights implements Hazard {
  private wisps: { mesh: THREE.Mesh, until: number }[] = []
  private nextAt = 10
  private announced = false

  update(dt: number, game: Game): void {
    const t = game.time
    const inBreak = game.waves?.phase === 'countdown'
    if (inBreak && t >= this.nextAt && this.wisps.length < 2) {
      this.nextAt = t + randRange(6, 10)
      const lane = pick(game.lanes)
      const s = lane.sample(randRange(lane.length * 0.2, lane.length * 0.8), randRange(-1.6, 1.6))
      const geo = new THREE.SphereGeometry(0.14, 10, 8)
      const mat = new THREE.MeshBasicMaterial({ color: 0xc9ff8f, transparent: true, opacity: 0.9, toneMapped: false })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(s.x, 0.55, s.z)
      game.dynamic.add(mesh)
      this.wisps.push({ mesh, until: t + 14 })
      if (!this.announced) {
        this.announced = true
        game.hud.showToast('A witchlight rises from the fen — walk your hero over it to claim its gold.', 6)
      }
    }
    const hero = game.hero
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i]
      // once the fighting starts, lingering wisps fade out soon
      if (!inBreak) w.until = Math.min(w.until, t + 4)
      w.mesh.position.y = 0.55 + Math.sin(t * 2.5 + i * 2) * 0.12
      const m = w.mesh.material as THREE.MeshBasicMaterial
      m.opacity = t > w.until - 2 ? Math.max(0, (w.until - t) / 2) * 0.9 : 0.9
      const collected = hero && hero.alive
        && Math.hypot(hero.group.position.x - w.mesh.position.x, hero.group.position.z - w.mesh.position.z) < 0.65
      if (collected || t >= w.until) {
        if (collected) {
          game.addGold(8, w.mesh.position.x, 0.7, w.mesh.position.z)
          hero!.gainXp(6, game)
          game.particles.healSparkle(w.mesh.position.x, 0.5, w.mesh.position.z)
          game.sfx('coin', 0.7)
        }
        game.dynamic.remove(w.mesh)
        w.mesh.geometry.dispose()
        m.dispose()
        this.wisps.splice(i, 1)
      }
    }
  }

  dispose(game: Game): void {
    for (const w of this.wisps) {
      game.dynamic.remove(w.mesh)
      w.mesh.geometry.dispose()
      ;(w.mesh.material as THREE.Material).dispose()
    }
    this.wisps = []
  }
}

/** Shattered Crown / Veilscar: a rift bathes nearby towers in veil energy,
 *  empowering their attack rate while it burns */
class Riftlight implements Hazard {
  private nextAt = 24
  private beam: THREE.Mesh | null = null
  private ring: THREE.Mesh | null = null
  private center: THREE.Vector3 | null = null
  private until = 0
  private announced = false

  update(dt: number, game: Game): void {
    const t = game.time
    if (t >= this.nextAt && this.until <= t) {
      this.nextAt = t + randRange(36, 48)
      // prefer a built attacker; fall back to any plot so the beam always lands
      const towers = game.towers.filter(tw => !tw.isBarracks)
      const plots = game.terrain?.plots ?? []
      const at = towers.length > 0
        ? pick(towers).pos
        : plots.length > 0 ? pick(plots).pos : null
      if (at) {
        this.until = t + 10
        this.center = new THREE.Vector3(at.x, 0, at.z)
        const beamGeo = new THREE.CylinderGeometry(0.28, 0.44, 7, 12, 1, true)
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xb37aff, transparent: true, opacity: 0.4, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })
        this.beam = new THREE.Mesh(beamGeo, beamMat)
        this.beam.position.set(at.x, 3.5, at.z)
        const ringGeo = new THREE.RingGeometry(1.45, 1.6, 40)
        ringGeo.rotateX(-Math.PI / 2)
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xb37aff, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false })
        this.ring = new THREE.Mesh(ringGeo, ringMat)
        this.ring.position.set(at.x, 0.05, at.z)
        this.ring.renderOrder = 2
        game.dynamic.add(this.beam, this.ring)
        if (!this.announced) {
          this.announced = true
          game.hud.showToast('A rift tears open — towers bathed in its light attack 40% faster while it burns.', 6)
        }
        game.sfx('magic', 0.9)
      }
    }
    if (this.beam && this.ring && this.center) {
      if (t >= this.until) {
        this.removeBeam(game)
      } else {
        // continuous empowerment: even a tower built into the beam benefits
        for (const tw of game.towers) {
          if (!tw.isBarracks && tw.riftUntil < this.until
            && Math.hypot(tw.pos.x - this.center.x, tw.pos.z - this.center.z) < 1.6) {
            tw.riftUntil = this.until
            game.particles.magicImpact(tw.pos.x, tw.pos.y + 0.8, tw.pos.z, 0xb37aff)
          }
        }
        this.beam.rotation.y += dt * 1.5
        const fade = Math.min(1, (this.until - t) / 1.2)
        ;(this.beam.material as THREE.MeshBasicMaterial).opacity = 0.4 * fade
        ;(this.ring.material as THREE.MeshBasicMaterial).opacity = (0.4 + Math.sin(t * 5) * 0.15) * fade
      }
    }
  }

  private removeBeam(game: Game): void {
    for (const m of [this.beam, this.ring]) {
      if (m) {
        game.dynamic.remove(m)
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    }
    this.beam = null
    this.ring = null
  }

  dispose(game: Game): void {
    this.removeBeam(game)
  }
}

/**
 * Emberwind Reach: a firestorm that follows your hero.
 *
 * Every other hazard in the game happens *to* the player on a timer. This one
 * is steered: the front drifts toward whoever is carrying the banner, so the
 * hero stops being only a fighter and becomes bait you walk into the horde -
 * and it burns him too, so parking in it is not free. Towers caught inside
 * fire slower, which means the good line is one you can lead the fire past
 * rather than through.
 */
class Emberwind implements Hazard {
  private pos = new THREE.Vector3(0, 0, 0)
  private ring: THREE.Mesh | null = null
  private inner: THREE.Mesh | null = null
  private announced = false
  private burnT = 0
  private started = false

  /** how much of the board the front covers, and how fast it closes */
  private static readonly RADIUS = 3.1
  private static readonly SPEED = 0.78
  private static readonly DPS = 26

  update(dt: number, game: Game): void {
    if (!this.ring) this.build(game)
    if (!this.started) {
      // start it out over the field, not on top of the player's opening build
      const l = game.lanes[0]
      const s = l.sample(l.length * 0.35)
      this.pos.set(s.x, 0, s.z)
      this.started = true
    }

    // drift toward the hero; with no hero alive it keeps its heading toward the gate
    const target = game.hero?.alive ? game.hero.group.position : null
    if (target) {
      const dx = target.x - this.pos.x, dz = target.z - this.pos.z
      const d = Math.hypot(dx, dz)
      if (d > 0.05) {
        const step = Math.min(d, Emberwind.SPEED * dt)
        this.pos.x += dx / d * step
        this.pos.z += dz / d * step
      }
    }

    const r = Emberwind.RADIUS
    if (this.ring) {
      this.ring.position.set(this.pos.x, 0.06, this.pos.z)
      this.ring.rotation.z += dt * 0.35
      const m = this.ring.material as THREE.MeshBasicMaterial
      m.opacity = 0.34 + Math.sin(game.time * 3.1) * 0.08
    }
    if (this.inner) {
      this.inner.position.set(this.pos.x, 0.05, this.pos.z)
      const m = this.inner.material as THREE.MeshBasicMaterial
      m.opacity = 0.16 + Math.sin(game.time * 4.4) * 0.05
    }

    // burn ticks on a cadence so damage is legible rather than a smooth drain
    this.burnT -= dt
    const tick = this.burnT <= 0
    if (tick) this.burnT = 0.5

    for (const e of game.enemies) {
      if (!e.targetable) continue
      if (Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z) > r + e.radius) continue
      if (tick) e.takeDamage(Emberwind.DPS * 0.5, 'true', game)
      if (tick && simChance(0.25)) game.particles.hitSpark(e.pos.x, 0.5, e.pos.z, 0xff8a3c)
    }
    // the hero is not immune, or leading it would cost nothing
    const h = game.hero
    if (tick && h?.alive && Math.hypot(h.group.position.x - this.pos.x, h.group.position.z - this.pos.z) < r) {
      h.takeDamage(Emberwind.DPS * 0.22, game)
    }
    // and neither are the guns: anything inside the front works slower
    for (const t of game.towers) {
      t.suppressed = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) < r
    }

    if (!this.announced && game.time > 4) {
      this.announced = true
      game.hud.showToast('The Emberwind follows your hero. Lead it into the horde — but it burns him too, and towers inside it fire slower.', 8)
    }
  }

  private build(game: Game): void {
    const geo = new THREE.RingGeometry(Emberwind.RADIUS - 0.22, Emberwind.RADIUS, 40)
    geo.rotateX(-Math.PI / 2)
    this.ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0xff7a2a, transparent: true, opacity: 0.34, toneMapped: false, depthWrite: false,
    }))
    this.ring.renderOrder = 3
    game.dynamic.add(this.ring)

    const fill = new THREE.CircleGeometry(Emberwind.RADIUS - 0.22, 40)
    fill.rotateX(-Math.PI / 2)
    this.inner = new THREE.Mesh(fill, new THREE.MeshBasicMaterial({
      color: 0xff9a4a, transparent: true, opacity: 0.16, toneMapped: false, depthWrite: false,
    }))
    this.inner.renderOrder = 2
    game.dynamic.add(this.inner)
  }

  dispose(game: Game): void {
    for (const m of [this.ring, this.inner]) {
      if (!m) continue
      game.dynamic.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    this.ring = this.inner = null
    for (const t of game.towers) t.suppressed = false
  }
}

/**
 * Tidereach Causeway: the tide decides which roads exist.
 *
 * Every other map hands you a board and lets you solve it once. Here the shape
 * of the problem changes underneath a defense you have already paid for: a
 * causeway floods and the guns watching it have nothing to do, while a road
 * that was safe all battle opens and arrives already under pressure. Selling
 * and rebuilding is the intended answer, which is why Full Salvage is worth
 * owning by the time a player gets here.
 *
 * Two rules keep it fair rather than merely cruel: the change is announced a
 * wave before it happens, and the roads are never all shut at once.
 */
class ShiftingRoads implements Hazard {
  private lastWave = -99
  private closed = new Set<number>()
  private flood: THREE.Mesh[] = []
  private announced = false
  private warned = -1

  /** which roads are shut, as a function of how far in we are */
  private planFor(wave: number, lanes: number): Set<number> {
    const out = new Set<number>()
    if (lanes < 3 || wave < 3) return out
    // one road at a time early, two once the player has a board to spare
    const shut = wave >= 14 && lanes >= 5 ? 2 : 1
    // Road zero carries the gate and is never shut, so the rotation runs over
    // the others: picking freely and then deleting zero left waves where the
    // tide did nothing at all, which reads as the mechanic being broken.
    const rotating = lanes - 1
    for (let k = 0; k < Math.min(shut, rotating - 1); k++) {
      out.add(1 + (Math.floor(wave / 4) + k * 2) % rotating)
    }
    return out
  }

  update(_dt: number, game: Game): void {
    const wave = game.waves?.waveIndex ?? -1
    if (wave === this.lastWave) return
    this.lastWave = wave
    const lanes = game.lanes.length
    const next = this.planFor(wave, lanes)

    // tell the player before it happens, not after they have built into it
    const soon = this.planFor(wave + 1, lanes)
    if (wave >= 0 && this.warned !== wave && !sameSet(soon, next)) {
      this.warned = wave
      game.hud.showToast('The tide is turning — the causeways change after this wave.', 4)
    }

    if (sameSet(next, this.closed)) return
    this.closed = next
    game.closedLanes = new Set(next)
    this.redraw(game)

    if (!this.announced) {
      this.announced = true
      game.hud.showToast('The tide closes causeways and opens others. Traffic reroutes to whatever is still standing — build so you can move.', 8)
    } else if (wave > 0) {
      game.sfx('horn', 0.45)
    }
  }

  /** a flooded causeway is drawn over, so "shut" is visible and not a surprise */
  private redraw(game: Game): void {
    for (const m of this.flood) {
      game.dynamic.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    this.flood = []
    for (const i of this.closed) {
      const lane = game.lanes[i]
      if (!lane) continue
      for (let d = 0; d < lane.length; d += 0.9) {
        const s = lane.sample(d)
        const geo = new THREE.PlaneGeometry(1.05, 1.05)
        geo.rotateX(-Math.PI / 2)
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          color: 0x2f8fa8, transparent: true, opacity: 0.62, toneMapped: false, depthWrite: false,
        }))
        mesh.position.set(s.x, 0.09, s.z)
        mesh.renderOrder = 2
        game.dynamic.add(mesh)
        this.flood.push(mesh)
      }
    }
  }

  dispose(game: Game): void {
    for (const m of this.flood) {
      game.dynamic.remove(m)
      m.geometry.dispose()
      ;(m.material as THREE.Material).dispose()
    }
    this.flood = []
    game.closedLanes = new Set()
  }
}

function sameSet(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

export function createHazard(id: HazardId, levelId: string): Hazard {
  switch (id) {
    case 'deepchill': return new DeepChill()
    case 'eruption': return new Eruption(levelId === 'cinderwake' ? 80 : 60)
    case 'witchlights': return new Witchlights()
    case 'riftlight': return new Riftlight()
    case 'emberwind': return new Emberwind()
    case 'shiftingroads': return new ShiftingRoads()
  }
}
