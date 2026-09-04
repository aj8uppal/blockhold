import type { SaveData } from '../core/save.ts'
import type { Difficulty, HeroId, TowerKind } from './types.ts'

/**
 * Account progression: experience, levels, and what each level unlocks.
 *
 * Six towers and three heroes on the first map is a menu, not a game. The
 * player has nothing to compare a Ballista against yet, and a Beacon is a
 * building whose entire value is what it does to buildings they have not
 * learned to use. Bloons gets this right: the campaign is also the tutorial
 * for the roster, and something new arrives every few maps, earned rather
 * than presented.
 *
 * So experience is earned by holding waves, and the roster opens as the
 * account levels. The unlock table is data: a new tower or hero is one line,
 * and the game never needs to know about it anywhere else.
 *
 * Three rules shape the numbers:
 *
 *   Every wave held is worth something, win or lose. A player who fell on
 *   wave 12 of 16 still learned twelve waves' worth.
 *
 *   Harder play is worth more. Veteran pays 40% over Normal; the Long Night
 *   pays per wave with no ceiling, which is where the last levels come from.
 *
 *   Nothing is retroactively taken away. A save from before this existed is
 *   seeded with the experience its stars and unlocks would have earned, so a
 *   player who has been using Liora for a month does not open the game to
 *   find her locked.
 */

export type UnlockKind = 'hero' | 'tower'

export interface UnlockDef {
  level: number
  kind: UnlockKind
  id: HeroId | TowerKind
  name: string
  /** one line, in the player's words, for the level-up card */
  blurb: string
}

/**
 * The ladder. Append to add a tower or hero; the level is the only design
 * decision. Levels with nothing on them are simply levels.
 */
export const UNLOCKS: UnlockDef[] = [
  { level: 5, kind: 'hero', id: 'liora', name: 'Liora the Gale Warden', blurb: 'A ranged champion who strikes the sky. Piercing Volley.' },
  { level: 10, kind: 'hero', id: 'zephyra', name: 'Zephyra the Stormcaller', blurb: 'Armor-ignoring bolts and a slowing Static Nova.' },
  { level: 15, kind: 'tower', id: 'ballista', name: 'The Ballista', blurb: 'A bolt that flies in a line and strikes everything along it.' },
  { level: 20, kind: 'tower', id: 'beacon', name: 'The Beacon', blurb: 'Never attacks. Makes every tower in its light stronger.' },
]

export const MAX_LEVEL = 40

/**
 * Cumulative experience needed to *be* a given level. Quadratic, tuned so
 * that against a normal-difficulty campaign: level 5 lands after about two
 * maps, 10 after about five, 15 near the end of the ten, and 20 needs Veteran
 * clears or the Long Night. Level 1 is the start and needs nothing.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  const n = level - 1
  return 14 * n * n + 50 * n
}

export function levelForXp(xp: number): number {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  return level
}

/** how far into the current level the player is, for a bar */
export function levelProgress(xp: number): { level: number, into: number, span: number } {
  const level = levelForXp(xp)
  const floor = xpForLevel(level)
  const ceil = level >= MAX_LEVEL ? floor : xpForLevel(level + 1)
  return { level, into: xp - floor, span: Math.max(1, ceil - floor) }
}

const DIFFICULTY_XP: Record<Difficulty, number> = { casual: 0.75, normal: 1, veteran: 1.4 }

export interface BattleXpInput {
  mode: 'campaign' | 'endless' | 'daily' | 'watches' | 'bellfoundry'
  difficulty: Difficulty
  wavesHeld: number
  won: boolean
  /** a campaign map beaten for the first time is worth extra */
  firstClear: boolean
}

/** experience for one finished battle */
export function battleXp(b: BattleXpInput): number {
  const mult = DIFFICULTY_XP[b.difficulty]
  switch (b.mode) {
    case 'campaign':
      return Math.round((b.wavesHeld * 12 + (b.won ? 120 : 0) + (b.won && b.firstClear ? 100 : 0)) * mult)
    case 'endless':
      return Math.round(b.wavesHeld * 12 * mult)
    case 'daily':
      return b.wavesHeld * 10 + (b.won ? 150 : 0)
    case 'watches':
    case 'bellfoundry':
      return b.wavesHeld * 8 + (b.won ? 60 : 0)
  }
}

/** everything the ladder opens at or below this level */
export function unlockedAt(level: number): UnlockDef[] {
  return UNLOCKS.filter(u => u.level <= level)
}

export function isUnlocked(save: Pick<SaveData, 'xp'>, kind: UnlockKind, id: string): boolean {
  const gate = UNLOCKS.find(u => u.kind === kind && u.id === id)
  if (!gate) return true              // anything not on the ladder is always available
  return levelForXp(save.xp) >= gate.level
}

export function unlockLevel(kind: UnlockKind, id: string): number | null {
  return UNLOCKS.find(u => u.kind === kind && u.id === id)?.level ?? null
}

/** the next thing the ladder will open, if anything */
export function nextUnlock(level: number): UnlockDef | null {
  return UNLOCKS.find(u => u.level > level) ?? null
}

/** what opened between two experience totals, in ladder order */
export function unlocksBetween(xpBefore: number, xpAfter: number): UnlockDef[] {
  const a = levelForXp(xpBefore), b = levelForXp(xpAfter)
  return UNLOCKS.filter(u => u.level > a && u.level <= b)
}

/**
 * Experience an older save would have earned by now.
 *
 * Used once, when a save with no `xp` field is loaded. It is generous on
 * purpose: the point is that nobody who already had Zephyra loses her.
 */
export function seedXpFromProgress(save: Pick<SaveData, 'stars' | 'unlocked' | 'medals' | 'bestEndless'>): number {
  let xp = 0
  for (const stars of Object.values(save.stars)) xp += stars * 110
  xp += Math.max(0, save.unlocked - 1) * 90
  for (const medals of Object.values(save.medals)) xp += medals.length * 80
  for (const deepest of Object.values(save.bestEndless)) xp += deepest * 6
  return xp
}
