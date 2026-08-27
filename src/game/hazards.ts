import * as THREE from 'three'
import { HazardId } from './types.ts'
import { randRange, pick, simRandom } from '../core/utils.ts'
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

export function createHazard(id: HazardId, levelId: string): Hazard {
  switch (id) {
    case 'deepchill': return new DeepChill()
    case 'eruption': return new Eruption(levelId === 'cinderwake' ? 80 : 60)
    case 'witchlights': return new Witchlights()
    case 'riftlight': return new Riftlight()
  }
}
