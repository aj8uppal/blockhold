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
