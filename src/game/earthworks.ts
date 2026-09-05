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

/**
 * How far a raised foundation stands above the ground it was on.
 *
 * The rampart used to be a bank of earth *beside* a plot, with an invisible
 * radius that lifted any tower within it. Explaining that took a ring, a
 * tooltip and a list of names, and it was still the least understood thing
 * on the board. Now raising the ground raises the plot itself: the tower
 * visibly stands higher, and the rules that already apply to high ground -
 * further reach, heavier shots, sight over low ridges - apply to it. There is
 * nothing to explain beyond what can be seen.
 */
export const RAISE_HEIGHT = 0.45

/** each foundation raised costs more than the last: the ground bears so much */
export function raiseCost(alreadyRaised: number): number {
  return EARTHWORK_DEFS.rampart.cost + 30 * alreadyRaised
}

export interface EarthworkDef {
  kind: EarthworkKind
  name: string
  icon: string
  cost: number
  description: string
}

export const EARTHWORK_DEFS: Record<EarthworkKind, EarthworkDef> = {
  rampart: {
    kind: 'rampart', name: 'Raise ground', icon: 'quake', cost: 70,
    description: 'Raise this foundation onto high ground. The tower on it reaches +15% further, hits +10% harder, and sees over low ridges.',
  },
  cutting: {
    kind: 'cutting', name: 'Cutting', icon: 'spike', cost: 90,
    description: 'Sink the road into a channel. Ground enemies crossing it are slowed to 65% and take 18% more damage.',
  },
}

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
  /** the reach ring, shown while the earthwork is selected */
  private ring: THREE.Mesh | null = null

  constructor(readonly kind: EarthworkKind, readonly spot: EarthworkSpot) {
    this.def = EARTHWORK_DEFS[kind]
    this.group = buildModel(earthworkModel(kind), `earthwork:${kind}`, { receiveShadow: true })
    this.group.position.copy(spot.pos)
  }

  /** cuttings have no reach to show; kept so callers need not care which kind this is */
  showReach(on: boolean): void {
    if (this.ring) this.ring.visible = on
  }

  dispose(): void {
    this.group.removeFromParent()
  }
}

const C = {
  soil: 0x7a6240, soilDark: 0x5c4830, grass: 0x5f8f4a,
  stone: 0x8d8f96, timber: 0x6b4f2a,
  pitFloor: 0x3a2f22, pitWall: 0x2b2318,
}

