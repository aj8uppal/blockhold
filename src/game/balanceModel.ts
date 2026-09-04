import { enemyDef } from './enemyDefs.ts'
import { buildPaths } from './path.ts'
import { towerTrees } from './towerDefs.ts'
import { type Difficulty, type LevelDef, type TowerKind, type TowerLevelDef, type WaveDef } from './types.ts'
import { difficultyMods } from './difficulty.ts'

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

/** a mid-tier tower's reach, used to decide which lanes a foundation can serve */
const PLOT_REACH = 3.6
const coverCache = new Map<string, number[]>()

/**
 * What share of the board's damage each lane can actually receive.
 *
 * A tower shoots the road it was built beside. Comparing a whole wave's HP
 * against the whole board's DPS therefore lets every gun defend every lane at
 * once, which is true on Greenhollow's single road and badly false on a
 * three-road map: Veilscar's wave 6 measured 0.53 - comfortable - while a bot
 * fielding 108% of the model's own affordable DPS lost the map there, because
 * its ten towers were answering three roads and only seven of twenty
 * foundations reach more than one.
 */
function laneShares(level: LevelDef): number[] {
  const hit = coverCache.get(level.id)
  if (hit) return hit
  const paths = buildPaths(level)
  const cover = paths.lanes.map(() => 0)
  for (const [c, r] of level.plots) {
    const x = c - (level.width - 1) / 2
    const z = r - (level.height - 1) / 2
    paths.lanes.forEach((lane, i) => {
      if (lane.distanceToPath(x, z) <= PLOT_REACH) cover[i]++
    })
  }
  /*
   * Normalised by the plot count, not by the sum of coverage: a foundation at
   * a junction serves both roads it reaches, so the shares deliberately sum to
   * more than one. Dividing by the sum instead would pretend a tower has to
   * choose, and would understate every map whose lanes converge.
   */
  const shares = cover.map(n => n / (level.plots.length || 1))
  coverCache.set(level.id, shares)
  return shares
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
/**
 * What a player brings to the board besides gold.
 *
 * The model used to assume every family on every map. That cannot express the
 * long tail's central promise - "this map on Veteran needs the Ballista and a
 * finished Armory" - so a profile names what is available: the unlocked
 * families, the starting gold the Armory adds, and the flat damage bonus a
 * beacon's light puts on the towers it reaches. It is still a static model and
 * it still knows nothing about placement, pierce or blocking; it is a
 * regression alarm for the gate, not a proof that the gate holds.
 */
export interface BuildProfile {
  kinds: TowerKind[]
  /** extra gold every battle starts with (Royal Coffers) */
  bonusGold: number
  /** multiplier on tower damage from the best beacon in reach, e.g. 1.22 */
  auraDamage: number
  /**
   * Consider both tier-4 branches rather than only the first. The campaign's
   * difficulty tests were tuned against branch A alone, so the default profile
   * keeps that; the gate profiles look at both, since a player grinding the
   * late maps will pick whichever side answers the board.
   */
  bothBranches?: boolean
}

export const BASE_KINDS: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks']
/** the roster before any grind: four families, nothing bought, nothing lit */
export const PRE_GRIND: BuildProfile = { kinds: BASE_KINDS, bonusGold: 0, auraDamage: 1, bothBranches: true }
/** level 20 with the board finished: every family, full Coffers, a High Beacon's light */
export const FULL_KIT: BuildProfile = {
  kinds: ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon'],
  bonusGold: 120,
  auraDamage: 1.22,
  bothBranches: true,
}
/** the baseline the campaign was tuned against: every family, nothing else */
const EVERYTHING: BuildProfile = {
  kinds: ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon'],
  bonusGold: 0,
  auraDamage: 1,
}

export function affordableDps(gold: number, plots = 14, profile: BuildProfile = EVERYTHING): number {
  const budget = gold * TOWER_SPEND_SHARE
  let best = 0
  for (const tree of Object.values(towerTrees)) {
    if (!profile.kinds.includes(tree.kind)) continue
    const rungs: { cost: number, def: TowerLevelDef }[] = []
    let running = 0
    for (const lvl of tree.levels) { running += lvl.cost; rungs.push({ cost: running, def: lvl }) }
    // both branches, both crowns: the best rung on either side counts
    for (const b of (profile.bothBranches ? [0, 1] : [0]) as (0 | 1)[]) {
      const branch = tree.branches[b]
      rungs.push({ cost: running + branch.cost, def: branch })
      const cap = tree.capstones[b]
      rungs.push({ cost: running + branch.cost + cap.cost, def: cap })
    }
    for (const rung of rungs) {
      if (!rung.def.damage || !rung.def.attackInterval) continue
      const dps = (rung.def.damage[0] + rung.def.damage[1]) / 2 / rung.def.attackInterval * profile.auraDamage
      const count = Math.min(plots, Math.floor(budget / rung.cost))
      best = Math.max(best, dps * count)
    }
  }
  return best
}

/** gold the player has plausibly banked by the start of a wave */
export function goldByWave(level: LevelDef, waveIndex: number, difficulty: Difficulty, bonusGold = 0): number {
  const bounty = difficultyMods(level.id, difficulty).bounty
  let gold = level.startGold + bonusGold
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
  level: LevelDef, wave: WaveDef, waveIndex: number, difficulty: Difficulty, profile: BuildProfile = EVERYTHING,
): WaveVerdict {
  const mods = difficultyMods(level.id, difficulty)
  const gold = goldByWave(level, waveIndex, difficulty, profile.bonusGold)
  const dps = affordableDps(gold, level.plots.length, profile)
  const surge = wave.surge ? 1.3 : 1

  /**
   * Towers focus-fire. An earlier version of this split the defense's output
   * evenly across everything walking, which made every wave in the game look
   * like a 5x leak - obviously wrong, since the game is winnable. Damage is
   * spent sequentially instead: the question is whether the whole wave can be
   * chewed through in the time the lane gives you.
   */
  /*
   * Judged per lane. Each road only receives the damage of the towers that can
   * reach it, and a wave is beaten only if every one of its roads holds - so
   * the wave's verdict is its worst road, not its average.
   */
  const shares = laneShares(level)
  const lanes = shares.map(() => ({ effortHp: 0, spawnSpan: 0, slowestTransit: 0 }))
  let effortHp = 0
  let worst: { name: string, cost: number } | null = null

  for (const g of wave.groups) {
    const d = enemyDef(g.enemy)
    const li = Math.min(g.lane ?? 0, lanes.length - 1)
    const speed = d.speed * (wave.surge ? 1.12 : 1)
    const transit = laneLengthFor(level, li) / speed
    lanes[li].slowestTransit = Math.max(lanes[li].slowestTransit, transit)
    lanes[li].spawnSpan = Math.max(lanes[li].spawnSpan, g.delay + g.interval * Math.max(0, g.count - 1))

    const physical = PHYSICAL_SHARE * (1 - d.armor)
    const magic = (1 - PHYSICAL_SHARE) * (1 - d.magicResist)
    let share = physical + magic
    if (d.flying) share *= ANTI_AIR_SHARE
    share = Math.max(0.05, share)

    const hp = d.hp * mods.enemyHp * surge * g.count * campaignScale(waveIndex, level.waves.length)
    const cost = hp / share
    lanes[li].effortHp += cost
    effortHp += cost
    if (!worst || cost > worst.cost) worst = { name: d.name, cost }
  }

  let ratio = 0
  let spawnSpan = 0
  let slowestTransit = 0
  lanes.forEach((ln, i) => {
    spawnSpan = Math.max(spawnSpan, ln.spawnSpan)
    slowestTransit = Math.max(slowestTransit, ln.slowestTransit)
    if (ln.effortHp <= 0) return
    const laneDps = dps * (shares[i] || 1)
    const timeAvailable = ln.spawnSpan + ln.slowestTransit * LANE_COVERAGE
    const timeToClear = laneDps > 0 ? ln.effortHp / laneDps : Infinity
    ratio = Math.max(ratio, timeToClear / Math.max(1, timeAvailable))
  })

  return {
    wave: waveIndex + 1,
    worstRatio: Number(ratio.toFixed(3)),
    leaker: worst?.name ?? null,
    hp: Math.round(effortHp),
    affordableDps: Math.round(dps),
    concurrent: Number((spawnSpan / Math.max(1, slowestTransit)).toFixed(2)),
  }
}

export function judgeLevel(level: LevelDef, difficulty: Difficulty, profile: BuildProfile = EVERYTHING): WaveVerdict[] {
  return level.waves.map((w, i) => judgeWave(level, w, i, difficulty, profile))
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
