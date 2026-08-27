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
  { groups: [g('veilqueen', 1, 1, 0, 2), g('gargoyle', 5, 1.1), g('gargoyle', 5, 1.1, 5, 1), g('gargoyle', 5, 1.1, 10, 2), g('acolyte', 2, 1.8, 2), g('acolyte', 2, 1.8, 7, 1), g('acolyte', 2, 1.8, 12, 2)], breakAfter: 30 },
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
  { surge: true, groups: [g('riftwing', 2, 1.8, 0, 2), g('gargoyle', 6, 1.4), g('shardback', 2, 5, 6, 1), g('riftwing', 2, 1.8, 0.5, 1), g('riftwing', 1, 1.8, 0.5)] },
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
  { groups: [g('veilqueen', 1, 1, 4), g('gargoyle', 8, 1.1), g('riftwing', 4, 1.3, 6, 2)], breakAfter: 30 },
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
  { surge: true, groups: [g('mistwalker', 5, 1.3), g('gargoyle', 2, 1.4, 2, 1), g('shardback', 2, 5, 6, 2), g('gargoyle', 1, 1.4, 2.5, 2)] },
  { groups: [g('riftherald', 1, 1, 2, 1), g('husk', 10, 1.0), g('acolyte', 4, 2.0, 4, 2)] },
  { groups: [g('riftwing', 2, 1.6, 0, 2), g('shield', 6, 1.6, 2), g('sprinter', 8, 1, 5, 1), g('riftwing', 1, 1.6, 0.5), g('riftwing', 1, 1.6, 0.5, 1)] },
  { surge: true, groups: [g('warlock', 3, 2.2, 0, 1), g('mistwalker', 6, 1.2, 2, 2), g('spiderling', 12, 0.5, 5), g('warlock', 1, 2.2, 0.5)] },
  { groups: [g('riftherald', 1, 1, 0), g('riftherald', 1, 1, 3, 2), g('gargoyle', 6, 1.3, 5, 1)] },
  { groups: [g('broodmother', 1, 1, 2, 1), g('spiderling', 14, 0.45, 0), g('shield', 7, 1.5, 4, 2), g('shardback', 2, 5, 8)] },
  { groups: [g('juggernaut', 1, 1, 5), g('mistwalker', 6, 1.1, 0, 1), g('acolyte', 5, 1.8, 3, 2)], breakAfter: 30 },
  { surge: true, groups: [g('riftwing', 1, 1.4, 0, 1), g('warlock', 5, 2, 2), g('sprinter', 10, 0.85, 6, 2), g('riftwing', 2, 1.4, 0.5, 2), g('riftwing', 2, 1.4, 0.5)] },
  { groups: [g('riftherald', 2, 8, 0, 2), g('shield', 8, 1.4, 3), g('husk', 14, 0.8, 6, 1)] },
  { groups: [g('mistwalker', 8, 1.0), g('wardbearer', 1, 1, 2), g('gargoyle', 8, 1.2, 3, 1), g('acolyte', 6, 1.7, 6, 2), g('shardback', 2, 5, 10, 1)] },
  { surge: true, groups: [g('brute', 2, 8, 0, 1), g('riftwing', 3, 1.3, 3, 2), g('spiderling', 16, 0.45, 6), g('riftwing', 2, 1.3, 3.5)] },
  { groups: [g('riftherald', 2, 9, 2), g('hexling', 2, 6, 3, 1), g('warlock', 5, 1.9, 0, 1), g('shield', 8, 1.35, 5, 2)] },
  { groups: [g('broodmother', 2, 9, 0, 2), g('mistwalker', 8, 0.95, 3), g('sprinter', 12, 0.8, 7, 1)] },
  { surge: true, groups: [g('riftwing', 6, 1.25), g('acolyte', 7, 1.6, 3, 1), g('warlock', 5, 1.9, 6, 2), g('shardback', 2, 5, 10)] },
  { groups: [g('brute', 2, 7, 0, 1), g('riftherald', 1, 1, 4, 2), g('spiderling', 18, 0.4, 6), g('gargoyle', 8, 1.1, 9, 1)] },
  { groups: [g('veilqueen', 1, 1, 3), g('mistwalker', 8, 0.9), g('riftwing', 4, 1.3, 6, 2)], breakAfter: 30 },
  { surge: true, groups: [g('shield', 10, 1.25, 0, 2), g('warlock', 6, 1.8, 3, 1), g('sprinter', 14, 0.7, 7), g('shardback', 2, 5, 11, 2)] },
  { groups: [g('riftherald', 2, 8, 0, 1), g('broodmother', 2, 8, 4, 2), g('acolyte', 7, 1.55, 8)] },
  { groups: [g('mistwalker', 10, 0.85, 0, 2), g('gargoyle', 10, 1.0, 3), g('shield', 9, 1.3, 7, 1)] },
  { surge: true, groups: [g('riftwing', 6, 1.2, 0, 1), g('riftwing', 5, 1.2, 3, 2), g('warlock', 6, 1.75, 6), g('shardback', 2, 5, 10, 1)] },
  { groups: [g('brute', 3, 7), g('wardbearer', 2, 10, 2, 1), g('spiderling', 22, 0.38, 4, 1), g('riftherald', 2, 9, 8, 2)] },
  { groups: [g('juggernaut', 1, 1, 6), g('mistwalker', 10, 0.85), g('acolyte', 8, 1.5, 4, 2)] },
  { surge: true, groups: [g('shield', 7, 1.15, 0, 1), g('warlock', 7, 1.7, 3, 2), g('sprinter', 16, 0.65, 7), g('riftwing', 5, 1.2, 11, 1), g('shield', 5, 1.15, 0.5)] },
  { groups: [g('broodmother', 3, 8, 0, 2), g('riftherald', 2, 8, 4), g('mistwalker', 10, 0.8, 8, 1), g('shardback', 3, 4, 12)] },
  { groups: [g('veilregent', 1, 1, 6), g('riftwing', 5, 1.2, 0, 1), g('mistwalker', 8, 0.85, 3, 2), g('gargoyle', 8, 1.0, 10), g('acolyte', 6, 1.5, 14, 1)] },
]


