import * as THREE from 'three'
import type { DeathFlavor } from './debris.ts'
import type { LanePath } from './path.ts'
import type { Particles } from './particles.ts'
import type { Enemy, Soldier } from './units.ts'
import type { Tower } from './towers.ts'
import type { SfxName } from '../core/audio.ts'

/** anything that can be credited with kills (towers, traps, heroes) */
export interface KillCredit { kills: number }

/** Faultline Arsenal: a shell buries an armed charge at its impact point */
export interface MineSpec {
  damage: [number, number]
  radius: number
  trigger: number
  armTime: number
  life: number
  maxActive: number
  stunChance: number
  owner: KillCredit
}

/** What entities can see/do. Implemented by Game. */
export interface World {
  dynamic: THREE.Group           // container for entity meshes
  lanes: LanePath[]
  particles: Particles
  enemies: Enemy[]
  soldiers: Soldier[]
  towers: Tower[]
  cameraQuat: THREE.Quaternion
  time: number

  sfx(name: SfxName, volume?: number): void
  addGold(amount: number, x?: number, y?: number, z?: number): void
  /** armory (meta upgrade) multipliers */
  towerDamageMult(kind: string): number
  splashMult(): number
  soldierHpMult(): number
  trapCooldownMult(): number
  shards: number
  /** A* route between two world points, or null if unreachable */
  findPath(fromX: number, fromZ: number, toX: number, toZ: number): THREE.Vector3[] | null
  floater(x: number, y: number, z: number, text: string, cls: string): void
  onEnemyKilled(e: Enemy): void
  onEnemyLeaked(e: Enemy): void
  spawnEnemyAt(id: string, laneIndex: number, dist: number, opts?: { surged?: boolean, eliteRoll?: boolean, hpScale?: number, waveTag?: number, noReward?: boolean }): void
  fireProjectile(p: ProjectileSpec): void
  /** Second Wind: multiplier on hero respawn time (0.5 when bought) */
  readonly heroReviveMult: number
  /** fraction of invested gold returned on a sell (Full Salvage raises it to 1) */
  readonly sellRefund: number
  /** the Bellfoundry is keeping time this battle */
  readonly isBellfoundry: boolean
  /** height of the ground under a world point, so units stand on raised shelves */
  groundY(x: number, z: number): number
  /** is a ridge standing between a tower and what it is shooting at? */
  sightBlocked(fromX: number, fromZ: number, fromY: number, toX: number, toZ: number): boolean
  /** is this point inside a player-dug cutting? */
  cuttingAt(x: number, z: number): boolean
  shake(strength: number): void
  /** hold the frame on a hit worth feeling */
  impact(weight: 'light' | 'heavy' | 'elite' | 'boss'): void
  /** break a dead unit's model into its authored blocks */
  shatterUnit(group: THREE.Group, opts: { force?: number, flavor?: DeathFlavor, scale?: number }): void
}

export type ProjectileSpec =
  | { kind: 'arrow', from: THREE.Vector3, target: Enemy, damage: number, crit: boolean, poison?: { dps: number, duration: number }, armorPierce?: number, credit?: KillCredit, world: World }
  | { kind: 'bolt', from: THREE.Vector3, target: Enemy, damage: number, color: number, armorShred?: number, resistShred?: number, mrPierce?: number, credit?: KillCredit, world: World }
  | { kind: 'bomb', from: THREE.Vector3, at: THREE.Vector3, damage: number, splash: number, cluster?: { count: number, damage: [number, number], radius: number }, burn?: { dps: number, duration: number, radius: number }, mine?: MineSpec, stunChance?: number, slow?: boolean, submunition?: boolean, credit?: KillCredit, world: World }
  | { kind: 'chain', from: THREE.Vector3, first: Enemy, damage: number, targets: number, falloff: number, stunChance: number, stunDur: number, mrPierce?: number, credit?: KillCredit, world: World }
  | { kind: 'warlockBolt', from: THREE.Vector3, target: Soldier, damage: number, world: World }
  | { kind: 'meteor', at: THREE.Vector3, damage: number, world: World }
  /**
   * A ballista bolt: flies a straight line from `from` through `aim` out to
   * `reach`, and strikes everything it passes. `falloff` scales each hit after
   * the first; `pierceAll` is the Great Bolt, which loses nothing.
   */
  | { kind: 'spear', from: THREE.Vector3, aim: THREE.Vector3, reach: number, damage: number, falloff: number, pierceAll?: boolean, hitsAir: boolean, airMult?: number, armorPierce?: number, knockback?: number, skyfall?: boolean, credit?: KillCredit, world: World }
