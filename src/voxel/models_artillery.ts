import { box, type VoxBox, type VoxModel } from './builder.ts'

/** A hollow, pitched gun, with a dark bore rather than a glowing solid cap. */
function barrel(out: VoxBox[], x: number, y: number, z: number, length: number, width: number, pitch: number, trim: number): [number, number, number] {
  const c = Math.cos(pitch), s = Math.sin(pitch)
  const add = (dx: number, dy: number, dz: number, sx: number, sy: number, sz: number, color: number, glow = false) =>
    out.push({ ...box(x + dx, y + dy * c - dz * s, z + dy * s + dz * c, sx, sy, sz, color, glow), rx: pitch })
  const wall = .38, end = length / 2
  add(0, 0, -end, width, width, .65, 0x3b404a)
  for (const side of [-1, 1]) {
    add(side * (width - wall) / 2, 0, 0, wall, width, length, 0x444a53)
    add(0, side * (width - wall) / 2, 0, width - wall * 2, wall, length, 0x555c64)
    for (const band of [-end + .8, end - .15]) {
      add(side * width / 2, 0, band, .28, width + .35, .65, trim)
      add(0, side * width / 2, band, width + .35, .28, .65, trim)
    }
  }
  add(0, 0, end - .85, width - wall * 2, width - wall * 2, .07, 0x11151b)
  add(0, -.3, end - .87, width * .35, .18, .09, 0xff9b42, true)
  return [x, y - end * s, z + end * c]
}

/** Low silhouettes: one heavy tube, twin mortars, then a counterweighted siege furnace. */
export function fireArtillery(tier: 4 | 5 | 6): VoxModel {
  const mythic = tier === 6, twin = tier >= 5
  const iron = 0x414750, stone = 0x7f817b, trim = mythic ? 0xd9b968 : 0xa78551
  const parts: VoxModel['parts'] = { base: [], turret: [] }
  parts.base.push(box(0, .5, 0, 8.2, 1, 8.2, 0x515963), box(0, 1.25, 0, 7.3, .5, 7.3, stone),
    box(0, 2.0, 0, 5.7, 1.2, 5.7, iron), box(0, 2.8, 0, 6.8, .45, 6.8, trim))
  for (const side of [-1, 1]) {
    // Heavy trunnions, recoil rails and low rear shell racks.
    parts.turret.push(box(side * 2.65, 4.1, -.35, .75, 2.7, 3.7, iron),
      box(side * 2.65, 5.35, -.4, 1.0, .8, 1.0, trim))
    parts.base.push(box(side * 3.3, 1.9, -2.7, .65, 1.2, 1.7, trim),
      box(side * 3.3, 2.8, -2.7, .48, .6, 1.1, 0x292f36))
    if (mythic) {
      parts.base.push(box(side * 3.2, 3.6, -2, 1.5, 4.6, 2.4, iron),
        box(side * 3.2, 6.25, -2, 1.65, .5, 2.6, trim),
        box(side * 3.2, 4.9, -.76, .7, 1.5, .14, 0xffb852, true),
        box(side * 3.2, 1.0, 3.25, 1.7, .65, 1.9, iron))
    }
  }
  parts.turret.push(box(0, 3.7, -.5, 5.4, 1.0, 3.8, iron))
  let muzzle: [number, number, number] = [0, 0, 0]
  const sockets: NonNullable<VoxModel['sockets']> = {}
  for (const x of twin ? [-1.3, 1.3] : [0]) {
    muzzle = barrel(parts.turret, x, mythic ? 6.3 : 5.6, .4, mythic ? 6.6 : 5.2, twin ? 2.2 : 3.4, -.68, trim)
    sockets[Object.keys(sockets).length ? 'muzzle2' : 'muzzle'] = { part: 'turret', at: muzzle }
  }
  if (mythic) parts.turret.push(box(0, 5.1, -2.2, 4.8, 1.6, 1.9, iron), box(0, 5.2, -3.2, 3.5, .7, .15, trim))
  return { parts, pivots: { turret: [0, 4.1, -.4] }, sockets }
}

export function worldshakerModel(): VoxModel {
  const m = fireArtillery(6)
  const turret: VoxBox[] = [box(0, 4.1, -.3, 6.0, 1.5, 4.6, 0x3d424d)]
  const sockets: NonNullable<VoxModel['sockets']> = {}
  for (const [i, x] of [-2.0, 0, 2.0].entries()) {
    const at = barrel(turret, x, i === 1 ? 6.6 : 5.5, .5, 7, 1.7, -.22, 0x94afb9)
    sockets[i ? `muzzle${i + 1}` : 'muzzle'] = { part: 'turret', at }
  }
  m.parts.turret = turret
  m.sockets = sockets
  return m
}
