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
    capstones: [
      {
        name: 'Kingsreach', cost: 760, model: 'arrow5a', range: 7.2,
        damage: [78, 128], damageType: 'physical', attackInterval: 1.3, flying: true,
        special: { kind: 'crit', chance: 0.28, mult: 3 },
        signature: 'passThrough',
        description: 'Half the map is in range. 28% to crit for 3x, and a critical arrow punches clean through to strike the foe behind it for full damage.',
      },
      {
        name: 'Crownwing Aerie', cost: 760, model: 'arrow5b', range: 4.3,
        damage: [26, 42], damageType: 'physical', attackInterval: 0.3, flying: true,
        special: { kind: 'poison', chance: 0.35, dps: 16, duration: 3 },
        signature: 'crownVolley',
        description: 'The royal aerie. Every fifth attack unleashes a Crown Volley: arrows for up to 5 more foes at 75% damage, each carrying the venom.',
      },
    ],
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
    capstones: [
      {
        name: 'The Unmaking', cost: 880, model: 'mage5a', range: 4.0,
        damage: [140, 225], damageType: 'magic', attackInterval: 1.9, flying: true,
        special: { kind: 'armorShred', amount: 0.1 },
        signature: 'unmaking',
        description: 'It undoes what protects a thing. Every hit strips 10% armor and 10% magic resistance permanently, and strikes anything already stripped bare for 30% more.',
      },
      {
        name: 'Convergence Monolith', cost: 880, model: 'mage5b', range: 4.1,
        damage: [95, 150], damageType: 'magic', attackInterval: 1.6, flying: true,
        special: { kind: 'chain', targets: 5, falloff: 0.78, stunChance: 0.15, stunDur: 0.8 },
        signature: 'convergenceRune',
        description: 'Lightning arcs to five. Every fifth cast anchors a Convergence Rune under its target: 4 pulses over 3s, each arcing between nearby foes.',
      },
    ],
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
    capstones: [
      {
        name: 'Emberthrone', cost: 840, model: 'cannon5a', range: 5.4,
        damage: [72, 120], damageType: 'physical', attackInterval: 2.9, splash: 1.6,
        special: { kind: 'burnGround', dps: 24, duration: 4, radius: 1.15 },
        signature: 'twinShells',
        description: 'The throne fires twice. Two shells arc out together and land apart, each leaving a wide burning scar (24/s, ignores armor).',
      },
      {
        name: 'Faultline Arsenal', cost: 840, model: 'cannon5b', range: 4.0,
        damage: [58, 94], damageType: 'physical', attackInterval: 2.2, splash: 0.95,
        special: { kind: 'cluster', count: 5, damage: [14, 24], radius: 0.7 },
        signature: 'seismicCharge',
        description: 'Five bomblets scatter across the lane, and every shell buries a Seismic Charge in the crater (max 3) that arms in 1s and detonates under the next foe to cross it.',
      },
    ],
  },
  barracks: {
    kind: 'barracks',
    levels: [
      {
        name: 'Militia Barracks', cost: 80, model: 'barracks1', range: 2.2,
        soldierCount: 3, respawnTime: 9,
        soldier: { name: 'Militia', hp: 55, damage: [2, 5], attackInterval: 1.1, armor: 0, model: 'militia', scale: 0.92 },
        description: 'Three militia hold the road and buy your towers time.',
      },
      {
        name: 'Footman Barracks', cost: 130, model: 'barracks2', range: 2.45,
        soldierCount: 3, respawnTime: 9,
        soldier: { name: 'Footman', hp: 110, damage: [4, 8], attackInterval: 1.0, armor: 0.2, model: 'footman', scale: 1.02 },
        description: 'Trained footmen with mail and shields.',
      },
      {
        name: 'Knight Barracks', cost: 200, model: 'barracks3', range: 2.7,
        soldierCount: 3, respawnTime: 10,
        soldier: { name: 'Knight', hp: 190, damage: [8, 14], attackInterval: 1.0, armor: 0.35, model: 'knight', scale: 1.12 },
        description: 'Knights of Blockhold. They do not break.',
      },
    ],
    branches: [
      {
        name: 'Paladin Sanctum', cost: 300, model: 'barracks4a', range: 3.0,
        soldierCount: 3, respawnTime: 11,
        soldier: {
          name: 'Paladin', hp: 300, damage: [12, 20], attackInterval: 1.0, armor: 0.5, regen: 4,
          healPulse: { amount: 30, interval: 5, radius: 1.2 }, model: 'paladin', scale: 1.22,
        },
        description: 'Holy bulwarks that regenerate and pulse healing to allies.',
      },
      {
        name: 'Berserker Hall', cost: 300, model: 'barracks4b', range: 3.15,
        soldierCount: 3, respawnTime: 8,
        soldier: {
          name: 'Berserker', hp: 210, damage: [17, 28], attackInterval: 0.65, armor: 0, lifesteal: 0.3, model: 'berserker', scale: 1.18,
        },
        description: 'Frenzied axes, frightening damage, and blood-fueled healing.',
      },
    ],
    capstones: [
      {
        name: 'Oathgate Citadel', cost: 800, model: 'barracks5a', range: 3.5,
        soldierCount: 4, respawnTime: 10,
        soldier: {
          name: 'Oath Paladin', hp: 440, damage: [17, 27], attackInterval: 0.9, armor: 0.55, regen: 5,
          healPulse: { amount: 34, interval: 5, radius: 1.3 }, model: 'paladin', scale: 1.34,
        },
        signature: 'lastMuster',
        description: 'A fourth sworn paladin joins the watch. When one falls, the Last Muster answers: two Retainers rush from the gate to hold the line.',
      },
      {
        name: 'Stormhowl Warcamp', cost: 800, model: 'barracks5b', range: 3.4,
        soldierCount: 4, respawnTime: 8,
        soldier: {
          name: 'Stormhowl', hp: 310, damage: [24, 38], attackInterval: 0.6, armor: 0, lifesteal: 0.35, model: 'berserker', scale: 1.3,
        },
        // the only barracks that can touch a flyer: the camp itself throws
        damage: [46, 74], damageType: 'physical', attackInterval: 0.9, flying: true, airOnly: true,
        signature: 'skyAxes',
        description: 'Four howling berserkers hold the road while the camp itself hurls axes at anything airborne — the only barracks in Blockhold that can touch a flyer.',
      },
    ],
  },
}

/** the tier-5 tower a given tier-4 branch leads to */
export function resolveCapstone(kind: TowerKind, branch: 0 | 1): TowerLevelDef {
  return towerTrees[kind].capstones[branch]
}

/** Total invested gold for a tower at (level, branch) — used for sell refund. */
export function investedGold(kind: TowerKind, level: number, branch: 0 | 1 | null): number {
  const tree = towerTrees[kind]
  let sum = 0
  for (let i = 0; i < Math.min(level, 3); i++) sum += tree.levels[i].cost
  if (level >= 4 && branch !== null) sum += tree.branches[branch].cost
  if (level >= 5 && branch !== null) sum += tree.capstones[branch].cost
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
