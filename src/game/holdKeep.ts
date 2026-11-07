import { box, type VoxBox, type VoxModel } from '../voxel/builder.ts'
import type { HoldPieces } from './hold.ts'

/*
 * The keep's masonry, kept apart from the bookkeeping in hold.ts so the menu
 * can fetch it alongside the island instead of in the first download.
 */

const C = {
  stone: 0xc2baa8, stoneDark: 0x948c7e, stoneLight: 0xdcd4c2, trim: 0xe9e2cf,
  cobble: 0xa59d8d, cobbleAlt: 0xb3ab9a,
  roof: 0x45596e, roofDark: 0x36485b, roofGilt: 0xe8b23c, roofGiltDark: 0xc48d22,
  window: 0x2b2f3a, wood: 0x6b4a2c, lamp: 0xffc768,
  banner: 0xb03a4a, bannerTrim: 0xe8c36a, bannerPole: 0x5a4326,
  pennant: 0xe8b23c, pennantDark: 0x9a6a1c,
  statue: 0xe6e1d1, crystal: 0x8fdfff,
}

/** merlons along one edge of a wall top */
function merlons(into: VoxBox[], x0: number, x1: number, z0: number, z1: number, y: number, c: number, size = 0.7): void {
  const len = Math.hypot(x1 - x0, z1 - z0)
  const n = Math.max(2, Math.round(len / (size * 2)))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    into.push(box(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, size, size, size, c))
  }
}

/**
 * Compose the keep from what has been earned. The hall, its courtyard and
 * curtain wall are always there; everything that rises above them is
 * something the player did.
 */
