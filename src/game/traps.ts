import * as THREE from 'three'
import { TrapDef, TrapKind, TRAP_DEFS } from './types.ts'
import { World } from './world.ts'
import { buildModel, VoxModel, box } from '../voxel/builder.ts'
import { randRange } from '../core/utils.ts'

/**
 * Road traps: built on marked road cells, they work on whatever walks over
 * them. Spike/blast are triggered bursts with a rearm time; frost is a
 * permanent slow zone. A distinct build lane from towers.
 */

export interface TrapSpotInfo {
  index: number
  cell: [number, number]
  pos: THREE.Vector3
  occupied: boolean
  mesh: THREE.Group
}

function spikeModel(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.25, 0, 7, 0.5, 7, 0x5c5450),
        box(0, 0.55, 0, 5.6, 0.3, 5.6, 0x6e6258),
        // folded blades
        box(-1.6, 0.85, -1.6, 0.5, 0.7, 0.5, 0x9aa2ae),
        box(1.6, 0.85, 1.6, 0.5, 0.7, 0.5, 0x9aa2ae),
        box(1.6, 0.85, -1.6, 0.5, 0.7, 0.5, 0x9aa2ae),
        box(-1.6, 0.85, 1.6, 0.5, 0.7, 0.5, 0x9aa2ae),
        box(0, 0.85, 0, 0.7, 0.9, 0.7, 0xb7bcc4),
      ],
    },
  }
}

function frostModel(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.25, 0, 7, 0.5, 7, 0x4a5a6f),
        box(0, 0.55, 0, 5.6, 0.3, 5.6, 0x5d708f),
        box(0, 1.1, 0, 1.0, 1.6, 1.0, 0x9fe8ff, true),
        box(-1.7, 0.85, -1.2, 0.6, 0.9, 0.6, 0x7fd4ff, true),
        box(1.5, 0.85, 1.4, 0.6, 1.1, 0.6, 0x7fd4ff, true),
        box(1.2, 0.75, -1.6, 0.5, 0.7, 0.5, 0xcfefff, true),
      ],
    },
  }
}

function blastModel(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.25, 0, 7, 0.5, 7, 0x4d3f38),
        box(0, 0.55, 0, 5.6, 0.3, 5.6, 0x5c4a42),
        box(0, 1.1, 0, 2.2, 1.6, 2.2, 0x38302a),      // keg
        box(0, 1.1, 0, 2.4, 0.4, 2.4, 0x2a2d35),
        box(0, 2.1, 0, 0.4, 0.6, 0.4, 0x8a6a3c),      // fuse
        box(0, 2.5, 0, 0.3, 0.3, 0.3, 0xffa03c, true),
      ],
    },
  }
}

const trapModels: Record<TrapKind, () => VoxModel> = { spike: spikeModel, frost: frostModel, blast: blastModel }

/** empty trap-spot marker: a worn rune ring carved into the road */
export function trapSpotModel(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.12, 0, 7.4, 0.24, 7.4, 0x76705f),
        box(0, 0.2, 0, 5.8, 0.2, 5.8, 0x8d8776),
        box(-2.4, 0.28, 0, 0.9, 0.16, 0.9, 0x5f5748),
        box(2.4, 0.28, 0, 0.9, 0.16, 0.9, 0x5f5748),
        box(0, 0.28, -2.4, 0.9, 0.16, 0.9, 0x5f5748),
        box(0, 0.28, 2.4, 0.9, 0.16, 0.9, 0x5f5748),
      ],
    },
  }
}

export class Trap {
  group: THREE.Group
  def: TrapDef
  cooldown = 0
  kills = 0
  /** health removed from enemies by this building, overkill excluded */
  damage = 0
  private ringMesh: THREE.Mesh | null = null
  private frostRing: THREE.Mesh | null = null

  constructor(readonly kind: TrapKind, readonly spot: TrapSpotInfo, world: World) {
    this.def = TRAP_DEFS[kind]
    this.group = buildModel(trapModels[kind](), `trap:${kind}`, { castShadow: false, receiveShadow: true })
    this.group.position.copy(spot.pos)
    if (kind === 'frost') {
      const geo = new THREE.CircleGeometry(this.def.slowRadius!, 24)
      geo.rotateX(-Math.PI / 2)
      const mat = new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })
      this.frostRing = new THREE.Mesh(geo, mat)
      this.frostRing.position.y = 0.05
      this.frostRing.renderOrder = 2
      this.group.add(this.frostRing)
    }
    world.particles.buildDust(spot.pos.x, spot.pos.y + 0.1, spot.pos.z)
  }

  get ready(): boolean { return this.cooldown <= 0 }

  update(dt: number, world: World): void {
    if (this.kind === 'frost') {
      const r = this.def.slowRadius!
      for (const e of world.enemies) {
        if (!e.alive || e.def.flying) continue
        if (Math.hypot(e.pos.x - this.group.position.x, e.pos.z - this.group.position.z) < r + e.radius) {
          e.applySlow(this.def.slowFactor!, 0.2, world)
        }
      }
      if (this.frostRing) {
        (this.frostRing.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(world.time * 2.5) * 0.05
      }
      return
    }
    // triggered traps
    if (this.cooldown > 0) {
      this.cooldown -= dt
      this.group.visible = true
      const rearm = 1 - Math.max(0, this.cooldown) / this.def.cooldown!
      this.group.scale.setScalar(0.72 + rearm * 0.28)
      return
    }
    this.group.scale.setScalar(1)
    const r = this.def.radius!
    let triggered = false
    for (const e of world.enemies) {
      if (!e.targetable || e.def.flying) continue
      if (Math.hypot(e.pos.x - this.group.position.x, e.pos.z - this.group.position.z) < 0.42 + e.radius) {
        triggered = true
        break
      }
    }
    if (!triggered) return
    this.cooldown = this.def.cooldown! * world.trapCooldownMult()
    const pos = this.group.position
    for (const e of world.enemies) {
      if (!e.targetable || e.def.flying) continue
      if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < r + e.radius) {
        const dealt = e.takeDamage(randRange(...this.def.damage!), 'physical', world, { credit: this })
        if (dealt > 0 && this.def.stun) e.applyStun(this.def.stun, world)
      }
    }
    if (this.kind === 'blast') {
      world.particles.explosion(pos.x, 0.15, pos.z, 1.1)
      world.sfx('explosion', 0.9)
      world.shake(0.12)
    } else {
      world.particles.hitSpark(pos.x, 0.3, pos.z, 0xc8cdd6)
      world.particles.bloodHit(pos.x, 0.25, pos.z)
      world.sfx('hit', 0.8)
    }
  }

  dispose(): void {
    if (this.frostRing) {
      this.frostRing.geometry.dispose()
      ;(this.frostRing.material as THREE.Material).dispose()
    }
  }
}
