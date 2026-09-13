import type { SaveData } from '../core/save.ts'
import { blankHold, HOLD_IDS, HOLD_MAPS, HOLD_FAMILIES, HOLD_PATHS, HOLD_WIDTH, HOLD_HEIGHT, placementError, sanitizeHold, type HoldPlacement, type HoldRecord, type HoldSnapshot } from '../core/holdData.ts'
import { levelForXp } from '../game/progress.ts'

const MAP_NAMES = ['Greenhollow', 'Frostmere', 'Emberwastes', 'Mistfen', 'Shattered Crown', 'Cinderwake', 'Veilscar', 'Sunderfall', 'Emberwind', 'Tidereach']
const PATH_NAMES = ['Bulwark', 'Vanguard', 'Hawkeye', 'Gale Warden', 'Tempest', 'Riftbinder']
export interface HoldReward { id: string, name: string, category: 'Buildings' | 'Trophies' | 'Banners' | 'Landscape', owned: boolean, requirement: string, progress: string, action: 'levels' | 'hunts' | 'daily', source?: string }
const title = (s: string) => s[0].toUpperCase() + s.slice(1)
export function holdCatalog(save: SaveData): HoldReward[] {
  return HOLD_IDS.map(id => {
    const [kind, key] = id.split(':')
    const map = HOLD_MAPS.indexOf(key as typeof HOLD_MAPS[number]), name = MAP_NAMES[map]
    const stars = save.stars[key] ?? 0, medals = save.medals[key] ?? [], honors = save.honors ?? []
    let owned = false, label = '', requirement = '', progress = '', category: HoldReward['category'] = 'Trophies', action: HoldReward['action'] = 'levels', source: string | undefined
    if (map >= 0) {
      source = key
      if (kind === 'watch') { label = `${name} Watch`; category = 'Buildings'; owned = stars > 0; requirement = `Win ${name} on any difficulty.`; progress = `${stars > 0 ? 1 : 0}/1 victory` }
      if (kind === 'banner') { label = `${name} Banner`; category = 'Banners'; owned = stars >= 3; requirement = `Earn three stars on ${name}.`; progress = `${stars}/3 stars` }
      if (kind === 'statue') { label = `${name} Guardian`; owned = medals.includes('noleak'); requirement = `Win ${name} without a leak.`; progress = owned ? 'Flawless defense' : 'No flawless defense yet' }
    } else if (kind === 'pennant') {
      label = `${title(key)} Pennant`; category = 'Banners'
      const n = [0, 1].filter(b => save.capstones?.includes(`${key}:${b}`)).length
      owned = n === 2; requirement = `Win campaign battles with each tier-five ${key} branch standing.`; progress = `${n}/2 branches`
    } else if (kind === 'mastery') {
      label = `${title(key)} Masterwork`; action = 'hunts'
      const n = ['ossuary', 'empress'].filter(h => honors.includes(`mastery:${key}:${h}`)).length
      owned = n === 2 && levelForXp(save.xp) >= 30
      requirement = `Reach account level 30. Win both hunts on Normal or Veteran with a tier-five ${key} that dealt at least 4,000 damage still standing.`
      progress = `${n}/2 hunts · Level ${levelForXp(save.xp)}/30`
    } else if (kind === 'hunt') {
      label = key === 'ossuary' ? 'Crown of Bones' : 'Wings of the Empress'; action = 'hunts'; source = key
      owned = honors.some(h => h.startsWith(`hunt:${key}:`)); requirement = `Win ${key === 'ossuary' ? 'The Bone Procession' : 'The Fallen Crown'} on any difficulty.`; progress = owned ? 'Hunt conquered' : 'Hunt not yet conquered'
    } else if (kind === 'hero') {
      const i = HOLD_PATHS.indexOf(key as typeof HOLD_PATHS[number]), hero = ['aldric', 'liora', 'zephyra'][Math.floor(i / 2)], need = i % 2 + 1
      const n = ['ossuary', 'empress'].filter(h => honors.includes(`hero:${hero}:${h}`)).length
      label = `${PATH_NAMES[i]} Standard`; owned = n >= need; action = 'hunts'
      requirement = `Win ${need === 1 ? 'either hunt' : 'both hunts'} with ${title(hero)} on any difficulty.`; progress = `${Math.min(n, need)}/${need} distinct hunts`
    } else if (kind === 'endless') {
      const n = Math.max(0, ...Object.values(save.bestFreeplay))
      label = ['The First Watch', 'The Long Watch', 'The Unbroken', 'The Eternal'][[15, 30, 60, 100].indexOf(+key)]
      owned = n >= +key; requirement = `Hold the line through ${key} extra waves after a campaign victory.`; progress = `+${n}/+${key} waves`
    } else if (kind === 'daily') {
      label = 'Veilcrystal'; owned = !!(save.dailyBest?.won || save.hold?.dailyWon); action = 'daily'; requirement = 'Win a Daily Hold.'; progress = owned ? 'Daily victory' : 'No recorded daily victory'
    } else {
      label = `${({ tree: 'Courtyard Pine', rock: 'Weathered Stone', flowers: 'Wildflower Bed', lamp: 'Gate Lantern' } as Record<string, string>)[kind]} ${+key + 1}`
      category = 'Landscape'; owned = true; requirement = 'Part of your starter courtyard.'; progress = 'Yours from the beginning'
    }
    return { id, name: label, category, owned, requirement, progress, action, source }
  })
}
export function themeUnlocked(save: SaveData, theme: HoldRecord['theme']): boolean {
  return theme === 'forest' || (theme === 'winter' ? (save.stars.frostmere ?? 0) > 0 : theme === 'ember' ? ['emberwastes', 'cinderwake', 'emberwind'].some(id => save.stars[id] > 0) : ['shatteredcrown', 'veilscar'].some(id => save.stars[id] > 0))
}
export const hasGilding = (save: SaveData): boolean => Object.values(save.medals).some(m => m.includes('veteran'))
export function ownedHold(save: SaveData, draft = save.hold): HoldRecord {
  const record = sanitizeHold(draft) ?? blankHold(), owned = new Set(holdCatalog(save).filter(r => r.owned).map(r => r.id))
  record.placements = record.placements.filter(p => owned.has(p.id))
  record.stored = record.stored.filter(id => owned.has(id))
  if (!themeUnlocked(save, record.theme)) record.theme = 'forest'
  if (!hasGilding(save)) record.keep = 'stone'
  return record
}
/** Explicit storage is the only opt-out: future rewards continue to grow an edited Hold. */
export function effectivePieces(save: SaveData, draft = save.hold): HoldPlacement[] {
  const record = ownedHold(save, draft), out = [...record.placements]
  const owned = holdCatalog(save).filter(r => r.owned && !out.some(p => p.id === r.id) && !record.stored.includes(r.id))
  // Large structures first, then unique trophies and finally landscaping.
  owned.sort((a, b) => (a.category === 'Buildings' ? 0 : a.category === 'Landscape' ? 2 : 1) - (b.category === 'Buildings' ? 0 : b.category === 'Landscape' ? 2 : 1) || HOLD_IDS.indexOf(a.id) - HOLD_IDS.indexOf(b.id))
  const cells = Array.from({ length: HOLD_WIDTH * HOLD_HEIGHT }, (_, i) => ({ x: i % HOLD_WIDTH, z: Math.floor(i / HOLD_WIDTH) }))
  cells.sort((a, b) => Math.hypot(b.x - 6, b.z - 4) - Math.hypot(a.x - 6, a.z - 4) || a.z - b.z || a.x - b.x)
  for (const reward of owned) {
    const kind = reward.id.split(':')[0]
    const starter: Record<string, [number, number][]> = { tree: [[3, 3], [9, 3], [9, 8]], flowers: [[5, 8], [7, 8], [5, 10]], lamp: [[5, 6], [7, 6], [6, 2]], rock: [[3, 8], [9, 6], [3, 6]] }
    const candidates = [...(starter[kind] ?? []).map(([x, z]) => ({ x, z })), ...cells]
    const cell = candidates.find(c => !placementError({ id: reward.id, ...c, r: 0 }, out))
    if (cell) out.push({ id: reward.id, ...cell, r: 0 })
  }
  return out
}
export function holdSnapshot(save: SaveData, draft = save.hold, date = Date.now()): HoldSnapshot {
  const { name, theme, color, keep } = ownedHold(save, draft)
  return { version: 1, name, theme, color, keep, pieces: effectivePieces(save, draft), date }
}
export function newHoldRewards(save: SaveData): HoldReward[] {
  return holdCatalog(save).filter(r => r.owned && r.category !== 'Landscape' && !save.hold?.seen.includes(r.id))
}
export const familyIndex = (id: string): number => HOLD_FAMILIES.indexOf(id as typeof HOLD_FAMILIES[number])
