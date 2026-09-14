import * as THREE from 'three'
import { LevelDef, LaneWaypoint } from './types.ts'

/**
 * Lanes are axis-aligned waypoint polylines in grid coords. We convert to
 * world space, chamfer the corners so walkers turn smoothly, and provide
 * distance-parameterized sampling with a perpendicular offset (so enemies
 * don't walk single file).
 */

/** `y` is the road surface under the sample; zero on every map whose roads stay on the ground */
export interface PathSample { x: number, y: number, z: number, dirX: number, dirZ: number }

/** the height a waypoint carries; the campaign authors none, so its roads all sit at 0 */
export const waypointHeight = (w: LaneWaypoint): number => w[2] ?? 0

/**
 * Height along one straight road segment, `s` cells from its first waypoint.
 *
 * A road is level for half a cell around every waypoint and ramps in a
 * straight line between those landings. That keeps every corner flat - a
 * corner cell turns, and a cell that turned *and* climbed would need a top
 * sloping two ways at once - and it means a waypoint cell always has exactly
 * the height its waypoint names, whichever segment is asking.
 */
export function rampHeight(h0: number, h1: number, s: number, cells: number): number {
  if (h0 === h1) return h0
  if (cells <= 1) return s < 0.5 ? h0 : h1
  const t = (s - 0.5) / (cells - 1)
  return h0 + (h1 - h0) * Math.min(1, Math.max(0, t))
}

/** what one chamfered segment of a lane stands on: a level landing, or part of a straight run */
type SegmentHeight =
  | { flat: number }
  | { fromX: number, fromZ: number, dirX: number, dirZ: number, cells: number, h0: number, h1: number }

export class LanePath {
  readonly points: THREE.Vector2[] = []
  private cum: number[] = []
  readonly length: number
  /** per chamfered segment; null while every waypoint of the lane sits at the same height */
  private heights: SegmentHeight[] | null = null
  private baseHeight = 0

  constructor(worldPts: THREE.Vector2[], cornerRadius = 0.38, waypointHeights?: number[]) {
    const h = (i: number) => waypointHeights?.[i] ?? 0
    const level = worldPts.every((_, i) => h(i) === h(0))
    this.baseHeight = h(0)
    const segs: SegmentHeight[] = []
    // the straight run from waypoint i toward waypoint i + 1
    const run = (i: number): SegmentHeight => {
      const from = worldPts[i], to = worldPts[i + 1]
      const cells = from.distanceTo(to)
      return { fromX: from.x, fromZ: from.y, dirX: (to.x - from.x) / (cells || 1), dirZ: (to.y - from.y) / (cells || 1), cells, h0: h(i), h1: h(i + 1) }
    }
    // chamfer corners
    const pts: THREE.Vector2[] = [worldPts[0].clone()]
    for (let i = 1; i < worldPts.length - 1; i++) {
      const prev = worldPts[i - 1], cur = worldPts[i], next = worldPts[i + 1]
      const inDir = cur.clone().sub(prev).normalize()
      const outDir = next.clone().sub(cur).normalize()
      const a = cur.clone().sub(inDir.clone().multiplyScalar(cornerRadius))
      const b = cur.clone().add(outDir.clone().multiplyScalar(cornerRadius))
      pts.push(a)
      segs.push(run(i - 1))
      // quadratic corner: a couple of interpolated points through the elbow
      for (const t of [0.35, 0.65]) {
        const q1 = a.clone().lerp(cur, t)
        const q2 = cur.clone().lerp(b, t)
        pts.push(q1.lerp(q2, t))
        segs.push({ flat: h(i) })
      }
      pts.push(b)
      segs.push({ flat: h(i) })
    }
    pts.push(worldPts[worldPts.length - 1].clone())
    segs.push(run(worldPts.length - 2))
    this.points = pts
    if (!level) this.heights = segs
    this.cum = [0]
    for (let i = 1; i < pts.length; i++) {
      this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    }
    this.length = this.cum[this.cum.length - 1]
  }

  /** is any part of this road off the ground? */
  get elevated(): boolean { return this.heights !== null || this.baseHeight !== 0 }

