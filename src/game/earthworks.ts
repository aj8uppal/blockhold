import * as THREE from 'three'
import { box, buildModel, type VoxBox, type VoxModel } from '../voxel/builder.ts'
import { gridToWorld } from './path.ts'
import type { LevelDef } from './types.ts'

/**
 * Earthworks: the player rearranges the ground itself.
 *
 * Blockhold is built entirely out of blocks and none of them could be moved.
 * Every mechanic sat on top of the terrain rather than in it, so the voxel
 * identity was a rendering style rather than something the player ever used.
 *
 * Two verbs, deliberately:
 *
 *   Rampart - raise a block of earth beside the road. Towers standing next to
 *   high ground shoot further and hit harder.
 *
 *   Cutting - sink a stretch of road into a channel. Anything crossing it is
 *   slowed and takes more punishment while it is down there.
 *
 * Both change what the road *costs* rather than where it goes. Enemies in
 * this game do not pathfind - they ride a distance-parameterised rail, and
 * `remaining` along that rail is the sort key for all tower targeting, leak
 * detection and previews. Rerouting would mean replacing the movement model
 * and would invalidate the balance of all 153 authored waves. Keeping the
 * rail is what makes this shippable rather than a sequel.
 */

export type EarthworkKind = 'rampart' | 'cutting'

export interface EarthworkDef {
  kind: EarthworkKind
  name: string
  icon: string
  cost: number
  description: string
}

export const EARTHWORK_DEFS: Record<EarthworkKind, EarthworkDef> = {
  rampart: {
    kind: 'rampart', name: 'Rampart', icon: 'quake', cost: 70,
    description: 'Raise a bank of earth. Towers beside it gain +15% range and +10% damage from the high ground.',
  },
  cutting: {
    kind: 'cutting', name: 'Cutting', icon: 'spike', cost: 90,
    description: 'Sink the road into a channel. Ground enemies crossing it are slowed to 65% and take 18% more damage.',
  },
}

/** how far a rampart's high ground reaches */
export const RAMPART_REACH = 1.7
export const RAMPART_RANGE_BONUS = 0.15
export const RAMPART_DAMAGE_BONUS = 0.10
export const CUTTING_SLOW = 0.65
export const CUTTING_VULN = 0.18

export interface EarthworkSpot {
  index: number
  kind: EarthworkKind
  cell: [number, number]
  pos: THREE.Vector3
  occupied: boolean
  mesh: THREE.Group
}

export class Earthwork {
  group: THREE.Group
  def: EarthworkDef

  constructor(readonly kind: EarthworkKind, readonly spot: EarthworkSpot) {
    this.def = EARTHWORK_DEFS[kind]
    this.group = buildModel(earthworkModel(kind), `earthwork:${kind}`, { receiveShadow: true })
    this.group.position.copy(spot.pos)
  }

  dispose(): void {
    this.group.removeFromParent()
  }
}

const C = {
  soil: 0x6b5535, soilDark: 0x51402a, grass: 0x5f8f4a,
  stone: 0x8d8f96, shadow: 0x2f2a22,
}

function earthworkModel(kind: EarthworkKind): VoxModel {
  if (kind === 'rampart') {
    const bank: VoxBox[] = [
      box(0, 1.6, 0, 9, 3.2, 9, C.soil),
      box(0, 3.3, 0, 9.4, 0.4, 9.4, C.grass),
      box(0, 0.4, 0, 9.8, 0.8, 9.8, C.soilDark),
      box(-3.2, 3.8, -3.2, 1.2, 1.2, 1.2, C.stone),
      box(3.2, 3.8, 3.2, 1.2, 1.2, 1.2, C.stone),
    ]
    return { parts: { bank }, scale: 0.1 }
  }
  // a cutting is a hole: dark walls and a sunken floor
  const channel: VoxBox[] = [
    box(0, -1.0, 0, 9.6, 2.0, 9.6, C.shadow),
    box(0, -1.9, 0, 9.0, 0.4, 9.0, C.soilDark),
    box(-4.6, -0.6, 0, 0.6, 2.4, 9.6, C.soil),
    box(4.6, -0.6, 0, 0.6, 2.4, 9.6, C.soil),
  ]
  return { parts: { channel }, scale: 0.1 }
}

/**
 * Where the ground can be worked. Derived from the map rather than authored,
 * so the seven existing levels get earthworks without being rewritten:
 * ramparts on grass that touches a road, cuttings on road cells that are not
 * already carrying a trap.
 */
export function deriveEarthworkSpots(
  level: LevelDef,
  cellKind: (c: number, r: number) => string,
  isTrapSpot: (c: number, r: number) => boolean,
  limit = { rampart: 6, cutting: 4 },
): { cell: [number, number], kind: EarthworkKind }[] {
  const out: { cell: [number, number], kind: EarthworkKind }[] = []
  const touchesRoad = (c: number, r: number) =>
    cellKind(c + 1, r) === 'road' || cellKind(c - 1, r) === 'road'
    || cellKind(c, r + 1) === 'road' || cellKind(c, r - 1) === 'road'

  const ramparts: [number, number][] = []
  const cuttings: [number, number][] = []
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      const k = cellKind(c, r)
      if (k === 'grass' && touchesRoad(c, r)) ramparts.push([c, r])
      else if (k === 'road' && !isTrapSpot(c, r)) cuttings.push([c, r])
    }
  }
  // spread them out instead of clustering them all at the entrance
  const spread = <T>(arr: T[], n: number): T[] => {
    if (arr.length <= n) return arr
    const step = arr.length / n
    return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)])
  }
  for (const cell of spread(ramparts, limit.rampart)) out.push({ cell, kind: 'rampart' })
  for (const cell of spread(cuttings, limit.cutting)) out.push({ cell, kind: 'cutting' })
  return out
}

export function earthworkSpotWorld(cell: [number, number], level: LevelDef): THREE.Vector3 {
  const [x, z] = gridToWorld(cell[0], cell[1], level.width, level.height)
  return new THREE.Vector3(x, 0, z)
}
