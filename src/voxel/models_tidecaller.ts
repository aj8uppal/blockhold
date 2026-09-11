import { box, type VoxModel } from './builder.ts'

/** Buoy → pumping station → wave cannon or glacial tuning fork. */
export function tidecallerModel(tier: number, branch = 0): VoxModel {
  const deep = 0x254653, stone = 0xb8d2ce, brass = 0xbda067
  const ice = tier >= 4 && branch === 1, light = ice ? 0xc4f3ff : 0x5bdaca
  const height = 3.5 + tier * .7
  const parts: VoxModel['parts'] = { base: [], turret: [], crystal: [] }
  for (const side of [-1, 1]) {
    parts.base.push(box(side * 2.8, .2, 0, 1.5, 1.4, 7.5, deep), box(side * 2.8, .9, 0, 1.55, .25, 6.5, brass))
    parts.base.push(box(side * 1.8, 2.1, 0, .8, 2.6, 2.7, stone))
  }
  parts.base.push(box(0, 1.1, 0, 6.6, .6, 5.5, deep), box(0, 1.55, 0, 5.8, .3, 4.7, brass), box(0, 3, 0, 2.6, 2.7, 2.6, deep))
  if (tier < 4) {
    parts.base.push(box(0, height, 0, 3, .5, 3, stone))
    parts.crystal.push(box(0, height + .9, 0, 1.4, 1.6, 1.4, light, true), box(0, height + 1.85, 0, .7, .3, .7, brass))
  } else if (ice) {
    for (const side of [-1, 1]) {
      parts.base.push(box(side * 2, height - .8, 0, .9, height - 1, 1.3, stone), box(side * 2, height + .5, 0, .55, 2.5, .8, light, true))
    }
    parts.crystal.push(box(0, height, 0, 1.2, 3, 1.2, light, true), box(0, height + 1.8, 0, .6, .6, .6, stone))
  } else {
    parts.turret.push(box(0, height - 1, 0, 3.7, 2.5, 3.4, stone), box(0, height -.7, 2, 2.4, 1.7, 3.4, deep), box(0, height -.7, 3.8, 2.8, 2.1, .4, brass), box(0, height -.7, 4.05, 1.5, .9, .15, light, true))
    for (const side of [-1, 1]) parts.base.push(box(side * 2.7, 3.5, -1, 1, 3.4, 1.4, brass))
  }
  if (tier >= 5) for (const side of [-1, 1]) parts.base.push(box(side * 2.5, 2, 2, .6, 1.3, .5, light, true))
  if (tier === 6) parts.base.push(box(0, 2.3, -2.5, 5.8, .4, .7, brass), box(-2.6, height, -2.5, .7, height, .7, stone), box(2.6, height, -2.5, .7, height, .7, stone))
  return { parts, pivots: { turret: [0, height - 1, 0], crystal: [0, height, 0] }, scale: .1 }
}
