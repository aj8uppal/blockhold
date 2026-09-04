import { DIFFICULTIES, type Difficulty, type DifficultyMods } from './types.ts'

/**
 * What a difficulty means on a particular map.
 *
 * Veteran used to be one flat number - 1.3x enemy health everywhere - and the
 * owner's intent for the long tail is that the last maps on Veteran should
 * not fall until the roster and the Armory are complete. A flat multiplier
 * cannot express that: it makes map one harder by exactly as much as map ten.
 *
 * So the multipliers are per map for the late campaign, and every consumer
 * reads them from here: spawning, bounty, the lives count, the elite roll, the
 * difficulty picker, the wave preview and both balance reports. The earlier
 * global table is still the source of the names and blurbs; this is the only
 * place that decides the numbers, so the picker can never show one figure
 * while the battle uses another.
 *
 * The late-map numbers start deliberately modest (1.30 / 1.35 / 1.40 rather
 * than the 1.45 / 1.55 / 1.65 first proposed): the static balance model already
 * has those maps peaking well above the holdable line on Veteran before any
 * raise, and elite affixes add roughly 7% average health on their own. Tune
 * upward only on play evidence, never on the model alone.
 */

export interface ResolvedDifficulty extends DifficultyMods {
  /** chance that a spawn on this board is a named elite */
  eliteChance: number
}

/** the three maps past the finale, where Veteran is meant to bite */
const LATE_VETERAN: Record<string, { enemyHp: number, eliteChance: number }> = {
  sunderfall: { enemyHp: 1.30, eliteChance: 0.12 },
  emberwind: { enemyHp: 1.35, eliteChance: 0.14 },
  tidereach: { enemyHp: 1.40, eliteChance: 0.16 },
}

export function difficultyMods(
  levelId: string | null,
  difficulty: Difficulty,
  mode: 'campaign' | 'endless' | 'freeplay' | 'other' = 'campaign',
): ResolvedDifficulty {
  const base = DIFFICULTIES[difficulty]
  let eliteChance = difficulty === 'veteran' ? 0.12 : mode === 'endless' || mode === 'freeplay' ? 0.08 : 0
  let enemyHp = base.enemyHp
  // the per-map bite is a campaign rule; the Long Night has its own ramp
  if (difficulty === 'veteran' && mode === 'campaign' && levelId && LATE_VETERAN[levelId]) {
    enemyHp = LATE_VETERAN[levelId].enemyHp
    eliteChance = LATE_VETERAN[levelId].eliteChance
  }
  return { ...base, enemyHp, eliteChance }
}

/** true for the maps whose Veteran clear is meant to need the full roster */
export function isGateMap(levelId: string): boolean {
  return levelId in LATE_VETERAN
}

export const GATE_MAP_IDS = Object.keys(LATE_VETERAN)
