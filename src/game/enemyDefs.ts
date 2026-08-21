import { EnemyDef } from './types.ts'

const defs: EnemyDef[] = [
  {
    id: 'husk', name: 'Husk', hp: 62, speed: 0.62, armor: 0, magicResist: 0,
    bounty: 5, livesCost: 1, attackDamage: [3, 6], attackInterval: 1.2,
    model: 'husk', description: 'A shambling thrall. Slow, dim, and endlessly replaceable.',
  },
  {
    id: 'sprinter', name: 'Ashhound', hp: 42, speed: 1.25, armor: 0, magicResist: 0.1,
    bounty: 6, livesCost: 1, attackDamage: [4, 7], attackInterval: 0.9,
    model: 'sprinter', description: 'A lean hound of the wastes. Fast — bring stopping power.',
  },
  {
    id: 'shield', name: 'Ironclad', hp: 105, speed: 0.5, armor: 0.5, magicResist: 0,
    bounty: 11, livesCost: 1, attackDamage: [6, 10], attackInterval: 1.3,
    model: 'shield', description: 'Heavy plate shrugs off arrows and shrapnel. Magic cuts through.',
  },
  {
    id: 'acolyte', name: 'Veil Acolyte', hp: 78, speed: 0.68, armor: 0, magicResist: 0.65,
    bounty: 12, livesCost: 1, attackDamage: [5, 9], attackInterval: 1.2,
    healAura: { radius: 1.4, hps: 6 },
    model: 'acolyte', description: 'Wards off sorcery and mends nearby horrors. Silence it with steel.',
  },
  {
    id: 'gargoyle', name: 'Gargoyle', hp: 58, speed: 0.95, armor: 0.15, magicResist: 0.15,
    bounty: 9, livesCost: 1, flying: true, yOffset: 0.85, attackDamage: [0, 0], attackInterval: 1,
    model: 'gargoyle', description: 'Stone wings pass over your soldiers entirely. Only arrows and magic reach it.',
  },
  {
    id: 'brute', name: 'Gnarl Brute', hp: 430, speed: 0.4, armor: 0.2, magicResist: 0.2,
    bounty: 42, livesCost: 2, attackDamage: [14, 24], attackInterval: 1.6, regen: 3,
    model: 'brute', scale: 1.35, description: 'A wall of muscle that regenerates. Focus fire before it reaches the gate.',
  },
  {
    id: 'spiderling', name: 'Spiderling', hp: 16, speed: 1.45, armor: 0, magicResist: 0,
    bounty: 2, livesCost: 1, attackDamage: [2, 4], attackInterval: 0.8,
    model: 'spiderling', description: 'Alone, a nuisance. In a wave, a tide.',
  },
  {
    id: 'broodmother', name: 'Broodmother', hp: 340, speed: 0.55, armor: 0.1, magicResist: 0.25,
    bounty: 35, livesCost: 2, attackDamage: [10, 16], attackInterval: 1.4,
    spawnOnDeath: { id: 'spiderling', count: 6 },
    model: 'broodmother', scale: 1.25, description: 'Kill it and the brood spills out. Have splash damage ready.',
  },
  {
    id: 'warlock', name: 'Pyre Warlock', hp: 130, speed: 0.6, armor: 0.1, magicResist: 0.7,
    bounty: 18, livesCost: 1, attackDamage: [12, 20], attackInterval: 1.8, ranged: true,
    model: 'warlock', description: 'Hurls fire at your soldiers from range. Nearly immune to magic.',
  },
  {
    id: 'juggernaut', name: 'The Juggernaut', hp: 3800, speed: 0.3, armor: 0.45, magicResist: 0.3,
    bounty: 250, livesCost: 20, boss: true, attackDamage: [40, 60], attackInterval: 2,
    model: 'juggernaut', scale: 1.6, description: 'The siege engine of the Veil made flesh. If it reaches the gate, Blockhold falls.',
  },
  {
    id: 'shardback', name: 'Shardback', hp: 170, speed: 0.5, armor: 0.45, magicResist: 0.2,
    bounty: 14, livesCost: 1, shardDrop: 2, attackDamage: [6, 10], attackInterval: 1.4,
    model: 'shardback', description: 'A plated burrower crusted with veilcrystal. Crack it open for shards.',
  },
  {
    id: 'mistwalker', name: 'Mistwalker', hp: 95, speed: 1.0, armor: 0, magicResist: 0.35,
    bounty: 13, livesCost: 1, phasing: { interval: 3.6, duration: 1.3 },
    attackDamage: [8, 13], attackInterval: 1.1,
    model: 'mistwalker', description: 'It slips between worlds — untouchable while it fades. Time your strikes.',
  },
  {
    id: 'riftwing', name: 'Riftwing', hp: 120, speed: 1.05, armor: 0.15, magicResist: 0.35,
    bounty: 17, livesCost: 2, flying: true, yOffset: 0.9,
    phasing: { interval: 4.2, duration: 0.8 },
    attackDamage: [0, 0], attackInterval: 1,
    model: 'gargoyle', tint: 0x4fd8ff, scale: 1.1,
    description: 'A glass-winged hunter that slips between worlds mid-flight. Lead it, or lose it.',
  },
  {
    id: 'riftherald', name: 'Rift Herald', hp: 440, speed: 0.46, armor: 0.15, magicResist: 0.55,
    bounty: 46, livesCost: 2, ranged: true,
    summons: { id: 'mistwalker', count: 2, interval: 16 },
    attackDamage: [12, 19], attackInterval: 1.7,
    model: 'warlock', tint: 0x8f5aff, scale: 1.2,
    description: 'A Veil cantor whose dirge calls Mistwalkers out of the fog. Silence it fast.',
  },
  {
    id: 'veilregent', name: 'The Veil Regent', hp: 5600, speed: 0.27, armor: 0.35, magicResist: 0.4,
    bounty: 450, livesCost: 20, boss: true,
    phasing: { interval: 7, duration: 1 },
    summons: { id: 'riftherald', count: 1, interval: 18 },
    attackDamage: [36, 52], attackInterval: 1.9,
    model: 'juggernaut', tint: 0x9f4fdf, scale: 1.75,
    description: 'The last will of the Veil: a phasing colossus that sings its own heralds into being.',
  },
  {
    id: 'veilqueen', name: 'The Veilqueen', hp: 2900, speed: 0.34, armor: 0.25, magicResist: 0.4,
    bounty: 300, livesCost: 20, boss: true, flying: true, yOffset: 0.95,
    summons: { id: 'gargoyle', count: 2, interval: 15 },
    attackDamage: [0, 0], attackInterval: 1,
    model: 'veilqueen', scale: 1.5, description: 'Matriarch of the Veil. She soars beyond your soldiers and cannons, birthing gargoyles as she comes.',
  },
]

export const enemyDefs = new Map(defs.map(d => [d.id, d]))
export function enemyDef(id: string): EnemyDef {
  const d = enemyDefs.get(id)
  if (!d) throw new Error(`unknown enemy: ${id}`)
  return d
}
