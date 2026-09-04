import { VoxModel, VoxBox, box } from './builder.ts'

/**
 * Tower models, footprint ~8x8 vu on a 10x10 plot. Animatable parts:
 *  - 'turret': rotates to face target (arrow archer, cannon gun)
 *  - 'crystal': mage focus, bobs & spins
 *  - 'flag': barracks banner, waves
 * Everything else goes in 'base'.
 */

const W = {
  wood: 0x8a6a3c, woodDark: 0x6d4f2a, woodPale: 0xb59a6a,
  stone: 0x9aa2ae, stoneDark: 0x707886, stoneLight: 0xb8bfc9,
  roofRed: 0xa8402f, roofBlue: 0x3d5a8f, roofGreen: 0x4a7a3f, roofPurple: 0x5f3d8f,
  iron: 0x4d525e, gold: 0xd8b64a, white: 0xe8e4d4, obsidian: 0x2b2333,
}

function gableRoof(cx: number, y0: number, cz: number, w: number, d: number, c: number): VoxBox[] {
  const out: VoxBox[] = []
  const steps = 3
  for (let i = 0; i < steps; i++) {
    out.push(box(cx, y0 + i * 0.8 + 0.4, cz, w - i * (w / steps) * 0.9, 0.8, d + 0.6, c))
  }
  return out
}

function crenels(cx: number, y: number, cz: number, w: number, d: number, c: number): VoxBox[] {
  const out: VoxBox[] = []
  const hw = w / 2, hd = d / 2
  for (let i = -1; i <= 1; i++) {
    out.push(box(cx + i * hw * 0.8, y, cz - hd, 0.9, 0.9, 0.7, c))
    out.push(box(cx + i * hw * 0.8, y, cz + hd, 0.9, 0.9, 0.7, c))
    out.push(box(cx - hw, y, cz + i * hd * 0.8, 0.7, 0.9, 0.9, c))
    out.push(box(cx + hw, y, cz + i * hd * 0.8, 0.7, 0.9, 0.9, c))
  }
  return out
}

/** small archer figure used as arrow-tower turret; pivot centered so it can yaw */
function archerFigure(y: number, tunic: number, hood: number): { part: VoxBox[], pivot: [number, number, number] } {
  const part: VoxBox[] = [
    box(0, y + 0.7, 0, 1.3, 1.5, 0.9, tunic),           // body+legs
    box(0, y + 2.0, 0, 1.1, 1.1, 1.1, 0xd9a066),        // head
    box(0, y + 2.6, -0.1, 1.2, 0.4, 1.2, hood),         // hood
    box(-0.5, y + 1.4, 0.6, 0.35, 1.1, 0.35, 0xd9a066), // bow arm
    box(-0.5, y + 1.4, 1.0, 0.2, 2.2, 0.2, W.woodDark), // bow
    box(0.55, y + 1.2, 0.3, 0.35, 0.9, 0.35, tunic),    // draw arm
  ]
  return { part, pivot: [0, y + 1.2, 0] }
}

function stilts(h: number, c: number): VoxBox[] {
  const out: VoxBox[] = []
  for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]]) {
    out.push(box(x, h / 2, z, 0.9, h, 0.9, c))
  }
  // cross braces
  out.push(box(0, h * 0.45, -2.6, 5.6, 0.5, 0.4, c))
  out.push(box(0, h * 0.45, 2.6, 5.6, 0.5, 0.4, c))
  out.push(box(-2.6, h * 0.45, 0, 0.4, 0.5, 5.6, c))
  out.push(box(2.6, h * 0.45, 0, 0.4, 0.5, 5.6, c))
  return out
}

// ---------------- Arrow towers ----------------

function arrowTower(level: 1 | 2 | 3): VoxModel {
  const h = 4.5 + level * 1.6
  const base: VoxBox[] = [
    box(0, 0.5, 0, 7.5, 1, 7.5, W.stoneDark),
    ...stilts(h, level >= 2 ? W.woodDark : W.wood),
    box(0, h + 0.4, 0, 7, 0.8, 7, W.wood),                    // platform
    box(0, h + 1.2, -3.2, 6.8, 1.0, 0.5, W.woodDark),          // railings
    box(0, h + 1.2, 3.2, 6.8, 1.0, 0.5, W.woodDark),
    box(-3.2, h + 1.2, 0, 0.5, 1.0, 6.8, W.woodDark),
    box(3.2, h + 1.2, 0, 0.5, 1.0, 6.8, W.woodDark),
  ]
  if (level >= 2) {
    // roof canopy on two posts, quiver racks bristling on the rails
    base.push(box(-2.4, h + 3.4, -2.4, 0.6, 4.5, 0.6, W.woodDark))
    base.push(box(2.4, h + 3.4, -2.4, 0.6, 4.5, 0.6, W.woodDark))
    base.push(...gableRoof(0, h + 5.6, -1.2, 8, 5, level === 3 ? W.roofGreen : W.roofRed))
    for (const x of [-2.4, -1.8, 1.8, 2.4]) {
      base.push(box(x, h + 2.1, 3.0, 0.22, 1.6, 0.22, W.woodPale))
    }
  }
  if (level >= 3) {
    base.push(box(0, h + 8.2, -1.2, 0.4, 2.4, 0.4, W.woodDark)) // flag pole
    base.push(box(0.8, h + 8.8, -1.2, 1.8, 1.1, 0.15, W.roofGreen))
    // gilded ridge cap and watch-braziers on the front corners
    base.push(box(0, h + 8.0, -1.2, 8.4, 0.5, 0.9, W.gold))
    for (const x of [-3.0, 3.0]) {
      base.push(box(x, h + 2.0, 3.2, 0.7, 1.0, 0.7, W.iron))
      base.push(box(x, h + 2.8, 3.2, 0.55, 0.55, 0.55, 0xffb23c, true))
    }
  }
  const fig = archerFigure(h + 0.8, level === 3 ? 0x4a7a3f : 0x8a6a4a, level === 3 ? 0x2f4f28 : 0x6d4f2a)
  return { parts: { base, turret: fig.part }, pivots: { turret: fig.pivot } }
}

