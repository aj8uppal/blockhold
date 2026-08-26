import { dailyNumber } from './ruleset.ts'

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

/** a link that drops a friend onto the exact same board */
export function challengeUrl(seed: number, base = location.href.split('#')[0].split('?')[0]): string {
  return `${base}?hold=${seed.toString(36)}`
}

/** read a challenge seed out of the current URL, if there is one */
export function readChallengeSeed(search = location.search): number | null {
  const m = /[?&]hold=([0-9a-z]+)/i.exec(search)
  if (!m) return null
  const n = parseInt(m[1], 36)
  return Number.isFinite(n) && n > 0 ? n >>> 0 : null
}

export { dailyNumber }
