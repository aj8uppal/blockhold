import { LevelDef, WaveDef } from './types.ts'

// Wave authoring helper: g(enemy, count, interval, delay, lane)
const g = (enemy: string, count: number, interval: number, delay = 0, lane = 0) =>
  ({ enemy, count, interval, delay, lane })

const greenhollowWaves: WaveDef[] = [
  { groups: [g('husk', 8, 1.7)] },
  { groups: [g('husk', 12, 1.4)] },
  { groups: [g('husk', 8, 1.5), g('sprinter', 4, 1.6, 6)] },
  { groups: [g('sprinter', 9, 1.2), g('husk', 6, 1.6, 4)] },
  { groups: [g('shield', 5, 2.2), g('husk', 8, 1.3, 3)] },
  { groups: [g('gargoyle', 6, 1.8), g('sprinter', 8, 1.1, 5), g('shardback', 2, 5, 8)] },
  { surge: true, groups: [g('shield', 8, 1.8), g('husk', 10, 1.0, 6), g('sprinter', 5, 1.4, 12)] },
  { groups: [g('gargoyle', 8, 1.4), g('shield', 5, 2.0, 4), g('sprinter', 6, 1.2, 10)] },
  { groups: [g('husk', 16, 0.8), g('sprinter', 10, 1.0, 8), g('shield', 6, 1.8, 12), g('shardback', 2, 6, 14)] },
  { groups: [g('hollowking', 1, 1, 6), g('husk', 12, 1.0, 0), g('gargoyle', 6, 1.4, 12)], breakAfter: 30 },
  { groups: [g('shield', 8, 1.6), g('sprinter', 10, 1.0, 5), g('shardback', 2, 5, 9)] },
  { surge: true, groups: [g('husk', 18, 0.7), g('gargoyle', 8, 1.3, 6), g('shield', 6, 1.7, 10)] },
  { groups: [g('brute', 2, 8), g('sprinter', 12, 0.9, 4), g('shardback', 2, 5, 10)] },
  { groups: [g('gargoyle', 12, 1.1), g('shield', 8, 1.5, 5), g('husk', 12, 0.9, 9)] },
  { surge: true, groups: [g('sprinter', 14, 0.8), g('shield', 9, 1.5, 4), g('gargoyle', 8, 1.2, 10), g('shardback', 2, 5, 13)] },
  { groups: [g('hollowking', 1, 1, 8), g('brute', 2, 7), g('husk', 20, 0.65, 3), g('gargoyle', 10, 1.1, 8), g('shield', 8, 1.4, 12)] },
]

const frostmereWaves: WaveDef[] = [
  { groups: [g('husk', 7, 1.6), g('husk', 5, 1.6, 4, 1)] },
  { groups: [g('sprinter', 6, 1.3), g('husk', 8, 1.4, 2, 1)] },
  { groups: [g('shield', 5, 2.0), g('sprinter', 7, 1.2, 4, 1)] },
  { groups: [g('acolyte', 4, 2.4), g('husk', 10, 1.2, 3, 1)] },
  { groups: [g('gargoyle', 6, 1.6), g('shield', 5, 2.0, 5, 1)] },
  { surge: true, groups: [g('spiderling', 14, 0.55, 0), g('spiderling', 10, 0.55, 6, 1), g('gargoyle', 1, 1, 9)] },
  { groups: [g('acolyte', 5, 2.2), g('shield', 7, 1.8, 3, 1), g('sprinter', 8, 1.1, 8), g('shardback', 2, 5, 10, 1)] },
  { groups: [g('warlock', 4, 3.0), g('husk', 12, 1.0, 2, 1), g('gargoyle', 6, 1.6, 8)] },
  { groups: [g('broodmother', 1, 1, 4), g('spiderling', 12, 0.6, 0, 1), g('shield', 6, 1.9, 8)] },
  { surge: true, groups: [g('warlock', 5, 2.6, 0, 1), g('acolyte', 6, 2.0, 2), g('sprinter', 12, 0.9, 6), g('shardback', 2, 6, 12)] },
  { groups: [g('brute', 2, 9, 2), g('gargoyle', 10, 1.2, 4, 1), g('shield', 8, 1.7, 8)] },
  { groups: [g('broodmother', 2, 12, 2, 1), g('brute', 2, 10, 6), g('warlock', 4, 2.8, 10), g('spiderling', 16, 0.5, 14, 1)] },
  { groups: [g('acolyte', 7, 1.8), g('shield', 8, 1.6, 3, 1), g('shardback', 2, 5, 8)] },
  { surge: true, groups: [g('warlock', 5, 2.4), g('gargoyle', 9, 1.2, 3, 1), g('sprinter', 10, 0.9, 7)] },
  { groups: [g('broodmother', 2, 10), g('spiderling', 18, 0.5, 4, 1), g('shield', 7, 1.6, 8)] },
  { groups: [g('brute', 2, 8, 0, 1), g('acolyte', 6, 1.9, 3), g('gargoyle', 10, 1.1, 7, 1), g('shardback', 2, 5, 11)] },
  { surge: true, groups: [g('warlock', 6, 2.2), g('shield', 10, 1.4, 2, 1), g('sprinter', 12, 0.8, 6), g('spiderling', 14, 0.5, 10, 1)] },
  { groups: [g('hollowking', 1, 1, 10), g('brute', 2, 7), g('broodmother', 2, 9, 3, 1), g('warlock', 5, 2.2, 6), g('shield', 10, 1.3, 10, 1)] },
]

