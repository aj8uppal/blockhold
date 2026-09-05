import type { LevelDef, TowerKind, WaveDef, WaveGroup } from './types.ts'
import { campaignScale, goldByWave, type BuildProfile } from './balanceModel.ts'
import { levels } from './levels.ts'

/**
 * Trials: two short variants of every campaign map, each worth one Armory star.
 *
 * Kingdom Rush's Heroic and Iron challenges are where its star economy stops
 * being a grade and becomes a pursuit: each map hides two more stars behind a
 * six-wave sprint with one life and a single continuous siege with a
 * restricted arsenal. The Armory here costs 60 stars against 40 earnable from
 * the campaign and Veteran crowns; the twenty trial stars are the rest.
 *
 * Both trials play by Normal enemy rules with the Armory switched off, six
 * shards, one life, Aldric at level one, and no capstones (a tier-four
 * ceiling), so they test the map and the player rather than the account.
 *
 *   Relief Siege - the map's last waves, with a bank of gold and the four
 *   starter families. The board is empty and the tide is already at its peak:
 *   the question is what to build first when there is no time to learn.
 *
 *   Silent Guns - every wave of the map, back to back with five-second gaps,
 *   no early calls, and only arrows, mages and barracks. No cannons and no
 *   engines, so the crowd control has to come from placement and blocking.
 *
 * Starting gold is not hand-tuned per map; it is derived from the campaign's
 * own economy (see trialGold), so a new map or a rebalanced wave list gets a
 * fair trial without anyone remembering to retune twenty numbers. The Armory
 * is off, so the tide is thinned by roughly the share a full Armory would
 * have taken (TRIAL_HP), and the three late maps - which the campaign itself
 * tunes for the full roster - open every family. tests/trials.test.ts holds
 * each trial to the model's verdict on the campaign's own finale.
 */
export type TrialKind = 'relief' | 'silent'
export const TRIAL_KINDS: TrialKind[] = ['relief', 'silent']

export interface TrialDef {
  kind: TrialKind
  levelId: string
  name: string
  blurb: string
  /** the one-line rule card shown as the battle opens */
  rules: string
  waves: WaveDef[]
  startGold: number
  lives: number
  shards: number
  /** families allowed on this board */
  kinds: TowerKind[]
  /** highest tier a tower may reach */
  maxTier: number
  /** may waves be called in early */
  earlyCall: boolean
}

export const TRIAL_NAMES: Record<TrialKind, string> = { relief: 'Relief Siege', silent: 'Silent Guns' }
export const TRIAL_ICONS: Record<TrialKind, string> = { relief: 'flag', silent: 'soundOff' }

const RELIEF_KINDS: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks']
const SILENT_KINDS: TowerKind[] = ['arrow', 'mage', 'barracks']
const ALL_KINDS: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon']
/** the campaign tunes its last three maps for the whole roster and the Armory */
const LATE_MAP_FROM = 7
/** the Armory is off in a trial, so the tide is thinned by about the share it would have taken */
export const TRIAL_HP = 0.85
/** share of a campaign player's bank at the relief point that the relief column arrives with */
const RELIEF_BANK_SHARE = 0.6
/** the late maps assumed a full Armory; with it off, the column arrives better funded */
const LATE_RELIEF_BANK_SHARE = 0.75

/** the three maps the campaign tunes for the whole roster and the Armory */
export function isLateMap(level: LevelDef): boolean {
  return levels.findIndex(l => l.id === level.id) >= LATE_MAP_FROM
}
/** Silent Guns pays no wave-held bonuses and gives no breaks; the bank makes up for both */
const SILENT_BANK_MULT = 1.75
const TRIAL_LIVES = 1
const TRIAL_SHARDS = 6
const TRIAL_TIER = 4
/** the wave-to-wave gap in Silent Guns */
const SILENT_GAP = 5

/** how long a wave keeps spawning, from its groups */
function waveSpan(w: WaveDef): number {
  let span = 0
  for (const g of w.groups) span = Math.max(span, g.delay + g.interval * Math.max(0, g.count - 1))
  return span
}

/** a wave with every group carrying the campaign's scaling for its source index */
function scaled(w: WaveDef, srcIndex: number, total: number): WaveDef {
  const k = campaignScale(srcIndex, total) * TRIAL_HP
  return { ...w, groups: w.groups.map(g => ({ ...g, hpMult: (g.hpMult ?? 1) * k })) }
}