function sharpshooterTower(): VoxModel {
  const h = 11
  const base: VoxBox[] = [
    box(0, 0.5, 0, 7.5, 1, 7.5, W.stoneDark),
    box(0, 1.6, 0, 6, 1.4, 6, W.stone),
    ...stilts(h, 0x4a3b28),
    box(0, h + 0.4, 0, 7, 0.8, 7, 0x4a3b28),
    // The hide used to be one solid 5.4-wide block, and the archer stood
    // *inside* it: only head and shoulders showed above a box of timber. It
    // is a parapet now - four low walls the archer stands within - so the
    // figure reads as a marksman in a hide rather than a bust on a plinth.
    box(0, h + 1.3, -2.45, 5.4, 1.2, 0.5, 0x3a2e1f),
    box(0, h + 1.3, 2.45, 5.4, 1.2, 0.5, 0x3a2e1f),
    box(-2.45, h + 1.3, 0, 0.5, 1.2, 4.4, 0x3a2e1f),
    box(2.45, h + 1.3, 0, 0.5, 1.2, 4.4, 0x3a2e1f),
    // the telescope on its post, off-centre so it never shares the archer's column
    box(1.9, h + 2.4, -1.6, 0.5, 2.6, 0.5, 0x3a2e1f),
    box(1.9, h + 4.0, -1.6, 2.6, 1.0, 1.0, W.iron),               // telescope
    box(1.9, h + 4.0, -0.75, 0.9, 0.7, 0.3, 0x7fe8ff, true),      // lens
  ]
  const fig = archerFigure(h + 0.9, 0x2f4f28, 0x1e3319)
  return { parts: { base, turret: fig.part }, pivots: { turret: fig.pivot } }
}

function galeTower(): VoxModel {
  const h = 9.5
  const base: VoxBox[] = [
    box(0, 0.5, 0, 7.5, 1, 7.5, W.stoneDark),
    ...stilts(h, W.woodPale),
    box(0, h + 0.4, 0, 7.2, 0.8, 7.2, W.woodPale),
    box(0, h + 1.2, -3.2, 7, 1.0, 0.5, 0x8fae72),
    box(0, h + 1.2, 3.2, 7, 1.0, 0.5, 0x8fae72),
    box(-3.2, h + 1.2, 0, 0.5, 1.0, 7, 0x8fae72),
    box(3.2, h + 1.2, 0, 0.5, 1.0, 7, 0x8fae72),
    // wind totem feathers
    box(-3.0, h + 2.6, -3.0, 0.4, 2.2, 0.4, W.woodDark),
    box(-3.0, h + 3.9, -3.0, 1.0, 0.5, 0.2, 0x9fdf8f, true),
    box(3.0, h + 2.6, 3.0, 0.4, 2.2, 0.4, W.woodDark),
    box(3.0, h + 3.9, 3.0, 1.0, 0.5, 0.2, 0x9fdf8f, true),
  ]
  const fig = archerFigure(h + 0.8, 0x7f9f5a, 0x55703e)
  return { parts: { base, turret: fig.part }, pivots: { turret: fig.pivot } }
}

// ---------------- Mage towers ----------------

function mageTower(level: 1 | 2 | 3): VoxModel {
  const h = 5 + level * 1.8
  const bandColor = [0x8f5aff, 0x7a6aff, 0x5aa0ff][level - 1]
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7, 1.2, 7, W.stoneDark),
    box(0, h * 0.35, 0, 5.2, h * 0.7, 5.2, W.stone),
    box(0, h * 0.75, 0, 4.4, h * 0.5, 4.4, W.stoneLight),
    box(0, h * 0.5, 0, 5.5, 0.7, 5.5, bandColor),             // rune band
    box(0, h + 0.3, 0, 5.6, 0.7, 5.6, W.stoneDark),           // top rim
  ]
  for (let i = 0; i < level; i++) {
    base.push(box(0, 1.8 + i * 2.6, 2.75, 0.9, 1.4, 0.25, bandColor, true)) // glowing windows
  }
  if (level >= 2) {
    base.push(box(-2.9, h + 1.0, -2.9, 0.8, 1.6, 0.8, W.stoneDark))
    base.push(box(2.9, h + 1.0, 2.9, 0.8, 1.6, 0.8, W.stoneDark))
    base.push(box(-2.9, h + 2.0, -2.9, 0.55, 0.9, 0.55, bandColor, true))
    base.push(box(2.9, h + 2.0, 2.9, 0.55, 0.9, 0.55, bandColor, true))
  }
  if (level >= 3) {
    // all four pinnacles lit, plus a second rune band girdling the spire
    base.push(box(2.9, h + 1.0, -2.9, 0.8, 1.6, 0.8, W.stoneDark))
    base.push(box(-2.9, h + 1.0, 2.9, 0.8, 1.6, 0.8, W.stoneDark))
    base.push(box(2.9, h + 2.0, -2.9, 0.55, 0.9, 0.55, bandColor, true))
    base.push(box(-2.9, h + 2.0, 2.9, 0.55, 0.9, 0.55, bandColor, true))
    base.push(box(0, h * 0.82, 0, 4.8, 0.6, 4.8, bandColor))
  }
  const crystalY = h + 2.6 + level * 0.3
  const crystal: VoxBox[] = [
    box(0, crystalY, 0, 1.5, 2.2, 1.5, bandColor, true),
    box(0, crystalY + 1.4, 0, 0.8, 0.9, 0.8, 0xffffff, true),
    box(0, crystalY - 1.4, 0, 0.8, 0.9, 0.8, bandColor, true),
  ]
  if (level >= 3) {
    // twin motes orbit the archmage focus
    crystal.push(box(-1.7, crystalY + 0.3, 0, 0.6, 0.6, 0.6, 0xffffff, true))
    crystal.push(box(1.7, crystalY - 0.3, 0, 0.6, 0.6, 0.6, bandColor, true))
  }
  return { parts: { base, crystal }, pivots: { crystal: [0, crystalY, 0] } }
}