const emberwastesWaves: WaveDef[] = [
  { groups: [g('husk', 9, 1.5), g('sprinter', 5, 1.4, 5, 1)] },
  { groups: [g('sprinter', 8, 1.1, 0, 1), g('shield', 5, 2.0, 3)] },
  { groups: [g('acolyte', 5, 2.2), g('husk', 12, 1.1, 2, 1)] },
  { groups: [g('gargoyle', 3, 1.5, 0, 1), g('sprinter', 8, 1.0, 4)] },
  { groups: [g('warlock', 4, 2.8), g('shield', 7, 1.8, 3, 1)] },
  { groups: [g('spiderling', 16, 0.5), g('broodmother', 1, 1, 8, 1), g('gargoyle', 5, 1.5, 6, 1)] },
  { surge: true, groups: [g('shield', 9, 1.6, 0, 1), g('acolyte', 6, 2.0, 4), g('gargoyle', 7, 1.5, 9)] },
  { groups: [g('brute', 2, 9), g('warlock', 5, 2.4, 4, 1), g('sprinter', 10, 0.9, 8), g('hexling', 1, 1, 10), g('shardback', 2, 6, 12)] },
  { groups: [g('husk', 20, 0.7, 0, 1), g('spiderling', 14, 0.5, 6), g('acolyte', 5, 2.0, 10, 1)] },
  { groups: [g('broodmother', 2, 10, 2), g('shield', 10, 1.5, 5, 1), g('gargoyle', 9, 1.3, 9), g('hexling', 2, 6, 7, 1), g('shardback', 2, 6, 12, 1)] },
  { surge: true, groups: [g('warlock', 7, 2.2, 0, 1), g('brute', 2, 10, 4), g('acolyte', 7, 1.8, 8), g('sprinter', 10, 0.9, 12, 1)] },
  { groups: [g('shield', 12, 1.3), g('gargoyle', 12, 1.1, 4, 1), g('spiderling', 20, 0.45, 8)] },
  { surge: true, groups: [g('brute', 3, 8, 0, 1), g('broodmother', 2, 12, 4), g('warlock', 6, 2.2, 8, 1), g('husk', 16, 0.8, 12)] },
  { groups: [g('juggernaut', 1, 1, 6), g('acolyte', 8, 1.8, 0, 1), g('gargoyle', 10, 1.2, 10), g('shield', 8, 1.5, 16, 1)], breakAfter: 30 },
  { groups: [g('husk', 16, 0.7), g('acolyte', 6, 1.8, 4, 1), g('shardback', 2, 5, 8)] },
  { surge: true, groups: [g('gargoyle', 10, 1.2), g('warlock', 5, 2.2, 3, 1), g('sprinter', 12, 0.8, 7)] },
  { groups: [g('broodmother', 2, 9, 0, 1), g('spiderling', 20, 0.45, 4), g('hexling', 2, 7, 6), g('shield', 9, 1.4, 8, 1)] },
  { groups: [g('brute', 3, 7), g('acolyte', 7, 1.7, 3, 1), g('gargoyle', 10, 1.1, 8), g('shardback', 2, 5, 12, 1)] },
  { surge: true, groups: [g('warlock', 7, 2.0, 0, 1), g('shield', 11, 1.3, 3), g('sprinter', 14, 0.75, 8, 1), g('spiderling', 16, 0.45, 12)] },
  { groups: [g('juggernaut', 1, 1, 4), g('juggernaut', 1, 1, 10, 1), g('acolyte', 8, 1.6, 0), g('gargoyle', 10, 1.1, 8, 1), g('shield', 8, 1.3, 14)] },
]

const mistfenWaves: WaveDef[] = [
  { groups: [g('husk', 10, 1.5)] },
  { groups: [g('husk', 8, 1.4), g('sprinter', 4, 1.3, 3, 1)] },
  { groups: [g('mistwalker', 3, 1.8), g('shield', 3, 2.2, 2, 1), g('shardback', 2, 5, 6)] },
  { groups: [g('mistwalker', 4, 1.6, 0, 1), g('gargoyle', 4, 1.7), g('sprinter', 4, 1.2, 5, 1)] },
  { surge: true, groups: [g('mistwalker', 5, 1.4), g('shield', 4, 2.0, 2, 1), g('acolyte', 2, 2.6, 6)] },
  { groups: [g('mistwalker', 4, 1.5, 0, 1), g('spiderling', 12, 0.55), g('broodmother', 1, 1, 7, 1), g('shardback', 2, 5, 10)] },
  { groups: [g('mistwalker', 6, 1.3), g('wardbearer', 1, 1, 2), g('warlock', 3, 2.7, 3, 1), g('husk', 4, 1.2, 7)] },
  { groups: [g('mistwalker', 6, 1.25, 0, 1), g('gargoyle', 6, 1.5), g('shield', 3, 2.0, 5, 1)] },
  { groups: [g('mistwalker', 7, 1.2), g('sprinter', 5, 1.0, 2, 1), g('hexling', 1, 1, 4, 1), g('acolyte', 3, 2.2, 5)] },
  { surge: true, groups: [g('mistwalker', 8, 1.05, 0, 1), g('spiderling', 12, 0.5), g('broodmother', 1, 1, 6, 1), g('warlock', 2, 2.5, 9)] },
  { groups: [g('mistwalker', 8, 1.1), g('brute', 1, 1, 3, 1), g('wardbearer', 1, 1, 5), g('shield', 5, 1.7, 7), g('shardback', 2, 5, 9, 1)] },
  { groups: [g('mistwalker', 8, 1.0, 0, 1), g('gargoyle', 6, 1.3), g('warlock', 3, 2.3, 4, 1), g('shardback', 2, 5, 9)] },
  { groups: [g('mistwalker', 9, 0.95), g('broodmother', 2, 8, 2, 1), g('spiderling', 16, 0.45, 5), g('acolyte', 2, 2.0, 9, 1)] },
  { surge: true, groups: [g('mistwalker', 10, 0.9, 0, 1), g('brute', 2, 8), g('sprinter', 6, 0.9, 7, 1)] },
  { groups: [g('broodmother', 2, 8), g('brute', 2, 8, 3, 1), g('wardbearer', 1, 1, 4, 1), g('hexling', 2, 6, 7), g('mistwalker', 8, 0.85, 6)] },
  { groups: [g('mistwalker', 8, 1.0), g('acolyte', 5, 1.9, 3, 1), g('shardback', 2, 5, 8)] },
  { surge: true, groups: [g('mistwalker', 9, 0.95, 0, 1), g('gargoyle', 8, 1.2), g('warlock', 4, 2.2, 6, 1)] },
  { groups: [g('broodmother', 2, 9), g('spiderling', 18, 0.45, 3, 1), g('shield', 8, 1.4, 7)] },
  { groups: [g('brute', 2, 8, 0, 1), g('mistwalker', 9, 0.9, 3), g('acolyte', 6, 1.7, 7, 1), g('shardback', 2, 5, 11)] },
  { surge: true, groups: [g('mistwalker', 10, 0.85), g('warlock', 5, 2.0, 3, 1), g('sprinter', 12, 0.8, 7), g('gargoyle', 8, 1.1, 10, 1)] },
  { groups: [g('juggernaut', 1, 1, 5), g('mistwalker', 10, 0.85, 0, 1), g('broodmother', 2, 8, 4), g('shield', 9, 1.3, 10, 1)] },
]

