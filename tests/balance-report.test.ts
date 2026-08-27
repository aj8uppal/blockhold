import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { enemyDef } from '../src/game/enemyDefs.ts'
import { levels } from '../src/game/levels.ts'
import { campaignScale } from '../src/game/balanceModel.ts'
import { towerTrees } from '../src/game/towerDefs.ts'
import {
  ASCEND_GOLD_COST,
  ASCEND_SHARD_COST,
  DIFFICULTIES,
  OVERCHARGE_SHARD_COST,
  PERKS,
  TRAP_DEFS,
  type LevelDef,
  type TowerLevelDef,
  type WaveDef,
} from '../src/game/types.ts'

const REPORT_PATH = fileURLToPath(new URL('../reviews/balance-report.md', import.meta.url))
const EARLY_CALL_BONUS_PER_PREVIOUS_WAVE = 20
const TOWER_SPEND_SHARE = 0.85
const ASSUMED_WAVE_SECONDS = 45
const CAPACITY_PRESSURE_RATIO = 1.2
const EARLY_FLYING_SHARE = 0.4
const HIGH_ARMOR = 0.4
const HIGH_MAGIC_RESIST = 0.5

interface WaveMetrics {
  wave: number
  hp: number
  income: number
  arrivalHpPerSecond: number
  flyingHp: number
  flyingShare: number
  highArmorShare: number
  highMagicResistShare: number
  cumulativeGold: number
  requiredDps: number
  affordableDps: number
  pressureFlags: string[]
}

interface LevelAnalysis {
  level: LevelDef
  waves: WaveMetrics[]
}

interface ShardAnalysis {
  level: LevelDef
  cutoffWave: number
  configuredStartShards: number
  shardbacksByCutoff: number
  shardbacksTotal: number
  bossesByCutoff: number
  bossesTotal: number
  shardsByCutoff: number
  shardsTotal: number
}

function midpoint(range: [number, number]): number {
  return (range[0] + range[1]) / 2
}

function tierDps(level: TowerLevelDef): number {
  if (level.damage && level.attackInterval) return midpoint(level.damage) / level.attackInterval
  if (level.soldier && level.soldierCount) {
    return level.soldierCount * midpoint(level.soldier.damage) / level.soldier.attackInterval
  }
  throw new Error(`Tower level ${level.name} has no modeled damage source`)
}

function averageTierOneToThreeDpsPerGold(): number {
  const rates = Object.values(towerTrees).flatMap(tree => {
    let cumulativeCost = 0
    return tree.levels.map(level => {
      cumulativeCost += level.cost
      return tierDps(level) / cumulativeCost
    })
  })
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length
}

/**
 * Campaign hardening is real HP, not a modelling choice: `Game.campaignHpScale`
 * multiplies it at spawn. Leaving it out here understated the back half of every
 * map by up to 2.1x and drew the report's "no capacity flags" conclusion from
 * numbers the game never actually spawns.
 */
function hpForGroup(wave: WaveDef, groupIndex: number, waveIndex: number, totalWaves: number): number {
  const group = wave.groups[groupIndex]
  return enemyDef(group.enemy).hp * DIFFICULTIES.normal.enemyHp * group.count
    * campaignScale(waveIndex, totalWaves)
}

