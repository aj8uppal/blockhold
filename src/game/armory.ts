import { SaveData } from '../core/save.ts'

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
}

export const ARMORY_TRACKS: ArmoryTrack[] = [
  { id: 'salvage', icon: 'coin', name: 'Full Salvage', desc: 'Sell towers and traps for their full price instead of 70%.', tierCosts: [3] },
  { id: 'bulwark', icon: 'castle', name: 'Gate Ward', desc: 'The first enemy to reach the gate each battle costs you nothing.', tierCosts: [4] },
  { id: 'secondwind', icon: 'respawn', name: 'Second Wind', desc: 'Your hero returns from the field in half the time.', tierCosts: [3] },
  { id: 'comet', icon: 'meteor', name: 'Comet Calling', desc: 'Meteor Storm recharges 20% faster and calls one extra meteor.', tierCosts: [3] },
  { id: 'runesmith', icon: 'rune', name: 'Runesmith', desc: 'Road traps re-arm 20% faster per tier.', tierCosts: [1, 2] },
  { id: 'coffers', icon: 'chest', name: 'Royal Coffers', desc: 'Begin every battle with +40 gold per tier.', tierCosts: [1, 2] },
  { id: 'prospector', icon: 'gem', name: 'Prospector', desc: 'Begin every battle with +3 shards per tier.', tierCosts: [1, 2] },
  { id: 'drill', icon: 'shield', name: 'Drill Sergeants', desc: 'Barracks soldiers and reinforcements gain +15% health per tier.', tierCosts: [1, 2] },
]

/**
 * The campaign yields exactly 21 stars. The board deliberately costs 30, so
 * finishing it no longer buys everything and the free respec has a job:
 * the old board cost exactly 21 too, which closed the loop the moment a
 * player finished and made the respec pointless.
 */
export const ARMORY_TOTAL_COST = ARMORY_TRACKS.reduce((sum, t) => sum + t.tierCosts.reduce((a, b) => a + b, 0), 0)

/** true once a track's effect is bought at all */
export function hasArmory(save: SaveData, id: string): boolean {
  return armoryTier(save, id) > 0
}

export function starsEarned(save: SaveData): number {
  return Object.values(save.stars).reduce((a, b) => a + b, 0)
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
  if (tier >= track.tierCosts.length) return false
  if (starsAvailable(save) < track.tierCosts[tier]) return false
  save.armory[id] = tier + 1
  return true
}

export function respec(save: SaveData): void {
  save.armory = {}
}
