import type { TowerKind, TowerLevelDef } from './types.ts'
import { resolveCapstone } from './towerDefs.ts'

/** The starter roster is deliberately bounded. Prices are additional run gold. */
export const MYTHIC_ACCOUNT_LEVEL = 30
export const SOLAR_CHARGES = 84
export const SOLAR_WARNING = 1.4
export const SOLAR_RADIUS = 1.8
export const RIFT_COOLDOWN = 14
export const RIFT_DURATION = 4
export const RIFT_RADIUS = 2.2
export const LEGION_COOLDOWN = 24
export const LEGION_DURATION = 7
export const LEGION_RADIUS = 1.6

const transformations: Partial<Record<TowerKind, Partial<Record<0 | 1, Partial<TowerLevelDef>>>>> = {
  seraph: {
    0: {
      name: 'Helios Engine', cost: 15000, model: 'seraph6a', signature: 'solarStrike',
      description: 'Seven separate solar beams charge a strike: every 84 beam targets mark the strongest foe for 1.4s, then deal 2,400 true damage within 1.8 tiles. Moving enemies can escape the marked ground.',
    },
    1: {
      name: 'Event Horizon', cost: 16000, model: 'seraph6b', signature: 'eventHorizon',
      description: 'Seven separate void beams. Every 14s opens a 2.2-tile rift beneath the strongest foe for 4s: enemies inside are revealed and take 30% more damage from the whole defense.',
    },
  },
  barracks: {
    0: {
      name: 'Last Legion', cost: 14000, model: 'barracks6a', signature: 'legionStandard', range: 4.5,
      description: 'Plant the Legion Standard at the rally point every 24s: recall and fully restore the elite squad, then heal nearby allies for 12% max health per second for 7s. Reposition the rally before planting.',
    },
  },
}

/** Unsupported branches end at five; existing capstone balance stays intact. */
export function mythicFor(kind: TowerKind, branch: 0 | 1): TowerLevelDef | null {
  const change = transformations[kind]?.[branch]
  if (!change) return null
  return { ...resolveCapstone(kind, branch), ...change }
}