function arcaneObelisk(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.2, 1.2, 7.2, W.obsidian),
    box(0, 4.5, 0, 4.6, 7, 4.6, 0x3a2d4d),
    box(0, 9, 0, 3.6, 2.4, 3.6, W.obsidian),
    // floating rune rings
    box(0, 3.2, 2.4, 1.6, 1.6, 0.2, 0xb37aff, true),
    box(0, 6.0, 2.35, 1.2, 1.2, 0.2, 0xb37aff, true),
    box(2.4, 4.6, 0, 0.2, 1.6, 1.6, 0xb37aff, true),
    box(-2.4, 4.6, 0, 0.2, 1.6, 1.6, 0xb37aff, true),
  ]
  const crystal: VoxBox[] = [
    box(0, 12.4, 0, 2.0, 3.0, 2.0, 0xb37aff, true),
    box(0, 14.3, 0, 1.1, 1.1, 1.1, 0xffffff, true),
    box(0, 10.6, 0, 1.1, 1.1, 1.1, 0x7a3aff, true),
  ]
  return { parts: { base, crystal }, pivots: { crystal: [0, 12.4, 0] } }
}

function stormSpire(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.2, 1.2, 7.2, W.stoneDark),
    box(0, 3.5, 0, 4.8, 5.4, 4.8, 0x3d4a5f),
    box(0, 7.0, 0, 3.8, 2.0, 3.8, W.iron),
    box(0, 8.6, 0, 0.9, 2.4, 0.9, W.iron),          // mast
    // tesla rings
    box(0, 4.2, 0, 6.2, 0.5, 6.2, 0x5ad0ff, true),
    box(0, 6.4, 0, 5.0, 0.5, 5.0, 0x5ad0ff, true),
  ]
  const crystal: VoxBox[] = [
    box(0, 10.6, 0, 1.7, 1.7, 1.7, 0x9fe8ff, true),
    box(0, 10.6, 0, 2.5, 0.6, 0.6, 0x5ad0ff, true),
    box(0, 10.6, 0, 0.6, 0.6, 2.5, 0x5ad0ff, true),
  ]
  return { parts: { base, crystal }, pivots: { crystal: [0, 10.6, 0] } }
}

// ---------------- Cannons ----------------

function cannonTower(level: 1 | 2 | 3): VoxModel {
  const baseH = 1.6 + level * 0.9
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.5, 1.2, 7.5, W.stoneDark),
    box(0, baseH / 2 + 1, 0, 6 - level * 0.3, baseH, 6 - level * 0.3, W.stone),
    box(0, baseH + 1.3, 0, 6.4 - level * 0.3, 0.6, 6.4 - level * 0.3, W.stoneDark),
  ]
  if (level >= 2) {
    base.push(...crenels(0, baseH + 1.9, 0, 5.4, 5.4, W.stoneDark))
    // cannonball pyramid by the wall
    base.push(box(-2.7, 1.5, 2.7, 1.5, 0.6, 1.5, W.iron))
    base.push(box(-2.7, 2.0, 2.7, 0.7, 0.6, 0.7, 0x353942))
  }
  if (level >= 3) {
    base.push(box(-2.8, 2.2, -2.8, 1.2, 2.8, 1.2, W.iron))
    base.push(box(2.8, 2.2, 2.8, 1.2, 2.8, 1.2, W.iron))
    // war banners on the iron pylons
    base.push(box(-2.8, 4.6, -2.8, 0.3, 2.2, 0.3, W.woodDark))
    base.push(box(-2.2, 5.2, -2.8, 1.3, 0.9, 0.15, 0xc03a2f))
    base.push(box(2.8, 4.6, 2.8, 0.3, 2.2, 0.3, W.woodDark))
    base.push(box(3.4, 5.2, 2.8, 1.3, 0.9, 0.15, 0xc03a2f))
  }
  const ty = baseH + 2.2
  const barrelLen = 3 + level * 0.7
  const turret: VoxBox[] = [
    box(0, ty, 0, 3.2, 1.6, 3.2, W.woodDark),                        // mount
    box(0, ty + 1.2, barrelLen / 2 - 0.5, 1.6 + level * 0.15, 1.6 + level * 0.15, barrelLen, W.iron),
    box(0, ty + 1.2, barrelLen - 0.3, 1.9 + level * 0.15, 1.9 + level * 0.15, 0.8, 0x353942), // muzzle ring
  ]
  return { parts: { base, turret }, pivots: { turret: [0, ty, 0] } }
}

