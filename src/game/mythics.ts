import type { TowerKind, TowerLevelDef } from './types.ts'
import { resolveCapstone } from './towerDefs.ts'

/** Every family has two mastery branches. Prices are additional run gold. */
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
  arrow: {
    0: { name: 'Worldpiercer', cost: 9000, model: 'arrow6a', range: 8.5, damage: [260, 400], attackInterval: 1,
      special: { kind: 'crit', chance: 0.4, mult: 3 },
      description: 'Long-range executioner. Heavy arrows have a 40% chance to deal triple damage and pierce a second foe. Strong against isolated elites.' },
    1: { name: 'Thousandwing', cost: 9000, model: 'arrow6b', damage: [65, 95], attackInterval: 0.18, range: 4.8,
      special: { kind: 'poison', chance: 0.6, dps: 45, duration: 4 },
      description: 'Rapid venom volleys. Every fifth shot fans out to five more foes; poison deals 45 true damage per second. Strong against swarms.' },
  },
  mage: {
    0: { name: 'Null Cathedral', cost: 11000, model: 'mage6a', damage: [440, 680], attackInterval: 1.4, range: 4.8,
      special: { kind: 'armorShred', amount: 0.15 },
      description: 'Heavy arcane bolts strip 15% armor and 10% resistance. Fully stripped enemies take 30% more damage. Built to dismantle bosses.' },
    1: { name: 'Tempest Nexus', cost: 11000, model: 'mage6b', damage: [170, 250], attackInterval: 1.25, range: 4.8,
      special: { kind: 'chain', targets: 8, falloff: 0.86, stunChance: 0.15, stunDur: 0.6 },
      description: 'Lightning jumps through eight foes with less damage lost per jump. Every fifth cast leaves a pulsing Convergence Rune.' },
  },
  cannon: {
    0: { name: 'Sunforge', cost: 10000, model: 'cannon6a', damage: [190, 290], attackInterval: 2.5, range: 6, splash: 1.9,
      special: { kind: 'burnGround', dps: 65, duration: 5, radius: 1.4 },
      description: 'Twin siege shells leave wide burning ground for five seconds, dealing 65 true damage per second. Hold enemies in the fire.' },
    1: { name: 'Worldshaker', cost: 10000, model: 'cannon6b', damage: [135, 205], attackInterval: 1.9, range: 4.6, splash: 1.15,
      special: { kind: 'cluster', count: 7, damage: [32, 48], radius: 0.85 },
      description: 'Seven bomblets cover the road. Every shell leaves an armed Seismic Charge, up to three at once. Best at crowded bends.' },
  },
  beacon: {
    0: { name: 'Dawnstar', cost: 12000, model: 'beacon6a', range: 6,
      aura: { damage: 0.4, range: 0.18, rate: 0.4, reveal: true },
      description: 'A defense-wide anchor: +40% damage and attack speed, +18% range, and reveal within its light. Overcharges nearby towers for five seconds every twenty seconds.' },
    1: { name: 'Crown Treasury', cost: 10000, model: 'beacon6b', range: 6,
      aura: { damage: 0.32, range: 0.12, rate: 0.12, bounty: 0.75 },
      description: 'Kills in its light pay 75% more gold and every twelfth yields a shard. Nearby towers gain +32% damage, +12% range and attack speed.' },
  },
  ballista: {
    0: { name: 'Firmament', cost: 12000, model: 'ballista6a', damage: [240, 360], attackInterval: 1.2, range: 8,
      special: { kind: 'airbane', mult: 2.6 },
      description: 'Sweeps long corridors with great bolts. Flyers take 2.6x damage and are stunned for 1.5 seconds. An answer to heavy air waves.' },
    1: { name: 'Siegebreaker', cost: 12000, model: 'ballista6b', damage: [380, 560], attackInterval: 1.6, range: 6.5,
      special: { kind: 'knockback', dist: 1.1, armorPierce: 0.7 },
      description: 'Ignores 70% of armor and drives whole ranks backward. Every fourth shot is a double-damage Great Bolt. Aim down the road.' },
  },
  seraph: {
    0: {
      name: 'Helios Engine', cost: 15000, model: 'seraph6a', signature: 'solarStrike',
      description: 'Eight separate solar beams charge a strike: every 84 beam targets mark the strongest foe for 1.4s, then deal 2,400 true damage within 1.8 tiles. Moving enemies can escape the marked ground.',
    },
    1: {
      name: 'Event Horizon', cost: 16000, model: 'seraph6b', signature: 'eventHorizon',
      description: 'Four heavy void beams. Every 14s opens a 2.2-tile rift beneath the strongest foe for 4s: enemies inside are revealed and take 30% more damage from the whole defense.',
    },
  },
  barracks: {
    1: { name: 'Ragnarok Hall', cost: 12000, model: 'barracks6b', range: 4, soldierCount: 6, respawnTime: 7,
      soldier: { name: 'Ragnarok Guard', hp: 650, damage: [65, 95], attackInterval: 0.5, armor: 0.12, lifesteal: 0.35, model: 'berserker', scale: 1.35 },
      damage: [110, 170], attackInterval: 0.7,
      description: 'Six lifestealing guards hold the road while the hall throws heavy axes at flyers. An aggressive alternative to the Last Legion.' },
    0: {
      name: 'Last Legion', cost: 14000, model: 'barracks6a', signature: 'legionStandard', range: 4.5,
      description: 'Plant the Legion Standard at the rally point every 24s: recall and fully restore the elite squad, then heal nearby allies for 12% max health per second for 7s. Reposition the rally before planting.',
    },
  },
}

/** Mastery preserves each branch’s role and signature unless explicitly replaced. */
export function mythicFor(kind: TowerKind, branch: 0 | 1): TowerLevelDef | null {
  const change = transformations[kind]?.[branch]
  if (!change) return null
  return { ...resolveCapstone(kind, branch), ...change }
}
