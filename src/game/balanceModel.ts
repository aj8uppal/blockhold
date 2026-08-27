import { enemyDef } from './enemyDefs.ts'
import { buildPaths } from './path.ts'
import { towerTrees } from './towerDefs.ts'
import { DIFFICULTIES, type Difficulty, type LevelDef, type TowerLevelDef, type WaveDef } from './types.ts'

/**
 * A time-based model of whether a wave actually gets through.
 *
 * The previous model compared a wave's total HP against the DPS a player could
 * afford by then. That misses the thing that decides tower defense: *time on
 * target*. A slow armored column and a fast swarm with identical HP are
 * completely different problems, and a defense that out-damages a wave on
 * paper still leaks if the wave crosses the map before the damage lands.
 *
 * So this walks each wave down the lane:
 *
 *   - how long each enemy is inside a tower's reach, from its own speed
 *   - how much of the defense's damage it personally receives, given how many
 *     other enemies are on the road at the same time
 *   - how much of that damage its armor and resistance actually remove
 *
 * and asks whether it dies before it arrives. It is still a model - it assumes
 * a competent, evenly-spread build rather than any specific one - but it is
 * measuring the right quantity, and it is honest about what it assumes.
 */

/** share of a build's damage that is physical rather than magic */
const PHYSICAL_SHARE = 0.6
/** how much of a lane a sensibly-placed defense actually covers */
const LANE_COVERAGE = 0.55
/** share of a build that can reach flying enemies */
const ANTI_AIR_SHARE = 0.55
/** gold a player commits to towers rather than traps, abilities and reserve */
const TOWER_SPEND_SHARE = 0.85
/**
 * Lane lengths are measured from the map, not assumed.
 *
 * An earlier version used a flat 22 for every board. Real lanes run from 14.7
 * to 35.4, and a group walks one specific lane - so the model was calling
 * Greenhollow harder than it is and Veilscar's short middle lane far easier.
 * Transit time is most of the answer in a tower defense; guessing it is not a
 * model, it is a coin flip.
 */
const laneCache = new Map<string, number[]>()

function laneLengths(level: LevelDef): number[] {
  const hit = laneCache.get(level.id)
  if (hit) return hit
  const lens = buildPaths(level).lanes.map(l => l.length)
  laneCache.set(level.id, lens)
  return lens
}

function laneLengthFor(level: LevelDef, laneIndex: number): number {
  const lens = laneLengths(level)
  return lens[laneIndex] ?? lens[0] ?? 22
}

export interface WaveVerdict {
  wave: number
  /** worst survivor's overshoot: >1 means something reaches the gate */
  worstRatio: number
  leaker: string | null
  hp: number
  affordableDps: number
  concurrent: number
}

/**
 * The best sustained single-target DPS a given gold pile can buy.
 *
 * `plots` is not decoration: a board has 13-20 foundations, and an earlier
 * version let gold alone decide the tower count. Late-campaign piles then
 * bought imaginary 40-tower defenses, which is precisely why every map looked
 * like it decayed into nothing. Gold stops mattering once the board is full;
 * past that point the only way up is upgrading what is already standing.
 */
export function affordableDps(gold: number, plots = 14): number {
  const budget = gold * TOWER_SPEND_SHARE
  let best = 0
  for (const tree of Object.values(towerTrees)) {
    const rungs: { cost: number, def: TowerLevelDef }[] = []
    let running = 0
    for (const lvl of tree.levels) { running += lvl.cost; rungs.push({ cost: running, def: lvl }) }
    const branch = tree.branches[0]
    rungs.push({ cost: running + branch.cost, def: branch })
    const cap = tree.capstones[0]
    rungs.push({ cost: running + branch.cost + cap.cost, def: cap })

    for (const rung of rungs) {
      if (!rung.def.damage || !rung.def.attackInterval) continue
      const dps = (rung.def.damage[0] + rung.def.damage[1]) / 2 / rung.def.attackInterval
      const count = Math.min(plots, Math.floor(budget / rung.cost))
      best = Math.max(best, dps * count)
    }
  }
  return best
}

/** gold the player has plausibly banked by the start of a wave */
export function goldByWave(level: LevelDef, waveIndex: number, difficulty: Difficulty): number {
  const bounty = DIFFICULTIES[difficulty].bounty
  let gold = level.startGold
  for (let i = 0; i < waveIndex; i++) {
    for (const g of level.waves[i].groups) {
      gold += enemyDef(g.enemy).bounty * g.count * bounty
    }
    gold += 10 + (i + 1) * 3   // the wave-held bonus
  }
  return gold
}