const sunderfallWaves: WaveDef[] = [
  { groups: [g('husk', 6, 0.34), g('sprinter', 6, 0.34, 1.6, 1)] },
  { groups: [g('sprinter', 6, 0.9), g('shield', 6, 0.9, 1.6, 1)] },
  { groups: [g('shield', 6, 2.25), g('gargoyle', 6, 2.25, 1.6, 1)] },
  { groups: [g('gargoyle', 6, 3.2), g('husk', 6, 3.2, 1.6, 1)] },
  { groups: [g('husk', 13, 0.34), g('sprinter', 13, 0.34, 1.6, 1)] },
  { groups: [g('sprinter', 11, 0.34), g('shield', 11, 0.34, 1.6, 1)] },
  { groups: [g('shield', 9, 0.34), g('gargoyle', 9, 0.34, 1.6, 1)] },
  { groups: [g('gargoyle', 7, 0.34), g('gargoyle', 7, 0.34, 1.6, 1)] },
  { surge: true, groups: [g('mistwalker', 4, 3.2), g('riftwing', 4, 3.2, 1.6, 1)] },
  { groups: [g('riftwing', 4, 3.2), g('brute', 4, 3.2, 1.6, 1)] },
  { groups: [g('shardback', 6, 0.34), g('wardbearer', 6, 0.34, 1.6, 1)] },
  { groups: [g('spiderling', 12, 0.34), g('shield', 12, 0.34, 1.6, 1), g('riftwing', 12, 0.34, 3.2, 2), g('hollowking', 1, 1, 4)] },
  { groups: [g('shield', 13, 0.34), g('shardback', 13, 0.34, 1.6, 1), g('shardback', 13, 0.34, 3.2, 2)] },
  { surge: true, groups: [g('acolyte', 12, 0.34), g('gargoyle', 12, 0.34, 1.6, 1), g('spiderling', 12, 0.34, 3.2, 2)] },
  { groups: [g('mistwalker', 6, 0.34), g('riftwing', 6, 0.34, 1.6, 1), g('shield', 6, 0.34, 3.2, 2)] },
  { groups: [g('riftwing', 6, 1.59), g('brute', 6, 1.59, 1.6, 1), g('acolyte', 6, 1.59, 3.2, 2)] },
  { groups: [g('shardback', 10, 0.34), g('wardbearer', 10, 0.34, 1.6, 1), g('mistwalker', 10, 0.34, 3.2, 2)] },
  { groups: [g('spiderling', 11, 0.34), g('shield', 11, 0.34, 1.6, 1), g('riftwing', 11, 0.34, 3.2, 2)] },
  { surge: true, groups: [g('riftherald', 4, 3.2), g('shardback', 4, 3.2, 1.6, 1), g('riftwing', 4, 3.2, 3.2, 2)] },
  { groups: [g('hexling', 22, 0.34), g('gargoyle', 22, 0.34, 1.6, 1), g('brute', 22, 0.34, 3.2, 2), g('juggernaut', 1, 1, 4)] },
  { groups: [g('mistwalker', 12, 0.34), g('riftwing', 12, 0.34, 1.6, 1), g('wardbearer', 12, 0.34, 3.2, 2)] },
  { groups: [g('warlock', 13, 0.34), g('brute', 13, 0.34, 1.6, 1), g('riftherald', 13, 0.34, 3.2, 2), g('hexling', 13, 0.34, 4.8, 3)] },
  { groups: [g('riftwing', 9, 0.34), g('wardbearer', 9, 0.34, 1.6, 1), g('hexling', 9, 0.34, 3.2, 2), g('mistwalker', 9, 0.34, 4.8, 3)] },
  { surge: true, groups: [g('brute', 9, 0.34), g('shield', 9, 0.34, 1.6, 1), g('mistwalker', 9, 0.34, 3.2, 2), g('warlock', 9, 0.34, 4.8, 3)] },
  { groups: [g('wardbearer', 13, 0.34), g('shardback', 13, 0.34, 1.6, 1), g('warlock', 13, 0.34, 3.2, 2), g('riftwing', 13, 0.34, 4.8, 3)] },
  { groups: [g('riftherald', 10, 0.34), g('gargoyle', 10, 0.34, 1.6, 1), g('riftwing', 10, 0.34, 3.2, 2), g('brute', 10, 0.34, 4.8, 3), g('veilqueen', 1, 1, 4)] },
  { groups: [g('hexling', 15, 0.34), g('riftwing', 15, 0.34, 1.6, 1), g('brute', 15, 0.34, 3.2, 2), g('wardbearer', 15, 0.34, 4.8, 3)] },
  { groups: [g('mistwalker', 11, 0.34), g('brute', 11, 0.34, 1.6, 1), g('wardbearer', 11, 0.34, 3.2, 2), g('riftherald', 11, 0.34, 4.8, 3)] },
  { surge: true, groups: [g('warlock', 13, 0.34), g('wardbearer', 13, 0.34, 1.6, 1), g('riftherald', 13, 0.34, 3.2, 2), g('hexling', 13, 0.34, 4.8, 3)] },
  { groups: [g('riftwing', 44, 0.34), g('shield', 44, 0.34, 1.6, 1), g('hexling', 44, 0.34, 3.2, 2), g('mistwalker', 44, 0.34, 4.8, 3), g('veilregent', 1, 1, 4)] },
]

