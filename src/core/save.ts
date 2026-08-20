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

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const d: unknown = JSON.parse(raw)
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
  } catch { /* corrupted save falls through to default */ }
  return { unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {}, lastHero: 'aldric', sfxMuted: false, musicMuted: false }
}

export function writeSave(data: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* private mode etc. */ }
}