function dragonfireMortar(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.6, 1.2, 7.6, 0x4d3f38),
    box(0, 2.2, 0, 6.4, 2.2, 6.4, 0x5c4a42),
    ...crenels(0, 3.7, 0, 5.6, 5.6, 0x4d3f38),
    box(-2.6, 4.6, -2.6, 0.7, 2.4, 0.7, W.iron),
    box(-2.6, 6.0, -2.6, 1.0, 0.6, 0.6, 0xff7a3c, true),   // brazier
    box(2.6, 4.6, 2.6, 0.7, 2.4, 0.7, W.iron),
    box(2.6, 6.0, 2.6, 1.0, 0.6, 0.6, 0xff7a3c, true),
  ]
  const turret: VoxBox[] = [
    box(0, 4.4, 0, 3.6, 1.8, 3.6, W.iron),
    box(0, 6.2, 0.7, 3.0, 3.2, 3.0, 0x353942),             // fat mortar tube, angled feel
    box(0, 7.9, 1.0, 3.4, 0.8, 3.4, 0x2a2d35),
    box(0, 7.6, 1.0, 2.2, 0.7, 2.2, 0xff5a3c, true),       // glowing throat
  ]
  return { parts: { base, turret }, pivots: { turret: [0, 4.4, 0] } }
}

function clusterBombard(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.5, 1.2, 7.5, W.stoneDark),
    box(0, 2.4, 0, 6.2, 2.6, 6.2, W.stone),
    ...crenels(0, 4.1, 0, 5.4, 5.4, W.stoneDark),
  ]
  const ty = 4.6
  const turret: VoxBox[] = [
    box(0, ty, 0, 4.2, 1.6, 3.4, W.woodDark),
    box(-1.1, ty + 1.2, 1.6, 1.5, 1.5, 4.4, W.iron),
    box(1.1, ty + 1.2, 1.6, 1.5, 1.5, 4.4, W.iron),
    box(-1.1, ty + 1.2, 3.6, 1.8, 1.8, 0.7, 0x353942),
    box(1.1, ty + 1.2, 3.6, 1.8, 1.8, 0.7, 0x353942),
    box(0, ty + 2.4, 0, 2.0, 1.4, 2.0, 0x5c4a42),          // ammo hopper
  ]
  return { parts: { base, turret }, pivots: { turret: [0, ty, 0] } }
}

// ---------------- Barracks ----------------

function barracksTower(level: 1 | 2 | 3): VoxModel {
  const wallC = level === 1 ? W.wood : level === 2 ? W.stone : W.stoneLight
  const roofC = level === 1 ? 0x8f7a4a : level === 2 ? W.roofRed : W.roofBlue
  const h = 3.4 + level * 0.5
  const base: VoxBox[] = [
    box(0, 0.5, 0, 8, 1, 8, W.stoneDark),
    box(0, h / 2 + 1, 0, 6.6, h, 5.8, wallC),
    box(0, h / 2 + 0.8, 2.95, 1.8, 2.6, 0.3, W.woodDark),      // door
    box(0, h + 0.6, 2.95, 2.4, 0.5, 0.4, W.woodDark),          // lintel
    ...gableRoof(0, h + 1, 0, 7.4, 6.2, roofC),
  ]
  if (level >= 2) {
    base.push(box(-2.2, h + 0.4, 2.95, 1.0, 1.0, 0.25, 0x7fd4ff, true))  // windows
    base.push(box(2.2, h + 0.4, 2.95, 1.0, 1.0, 0.25, 0x7fd4ff, true))
  }
  if (level >= 3) {
    base.push(box(-3.2, 2.6, -3.2, 1.8, 4.4, 1.8, W.stone))    // corner turret
    base.push(...crenels(-3.2, 5.2, -3.2, 1.6, 1.6, W.stoneDark))
    // kite shields racked on the front wall, gilded lintel
    for (const [x, c] of [[-2.4, 0x37548f], [2.4, 0xc03a2f]] as const) {
      base.push(box(x, 1.9, 3.05, 1.0, 1.5, 0.25, c))
      base.push(box(x, 1.1, 3.05, 0.7, 0.5, 0.25, c))
    }
    base.push(box(0, h + 0.6, 2.95, 2.6, 0.5, 0.45, W.gold))
  }
  const poleX = 3.1, poleY = h + 3.2
  const base2: VoxBox[] = [box(poleX, poleY / 2 + 1, -3.1, 0.4, poleY, 0.4, W.woodDark)]
  const flag: VoxBox[] = [
    box(poleX - 1.2, poleY + 0.4, -3.1, 2.2, 1.4, 0.15, level === 3 ? 0x37548f : 0xc03a2f),
  ]
  return {
    parts: { base: [...base, ...base2], flag },
    pivots: { flag: [poleX, poleY + 0.4, -3.1] },
  }
}

function paladinSanctum(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.5, 0, 8, 1, 8, W.stoneLight),
    box(0, 3.0, 0, 6.6, 4.4, 5.8, W.white),
    box(0, 2.4, 2.95, 1.8, 3.0, 0.3, W.gold),                 // gilded door
    box(0, 4.6, 2.95, 1.4, 1.8, 0.25, 0xffe89f, true),        // rose window
    ...gableRoof(0, 5.4, 0, 7.4, 6.2, W.gold),
    box(0, 8.6, 0, 0.6, 2.2, 0.6, W.gold),                    // spire
    box(0, 10.0, 0, 1.0, 0.9, 0.3, 0xffe89f, true),           // halo emblem
    box(-2.8, 2.2, 2.4, 0.9, 3.6, 0.9, W.stoneLight),         // columns
    box(2.8, 2.2, 2.4, 0.9, 3.6, 0.9, W.stoneLight),
  ]
  const flag: VoxBox[] = [box(-1.1, 7.9, -2.6, 2.0, 1.3, 0.15, W.white)]
  return { parts: { base, flag }, pivots: { flag: [0, 7.9, -2.6] } }
}

