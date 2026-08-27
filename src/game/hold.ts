import type { SaveData } from '../core/save.ts'
import { levels } from './levels.ts'
import { box, type VoxBox, type VoxModel } from '../voxel/builder.ts'

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
  return { towers, banners, statues, gilding, relics }
}

/**
 * Voxel geometry is cached forever by key, so the key has to describe the
 * keep. Without this the first Hold rendered - a bare one, on a fresh save -
 * would be handed back for every later save, and the Hold would never grow.
 */
export function holdCacheKey(p: HoldPieces): string {
  return `hold:${p.towers}.${p.banners}.${p.statues}.${p.gilding}.${p.relics}`
}

export function holdIsEmpty(p: HoldPieces): boolean {
  return p.towers + p.banners + p.statues + p.gilding + p.relics === 0
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
  return bits.join(' · ')
}

const C = {
  stone: 0x8d8f96, stoneDark: 0x6d6f77, stoneLight: 0xa8aab1,
  roof: 0x5a3f6b, roofGilt: 0xe8b23c,
  banner: 0xb03a4a, bannerPole: 0x5a4326,
  statue: 0xd8d4c4, crystal: 0x8fdfff,
  ground: 0x5f8f4a,
}

/**
 * Compose the keep from what has been earned. The courtyard is always there;
 * everything above it is something the player did.
 */
export function holdModel(p: HoldPieces): VoxModel {
  const ground: VoxBox[] = [
    box(0, -0.6, 0, 26, 1.2, 21, C.ground),
    box(0, 0.1, 0, 17, 0.4, 13, C.stoneDark),
  ]

  const keep: VoxBox[] = [
    // the great hall: always standing, even on a fresh save
    box(0, 3.0, 0, 7.5, 5.4, 6.0, C.stone),
    box(0, 6.0, 0, 8.2, 0.7, 6.6, C.stoneLight),
    box(0, 0.8, 3.3, 2.4, 1.6, 0.5, C.stoneDark),      // gate
  ]
  // the gate takes a veilcrystal once a daily has been won
  if (p.relics > 0) keep.push(box(0, 2.2, 3.35, 1.0, 1.0, 0.35, C.crystal, true))

  // roof: gilded once Veteran maps start falling
  const gilded = p.gilding > 0
  keep.push(box(0, 7.0, 0, 6.4, 1.6, 5.0, gilded ? C.roofGilt : C.roof))
  if (p.gilding >= 3) keep.push(box(0, 8.1, 0, 4.4, 0.8, 3.4, C.roofGilt))

  // one corner tower per map cleared, rising as the campaign is beaten
  // pushed clear of the hall and standing taller than it, so each one reads
  // as its own tower against the sky rather than merging into the mass
  const corners: [number, number][] = [
    [-6.6, -4.4], [6.6, -4.4], [-6.6, 4.4], [6.6, 4.4],
    [-9.2, 0], [9.2, 0], [0, -6.4],
  ]
  const towers: VoxBox[] = []
  for (let i = 0; i < Math.min(p.towers, corners.length); i++) {
    const [x, z] = corners[i]
    const h = 8.0 + (i % 3) * 1.6
    towers.push(box(x, h / 2, z, 2.2, h, 2.2, C.stone))
    towers.push(box(x, h * 0.62, z, 2.5, 0.35, 2.5, C.stoneDark))   // string course
    towers.push(box(x, h + 0.35, z, 2.9, 0.7, 2.9, C.stoneLight))   // battlement
    towers.push(box(x, h + 1.4, z, 1.9, 1.6, 1.9, gilded ? C.roofGilt : C.roof))
  }

  // a banner per three-star map, hung along the wall
  const banners: VoxBox[] = []
  for (let i = 0; i < p.banners; i++) {
    const x = -4.5 + i * 1.5
    banners.push(box(x, 4.4, 3.15, 0.14, 3.0, 0.14, C.bannerPole))
    banners.push(box(x, 4.0, 3.05, 1.0, 2.0, 0.12, C.banner))
  }

  // a statue per flawless defense, standing in the courtyard
  const statues: VoxBox[] = []
  for (let i = 0; i < p.statues; i++) {
    const x = -5.0 + i * 2.0
    statues.push(box(x, 0.7, 6.2, 1.0, 1.0, 1.0, C.stoneDark))
    statues.push(box(x, 1.9, 6.2, 0.7, 1.6, 0.7, C.statue))
    statues.push(box(x, 2.9, 6.2, 0.5, 0.5, 0.5, C.statue))
  }

  return {
    parts: { ground, keep, towers, banners, statues },
    scale: 0.1,
  }
}
