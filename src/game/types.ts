import type { TowerModelId } from '../voxel/models_towers.ts'

export type DamageType = 'physical' | 'magic' | 'true'

export interface EnemyDef {
  id: string
  name: string
  hp: number
  speed: number            // world units / sec
  armor: number            // 0..0.8 physical reduction
  magicResist: number      // 0..0.8 magic reduction
  bounty: number
  livesCost: number
  flying?: boolean
  regen?: number           // hp/sec
  healAura?: { radius: number, hps: number }  // heals OTHER enemies
  spawnOnDeath?: { id: string, count: number }
  shardDrop?: number       // 💎 dropped on death
  phasing?: { interval: number, duration: number }  // periodically untargetable
  summons?: { id: string, count: number, interval: number }  // spawns minions while alive
  /** leaps onto a nearby attacking tower and silences it until killed (or it gives up) */
  hexer?: { range: number, duration: number }
  /** shields enemies ahead of it (closer to the gate) within radius */
  wardAura?: { radius: number, reduction: number }
  // melee vs blockers
  attackDamage: [number, number]
  attackInterval: number
  ranged?: boolean         // attacks blockers from afar without stopping walk? (warlock stops at range)
  boss?: boolean
  model: string            // model factory key
  /** emissive tint distinguishing a variant that reuses another model */
  tint?: number
  scale?: number
  yOffset?: number         // flying height
  description: string
}

export type TowerKind = 'arrow' | 'mage' | 'cannon' | 'barracks'

/** the signature mechanic a tier-5 tower brings; one per capstone */
export type CapstoneSignature =
  | 'crownVolley'      // every fifth attack sprays the lane
  | 'passThrough'      // a critical punches through to the enemy behind
  | 'convergenceRune'  // every fifth cast anchors a pulsing rune
  | 'unmaking'         // strips magic resistance as well as armor
  | 'seismicCharge'    // buries a mine in every crater
  | 'twinShells'       // fires two shells per attack
  | 'lastMuster'       // retainers rush from the gate when a soldier falls
  | 'skyAxes'          // the camp itself hurls axes at flyers

export interface TowerLevelDef {
  name: string
  cost: number
  model: TowerModelId
  range: number
  /** tier-5 only: what makes this capstone itself */
  signature?: CapstoneSignature
  /** only engages flying enemies (its soldiers hold the ground) */
  airOnly?: boolean
  // attackers
  damage?: [number, number]
  damageType?: DamageType
  attackInterval?: number
  splash?: number            // explosion radius
  flying?: boolean           // can target flying
  special?: TowerSpecial
  // barracks
  soldier?: SoldierDef
  soldierCount?: number
  respawnTime?: number
  description: string
}

export type TowerSpecial =
  | { kind: 'crit', chance: number, mult: number }
  | { kind: 'poison', chance: number, dps: number, duration: number }
  | { kind: 'chain', targets: number, falloff: number, stunChance: number, stunDur: number }
  | { kind: 'armorShred', amount: number }
  | { kind: 'burnGround', dps: number, duration: number, radius: number }
  | { kind: 'cluster', count: number, damage: [number, number], radius: number }

export interface SoldierDef {
  name: string
  hp: number
  damage: [number, number]
  attackInterval: number
  armor: number
  regen?: number
  healPulse?: { amount: number, interval: number, radius: number }  // paladins
  lifesteal?: number
  /** never engage bosses (Last Muster retainers must not chain-stall them) */
  shunBosses?: boolean
  model: string
  scale?: number
}

export interface TowerTree {
  kind: TowerKind
  levels: [TowerLevelDef, TowerLevelDef, TowerLevelDef]  // 1..3
  branches: [TowerLevelDef, TowerLevelDef]               // 4a, 4b
  /**
   * One capstone per tier-4 branch, not one shared crown with a swapped
   * model. The branch you picked at tier 4 decides which tier-5 tower you
   * are building toward, so the two halves of a tree end somewhere genuinely
   * different rather than converging.
   */
  capstones: [TowerLevelDef, TowerLevelDef]              // 5a, 5b
}

export interface WaveGroup {
  enemy: string
  count: number
  interval: number      // seconds between spawns
  delay: number         // seconds after wave start
  lane?: number         // which spawn lane (default 0)
}

export interface WaveDef {
  groups: WaveGroup[]
  breakAfter?: number   // seconds until next wave auto-starts (default 20)
  /** Veiltide surge: enemies spawned by this wave are empowered, the sky darkens */
  surge?: boolean
}

export type ThemeId = 'forest' | 'winter' | 'ember' | 'swamp' | 'void'

/** map signature mechanics — opportunity windows, never chores */
export type HazardId = 'deepchill' | 'eruption' | 'witchlights' | 'riftlight'

// ---------------- road traps ----------------

export type TrapKind = 'spike' | 'frost' | 'blast'