const emberwindWaves: WaveDef[] = [
  { groups: [g('husk', 7, 0.34), g('sprinter', 7, 0.34, 1.6, 1)] },
  { groups: [g('sprinter', 6, 0.34), g('shield', 6, 0.34, 1.6, 1)] },
  { groups: [g('shield', 6, 1.81), g('gargoyle', 6, 1.81, 1.6, 1)] },
  { groups: [g('gargoyle', 6, 3.2), g('husk', 6, 3.2, 1.6, 1)] },
  { groups: [g('husk', 14, 0.34), g('sprinter', 14, 0.34, 1.6, 1)] },
  { groups: [g('sprinter', 11, 0.34), g('shield', 11, 0.34, 1.6, 1)] },
  { groups: [g('shield', 9, 0.34), g('gargoyle', 9, 0.34, 1.6, 1)] },
  { groups: [g('gargoyle', 6, 0.34), g('husk', 6, 0.34, 1.6, 1)] },
  { surge: true, groups: [g('mistwalker', 6, 1.3), g('warlock', 6, 1.3, 1.6, 1)] },
  { groups: [g('riftwing', 4, 3.2), g('hexling', 4, 3.2, 1.6, 1), g('acolyte', 4, 3.2, 3.2, 2)] },
  { groups: [g('shardback', 6, 1.3), g('riftwing', 6, 1.3, 1.6, 1), g('mistwalker', 6, 1.3, 3.2, 2)] },
  { groups: [g('spiderling', 8, 0.34), g('sprinter', 8, 0.34, 1.6, 1), g('riftwing', 8, 0.34, 3.2, 2)] },
  { groups: [g('shield', 25, 0.34), g('spiderling', 25, 0.34, 1.6, 1), g('shardback', 25, 0.34, 3.2, 2), g('hollowking', 1, 1, 4)] },
  { surge: true, groups: [g('acolyte', 12, 0.34), g('husk', 12, 0.34, 1.6, 1), g('spiderling', 12, 0.34, 3.2, 2)] },
  { groups: [g('mistwalker', 11, 0.34), g('warlock', 11, 0.34, 1.6, 1), g('shield', 11, 0.34, 3.2, 2)] },
  { groups: [g('riftwing', 6, 1.87), g('hexling', 6, 1.87, 1.6, 1), g('acolyte', 6, 1.87, 3.2, 2)] },
  { groups: [g('shardback', 8, 0.34), g('riftwing', 8, 0.34, 1.6, 1), g('mistwalker', 8, 0.34, 3.2, 2)] },
  { groups: [g('spiderling', 12, 0.34), g('sprinter', 12, 0.34, 1.6, 1), g('riftwing', 12, 0.34, 3.2, 2), g('shardback', 12, 0.34, 4.8, 3)] },
  { surge: true, groups: [g('shield', 15, 0.34), g('spiderling', 15, 0.34, 1.6, 1), g('shardback', 15, 0.34, 3.2, 2), g('spiderling', 15, 0.34, 4.8, 3)] },
  { groups: [g('hexling', 8, 0.34), g('husk', 8, 0.34, 1.6, 1), g('brute', 8, 0.34, 3.2, 2), g('wardbearer', 8, 0.34, 4.8, 3)] },
  { groups: [g('mistwalker', 11, 0.34), g('warlock', 11, 0.34, 1.6, 1), g('wardbearer', 11, 0.34, 3.2, 2), g('riftherald', 11, 0.34, 4.8, 3), g('juggernaut', 1, 1, 4)] },
  { groups: [g('warlock', 14, 0.34), g('hexling', 14, 0.34, 1.6, 1), g('riftherald', 14, 0.34, 3.2, 2), g('hexling', 14, 0.34, 4.8, 3)] },
  { groups: [g('riftwing', 8, 0.34), g('riftwing', 8, 0.34, 1.6, 1), g('hexling', 8, 0.34, 3.2, 2), g('mistwalker', 8, 0.34, 4.8, 3)] },
  { surge: true, groups: [g('brute', 8, 0.34), g('sprinter', 8, 0.34, 1.6, 1), g('mistwalker', 8, 0.34, 3.2, 2), g('warlock', 8, 0.34, 4.8, 3)] },
  { groups: [g('wardbearer', 11, 0.34), g('spiderling', 11, 0.34, 1.6, 1), g('warlock', 11, 0.34, 3.2, 2), g('riftwing', 11, 0.34, 4.8, 3)] },
  { groups: [g('riftherald', 9, 0.34), g('husk', 9, 0.34, 1.6, 1), g('riftwing', 9, 0.34, 3.2, 2), g('brute', 9, 0.34, 4.8, 3), g('wardbearer', 9, 0.34, 6.4, 4)] },
  { groups: [g('hexling', 8, 0.34), g('warlock', 8, 0.34, 1.6, 1), g('brute', 8, 0.34, 3.2, 2), g('wardbearer', 8, 0.34, 4.8, 3), g('riftherald', 8, 0.34, 6.4, 4)] },
  { groups: [g('mistwalker', 17, 0.34), g('hexling', 17, 0.34, 1.6, 1), g('wardbearer', 17, 0.34, 3.2, 2), g('riftherald', 17, 0.34, 4.8, 3), g('hexling', 17, 0.34, 6.4, 4), g('veilqueen', 1, 1, 4)] },
  { surge: true, groups: [g('warlock', 12, 0.34), g('riftwing', 12, 0.34, 1.6, 1), g('riftherald', 12, 0.34, 3.2, 2), g('hexling', 12, 0.34, 4.8, 3), g('mistwalker', 12, 0.34, 6.4, 4)] },
  { groups: [g('riftwing', 11, 0.34), g('sprinter', 11, 0.34, 1.6, 1), g('hexling', 11, 0.34, 3.2, 2), g('mistwalker', 11, 0.34, 4.8, 3), g('warlock', 11, 0.34, 6.4, 4)] },
  { groups: [g('brute', 12, 0.34), g('spiderling', 12, 0.34, 1.6, 1), g('mistwalker', 12, 0.34, 3.2, 2), g('warlock', 12, 0.34, 4.8, 3), g('riftwing', 12, 0.34, 6.4, 4)] },
  { groups: [g('wardbearer', 17, 0.34), g('husk', 17, 0.34, 1.6, 1), g('warlock', 17, 0.34, 3.2, 2), g('riftwing', 17, 0.34, 4.8, 3), g('brute', 17, 0.34, 6.4, 4), g('veilregent', 1, 1, 4)] },
]

