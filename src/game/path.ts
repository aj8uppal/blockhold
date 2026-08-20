import * as THREE from 'three'
import { LevelDef } from './types.ts'

/**
 * Lanes are axis-aligned waypoint polylines in grid coords. We convert to
 * world space, chamfer the corners so walkers turn smoothly, and provide
 * distance-parameterized sampling with a perpendicular offset (so enemies
 * don't walk single file).
 */

export interface PathSample { x: number, z: number, dirX: number, dirZ: number }

export class LanePath {
  readonly points: THREE.Vector2[] = []
  private cum: number[] = []
  readonly length: number

  constructor(worldPts: THREE.Vector2[], cornerRadius = 0.38) {
    // chamfer corners
    const pts: THREE.Vector2[] = [worldPts[0].clone()]
    for (let i = 1; i < worldPts.length - 1; i++) {
      const prev = worldPts[i - 1], cur = worldPts[i], next = worldPts[i + 1]
      const inDir = cur.clone().sub(prev).normalize()
      const outDir = next.clone().sub(cur).normalize()
      const a = cur.clone().sub(inDir.clone().multiplyScalar(cornerRadius))
      const b = cur.clone().add(outDir.clone().multiplyScalar(cornerRadius))
      pts.push(a)
      // quadratic corner: a couple of interpolated points through the elbow
      for (const t of [0.35, 0.65]) {
        const q1 = a.clone().lerp(cur, t)
        const q2 = cur.clone().lerp(b, t)
        pts.push(q1.lerp(q2, t))
      }
      pts.push(b)
    }
    pts.push(worldPts[worldPts.length - 1].clone())
    this.points = pts
    this.cum = [0]
    for (let i = 1; i < pts.length; i++) {
      this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]))
    }
    this.length = this.cum[this.cum.length - 1]
  }

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
    return {
      x: a.x + (b.x - a.x) * t + px * offset,
      z: a.y + (b.y - a.y) * t + pz * offset,
      dirX, dirZ,
    }
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

export interface PathsInfo {
  lanes: LanePath[]
  roadCells: Set<string>   // "c,r"
}

export const gridToWorld = (c: number, r: number, w: number, h: number): [number, number] =>
  [c - w / 2 + 0.5, r - h / 2 + 0.5]

export function buildPaths(level: LevelDef): PathsInfo {
  const roadCells = new Set<string>()
  const lanes = level.lanes.map(lane => {
    const world = lane.map(([c, r]) => {
      const [x, z] = gridToWorld(c, r, level.width, level.height)
      return new THREE.Vector2(x, z)
    })
    // rasterize road cells (axis-aligned segments)
    for (let i = 1; i < lane.length; i++) {
      const [c0, r0] = lane[i - 1], [c1, r1] = lane[i]
      if (c0 !== c1 && r0 !== r1) {
        console.warn(`level ${level.id}: lane segment not axis-aligned`, lane[i - 1], lane[i])
      }
      const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0)
      let c = c0, r = r0
      roadCells.add(`${c},${r}`)
      while (c !== c1 || r !== r1) { c += dc; r += dr; roadCells.add(`${c},${r}`) }
    }
    return new LanePath(world)
  })
  return { lanes, roadCells }
}
