import { box, buildModel, type VoxBox, type VoxModel } from '../voxel/builder.ts'
import { pineTree, rock } from '../voxel/models_env.ts'
import { towerModel, type TowerModelId } from '../voxel/models_towers.ts'
import { HOLD_MAPS, type HoldSnapshot } from '../core/holdData.ts'

const colors = { ruby: 0xb65057, sapphire: 0x427cb9, jade: 0x378a73, gold: 0xd9af52 }
export function keepModel(style: HoldSnapshot): VoxModel {
  const c = colors[style.color], roof = style.keep === 'gilded' ? 0xe4bf64 : 0x3d515f
  const a: VoxBox[] = [box(0, .12, 0, 2.8, .24, 2.8, 0x737b79), box(0, 1, 0, 1.95, 1.8, 1.8, 0xc8c3af), box(0, 1.95, 0, 2.15, .18, 2, 0xe0d8be), box(0, 2.15, 0, 1.8, .25, 1.6, roof), box(0, 2.38, 0, 1.3, .24, 1.1, roof), box(0, 2.62, 0, .85, .24, .65, roof), box(0, .5, .925, .5, .85, .06, 0x354146), box(0, 2.97, 0, .06, .65, .06, 0x554934), box(.22, 3.13, 0, .4, .28, .04, c)]
  for (const x of [-1.06, 1.06]) for (const z of [-1.06, 1.06]) {
    a.push(box(x, 1.05, z, .65, 2, .65, 0xb5b5a5), box(x, 2.1, z, .8, .22, .8, 0xe0d8be), box(x, 2.34, z, .68, .28, .68, roof), box(x, 2.57, z, .43, .18, .43, roof), box(x, 1.25, z + .331, .19, .32, .025, 0x405057))
  }
  for (const x of [-.64, .64]) a.push(box(x, 1.52, .926, .22, .6, .035, c), box(x, 1.86, .95, .29, .055, .055, 0xe4c575))
  return { parts: { masonry: a }, scale: 1 }
}
export function pieceGroup(id: string, style: HoldSnapshot, ghost = false) {
  const [kind, key] = id.split(':'), c = colors[style.color]
  let model: VoxModel
  let normalize = false
  if (kind === 'mastery') { model = towerModel(`${key}6${key === 'seraph' ? 'b' : 'a'}` as TowerModelId); normalize = true }
  else if (kind === 'tree') model = pineTree(() => .45 + Number(key) * .07)
  else if (kind === 'rock') model = rock(() => .6)
  else if (kind === 'flowers') {
    const bed = [box(0, .045, 0, .8, .09, .66, 0x58653e)]
    for (const x of [-.22, 0, .22]) for (const z of [-.15, .15]) { bed.push(box(x, .16, z, .035, .24, .035, 0x447b37), box(x, .3, z, .11, .09, .11, [0xd696a8, 0xf0cd74, 0xb79bc6][+key])) }
    model = { parts: { bed }, scale: 1 }
  }
  else {
    const a: VoxBox[] = []
    if (kind === 'watch') {
      const i = HOLD_MAPS.indexOf(key as typeof HOLD_MAPS[number]), h = 1.5 + (i % 3) * .18
      const stone = [0xbebdab, 0xcad3d5, 0x9e8c75, 0x9dad91, 0xb3a9c4][i % 5]
      a.push(box(0, .13, 0, 1.7, .26, 1.7, 0x707773), box(0, h / 2 + .25, 0, 1.12, h, 1.12, stone), box(0, h + .27, 0, 1.45, .22, 1.45, 0xdbd4bb), box(0, h + .47, 0, 1.24, .2, 1.24, 0x3c5361), box(0, h + .65, 0, .85, .17, .85, 0x3c5361), box(0, h + .83, 0, .43, .18, .43, c), box(0, h * .7, .571, .24, .45, .04, 0x3d4c50), box(-.4, .68, .59, .19, .5, .045, c))
      for (const x of [-.56, .56]) a.push(box(x, h / 2, .56, .16, h, .16, 0xd6d1bc))
    } else if (kind === 'banner' || kind === 'pennant' || kind === 'hero') {
      a.push(box(0, .08, 0, .65, .16, .65, 0x858c85), box(-.22, .75, 0, .07, 1.4, .07, 0x6f593b), box(.05, 1.32, 0, .62, .055, .08, 0xe2c47f), box(.04, 1.04, 0, .46, .52, .035, kind === 'hero' ? 0x688892 : c), box(.04, 1.09, .026, .14, .16, .025, 0xe3d6a8), box(.04, .74, 0, .25, .09, .035, c))
    } else if (kind === 'lamp') {
      a.push(box(0, .07, 0, .35, .14, .35, 0x727a75), box(0, .43, 0, .08, .72, .08, 0x3b4950), box(0, .9, 0, .29, .31, .29, 0xe8c378, true), box(0, 1.11, 0, .36, .09, .36, 0x3b4950))
    } else if (kind === 'hunt') {
      a.push(box(0, .16, 0, 1.5, .32, 1.4, 0x646d76), box(0, .43, 0, 1.15, .24, 1.05, 0xadabb0), box(0, .77, 0, .55, .45, .5, 0xc1b9cf))
      if (key === 'ossuary') {
        a.push(box(0, 1.18, 0, .8, .54, .6, 0xdfd2b4), box(0, 1.45, 0, 1, .13, .75, 0xcda856))
        for (const x of [-.32, 0, .32]) a.push(box(x, 1.64, 0, .13, .29, .55, 0xe9c270))
        for (const x of [-.23, .23]) a.push(box(x, 1.22, .31, .16, .14, .025, 0x41414c))
      } else {
        for (const sign of [-1, 1]) for (let i = 0; i < 4; i++) a.push(box(sign * (.26 + i * .18), 1.08 + i * .13, -.08 * i, .18, .6 - i * .06, .28, [0x554469, 0x77638c, 0xa399ba, 0xdacbe7][i]))
        a.push(box(0, 1.4, .1, .22, .3, .22, 0xb598f2, true))
      }
    } else {
      a.push(box(0, .1, 0, .72, .2, .72, 0x7c857f), box(0, .33, 0, .48, .28, .48, 0xb0b4a5))
      if (kind === 'statue' || kind === 'hero') a.push(box(0, .77, 0, .27, .57, .24, 0xe1ddc8), box(0, 1.18, 0, .25, .25, .25, 0xe1ddc8), box(-.23, .84, 0, .1, .54, .1, 0xb5b4a5), box(.24, .8, 0, .22, .35, .12, c))
      else if (kind === 'daily') a.push(box(0, .82, 0, .28, .65, .28, 0x93e4f5, true), box(0, 1.21, 0, .16, .15, .16, 0xc9f0f5, true))
      else {
        const rank = [15, 30, 60, 100].indexOf(+key) + 1
        for (let i = 0; i < rank + 1; i++) a.push(box(0, .53 + i * .19, 0, .52 - i * .07, .15, .52 - i * .07, i % 2 ? 0xdac37b : 0x889798))
        a.push(box(0, .8 + rank * .19, 0, .18, .3, .18, 0xe8d99e, true))
      }
    }
    model = { parts: { piece: a }, scale: 1 }
  }
  const group = buildModel(model, `courtyard:${id}:${style.color}`, { receiveShadow: true, cloneMaterials: ghost })
  if (normalize) {
    // Model bounds are authored voxel units; fit grand silhouettes onto a display plinth.
    const boxes = Object.values(model.parts).flat(), scale = model.scale ?? .1
    const w = Math.max(...boxes.map(b => Math.abs(b.x) + b.sx / 2)) * 2 * scale
    const d = Math.max(...boxes.map(b => Math.abs(b.z) + b.sz / 2)) * 2 * scale
    const h = Math.max(...boxes.map(b => b.y + b.sy / 2)) * scale
    group.scale.setScalar(Math.min(.86 / Math.max(w, d), 1.6 / h))
  }
  group.userData.holdId = id
  return group
}