const shatteredcrownWaves: WaveDef[] = [
  { groups: [g('husk', 4, 1.6), g('husk', 3, 1.6, 1, 1), g('husk', 3, 1.6, 2, 2)] },
  { groups: [g('sprinter', 4, 1.3), g('sprinter', 4, 1.3, 1, 1), g('sprinter', 4, 1.3, 2, 2)] },
  { groups: [g('shield', 2, 2.2), g('shield', 2, 2.2, 1, 1), g('shield', 2, 2.2, 2, 2), g('husk', 3, 1.3, 5)] },
  { groups: [g('gargoyle', 1, 1.8), g('gargoyle', 1, 1.8, 1, 1), g('acolyte', 1, 2.5, 4), g('acolyte', 1, 2.5, 5, 1), g('acolyte', 1, 2.5, 6, 2)] },
  { groups: [g('spiderling', 8, 0.55), g('spiderling', 8, 0.55, 1, 1), g('spiderling', 8, 0.55, 2, 2), g('sprinter', 3, 1.1, 5), g('sprinter', 3, 1.1, 6, 1), g('sprinter', 3, 1.1, 7, 2)] },
  { surge: true, groups: [g('mistwalker', 2, 1.5), g('mistwalker', 2, 1.5, 1, 1), g('mistwalker', 2, 1.5, 2, 2), g('shardback', 2, 5, 6), g('gargoyle', 2, 1.6, 7), g('gargoyle', 2, 1.6, 8, 2), g('sprinter', 2, 1.0, 9, 1)] },
  { groups: [g('warlock', 2, 2.8), g('warlock', 2, 2.8, 1, 1), g('warlock', 2, 2.8, 2, 2), g('husk', 3, 1.1, 5), g('husk', 3, 1.1, 6, 1), g('husk', 3, 1.1, 7, 2)] },
  { groups: [g('broodmother', 1, 1, 1), g('spiderling', 10, 0.5, 0, 1), g('spiderling', 10, 0.5, 2, 2), g('shield', 3, 1.9, 6), g('shield', 3, 1.9, 7, 1), g('shield', 3, 1.9, 8, 2)] },
  { groups: [g('brute', 1, 1), g('brute', 1, 1, 2, 1), g('gargoyle', 3, 1.4, 4), g('gargoyle', 3, 1.4, 5, 1), g('gargoyle', 3, 1.4, 6, 2), g('sprinter', 1, 1, 9), g('sprinter', 1, 1, 10, 1), g('sprinter', 1, 1, 11, 2)] },
  { groups: [g('mistwalker', 3, 1.2), g('mistwalker', 3, 1.2, 1, 1), g('mistwalker', 3, 1.2, 2, 2), g('acolyte', 1, 2.2, 5), g('acolyte', 1, 2.2, 6, 1), g('acolyte', 1, 2.2, 7, 2), g('shield', 1, 1.8, 9), g('shield', 1, 1.8, 10, 1), g('shield', 1, 1.8, 11, 2)] },
  { groups: [g('warlock', 2, 2.4), g('warlock', 2, 2.4, 1, 1), g('warlock', 2, 2.4, 2, 2), g('gargoyle', 2, 1.3, 5), g('gargoyle', 2, 1.3, 6, 1), g('gargoyle', 2, 1.3, 7, 2)] },
  { surge: true, groups: [g('broodmother', 1, 1), g('broodmother', 1, 1, 1, 1), g('broodmother', 1, 1, 2, 2), g('spiderling', 12, 0.45, 4), g('spiderling', 12, 0.45, 5, 1), g('spiderling', 12, 0.45, 6, 2), g('mistwalker', 1, 1.2, 10), g('mistwalker', 1, 1.2, 11, 1), g('mistwalker', 1, 1.2, 12, 2)] },
  { groups: [g('brute', 1, 1), g('brute', 1, 1, 1, 1), g('brute', 1, 1, 2, 2), g('shield', 2, 1.6, 5), g('shield', 2, 1.6, 6, 1), g('shield', 2, 1.6, 7, 2), g('acolyte', 1, 2.0, 10), g('acolyte', 1, 2.0, 11, 1), g('acolyte', 1, 2.0, 12, 2), g('shardback', 2, 5, 13, 1)] },
  { groups: [g('mistwalker', 4, 1.0), g('mistwalker', 4, 1.0, 1, 1), g('mistwalker', 4, 1.0, 2, 2), g('warlock', 1, 2.2, 5), g('warlock', 1, 2.2, 6, 1), g('warlock', 1, 2.2, 7, 2), g('sprinter', 1, 0.9, 10), g('sprinter', 1, 0.9, 11, 1), g('sprinter', 1, 0.9, 12, 2)] },
  { groups: [g('broodmother', 1, 1), g('broodmother', 1, 1, 1, 1), g('broodmother', 1, 1, 2, 2), g('gargoyle', 4, 1.2, 4), g('gargoyle', 4, 1.2, 5, 1), g('gargoyle', 4, 1.2, 6, 2), g('shardback', 2, 5, 10)] },
  { surge: true, groups: [g('mistwalker', 4, 0.9), g('mistwalker', 4, 0.9, 1, 1), g('mistwalker', 4, 0.9, 2, 2), g('brute', 1, 1, 5), g('brute', 1, 1, 6, 2), g('shield', 1, 1.5, 9), g('shield', 1, 1.5, 10, 1), g('shield', 1, 1.5, 11, 2)] },
  { groups: [g('juggernaut', 1, 1, 4), g('shield', 2, 1.5, 0, 1), g('shield', 2, 1.5, 1, 2), g('mistwalker', 2, 1.0, 5, 1), g('mistwalker', 2, 1.0, 6, 2), g('acolyte', 1, 2.0, 9), g('acolyte', 1, 2.0, 10, 1), g('acolyte', 1, 2.0, 11, 2)] },
  { groups: [g('veilqueen', 1, 1), g('gargoyle', 5, 1.1, 0), g('gargoyle', 5, 1.1, 5, 1), g('gargoyle', 5, 1.1, 10, 2), g('acolyte', 2, 1.8, 2), g('acolyte', 2, 1.8, 7, 1), g('acolyte', 2, 1.8, 12, 2)], breakAfter: 30 },
  { groups: [g('mistwalker', 4, 1.0), g('mistwalker', 4, 1.0, 1, 1), g('mistwalker', 4, 1.0, 2, 2), g('shardback', 2, 5, 6, 1)] },
  { surge: true, groups: [g('gargoyle', 4, 1.2), g('gargoyle', 4, 1.2, 1, 1), g('gargoyle', 4, 1.2, 2, 2), g('warlock', 2, 2.2, 5), g('warlock', 2, 2.2, 6, 1), g('warlock', 2, 2.2, 7, 2)] },
  { groups: [g('brute', 1, 1), g('brute', 1, 1, 2, 1), g('brute', 1, 1, 4, 2), g('hexling', 1, 1, 5), g('hexling', 1, 1, 6, 2), g('spiderling', 12, 0.45, 6), g('spiderling', 12, 0.45, 7, 1), g('spiderling', 12, 0.45, 8, 2)] },
  { groups: [g('broodmother', 1, 1), g('broodmother', 1, 1, 1, 1), g('broodmother', 1, 1, 2, 2), g('wardbearer', 1, 1, 3, 1), g('mistwalker', 3, 1.0, 4), g('mistwalker', 3, 1.0, 5, 1), g('mistwalker', 3, 1.0, 6, 2), g('shardback', 2, 5, 9)] },
  { surge: true, groups: [g('shield', 3, 1.5), g('shield', 3, 1.5, 1, 1), g('shield', 3, 1.5, 2, 2), g('acolyte', 2, 1.8, 4), g('acolyte', 2, 1.8, 5, 1), g('acolyte', 2, 1.8, 6, 2), g('sprinter', 4, 0.8, 8), g('sprinter', 4, 0.8, 9, 1), g('sprinter', 4, 0.8, 10, 2)] },
  { groups: [g('veilqueen', 1, 1, 2), g('juggernaut', 1, 1, 6, 1), g('mistwalker', 4, 0.9, 0, 2), g('gargoyle', 5, 1.0, 8), g('gargoyle', 5, 1.0, 10, 2), g('acolyte', 3, 1.6, 12, 1)] },
]

