import { TowerTree, TowerKind, TowerLevelDef, SoldierDef } from './types.ts'

export const towerTrees: Record<TowerKind, TowerTree> = {
  arrow: {
    kind: 'arrow',
    levels: [
      {
        name: 'Arrow Tower', cost: 70, model: 'arrow1', range: 3.1,
        damage: [4, 8], damageType: 'physical', attackInterval: 0.8, flying: true,
        description: 'Quick physical shots. Cheap, reliable, hits flyers.',
      },
      {
        name: 'Marksman Tower', cost: 110, model: 'arrow2', range: 3.5,
        damage: [9, 15], damageType: 'physical', attackInterval: 0.75, flying: true,
        description: 'Better bows, better eyes.',
      },
      {
        name: 'Ranger Roost', cost: 160, model: 'arrow3', range: 3.9,
        damage: [15, 25], damageType: 'physical', attackInterval: 0.7, flying: true,
        description: 'Veteran rangers with longbows.',
      },
    ],
    branches: [
      {
        name: 'Sharpshooter Spire', cost: 230, model: 'arrow4a', range: 5.4,
        damage: [42, 68], damageType: 'physical', attackInterval: 1.15, flying: true,
        special: { kind: 'crit', chance: 0.2, mult: 2.5 },
        description: 'Slow, surgical, enormous range. 20% chance to critically strike for 2.5x.',
      },
      {
        name: 'Gale Bowyer', cost: 230, model: 'arrow4b', range: 3.7,
        damage: [11, 17], damageType: 'physical', attackInterval: 0.3, flying: true,
        special: { kind: 'poison', chance: 0.3, dps: 12, duration: 3 },
        description: 'A hail of envenomed arrows. 30% chance to poison (12/s for 3s, ignores armor).',
      },
    ],
    capstone: {
      name: 'Crownwing Aerie', cost: 760, models: ['arrow5a', 'arrow5b'], range: 5.4,
      damage: [32, 50], damageType: 'physical', attackInterval: 0.68, flying: true,
      specials: [
        { kind: 'crit', chance: 0.2, mult: 2.5 },
        { kind: 'poison', chance: 0.3, dps: 12, duration: 3 },
      ],
      description: 'The royal aerie. Every fifth attack unleashes a Crown Volley: arrows for up to 5 more foes at 75% damage, each keeping its crit or venom.',
    },
  },
  mage: {
    kind: 'mage',
    levels: [
      {
        name: 'Apprentice Spire', cost: 100, model: 'mage1', range: 3.0,
        damage: [13, 21], damageType: 'magic', attackInterval: 1.5, flying: true,
        description: 'Arcane bolts that ignore armor.',
      },
      {
        name: 'Adept Spire', cost: 160, model: 'mage2', range: 3.3,
        damage: [28, 44], damageType: 'magic', attackInterval: 1.5, flying: true,
        description: 'The adepts hit harder.',
      },
      {
        name: 'Archmage Spire', cost: 240, model: 'mage3', range: 3.6,
        damage: [52, 82], damageType: 'magic', attackInterval: 1.5, flying: true,
        description: 'Raw arcane devastation.',
      },
    ],
    branches: [
      {
        name: 'Arcane Obelisk', cost: 330, model: 'mage4a', range: 3.8,
        damage: [95, 155], damageType: 'magic', attackInterval: 1.9, flying: true,
        special: { kind: 'armorShred', amount: 0.08 },
        description: 'Each hit melts 8% armor permanently. Devastating single-target damage.',
      },
      {
        name: 'Storm Spire', cost: 330, model: 'mage4b', range: 3.6,
        damage: [42, 68], damageType: 'magic', attackInterval: 1.6, flying: true,
        special: { kind: 'chain', targets: 4, falloff: 0.75, stunChance: 0.15, stunDur: 0.8 },
        description: 'Lightning arcs to 4 enemies, 15% chance to stun each.',
      },
    ],
    capstone: {
      name: 'Convergence Monolith', cost: 880, models: ['mage5a', 'mage5b'], range: 4.1,
      damage: [105, 165], damageType: 'magic', attackInterval: 1.7, flying: true,
      specials: [
        { kind: 'armorShred', amount: 0.06 },
        { kind: 'chain', targets: 4, falloff: 0.75, stunChance: 0.12, stunDur: 0.7 },
      ],
      description: 'Every fifth cast anchors a Convergence Rune under its target: 4 lightning pulses over 3s, each arcing between nearby foes.',
    },
  },
  cannon: {
    kind: 'cannon',
    levels: [
      {
        name: 'Bombard', cost: 90, model: 'cannon1', range: 2.9,
        damage: [9, 17], damageType: 'physical', attackInterval: 2.3, splash: 0.75,
        description: 'Splash damage in a small area. Cannot hit flyers.',
      },
      {
        name: 'Heavy Bombard', cost: 150, model: 'cannon2', range: 3.1,
        damage: [19, 34], damageType: 'physical', attackInterval: 2.3, splash: 0.85,
        description: 'Bigger barrel, bigger boom.',
      },
      {
        name: 'Siege Cannon', cost: 220, model: 'cannon3', range: 3.3,
        damage: [34, 58], damageType: 'physical', attackInterval: 2.2, splash: 0.95,
        description: 'Fortress-grade artillery.',
      },
    ],
    branches: [
      {
        name: 'Dragonfire Mortar', cost: 320, model: 'cannon4a', range: 4.6,
        damage: [62, 110], damageType: 'physical', attackInterval: 2.9, splash: 1.35,
        special: { kind: 'burnGround', dps: 16, duration: 3, radius: 0.9 },
        description: 'Huge range and blast; leaves burning ground (16/s, ignores armor).',
      },
      {
        name: 'Cluster Bombard', cost: 320, model: 'cannon4b', range: 3.4,
        damage: [32, 52], damageType: 'physical', attackInterval: 2.0, splash: 0.85,
        special: { kind: 'cluster', count: 4, damage: [12, 20], radius: 0.6 },
        description: 'The shell bursts into 4 bomblets that scatter over the lane.',
      },
    ],
    capstone: {
      name: 'Faultline Arsenal', cost: 840, models: ['cannon5a', 'cannon5b'], range: 4.6,
      damage: [68, 108], damageType: 'physical', attackInterval: 2.55, splash: 1.35,
      specials: [
        { kind: 'burnGround', dps: 16, duration: 3, radius: 0.9 },
        { kind: 'cluster', count: 4, damage: [12, 20], radius: 0.6 },
      ],
      description: 'Every shell buries a Seismic Charge in the crater (max 3) that arms in 1s and detonates under the next foe to cross it.',
    },
  },
  barracks: {
    kind: 'barracks',
    levels: [
      {
        name: 'Militia Barracks', cost: 80, model: 'barracks1', range: 2.2,
        soldierCount: 3, respawnTime: 9,
        soldier: { name: 'Militia', hp: 55, damage: [2, 5], attackInterval: 1.1, armor: 0, model: 'militia' },
        description: 'Three militia hold the road and buy your towers time.',
      },
      {
        name: 'Footman Barracks', cost: 130, model: 'barracks2', range: 2.2,
        soldierCount: 3, respawnTime: 9,
        soldier: { name: 'Footman', hp: 110, damage: [4, 8], attackInterval: 1.0, armor: 0.2, model: 'footman' },
        description: 'Trained footmen with mail and shields.',
      },
      {
        name: 'Knight Barracks', cost: 200, model: 'barracks3', range: 2.2,
        soldierCount: 3, respawnTime: 10,
        soldier: { name: 'Knight', hp: 190, damage: [8, 14], attackInterval: 1.0, armor: 0.35, model: 'knight' },
        description: 'Knights of Blockhold. They do not break.',
      },
    ],
    branches: [
      {
        name: 'Paladin Sanctum', cost: 300, model: 'barracks4a', range: 2.4,
        soldierCount: 3, respawnTime: 11,
        soldier: {
          name: 'Paladin', hp: 300, damage: [12, 20], attackInterval: 1.0, armor: 0.5, regen: 4,
          healPulse: { amount: 30, interval: 5, radius: 1.2 }, model: 'paladin',
        },
        description: 'Holy bulwarks that regenerate and pulse healing to allies.',
      },
      {
        name: 'Berserker Hall', cost: 300, model: 'barracks4b', range: 2.6,
        soldierCount: 3, respawnTime: 8,
        soldier: {
          name: 'Berserker', hp: 210, damage: [17, 28], attackInterval: 0.65, armor: 0, lifesteal: 0.3, model: 'berserker',
        },
        description: 'Frenzied axes, frightening damage, and blood-fueled healing.',
      },
    ],
    capstone: {
      name: 'Oathgate Citadel', cost: 800, models: ['barracks5a', 'barracks5b'], range: 2.8,
      soldierCount: 4, respawnTime: 10, respawnTimes: [10, 8],
      soldiers: [
        {
          name: 'Oath Paladin', hp: 420, damage: [17, 27], attackInterval: 0.9, armor: 0.5, regen: 4,
          healPulse: { amount: 30, interval: 5, radius: 1.2 }, model: 'paladin',
        },
        {
          name: 'Oath Berserker', hp: 300, damage: [22, 35], attackInterval: 0.65, armor: 0, lifesteal: 0.3, model: 'berserker',
        },
      ],
      description: 'A fourth veteran joins the watch, sworn and hardened. When one falls, the Last Muster answers: two Retainers rush from the gate to hold the line.',
    },
  },
}

