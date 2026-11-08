import type { SaveData } from '../core/save.ts'
import { blankHold, HOLD_IDS, HOLD_MAPS, HOLD_FAMILIES, HOLD_PATHS } from '../core/holdData.ts'
import { levelForXp } from './progress.ts'

/**
 * Trophies: everything a save can earn beyond stars, and what each one asks.
 *
 * These used to be pieces for a courtyard the player arranged by hand. The
 * castle behind the menu already grows from the same victories, so the
 * courtyard was a second, disconnected picture of one record; what was worth
 * keeping is the list itself - what you have, what is next, and the battle
 * that earns it. The ids and the `seen` set still live in `save.hold`, so a
 * save from the courtyard days loads and syncs unchanged.
 */

const MAP_NAMES = ['Greenhollow', 'Frostmere', 'Emberwastes', 'Mistfen', 'Shattered Crown', 'Cinderwake', 'Veilscar', 'Sunderfall', 'Emberwind', 'Tidereach']
const PATH_NAMES = ['Bulwark', 'Vanguard', 'Hawkeye', 'Gale Warden', 'Tempest', 'Riftbinder']
const ENDLESS = [15, 30, 60, 100]
const ENDLESS_NAMES = ['The First Watch', 'The Long Watch', 'The Unbroken', 'The Eternal']
const HEROES = ['aldric', 'liora', 'zephyra']

export type TrophyKind = 'watch' | 'banner' | 'statue' | 'pennant' | 'mastery' | 'hunt' | 'hero' | 'endless' | 'daily'
export interface Trophy {
  id: string
  kind: TrophyKind
  /** the map, tower family, hunt, hero path or wave count it belongs to */
  key: string
  name: string
  owned: boolean
  requirement: string
  progress: string
  /** where to go to earn it */
  action: 'levels' | 'hunts' | 'daily'
  /** the map to open, for a campaign trophy */
  source?: string
}

const title = (s: string) => s[0].toUpperCase() + s.slice(1)
const KINDS = new Set<string>(['watch', 'banner', 'statue', 'pennant', 'mastery', 'hunt', 'hero', 'endless', 'daily'])

export function trophyCatalog(save: SaveData): Trophy[] {
  const honors = save.honors ?? []
  return HOLD_IDS.filter(id => KINDS.has(id.split(':')[0])).map(id => {
    const [kind, key] = id.split(':') as [TrophyKind, string]
    const t: Trophy = { id, kind, key, name: '', owned: false, requirement: '', progress: '', action: 'levels' }
    const map = HOLD_MAPS.indexOf(key as typeof HOLD_MAPS[number])
    if (map >= 0) {
      const name = MAP_NAMES[map], stars = save.stars[key] ?? 0, medals = save.medals[key] ?? []
      t.source = key
      if (kind === 'watch') Object.assign(t, { name: `${name} Watch`, owned: stars > 0, requirement: `Win ${name} on any difficulty.`, progress: stars > 0 ? 'Won' : 'Not won yet' })
      if (kind === 'banner') Object.assign(t, { name: `${name} Banner`, owned: stars >= 3, requirement: `Earn three stars on ${name}.`, progress: `${stars}/3 stars` })
      if (kind === 'statue') {
        const owned = medals.includes('noleak')
        Object.assign(t, { name: `${name} Guardian`, owned, requirement: `Win ${name} without letting a single enemy through.`, progress: owned ? 'Flawless' : 'No flawless win yet' })
      }
    } else if (kind === 'pennant') {
      const n = [0, 1].filter(b => save.capstones?.includes(`${key}:${b}`)).length
      Object.assign(t, { name: `${title(key)} Pennant`, owned: n === 2, requirement: `Win a campaign battle with each tier-five ${key} branch standing.`, progress: `${n}/2 branches` })
    } else if (kind === 'mastery') {
      const n = ['ossuary', 'empress'].filter(h => honors.includes(`mastery:${key}:${h}`)).length, level = levelForXp(save.xp)
      Object.assign(t, {
        name: `${title(key)} Masterwork`, owned: n === 2 && level >= 30, action: 'hunts',
        requirement: `Reach level 30, and win both hunts on Normal or Veteran with a tier-five ${key} that dealt 4,000 damage still standing.`,
        progress: `${n}/2 hunts · level ${level}/30`,
      })
    } else if (kind === 'hunt') {
      const owned = honors.some(h => h.startsWith(`hunt:${key}:`))
      Object.assign(t, {
        name: key === 'ossuary' ? 'Crown of Bones' : 'Wings of the Empress', owned, action: 'hunts',
        requirement: `Win ${key === 'ossuary' ? 'The Bone Procession' : 'The Fallen Crown'} on any difficulty.`, progress: owned ? 'Conquered' : 'Not conquered yet',
      })
    } else if (kind === 'hero') {
      const i = HOLD_PATHS.indexOf(key as typeof HOLD_PATHS[number]), hero = HEROES[Math.floor(i / 2)], need = i % 2 + 1
      const n = ['ossuary', 'empress'].filter(h => honors.includes(`hero:${hero}:${h}`)).length
      Object.assign(t, {
        name: `${PATH_NAMES[i]} Standard`, owned: n >= need, action: 'hunts',
        requirement: `Win ${need === 1 ? 'either hunt' : 'both hunts'} with ${title(hero)}.`, progress: `${Math.min(n, need)}/${need} ${need === 1 ? 'hunt' : 'hunts'}`,
      })
    } else if (kind === 'endless') {
      const best = Math.max(0, ...Object.values(save.bestFreeplay))
      Object.assign(t, {
        name: ENDLESS_NAMES[ENDLESS.indexOf(+key)], owned: best >= +key,
        requirement: `After a campaign win, choose Hold the line and survive ${key} extra waves.`, progress: `Best +${best}`,
      })
    } else if (kind === 'daily') {
      const owned = !!(save.dailyBest?.won || save.hold?.dailyWon)
      Object.assign(t, { name: 'Veilcrystal', owned, action: 'daily', requirement: 'Win a Daily Hold.', progress: owned ? 'Won' : 'Not won yet' })
    }
    return t
  })
}

/** earned since the trophies were last looked at */
export function newTrophies(save: SaveData): Trophy[] {
  const seen = new Set(save.hold?.seen ?? [])
  return trophyCatalog(save).filter(t => t.owned && !seen.has(t.id))
}

/** remember that every earned trophy has been seen; returns whether anything changed */
export function markTrophiesSeen(save: SaveData): boolean {
  const owned = trophyCatalog(save).filter(t => t.owned).map(t => t.id)
  const before = save.hold?.seen ?? []
  if (owned.every(id => before.includes(id))) return false
  // keep starter-courtyard ids an older save may carry, so a merge never shrinks
  save.hold = { ...(save.hold ?? blankHold()), seen: [...new Set([...before, ...owned])].sort() }
  return true
}

/**
 * The one to go after next: the next map to win, then its stars, then a
 * flawless run, then the longer roads. Campaign order within each.
 */
export function nextTrophy(list: readonly Trophy[]): Trophy | undefined {
  const order: TrophyKind[] = ['watch', 'banner', 'statue', 'pennant', 'hunt', 'hero', 'endless', 'daily', 'mastery']
  return [...list].filter(t => !t.owned).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0]
}

export { MAP_NAMES, HEROES, HOLD_MAPS as TROPHY_MAPS, HOLD_FAMILIES as TROPHY_FAMILIES, HOLD_PATHS as TROPHY_PATHS }