const cinderwakeWaves: WaveDef[] = [
  { groups: [g('husk', 8, 1.5), g('husk', 6, 1.5, 2, 1)] },
  { groups: [g('sprinter', 7, 1.2, 0, 2), g('husk', 8, 1.3, 3)] },
  { groups: [g('shield', 5, 2.0), g('sprinter', 6, 1.2, 3, 1), g('husk', 6, 1.2, 6, 2)] },
  { groups: [g('riftwing', 2, 2.0), g('husk', 8, 1.1, 3, 1)] },
  { groups: [g('acolyte', 4, 2.2, 0, 1), g('shield', 5, 1.8, 3, 2), g('sprinter', 8, 1.0, 6)] },
  { surge: true, groups: [g('riftwing', 5, 1.8, 0, 2), g('gargoyle', 6, 1.4), g('shardback', 2, 5, 6, 1)] },
  { groups: [g('warlock', 4, 2.4), g('husk', 12, 0.9, 2, 1), g('sprinter', 8, 1.0, 5, 2)] },
  { groups: [g('spiderling', 14, 0.5, 0, 1), g('broodmother', 1, 1, 6), g('shield', 6, 1.6, 4, 2)] },
  { groups: [g('riftwing', 4, 1.6), g('riftwing', 3, 1.6, 2, 1), g('acolyte', 5, 1.9, 5, 2)] },
  { surge: true, groups: [g('shield', 8, 1.5, 0, 2), g('warlock', 4, 2.2, 3), g('sprinter', 10, 0.9, 6, 1), g('shardback', 2, 5, 10)] },
  { groups: [g('brute', 2, 8), g('gargoyle', 8, 1.2, 3, 1), g('husk', 14, 0.8, 6, 2)] },
  { groups: [g('mistwalker', 6, 1.2, 0, 1), g('hexling', 1, 1, 2), g('riftwing', 4, 1.5, 3, 2), g('acolyte', 5, 1.8, 6)] },
  { groups: [g('juggernaut', 1, 1, 5, 2), g('shield', 7, 1.5), g('warlock', 4, 2.1, 4, 1)], breakAfter: 30 },
  { groups: [g('spiderling', 18, 0.45), g('broodmother', 2, 9, 4, 1), g('riftwing', 4, 1.4, 8, 2)] },
  { surge: true, groups: [g('mistwalker', 7, 1.1, 0, 2), g('gargoyle', 9, 1.1, 2), g('sprinter', 12, 0.8, 5, 1), g('shardback', 2, 5, 9)] },
  { groups: [g('brute', 2, 8, 0, 1), g('wardbearer', 1, 1, 2, 2), g('acolyte', 6, 1.7, 3), g('shield', 8, 1.4, 6, 2)] },
  { groups: [g('riftwing', 5, 1.3), g('riftwing', 4, 1.3, 2, 1), g('riftwing', 4, 1.3, 4, 2), g('warlock', 4, 2.0, 7)] },
  { surge: true, groups: [g('husk', 20, 0.6, 0, 1), g('shield', 9, 1.3, 4, 2), g('warlock', 5, 2.0, 8), g('shardback', 2, 5, 12, 1)] },
  { groups: [g('broodmother', 2, 8, 0, 2), g('spiderling', 20, 0.4, 4), g('mistwalker', 8, 1.0, 8, 1)] },
  { groups: [g('veilqueen', 1, 1, 4, 1), g('gargoyle', 8, 1.1), g('riftwing', 4, 1.3, 6, 2)], breakAfter: 30 },
  { groups: [g('brute', 3, 7, 0, 1), g('acolyte', 7, 1.6, 3, 2), g('sprinter', 12, 0.8, 7)] },
  { surge: true, groups: [g('mistwalker', 9, 0.95), g('warlock', 6, 1.9, 3, 1), g('shield', 10, 1.25, 6, 2), g('shardback', 2, 5, 10)] },
  { groups: [g('riftwing', 6, 1.2, 0, 1), g('gargoyle', 10, 1.0, 3, 2), g('hexling', 2, 7, 4), g('broodmother', 2, 8, 6)] },
  { groups: [g('brute', 3, 7, 0, 2), g('spiderling', 22, 0.4, 4, 1), g('acolyte', 7, 1.6, 8)] },
  { surge: true, groups: [g('mistwalker', 10, 0.9, 0, 1), g('shield', 11, 1.2, 3), g('warlock', 6, 1.8, 7, 2), g('sprinter', 14, 0.7, 10)] },
  { groups: [g('juggernaut', 1, 1, 4), g('juggernaut', 1, 1, 10, 2), g('riftwing', 5, 1.2, 0, 1), g('gargoyle', 10, 1.0, 8), g('acolyte', 6, 1.6, 14, 1)] },
]

