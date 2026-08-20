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
  { id: 'fletching', icon: '🏹', name: 'Fletching', desc: 'Arrow towers deal +8% damage per tier.', tierCosts: [1, 2] },
  { id: 'arcane', icon: '🔮', name: 'Arcane Focus', desc: 'Mage towers deal +8% damage per tier.', tierCosts: [1, 2] },
  { id: 'powder', icon: '💥', name: 'Black Powder', desc: 'Cannon blast radius +12% per tier.', tierCosts: [1, 2] },
  { id: 'drill', icon: '🛡️', name: 'Drill Sergeants', desc: 'Barracks soldiers and reinforcements gain +15% health per tier.', tierCosts: [1, 2] },
  { id: 'coffers', icon: '🪙', name: 'Royal Coffers', desc: 'Begin every battle with +40 gold.', tierCosts: [1] },
  { id: 'comet', icon: '☄️', name: 'Comet Calling', desc: 'Meteor Storm recharges 20% faster and calls one extra meteor.', tierCosts: [2] },
  { id: 'prospector', icon: '💎', name: 'Prospector', desc: 'Begin every battle with +3 shards per tier.', tierCosts: [1, 2] },
  { id: 'runesmith', icon: '🧿', name: 'Runesmith', desc: 'Road traps re-arm 20% faster per tier.', tierCosts: [1, 2] },
]

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
