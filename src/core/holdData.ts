/** Renderer-free, bounded Hold records shared by browser, cloud and room service. */
export const HOLD_MAPS = ['greenhollow', 'frostmere', 'emberwastes', 'mistfen', 'shatteredcrown', 'cinderwake', 'veilscar', 'sunderfall', 'emberwind', 'tidereach'] as const
export const HOLD_FAMILIES = ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon', 'seraph', 'tidecaller'] as const
export const HOLD_PATHS = ['bulwark', 'vanguard', 'hawkeye', 'gale', 'tempest', 'riftbinder'] as const
export const HOLD_THEMES = ['forest', 'winter', 'ember', 'void'] as const
export const HOLD_COLORS = ['ruby', 'sapphire', 'jade', 'gold'] as const
export const HOLD_WIDTH = 13, HOLD_HEIGHT = 11, HOLD_LIMIT = 80
export const HOLD_IDS: readonly string[] = [
  ...HOLD_MAPS.flatMap(id => [`watch:${id}`, `banner:${id}`, `statue:${id}`]),
  ...HOLD_FAMILIES.flatMap(id => [`pennant:${id}`, `mastery:${id}`]),
  ...HOLD_PATHS.map(id => `hero:${id}`), 'hunt:ossuary', 'hunt:empress',
  ...[15, 30, 60, 100].map(n => `endless:${n}`), 'daily:relic',
  ...['tree', 'rock', 'flowers', 'lamp'].flatMap(id => [0, 1, 2].map(n => `${id}:${n}`)),
]
const ids = new Set(HOLD_IDS)
export interface HoldPlacement { id: string, x: number, z: number, r: number }
export interface HoldLayout {
  version: 1
  name: string
  theme: typeof HOLD_THEMES[number]
  color: typeof HOLD_COLORS[number]
  keep: 'stone' | 'gilded'
  placements: HoldPlacement[]
  stored: string[]
  updatedAt: number
}
export interface HoldRecord extends HoldLayout { seen: string[], dailyWon: boolean }
export interface HoldSnapshot {
  version: 1, name: string, theme: HoldLayout['theme'], color: HoldLayout['color'], keep: HoldLayout['keep'],
  pieces: HoldPlacement[], date: number
}
export const blankHold = (): HoldRecord => ({ version: 1, name: 'Your Hold', theme: 'forest', color: 'ruby', keep: 'stone', placements: [], stored: [], seen: [], dailyWon: false, updatedAt: 0 })
export function holdIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && ids.has(id)))].sort() : []
}
export function holdFootprint(id: string, r = 0): [number, number] {
  const size: [number, number] = id.startsWith('watch:') || id.startsWith('hunt:') ? [2, 2] : [1, 1]
  return r % 2 ? [size[1], size[0]] : size
}
export function placementError(p: HoldPlacement, others: readonly HoldPlacement[]): string | null {
  if (!ids.has(p.id) || ![p.x, p.z, p.r].every(Number.isInteger) || p.r < 0 || p.r > 3) return 'Choose a valid piece and cell.'
  const [w, h] = holdFootprint(p.id, p.r)
  if (p.x < 0 || p.z < 0 || p.x + w > HOLD_WIDTH || p.z + h > HOLD_HEIGHT) return 'Keep the piece inside the courtyard.'
  for (let x = p.x; x < p.x + w; x++) for (let z = p.z; z < p.z + h; z++) {
    if (x >= 5 && x <= 7 && z >= 3 && z <= 5 || x === 6 && z >= 6) return 'Leave the keep and its approach clear.'
    for (const o of others) {
      if (o.id === p.id) continue
      const [ow, oh] = holdFootprint(o.id, o.r)
      if (x >= o.x && x < o.x + ow && z >= o.z && z < o.z + oh) return 'Another piece is here.'
    }
  }
  return null
}
function placements(value: unknown): HoldPlacement[] {
  const out: HoldPlacement[] = []
  if (!Array.isArray(value)) return out
  for (const v of value.slice(0, HOLD_LIMIT)) {
    if (!v || typeof v !== 'object' || out.some(p => p.id === v.id)) continue
    const p = { id: v.id, x: v.x, z: v.z, r: v.r } as HoldPlacement
    if (!placementError(p, out)) out.push(p)
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}
const nameOf = (v: unknown): string => typeof v === 'string' ? [...v.replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim()].slice(0, 24).join('') || 'Your Hold' : 'Your Hold'
const timeOf = (v: unknown, now: number): number => typeof v === 'number' && Number.isSafeInteger(v) ? Math.max(0, Math.min(now + 300_000, v)) : 0
export function sanitizeHold(value: unknown, now = Date.now()): HoldRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  if (v.version !== 1) return undefined
  const out = blankHold()
  out.name = nameOf(v.name)
  if (HOLD_THEMES.includes(v.theme as HoldLayout['theme'])) out.theme = v.theme as HoldLayout['theme']
  if (HOLD_COLORS.includes(v.color as HoldLayout['color'])) out.color = v.color as HoldLayout['color']
  out.keep = v.keep === 'gilded' ? 'gilded' : 'stone'
  out.placements = placements(v.placements)
  out.stored = holdIds(v.stored).filter(id => !out.placements.some(p => p.id === id))
  out.seen = holdIds(v.seen)
  out.dailyWon = v.dailyWon === true
  out.updatedAt = timeOf(v.updatedAt, now)
  return out
}
export function mergeHold(a?: HoldRecord, b?: HoldRecord): HoldRecord | undefined {
  if (!a) return b ? structuredClone(b) : undefined
  if (!b) return structuredClone(a)
  const layoutKey = (r: HoldRecord) => JSON.stringify([r.name, r.theme, r.color, r.keep, r.placements, r.stored])
  const recent = a.updatedAt === b.updatedAt ? layoutKey(a) >= layoutKey(b) ? a : b : a.updatedAt > b.updatedAt ? a : b
  return { ...structuredClone(recent), seen: holdIds([...a.seen, ...b.seen]), dailyWon: a.dailyWon || b.dailyWon }
}
/** Capture replaceable daily evidence before a later day's result can hide it. */
export function rememberHoldDaily<T extends { hold?: HoldRecord, dailyBest?: { won: boolean } }>(save: T): void {
  if (save.dailyBest?.won && !save.hold?.dailyWon) save.hold = { ...(save.hold ?? blankHold()), dailyWon: true }
}
export function sanitizeHoldSnapshot(value: unknown): HoldSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (v.version !== 1 || !Array.isArray(v.pieces) || v.pieces.length > HOLD_LIMIT || JSON.stringify(value).length > 6000) return null
  const clean = sanitizeHold({ ...v, placements: v.pieces })!
  if (clean.placements.length !== v.pieces.length || clean.name !== v.name || clean.theme !== v.theme || clean.color !== v.color || clean.keep !== v.keep) return null
  return { version: 1, name: clean.name, theme: clean.theme, color: clean.color, keep: clean.keep, pieces: clean.placements, date: timeOf(v.date, Date.now()) }
}