  sample(dist: number, offset = 0): PathSample {
    const d = Math.max(0, Math.min(this.length, dist))
    // binary search segment
    let lo = 0, hi = this.cum.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (this.cum[mid] <= d) lo = mid; else hi = mid
    }
    const segLen = this.cum[hi] - this.cum[lo] || 1e-6
    const t = (d - this.cum[lo]) / segLen
    const a = this.points[lo], b = this.points[hi]
    const dirX = (b.x - a.x) / segLen, dirZ = (b.y - a.y) / segLen
    // perpendicular (right of travel)
    const px = -dirZ, pz = dirX
    const cx = a.x + (b.x - a.x) * t, cz = a.y + (b.y - a.y) * t
    return {
      x: cx + px * offset,
      y: this.heights ? this.heightOn(lo, cx, cz) : this.baseHeight,
      z: cz + pz * offset,
      dirX, dirZ,
    }
  }

  /** road height at distance `dist`, without the rest of a sample */
  heightAt(dist: number): number {
    return this.heights ? this.sample(dist).y : this.baseHeight
  }

  private heightOn(segment: number, x: number, z: number): number {
    const seg = this.heights![Math.min(segment, this.heights!.length - 1)]
    if ('flat' in seg) return seg.flat
    const s = (x - seg.fromX) * seg.dirX + (z - seg.fromZ) * seg.dirZ
    return rampHeight(seg.h0, seg.h1, s, seg.cells)
  }

  /** distance along path of closest point to (x,z) — used for rally points / reinforcements */
  closestDistance(x: number, z: number): number {
    let best = 0, bestD = Infinity
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i]
      const abx = b.x - a.x, abz = b.y - a.y
      const len2 = abx * abx + abz * abz || 1e-9
      let t = ((x - a.x) * abx + (z - a.y) * abz) / len2
      t = Math.max(0, Math.min(1, t))
      const cx = a.x + abx * t, cz = a.y + abz * t
      const dd = (cx - x) ** 2 + (cz - z) ** 2
      if (dd < bestD) { bestD = dd; best = this.cum[i - 1] + Math.sqrt(len2) * t }
    }
    return best
  }

  distanceToPath(x: number, z: number): number {
    const d = this.closestDistance(x, z)
    const s = this.sample(d)
    return Math.hypot(s.x - x, s.z - z)
  }
}

/**
 * The top of one road cell. `lo` is the height at the cell's edge toward lower
 * column (axis x) or row (axis z) numbers and `hi` the opposite edge, so a
 * ramp cell is a plane tilted along its axis and a level cell has lo === hi.
 */
export interface RoadSurface { axis: 'x' | 'z', lo: number, hi: number }

export interface PathsInfo {
  lanes: LanePath[]
  roadCells: Set<string>   // "c,r"
  /** every road cell's surface; all level at 0 on a map with no raised roads */
  surfaces: Map<string, RoadSurface>
  /** road cells two lanes disagree about the height of (an authoring error) */
  surfaceConflicts: string[]
  /** true when any road leaves the ground */
  elevated: boolean
}

export const gridToWorld = (c: number, r: number, w: number, h: number): [number, number] =>
  [c - w / 2 + 0.5, r - h / 2 + 0.5]

/** height of a road surface at a point, `fx`/`fz` in 0..1 across the cell */
export function surfaceHeight(s: RoadSurface, fx: number, fz: number): number {
  if (s.lo === s.hi) return s.lo
  const f = Math.min(1, Math.max(0, s.axis === 'x' ? fx : fz))
  return s.lo + (s.hi - s.lo) * f
}

export function buildPaths(level: LevelDef): PathsInfo {
  const roadCells = new Set<string>()
  const surfaces = new Map<string, RoadSurface>()
  const surfaceConflicts: string[] = []
  const setSurface = (key: string, s: RoadSurface) => {
    const had = surfaces.get(key)
    if (!had) { surfaces.set(key, s); return }
    // a shared level cell agrees whichever axis it was reached along
    const same = had.lo === s.lo && had.hi === s.hi && (had.lo === had.hi || had.axis === s.axis)
    if (!same && !surfaceConflicts.includes(key)) surfaceConflicts.push(key)
  }
  const lanes = level.lanes.map(lane => {
    const world = lane.map(([c, r]) => {
      const [x, z] = gridToWorld(c, r, level.width, level.height)
      return new THREE.Vector2(x, z)
    })
    // rasterize road cells (axis-aligned segments)
    for (let i = 1; i < lane.length; i++) {
      const [c0, r0] = lane[i - 1], [c1, r1] = lane[i]
      const h0 = waypointHeight(lane[i - 1]), h1 = waypointHeight(lane[i])
      if (c0 !== c1 && r0 !== r1) {
        console.warn(`level ${level.id}: lane segment not axis-aligned`, lane[i - 1], lane[i])
      }
      const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0)
      const cells = Math.abs(c1 - c0) + Math.abs(r1 - r0)
      const axis = dc !== 0 ? 'x' : 'z'
      const forward = (dc || dr) > 0
      let c = c0, r = r0
      for (let k = 0; k <= cells; k++) {
        const key = `${c},${r}`
        roadCells.add(key)
        if (k === 0 || k === cells) {
          const flat = k === 0 ? h0 : h1
          setSurface(key, { axis, lo: flat, hi: flat })
        } else {
          const back = rampHeight(h0, h1, k - 0.5, cells), ahead = rampHeight(h0, h1, k + 0.5, cells)
          setSurface(key, { axis, lo: forward ? back : ahead, hi: forward ? ahead : back })
        }
        c += dc; r += dr
      }
    }
    return new LanePath(world, undefined, lane.map(waypointHeight))
  })
  const elevated = [...surfaces.values()].some(s => s.lo !== 0 || s.hi !== 0)
  return { lanes, roadCells, surfaces, surfaceConflicts, elevated }
}
