import type { TowerTree, TowerLevelDef } from './types.ts'
import type { TowerModelId } from '../voxel/models_towers.ts'

function level(name: string, cost: number, model: TowerModelId, damage: [number, number], range: number, interval: number, splash: number, slow?: { factor: number, duration: number }): TowerLevelDef {
  return { name, cost, model, damage, range, attackInterval: interval, splash, slow,
    damageType: 'magic', flying: false,
    description: slow ? 'Water only. Chilling pulses slow ground enemies in the splash area. Bosses resist the strongest slow.'
      : 'Water only. Pressurized waves burst across groups of ground enemies, ignoring armor.' }
}
export const tidecallerTree: TowerTree = {
  kind: 'tidecaller',
  levels: [
    level('Tidecaller', 180, 'tidecaller1', [12, 18], 3.4, 1.3, .55),
    level('Tide Channeler', 260, 'tidecaller2', [25, 39], 3.7, 1.2, .75),
    level('Tide Spire', 420, 'tidecaller3', [48, 68], 4, 1.1, .9),
  ],
  branches: [
    level('Breakwater', 700, 'tidecaller4a', [80, 110], 4.4, 1.3, 1.35),
    level('Winter Current', 700, 'tidecaller4b', [30, 42], 4.2, .95, 1.1, { factor: .45, duration: 1.4 }),
  ],
  capstones: [
    level('Leviathan Engine', 1600, 'tidecaller5a', [160, 220], 4.8, 1.15, 1.6),
    level('Stillwater Crown', 1600, 'tidecaller5b', [60, 80], 4.6, .85, 1.4, { factor: .4, duration: 1.8 }),
  ],
}
export const tidecallerMythics = [
  level('Worldtide', 11000, 'tidecaller6a', [340, 460], 5.2, 1.05, 1.9),
  level('Heart of Winter', 11000, 'tidecaller6b', [140, 180], 5, .8, 1.8, { factor: .35, duration: 2.2 }),
]
tidecallerTree.capstones[0].signature = 'tidalSurge'
tidecallerTree.capstones[0].description += ' Every fourth burst deals 50% more damage across a wider area.'
tidecallerTree.capstones[1].signature = 'undertow'
tidecallerTree.capstones[1].description += ' Every fifth pulse drives ground troops back; bosses cannot be pushed.'
for (let branch = 0; branch < 2; branch++) {
  tidecallerMythics[branch].signature = tidecallerTree.capstones[branch].signature
  tidecallerMythics[branch].description = tidecallerTree.capstones[branch].description
}