const tidereachWaves: WaveDef[] = [
  { groups: [g('husk', 6, 0.71), g('sprinter', 6, 0.71, 1.6, 1)] },
  { groups: [g('sprinter', 6, 3.2), g('shield', 6, 3.2, 1.6, 1)] },
  { groups: [g('shield', 4, 3.2), g('gargoyle', 4, 3.2, 1.6, 1)] },
  { groups: [g('gargoyle', 6, 0.73), g('husk', 6, 0.73, 1.6, 1)] },
  { groups: [g('husk', 10, 0.34), g('sprinter', 10, 0.34, 1.6, 1)] },
  { groups: [g('sprinter', 7, 0.34), g('shield', 7, 0.34, 1.6, 1)] },
  { groups: [g('shield', 6, 1.3), g('gargoyle', 6, 1.3, 1.6, 1)] },
  { groups: [g('gargoyle', 10, 0.34), g('husk', 10, 0.34, 1.6, 1)] },
  { surge: true, groups: [g('husk', 2, 3.2), g('riftherald', 2, 3.2, 1.6, 1)] },
  { groups: [g('riftwing', 6, 2.79), g('hexling', 6, 2.79, 1.6, 1), g('acolyte', 6, 2.79, 3.2, 2)] },
  { groups: [g('shardback', 5, 3.2), g('brute', 5, 3.2, 1.6, 1), g('mistwalker', 5, 3.2, 3.2, 2)] },
  { groups: [g('spiderling', 8, 0.34), g('mistwalker', 8, 0.34, 1.6, 1), g('riftwing', 8, 0.34, 3.2, 2)] },
  { groups: [g('shield', 6, 2.7), g('riftwing', 6, 2.7, 1.6, 1), g('shardback', 6, 2.7, 3.2, 2)] },
  { groups: [g('acolyte', 30, 0.34), g('acolyte', 30, 0.34, 1.6, 1), g('spiderling', 30, 0.34, 3.2, 2), g('hollowking', 1, 1, 4)] },
  { groups: [g('mistwalker', 5, 3.2), g('riftherald', 5, 3.2, 1.6, 1), g('shield', 5, 3.2, 3.2, 2)] },
  { groups: [g('riftwing', 7, 0.34), g('hexling', 7, 0.34, 1.6, 1), g('acolyte', 7, 0.34, 3.2, 2)] },
  { groups: [g('shardback', 6, 0.34), g('brute', 6, 0.34, 1.6, 1), g('mistwalker', 6, 0.34, 3.2, 2)] },
  { groups: [g('spiderling', 12, 0.34), g('mistwalker', 12, 0.34, 1.6, 1), g('riftwing', 12, 0.34, 3.2, 2)] },
  { surge: true, groups: [g('shield', 6, 2.66), g('riftwing', 6, 2.66, 1.6, 1), g('shardback', 6, 2.66, 3.2, 2), g('spiderling', 6, 2.66, 4.8, 3)] },
  { groups: [g('acolyte', 27, 0.34), g('acolyte', 27, 0.34, 1.6, 1), g('spiderling', 27, 0.34, 3.2, 2), g('shield', 27, 0.34, 4.8, 3)] },
  { groups: [g('mistwalker', 6, 0.34), g('riftherald', 6, 0.34, 1.6, 1), g('wardbearer', 6, 0.34, 3.2, 2), g('riftherald', 6, 0.34, 4.8, 3)] },
  { groups: [g('warlock', 21, 0.34), g('hexling', 21, 0.34, 1.6, 1), g('riftherald', 21, 0.34, 3.2, 2), g('hexling', 21, 0.34, 4.8, 3), g('juggernaut', 1, 1, 4)] },
  { groups: [g('riftwing', 12, 0.34), g('brute', 12, 0.34, 1.6, 1), g('hexling', 12, 0.34, 3.2, 2), g('mistwalker', 12, 0.34, 4.8, 3)] },
  { surge: true, groups: [g('brute', 13, 0.34), g('mistwalker', 13, 0.34, 1.6, 1), g('mistwalker', 13, 0.34, 3.2, 2), g('warlock', 13, 0.34, 4.8, 3)] },
  { groups: [g('wardbearer', 11, 0.34), g('riftwing', 11, 0.34, 1.6, 1), g('warlock', 11, 0.34, 3.2, 2), g('riftwing', 11, 0.34, 4.8, 3)] },
  { groups: [g('riftherald', 16, 0.34), g('acolyte', 16, 0.34, 1.6, 1), g('riftwing', 16, 0.34, 3.2, 2), g('brute', 16, 0.34, 4.8, 3)] },
  { groups: [g('hexling', 11, 0.34), g('riftherald', 11, 0.34, 1.6, 1), g('brute', 11, 0.34, 3.2, 2), g('wardbearer', 11, 0.34, 4.8, 3)] },
  { groups: [g('mistwalker', 20, 0.34), g('hexling', 20, 0.34, 1.6, 1), g('wardbearer', 20, 0.34, 3.2, 2), g('riftherald', 20, 0.34, 4.8, 3), g('hexling', 20, 0.34, 6.4, 4)] },
  { groups: [g('warlock', 26, 0.34), g('brute', 26, 0.34, 1.6, 1), g('riftherald', 26, 0.34, 3.2, 2), g('hexling', 26, 0.34, 4.8, 3), g('mistwalker', 26, 0.34, 6.4, 4), g('veilqueen', 1, 1, 4)] },
  { groups: [g('riftwing', 26, 0.34), g('mistwalker', 26, 0.34, 1.6, 1), g('hexling', 26, 0.34, 3.2, 2), g('mistwalker', 26, 0.34, 4.8, 3), g('warlock', 26, 0.34, 6.4, 4)] },
  { groups: [g('brute', 13, 0.34), g('riftwing', 13, 0.34, 1.6, 1), g('mistwalker', 13, 0.34, 3.2, 2), g('warlock', 13, 0.34, 4.8, 3), g('riftwing', 13, 0.34, 6.4, 4)] },
  { groups: [g('wardbearer', 12, 0.34), g('acolyte', 12, 0.34, 1.6, 1), g('warlock', 12, 0.34, 3.2, 2), g('riftwing', 12, 0.34, 4.8, 3), g('brute', 12, 0.34, 6.4, 4)] },
  { groups: [g('riftherald', 12, 0.34), g('riftherald', 12, 0.34, 1.6, 1), g('riftwing', 12, 0.34, 3.2, 2), g('brute', 12, 0.34, 4.8, 3), g('wardbearer', 12, 0.34, 6.4, 4)] },
  { groups: [g('hexling', 14, 0.34), g('hexling', 14, 0.34, 1.6, 1), g('brute', 14, 0.34, 3.2, 2), g('wardbearer', 14, 0.34, 4.8, 3), g('riftherald', 14, 0.34, 6.4, 4), g('veilregent', 1, 1, 4)] },
]