export function holdModel(p: HoldPieces): VoxModel {
  const gilded = p.gilding > 0
  const roof = gilded ? C.roofGilt : C.roof
  const roofDark = gilded ? C.roofGiltDark : C.roofDark

  // the courtyard, paved, inside a low curtain wall with a gate to the front
  const ground: VoxBox[] = [box(0, 0.12, 0, 18.4, 0.24, 14.4, C.cobble)]
  for (let x = -8; x <= 8; x += 2) for (let z = -6; z <= 6; z += 2) {
    if ((x * 7 + z * 13) % 3 === 0) ground.push(box(x, 0.25, z, 1.8, 0.04, 1.8, C.cobbleAlt))
  }
  const walls: VoxBox[] = [
    box(0, 0.95, -6.85, 18.4, 1.5, 0.7, C.stone),
    box(-8.85, 0.95, 0, 0.7, 1.5, 14.4, C.stone),
    box(8.85, 0.95, 0, 0.7, 1.5, 14.4, C.stone),
    box(-5.5, 0.95, 6.85, 7.4, 1.5, 0.7, C.stone),
    box(5.5, 0.95, 6.85, 7.4, 1.5, 0.7, C.stone),
    // gate posts and their lintel
    box(-2.1, 1.5, 6.85, 1.0, 3.0, 1.0, C.stoneLight),
    box(2.1, 1.5, 6.85, 1.0, 3.0, 1.0, C.stoneLight),
    box(0, 3.2, 6.85, 5.2, 0.5, 1.0, C.stoneLight),
    box(-2.1, 3.6, 6.85, 0.7, 0.4, 0.7, C.trim),
    box(2.1, 3.6, 6.85, 0.7, 0.4, 0.7, C.trim),
  ]
  merlons(walls, -8.85, 8.85, -6.85, -6.85, 2.0, C.stoneLight, 0.6)
  merlons(walls, -8.85, -8.85, -6.85, 6.85, 2.0, C.stoneLight, 0.6)
  merlons(walls, 8.85, 8.85, -6.85, 6.85, 2.0, C.stoneLight, 0.6)
  merlons(walls, -8.85, -2.9, 6.85, 6.85, 2.0, C.stoneLight, 0.6)
  merlons(walls, 2.9, 8.85, 6.85, 6.85, 2.0, C.stoneLight, 0.6)

  // the great hall: always standing, even on a fresh save
  const keep: VoxBox[] = [
    box(0, 0.65, -0.6, 8.6, 0.9, 7.0, C.stoneDark),
    box(0, 3.1, -0.6, 7.6, 4.6, 6.0, C.stone),
    box(0, 4.3, -0.6, 7.9, 0.3, 6.3, C.stoneLight),
    box(0, 5.55, -0.6, 8.1, 0.5, 6.5, C.stoneLight),
  ]
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) keep.push(box(sx * 3.75, 3.1, -0.6 + sz * 2.95, 0.9, 4.6, 0.9, C.stoneLight))
  merlons(keep, -3.9, 3.9, 2.55, 2.55, 6.1, C.stoneLight, 0.62)
  merlons(keep, -3.9, 3.9, -3.75, -3.75, 6.1, C.stoneLight, 0.62)
  merlons(keep, -3.9, -3.9, -3.75, 2.55, 6.1, C.stoneLight, 0.62)
  merlons(keep, 3.9, 3.9, -3.75, 2.55, 6.1, C.stoneLight, 0.62)
  // windows: tall below the string course, small above it, on every face
  for (const x of [-2.2, 2.2]) {
    keep.push(box(x, 2.9, 2.42, 0.7, 1.4, 0.1, C.window), box(x, 2.12, 2.48, 1.0, 0.18, 0.2, C.trim))
    keep.push(box(x, 2.9, -3.62, 0.7, 1.4, 0.1, C.window))
  }
  for (const x of [-2.6, 0, 2.6]) keep.push(box(x, 4.95, 2.42, 0.45, 0.6, 0.1, C.window))
  for (const z of [-2.4, 1.2]) {
    keep.push(box(-3.82, 2.9, z, 0.1, 1.4, 0.7, C.window), box(-3.88, 2.12, z, 0.2, 0.18, 1.0, C.trim))
    keep.push(box(3.82, 2.9, z, 0.1, 1.4, 0.7, C.window))
  }
  // the gate, its steps and two lanterns
  keep.push(
    box(0, 1.85, 2.45, 2.3, 2.5, 0.3, C.stoneLight),
    box(0, 1.6, 2.58, 1.5, 1.9, 0.12, C.wood),
    box(0, 2.72, 2.58, 1.0, 0.3, 0.12, C.window),
    box(0, 0.35, 3.15, 2.8, 0.3, 1.0, C.stoneDark),
    box(-1.55, 2.4, 2.62, 0.38, 0.5, 0.38, C.lamp, true),
    box(1.55, 2.4, 2.62, 0.38, 0.5, 0.38, C.lamp, true),
  )
  // the gate takes a veilcrystal once a daily has been won
  if (p.relics > 0) keep.push(box(0, 3.55, 2.55, 0.8, 0.8, 0.3, C.crystal, true))

  // the roof steps up to a lantern turret flying the Hold's colours; gilded
  // once Veteran maps start falling, and crowned at three
  const roofs: VoxBox[] = [
    box(0, 6.25, -0.6, 6.6, 0.9, 5.0, roof),
    box(0, 7.05, -0.6, 5.2, 0.8, 3.8, roofDark),
    box(0, 7.75, -0.6, 3.8, 0.7, 2.6, roof),
    box(0, 8.95, -0.6, 1.9, 2.4, 1.9, C.stone),
    box(0, 10.3, -0.6, 2.4, 0.4, 2.4, C.stoneLight),
    box(0, 9.3, 0.36, 0.45, 0.7, 0.1, C.window),
    box(0, 10.85, -0.6, 1.9, 0.7, 1.9, roofDark),
    box(0, 11.45, -0.6, 1.25, 0.6, 1.25, roof),
    box(0, 11.95, -0.6, 0.6, 0.5, 0.6, roofDark),
    box(0, 12.9, -0.6, 0.12, 1.6, 0.12, C.bannerPole),
    box(0.5, 13.3, -0.6, 0.9, 0.55, 0.08, C.banner),
  ]
  if (p.gilding >= 3) roofs.push(box(0, 5.88, -0.6, 8.2, 0.16, 6.6, C.roofGilt), box(0, 10.55, -0.6, 2.5, 0.14, 2.5, C.roofGilt))

  // one tower per map cleared: the four corners of the wall first, then the
  // middle of each side, so the keep fills out evenly as the campaign falls
  const corners: [number, number][] = [
    [-8.85, -6.85], [8.85, -6.85], [-8.85, 6.85], [8.85, 6.85],
    [-8.85, 0], [8.85, 0], [0, -6.85],
  ]
  const towers: VoxBox[] = []
  for (let i = 0; i < Math.min(p.towers, corners.length); i++) {
    const [x, z] = corners[i]
    const h = 6.4 + (i % 3) * 1.4
    towers.push(
      box(x, h / 2, z, 2.4, h, 2.4, C.stone),
      box(x, h / 2, z, 2.9, h, 1.5, C.stone),
      box(x, h / 2, z, 1.5, h, 2.9, C.stone),
      box(x, 0.4, z, 3.3, 0.8, 3.3, C.stoneDark),
      box(x, h * 0.6, z, 3.1, 0.28, 3.1, C.stoneLight),
      box(x, h * 0.78, z + 1.46, 0.36, 0.9, 0.1, C.window),
      box(x - 1.46, h * 0.78, z, 0.1, 0.9, 0.36, C.window),
      box(x, h + 0.3, z, 3.3, 0.6, 3.3, C.stoneLight),
      box(x, h + 1.05, z, 2.5, 0.9, 2.5, roof),
      box(x, h + 1.8, z, 1.8, 0.7, 1.8, roofDark),
      box(x, h + 2.4, z, 1.1, 0.6, 1.1, roof),
      box(x, h + 2.9, z, 0.45, 0.5, 0.45, roofDark),
      box(x, h + 3.6, z, 0.1, 1.0, 0.1, C.bannerPole),
      box(x + 0.35, h + 3.85, z, 0.6, 0.38, 0.06, i % 2 ? C.pennant : C.banner),
    )
    for (const [mx, mz] of [[-1.35, -1.35], [1.35, -1.35], [-1.35, 1.35], [1.35, 1.35]]) {
      towers.push(box(x + mx, h + 0.85, z + mz, 0.6, 0.55, 0.6, C.stoneLight))
    }
  }

  // a banner per three-star map, hung on the outside of the curtain wall
  const bannerSlots = [-3.6, 3.6, -5.2, 5.2, -6.8, 6.8, -4.4, 4.4, -6.0, 6.0]
  const banners: VoxBox[] = []
  for (let i = 0; i < Math.min(p.banners, bannerSlots.length); i++) {
    const x = bannerSlots[i], z = i < 6 ? 7.27 : -7.27
    banners.push(box(x, 1.6, z, 1.0, 0.14, 0.14, C.bannerPole))
    banners.push(box(x, 0.95, z, 0.8, 1.2, 0.08, C.banner))
    banners.push(box(x, 0.42, z, 0.8, 0.14, 0.09, C.bannerTrim))
  }

  // a statue per flawless defense, lining the court in front of the hall
  const statueSlots: [number, number][] = [[-3.2, 4.6], [3.2, 4.6], [-5.2, 4.6], [5.2, 4.6], [-7.0, 4.6], [7.0, 4.6], [-7.0, -4.8], [7.0, -4.8], [-7.0, 2.2], [7.0, 2.2]]
  const statues: VoxBox[] = []
  for (let i = 0; i < Math.min(p.statues, statueSlots.length); i++) {
    const [x, z] = statueSlots[i]
    statues.push(box(x, 0.6, z, 1.0, 0.7, 1.0, C.stoneDark))
    statues.push(box(x, 1.7, z, 0.6, 1.5, 0.5, C.statue))
    statues.push(box(x, 2.7, z, 0.45, 0.45, 0.45, C.statue))
    statues.push(box(x + 0.42, 2.0, z, 0.14, 1.9, 0.14, C.bannerPole))
  }

  // a pennant per family mastered - both capstones flown in battle - on tall
  // poles flanking the road up to the gate, so a completed roster shows from
  // the road before the keep does
  const pennantSlots = [-3.2, 3.2, -6.2, 6.2, -9.2, 9.2, -12.2, 12.2]
  const pennants: VoxBox[] = []
  for (let i = 0; i < Math.min(p.pennants, pennantSlots.length); i++) {
    const x = pennantSlots[i], z = 9.4
    pennants.push(box(x, 0.3, z, 0.6, 0.6, 0.6, C.stoneDark))
    pennants.push(box(x, 3.6, z, 0.16, 6.6, 0.16, C.bannerPole))
    pennants.push(box(x + 0.55, 6.4, z, 0.95, 0.5, 0.1, i % 2 ? C.pennantDark : C.pennant))
    pennants.push(box(x + 0.4, 5.9, z, 0.65, 0.5, 0.1, i % 2 ? C.pennant : C.pennantDark))
  }

  return {
    parts: { ground, walls, keep, roofs, towers, banners, statues, pennants },
    scale: 0.1,
  }
}