function berserkerHall(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.5, 0, 8.4, 1, 8, 0x3d3a35),
    box(0, 2.6, 0, 7.2, 3.4, 5.6, 0x4a3527),
    box(0, 2.2, 2.85, 2.0, 2.6, 0.3, 0x2a1f16),
    ...gableRoof(0, 4.4, 0, 8, 6, 0x38302a),
    // horns on the ridge
    box(-1.6, 7.2, 0, 0.5, 1.6, 0.5, 0xe8e4d4),
    box(1.6, 7.2, 0, 0.5, 1.6, 0.5, 0xe8e4d4),
    box(-2.0, 8.0, 0, 0.4, 0.8, 0.4, 0xe8e4d4),
    box(2.0, 8.0, 0, 0.4, 0.8, 0.4, 0xe8e4d4),
    // brazier
    box(3.4, 1.6, 3.2, 1.1, 1.4, 1.1, W.iron),
    box(3.4, 2.6, 3.2, 0.9, 0.7, 0.9, 0xff7a3c, true),
  ]
  const flag: VoxBox[] = [box(-3.3, 5.4, -2.9, 0.15, 2.6, 1.9, 0x8f2f2f)]
  return {
    parts: { base: [...base, box(-3.3, 4.2, -2.9, 0.4, 5.4, 0.4, 0x2a1f16)], flag },
    pivots: { flag: [-3.3, 6.6, -2.9] },
  }
}

// ---------------- capstones (tier 5) ----------------
// Each capstone keeps its tier-4 branch silhouette and adds capstone regalia.

function crownwingAerie(branch: 0 | 1): VoxModel {
  const m = branch === 0 ? sharpshooterTower() : galeTower()
  const h = branch === 0 ? 11 : 9.5
  // a gold crown parapet ringing the top, and a royal beacon above it all
  if (branch === 0) {
    m.parts.base.push(
      ...crenels(0, h + 2.3, 0, 5.6, 5.6, W.gold),
      box(0, h + 5.6, 0, 0.35, 1.6, 0.35, W.gold),
      box(0, h + 6.7, 0, 0.8, 0.8, 0.8, 0xffe89f, true),
    )
  } else {
    m.parts.base.push(
      ...crenels(0, h + 2.0, 0, 6.6, 6.6, W.gold),
      box(0, h + 3.4, 0, 0.35, 3.2, 0.35, W.gold),
      box(0, h + 5.3, 0, 0.8, 0.8, 0.8, 0xffe89f, true),
    )
  }
  // bright arrow rack on the parapet
  m.parts.base.push(...[-1.0, -0.5, 0, 0.5, 1.0].map(x => box(x, h + 1.7, -2.9, 0.18, 1.3, 0.18, 0xffe89f, true)))
  return m
}

function convergenceMonolith(branch: 0 | 1): VoxModel {
  const m = branch === 0 ? arcaneObelisk() : stormSpire()
  const cy = branch === 0 ? 12.4 : 10.6
  // four violet slabs orbit the focus crystal (they spin with it)
  for (const [dx, dz] of [[-2.1, 0], [2.1, 0], [0, -2.1], [0, 2.1]] as const) {
    m.parts.crystal.push(box(dx, cy, dz, 0.5, 1.7, 0.5, 0xb37aff, true))
  }
  m.parts.base.push(
    box(0, 1.7, 0, 8.4, 0.4, 8.4, 0x2a1d45),
    box(0, 2.0, 0, 7.2, 0.3, 7.2, 0x8fdfff, true),   // convergence ring
  )
  return m
}

function faultlineArsenal(branch: 0 | 1): VoxModel {
  const m = branch === 0 ? dragonfireMortar() : clusterBombard()
  // seismic charge stockpiles by the walls
  m.parts.base.push(
    box(-2.9, 1.7, 0.6, 1.1, 1.0, 1.1, 0x2b2333),
    box(-2.9, 2.4, 0.6, 0.8, 0.5, 0.8, 0xff7a3c, true),
    box(2.9, 1.7, -0.6, 1.1, 1.0, 1.1, 0x2b2333),
    box(2.9, 2.4, -0.6, 0.8, 0.5, 0.8, 0xff7a3c, true),
  )
  // gilded reinforcement bands on the gun
  if (branch === 0) m.parts.turret.push(box(0, 7.2, 0.7, 3.4, 0.6, 3.4, W.gold))
  else m.parts.turret.push(box(-1.1, 5.8, 3.0, 1.8, 1.8, 0.5, W.gold), box(1.1, 5.8, 3.0, 1.8, 1.8, 0.5, W.gold))
  return m
}

function oathgateCitadel(branch: 0 | 1): VoxModel {
  const m = branch === 0 ? paladinSanctum() : berserkerHall()
  const sigil = branch === 0 ? 0xffe89f : 0xff7a3c
  if (branch === 1) {
    // a rack of throwing axes by the door: what this camp does, visible at rest
    m.parts.base.push(box(-3.0, 1.6, 2.2, 0.3, 1.4, 1.8, 0x2a1f16))
    for (const z of [1.6, 2.2, 2.8]) {
      m.parts.base.push(box(-3.0, 2.6, z, 0.25, 1.6, 0.25, 0x7a5a30))
      m.parts.base.push(box(-3.0, 3.4, z, 0.3, 0.7, 0.55, 0xb7bcc4))
    }
  }
  // the oath-gate arch over the mustering door
  m.parts.base.push(
    box(-1.7, 2.2, 3.9, 0.7, 4.4, 0.7, W.stoneDark),
    box(1.7, 2.2, 3.9, 0.7, 4.4, 0.7, W.stoneDark),
    box(0, 4.7, 3.9, 4.2, 0.9, 0.9, W.stoneDark),
    box(0, 5.6, 3.9, 1.2, 0.9, 0.3, sigil, true),
  )
  return m
}

// ---------------- Beacons ----------------
// A support building has to look like it *does* something without ever
// firing. The tell is the light: every tier is a taller brazier, and the fire
// itself is the animated 'crystal' part so it flickers and turns.

