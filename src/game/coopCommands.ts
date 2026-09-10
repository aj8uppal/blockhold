import type { TowerKind, TrapKind } from './types.ts'

/**
 * Everything a player can do to the battle, as data.
 *
 * In co-op these travel to the room and come back stamped for a turn; every
 * client applies the same list at the same tick. Towers are named by plot
 * index and traps by spot index because those are the same on every board
 * built from the same map; positions are world coordinates, which JSON
 * carries exactly.
 */
export type CoopCommand =
  | { kind: 'shareMastery', families: TowerKind[] }
  | { kind: 'build', plot: number, tower: TowerKind }
  | { kind: 'upgrade', plot: number, opt: number }
  | { kind: 'sell', plot: number }
  | { kind: 'ascend', plot: number, perk: 0 | 1 }
  | { kind: 'mythic', plot: number }
  | { kind: 'overcharge', plot: number }
  | { kind: 'overchargeAll' }
  | { kind: 'expand', c: number, r: number }
  | { kind: 'policy', plot: number }
  | { kind: 'trackline', plot: number }
  | { kind: 'holdline', plot: number, x: number, z: number }
  | { kind: 'rally', plot: number, x: number, z: number }
  | { kind: 'trap', spot: number, trap: TrapKind }
  | { kind: 'sellTrap', spot: number }
  | { kind: 'earthwork', spot: number }
  | { kind: 'raise', plot: number }
  | { kind: 'wave' }
  | { kind: 'heroMove', x: number, z: number }
  | { kind: 'heroSig' }
  | { kind: 'heroRank' }
  | { kind: 'meteor', x: number, z: number }
  | { kind: 'reinforce', x: number, z: number }
  | { kind: 'hold' }
  | { kind: 'sandboxSpawn', enemy: string, count: number, lane: number, hp: number }
  | { kind: 'sandboxClear' | 'sandboxReset' }

/** a cheap order-sensitive hash of a few numbers, for spotting a desync */
export function stateHash(nums: number[]): number {
  let h = 2166136261 >>> 0
  for (const n of nums) {
    const v = Math.round(n * 100) | 0
    h ^= v & 0xff; h = Math.imul(h, 16777619) >>> 0
    h ^= (v >>> 8) & 0xff; h = Math.imul(h, 16777619) >>> 0
    h ^= (v >>> 16) & 0xff; h = Math.imul(h, 16777619) >>> 0
    h ^= (v >>> 24) & 0xff; h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
