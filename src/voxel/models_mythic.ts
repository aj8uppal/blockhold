import { box, type VoxBox, type VoxModel } from './builder.ts'

const C = { dark: 0x303949, stone: 0xa8b2bb, ivory: 0xe0dac6, gold: 0xc9a862, green: 0x557e59, ice: 0xa1dce6, void: 0x292638 }
const plinth = (color: number): VoxBox[] => [box(0, .55, 0, 8.4, 1.1, 8.4, C.dark), box(0, 1.4, 0, 7.4, .6, 7.4, color)]

/** Each masterwork has its own architecture. Moving weapon parts are preserved. */
export function mythicArchitecture(family: 'arrow' | 'mage' | 'beacon' | 'ballista' | 'barracks', branch: 0 | 1, working: VoxModel): VoxModel {
  const m: VoxModel = { parts: { ...working.parts }, pivots: { ...working.pivots }, sockets: working.sockets }
  const b: VoxBox[] = plinth(branch ? C.stone : C.ivory)
  m.parts.base = b
  if (family === 'arrow') {
    const h = branch ? 9.5 : 11
    const stone = branch ? C.green : C.ivory, trim = branch ? 0xb9cf99 : C.gold
    // An open eagle's aerie versus a buttressed precision watchtower.
    for (const side of [-1, 1]) {
      b.push(box(side * 2.6, 5.2, -1.8, 1.3, 8.2, 2.5, stone), box(side * 2.6, 4, 2.2, 1.0, 5, 1.2, C.dark),
        box(side * 2.6, h - 1.1, 0, 1.65, 2.7, 5.5, stone))
      b.push(box(side * 3.2, h + 1.2, 0, .7, 1.2, 6.8, trim))
      if (branch) {
        for (let i = 0; i < 3; i++) b.push(box(side * (3.2 + i * .85), h + 2 + i * .7, -2.25, 1.2, 2.2 - i * .35, .85, i === 2 ? trim : stone))
        b.push(box(side * 2.65, 6.3, 2.86, .55, 2.9, .2, trim))
      } else {
        b.push(box(side * 3.05, h + 3, -2.8, 1.15, 5.2, 1.3, C.dark),
          box(side * 2.35, h + 5.4, -2.8, 2.5, .65, 1.3, trim),
          box(side * 2.6, 5.7, 2.91, .6, 2.5, .25, 0x527e8d))
      }
    }
    b.push(box(0, h + .4, 0, 7, .8, 7, stone), box(0, h + 1, 3.2, 6.5, .8, .5, trim),
      box(0, 3.5, -1.6, 4, 3.4, 2.8, C.dark))
    // Never place a pole through the archer's chest, or a roof above the bow.
    const turret = working.parts.turret.map(v => ({ ...v }))
    turret.push(box(0, h + 2.0, -.62, 1.5, 1.8, .2, branch ? 0x80ac76 : 0x334d68),
      box(-.5, h + 2.2, 1.05, .32, 2.8, .26, trim))
    m.parts.turret = turret
    if (!branch) b.push(box(0, 5.1, -1.4, 3.1, 6.5, 3.0, stone), box(0, 5.5, .14, .7, 2.1, .2, 0x233342),
      box(0, 2.4, 1.2, 2.3, 1.6, 2, stone), box(0, 1.75, 2.45, 3, .65, 1.4, trim))
    else b.push(box(0, 3.2, -2.25, 3.0, 2.8, 1.2, stone), box(0, 3.25, -1.6, 2.2, 1.9, .15, C.dark))
    for (const side of [-1, 1]) {
      b.push(box(side * 2.6, 2.5, 2.3, 1.6, .5, 1.6, trim), box(side * 2.6, h - 2.7, -.1, 1.85, .45, 5.9, trim))
      // Broad feather vanes make the aerie read as a winged stronghold.
      if (branch) for (let i = 0; i < 3; i++) b.push(box(side * (3.6 + i * .65), h + 1.8 - i * .4, -.8, .8, 1.6, 2.2 - i * .35, i % 2 ? trim : stone))
    }
    // The master archer is larger; the bow socket uses the identical transform.
    const foot = h + (branch ? .8 : .9), scale = 1.2
    m.parts.turret = turret.map(v => ({ ...v, x: v.x * scale, y: foot + (v.y - foot) * scale, z: v.z * scale, sx: v.sx * scale, sy: v.sy * scale, sz: v.sz * scale }))
    const at = working.sockets!.muzzle.at
    m.sockets = { muzzle: { part: 'turret', at: [at[0] * scale, foot + (at[1] - foot) * scale, at[2] * scale] } }
  } else if (family === 'mage') {
    const color = branch ? 0x668795 : C.void, glow = branch ? 0xa1e9ff : 0xa087d5
    b.push(box(0, 2.5, 0, 5.8, 2.2, 5.8, color), box(0, 4, 0, 6.4, .6, 6.4, C.stone))
    for (const side of [-1, 1]) {
      b.push(box(side * 2.7, 8, 0, 1.6, 8.5, 2.4, color), box(side * 2.7, 12.3, 0, 1.9, .7, 2.7, C.stone))
      if (branch) {
        b.push(box(side * 3.1, 14.2, 0, .65, 3.5, 1.0, C.dark), box(side * 2.5, 15.8, 0, 1.75, .7, 1.25, glow, true))
      } else {
        b.push(box(side * 1.9, 13.6, 0, 2.7, 1.1, 2.4, color), box(side * 1, 14.8, 0, 2.6, 1.1, 2.4, color),
          box(side * 3.25, 6.5, 1.25, .3, 4.5, .16, glow, true))
      }
    }
    if (branch) b.push(box(0, 10.5, -2.7, 1.8, 12, 1.7, C.dark), box(0, 16.7, -2.7, 2.1, .8, 2.0, glow, true))
    else b.push(box(0, 16.1, 0, 1, 1.8, 1.7, C.stone))
    const cy = branch ? 11.8 : 10.6
    m.parts.crystal = [box(0, cy, .25, 1.7, 3.1, 1.7, glow, true), box(0, cy + 2, .25, .8, .85, .8, C.ivory), box(0, cy - 2, .25, .8, .85, .8, C.stone)]
    m.pivots!.crystal = [0, cy, .25]
    m.sockets = { muzzle: { part: 'crystal', at: [0, cy, .5] } }
    // Faceted focus, tiered capacitor plates, and broad inset stone panels.
    m.parts.crystal = [-2, -1, 0, 1, 2].map(i => box(0, cy + i * .65, .25, 1.8 - Math.abs(i) * .5, .7, 1.8 - Math.abs(i) * .5, glow, true))
    for (const side of [-1, 1]) {
      b.push(box(side * 2.7, 4.6, 0, 2.3, .55, 3.0, C.stone), box(side * 2.7, 10.1, 1.27, .8, 2.4, .15, branch ? C.dark : 0x5b4b70))
      if (branch) for (const y of [7.0, 8.5, 10]) b.push(box(side * 2.7, y, 0, 2.3, .35, 2.9, C.dark))
    }
  } else if (family === 'beacon') {
    if (!branch) {
      b.push(box(0, 5.0, 0, 3.8, 6.6, 3.8, C.ivory), box(0, 9, 0, 5.4, 1.0, 5.4, C.gold))
      for (const x of [-2.2, 2.2]) for (const z of [-2.2, 2.2]) b.push(box(x, 11.5, z, .8, 5, .8, C.ivory), box(x, 14.3, z, 1.0, .7, 1.0, C.gold))
      b.push(box(0, 14.1, 0, 5.4, .65, 5.4, C.gold), box(0, 15, 0, 3.4, 1.1, 3.4, C.ivory))
      m.parts.crystal = [box(0, 11.6, 0, 2.5, 2.4, 2.5, 0xffd478, true), box(0, 11.6, 0, 1.2, 3.7, 1.2, 0xffefb0, true)]
      m.pivots!.crystal = [0, 11.6, 0]
      for (const side of [-1, 1]) {
        b.push(box(side * 2.2, 3.1, 0, 1, 3.1, 4.6, C.ivory), box(side * 2.2, 4.8, 0, 1.1, .4, 4.8, C.gold),
          box(side * 1.97, 6.2, 0, .16, 2.2, 1.0, C.gold))
        b.push(box(side * 1.25, 15.8, 0, .6, 1.0, 3.1, C.gold))
      }
      m.parts.crystal = [-1, 0, 1].map(i => box(0, 11.6 + i * .7, 0, 2.3 - Math.abs(i) * .5, .45, 2.3 - Math.abs(i) * .5, i ? 0xffd478 : 0xffefb0, true))
    } else {
      b.push(box(0, 4.7, 0, 6.4, 6, 5.8, C.dark), box(0, 3.9, 3, 3.6, 4.2, .4, C.gold), box(0, 3.9, 3.24, 2.7, 3.2, .14, 0x504638),
        box(0, 4, 3.4, 1.4, .35, .2, C.gold), box(0, 4, 3.4, .35, 1.4, .2, C.gold), box(0, 8, 0, 7.3, .85, 6.7, C.gold))
      for (const side of [-1, 1]) b.push(box(side * 2.55, 10.1, 0, 1.3, 3.6, 4.8, C.ivory), box(side * 2.55, 12.1, 0, 1.6, .65, 5, C.gold),
        box(side * 2.8, 4.1, 3, .7, 3.8, .3, C.ivory))
      b.push(box(0, 9.2, 0, 4.3, .6, 4.3, C.gold))
      m.parts.crystal = [box(0, 10.9, 0, 1.8, 2.0, 1.8, 0xffd77b, true), box(0, 12.1, 0, 1.1, .7, 1.1, C.gold)]
      m.pivots!.crystal = [0, 10.9, 0]
      b.push(box(0, 12.6, -.3, 5.8, .5, 3.8, C.gold))
      for (const x of [-2, 0, 2]) b.push(box(x, 13.45, -.3, .75, x === 0 ? 1.5 : 1.0, 1.5, C.gold), box(x, 13.8, .5, .35, .45, .15, 0xffe4a2, true))
      for (const side of [-1, 1]) for (const y of [3.0, 5.2]) b.push(box(side * 3.26, y, 0, .18, 1.15, 2, C.gold))
    }
  } else if (family === 'ballista') {
    const trim = branch ? 0xb98255 : C.ice
    b.push(box(0, 2.4, 0, 6.4, 2.5, 6.4, C.dark), box(0, 3.9, 0, 7, .55, 7, trim))
    for (const side of [-1, 1]) {
      b.push(box(side * 3.3, 2.3, 0, 1.25, 2.7, 6.3, C.stone), box(side * 3.3, 4, -2.7, 1.1, 2.1, 1.4, C.dark))
    }
    const t = working.parts.turret.map(v => ({ ...v }))
    const ty = working.pivots!.turret[1]
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) t.push(box(side * (2.5 + i * .9), ty + 1.7 + (branch ? 0 : i * .55), 2.6 - i * .4, 1.3, .9, 1.1, trim))
      t.push(box(side * 1.0, ty + 2.25, -.3, .6, .6, 6.5, C.dark), box(side * 1.0, ty + 2.6, 2.7, .55, .35, 1, trim))
    }
    if (branch) t.push(box(0, ty + 1.8, -2.7, 3.7, 2.0, 1.8, C.dark), box(0, ty + 2.5, 3.4, 1.15, 1.1, 1.1, trim))
    m.parts.turret = t
    m.sockets = { muzzle: { part: 'turret', at: [0, ty + 2.45, 3.6] } }
    for (const side of [-1, 1]) {
      b.push(box(side * 3.3, 2.0, 1.7, 1.55, .45, 1.8, C.dark), box(side * 3.3, 3.4, 1.7, 1.55, .4, 1.8, trim))
      t.push(box(side * 1.1, ty + 1.35, -2.4, .9, .65, 2, trim))
      if (!branch) t.push(box(side * 4.1, ty + 3.15, 1.9, .5, 1.4, .75, C.ice))
    }
  } else {
    const dark = branch ? 0x373039 : C.ivory, trim = branch ? 0xae6b44 : C.gold
    b.push(box(0, 3.4, -.7, 6.5, 4.3, 5.5, dark), box(0, 2.65, 2.14, 2.1, 3.0, .1, 0x202632))
    for (const side of [-1, 1]) {
      b.push(box(side * 2.65, 6.0, 1.9, 1.7, 9.4, 2.3, dark), box(side * 2.65, 10.9, 1.9, 2.1, .6, 2.6, trim),
        box(side * 2.65, 7.9, 3.1, .65, 3, .16, branch ? 0xbc4935 : 0x318477), box(side * 2.65, 12.1, 1.9, .8, 1.6, 1.1, trim))
    }
    b.push(box(0, 9.2, 1.9, 4, 1.3, 1.5, dark), box(0, 10.1, 1.9, 4.5, .6, 1.7, trim))
    if (branch) {
      for (let i = 0; i < 3; i++) b.push(box(0, 6.1 + i * .75, -.7, 7 - i * 1.7, .8, 6.6, C.dark))
      // A monumental axe, with broad blades and a readable empty center.
      b.push(box(0, 12.1, 1.9, .55, 4.2, .55, trim), box(-1.2, 13.2, 1.9, 1.7, 2.4, .7, C.stone), box(1.2, 13.2, 1.9, 1.7, 2.4, .7, C.stone))
      m.parts.flag = [box(-2.65, 9.0, -1.7, 2.0, 2.3, .14, 0x993f36)]
      m.pivots!.flag = [-3.6, 9.2, -1.7]
    } else {
      m.parts.flag = [box(0, 13.4, 1.9, .35, 6.0, .35, trim), box(-.95, 14.1, 2.0, 1.4, 3.4, .18, 0x286f68), box(.95, 14.1, 2.0, 1.4, 3.4, .18, 0x286f68), box(0, 15.8, 2, 3.4, .4, .25, trim)]
      m.pivots!.flag = [0, 14, 1.9]
    }
    for (const side of [-1, 1]) {
      b.push(box(side * 2.65, 2.0, 1.9, 2.05, .55, 2.65, trim), box(side * 2.65, 6.0, 1.9, 1.95, .4, 2.55, trim),
        box(side * 1.1, 2.6, 2.18, .35, 3.0, .35, trim), box(side * 2.65, 4.0, 3.12, .8, 1.3, .25, branch ? 0xa85637 : 0x356a75))
      if (branch) {
        b.push(box(side * 1.9, 13.2, 1.9, .65, 1.35, .8, C.stone), box(side * 1.4, 14.5, 1.9, .85, .45, .8, C.stone))
      }
    }
    b.push(box(0, 4.4, 2.25, 2.8, .45, .5, trim), box(0, 1.5, 3.3, 2.7, .4, 1.5, C.stone))
  }
  return m
}

