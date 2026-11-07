import type { SaveData } from '../core/save.ts'
import { levels } from './levels.ts'

/**
 * The Chronicle Hold.
 *
 * Blockhold had nothing to collect and no profile: a save file was a set of
 * numbers, and the menu showed whichever battlefield you had unlocked last -
 * the same view for a player on their first night as for one who had cleared
 * the campaign.
 *
 * The Hold turns the save into a place. Every campaign clear, every third
 * star, every flawless defense and every Veteran conquest adds a real piece
 * of masonry, and the keep you have actually earned is what greets you on
 * every boot. A late save differs from a fresh one in silhouette, height,
 * banners and light - which is the point: it is the one screenshot only you
 * could have taken.
 *
 * Placement is derived from what has been earned rather than authored by the
 * player. That keeps it honest - the keep cannot be arranged to look like
 * progress you do not have - and a hand-placement editor is the natural next
 * step rather than a prerequisite.
 */

export interface HoldPieces {
  /** one per map cleared: the towers of the keep */
  towers: number
  /** one per map three-starred: banners on the walls */
  banners: number
  /** one per flawless (no-leak) clear: a statue in the courtyard */
  statues: number
  /** one per Veteran conquest: gilded roofing */
  gilding: number
  /** daily wins: veilcrystal set into the gate */
  relics: number
  /** one per family whose both capstones have won a battle: pennants over the courtyard */
  pennants: number
}

export function holdPieces(save: SaveData): HoldPieces {
  let towers = 0, banners = 0, statues = 0, gilding = 0
  for (const lvl of levels) {
    const stars = save.stars[lvl.id] ?? 0
    const medals = save.medals[lvl.id] ?? []
    if (stars > 0) towers++
    if (stars >= 3) banners++
    if (medals.includes('noleak')) statues++
    if (medals.includes('veteran')) gilding++
  }
  const relics = save.dailyBest?.won ? 1 : 0
  return { towers, banners, statues, gilding, relics, pennants: familiesCompleted(save.capstones ?? []) }
}

/** families with both capstone cards stamped */
export function familiesCompleted(cards: readonly string[]): number {
  const byFamily = new Map<string, Set<string>>()
  for (const id of cards) {
    const [kind, branch] = id.split(':')
    if (!byFamily.has(kind)) byFamily.set(kind, new Set())
    byFamily.get(kind)!.add(branch)
  }
  let n = 0
  for (const branches of byFamily.values()) if (branches.has('0') && branches.has('1')) n++
  return n
}

/**
 * Voxel geometry is cached forever by key, so the key has to describe the
 * keep. Without this the first Hold rendered - a bare one, on a fresh save -
 * would be handed back for every later save, and the Hold would never grow.
 */
export function holdCacheKey(p: HoldPieces): string {
  return `hold:${p.towers}.${p.banners}.${p.statues}.${p.gilding}.${p.relics}.${p.pennants}`
}

export function holdIsEmpty(p: HoldPieces): boolean {
  return p.towers + p.banners + p.statues + p.gilding + p.relics + p.pennants === 0
}

/** a short line describing what the keep is made of, for the menu */
export function holdSummary(p: HoldPieces): string {
  if (holdIsEmpty(p)) return 'Your Hold is bare. Win a battle and it starts to rise.'
  const bits: string[] = []
  bits.push(`${p.towers} tower${p.towers === 1 ? '' : 's'}`)
  if (p.banners) bits.push(`${p.banners} banner${p.banners === 1 ? '' : 's'}`)
  if (p.statues) bits.push(`${p.statues} statue${p.statues === 1 ? '' : 's'}`)
  if (p.gilding) bits.push(`${p.gilding} gilded roof${p.gilding === 1 ? '' : 's'}`)
  if (p.relics) bits.push('a veilcrystal')
  if (p.pennants) bits.push(`${p.pennants} pennant${p.pennants === 1 ? '' : 's'}`)
  return bits.join(' · ')
}