const veilscarWaves: WaveDef[] = [
  { groups: [g('husk', 6, 1.5), g('husk', 5, 1.5, 2, 1), g('husk', 5, 1.5, 4, 2)] },
  { groups: [g('sprinter', 5, 1.2), g('sprinter', 5, 1.2, 2, 1), g('sprinter', 5, 1.2, 4, 2)] },
  { groups: [g('shield', 4, 2.0, 0, 1), g('mistwalker', 4, 1.4, 3), g('husk', 8, 1.1, 5, 2)] },
  { surge: true, groups: [g('mistwalker', 5, 1.3), g('gargoyle', 5, 1.4, 2, 1), g('shardback', 2, 5, 6, 2)] },
  { groups: [g('riftherald', 1, 1, 2, 1), g('husk', 10, 1.0), g('acolyte', 4, 2.0, 4, 2)] },
  { groups: [g('riftwing', 4, 1.6, 0, 2), g('shield', 6, 1.6, 2), g('sprinter', 8, 1.0, 5, 1)] },
  { surge: true, groups: [g('warlock', 4, 2.2, 0, 1), g('mistwalker', 6, 1.2, 2, 2), g('spiderling', 12, 0.5, 5)] },
  { groups: [g('riftherald', 1, 1, 0), g('riftherald', 1, 1, 3, 2), g('gargoyle', 6, 1.3, 5, 1)] },
  { groups: [g('broodmother', 1, 1, 2, 1), g('spiderling', 14, 0.45, 0), g('shield', 7, 1.5, 4, 2), g('shardback', 2, 5, 8)] },
  { groups: [g('juggernaut', 1, 1, 5), g('mistwalker', 6, 1.1, 0, 1), g('acolyte', 5, 1.8, 3, 2)], breakAfter: 30 },
  { surge: true, groups: [g('riftwing', 5, 1.4, 0, 1), g('warlock', 5, 2.0, 2), g('sprinter', 10, 0.85, 6, 2)] },
  { groups: [g('riftherald', 2, 8, 0, 2), g('shield', 8, 1.4, 3), g('husk', 14, 0.8, 6, 1)] },
  { groups: [g('mistwalker', 8, 1.0), g('wardbearer', 1, 1, 2), g('gargoyle', 8, 1.2, 3, 1), g('acolyte', 6, 1.7, 6, 2), g('shardback', 2, 5, 10, 1)] },
  { surge: true, groups: [g('brute', 2, 8, 0, 1), g('riftwing', 5, 1.3, 3, 2), g('spiderling', 16, 0.45, 6)] },
  { groups: [g('riftherald', 2, 9, 2), g('hexling', 2, 6, 3, 1), g('warlock', 5, 1.9, 0, 1), g('shield', 8, 1.35, 5, 2)] },
  { groups: [g('broodmother', 2, 9, 0, 2), g('mistwalker', 8, 0.95, 3), g('sprinter', 12, 0.8, 7, 1)] },
  { surge: true, groups: [g('riftwing', 6, 1.25), g('acolyte', 7, 1.6, 3, 1), g('warlock', 5, 1.9, 6, 2), g('shardback', 2, 5, 10)] },
  { groups: [g('brute', 2, 7, 0, 1), g('riftherald', 1, 1, 4, 2), g('spiderling', 18, 0.4, 6), g('gargoyle', 8, 1.1, 9, 1)] },
  { groups: [g('veilqueen', 1, 1, 3, 1), g('mistwalker', 8, 0.9), g('riftwing', 4, 1.3, 6, 2)], breakAfter: 30 },
  { surge: true, groups: [g('shield', 10, 1.25, 0, 2), g('warlock', 6, 1.8, 3, 1), g('sprinter', 14, 0.7, 7), g('shardback', 2, 5, 11, 2)] },
  { groups: [g('riftherald', 2, 8, 0, 1), g('broodmother', 2, 8, 4, 2), g('acolyte', 7, 1.55, 8)] },
  { groups: [g('mistwalker', 10, 0.85, 0, 2), g('gargoyle', 10, 1.0, 3), g('shield', 9, 1.3, 7, 1)] },
  { surge: true, groups: [g('riftwing', 6, 1.2, 0, 1), g('riftwing', 5, 1.2, 3, 2), g('warlock', 6, 1.75, 6), g('shardback', 2, 5, 10, 1)] },
  { groups: [g('brute', 3, 7), g('wardbearer', 2, 10, 2, 1), g('spiderling', 22, 0.38, 4, 1), g('riftherald', 2, 9, 8, 2)] },
  { groups: [g('juggernaut', 1, 1, 6, 1), g('mistwalker', 10, 0.85, 0), g('acolyte', 8, 1.5, 4, 2)] },
  { surge: true, groups: [g('shield', 12, 1.15, 0, 1), g('warlock', 7, 1.7, 3, 2), g('sprinter', 16, 0.65, 7), g('riftwing', 5, 1.2, 11, 1)] },
  { groups: [g('broodmother', 3, 8, 0, 2), g('riftherald', 2, 8, 4), g('mistwalker', 10, 0.8, 8, 1), g('shardback', 3, 4, 12)] },
  { groups: [g('veilregent', 1, 1, 6), g('riftwing', 5, 1.2, 0, 1), g('mistwalker', 8, 0.85, 3, 2), g('gargoyle', 8, 1.0, 10), g('acolyte', 6, 1.5, 14, 1)] },
]