/** the tier-5 def a tower of (kind, branch) actually gets — branch identity kept */
export function resolveCapstone(kind: TowerKind, branch: 0 | 1): TowerLevelDef {
  const tree = towerTrees[kind]
  const { models, specials, soldiers, respawnTimes, ...rest } = tree.capstone
  const def: TowerLevelDef = { ...rest, model: models[branch], special: specials?.[branch] }
  if (soldiers) def.soldier = soldiers[branch]
  if (respawnTimes) def.respawnTime = respawnTimes[branch]
  return def
}

/** Total invested gold for a tower at (level, branch) — used for sell refund. */
export function investedGold(kind: TowerKind, level: number, branch: 0 | 1 | null): number {
  const tree = towerTrees[kind]
  let sum = 0
  for (let i = 0; i < Math.min(level, 3); i++) sum += tree.levels[i].cost
  if (level >= 4 && branch !== null) sum += tree.branches[branch].cost
  if (level >= 5) sum += tree.capstone.cost
  return sum
}

export const SELL_REFUND = 0.7

// ---------------- Last Muster (barracks capstone) ----------------

export const RETAINER: SoldierDef = {
  name: 'Retainer', hp: 150, damage: [8, 13], attackInterval: 0.9, armor: 0.2,
  shunBosses: true, model: 'reinforcement',
}
export const MUSTER_COOLDOWN = 14
export const MUSTER_LIFETIME = 8
