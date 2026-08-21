import * as THREE from 'three'
import type { LanePath } from './path.ts'
import type { Particles } from './particles.ts'
import type { Enemy, Soldier } from './units.ts'
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
  shake(strength: number): void
}

export type ProjectileSpec =
  | { kind: 'arrow', from: THREE.Vector3, target: Enemy, damage: number, crit: boolean, poison?: { dps: number, duration: number }, credit?: KillCredit, world: World }
  | { kind: 'bolt', from: THREE.Vector3, target: Enemy, damage: number, color: number, armorShred?: number, mrPierce?: number, credit?: KillCredit, world: World }
  | { kind: 'bomb', from: THREE.Vector3, at: THREE.Vector3, damage: number, splash: number, cluster?: { count: number, damage: [number, number], radius: number }, burn?: { dps: number, duration: number, radius: number }, mine?: MineSpec, stunChance?: number, credit?: KillCredit, world: World }
  | { kind: 'chain', from: THREE.Vector3, first: Enemy, damage: number, targets: number, falloff: number, stunChance: number, stunDur: number, mrPierce?: number, credit?: KillCredit, world: World }
  | { kind: 'warlockBolt', from: THREE.Vector3, target: Soldier, damage: number, world: World }
  | { kind: 'meteor', at: THREE.Vector3, damage: number, world: World }
