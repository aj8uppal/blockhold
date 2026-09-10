import { parseSave, type SaveData } from '../core/save.ts'
import type { CoopCommand } from './coopCommands.ts'
import { RULESET_VERSION } from './ruleset.ts'
import type { Difficulty, HeroId, TowerKind, TrapKind } from './types.ts'

/** A frozen starting loadout plus ordered inputs reproduces mid-wave state. */
export interface BattleSession {
  ruleset: number
  levelId: string
  hunt?: 'ossuary' | 'empress'
  difficulty: Difficulty
  heroId: HeroId
  mode: 'campaign' | 'endless'
  seed: number
  /** Completed simulation ticks; inputs at this tick precede the next step. */
  tick: number
  commands: Array<{ tick: number, cmd: CoopCommand }>
  initialSave: SaveData
  savedAt: number
  wave: number
  /** Optional verification of reconstructed combat state; never a snapshot. */
  stateHash?: number
}

export type SessionReadIssue =
  | { kind: 'incompatible', savedRuleset: number, currentRuleset: number }
  | { kind: 'invalid' | 'storage' }

const KEY = 'blockhold.session.v1'
export const SESSION_MAX_TICKS = 60 * 60 * 12 * 60
export const SESSION_MAX_COMMANDS = 20_000
const MAX_BYTES = 4_000_000
const TOWERS: readonly TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks', 'beacon', 'ballista', 'seraph']
const TRAPS: readonly TrapKind[] = ['spike', 'frost', 'blast']
let lastReadIssue: SessionReadIssue | null = null

/** Read immediately after readSession; incompatible bytes remain recoverable. */
export function readSessionIssue(): SessionReadIssue | null { return lastReadIssue ? { ...lastReadIssue } : null }

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function integer(value: unknown, max: number, min = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

function coordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 4096
}

/** Reconstruct accepted commands so unknown fields cannot enter the executor. */
export function parseBattleCommand(value: unknown): CoopCommand | null {
  if (!record(value)) return null
  const { kind, plot, spot, x, z } = value
  switch (kind) {
    case 'build':
      return integer(plot, 4095) && TOWERS.includes(value.tower as TowerKind) ? { kind, plot, tower: value.tower as TowerKind } : null
    case 'upgrade':
      return integer(plot, 4095) && integer(value.opt, 1) ? { kind, plot, opt: value.opt } : null
    case 'ascend':
      return integer(plot, 4095) && (value.perk === 0 || value.perk === 1) ? { kind, plot, perk: value.perk } : null
    case 'sell':
    case 'overcharge':
    case 'mythic':
    case 'policy':
    case 'trackline':
    case 'raise':
      return integer(plot, 4095) ? { kind, plot } : null
    case 'holdline':
    case 'rally':
      return integer(plot, 4095) && coordinate(x) && coordinate(z) ? { kind, plot, x, z } : null
    case 'trap':
      return integer(spot, 4095) && TRAPS.includes(value.trap as TrapKind) ? { kind, spot, trap: value.trap as TrapKind } : null
    case 'sellTrap':
    case 'earthwork':
      return integer(spot, 4095) ? { kind, spot } : null
    case 'heroMove':
    case 'meteor':
    case 'reinforce':
      return coordinate(x) && coordinate(z) ? { kind, x, z } : null
    case 'wave':
    case 'overchargeAll':
    case 'heroSig':
    case 'heroRank':
    case 'hold':
      return { kind }
    case 'expand':
      return integer(value.c, 4095) && integer(value.r, 4095) ? { kind, c: value.c, r: value.r } : null
    default:
      return null
  }
}

function validate(value: unknown): BattleSession | null {
  if (!record(value) || value.ruleset !== RULESET_VERSION && value.ruleset !== 8) return null
  if (typeof value.levelId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value.levelId)) return null
  if (value.hunt !== undefined && value.hunt !== 'ossuary' && value.hunt !== 'empress') return null
  if (value.difficulty !== 'casual' && value.difficulty !== 'normal' && value.difficulty !== 'veteran') return null
  if (value.heroId !== 'aldric' && value.heroId !== 'liora' && value.heroId !== 'zephyra') return null
  if (value.mode !== 'campaign' && value.mode !== 'endless') return null
  if (value.hunt !== undefined && value.mode !== 'campaign') return null
  if (!integer(value.seed, 0xffffffff) || !integer(value.tick, SESSION_MAX_TICKS)) return null
  if (!integer(value.savedAt, Number.MAX_SAFE_INTEGER) || !integer(value.wave, 9999)) return null
  if (value.stateHash !== undefined && !integer(value.stateHash, 0xffffffff)) return null
  if (!Array.isArray(value.commands) || value.commands.length > SESSION_MAX_COMMANDS) return null
  const commands: BattleSession['commands'] = []
  let previousTick = 0
  for (const entry of value.commands) {
    if (!record(entry) || !integer(entry.tick, value.tick, previousTick)) return null
    const cmd = parseBattleCommand(entry.cmd)
    if (!cmd) return null
    commands.push({ tick: entry.tick, cmd })
    previousTick = entry.tick
  }
  // A starting save is captured by this ruleset. Missing/legacy XP would
  // silently migrate a different loadout, so reject it before parseSave.
  if (!record(value.initialSave) || !integer(value.initialSave.xp, 99_999_999)) return null
  const initialSave = parseSave(value.initialSave)
  if (!initialSave) return null
  return {
    ruleset: value.ruleset as number,
    levelId: value.levelId,
    ...(value.hunt === undefined ? {} : { hunt: value.hunt }),
    difficulty: value.difficulty,
    heroId: value.heroId,
    mode: value.mode,
    seed: value.seed,
    tick: value.tick,
    commands,
    initialSave,
    savedAt: value.savedAt,
    wave: value.wave,
    ...(value.stateHash === undefined ? {} : { stateHash: value.stateHash }),
  }
}

export function parseSession(value: unknown): BattleSession | null {
  try { return validate(value) } catch { return null }
}

/** Fail closed without overwriting an earlier valid journal on write failure. */
export function writeSession(session: BattleSession): boolean {
  try {
    const checked = validate(session)
    if (!checked) return false
    const raw = JSON.stringify(checked)
    if (raw.length > MAX_BYTES) return false
    localStorage.setItem(KEY, raw)
    return true
  } catch {
    return false
  }
}

export function readSession(): BattleSession | null {
  lastReadIssue = null
  let raw: string | null
  try { raw = localStorage.getItem(KEY) } catch {
    lastReadIssue = { kind: 'storage' }
    return null
  }
  if (raw === null) return null
  try {
    if (raw.length > MAX_BYTES) { lastReadIssue = { kind: 'invalid' }; return null }
    const value: unknown = JSON.parse(raw)
    if (record(value) && integer(value.ruleset, Number.MAX_SAFE_INTEGER) && value.ruleset !== RULESET_VERSION && value.ruleset !== 8) {
      lastReadIssue = { kind: 'incompatible', savedRuleset: value.ruleset, currentRuleset: RULESET_VERSION }
      return null
    }
    const session = validate(value)
    if (!session) lastReadIssue = { kind: 'invalid' }
    return session
  } catch {
    lastReadIssue = { kind: 'invalid' }
    return null
  }
}

export function clearSession(): boolean {
  try {
    localStorage.removeItem(KEY)
    lastReadIssue = null
    return true
  } catch {
    return false
  }
}
