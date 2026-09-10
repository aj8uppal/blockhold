import type { SaveData } from '../core/save.ts'
import type { Difficulty, HeroId, LevelDef, TowerKind, WaveGroup } from './types.ts'
import { levelById } from './levels.ts'
import { levelForXp } from './progress.ts'

export type HuntId = 'ossuary' | 'empress'
export interface HuntDef {
  id: HuntId
  name: string
  boss: string
  map: string
  briefing: string
  phases: string[]
}
export const HUNTS: HuntDef[] = [
  { id: 'ossuary', name: 'The Bone Procession', boss: 'ossuary', map: 'greenhollow',
    briefing: 'The Ossuary raises fallen escorts within three tiles. Focus the colossus, or defeat escorts outside its ring. Raised escorts grant no rewards.',
    phases: ['Prepare a mixed defense', 'Break the armored procession', 'Defeat the Ossuary before it reaches the keep'] },
  { id: 'empress', name: 'The Fallen Crown', boss: 'veilempress', map: 'frostmere',
    briefing: 'The Empress flies and phases. Set air towers to Strongest to break her wings, then stop her armored ground form. Save a reserve for her landing.',
    phases: ['Prepare air and ground coverage', 'Break her wings', 'Defeat the grounded Empress'] },
]
export const huntById = (id: string): HuntDef | undefined => HUNTS.find(h => h.id === id)
export const huntAccess = (save: Pick<SaveData, 'xp' | 'stars'>): boolean => levelForXp(save.xp) >= 25 || (save.stars.tidereach ?? 0) > 0

/** Earn the capstone budget by clearing the approach; the final boss pays its own bounty. */
export function huntClearGold(waveNo: number): number {
  return Number.isInteger(waveNo) && waveNo >= 1 && waveNo < 10 ? 900 : 0
}

const g = (enemy: string, count: number, interval: number, delay = 0, lane = 0, hpMult = 1): WaveGroup =>
  ({ enemy, count, interval, delay, lane, hpMult })

/** Authored late-game encounters; each wave carries its own health, so no campaign ramp compounds it. */
export function huntLevel(id: HuntId): LevelDef {
  const hunt = huntById(id)!
  const base = levelById(hunt.map)
  const air = id === 'empress', lane = air ? 1 : 0
  const waves = [
    [g('shield', 12, 1.2, 0, 0, 2.2), g('gargoyle', 8, 1.5, 8, lane, 2)],
    [g('sprinter', 24, 0.7, 0, lane, 2.5), g('brute', 4, 6, 7, 0, 1.8)],
    [g('warlock', 8, 2.8, 0, 0, 2), g('shield', 16, 1, 3, lane, 2.8), g('shardback', 3, 6, 7, 0, 2)],
    [g(air ? 'riftwing' : 'gargoyle', 16, 1.3, 0, lane, 2.2), g('acolyte', 4, 5, 7, 0, 2)],
    [g('mistwalker', 18, 1.2, 0, lane, 2.4), g('brute', 5, 5, 4, 0, 2.2)],
    [g(air ? 'veilqueen' : 'hollowking', 1, 1, 9, 0, 1.8), g('shield', 20, 1.1, 0, lane, 3), g('shardback', 4, 6, 12, 0, 2.5)],
    [g('warlock', 10, 2.5, 0, lane, 2.7), g('gargoyle', 18, 1.2, 5, 0, 3), g('brute', 5, 5, 8, lane, 2.5)],
    [g('mistwalker', 18, 1, 0, 0, 3), g('shield', 18, 1.2, 5, lane, 3.5), g('shardback', 4, 5, 12, 0, 3)],
    [g('brute', 7, 4.5, 0, lane, 3), g(air ? 'riftwing' : 'gargoyle', 18, 1.1, 6, 0, 3)],
    [g(hunt.boss, 1, 1, 12, 0, air ? 3.2 : 3.4), g('shield', 28, 1, 0, 0, 3.6),
      g(air ? 'riftwing' : 'husk', 24, 1.1, 18, lane, 3.2), g('warlock', 7, 4, 24, lane, 3)],
  ].map((groups, i) => ({
    groups: groups.map(group => ({ ...group, hpMult: (group.hpMult ?? 1) * (i >= 6 ? 1.5 : i >= 3 ? 1.2 : 1) })),
    breakAfter: i === 5 || i === 8 ? 48 : 40,
  }))
  return { ...base, id: `hunt-${id}`, name: hunt.name, subtitle: 'Boss hunt · ten waves',
    theme: air ? 'void' : 'ashfall', hazard: undefined, waves, flatScale: true,
    startGold: 6400, startShards: 10, intro: hunt.briefing }
}

export function heroHunts(save: Pick<SaveData, 'honors'>, hero: HeroId): number {
  return HUNTS.filter(h => save.honors?.includes(`hero:${hero}:${h.id}`)).length
}
export function masteryReady(save: Pick<SaveData, 'xp' | 'honors'>, family: TowerKind): boolean {
  return levelForXp(save.xp) >= 30 && HUNTS.every(h => save.honors?.includes(`mastery:${family}:${h.id}`))
}
export function masteryHint(save: Pick<SaveData, 'xp' | 'honors'>, family: TowerKind): string {
  const count = HUNTS.filter(h => save.honors?.includes(`mastery:${family}:${h.id}`)).length
  return `Level 30 · ${count}/2 Normal or Veteran hunts mastered with ${family === 'seraph' ? 'Seraph' : 'Barracks'}`
}

/** Awards are completion stamps, never kill farming. All bonuses are once per distinct stamp. */
export function awardHunt(save: SaveData, id: HuntId, difficulty: Difficulty, hero: HeroId,
  qualified: TowerKind[]): { honors: string[], bonusXp: number } {
  const before = new Set(save.honors ?? [])
  const earned = [`hunt:${id}:${difficulty}`, `hero:${hero}:${id}`]
  if (difficulty !== 'casual') for (const family of qualified) if (family === 'seraph' || family === 'barracks') earned.push(`mastery:${family}:${id}`)
  const honors = earned.filter(x => !before.has(x))
  save.honors = [...new Set([...before, ...earned])]
  return { honors, bonusXp: honors.reduce((n, x) => n + (x.startsWith('hunt:') ? 800 : x.startsWith('hero:') ? 400 : 600), 0) }
}