// ---- the three battlefields past Veilscar ----
export const sunderfallLevel: LevelDef = {
  id: 'sunderfall',
  name: 'Sunderfall Terraces',
  subtitle: 'Four roads, four heights',
  theme: 'highland',
  seed: 8821,
  width: 36, height: 20,
  lanes: [
    [[0, 3],  [30, 3],  [30, 10],  [35, 10]],
    [[0, 16],  [30, 16],  [30, 10],  [35, 10]],
    [[0, 10],  [30, 10],  [35, 10]],
    [[18, 0],  [18, 6],  [33, 6],  [33, 10],  [35, 10]],
  ],
  plots: [[28, 8], [32, 12], [34, 12], [28, 12], [25, 8], [15, 1], [32, 14], [20, 1], [26, 14], [22, 8], [19, 8], [17, 7], [15, 5], [15, 8], [25, 12], [23, 14], [22, 12], [20, 14], [19, 12], [17, 14], [16, 12], [14, 14]],
  trapSpots: [[2, 3], [7, 3], [12, 3], [17, 3], [22, 3], [27, 3], [30, 7], [2, 16], [7, 16], [12, 16], [17, 16], [22, 16], [27, 16], [30, 12], [2, 10], [7, 10], [12, 10], [17, 10], [22, 10]],
  plateaus: [[6, 5, 12, 8, 1.7], [20, 12, 27, 15, 1.5], [12, 12, 17, 14, 1.2], [22, 5, 28, 8, 1.3]],
  landmarks: [[4, 6, 'monolith'], [8, 6, 'arch'], [12, 6, 'spire'], [4, 13, 'greatTree'], [8, 13, 'monolith'], [12, 13, 'arch'], [16, 13, 'spire'], [20, 13, 'greatTree'], [24, 13, 'monolith']],
  water: [[0, 6, 3, 8], [8, 18, 14, 19]],
  hills: [[22, 17, 28, 19], [0, 0, 2, 1], [34, 0, 35, 1]],
  voids: [[0, 19, 1, 19], [35, 19, 35, 19]],
  waves: sunderfallWaves,
  startGold: 540,
  startLives: 20,
  intro: 'The cliffs of Sunderfall break into terraces, and the Veil climbs all four at once. Height is the only advantage you have - take it.',
}

