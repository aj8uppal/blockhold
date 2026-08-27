/**
 * Merging two copies of a player's progress.
 *
 * Cloud sync cannot be last-write-wins over the whole save. A player who
 * clears Frostmere on their phone and then opens the game on a laptop that
 * has been sitting on an older save would watch the clear disappear. But it
 * cannot be "take the maximum of everything" either, because some fields are
 * legitimately allowed to go *down*: respeccing the Armory refunds tiers on
 * purpose, and undoing that would silently overspend the player's stars.
 *
 * So the save is split by how each field is allowed to move:
 *
 *   monotonic - stars, medals, records, unlocks. These only ever climb, so
 *   the higher (or the union) always wins, whichever device it came from.
 *
 *   mutable - the Armory loadout and the last hero. These are choices, not
 *   achievements, so the more recent write wins.
 *
 * Device settings (sound, music) are deliberately not synced at all: they
 * describe the device the player is on, not the player.
 */

export interface CloudSave {
  unlocked: number
  stars: Record<string, number>
  armory: Record<string, number>
  bestEndless: Record<string, number>
  bestScore: Record<string, number>
  medals: Record<string, string[]>
  lastHero: string
  dailyBest?: { day: number, wave: number, won: boolean, score: number }
  /** epoch ms of the write this copy came from; decides the mutable fields */
  updatedAt: number
}

const MAX_LEVELS = 16
const MAX_KEYS = 64
const MAX_KEY_LEN = 32

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.max(min, Math.min(max, n))
}

function numberMap(v: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {}
  if (!v || typeof v !== 'object') return out
  let n = 0
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (n++ >= MAX_KEYS || k.length > MAX_KEY_LEN) break
    out[k] = clampInt(val, 0, max, 0)
  }
  return out
}

/**
 * Validate anything claiming to be progress. The server runs this too: a
 * hand-edited client must not be able to inject 99 stars, unlock every map,
 * or store unbounded junk under a player's account.
 */
export function sanitizeCloudSave(v: unknown): CloudSave {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const medals: Record<string, string[]> = {}
  if (o.medals && typeof o.medals === 'object') {
    let n = 0
    for (const [k, val] of Object.entries(o.medals as Record<string, unknown>)) {
      if (n++ >= MAX_KEYS || k.length > MAX_KEY_LEN) break
      if (Array.isArray(val)) {
        medals[k] = [...new Set(val.filter((m): m is string => typeof m === 'string' && m.length < 16))].slice(0, 16)
      }
    }
  }
  const d = o.dailyBest && typeof o.dailyBest === 'object' ? o.dailyBest as Record<string, unknown> : null
  return {
    unlocked: clampInt(o.unlocked, 1, MAX_LEVELS, 1),
    stars: numberMap(o.stars, 3),
    armory: numberMap(o.armory, 4),
    bestEndless: numberMap(o.bestEndless, 999),
    bestScore: numberMap(o.bestScore, 99_999_999),
    medals,
    lastHero: typeof o.lastHero === 'string' && /^[a-z]{1,24}$/.test(o.lastHero) ? o.lastHero : 'aldric',
    dailyBest: d && typeof d.day === 'number' ? {
      day: clampInt(d.day, 0, 999_999, 0),
      wave: clampInt(d.wave, 0, 999, 0),
      won: !!d.won,
      score: clampInt(d.score, 0, 99_999_999, 0),
    } : undefined,
    updatedAt: clampInt(o.updatedAt, 0, Number.MAX_SAFE_INTEGER, 0),
  }
}

const maxMerge = (a: Record<string, number>, b: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v)
  return out
}

/** the better of two daily results: later day wins, then depth, then score */
function betterDaily(a: CloudSave['dailyBest'], b: CloudSave['dailyBest']): CloudSave['dailyBest'] {
  if (!a) return b
  if (!b) return a
  if (a.day !== b.day) return a.day > b.day ? a : b
  if (a.wave !== b.wave) return a.wave > b.wave ? a : b
  return a.score >= b.score ? a : b
}

export function mergeSaves(a: CloudSave, b: CloudSave): CloudSave {
  // whichever copy was written more recently owns the fields a player is
  // allowed to change their mind about
  const recent = b.updatedAt >= a.updatedAt ? b : a
  const medals: Record<string, string[]> = { ...a.medals }
  for (const [k, v] of Object.entries(b.medals)) {
    medals[k] = [...new Set([...(medals[k] ?? []), ...v])]
  }
  return {
    unlocked: Math.max(a.unlocked, b.unlocked),
    stars: maxMerge(a.stars, b.stars),
    bestEndless: maxMerge(a.bestEndless, b.bestEndless),
    bestScore: maxMerge(a.bestScore, b.bestScore),
    medals,
    dailyBest: betterDaily(a.dailyBest, b.dailyBest),
    // choices, not achievements: a respec must survive the merge
    armory: { ...recent.armory },
    lastHero: recent.lastHero,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  }
}
