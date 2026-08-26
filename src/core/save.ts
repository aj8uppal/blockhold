export interface SaveData {
  unlocked: number              // number of unlocked levels (>=1)
  stars: Record<string, number>
  armory: Record<string, number>  // upgrade track id -> purchased tier
  bestEndless: Record<string, number>  // level id -> deepest wave survived
  bestScore: Record<string, number>    // "levelId:difficulty|endless" -> best score
  medals: Record<string, string[]>     // level id -> earned medals (veteran, noleak)
  lastHero: string
  sfxMuted: boolean
  musicMuted: boolean
}

const KEY = 'blockhold.save.v1'
const MAX_LEVELS = 16

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback
  return Math.max(min, Math.min(max, n))
}

const DEFAULT_SAVE = (): SaveData =>
  ({ unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {}, lastHero: 'aldric', sfxMuted: false, musicMuted: false })

/** validate anything claiming to be a save; the same gate for disk and for imports */
export function parseSave(d: unknown): SaveData | null {
  try {
    {
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>
        const stars: Record<string, number> = {}
        if (o.stars && typeof o.stars === 'object') {
          for (const [k, v] of Object.entries(o.stars as Record<string, unknown>)) {
            stars[k] = clampInt(v, 0, 3, 0)
          }
        }
        const armory: Record<string, number> = {}
        if (o.armory && typeof o.armory === 'object') {
          for (const [k, v] of Object.entries(o.armory as Record<string, unknown>)) {
            armory[k] = clampInt(v, 0, 4, 0)
          }
        }
        const bestEndless: Record<string, number> = {}
        if (o.bestEndless && typeof o.bestEndless === 'object') {
          for (const [k, v] of Object.entries(o.bestEndless as Record<string, unknown>)) {
            bestEndless[k] = clampInt(v, 0, 999, 0)
          }
        }
        const bestScore: Record<string, number> = {}
        if (o.bestScore && typeof o.bestScore === 'object') {
          for (const [k, v] of Object.entries(o.bestScore as Record<string, unknown>)) {
            bestScore[k] = clampInt(v, 0, 99_999_999, 0)
          }
        }
        const medals: Record<string, string[]> = {}
        if (o.medals && typeof o.medals === 'object') {
          for (const [k, v] of Object.entries(o.medals as Record<string, unknown>)) {
            if (Array.isArray(v)) medals[k] = v.filter((m): m is string => typeof m === 'string' && m.length < 16)
          }
        }
        return {
          unlocked: clampInt(o.unlocked, 1, MAX_LEVELS, 1),
          stars,
          armory,
          bestEndless,
          bestScore,
          medals,
          lastHero: typeof o.lastHero === 'string' && /^[a-z]{1,24}$/.test(o.lastHero) ? o.lastHero : 'aldric',
          sfxMuted: !!o.sfxMuted,
          musicMuted: !!o.musicMuted,
        }
      }
    }
  } catch { /* corrupted input is not a save */ }
  return null
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return parseSave(JSON.parse(raw)) ?? DEFAULT_SAVE()
  } catch { /* corrupted save falls through to default */ }
  return DEFAULT_SAVE()
}

/**
 * Writes used to swallow failure silently, so a full quota or a locked-down
 * browser lost a player's whole campaign without ever saying so. It reports
 * now, and the HUD surfaces the first failure.
 */
export function writeSave(data: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/**
 * Ask the browser to keep this origin's data rather than treating it as
 * evictable cache. Best-effort storage really is evicted - an installed
 * Blockhold can lose 21 stars to a storage sweep - and the request is free.
 */
export async function requestDurableStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** the save as a copyable code, so progress can outlive one browser */
export function exportSave(data: SaveData): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, d: data }))))
}

/** restore from a code; returns null when it is not a Blockhold save */
export function importSave(code: string): SaveData | null {
  try {
    const raw = decodeURIComponent(escape(atob(code.trim())))
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const box = parsed as { v?: number, d?: unknown }
    if (box.v !== 1 || !box.d) return null
    return parseSave(box.d)   // same gate the on-disk save goes through
  } catch {
    return null
  }
}