export const emberwindLevel: LevelDef = {
  id: 'emberwind',
  name: 'Emberwind Reach',
  subtitle: 'The firestorm follows your hero',
  theme: 'ashfall',
  seed: 9137,
  width: 38, height: 21,
  lanes: [
    [[0, 3],  [32, 3],  [32, 11],  [37, 11]],
    [[0, 17],  [32, 17],  [32, 11],  [37, 11]],
    [[0, 11],  [32, 11],  [37, 11]],
    [[19, 0],  [19, 7],  [35, 7],  [35, 11],  [37, 11]],
    [[19, 20],  [19, 15],  [35, 15],  [35, 11],  [37, 11]],
  ],
  plots: [[30, 9], [30, 13], [27, 9], [18, 14], [16, 1], [20, 13], [21, 1], [16, 15], [34, 4], [33, 18], [16, 5], [35, 17], [24, 9], [21, 9], [18, 9], [22, 13], [16, 13], [14, 13], [13, 15], [11, 13], [10, 15], [8, 13], [7, 15]],
  trapSpots: [[2, 3], [7, 3], [12, 3], [17, 3], [22, 3], [27, 3], [32, 3], [32, 8], [2, 17], [7, 17], [12, 17], [17, 17], [22, 17], [27, 17], [32, 17], [2, 11], [7, 11], [12, 11], [17, 11], [22, 11], [27, 11], [35, 13]],
  plateaus: [[13, 5, 18, 8, 1], [24, 5, 29, 8, 1], [6, 13, 11, 16, 1]],
  landmarks: [[4, 7, 'ruin'], [12, 7, 'spire'], [16, 7, 'monolith'], [4, 14, 'arch'], [8, 14, 'ruin'], [12, 14, 'spire'], [16, 14, 'monolith'], [35, 2, 'arch'], [35, 18, 'ruin']],
  water: [[6, 5, 11, 8], [24, 13, 29, 16], [2, 19, 6, 20]],
  hills: [[13, 19, 18, 20], [0, 0, 2, 1], [36, 0, 37, 1]],
  voids: [[0, 20, 1, 20], [37, 20, 37, 20]],
  waves: emberwindWaves,
  startGold: 640,
  startLives: 20,
  intro: 'Nothing grows in the Reach, and the Emberwind never stops turning. It follows your champion. Lead it into the horde, and do not stand still.',
}

