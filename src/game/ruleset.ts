/**
 * A seed only reproduces a run against the same rules and the same content.
 *
 * Bump RULESET_VERSION whenever anything that changes the outcome of a
 * simulation changes: tower or enemy numbers, wave lists, hazard behaviour,
 * damage formulas, or the order in which the simulation draws from its RNG.
 * Anything that stores or shares a seed (replays, dailies, challenge links,
 * checkpoints) must record this alongside it, so a later balance patch
 * cannot silently rewrite an old result.
 *
 * Cosmetic changes - models, particles, sounds, UI - do not require a bump.
 *
 * History:
 *   1  first seeded build.
 *   2  the late-map enemy HP ramp, the ten-map campaign, and the Armory retune
 *      from a 25-star board to a 37-star one. All three change what a seed
 *      produces, and all three shipped while this constant still said 1 - so
 *      results from those builds are recorded under a version whose rules they
 *      were not played by. Bumping here is what stops that compounding.
 *   3  per-map Veteran health and elite chance on the three late maps, the
 *      Armory's six new tracks, the Veilward changing what a boss at the gate
 *      costs, and the freeplay ladder. All change what a seed produces.
 */
export const RULESET_VERSION = 3

/** identifies a reproducible run */
export interface RunStamp {
  ruleset: number
  seed: number
  levelId: string
  difficulty: string
  mode: string
}

export function runStamp(levelId: string, difficulty: string, mode: string, seed: number): RunStamp {
  return { ruleset: RULESET_VERSION, seed, levelId, difficulty, mode }
}

/** a fresh unpredictable seed for ordinary play */
export function newRunSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

/**
 * The seed everyone in the world shares on a given day.
 * Derived from the UTC date alone, so it needs no server to agree.
 */
export function dailySeed(date = new Date()): number {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1, d = date.getUTCDate()
  let h = 2166136261 >>> 0
  for (const ch of `${y}-${m}-${d}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** the day number shown next to a daily result, counting from launch */
export function dailyNumber(date = new Date()): number {
  const epoch = Date.UTC(2026, 7, 1)   // 2026-08-01
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - epoch) / 86400000)
  return Math.max(1, day + 1)
}