function beaconTower(level: 1 | 2 | 3): VoxModel {
  const h = 3.6 + level * 1.7
  const stone = level === 3 ? W.stoneLight : W.stone
  const base: VoxBox[] = [
    box(0, 0.5, 0, 7.4, 1, 7.4, W.stoneDark),
    box(0, h / 2 + 1, 0, 3.4, h, 3.4, stone),                 // the column
    box(0, h + 1.25, 0, 4.4, 0.5, 4.4, W.stoneDark),           // cap
    box(0, h + 1.9, 0, 3.0, 0.9, 3.0, W.iron),                 // the basket
  ]
  // steps and a low ring wall, so it reads as a place rather than a post
  base.push(box(0, 1.35, 2.9, 3.2, 0.7, 1.2, W.stoneDark))
  if (level >= 2) {
    for (const [x, z] of [[-2.9, -2.9], [2.9, 2.9], [-2.9, 2.9], [2.9, -2.9]]) {
      base.push(box(x, 1.6, z, 0.9, 1.2, 0.9, W.stoneDark))
      base.push(box(x, 2.5, z, 0.6, 0.6, 0.6, 0xffb23c, true))   // corner lamps
    }
  }
  if (level >= 3) {
    // a signal platform with rails: the high beacon is a watchtower too
    base.push(box(0, h + 0.55, 0, 6.2, 0.6, 6.2, W.woodDark))
    for (const [x, z, w, d] of [[0, -3.0, 6.2, 0.4], [0, 3.0, 6.2, 0.4], [-3.0, 0, 0.4, 6.2], [3.0, 0, 0.4, 6.2]] as const) {
      base.push(box(x, h + 1.3, z, w, 0.9, d, W.woodDark))
    }
    base.push(box(0, h + 0.2, 0, 3.8, 0.4, 3.8, W.gold))
  }
  const fy = h + 2.9
  const crystal: VoxBox[] = [
    box(0, fy, 0, 2.0, 1.8, 2.0, 0xff7a3c, true),
    box(0, fy + 1.1, 0, 1.2, 1.2, 1.2, 0xffb23c, true),
    box(0, fy + 1.9, 0, 0.6, 0.8, 0.6, 0xffe89f, true),
  ]
  return { parts: { base, crystal }, pivots: { crystal: [0, fy, 0] } }
}

function watchfire(): VoxModel {
  const m = beaconTower(3)
  // a pale, searching light: white-blue, with mirrored shutters that turn with it
  m.parts.crystal = [
    box(0, 10.0, 0, 2.2, 2.0, 2.2, 0x9fe8ff, true),
    box(0, 11.3, 0, 1.3, 1.3, 1.3, 0xffffff, true),
    box(-1.5, 10.0, 0, 0.3, 2.4, 2.6, W.iron),
    box(1.5, 10.0, 0, 0.3, 2.4, 2.6, W.iron),
  ]
  m.pivots = { crystal: [0, 10.0, 0] }
  m.parts.base.push(box(0, 8.7, 0, 4.0, 0.5, 4.0, 0x3d4a5f))
  return m
}

function titheHall(): VoxModel {
  const m = beaconTower(3)
  // gilded: the coin-house look, strongboxes at the foot of the column
  m.parts.base.push(
    box(-2.4, 1.6, 0.6, 1.5, 1.2, 1.5, 0x5c4a42),
    box(-2.4, 2.35, 0.6, 1.6, 0.3, 1.6, W.gold),
    box(2.4, 1.6, -0.6, 1.5, 1.2, 1.5, 0x5c4a42),
    box(2.4, 2.35, -0.6, 1.6, 0.3, 1.6, W.gold),
    box(0, 4.8, 1.75, 1.6, 1.6, 0.25, W.gold),               // the crown seal
  )
  m.parts.crystal = m.parts.crystal.map(b => ({ ...b, color: b.c === 0xff7a3c ? 0xffd24a : b.c }))
  return m
}

function crownfire(): VoxModel {
  const m = watchfire()
  m.parts.base.push(...crenels(0, 9.4, 0, 5.4, 5.4, W.gold))
  m.parts.crystal.push(box(0, 12.6, 0, 0.7, 0.9, 0.7, 0xffe89f, true))
  return m
}

function exchequer(): VoxModel {
  const m = titheHall()
  m.parts.base.push(
    box(0, 0.5, 0, 8.4, 0.4, 8.4, W.gold),
    box(0, 9.3, 0, 4.6, 0.5, 4.6, W.gold),
  )
  return m
}

// ---------------- Ballistae ----------------
// Low and wide where the arrow towers are tall: a siege engine on a mount,
// and the whole bow is the turret so it visibly swings to aim.

/**
 * The engine itself: a stock on a swivel, a wide two-armed prod, a windlass
 * at the back and a bolt in the groove. The first version was a thin cross
 * of sticks that read as a fence from the distance the game is played at;
 * this one is built for silhouette - a fat stock, thick arms with iron caps,
 * and a span wider than the mount so the shape is unmistakably a bow.
 */