export const tidereachLevel: LevelDef = {
  id: 'tidereach',
  name: 'Tidereach Causeway',
  subtitle: 'The roads themselves are not yours',
  theme: 'tidal',
  seed: 9613,
  width: 40, height: 22,
  lanes: [
    [[0, 3],  [34, 3],  [34, 12],  [39, 12]],
    [[0, 19],  [34, 19],  [34, 12],  [39, 12]],
    [[0, 12],  [34, 12],  [39, 12]],
    [[20, 0],  [20, 7],  [37, 7],  [37, 12],  [39, 12]],
    [[20, 21],  [20, 16],  [37, 16],  [37, 12],  [39, 12]],
  ],
  plots: [[32, 10], [32, 14], [30, 9], [19, 15], [17, 1], [17, 17], [22, 1], [36, 18], [36, 4], [35, 20], [27, 9], [21, 14], [17, 5], [14, 17], [23, 14], [24, 9], [21, 9], [19, 10], [19, 8], [17, 10], [17, 14], [14, 14], [22, 5], [24, 5], [26, 5]],
  trapSpots: [[2, 3], [7, 3], [12, 3], [17, 3], [22, 3], [27, 3], [32, 3], [34, 8], [37, 12], [2, 19], [7, 19], [12, 19], [17, 19], [22, 19], [27, 19], [32, 19], [2, 12], [7, 12], [12, 12], [17, 12], [22, 12], [27, 12]],
  plateaus: [[14, 5, 19, 9, 1], [26, 5, 31, 9, 1], [6, 14, 11, 18, 1]],
  landmarks: [[4, 7, 'arch'], [13, 7, 'monolith'], [17, 8, 'ruin'], [4, 15, 'spire'], [8, 15, 'arch'], [12, 15, 'monolith'], [16, 15, 'ruin'], [37, 2, 'spire'], [37, 19, 'arch']],
  water: [[6, 5, 12, 9], [25, 14, 31, 18], [2, 20, 7, 21]],
  hills: [[14, 20, 19, 21], [0, 0, 2, 1], [38, 0, 39, 1]],
  voids: [[0, 21, 1, 21], [39, 21, 39, 21]],
  waves: tidereachWaves,
  startGold: 700,
  startLives: 20,
  intro: 'Five causeways over a drowned coast, and the tide decides which of them exist. Build for the map you have; it will not be the map you keep.',
}


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
      [12, 11], [13, 8], [16, 6], [18, 3], [20, 6], [16, 9], [18, 6],
    ],
    trapSpots: [[3, 3], [10, 10], [15, 7]],
    landmarks: [[21, 10, 'greatTree'], [2, 11, 'ruin']],
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
      [13, 7], [14, 10], [17, 8], [20, 10], [19, 7], [2, 1], [7, 7],
    ],
    trapSpots: [[4, 2], [10, 6], [6, 10], [17, 9]],
    landmarks: [[19, 2, 'monolith'], [4, 6, 'spire'], [13, 2, 'arch']],
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
      [12, 8], [8, 8], [14, 11], [17, 8], [20, 8], [18, 12], [21, 4], [14, 8],
    ],
    trapSpots: [[2, 4], [6, 6], [10, 8], [16, 10], [18, 2]],
    plateaus: [[3, 8, 6, 11, 0.35]],
    landmarks: [[4, 11, 'ruin'], [9, 2, 'spire'], [17, 5, 'monolith'], [21, 7, 'arch']],
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
    width: 30, height: 17,
    lanes: [
      [[0, 3], [9, 3], [9, 8], [15, 8], [15, 11], [29, 11]],
      [[0, 14], [6, 14], [6, 8], [15, 8], [15, 11], [29, 11]],
    ],
    plots: [[2, 2], [6, 5], [8, 6], [10, 7], [13, 9], [14, 10], [19, 10], [22, 13], [26, 10], [3, 13], [5, 10], [7, 9], [1, 15], [16, 9], [5, 7], [3, 5]],
    trapSpots: [[5, 3], [9, 6], [8, 8], [6, 11], [22, 11]],
    plateaus: [[17, 9, 22, 13, 0.35], [5, 2, 7, 5, 0.35]],
    landmarks: [[22, 2, 'monolith'], [27, 2, 'arch'], [17, 2, 'spire'], [20, 6, 'monolith'], [25, 6, 'arch']],
    water: [[0, 6, 3, 8], [20, 14, 24, 16], [12, 0, 16, 2]],
    hills: [[0, 0, 3, 1], [10, 5, 14, 6], [27, 14, 29, 16]],
    voids: [[29, 0, 29, 1], [0, 16, 2, 16]],
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
    width: 32, height: 18,
    lanes: [
      [[0, 5], [7, 5], [7, 10], [16, 10], [16, 17]],
      [[15, 0], [15, 6], [11, 6], [11, 10], [16, 10], [16, 17]],
      [[31, 4], [24, 4], [24, 10], [16, 10], [16, 17]],
    ],
    plots: [[2, 4], [5, 6], [6, 9], [9, 7], [10, 11], [12, 9], [14, 5], [16, 5], [17, 9], [20, 11], [22, 7], [25, 6], [27, 2], [30, 5], [15, 15], [16, 7], [14, 8]],
    trapSpots: [[4, 5], [7, 7], [15, 2], [12, 6], [24, 6], [16, 13]],
    plateaus: [[12, 7, 17, 11, 0.35], [2, 12, 6, 15, 0.35]],
    landmarks: [[2, 11, 'spire'], [29, 11, 'monolith'], [6, 15, 'ruin'], [25, 15, 'arch'], [11, 15, 'spire'], [19, 5, 'monolith']],
    water: [[0, 12, 5, 16], [17, 0, 21, 4], [26, 12, 31, 17]],
    hills: [[9, 0, 11, 2], [19, 6, 21, 7]],
    voids: [[0, 17, 2, 17], [30, 0, 31, 1]],
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
    width: 32, height: 18,
    lanes: [
      [[0, 2], [9, 2], [9, 7], [16, 7], [16, 12], [31, 12]],
      [[0, 16], [8, 16], [8, 11], [16, 11], [16, 12], [31, 12]],
      [[31, 1], [23, 1], [23, 7], [16, 7], [16, 12], [31, 12]],
    ],
    plots: [[3, 5], [6, 1], [6, 6], [10, 5], [13, 9], [12, 12], [17, 6], [19, 9], [22, 5], [26, 4], [27, 10], [30, 15], [10, 15], [5, 10], [18, 15], [25, 15], [5, 4], [7, 4], [10, 13]],
    trapSpots: [[5, 2], [9, 5], [12, 7], [8, 13], [19, 12], [23, 4]],
    plateaus: [[9, 4, 14, 7, 0.35], [22, 11, 27, 15, 0.35], [4, 3, 7, 6, 0.35]],
    landmarks: [[2, 9, 'ruin'], [14, 2, 'spire'], [27, 5, 'monolith'], [5, 6, 'arch'], [12, 15, 'ruin'], [5, 12, 'spire'], [25, 9, 'monolith']],
    water: [[0, 12, 4, 15], [18, 2, 21, 5], [27, 6, 31, 9]],
    hills: [[12, 0, 18, 1], [0, 7, 4, 10], [26, 16, 31, 17]],
    voids: [[0, 17, 3, 17], [31, 0, 31, 0]],
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
    width: 34, height: 19,
    lanes: [
      [[0, 3], [11, 3], [11, 9], [17, 9], [17, 18]],
      [[16, 0], [16, 6], [17, 6], [17, 18]],
      [[33, 3], [25, 3], [25, 12], [17, 12], [17, 18]],
    ],
    plots: [[3, 4], [7, 1], [9, 5], [12, 8], [13, 4], [15, 8], [18, 5], [20, 8], [21, 10], [24, 9], [26, 5], [30, 4], [29, 13], [22, 14], [15, 13], [11, 13], [13, 10], [20, 15], [13, 6], [15, 11]],
    trapSpots: [[5, 3], [11, 6], [16, 4], [17, 8], [25, 6], [21, 12], [17, 15]],
    plateaus: [[12, 6, 18, 12, 0.35], [3, 3, 7, 5, 0.35], [26, 13, 32, 17, 0.35]],
    landmarks: [[2, 16, 'spire'], [7, 16, 'monolith'], [6, 11, 'ruin'], [31, 13, 'arch'], [11, 14, 'spire'], [3, 8, 'monolith'], [30, 8, 'ruin'], [21, 4, 'arch']],
    water: [[0, 9, 5, 13], [26, 14, 33, 18], [18, 0, 22, 3]],
    hills: [[12, 0, 13, 3], [4, 17, 9, 18], [28, 6, 32, 9]],
    voids: [[0, 18, 1, 18], [32, 0, 33, 1], [0, 0, 1, 1]],
    waves: veilscarWaves,
    startGold: 460,
    startLives: 20,
    startShards: 5,
    intro: 'Beyond the broken throne, three roads pour into the Veil\'s final wound. Seal it before the Regent crosses.',
  },
  sunderfallLevel,
  emberwindLevel,
  tidereachLevel,
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
