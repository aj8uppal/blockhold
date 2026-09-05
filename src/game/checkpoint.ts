import type { Difficulty, HeroId, TowerKind, TrapKind } from './types.ts'
import type { TargetPolicy } from './towers.ts'
import { RULESET_VERSION } from './ruleset.ts'

/**
 * Mid-battle resume.
 *
 * A campaign map runs 16 to 28 waves. Closing the tab at wave 24 of 28 used
 * to destroy the whole run, which is a bad trade on a phone where sessions
 * get interrupted by everything.
 *
 * The snapshot is taken at cleared-wave boundaries only: no enemies in
 * flight, no projectiles, no particles mid-arc, so there is nothing
 * transient to serialise and the restored battle is exactly the one the
 * player left. It records the run seed and ruleset, so a resumed battle
 * continues the same simulation rather than a new one.
 */

const KEY = 'blockhold.checkpoint.v1'

export interface TowerSnapshot {
  plot: number
  kind: TowerKind
  level: number
  branch: 0 | 1 | null
  perk: string | null
  policy: TargetPolicy
  overchargeUntil?: number
}

export interface TrapSnapshot {
  spot: number
  kind: TrapKind
}

export interface Checkpoint {
  ruleset: number
  levelId: string
  difficulty: Difficulty
  heroId: HeroId
  endless: boolean
  seed: number
  /** the next wave to run; the field was clear when this was taken */
  waveIndex: number
  gold: number
  lives: number
  shards: number
  time: number
  goldEarned: number
  shardsEarned: number
  killCount: number
  perfectWaves: number
  /** enemies that reached the gate so far, absorbed ones included; older checkpoints have none */
  leaks?: number
  defenseStreak: number
  bestStreak: number
  earlyCallSeconds: number
  heroLevel: number
  heroXp: number
  towers: TowerSnapshot[]
  traps: TrapSnapshot[]
  /** foundations the player raised, by plot index; older checkpoints have none */
  raisedPlots?: number[]
  savedAt: number
}

export function writeCheckpoint(c: Checkpoint): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
    return true
  } catch {
    return false
  }
}

export function clearCheckpoint(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}

/**
 * A checkpoint is only playable against the rules it was taken under, so a
 * balance patch discards it rather than silently continuing a run under
 * different numbers.
 */
export function readCheckpoint(): Checkpoint | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const c = JSON.parse(raw) as Checkpoint
    if (!c || typeof c !== 'object') return null
    if (c.ruleset !== RULESET_VERSION) { clearCheckpoint(); return null }
    if (typeof c.levelId !== 'string' || typeof c.waveIndex !== 'number') return null
    if (!Array.isArray(c.towers) || !Array.isArray(c.traps)) return null
    if (c.waveIndex < 1) return null      // nothing worth resuming yet
    return c
  } catch {
    return null
  }
}

export function hasCheckpoint(): boolean {
  return readCheckpoint() !== null
}
