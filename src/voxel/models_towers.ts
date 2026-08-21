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
    // roof canopy on two posts
    base.push(box(-2.4, h + 3.4, -2.4, 0.6, 4.5, 0.6, W.woodDark))
    base.push(box(2.4, h + 3.4, -2.4, 0.6, 4.5, 0.6, W.woodDark))
    base.push(...gableRoof(0, h + 5.6, -1.2, 8, 5, level === 3 ? W.roofGreen : W.roofRed))
  }
  if (level >= 3) {
    base.push(box(0, h + 8.2, -1.2, 0.4, 2.4, 0.4, W.woodDark)) // flag pole
    base.push(box(0.8, h + 8.8, -1.2, 1.8, 1.1, 0.15, W.roofGreen))
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
    box(0, h + 1.3, 0, 5.4, 1.2, 5.4, 0x3a2e1f),               // enclosed hide
    box(0, h + 2.9, 0, 0.5, 2.2, 0.5, 0x3a2e1f),
    box(0, h + 4.4, 0, 2.6, 1.0, 1.0, W.iron),                  // telescope
    box(0, h + 4.4, 0.85, 0.9, 0.7, 0.3, 0x7fe8ff, true),       // lens
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
  const crystalY = h + 2.6 + level * 0.3
  const crystal: VoxBox[] = [
    box(0, crystalY, 0, 1.5, 2.2, 1.5, bandColor, true),
    box(0, crystalY + 1.4, 0, 0.8, 0.9, 0.8, 0xffffff, true),
    box(0, crystalY - 1.4, 0, 0.8, 0.9, 0.8, bandColor, true),
  ]
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
  if (level >= 2) base.push(...crenels(0, baseH + 1.9, 0, 5.4, 5.4, W.stoneDark))
  if (level >= 3) {
    base.push(box(-2.8, 2.2, -2.8, 1.2, 2.8, 1.2, W.iron))
    base.push(box(2.8, 2.2, 2.8, 1.2, 2.8, 1.2, W.iron))
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
  // the oath-gate arch over the mustering door
  m.parts.base.push(
    box(-1.7, 2.2, 3.9, 0.7, 4.4, 0.7, W.stoneDark),
    box(1.7, 2.2, 3.9, 0.7, 4.4, 0.7, W.stoneDark),
    box(0, 4.7, 3.9, 4.2, 0.9, 0.9, W.stoneDark),
    box(0, 5.6, 3.9, 1.2, 0.9, 0.3, sigil, true),
  )
  return m
}

// ---------------- registry ----------------

export type TowerModelId =
  | 'arrow1' | 'arrow2' | 'arrow3' | 'arrow4a' | 'arrow4b' | 'arrow5a' | 'arrow5b'
  | 'mage1' | 'mage2' | 'mage3' | 'mage4a' | 'mage4b' | 'mage5a' | 'mage5b'
  | 'cannon1' | 'cannon2' | 'cannon3' | 'cannon4a' | 'cannon4b' | 'cannon5a' | 'cannon5b'
  | 'barracks1' | 'barracks2' | 'barracks3' | 'barracks4a' | 'barracks4b' | 'barracks5a' | 'barracks5b'

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