export interface TrapDef {
  kind: TrapKind
  name: string
  icon: string
  cost: number
  description: string
  // spike/blast: triggered burst
  damage?: [number, number]
  radius?: number
  cooldown?: number
  stun?: number
  // frost: passive slow zone
  slowFactor?: number
  slowRadius?: number
}

export const TRAP_DEFS: Record<TrapKind, TrapDef> = {
  spike: {
    kind: 'spike', name: 'Spike Snare', icon: 'spike', cost: 50,
    damage: [24, 40], radius: 0.55, cooldown: 6, stun: 0.7,
    description: 'Springs on the first foe to cross it: heavy physical damage and a brief pin. Rearms every 6s.',
  },
  frost: {
    kind: 'frost', name: 'Frost Rune', icon: 'frost', cost: 70,
    slowFactor: 0.55, slowRadius: 0.85,
    description: 'A permanent rune of biting cold. Ground enemies crossing it are slowed to 55% speed.',
  },
  blast: {
    kind: 'blast', name: 'Blast Charge', icon: 'blast', cost: 90,
    damage: [110, 170], radius: 1.15, cooldown: 24, stun: 0.5,
    description: 'A buried powder charge that detonates under groups. Devastating, but slow to re-arm (24s).',
  },
}

// ---------------- ascension perks (tier-5, bought with shards) ----------------

export interface PerkDef {
  id: string
  name: string
  icon: string
  description: string
}

export const PERKS: Record<TowerKind, [PerkDef, PerkDef]> = {
  arrow: [
    { id: 'hawkeye', name: 'Hawkeye', icon: 'eye', description: '+0.8 range.' },
    { id: 'serrated', name: 'Serrated Arrows', icon: 'blood', description: '+20% damage.' },
  ],
  mage: [
    { id: 'echo', name: 'Echo Casting', icon: 'echo', description: '18% chance to cast twice.' },
    { id: 'deepveil', name: 'Veilpiercer', icon: 'veil', description: 'Ignores half of magic resistance.' },
  ],
  cannon: [
    { id: 'tremor', name: 'Tremor Shells', icon: 'quake', description: 'Blasts have a 30% chance to stun for 0.5s.' },
    { id: 'napalm', name: 'Napalm Payload', icon: 'flame', description: '+30% blast radius.' },
  ],
  barracks: [
    { id: 'vanguard', name: 'Vanguard Oath', icon: 'shield', description: 'Soldiers gain +25% health.' },
    { id: 'whetstone', name: 'Whetstone Ritual', icon: 'sword', description: 'Soldiers deal +25% damage.' },
  ],
}

export const ASCEND_SHARD_COST = 6
export const ASCEND_GOLD_COST = 150
export const OVERCHARGE_SHARD_COST = 3
export const OVERCHARGE_DURATION = 12
export const OVERCHARGE_COOLDOWN = 30
export const OVERCHARGE_RATE_BONUS = 0.6

// ---------------- heroes ----------------

export type HeroId = 'aldric' | 'liora' | 'zephyra'

export interface HeroDef {
  id: HeroId
  name: string
  title: string
  icon: string
  blurb: string
  hp: number
  damage: [number, number]
  attackInterval: number
  armor: number
  regen: number
  moveSpeed: number
  model: string
  scale: number
  attackRange?: number        // ranged hero
  projectile?: 'arrow' | 'bolt'
  ability: { kind: 'slam' | 'volley' | 'nova', name: string, cooldown: number, blurb: string }
}

export type Difficulty = 'casual' | 'normal' | 'veteran'

export interface DifficultyMods {
  name: string
  blurb: string
  enemyHp: number
  bounty: number
  lives: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyMods> = {
  casual: { name: 'Casual', blurb: 'Softer foes, richer bounties. Enjoy the scenery.', enemyHp: 0.85, bounty: 1.15, lives: 25 },
  normal: { name: 'Normal', blurb: 'The intended defense of Blockhold.', enemyHp: 1, bounty: 1, lives: 20 },
  veteran: { name: 'Veteran', blurb: 'Hardened foes, lean bounties, fewer lives. Good luck.', enemyHp: 1.3, bounty: 0.9, lives: 15 },
}

/** inclusive cell rect: [c0, r0, c1, r1] */
export type Rect = [number, number, number, number]

export interface LevelDef {
  id: string
  name: string
  subtitle: string
  theme: ThemeId
  seed: number
  width: number
  height: number
  plots: [number, number][]
  /** road cells where traps can be built (must lie on a rasterized lane) */
  trapSpots?: [number, number][]
  water: Rect[]
  hills: Rect[]
  voids: Rect[]
  /** the map's signature mechanic (see src/game/hazards.ts) */
  hazard?: HazardId
  lanes: [number, number][][]  // waypoint polylines in grid coords (col,row)
  waves: WaveDef[]
  startGold: number
  startLives: number
  startShards?: number
  intro?: string
}