function ballistaBow(len: number, arm: number, wood: number, iron: number, bolt = 0xc8cdd6): VoxBox[] {
  const y = 0.9
  return [
    box(0, 0.55, 0, 3.2, 1.1, 3.2, wood),                                  // swivel mount
    box(0, y + 0.3, 0, 2.2, 0.6, 2.2, iron),                                // turntable ring
    box(0, y + 0.9, len * 0.12, 1.3, 0.9, len, wood),                       // stock
    box(0, y + 1.45, len * 0.12, 0.5, 0.25, len * 0.9, 0x2b2333),           // the groove
    box(-arm / 2 - 0.2, y + 1.0, len * 0.5, arm, 0.55, 0.7, wood),          // arms
    box(arm / 2 + 0.2, y + 1.0, len * 0.5, arm, 0.55, 0.7, wood),
    box(-arm - 0.3, y + 1.0, len * 0.5, 0.6, 0.8, 0.9, iron),               // iron arm caps
    box(arm + 0.3, y + 1.0, len * 0.5, 0.6, 0.8, 0.9, iron),
    box(0, y + 1.0, len * 0.5, 1.5, 1.1, 1.2, iron),                        // the head block
    box(0, y + 1.05, len * 0.02, arm * 2 + 1.0, 0.16, 0.16, 0x2b2333),      // the string, drawn back
    box(0, y + 1.55, len * 0.18, 0.3, 0.3, len * 0.72, 0x6d4f2a),           // the loaded bolt
    box(0, y + 1.55, len * 0.5 + 0.3, 0.5, 0.5, 0.6, bolt),                 // its head
    box(0, y + 1.2, -len * 0.42, 1.8, 0.5, 0.6, iron),                      // windlass drum
    box(-1.2, y + 1.2, -len * 0.42, 0.25, 1.3, 0.25, iron),                 // crank handles
    box(1.2, y + 1.2, -len * 0.42, 0.25, 1.3, 0.25, iron),
  ]
}

function ballistaTower(level: 1 | 2 | 3): VoxModel {
  const baseH = 1.2 + level * 0.6
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.5, 1.2, 7.5, W.stoneDark),
    box(0, baseH / 2 + 1, 0, 6.0, baseH, 6.0, level === 1 ? W.woodDark : W.stone),
    box(0, baseH + 1.3, 0, 6.4, 0.5, 6.4, W.woodDark),
    // a rack of spare bolts at the back rail
    box(0, baseH + 1.9, -2.7, 2.6, 0.3, 0.5, W.woodDark),
    ...[-0.7, 0, 0.7].map(x => box(x, baseH + 2.5, -2.7, 0.3, 1.8, 0.3, 0x6d4f2a)),
    ...[-0.7, 0, 0.7].map(x => box(x, baseH + 3.5, -2.7, 0.45, 0.45, 0.45, 0xc8cdd6)),
  ]
  if (level >= 2) base.push(...crenels(0, baseH + 1.9, 0, 5.6, 5.6, W.stoneDark))
  if (level >= 3) {
    base.push(box(-2.8, baseH + 2.6, 2.8, 0.9, 2.4, 0.9, W.iron))
    base.push(box(2.8, baseH + 2.6, 2.8, 0.9, 2.4, 0.9, W.iron))
    base.push(box(0, baseH + 1.4, 0, 4.2, 0.35, 4.2, W.gold))
  }
  const ty = baseH + 1.6
  const turret = ballistaBow(4.6 + level * 0.5, 2.0 + level * 0.3, W.woodDark, W.iron).map(b => ({ ...b, y: b.y + ty }))
  return { parts: { base, turret }, pivots: { turret: [0, ty, 0] } }
}

function skyharrow(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.5, 1.2, 7.5, W.stoneDark),
    box(0, 2.4, 0, 5.4, 2.6, 5.4, W.stoneLight),
    box(0, 3.9, 0, 6.2, 0.5, 6.2, 0x3d5a8f),
    // sky-blue pennants on tall staves: the tower that watches upward
    box(-2.8, 5.4, -2.8, 0.3, 3.2, 0.3, W.woodDark),
    box(-2.2, 6.4, -2.8, 1.4, 0.9, 0.15, 0x7fd4ff),
    box(2.8, 5.4, 2.8, 0.3, 3.2, 0.3, W.woodDark),
    box(3.4, 6.4, 2.8, 1.4, 0.9, 0.15, 0x7fd4ff),
  ]
  const ty = 4.2
  const turret = ballistaBow(6.2, 3.2, 0x3d5a8f, W.iron, 0x7fd4ff).map(b => ({ ...b, y: b.y + ty }))
  // the bow is canted upward: raise the head end
  turret.push(box(0, ty + 2.6, 3.4, 0.5, 0.5, 1.2, 0x7fd4ff, true))
  return { parts: { base, turret }, pivots: { turret: [0, ty, 0] } }
}

function wallbreaker(): VoxModel {
  const base: VoxBox[] = [
    box(0, 0.6, 0, 7.6, 1.2, 7.6, 0x4d3f38),
    box(0, 2.4, 0, 6.2, 2.6, 6.2, 0x5c4a42),
    ...crenels(0, 4.1, 0, 5.6, 5.6, 0x4d3f38),
    // iron ram-heads stacked as ammunition
    box(-2.6, 1.9, 2.6, 1.6, 0.8, 1.6, W.iron),
    box(-2.6, 2.6, 2.6, 1.0, 0.6, 1.0, 0x353942),
  ]
  const ty = 4.6
  const turret = ballistaBow(5.8, 2.6, 0x4a3527, 0x353942).map(b => ({ ...b, y: b.y + ty }))
  turret.push(box(0, ty + 2.45, 3.3, 1.3, 1.3, 0.8, W.iron))   // the ram head on the bolt
  return { parts: { base, turret }, pivots: { turret: [0, ty, 0] } }
}

function heavensplitter(): VoxModel {
  const m = skyharrow()
  m.parts.base.push(
    ...crenels(0, 4.5, 0, 6.0, 6.0, W.gold),
    box(0, 8.6, 0, 0.35, 1.8, 0.35, W.gold),
    box(0, 9.8, 0, 0.8, 0.8, 0.8, 0xffe89f, true),
  )
  m.parts.turret.push(box(0, 4.2 + 2.45, 3.6, 0.5, 0.5, 0.9, 0xffe89f, true))
  return m
}