function earthworkModel(kind: EarthworkKind): VoxModel {
  if (kind === 'rampart') {
    // every face sits clear of y=0: the terrain is already drawing there, and
    // coplanar geometry z-fights into stripes
    const bank: VoxBox[] = [
      box(0, 1.9, 0, 9.0, 3.2, 9.0, C.soil),
      box(0, 3.62, 0, 9.4, 0.35, 9.4, C.grass),
      box(0, 0.45, 0, 9.8, 0.7, 9.8, C.soilDark),
      box(-3.2, 4.15, -3.2, 1.2, 1.2, 1.2, C.stone),
      box(3.2, 4.15, 3.2, 1.2, 1.2, 1.2, C.stone),
    ]
    return { parts: { bank }, scale: 0.1 }
  }

  /**
   * A cutting cannot be a real hole: the road is opaque merged geometry that
   * is still drawn underneath, so a floor sunk below it would simply be
   * hidden. It is built instead as an excavation sitting proud of the road -
   * a dark recessed floor inside a rim of spoil, which is what digging a
   * channel actually leaves behind. Nothing touches y=0.
   */
  const dug: VoxBox[] = [
    box(0, 0.22, 0, 7.6, 0.36, 7.6, C.pitFloor),        // the sunken floor
    box(-3.9, 0.75, 0, 0.9, 1.5, 8.8, C.pitWall),       // channel walls
    box(3.9, 0.75, 0, 0.9, 1.5, 8.8, C.pitWall),
    box(0, 0.75, -3.9, 7.0, 1.5, 0.9, C.pitWall),
    box(0, 0.75, 3.9, 7.0, 1.5, 0.9, C.pitWall),
    // spoil heaped along the lip, so it reads as dug rather than painted
    box(-4.5, 1.65, -2.0, 1.1, 0.7, 3.2, C.soil),
    box(4.5, 1.65, 2.0, 1.1, 0.7, 3.2, C.soil),
    box(-2.0, 1.6, 4.5, 3.0, 0.6, 1.1, C.soilDark),
    box(2.2, 1.6, -4.5, 2.6, 0.6, 1.1, C.soilDark),
    // timber shoring at the ends
    box(-4.5, 1.9, -4.5, 1.0, 1.2, 1.0, C.timber),
    box(4.5, 1.9, 4.5, 1.0, 1.2, 1.0, C.timber),
  ]
  return { parts: { dug }, scale: 0.1 }
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
  limit = { cutting: 4 },
): { cell: [number, number], kind: EarthworkKind }[] {
  const out: { cell: [number, number], kind: EarthworkKind }[] = []
  const touchesRoad = (c: number, r: number) =>
    cellKind(c + 1, r) === 'road' || cellKind(c - 1, r) === 'road'
    || cellKind(c, r + 1) === 'road' || cellKind(c, r - 1) === 'road'

  /**
   * Lane mouths and the gate are crowded with authored scenery, and a
   * rampart dropped on the spawn arch simply disappears inside it. Keep
   * earthworks off both ends of every lane.
   */
  const SPAWN_GAP = 4
  const GATE_GAP = 3
  const ends: { cell: [number, number], gap: number }[] = []
  for (const lane of level.lanes) {
    if (!lane.length) continue
    ends.push({ cell: lane[0], gap: SPAWN_GAP })
    ends.push({ cell: lane[lane.length - 1], gap: GATE_GAP })
  }
  const nearEnd = (c: number, r: number) =>
    ends.some(e => Math.hypot(e.cell[0] - c, e.cell[1] - r) < e.gap)

  // Only cuttings are derived sites now. Raising the ground happens on the
  // foundations themselves, so there is nothing to scan grass for.
  const cuttings: [number, number][] = []
  for (let r = 0; r < level.height; r++) {
    for (let c = 0; c < level.width; c++) {
      if (nearEnd(c, r)) continue
      if (cellKind(c, r) === 'road' && !isTrapSpot(c, r)) cuttings.push([c, r])
    }
  }
  void touchesRoad
  // spread across the board instead of clustering wherever the scan started
  const spread = <T>(arr: T[], n: number): T[] => {
    if (arr.length <= n) return arr
    const step = arr.length / n
    return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step + step / 2)] ?? arr[arr.length - 1])
  }
  for (const cell of spread(cuttings, limit.cutting)) out.push({ cell, kind: 'cutting' })
  return out
}

/**
 * The bank a raised foundation stands on: a plot-sized block of cut earth
 * with a stone facing, sized so the plot slab sits flush on top of it.
 */
export function raisedGroundModel(): VoxModel {
  const h = RAISE_HEIGHT * 10
  const bank: VoxBox[] = [
    box(0, h / 2, 0, 10.4, h, 10.4, C.soil),
    box(0, h - 0.18, 0, 10.6, 0.36, 10.6, C.grass),
    // dressed-stone corners so it reads as built, not heaped
    box(-4.7, h / 2, -4.7, 1.1, h, 1.1, C.stone),
    box(4.7, h / 2, -4.7, 1.1, h, 1.1, C.stone),
    box(-4.7, h / 2, 4.7, 1.1, h, 1.1, C.stone),
    box(4.7, h / 2, 4.7, 1.1, h, 1.1, C.stone),
    box(0, 0.35, 0, 11.2, 0.7, 11.2, C.soilDark),
  ]
  return { parts: { bank }, scale: 0.1 }
}

export function earthworkSpotWorld(cell: [number, number], level: LevelDef): THREE.Vector3 {
  const [x, z] = gridToWorld(cell[0], cell[1], level.width, level.height)
  return new THREE.Vector3(x, 0, z)
}
