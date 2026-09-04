import { RULESET_VERSION, dailyNumber } from './ruleset.ts'

/**
 * The shareable object.
 *
 * A finished run used to die in localStorage: no seed, no replay, no result,
 * nothing a player could hand to anyone. For a browser game that is the
 * distribution model, so this turns a run into something that travels.
 *
 * The block is drawn with block characters rather than emoji, which suits a
 * game called Blockhold and matches the project's no-emoji rule. It is
 * spoiler-free: it shows how far you held, never what you faced.
 */

export interface DailyResult {
  day: number
  outcomes: ('held' | 'leaked' | undefined)[]
  totalWaves: number
  wavesReached: number
  lives: number
  won: boolean
}

// Shade characters (▓▒░) render as dot patterns rather than solid blocks, so
// a held wave uses the full block: the bar has to read at a glance in a chat
// window, at whatever font the reader happens to have.
const HELD = '█'      // full block: wave held
const LEAKED = '▒'    // medium shade: something got through
const UNREACHED = '░' // light shade: never faced

export function dailyBlocks(r: DailyResult): string {
  let out = ''
  for (let i = 0; i < r.totalWaves; i++) {
    if (i >= r.wavesReached) out += UNREACHED
    else out += r.outcomes[i] === 'leaked' ? LEAKED : HELD
  }
  return out
}

/** the copyable result, spoiler-free */
export function dailyShareText(r: DailyResult, url: string): string {
  const head = `Blockhold Daily ${r.day}`
  const line = r.won
    ? `Held all ${r.totalWaves} waves - ${r.lives} lives left`
    : `Wave ${r.wavesReached}/${r.totalWaves}`
  return `${head}\n${line}\n${dailyBlocks(r)}\n${url}`
}

/**
 * A link that drops a friend onto the exact same board.
 *
 * The ruleset rides along with the seed. A seed alone is only half an address:
 * the same number played against different tower costs or enemy health is a
 * different board, so a link sent before a balance patch would quietly stop
 * meaning what its sender meant - and the "same board" promise the link makes
 * would be false with nothing to detect it.
 */
export function challengeUrl(seed: number, base = location.href.split('#')[0].split('?')[0]): string {
  return `${base}?hold=${seed.toString(36)}&r=${RULESET_VERSION}`
}

/** read a challenge seed out of the current URL, if there is one */
export function readChallengeSeed(search = location.search): number | null {
  const m = /[?&]hold=([0-9a-z]+)/i.exec(search)
  if (!m) return null
  const n = parseInt(m[1], 36)
  return Number.isFinite(n) && n > 0 ? n >>> 0 : null
}

/**
 * The ruleset a challenge link was created under.
 *
 * Links made before this was carried have no `r`, so they are treated as
 * ruleset 1 rather than as an error: they really were made under ruleset 1.
 */
export function readChallengeRuleset(search = location.search): number | null {
  if (!readChallengeSeed(search)) return null
  const m = /[?&]r=(\d{1,4})/.exec(search)
  return m ? parseInt(m[1], 10) : 1
}

/** whether a challenge link can still reproduce the board it was made from */
export function challengeIsCurrent(search = location.search): boolean {
  const r = readChallengeRuleset(search)
  return r === null || r === RULESET_VERSION
}

/**
 * What a challenge link points at.
 *
 * A bare `?hold=` is the Daily, which is where this started. A link can now
 * also name a campaign map and a mode, so the run people most want to brag
 * about - a deep Long Night - is finally sendable. Before this, the one number
 * worth sharing in the whole game could not leave the device that earned it.
 */
export interface Challenge {
  seed: number
  ruleset: number
  /** a campaign map id, or null for the Daily board */
  levelId: string | null
  endless: boolean
}

export function readChallenge(search = location.search): Challenge | null {
  const seed = readChallengeSeed(search)
  if (seed === null) return null
  const m = /[?&]m=([a-z0-9_-]{1,24})/i.exec(search)
  return {
    seed,
    ruleset: readChallengeRuleset(search) ?? 1,
    levelId: m ? m[1] : null,
    endless: /[?&]e=1\b/.test(search),
  }
}

/** a link onto a specific map, in a specific mode, from a specific seed */
export function runChallengeUrl(
  seed: number, levelId: string, endless: boolean,
  base = location.href.split('#')[0].split('?')[0],
): string {
  return `${challengeUrl(seed, base)}&m=${encodeURIComponent(levelId)}${endless ? '&e=1' : ''}`
}

export interface RunShare {
  levelName: string
  endless: boolean
  won: boolean
  wave: number
  totalWaves: number
  lives: number
  score: number
  /** the player's own record on this board before this run, if any */
  best?: number
}

/**
 * The copyable result for an ordinary run.
 *
 * Kept in the same voice as the daily block and deliberately short: something
 * that has to survive being pasted into a group chat cannot be a stat sheet.
 * The link is the payload - the numbers only exist to make someone click it.
 */
export function runShareText(r: RunShare, url: string): string {
  const head = r.endless ? `Blockhold · The Long Night · ${r.levelName}` : `Blockhold · ${r.levelName}`
  const line = r.endless
    ? `Survived to wave ${r.wave}${r.best && r.wave >= r.best ? ' (personal best)' : ''}`
    : r.won
      ? `Held all ${r.totalWaves} waves with ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} left`
      : `Fell at wave ${r.wave} of ${r.totalWaves}`
  return `${head}\n${line}\nBeat my hold: ${url}`
}

export { dailyNumber }