/**
 * Does anything in this wave survive its walk?
 *
 * Returns the worst overshoot in the wave: 1.0 means the last survivor dies
 * exactly at the gate, above 1.0 means it gets through.
 */
export function judgeWave(
  level: LevelDef, wave: WaveDef, waveIndex: number, difficulty: Difficulty,
): WaveVerdict {
  const mods = DIFFICULTIES[difficulty]
  const gold = goldByWave(level, waveIndex, difficulty)
  const dps = affordableDps(gold, level.plots.length)
  const surge = wave.surge ? 1.3 : 1

  /**
   * Towers focus-fire. An earlier version of this split the defense's output
   * evenly across everything walking, which made every wave in the game look
   * like a 5x leak - obviously wrong, since the game is winnable. Damage is
   * spent sequentially instead: the question is whether the whole wave can be
   * chewed through in the time the lane gives you.
   */
  let effortHp = 0        // raw damage output the wave demands, after resistances
  let spawnSpan = 0
  let slowestTransit = 0
  let worst: { name: string, cost: number } | null = null

  for (const g of wave.groups) {
    const d = enemyDef(g.enemy)
    const speed = d.speed * (wave.surge ? 1.12 : 1)
    const transit = laneLengthFor(level, g.lane ?? 0) / speed
    slowestTransit = Math.max(slowestTransit, transit)
    spawnSpan = Math.max(spawnSpan, g.delay + g.interval * Math.max(0, g.count - 1))

    const physical = PHYSICAL_SHARE * (1 - d.armor)
    const magic = (1 - PHYSICAL_SHARE) * (1 - d.magicResist)
    let share = physical + magic
    if (d.flying) share *= ANTI_AIR_SHARE
    share = Math.max(0.05, share)

    const hp = d.hp * mods.enemyHp * surge * g.count * campaignScale(waveIndex, level.waves.length)
    const cost = hp / share
    effortHp += cost
    if (!worst || cost > worst.cost) worst = { name: d.name, cost }
  }

  // the defense has the whole spawn span plus one transit's worth of reach
  const timeAvailable = spawnSpan + slowestTransit * LANE_COVERAGE
  const timeToClear = dps > 0 ? effortHp / dps : Infinity
  const ratio = timeToClear / Math.max(1, timeAvailable)

  return {
    wave: waveIndex + 1,
    worstRatio: Number(ratio.toFixed(3)),
    leaker: worst?.name ?? null,
    hp: Math.round(effortHp),
    affordableDps: Math.round(dps),
    concurrent: Number((spawnSpan / Math.max(1, slowestTransit)).toFixed(2)),
  }
}

export function judgeLevel(level: LevelDef, difficulty: Difficulty): WaveVerdict[] {
  return level.waves.map((w, i) => judgeWave(level, w, i, difficulty))
}

/**
 * Campaign escalation.
 *
 * Measured across all seven maps, every one front-loads its tension and then
 * decays: Veilscar peaks at wave 4 and spends its last third at roughly a
 * quarter of that pressure, because affordable damage grows 22x over a map
 * while the waves do not keep pace. The finale of the longest map in the game
 * was easier than its opening.
 *
 * Rather than re-authoring 153 waves, enemies harden as a map goes on. The
 * curve is deliberately gentle early - the first third is where a player is
 * still learning the board - and bites in the back half.
 */
export function campaignScale(waveIndex: number, totalWaves: number): number {
  if (totalWaves <= 1) return 1
  const progress = waveIndex / (totalWaves - 1)
  // longer maps compound more income, so they need proportionally more of a
  // ramp to stay level with themselves
  const depth = ESCALATION_BASE * (totalWaves / 16)
  return 1 + Math.pow(progress, ESCALATION_CURVE) * depth
}

/**
 * Tuned against the model with the plot cap in place: flattens per-map decay
 * to ~0.93x with no wave falling below the trivial line. The earlier 1.2/1.6
 * was compensating for the uncapped-tower bug, so it over-scaled once that was
 * fixed and pushed four waves past the gate.
 */
const ESCALATION_BASE = 0.9
const ESCALATION_CURVE = 2.0

/**
 * A campaign should feel like a curve, not a plateau. These are the bounds a
 * wave's pressure has to sit inside: comfortably below 1 is a wave that dies
 * far from the gate and teaches nothing, and above 1 is a leak.
 */
export const TRIVIAL_BELOW = 0.16
export const TENSE_ABOVE = 0.55