export const levels: LevelDef[] = [
  {
    id: 'greenhollow',
    name: 'Greenhollow',
    subtitle: 'The meadow road',
    theme: 'forest',
    seed: 1337,
    width: 24, height: 14,
    lanes: [
      [[0, 3], [7, 3], [7, 10], [15, 10], [15, 4], [23, 4]],
    ],
    plots: [
      [2, 4], [5, 2], [5, 5], [8, 6], [6, 9], [9, 9],
      [12, 11], [13, 8], [16, 6], [18, 3], [20, 6], [16, 9],
    ],
    trapSpots: [[3, 3], [10, 10], [15, 7]],
    water: [[19, 11, 22, 13], [0, 9, 1, 11]],
    hills: [[10, 0, 14, 0], [0, 0, 2, 1], [21, 0, 23, 1], [0, 13, 2, 13]],
    voids: [[23, 13, 23, 13], [0, 12, 0, 13], [23, 0, 23, 0]],
    waves: greenhollowWaves,
    startGold: 260,
    startLives: 20,
    intro: 'The Veil crawls out of the western caves. Hold the meadow road to the keep.',
  },
  {
    id: 'frostmere',
    hazard: 'deepchill',
    name: 'Frostmere Pass',
    subtitle: 'Two roads, one gate',
    theme: 'winter',
    seed: 7411,
    width: 24, height: 14,
    lanes: [
      [[0, 2], [8, 2], [8, 6], [12, 6], [12, 9], [23, 9]],
      [[0, 12], [6, 12], [6, 9], [12, 9], [23, 9]],
    ],
    plots: [
      [2, 3], [4, 11], [7, 4], [5, 8], [9, 8], [10, 5],
      [13, 7], [14, 10], [17, 8], [20, 10], [19, 7], [2, 1],
    ],
    trapSpots: [[4, 2], [10, 6], [6, 10], [17, 9]],
    water: [[14, 2, 18, 5], [1, 5, 3, 7], [20, 12, 23, 13]],
    hills: [[10, 0, 16, 0], [0, 0, 1, 0], [22, 0, 23, 2], [10, 12, 14, 13]],
    voids: [[0, 13, 1, 13], [23, 0, 23, 0]],
    waves: frostmereWaves,
    startGold: 300,
    startLives: 20,
    intro: 'Frostmere freezes solid, and the Veil marches on two roads at once. Watch both.',
  },
  {
    id: 'emberwastes',
    hazard: 'eruption',
    name: 'The Emberwastes',
    subtitle: 'Where the Juggernaut walks',
    theme: 'ember',
    seed: 9021,
    width: 24, height: 14,
    lanes: [
      [[2, 0], [2, 6], [10, 6], [10, 10], [23, 10]],
      [[23, 2], [14, 2], [14, 6], [10, 6], [10, 10], [23, 10]],
    ],
    plots: [
      [4, 4], [1, 8], [4, 8], [8, 4], [12, 4], [16, 4],
      [12, 8], [8, 8], [14, 11], [17, 8], [20, 8], [18, 12], [21, 4],
    ],
    trapSpots: [[2, 4], [6, 6], [10, 8], [16, 10], [18, 2]],
    water: [[5, 1, 8, 2], [18, 5, 21, 6], [0, 11, 3, 13]],
    hills: [[6, 11, 8, 13], [0, 0, 0, 2], [22, 12, 23, 13], [19, 0, 23, 0]],
    voids: [[0, 13, 0, 13], [23, 13, 23, 13]],
    waves: emberwastesWaves,
    startGold: 340,
    startLives: 20,
    intro: 'Scorched earth, twin warpaths, and something enormous stirring in the ash.',
  },
  {
    id: 'mistfen',
    hazard: 'witchlights',
    name: 'Mistfen Crossing',
    subtitle: 'Two roads through the fen',
    theme: 'swamp',
    seed: 5183,
    width: 26, height: 15,
    lanes: [
      [[0, 3], [8, 3], [8, 7], [13, 7], [13, 10], [25, 10]],
      [[0, 12], [5, 12], [5, 7], [13, 7], [13, 10], [25, 10]],
    ],
    plots: [
      [2, 2], [5, 4], [7, 5], [9, 6], [11, 8], [12, 9], [16, 9],
      [19, 11], [22, 9], [3, 11], [4, 9], [6, 8], [1, 13], [14, 8],
    ],
    trapSpots: [[4, 3], [8, 5], [7, 7], [5, 10], [19, 10]],
    water: [[0, 5, 3, 7], [17, 12, 21, 14], [10, 0, 14, 2]],
    hills: [[0, 0, 3, 1], [9, 4, 12, 5], [23, 12, 25, 14]],
    voids: [[25, 0, 25, 1], [0, 14, 2, 14]],
    waves: mistfenWaves,
    startGold: 360,
    startLives: 20,
    startShards: 3,
    intro: 'Mistwalkers haunt the fen, slipping between worlds as two drowned roads wind toward the keep.',
  },
  {
    id: 'shatteredcrown',
    hazard: 'riftlight',
    name: 'The Shattered Crown',
    subtitle: 'Seat of the Veilqueen',
    theme: 'void',
    seed: 8642,
    width: 26, height: 15,
    lanes: [
      [[0, 4], [6, 4], [6, 8], [13, 8], [13, 14]],
      [[12, 0], [12, 5], [9, 5], [9, 8], [13, 8], [13, 14]],
      [[25, 3], [19, 3], [19, 8], [13, 8], [13, 14]],
    ],
    plots: [
      [2, 3], [4, 5], [5, 7], [7, 6], [8, 9], [10, 7], [11, 4], [13, 4],
      [14, 7], [16, 9], [18, 6], [20, 5], [22, 2], [24, 4], [12, 12],
    ],
    trapSpots: [[3, 4], [6, 6], [12, 2], [10, 5], [19, 5], [13, 11]],
    water: [[0, 10, 4, 13], [14, 0, 17, 3], [21, 10, 25, 14]],
    hills: [[7, 0, 9, 2], [15, 5, 17, 6]],
    voids: [[0, 14, 2, 14], [24, 0, 25, 1]],
    waves: shatteredcrownWaves,
    startGold: 400,
    startLives: 20,
    startShards: 4,
    intro: 'At the Veil\'s shattered throne, its flying queen gathers every horror for one final assault.',
  },
  {
    id: 'cinderwake',
    hazard: 'eruption',
    name: 'Cinderwake Caldera',
    subtitle: 'Three roads through the glassfire',
    theme: 'ember',
    seed: 6317,
    width: 25, height: 15,
    lanes: [
      [[0, 2], [7, 2], [7, 6], [12, 6], [12, 10], [24, 10]],
      [[0, 13], [6, 13], [6, 9], [12, 9], [12, 10], [24, 10]],
      [[24, 1], [18, 1], [18, 6], [12, 6], [12, 10], [24, 10]],
    ],
    plots: [
      [2, 4], [5, 1], [5, 5], [8, 4], [10, 7], [9, 10], [13, 5], [15, 7],
      [17, 4], [20, 3], [21, 8], [23, 12], [8, 12], [4, 8], [14, 12], [19, 12],
    ],
    trapSpots: [[4, 2], [7, 4], [9, 6], [6, 11], [15, 10], [18, 3]],
    water: [[0, 10, 3, 12], [14, 2, 16, 4], [21, 5, 24, 7]],
    hills: [[9, 0, 14, 1], [0, 6, 3, 8], [20, 13, 24, 14]],
    voids: [[0, 14, 2, 14], [24, 0, 24, 0]],
    waves: cinderwakeWaves,
    startGold: 440,
    startLives: 20,
    startShards: 4,
    intro: 'Veilcrystal rains over the caldera as three warpaths close on the last glassfire gate.',
  },
  {
    id: 'veilscar',
    hazard: 'riftlight',
    name: 'Veilscar Confluence',
    subtitle: 'Three roads into the last wound',
    theme: 'void',
    seed: 9751,
    width: 26, height: 15,
    lanes: [
      [[0, 2], [8, 2], [8, 7], [13, 7], [13, 14]],
      [[12, 0], [12, 5], [13, 5], [13, 14]],
      [[25, 2], [19, 2], [19, 9], [13, 9], [13, 14]],
    ],
    plots: [
      [2, 3], [5, 1], [7, 4], [9, 6], [10, 3], [11, 6], [14, 4], [15, 6], [16, 8],
      [18, 7], [20, 4], [23, 3], [22, 10], [17, 11], [11, 10], [8, 10], [10, 8], [15, 12],
    ],
    trapSpots: [[4, 2], [8, 5], [12, 3], [13, 6], [19, 5], [16, 9], [13, 12]],
    water: [[0, 7, 4, 10], [20, 11, 25, 14], [14, 0, 17, 2]],
    hills: [[9, 0, 10, 2], [3, 13, 7, 14], [21, 5, 24, 7]],
    voids: [[0, 14, 1, 14], [24, 0, 25, 1], [0, 0, 1, 1]],
    waves: veilscarWaves,
    startGold: 460,
    startLives: 20,
    startShards: 5,
    intro: 'Beyond the broken throne, three roads pour into the Veil\'s final wound. Seal it before the Regent crosses.',
  },
]

