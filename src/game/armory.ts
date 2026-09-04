import { SaveData } from '../core/save.ts'
import { isUnlocked } from './progress.ts'

/**
 * The Royal Armory: permanent kingdom upgrades bought with campaign stars.
 * Stars are never consumed from the record — "spent" is tracked by what has
 * been purchased, and a free respec refunds everything.
 */

export interface ArmoryTrack {
  id: string
  icon: string
  name: string
  desc: string
  tierCosts: number[]     // star cost of each tier
  /** shown only once this is unlocked on the account ladder (see progress.ts) */
  requires?: { kind: 'tower' | 'hero', id: string }
}

export const ARMORY_TRACKS: ArmoryTrack[] = [
  { id: 'salvage', icon: 'coin', name: 'Full Salvage', desc: 'Sell towers and traps for their full price instead of 70%.', tierCosts: [3] },
  { id: 'bulwark', icon: 'castle', name: 'Gate Ward', desc: 'The first enemy to reach the gate each battle costs you nothing.', tierCosts: [4] },
  { id: 'secondwind', icon: 'respawn', name: 'Second Wind', desc: 'Your hero returns from the field in half the time.', tierCosts: [3] },
  { id: 'comet', icon: 'meteor', name: 'Comet Calling', desc: 'Meteor Storm recharges 20% faster and calls one extra meteor.', tierCosts: [3] },
  { id: 'runesmith', icon: 'rune', name: 'Runesmith', desc: 'Road traps re-arm 20% faster per tier.', tierCosts: [1, 2, 3] },
  { id: 'coffers', icon: 'chest', name: 'Royal Coffers', desc: 'Begin every battle with +40 gold per tier.', tierCosts: [1, 2, 3] },
  { id: 'prospector', icon: 'gem', name: 'Prospector', desc: 'Begin every battle with +3 shards per tier.', tierCosts: [1, 2, 3] },
  { id: 'drill', icon: 'shield', name: 'Drill Sergeants', desc: 'Barracks soldiers and reinforcements gain +15% health per tier.', tierCosts: [1, 2, 3] },
  // the long tail: tracks a full campaign cannot afford, bought with crown stars
  { id: 'musterroll', icon: 'soldiers', name: 'Muster Roll', desc: 'Every barracks fields one more soldier.', tierCosts: [3] },
  { id: 'bountyhunter', icon: 'skull', name: 'Bounty Hunter', desc: 'Elites pay +25% gold per tier.', tierCosts: [1, 2] },
  { id: 'rations', icon: 'heart', name: 'Long Night Rations', desc: 'In freeplay and the Long Night, regain a life every ten waves held; two at the second tier.', tierCosts: [1, 2] },
  { id: 'veilward', icon: 'castle', name: 'Veilward', desc: 'A boss reaching the gate costs ten lives instead of ending the battle outright.', tierCosts: [4] },
  { id: 'siegecraft', icon: 'target', name: 'Siegecraft', desc: 'Ballistae reach +6% further per tier.', tierCosts: [1, 2, 2], requires: { kind: 'tower', id: 'ballista' } },
  { id: 'lamplighters', icon: 'flame', name: 'Lamplighters', desc: 'Beacons light +0.3 further per tier.', tierCosts: [1, 2, 2], requires: { kind: 'tower', id: 'beacon' } },
]

/**
 * The board must always cost more than the campaign can pay for, or finishing
 * it buys everything and the free respec has nothing to do.
 *
 * Ten maps yield thirty stars. The board was priced at twenty-five for a
 * seven-map campaign, so the three new battlefields would have handed players
 * the whole thing with change to spare; the four scaling tracks gained a third
 * tier rather than the prices being inflated, which keeps the choice live and
 * gives a longer campaign something left to buy.
 */
export const ARMORY_TOTAL_COST = ARMORY_TRACKS.reduce((sum, t) => sum + t.tierCosts.reduce((a, b) => a + b, 0), 0)

/** true once a track's effect is bought at all */
export function hasArmory(save: SaveData, id: string): boolean {
  return armoryTier(save, id) > 0
}

/**
 * Stars from victories plus one crown star per map conquered on Veteran.
 *
 * The board now costs sixty against thirty campaign stars, and the missing
 * thirty are the grind: a Veteran clear is worth a fourth star, so replaying
 * every map on the hardest setting is what completes the Armory. The crown
 * comes from the existing `veteran` medal rather than a fourth value in
 * `stars`, because the save parser clamps stars to three and every device
 * already merges medals as a union - so old clears count retroactively and
 * nothing has to migrate.
 */
export function starsEarned(save: SaveData): number {
  return Object.values(save.stars).reduce((a, b) => a + b, 0) + crownStars(save)
}

export function crownStars(save: SaveData): number {
  return Object.values(save.medals ?? {}).filter(m => Array.isArray(m) && m.includes('veteran')).length
}

/** the tracks this account can see: the rest wait behind the ladder */
export function visibleTracks(save: SaveData): ArmoryTrack[] {
  return ARMORY_TRACKS.filter(t => !t.requires || isUnlocked(save, t.requires.kind, t.requires.id))
}

export function starsSpent(save: SaveData): number {
  let spent = 0
  for (const track of ARMORY_TRACKS) {
    const tier = save.armory[track.id] ?? 0
    for (let i = 0; i < tier; i++) spent += track.tierCosts[i] ?? 0
  }
  return spent
}

export function starsAvailable(save: SaveData): number {
  return Math.max(0, starsEarned(save) - starsSpent(save))
}

export function armoryTier(save: SaveData, id: string): number {
  const track = ARMORY_TRACKS.find(t => t.id === id)
  if (!track) return 0
  return Math.min(save.armory[id] ?? 0, track.tierCosts.length)
}

/** try to buy the next tier; returns whether it succeeded */
export function buyTier(save: SaveData, id: string): boolean {
  const track = ARMORY_TRACKS.find(t => t.id === id)
  if (!track) return false
  const tier = save.armory[id] ?? 0
  if (track.requires && !isUnlocked(save, track.requires.kind, track.requires.id)) return false
  if (tier >= track.tierCosts.length) return false
  if (starsAvailable(save) < track.tierCosts[tier]) return false
  save.armory[id] = tier + 1
  return true
}

export function respec(save: SaveData): void {
  save.armory = {}
}