/** the waves a Relief Siege fights: the last three eighths of the map, at least five */
export function reliefWaves(level: LevelDef): WaveDef[] {
  const n = level.waves.length
  const count = Math.min(n, Math.max(5, Math.round(n * 0.375)))
  const start = n - count
  return level.waves.slice(start).map((w, i) => scaled(w, start + i, n))
}

/** the one wave of Silent Guns: the whole map, each wave starting five seconds after the last ends */
export function silentWave(level: LevelDef): WaveDef {
  const n = level.waves.length
  const groups: WaveGroup[] = []
  let t = 0
  level.waves.forEach((w, i) => {
    const k = campaignScale(i, n) * TRIAL_HP
    for (const g of w.groups) groups.push({ ...g, delay: g.delay + t, hpMult: (g.hpMult ?? 1) * k })
    t += waveSpan(w) + SILENT_GAP
  })
  return { groups, breakAfter: 0 }
}

/** the families a trial allows on this map */
export function trialKinds(level: LevelDef, kind: TrialKind): TowerKind[] {
  if (kind === 'silent') return SILENT_KINDS
  return isLateMap(level) ? ALL_KINDS : RELIEF_KINDS
}

/** the build the model may assume in a trial: the trial's families, no Armory, no capstones */
export function trialProfile(level: LevelDef, kind: TrialKind, bonusGold = 0): BuildProfile {
  return { kinds: trialKinds(level, kind), bonusGold, auraDamage: 1, bothBranches: true, maxTier: TRIAL_TIER }
}

/** the trial as a level the game can run: waves swapped, scaling carried by the groups */
export function trialLevel(level: LevelDef, kind: TrialKind, startGold: number): LevelDef {
  return {
    ...level,
    waves: kind === 'relief' ? reliefWaves(level) : [silentWave(level)],
    startGold,
    startLives: TRIAL_LIVES,
    startShards: TRIAL_SHARDS,
    flatScale: true,
    intro: undefined,
  }
}

/**
 * The trial's bank, from the campaign's own economy.
 *
 * Relief: a campaign player reaching the relief point holds a bank of gold
 * plus a board of towers worth about as much again; the relief column gets
 * sixty percent of that bank as cash, for an empty board. Silent: the map's
 * starting gold plus every wave-held bonus the campaign would have paid and
 * the siege does not, raised for the breaks that are not there.
 */
export function trialGold(level: LevelDef, kind: TrialKind): number {
  const round50 = (g: number) => Math.max(400, Math.round(g / 50) * 50)
  const n = level.waves.length
  if (kind === 'relief') {
    const start = n - reliefWaves(level).length
    return round50(goldByWave(level, start, 'normal') * (isLateMap(level) ? LATE_RELIEF_BANK_SHARE : RELIEF_BANK_SHARE))
  }
  let bonuses = 0
  for (let i = 0; i < n; i++) bonuses += 10 + (i + 1) * 3
  return round50((level.startGold + bonuses) * SILENT_BANK_MULT)
}

const cache = new Map<string, TrialDef>()

export function trialFor(level: LevelDef, kind: TrialKind): TrialDef {
  const key = `${level.id}:${kind}`
  const hit = cache.get(key)
  if (hit) return hit
  const startGold = trialGold(level, kind)
  const relief = kind === 'relief'
  const waves = relief ? reliefWaves(level) : [silentWave(level)]
  const def: TrialDef = {
    kind, levelId: level.id, name: TRIAL_NAMES[kind],
    blurb: relief
      ? `The last ${waves.length} waves of ${level.name}, from an empty board. One life.`
      : `Every wave of ${level.name}, back to back. One life. Arrows, mages and barracks only.`,
    rules: relief
      ? `Relief Siege: ${waves.length} waves, one life, ${startGold} gold. ${trialKinds(level, kind).length === ALL_KINDS.length ? 'Every family' : 'Arrows, mages, cannons and barracks'}; no capstones, no Armory.`
      : `Silent Guns: one unbroken siege, one life, ${startGold} gold. Arrows, mages and barracks only; no capstones, no Armory, no early calls.`,
    waves, startGold, lives: TRIAL_LIVES, shards: TRIAL_SHARDS,
    kinds: trialKinds(level, kind),
    maxTier: TRIAL_TIER,
    earlyCall: relief,
  }
  cache.set(key, def)
  return def
}

/** the trials won on a map, from the save */
export function trialsWon(trials: Record<string, string[]> | undefined, levelId: string): TrialKind[] {
  return (trials?.[levelId] ?? []).filter((t): t is TrialKind => TRIAL_KINDS.includes(t as TrialKind))
}
