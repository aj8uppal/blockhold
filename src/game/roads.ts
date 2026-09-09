import type { LanePath } from './path.ts'

/** One permanent crossing, with one outer causeway flooded at a time.
 * Three readable routes are enough to make the tide a positioning decision.
 */
export function closedRoadsFor(wave: number, lanes: number): Set<number> {
  if (lanes < 3 || wave < 3) return new Set()
  return new Set([1 + Math.floor(wave / 4) % (lanes - 1)])
}

export function openRoadFor(lane: number, lanes: number, closed: ReadonlySet<number>): number {
  if (!closed.has(lane)) return lane
  let best = 0, distance = Infinity
  for (let i = 0; i < lanes; i++) {
    if (closed.has(i)) continue
    if (Math.abs(i - lane) < distance) { best = i; distance = Math.abs(i - lane) }
  }
  return best
}

/** Flood only the closed branch, never a shared stretch still carrying foes. */
export function floodedRoadPoints(lanes: LanePath[], closed: ReadonlySet<number>): { x: number, z: number }[] {
  const points: { x: number, z: number }[] = []
  for (const i of closed) {
    const lane = lanes[i]
    if (!lane) continue
    for (let d = 0; d < lane.length; d += 0.9) {
      const p = lane.sample(d)
      if (lanes.some((l, li) => !closed.has(li) && l.distanceToPath(p.x, p.z) < 0.8)) continue
      points.push({ x: p.x, z: p.z })
    }
  }
  return points
}