function analyzeLevel(level: LevelDef, dpsPerGold: number): LevelAnalysis {
  let priorIncome = 0
  const waves: WaveMetrics[] = level.waves.map((wave, waveIndex) => {
    const scale = campaignScale(waveIndex, level.waves.length)
    const hp = wave.groups.reduce(
      (sum, _, groupIndex) => sum + hpForGroup(wave, groupIndex, waveIndex, level.waves.length), 0)
    const income = wave.groups.reduce((sum, group) => {
      return sum + enemyDef(group.enemy).bounty * DIFFICULTIES.normal.bounty * group.count
    }, 0)
    const arrivalHpPerSecond = wave.groups.reduce((sum, group) => {
      const def = enemyDef(group.enemy)
      return sum + def.hp * DIFFICULTIES.normal.enemyHp * scale * group.count / group.interval
    }, 0)
    const hpMatching = (predicate: (enemyId: string) => boolean) => wave.groups.reduce((sum, group) => {
      return sum + (predicate(group.enemy) ? enemyDef(group.enemy).hp * scale * group.count : 0)
    }, 0)
    const flyingHp = hpMatching(enemyId => enemyDef(enemyId).flying === true)
    const highArmorHp = hpMatching(enemyId => enemyDef(enemyId).armor >= HIGH_ARMOR)
    const highMagicResistHp = hpMatching(enemyId => enemyDef(enemyId).magicResist >= HIGH_MAGIC_RESIST)
    const cumulativeGold = level.startGold
      + priorIncome
      + waveIndex * EARLY_CALL_BONUS_PER_PREVIOUS_WAVE
    const requiredDps = hp / ASSUMED_WAVE_SECONDS
    const affordableDps = cumulativeGold * TOWER_SPEND_SHARE * dpsPerGold
    const pressureFlags: string[] = []

    if (requiredDps > affordableDps * CAPACITY_PRESSURE_RATIO) {
      pressureFlags.push(`DPS ${formatPercent(requiredDps / affordableDps - 1)} over capacity`)
    }
    if (waveIndex + 1 < 6 && flyingHp / hp > EARLY_FLYING_SHARE) {
      pressureFlags.push(`early flying ${formatPercent(flyingHp / hp)}`)
    }

    priorIncome += income
    return {
      wave: waveIndex + 1,
      hp,
      income,
      arrivalHpPerSecond,
      flyingHp,
      flyingShare: flyingHp / hp,
      highArmorShare: highArmorHp / hp,
      highMagicResistShare: highMagicResistHp / hp,
      cumulativeGold,
      requiredDps,
      affordableDps,
      pressureFlags,
    }
  })

  for (let start = 0; start < waves.length;) {
    if (waves[start].highMagicResistShare <= 0.5) {
      start += 1
      continue
    }
    let end = start + 1
    while (end < waves.length && waves[end].highMagicResistShare > 0.5) end += 1
    if (end - start >= 2) {
      for (let index = start; index < end; index += 1) {
        waves[index].pressureFlags.push(
          `high MR ${formatPercent(waves[index].highMagicResistShare)} (${end - start}-wave run)`,
        )
      }
    }
    start = end
  }

  return { level, waves }
}

function countEnemies(level: LevelDef, waveLimit: number, predicate: (enemyId: string) => boolean): number {
  return level.waves.slice(0, waveLimit).reduce((levelTotal, wave) => {
    return levelTotal + wave.groups.reduce((waveTotal, group) => {
      return waveTotal + (predicate(group.enemy) ? group.count : 0)
    }, 0)
  }, 0)
}

function droppedShards(level: LevelDef, waveLimit: number): number {
  return level.waves.slice(0, waveLimit).reduce((levelTotal, wave) => {
    return levelTotal + wave.groups.reduce((waveTotal, group) => {
      const def = enemyDef(group.enemy)
      return waveTotal + group.count * ((def.shardDrop ?? 0) + (def.boss ? 4 : 0))
    }, 0)
  }, 0)
}

function analyzeShards(level: LevelDef): ShardAnalysis {
  const cutoffWave = Math.ceil(level.waves.length * 2 / 3)
  const configuredStartShards = level.startShards ?? 0
  const shardback = (enemyId: string) => (enemyDef(enemyId).shardDrop ?? 0) > 0
  const boss = (enemyId: string) => enemyDef(enemyId).boss === true
  const shardbacksByCutoff = countEnemies(level, cutoffWave, shardback)
  const shardbacksTotal = countEnemies(level, level.waves.length, shardback)
  const bossesByCutoff = countEnemies(level, cutoffWave, boss)
  const bossesTotal = countEnemies(level, level.waves.length, boss)

  return {
    level,
    cutoffWave,
    configuredStartShards,
    shardbacksByCutoff,
    shardbacksTotal,
    bossesByCutoff,
    bossesTotal,
    shardsByCutoff: configuredStartShards + droppedShards(level, cutoffWave),
    shardsTotal: configuredStartShards + droppedShards(level, level.waves.length),
  }
}