export function levelById(id: string): LevelDef {
  const l = levels.find(l => l.id === id)
  if (!l) throw new Error(`unknown level ${id}`)
  return l
}

/**
 * Endless Mode ("The Long Night"): procedurally generated waves that keep
 * escalating. Deterministic per level seed. Enemy HP additionally scales in
 * Game via the wave index; here we just author ever-larger compositions.
 */
/**
 * The Long Night. `seed` defaults to the level so the shape is stable, but a
 * run passes its own seed: otherwise every endless attempt on a map replays
 * the identical 999 waves, which is the opposite of what the mode promises.
 * Length matches the 200 waves the campaign actually advertises.
 */
/**
 * The Daily Hold: one short battle that is the same for everybody in the
 * world on a given UTC day, built entirely from the date so it needs no
 * server to agree on.
 *
 * It starts partway up the endless ramp rather than at wave one - a daily
 * has to bite immediately, because its whole job is to be finished and
 * talked about in one sitting.
 */
export const DAILY_WAVES = 12
const DAILY_RAMP_SKIP = 7

export function dailyLevel(seed: number): LevelDef {
  const base = levels[seed % levels.length]
  const waves = generateEndlessWaves(base, DAILY_WAVES + DAILY_RAMP_SKIP, seed).slice(DAILY_RAMP_SKIP)
  return {
    ...base,
    id: 'daily',
    name: 'The Daily Hold',
    subtitle: 'One battle. Everyone gets the same one.',
    waves,
    startGold: base.startGold + 120,
    startLives: 15,
    startShards: 4,
    intro: undefined,
  }
}