function godsbaneRam(): VoxModel {
  const m = wallbreaker()
  m.parts.base.push(
    box(0, 1.7, 0, 8.4, 0.4, 8.4, W.gold),
    box(2.6, 1.9, -2.6, 1.6, 0.8, 1.6, W.iron),
    box(2.6, 2.6, -2.6, 1.0, 0.6, 1.0, 0xff7a3c, true),
  )
  m.parts.turret.push(box(0, 4.6 + 1.9, 2.9, 1.9, 1.5, 0.5, W.gold))
  return m
}

// ---------------- registry ----------------

export type TowerModelId =
  | 'arrow1' | 'arrow2' | 'arrow3' | 'arrow4a' | 'arrow4b' | 'arrow5a' | 'arrow5b'
  | 'mage1' | 'mage2' | 'mage3' | 'mage4a' | 'mage4b' | 'mage5a' | 'mage5b'
  | 'cannon1' | 'cannon2' | 'cannon3' | 'cannon4a' | 'cannon4b' | 'cannon5a' | 'cannon5b'
  | 'barracks1' | 'barracks2' | 'barracks3' | 'barracks4a' | 'barracks4b' | 'barracks5a' | 'barracks5b'
  | 'beacon1' | 'beacon2' | 'beacon3' | 'beacon4a' | 'beacon4b' | 'beacon5a' | 'beacon5b'
  | 'ballista1' | 'ballista2' | 'ballista3' | 'ballista4a' | 'ballista4b' | 'ballista5a' | 'ballista5b'

const factories: Record<TowerModelId, () => VoxModel> = {
  arrow1: () => arrowTower(1), arrow2: () => arrowTower(2), arrow3: () => arrowTower(3),
  arrow4a: sharpshooterTower, arrow4b: galeTower,
  arrow5a: () => crownwingAerie(0), arrow5b: () => crownwingAerie(1),
  mage1: () => mageTower(1), mage2: () => mageTower(2), mage3: () => mageTower(3),
  mage4a: arcaneObelisk, mage4b: stormSpire,
  mage5a: () => convergenceMonolith(0), mage5b: () => convergenceMonolith(1),
  cannon1: () => cannonTower(1), cannon2: () => cannonTower(2), cannon3: () => cannonTower(3),
  cannon4a: dragonfireMortar, cannon4b: clusterBombard,
  cannon5a: () => faultlineArsenal(0), cannon5b: () => faultlineArsenal(1),
  barracks1: () => barracksTower(1), barracks2: () => barracksTower(2), barracks3: () => barracksTower(3),
  barracks4a: paladinSanctum, barracks4b: berserkerHall,
  barracks5a: () => oathgateCitadel(0), barracks5b: () => oathgateCitadel(1),
  beacon1: () => beaconTower(1), beacon2: () => beaconTower(2), beacon3: () => beaconTower(3),
  beacon4a: watchfire, beacon4b: titheHall,
  beacon5a: crownfire, beacon5b: exchequer,
  ballista1: () => ballistaTower(1), ballista2: () => ballistaTower(2), ballista3: () => ballistaTower(3),
  ballista4a: skyharrow, ballista4b: wallbreaker,
  ballista5a: heavensplitter, ballista5b: godsbaneRam,
}

const modelCache = new Map<TowerModelId, VoxModel>()
export function towerModel(id: TowerModelId): VoxModel {
  let m = modelCache.get(id)
  if (!m) { m = factories[id](); modelCache.set(id, m) }
  return m
}

/** world-space height where projectiles originate */
export const muzzleHeights: Record<TowerModelId, number> = {
  arrow1: 0.75, arrow2: 0.9, arrow3: 1.05, arrow4a: 1.35, arrow4b: 1.2, arrow5a: 1.4, arrow5b: 1.25,
  mage1: 0.95, mage2: 1.15, mage3: 1.3, mage4a: 1.25, mage4b: 1.05, mage5a: 1.3, mage5b: 1.1,
  cannon1: 0.5, cannon2: 0.6, cannon3: 0.72, cannon4a: 0.8, cannon4b: 0.62, cannon5a: 0.85, cannon5b: 0.66,
  barracks1: 0.5, barracks2: 0.5, barracks3: 0.5, barracks4a: 0.5, barracks4b: 0.5, barracks5a: 0.5, barracks5b: 0.5,
  // a beacon fires nothing; the height is where its light is drawn from
  beacon1: 0.85, beacon2: 1.0, beacon3: 1.2, beacon4a: 1.25, beacon4b: 1.2, beacon5a: 1.3, beacon5b: 1.25,
  ballista1: 0.5, ballista2: 0.56, ballista3: 0.62, ballista4a: 0.65, ballista4b: 0.66, ballista5a: 0.68, ballista5b: 0.68,
}

/** Build plot marker */
export function plotModel(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.35, 0, 10, 0.7, 10, 0x8d8776),
        box(0, 0.75, 0, 8.6, 0.35, 8.6, 0xa39c88),
        box(-3.4, 0.95, -3.4, 1.2, 0.3, 1.2, 0x76705f),
        box(3.4, 0.95, 3.4, 1.2, 0.3, 1.2, 0x76705f),
        box(3.4, 0.95, -3.4, 1.2, 0.3, 1.2, 0x76705f),
        box(-3.4, 0.95, 3.4, 1.2, 0.3, 1.2, 0x76705f),
      ],
    },
  }
}

export function rallyFlagModel(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 1.6, 0, 0.35, 3.2, 0.35, 0x6d4f2a),
        box(0.9, 2.7, 0, 1.6, 1.0, 0.12, 0x37a0d8),
        box(0, 0.15, 0, 1.4, 0.3, 1.4, 0x76705f),
      ],
    },
  }
}