function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: true,
  })
}

function formatInteger(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatPercent(value: number): string {
  return `${formatNumber(value * 100, 1)}%`
}

function waveFlags(metrics: WaveMetrics): string {
  const profile = [
    `arrival ${formatNumber(metrics.arrivalHpPerSecond)} HP/s`,
    `fly ${formatPercent(metrics.flyingShare)}`,
    `armor≥${HIGH_ARMOR} ${formatPercent(metrics.highArmorShare)}`,
    `MR≥${HIGH_MAGIC_RESIST} ${formatPercent(metrics.highMagicResistShare)}`,
  ]
  const pressure = metrics.pressureFlags.length > 0
    ? `**FLAG:** ${metrics.pressureFlags.join('; ')}`
    : 'no pressure flag'
  return `${profile.join('; ')}; ${pressure}`
}

function earlyFlyingRecommendation(analysis: LevelAnalysis, metrics: WaveMetrics): string {
  const wave = analysis.level.waves[metrics.wave - 1]
  const flyerGroups = wave.groups.filter(group => enemyDef(group.enemy).flying === true)
  const flyerIds = [...new Set(flyerGroups.map(group => group.enemy))]
  const flyerCount = flyerGroups.reduce((sum, group) => sum + group.count, 0)
  const nonFlyingHp = metrics.hp - metrics.flyingHp
  const allowedFlyingHp = EARLY_FLYING_SHARE / (1 - EARLY_FLYING_SHARE) * nonFlyingHp
  const representative = enemyDef(flyerIds[0])
  const retainedFlyerCount = Math.max(0, Math.floor(allowedFlyingHp / representative.hp))
  const moveCount = Math.max(1, flyerCount - retainedFlyerCount)
  const retainedFlyingHp = metrics.flyingHp - moveCount * representative.hp
  const revisedShare = retainedFlyingHp / (nonFlyingHp + retainedFlyingHp)
  const enemyLabel = flyerCount === 1 ? representative.name : `${representative.name}s`

  return `**${analysis.level.id} wave ${metrics.wave}:** defer ${moveCount} of ${flyerCount} ${enemyLabel} to wave 6; `
    + `the current ${formatPercent(metrics.flyingShare)} flying-HP opener falls to ${formatPercent(revisedShare)}, `
    + `below the ${formatPercent(EARLY_FLYING_SHARE)} anti-air pressure threshold without removing map HP.`
}

function latestShardbackWaveAtOrBefore(level: LevelDef, cutoffWave: number): number {
  for (let index = cutoffWave - 1; index >= 0; index -= 1) {
    if (level.waves[index].groups.some(group => (enemyDef(group.enemy).shardDrop ?? 0) > 0)) return index + 1
  }
  throw new Error(`No shardback wave found for ${level.id} by wave ${cutoffWave}`)
}

function shardRecommendation(shards: ShardAnalysis): string {
  const sourceWave = latestShardbackWaveAtOrBefore(shards.level, shards.cutoffWave)
  const movedShardbacks = countEnemies(
    { ...shards.level, waves: [shards.level.waves[sourceWave - 1]] },
    1,
    enemyId => (enemyDef(enemyId).shardDrop ?? 0) > 0,
  )
  const shardReduction = shards.level.waves[sourceWave - 1].groups.reduce((sum, group) => {
    return sum + group.count * (enemyDef(group.enemy).shardDrop ?? 0)
  }, 0)
  const revisedCutoffShards = shards.shardsByCutoff - shardReduction
  const targetWave = shards.cutoffWave + 1

  return `**${shards.level.id} shard timing:** move the ${movedShardbacks}-Shardback group (${movedShardbacks} Shardbacks) from wave ${sourceWave} `
    + `to wave ${targetWave}; shards available at the wave-${shards.cutoffWave} two-thirds mark drop from `
    + `${shards.shardsByCutoff} to ${revisedCutoffShards}, still funding one ${ASCEND_SHARD_COST}-shard ascension `
    + `but no longer front-loading ${Math.floor(shards.shardsByCutoff / ASCEND_SHARD_COST)} ascensions.`
}

function recommendations(analyses: LevelAnalysis[], shardAnalyses: ShardAnalysis[]): string[] {
  const earlyFlying = analyses.flatMap(analysis => analysis.waves
    .filter(wave => wave.pressureFlags.some(flag => flag.startsWith('early flying')))
    .map(wave => earlyFlyingRecommendation(analysis, wave)))
  const frontLoadedShards = shardAnalyses
    .slice(2)
    .filter(shards => shards.shardsByCutoff >= ASCEND_SHARD_COST * 2)
    .map(shardRecommendation)

  return [...earlyFlying, ...frontLoadedShards]
}

function renderLevel(analysis: LevelAnalysis): string {
  const rows = analysis.waves.map(wave => {
    const dps = `${formatNumber(wave.requiredDps)} / ${formatNumber(wave.affordableDps)} (gold ${formatInteger(wave.cumulativeGold)})`
    return `| ${wave.wave} | ${formatInteger(wave.hp)} | ${formatInteger(wave.income)} | ${dps} | ${waveFlags(wave)} |`
  })
  const flaggedWaves = analysis.waves.filter(wave => wave.pressureFlags.length > 0).length

  return [
    `## ${analysis.level.name} (\`${analysis.level.id}\`)`,
    '',
    `Start gold: ${analysis.level.startGold}. Waves: ${analysis.level.waves.length}. Pressure-flagged waves: ${flaggedWaves}.`,
    '',
    '| Wave | HP | Income | Required vs affordable DPS | Flags |',
    '| ---: | ---: | ---: | ---: | --- |',
    ...rows,
  ].join('\n')
}

function renderShardSummary(shardAnalyses: ShardAnalysis[]): string {
  const rows = shardAnalyses.map((shards, index) => {
    const targetMap = index >= 2
    const pass = shards.shardsByCutoff >= ASCEND_SHARD_COST
    return `| ${index + 1}. ${shards.level.id} | ${shards.level.waves.length} | ${shards.cutoffWave} | `
      + `${shards.configuredStartShards} | ${shards.shardbacksByCutoff} / ${shards.shardbacksTotal} | `
      + `${shards.bossesByCutoff} / ${shards.bossesTotal} | ${shards.shardsByCutoff} / ${shards.shardsTotal} | `
      + `${targetMap ? (pass ? '**PASS**' : '**FAIL**') : 'n/a'} | `
      + `${Math.floor(shards.shardsTotal / OVERCHARGE_SHARD_COST)} | ${Math.floor(shards.shardsTotal / ASCEND_SHARD_COST)} |`
  })

  return [
    '## Shard economy summary',
    '',
    `Costs imported from the game: overcharge ${OVERCHARGE_SHARD_COST} shards; ascension ${ASCEND_SHARD_COST} shards `
      + `plus ${ASCEND_GOLD_COST} gold. The pass/fail check is shard-only, as requested. Normal difficulty contributes `
      + 'zero estimated elite shards. Bosses add 4 shards each; Shardbacks use their defined 2-shard drop.',
    '',
    'An absent optional `startShards` field is counted as 0 in this definition-only analysis.',
    '',
    '| Map | Waves | ⅔ cutoff | Start shards | Shardbacks by cutoff / total | Bosses by cutoff / total | Shards by cutoff / total | Ascension by cutoff (maps 3–5) | Max total overcharges | Max total ascensions |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |',
    ...rows,
  ].join('\n')
}

function generateReport(): { report: string, dpsPerGold: number, totalWaves: number } {
  const dpsPerGold = averageTierOneToThreeDpsPerGold()
  const analyses = levels.map(level => analyzeLevel(level, dpsPerGold))
  const shardAnalyses = levels.map(analyzeShards)
  const tuning = recommendations(analyses, shardAnalyses)
  const totalWaves = analyses.reduce((sum, analysis) => sum + analysis.waves.length, 0)
  const capacityFlags = analyses.flatMap(analysis => analysis.waves)
    .filter(wave => wave.requiredDps > wave.affordableDps * CAPACITY_PRESSURE_RATIO).length
  const earlyFlyingFlags = analyses.flatMap(analysis => analysis.waves)
    .filter(wave => wave.pressureFlags.some(flag => flag.startsWith('early flying'))).length
  const sustainedMrFlags = analyses.flatMap(analysis => analysis.waves)
    .filter(wave => wave.pressureFlags.some(flag => flag.startsWith('high MR'))).length
  const trapCosts = Object.values(TRAP_DEFS).map(trap => trap.cost)
  const perkCount = Object.values(PERKS).flat().length

  const report = [
    '# Blockhold static balance report',
    '',
    'Generated from `enemyDefs.ts`, `towerDefs.ts`, `levels.ts`, and `types.ts` on normal difficulty.',
    '',
    '## Method',
    '',
    `- Tower efficiency **X = ${formatNumber(dpsPerGold, 4)} DPS/gold**, the mean of 12 tier-1–3 entries: `
      + 'damage midpoint ÷ attack interval ÷ cumulative cost. Barracks count all deployed soldiers.',
    `- Affordable DPS before a wave = (start gold + prior bounties + ${EARLY_CALL_BONUS_PER_PREVIOUS_WAVE} early-call gold per prior wave) `
      + `× ${formatPercent(TOWER_SPEND_SHARE)} tower spend × X. Required DPS = authored wave HP ÷ ${ASSUMED_WAVE_SECONDS}s.`,
    '- Arrival pressure is the requested rough Σ(enemy HP × count ÷ group interval). HP shares use authored group HP.',
    '- This deliberately static model excludes armor/MR from raw required DPS, lane coverage, travel time, splash, crowd control, healing, regen, phasing, surge empowerment, spawned/summoned adds, heroes, and armory bonuses.',
    `- The ${Object.keys(TRAP_DEFS).length} trap definitions (${Math.min(...trapCosts)}–${Math.max(...trapCosts)} gold), `
      + `${perkCount} ascension perk choices, and overcharge combat bonus are excluded from tower capacity; shard costs are analyzed separately.`,
    `- Across ${totalWaves} waves: **${capacityFlags} raw-DPS capacity flags**, **${earlyFlyingFlags} early-flying flags**, `
      + `and **${sustainedMrFlags} waves in sustained high-MR runs**.`,
    '',
    ...analyses.flatMap(analysis => [renderLevel(analysis), '']),
    renderShardSummary(shardAnalyses),
    '',
    '## Recommended tuning changes',
    '',
    ...tuning.map(item => `- ${item}`),
    '',
  ].join('\n')

  return { report, dpsPerGold, totalWaves }
}

describe('static balance report', () => {
  test('writes a complete report from the live TypeScript definitions', () => {
    const { report, dpsPerGold, totalWaves } = generateReport()
    // only write the report when explicitly requested; keeps the suite read-only
    if (process.env.WRITE_BALANCE_REPORT) {
      writeFileSync(REPORT_PATH, report, 'utf8')
    }

    expect(dpsPerGold).toBeGreaterThan(0)
    expect(totalWaves).toBe(levels.reduce((sum, level) => sum + level.waves.length, 0))
    for (const level of levels) {
      expect(report).toContain(`## ${level.name} (\`${level.id}\`)`)
      for (let wave = 1; wave <= level.waves.length; wave += 1) {
        expect(report).toContain(`| ${wave} |`)
      }
    }
    expect(report).toContain('## Shard economy summary')
    expect(report).toContain('## Recommended tuning changes')
    expect(report).not.toMatch(/\b(?:TODO|TBD|placeholder)\b/i)
    expect(report).not.toMatch(/\b(?:NaN|Infinity)\b/)
    const mapThreeToFiveShards = levels.slice(2).map(analyzeShards)
    expect(mapThreeToFiveShards.every(shards => shards.shardsByCutoff >= ASCEND_SHARD_COST)).toBe(true)
    expect(readFileSync(REPORT_PATH, 'utf8')).toBe(report)

    console.log(
      `Balance report written: ${REPORT_PATH} (${levels.length} levels, ${totalWaves} waves, X=${dpsPerGold.toFixed(4)} DPS/gold)`,
    )
  })
})