export function generateEndlessWaves(level: LevelDef, count = 200, seed = level.seed): WaveDef[] {
  // deterministic PRNG (mulberry32)
  let s = (seed * 7919 + 12345) >>> 0
  const rand = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
  const laneCount = level.lanes.length
  const lane = () => Math.floor(rand() * laneCount)

  const waves: WaveDef[] = []
  for (let i = 0; i < count; i++) {
    const tier = Math.min(4, Math.floor(i / 4))
    const pool = [
      ['husk', 'sprinter'],
      ['husk', 'sprinter', 'shield', 'gargoyle'],
      ['sprinter', 'shield', 'gargoyle', 'acolyte', 'spiderling', 'shardback'],
      ['shield', 'gargoyle', 'acolyte', 'warlock', 'mistwalker', 'spiderling', 'shardback', 'riftwing', 'hexling'],
      ['shield', 'gargoyle', 'acolyte', 'warlock', 'mistwalker', 'broodmother', 'brute', 'shardback', 'riftwing', 'riftherald', 'hexling', 'wardbearer'],
    ][tier]
    const groups = []
    const groupCount = 2 + Math.min(3, Math.floor(i / 6))
    const rare = (enemy: string) => enemy === 'brute' || enemy === 'broodmother' || enemy === 'riftherald' || enemy === 'wardbearer' || enemy === 'hexling'
    for (let gi = 0; gi < groupCount; gi++) {
      const enemy = pick(pool)
      const base = enemy === 'spiderling' ? 8 : rare(enemy) ? 1 : 3
      const cnt = Math.max(1, Math.round(base * (1 + i * 0.045) * (0.7 + rand() * 0.6)))
      groups.push({
        enemy,
        count: rare(enemy) ? Math.min(cnt, 3 + Math.floor(i / 12)) : cnt,
        interval: Math.max(0.5, 1.6 - i * 0.018),
        delay: gi * (3 + rand() * 4),
        lane: lane(),
      })
    }
    // a guaranteed shard carrier every third wave keeps the economy alive
    if (i % 3 === 2) groups.push({ enemy: 'shardback', count: 2, interval: 5, delay: 6, lane: lane() })
    // bosses stride in every tenth wave, rotating through all three
    if (i > 0 && i % 10 === 9) {
      const boss = ['juggernaut', 'veilqueen', 'veilregent'][Math.floor(i / 10) % 3]
      groups.push({ enemy: boss, count: 1, interval: 1, delay: 8, lane: lane() })
    }
    waves.push({ groups, surge: i % 5 === 4 })
  }
  return waves
}

export const WAVE_BREAK = 22          // seconds between waves
export const EARLY_CALL_GOLD_PER_SEC = 1.6