export function mythicVessel(ice: boolean): VoxModel {
  const trim = ice ? C.ice : C.gold, hull = ice ? 0x456776 : 0x2e4c5a
  const parts: VoxModel['parts'] = { base: [], turret: [], crystal: [] }
  for (const side of [-1, 1]) {
    parts.base.push(box(side * 2.9, .6, 0, 1.7, 1.8, 8.7, hull), box(side * 2.9, 1.65, 0, 1.8, .3, 8, trim), box(side * 2.9, .7, 4.7, 1, 1.3, 1.2, hull))
    parts.base.push(box(side * 2.8, 3.4, -1.7, 1.2, 3.2, 2.2, C.ivory))
    if (ice) for (let i = 0; i < 3; i++) parts.base.push(box(side * (1.9 + i * .65), 7.0 + i * 1.25, -.5, 1.1 - i * .15, 6.0 - i * .5, .9, i === 2 ? C.ice : C.ivory))
    else parts.base.push(box(side * 2.8, 5.7, -1.7, 1.0, 1.8, 1.5, hull), box(side * 2.8, 6.65, -1.7, 1.25, .4, 1.7, trim))
  }
  parts.base.push(box(0, 1.8, 0, 6.6, .6, 7.5, hull), box(0, 2.35, 0, 5.7, .45, 6.5, C.ivory), box(0, 4.0, -.8, 3.0, 2.8, 3.2, hull))
  if (ice) {
    for (let i = -3; i <= 3; i++) parts.crystal.push(box(0, 8.1 + i * .7, 0, 1.9 - Math.abs(i) * .43, .75, 1.9 - Math.abs(i) * .43, C.ice, true))
    for (const side of [-1, 1]) parts.base.push(box(side * 2.5, 6.8, -.5, 1.1, .5, 1.35, hull), box(side * 3.2, 8.5, -.5, 1.0, .4, 1.1, hull))
  }
  else {
    parts.turret.push(box(0, 6, 0, 4.2, 3, 3.6, C.ivory), box(0, 6.2, 2.1, 3.0, 2.2, 4, hull), box(0, 6.2, 4.2, 3.4, 2.65, .5, trim), box(0, 6.2, 4.49, 2.3, 1.55, .1, 0x15353d), box(0, 6.2, 4.51, 1.35, .5, .1, 0x7fefdc, true))
    parts.base.push(box(0, 8.5, -2.5, .55, 6.5, .55, trim), box(.8, 10.4, -2.5, 2.1, 2.6, .2, 0x468e91))
  }
  return { parts, pivots: { turret: [0, 5.8, 0], crystal: [0, 8.1, 0] }, sockets: { muzzle: { part: ice ? 'crystal' : 'turret', at: ice ? [0, 8.1, 0] : [0, 6.2, 4.5] } } }
}
