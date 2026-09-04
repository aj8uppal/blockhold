import { cloud } from './cloud.ts'
import { safeLocal } from './boot.ts'
import { RULESET_VERSION } from '../game/ruleset.ts'

/**
 * The Daily leaderboard.
 *
 * The Daily already gave everyone the same board on the same day and a result
 * block to paste into a chat. What it could not answer was the question that
 * block immediately provokes: is wave nine any good? A number with nothing to
 * compare it to is a fact, not a reason to come back tomorrow.
 *
 * Everything here is optional and additive. A player with no account, no
 * network, or a sync service that is switched off gets exactly the Daily they
 * had before - a rank simply does not appear. Nothing on this path is allowed
 * to block, delay or fail a finished run.
 *
 * On trust: scores are submitted with the replay log that produced them, and
 * the server bounds-checks and stores both. It does NOT yet re-simulate them,
 * because the simulation cannot currently run without a renderer. So this is
 * honest fun, not a competitive ladder, and the code says so rather than
 * implying a guarantee it cannot make. Re-simulation is the real fix and it is
 * waiting on the simulation being separable from the game object.
 */

const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '')
const NICK_KEY = 'blockhold.nickname'
const TIMEOUT = 5000

export interface LeaderRow {
  rank: number
  nickname: string
  wave: number
  score: number
  won: boolean
}

export interface Leaderboard {
  day: number
  total: number
  top: LeaderRow[]
  you?: { rank: number, wave: number, score: number, nickname: string }
}

export interface SubmitResult {
  rank: number
  total: number
}

export function leaderboardEnabled(): boolean {
  return API.length > 0
}

/** the name shown beside a score; the player's to choose, and never required */
export function nickname(): string {
  return safeLocal.get(NICK_KEY) ?? ''
}

export function setNickname(name: string): void {
  safeLocal.set(NICK_KEY, name.replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 16))
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...cloud.authHeader(),
        ...init.headers,
      },
    })
    if (!res.ok) throw new Error(`leaderboard ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Post a finished Daily.
 *
 * Requires a cloud account, because a leaderboard needs something stable to
 * key a "best result today" against. One is created silently if the player has
 * none: it costs them nothing, carries no personal data, and is the same
 * anonymous token the cloud save already uses.
 */
export async function submitDaily(entry: {
  day: number
  seed: number
  wave: number
  lives: number
  won: boolean
  score: number
  replay?: unknown
}): Promise<SubmitResult | null> {
  if (!leaderboardEnabled()) return null
  try {
    if (!cloud.signedIn) return null
    const out = await call(`/v1/daily/${entry.day}/score`, {
      method: 'POST',
      body: JSON.stringify({
        seed: entry.seed,
        ruleset: RULESET_VERSION,
        wave: entry.wave,
        lives: entry.lives,
        won: entry.won,
        score: entry.score,
        nickname: nickname() || undefined,
        replay: entry.replay,
      }),
    }) as { rank: number, total: number }
    return { rank: out.rank, total: out.total }
  } catch {
    // a leaderboard that is down must never look like a run that did not count
    return null
  }
}

export async function fetchDaily(day: number): Promise<Leaderboard | null> {
  if (!leaderboardEnabled()) return null
  try {
    return await call(`/v1/daily/${day}`) as Leaderboard
  } catch {
    return null
  }
}
