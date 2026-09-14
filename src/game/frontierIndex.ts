import type { FrontierTier, ThemeId } from './types.ts'

/**
 * What the menus need to know about the Frontier without loading it.
 *
 * The boards themselves - their drawings, waves, scenery, themes and painted
 * skies - arrive in their own chunk the first time a player goes looking
 * (see `loadFrontier` in levels.ts). A returning player who only ever plays
 * the campaign never downloads them. The cards, the co-op picker, the Armory
 * and the objective line only need these few facts, and a test holds this
 * list to the boards it describes.
 */
export interface FrontierBoard {
  id: string
  name: string
  theme: ThemeId
  tier: FrontierTier
  feature: string
  waves: number
  roads: number
}

export const FRONTIER_TIERS: { tier: FrontierTier, name: string, blurb: string }[] = [
  { tier: 'easy', name: 'Gentle', blurb: 'Long roads, generous ground. Good for trying something new.' },
  { tier: 'medium', name: 'Testing', blurb: 'Split roads, air and armour. Plan before you build.' },
  { tier: 'hard', name: 'Brutal', blurb: 'Many gates and little ground. Bring the whole roster.' },
]

/** in the order the Frontier screen lists them: gentlest first */
export const FRONTIER_BOARDS: FrontierBoard[] = [
  { id: 'lanternbloom', name: 'Lanternbloom Terraces', theme: 'blossom', tier: 'easy', feature: 'The road spirals up three terraces', waves: 15, roads: 1 },
  { id: 'cloudstep', name: 'Cloudstep Isles', theme: 'skyreach', tier: 'easy', feature: 'Bridges climb and fall between floating islands', waves: 18, roads: 1 },
  { id: 'dunewake', name: 'Dunewake Oasis', theme: 'desert', tier: 'easy', feature: 'The road crests a dune and circles the oasis', waves: 16, roads: 1 },
  { id: 'serpentstair', name: 'The Serpent Stair', theme: 'jungle', tier: 'medium', feature: 'Both roads climb a four-tier temple to its summit', waves: 24, roads: 2 },
  { id: 'glimmerdeep', name: 'Glimmerdeep Hollow', theme: 'cavern', tier: 'medium', feature: 'Roads climb two shelves to a bridge over a chasm', waves: 22, roads: 2 },
  { id: 'starfall', name: 'Starfall Drift', theme: 'cosmos', tier: 'medium', feature: 'Light bridges ramp between asteroids at four heights', waves: 22, roads: 2 },
  { id: 'coralspire', name: 'Coralspire Atoll', theme: 'reef', tier: 'medium', feature: 'Two roads ring the atoll, then share one causeway', waves: 20, roads: 2 },
  { id: 'rimeveil', name: 'Rimeveil Glacier', theme: 'aurora', tier: 'hard', feature: 'Ice bridges span two crevasses under the aurora', waves: 26, roads: 3 },
  { id: 'stormcrown', name: 'Stormcrown Citadel', theme: 'storm', tier: 'hard', feature: 'Every road storms two walls to the citadel', waves: 28, roads: 3 },
  { id: 'duskwreath', name: 'Duskwreath Ring', theme: 'eclipse', tier: 'hard', feature: 'Four gates circle a chasm; two bridges reach the keep', waves: 30, roads: 4 },
]

export const frontierBoard = (id: string): FrontierBoard | undefined => FRONTIER_BOARDS.find(b => b.id === id)
export const isFrontierId = (id: string): boolean => FRONTIER_BOARDS.some(b => b.id === id)
export const tierName = (tier: FrontierTier): string => FRONTIER_TIERS.find(t => t.tier === tier)?.name ?? tier
