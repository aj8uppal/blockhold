import type { TowerLevelDef } from './types.ts'

/** Two complete Mythics cost 66,500 gold before ascension. The fusion gains
 * focus and a free plot, but loses their independent coverage and eight beams.
 * No critical multiplier, stacked capstone proc, or recursive sacrifice. */
export const CRIMSON_SPLASH_FRACTION = .4
export const CRIMSON_SOVEREIGN: TowerLevelDef = {
  name: 'Crimson Sovereign', model: 'seraphCrimson', cost: 0,
  range: 5.8, damage: [1400,1600], damageType: 'true', attackInterval: .5,
  splash: 1.5, flying: true,
  description: 'A focused crimson pulse pierces armor and magic resistance. Nearby enemies take 40% splash damage. Replaces both Seraph powers.',
}

type FusionTower = { kind: string, level: number, branch: number | null, isGhost: boolean, isFused: boolean }
export function canFuseSeraphs(keeper: FusionTower, donor: FusionTower): boolean {
  return keeper !== donor && keeper.kind === 'seraph' && donor.kind === 'seraph'
    && keeper.level === 6 && donor.level === 6 && !keeper.isGhost && !donor.isGhost
    && !keeper.isFused && !donor.isFused
    && (keeper.branch === 0 && donor.branch === 1 || keeper.branch === 1 && donor.branch === 0)
}
