import { VoxModel, VoxBox, box } from './builder.ts'
import { shuffleColor } from '../core/utils.ts'

/**
 * Scenery for the Frontier boards. Each theme gets a handful of props that
 * say where you are at a glance - palms and cacti, coral, glowing crystal,
 * moon rock - authored the same way as the campaign's trees and rocks: a few
 * coloured boxes in voxel units, seeded so a board always grows the same way.
 */

export function blossomTree(rng: () => number): VoxModel {
  const trunk = 0x6a4a3a
  const petals = [0xf6b8cf, 0xf4a6c4, 0xfbd3e0, 0xe98fb4]
  const pick = () => shuffleColor(petals[Math.floor(rng() * petals.length)], 0.08, rng)
  const h = 3 + rng() * 1.5
  const base: VoxBox[] = [
    box(0, h / 2, 0, 1.1, h, 1.1, trunk),
    box(0.9, h - 0.4, 0.3, 1.8, 0.6, 0.6, trunk),
    box(0, h + 1.6, 0, 5.2, 2.6, 5.0, pick()),
    box(1.6, h + 1.0, 1.2, 2.8, 2.0, 2.6, pick()),
    box(-1.7, h + 2.2, -0.8, 2.6, 2.0, 2.8, pick()),
    box(0.4, h + 3.2, -0.4, 3.0, 1.4, 3.0, pick()),
  ]
  // a few petals already fallen
  for (let i = 0; i < 3; i++) base.push(box((rng() - 0.5) * 6, 0.1, (rng() - 0.5) * 6, 0.7, 0.2, 0.7, pick()))
  return { parts: { base } }
}

export function stoneLantern(rng: () => number): VoxModel {
  const stone = shuffleColor(0xb9b2a4, 0.08, rng)
  return {
    parts: {
      base: [
        box(0, 0.4, 0, 2.2, 0.8, 2.2, stone),
        box(0, 1.6, 0, 0.9, 1.8, 0.9, stone),
        box(0, 2.9, 0, 1.9, 0.9, 1.9, stone),
        box(0, 2.9, 0, 1.2, 0.6, 1.2, 0xffc873, true),
        box(0, 3.8, 0, 2.6, 0.5, 2.6, shuffleColor(stone, 0.1, rng)),
        box(0, 4.3, 0, 0.8, 0.6, 0.8, stone),
      ],
    },
  }
}

export function palmTree(rng: () => number): VoxModel {
  const trunk = 0x9a7446
  const leaf = shuffleColor(0x5aa64a, 0.25, rng)
  const h = 5 + Math.floor(rng() * 3)
  const lean = (rng() - 0.5) * 1.2
  const base: VoxBox[] = []
  for (let i = 0; i < h; i++) base.push(box(lean * i / h, 0.5 + i, 0, 1.0, 1.0, 1.0, i % 2 ? trunk : 0x8a6a3e))
  const top = h + 0.4
  const tx = lean
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]]) {
    base.push(box(tx + dx * 1.6, top, dz * 1.6, Math.abs(dx) > 0.5 ? 3.2 : 1.0, 0.5, Math.abs(dz) > 0.5 ? 3.2 : 1.0, leaf))
    base.push(box(tx + dx * 3.0, top - 0.6, dz * 3.0, 1.1, 0.5, 1.1, shuffleColor(leaf, 0.1, rng)))
  }
  base.push(box(tx, top - 0.5, 0.5, 0.7, 0.7, 0.7, 0x6a4a2a))
  return { parts: { base } }
}

export function cactus(rng: () => number): VoxModel {
  const c = shuffleColor(0x5f9a4f, 0.2, rng)
  const h = 3 + Math.floor(rng() * 3)
  const base: VoxBox[] = [box(0, h / 2, 0, 1.2, h, 1.2, c)]
  if (rng() < 0.8) {
    const y = 1.2 + rng()
    base.push(box(1.1, y, 0, 1.0, 0.8, 0.8, c), box(1.5, y + 1.0, 0, 0.8, 1.6, 0.8, c))
  }
  if (rng() < 0.6) {
    const y = 1.8 + rng()
    base.push(box(-1.1, y, 0, 1.0, 0.8, 0.8, c), box(-1.5, y + 0.8, 0, 0.8, 1.2, 0.8, c))
  }
  if (rng() < 0.4) base.push(box(0, h + 0.25, 0, 0.6, 0.5, 0.6, 0xf28fb0))
  return { parts: { base } }
}

export function duneRock(rng: () => number): VoxModel {
  const c = shuffleColor(0xc79a64, 0.15, rng)
  const s = 1.2 + rng() * 1.8
  return {
    parts: {
      base: [
        box(0, s * 0.35, 0, s * 1.6, s * 0.7, s * 1.1, c),
        box(s * 0.4, s * 0.8, 0, s * 0.8, s * 0.5, s * 0.8, shuffleColor(c, 0.1, rng)),
        box(-s * 0.2, s * 0.05, s * 0.3, s * 2.0, s * 0.1, s * 1.4, 0xd8b476),
      ],
    },
  }
}

export function coral(rng: () => number): VoxModel {
  const palette = [0xff7f6a, 0xff9fb6, 0xffb347, 0xb58cff, 0x6fe0d0]
  const c = palette[Math.floor(rng() * palette.length)]
  const base: VoxBox[] = [box(0, 0.3, 0, 2.6, 0.6, 2.2, 0xe8d8b0)]
  const branches = 3 + Math.floor(rng() * 3)
  for (let i = 0; i < branches; i++) {
    const x = (rng() - 0.5) * 2.4, z = (rng() - 0.5) * 2.0
    const h = 1.5 + rng() * 2.5
    base.push(box(x, 0.6 + h / 2, z, 0.6, h, 0.6, shuffleColor(c, 0.1, rng)))
    base.push(box(x + (rng() < 0.5 ? 0.5 : -0.5), 0.6 + h * 0.7, z, 0.9, 0.5, 0.5, c))
  }
  return { parts: { base } }
}

export function seaShell(rng: () => number): VoxModel {
  const c = shuffleColor(0xf6e2d0, 0.1, rng)
  return {
    parts: {
      base: [
        box(0, 0.35, 0, 1.8, 0.7, 1.4, c),
        box(0.5, 0.8, 0, 0.9, 0.5, 0.9, shuffleColor(0xf0b8a8, 0.1, rng)),
        box(-0.8, 0.2, 0.6, 0.6, 0.4, 0.6, 0xe8a090),
      ],
    },
  }
}

export function glowCrystal(rng: () => number, palette: number[] = [0x6ff6ff, 0xd28cff, 0x7fffc0]): VoxModel {
  const c = palette[Math.floor(rng() * palette.length)]
  const base: VoxBox[] = [box(0, 0.3, 0, 2.6, 0.6, 2.4, 0x3a3848)]
  const n = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const h = 1.6 + rng() * 3.2
    const x = (rng() - 0.5) * 1.8, z = (rng() - 0.5) * 1.6
    base.push(box(x, 0.6 + h / 2, z, 0.7 + rng() * 0.4, h, 0.7 + rng() * 0.4, c, true))
    base.push(box(x, 0.6 + h + 0.25, z, 0.4, 0.5, 0.4, 0xffffff, true))
  }
  return { parts: { base } }
}

export function glowMushroom(rng: () => number): VoxModel {
  const caps = [0x7fe8ff, 0xc9a0ff, 0x9fffb0]
  const c = caps[Math.floor(rng() * caps.length)]
  const base: VoxBox[] = []
  const n = 1 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * 3, z = (rng() - 0.5) * 3
    const h = 1.2 + rng() * 2.4
    const w = 1.4 + rng() * 1.6
    base.push(box(x, h / 2, z, 0.45, h, 0.45, 0xd8d0e8))
    base.push(box(x, h + 0.3, z, w, 0.6, w, c, true))
    base.push(box(x, h + 0.75, z, w * 0.6, 0.4, w * 0.6, shuffleColor(c, 0.1, rng), true))
  }
  return { parts: { base } }
}

export function stalagmite(rng: () => number): VoxModel {
  const c = shuffleColor(0x5a5668, 0.12, rng)
  const h = 3 + rng() * 4
  return {
    parts: {
      base: [
        box(0, h * 0.2, 0, 2.2, h * 0.4, 2.2, c),
        box(0, h * 0.55, 0, 1.4, h * 0.35, 1.4, shuffleColor(c, 0.08, rng)),
        box(0, h * 0.85, 0, 0.7, h * 0.3, 0.7, c),
      ],
    },
  }
}

export function moonRock(rng: () => number): VoxModel {
  const c = shuffleColor(0x9a96ae, 0.15, rng)
  const s = 1 + rng() * 2
  return {
    parts: {
      base: [
        box(0, s * 0.4, 0, s * 1.5, s * 0.8, s * 1.3, c),
        box(-s * 0.4, s * 0.9, s * 0.2, s * 0.7, s * 0.4, s * 0.7, shuffleColor(c, 0.12, rng)),
        box(s * 0.5, s * 0.2, -s * 0.5, s * 0.6, s * 0.4, s * 0.6, 0x6f6a86),
      ],
    },
  }
}

/** a shallow pit ringed with a lip: reads as a crater from the play camera */
export function crater(rng: () => number): VoxModel {
  const lip = shuffleColor(0x8f8aa6, 0.1, rng)
  const s = 2.2 + rng() * 1.4
  return {
    parts: {
      base: [
        box(0, 0.25, -s, s * 2.2, 0.5, 0.7, lip),
        box(0, 0.25, s, s * 2.2, 0.5, 0.7, lip),
        box(-s, 0.25, 0, 0.7, 0.5, s * 1.6, lip),
        box(s, 0.25, 0, 0.7, 0.5, s * 1.6, shuffleColor(lip, 0.08, rng)),
        box(0, 0.05, 0, s * 1.6, 0.1, s * 1.6, 0x5f5a76),
      ],
    },
  }
}

export function alienBulb(rng: () => number): VoxModel {
  const glow = rng() < 0.5 ? 0x7fffd4 : 0xff8fe0
  const stem = 0x4a5a7a
  const base: VoxBox[] = []
  const n = 2 + Math.floor(rng() * 2)
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * 2.6, z = (rng() - 0.5) * 2.6
    const h = 1.6 + rng() * 2.6
    base.push(box(x, h / 2, z, 0.35, h, 0.35, stem))
    base.push(box(x, h + 0.4, z, 0.9, 0.9, 0.9, glow, true))
  }
  return { parts: { base } }
}

export function jungleTree(rng: () => number): VoxModel {
  const trunk = 0x5f4630
  const leaf = shuffleColor(0x2f7a38, 0.25, rng)
  const h = 5 + rng() * 3
  const base: VoxBox[] = [
    box(0, h / 2, 0, 1.3, h, 1.3, trunk),
    box(-0.9, 0.6, 0.4, 1.0, 1.2, 0.8, trunk),
    box(0, h + 1.0, 0, 6.4, 1.6, 6.0, leaf),
    box(0.4, h + 2.2, -0.2, 4.2, 1.2, 4.2, shuffleColor(leaf, 0.12, rng)),
    box(-2.6, h + 0.2, 1.8, 2.2, 1.0, 2.0, shuffleColor(leaf, 0.12, rng)),
  ]
  // hanging vines
  for (let i = 0; i < 3; i++) {
    const x = (rng() - 0.5) * 5, z = (rng() - 0.5) * 5
    const len = 1.5 + rng() * 2.5
    base.push(box(x, h + 0.2 - len / 2, z, 0.25, len, 0.25, 0x3f8a3a))
  }
  return { parts: { base } }
}

export function fern(rng: () => number): VoxModel {
  const c = shuffleColor(0x4a9a44, 0.2, rng)
  const base: VoxBox[] = [box(0, 0.4, 0, 1, 0.8, 1, 0x3f7a36)]
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    base.push(box(dx * 1.4, 0.9, dz * 1.4, dx ? 2.2 : 0.7, 0.4, dz ? 2.2 : 0.7, c))
    base.push(box(dx * 2.4, 0.6, dz * 2.4, 0.8, 0.4, 0.8, shuffleColor(c, 0.1, rng)))
  }
  if (rng() < 0.4) base.push(box(0, 1.2, 0, 0.7, 0.7, 0.7, 0xf2694a))
  return { parts: { base } }
}

export function brokenPillar(rng: () => number, stone = 0xb5ad8c): VoxModel {
  const c = shuffleColor(stone, 0.08, rng)
  const h = 2 + rng() * 4
  const base: VoxBox[] = [
    box(0, 0.4, 0, 2.6, 0.8, 2.6, shuffleColor(c, 0.08, rng)),
    box(0, 0.8 + h / 2, 0, 1.7, h, 1.7, c),
    box(0.3, 0.8 + h + 0.3, 0, 1.2, 0.6, 1.4, c),
  ]
  if (rng() < 0.6) base.push(box(0, 0.8 + h * 0.6, 0.9, 1.8, 0.4, 0.2, 0x3f8a3a))
  if (rng() < 0.5) base.push(box(2.2, 0.5, 1.2, 2.4, 1.0, 1.6, c))
  return { parts: { base } }
}

export function iceSpike(rng: () => number): VoxModel {
  const c = rng() < 0.5 ? 0xbfe8ff : 0x9fd4f2
  const base: VoxBox[] = [box(0, 0.25, 0, 2.4, 0.5, 2.4, 0xe8f2f8)]
  const n = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const h = 2 + rng() * 4
    const x = (rng() - 0.5) * 1.8, z = (rng() - 0.5) * 1.8
    base.push(box(x, h / 2 + 0.4, z, 0.8, h, 0.8, c))
    base.push(box(x, h + 0.6, z, 0.4, 0.8, 0.4, 0xeaf8ff))
  }
  return { parts: { base } }
}

export function snowPine(rng: () => number): VoxModel {
  const trunk = 0x5a4632
  const leaf = shuffleColor(0x2f5a4a, 0.3, rng)
  const h = 2 + Math.floor(rng() * 2)
  const base: VoxBox[] = [box(0, h / 2, 0, 1.0, h, 1.0, trunk)]
  const tiers = 3 + Math.floor(rng() * 2)
  for (let i = 0; i < tiers; i++) {
    const w = 5.2 - i * (3.8 / tiers)
    base.push(box(0, h + 0.8 + i * 1.6, 0, w, 1.4, w, leaf))
    base.push(box(0, h + 1.6 + i * 1.6, 0, w * 0.9, 0.35, w * 0.9, 0xeef6fb))
  }
  return { parts: { base } }
}

export function lightningRod(rng: () => number): VoxModel {
  const iron = 0x4a4e58
  const h = 6 + rng() * 3
  return {
    parts: {
      base: [
        box(0, 0.5, 0, 2.2, 1.0, 2.2, 0x5a5e66),
        box(0, 1 + h / 2, 0, 0.45, h, 0.45, iron),
        box(0, 1 + h * 0.7, 0, 1.6, 0.25, 0.25, iron),
        box(0, 1 + h + 0.3, 0, 0.3, 0.6, 0.3, 0x9fdcff, true),
      ],
    },
  }
}

export function tatteredBanner(rng: () => number): VoxModel {
  const cloth = rng() < 0.5 ? 0x6a2f3a : 0x2f4a6a
  const h = 5 + rng() * 2
  return {
    parts: {
      base: [
        box(0, h / 2, 0, 0.4, h, 0.4, 0x4a3a2a),
        box(0.9, h - 1.2, 0, 1.8, 2.2, 0.2, cloth),
        box(1.3, h - 2.6, 0, 1.0, 0.8, 0.2, cloth),
        box(0, h + 0.2, 0, 0.6, 0.4, 0.6, 0xc8a24a),
      ],
    },
  }
}

export function obsidianShard(rng: () => number): VoxModel {
  const c = shuffleColor(0x2a2238, 0.2, rng)
  const h = 2 + rng() * 3.5
  return {
    parts: {
      base: [
        box(0, h / 2, 0, 1.2, h, 0.9, c, false),
        box(0.7, h * 0.35, 0.3, 0.8, h * 0.7, 0.7, shuffleColor(c, 0.1, rng)),
        box(0, h + 0.1, 0, 0.5, 0.3, 0.4, 0xffc36a, true),
      ],
    },
  }
}

export function silverTree(rng: () => number): VoxModel {
  const c = 0xcfd2e0
  const h = 4 + rng() * 3
  const base: VoxBox[] = [
    box(0, h / 2, 0, 0.9, h, 0.9, c),
    box(-1.1, h * 0.72, 0, 1.6, 0.5, 0.5, c),
    box(1.0, h * 0.9, 0.2, 1.4, 0.45, 0.45, c),
    box(-1.8, h * 0.72 + 0.8, 0, 0.45, 1.4, 0.45, c),
  ]
  for (let i = 0; i < 3; i++) base.push(box((rng() - 0.5) * 3, h * (0.7 + rng() * 0.3), (rng() - 0.5) * 2, 0.6, 0.6, 0.6, 0xffc36a, true))
  return { parts: { base } }
}

// ---------------- landmarks ----------------

export const FRONTIER_LANDMARK_SCALE: Record<string, number> = {
  pagoda: 0.17, pyramid: 0.2, windmill: 0.16, coralSpire: 0.18, crystalSpire: 0.18,
  observatory: 0.16, serpentIdol: 0.17, iceSpire: 0.19, stormSpire: 0.17, eclipseAltar: 0.17,
}

export const FRONTIER_LANDMARK_HEIGHT: Record<string, number> = {
  pagoda: 30 * 0.17, pyramid: 20 * 0.2, windmill: 30 * 0.16, coralSpire: 28 * 0.18, crystalSpire: 30 * 0.18,
  observatory: 26 * 0.16, serpentIdol: 24 * 0.17, iceSpire: 30 * 0.19, stormSpire: 34 * 0.17, eclipseAltar: 24 * 0.17,
}

export function frontierLandmark(kind: string, rng: () => number): VoxModel | null {
  const scale = FRONTIER_LANDMARK_SCALE[kind]
  const body: VoxBox[] = []
  const glow: VoxBox[] = []
  switch (kind) {
    case 'pagoda': {
      const wood = 0xb8453a, roof = 0x3a3a48, stone = 0xcfc6b4
      body.push(box(0, 1, 0, 11, 2, 11, stone))
      for (let i = 0; i < 4; i++) {
        const w = 8 - i * 1.5, y = 2 + i * 6.2
        body.push(box(0, y + 2.2, 0, w, 4.4, w, i % 2 ? 0xc95a48 : wood))
        body.push(box(0, y + 4.9, 0, w + 4.4, 1.0, w + 4.4, roof))
        body.push(box(0, y + 5.6, 0, w + 2.0, 0.6, w + 2.0, 0x4a4a5a))
        for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          body.push(box(dx * (w / 2 + 2.4), y + 5.4, dz * (w / 2 + 2.4), 0.8, 0.8, 0.8, roof))
          glow.push(box(dx * (w / 2 + 2.4), y + 4.1, dz * (w / 2 + 2.4), 0.8, 1.2, 0.8, 0xffc36a, true))
        }
      }
      body.push(box(0, 28.5, 0, 0.8, 3, 0.8, 0xd8b64a))
      break
    }
    case 'pyramid': {
      const sand = 0xd9b477
      for (let i = 0; i < 9; i++) {
        const w = 22 - i * 2.4
        body.push(box(0, 1 + i * 2.1, 0, w, 2.1, w, i % 2 ? sand : shuffleColor(sand, 0.06, rng)))
      }
      body.push(box(0, 20, 0, 2.2, 1.4, 2.2, 0xf2d27a))
      // the door, and a stripe of weathered stone
      body.push(box(0, 2.6, 11, 3.2, 5.2, 0.6, 0x6a4a2a))
      glow.push(box(0, 20.9, 0, 1.2, 0.8, 1.2, 0xfff0a0, true))
      break
    }
    case 'windmill': {
      const wall = 0xe8e0cc, roof = 0xb85a3a
      body.push(box(0, 8, 0, 7, 16, 7, wall), box(0, 17, 0, 8, 2, 8, roof), box(0, 19.5, 0, 5.4, 3, 5.4, roof),
        box(0, 21.8, 0, 2.6, 1.6, 2.6, roof), box(0, 3, 3.6, 2.4, 4, 0.4, 0x6a4a2a), box(0, 10, 3.6, 1.6, 1.8, 0.4, 0x7fc6e8))
      // sails, fixed in a cross
      const sail = 0xf4ecd8
      body.push(box(0, 16, 4.6, 1.0, 1.0, 1.4, 0x5a3a20))
      body.push(box(0, 22.5, 5.2, 2.6, 12, 0.4, sail), box(0, 9.5, 5.2, 2.6, 12, 0.4, sail))
      body.push(box(6.5, 16, 5.2, 12, 2.6, 0.4, sail), box(-6.5, 16, 5.2, 12, 2.6, 0.4, sail))
      break
    }
    case 'coralSpire': {
      const cols = [0xff7f6a, 0xff9fb6, 0xffb347]
      body.push(box(0, 1, 0, 12, 2, 10, 0xe8d8b0))
      for (let i = 0; i < 6; i++) {
        const x = (rng() - 0.5) * 8, z = (rng() - 0.5) * 6
        const h = 12 + rng() * 14
        const c = cols[i % cols.length]
        body.push(box(x, 2 + h / 2, z, 2.2, h, 2.2, c))
        body.push(box(x + 1.8, 2 + h * 0.6, z, 2.4, 1.4, 1.4, c), box(x + 2.6, 2 + h * 0.6 + 2, z, 1.2, 3, 1.2, c))
        glow.push(box(x, 2 + h + 0.6, z, 1.2, 1.2, 1.2, 0xfff0f6, true))
      }
      break
    }
    case 'crystalSpire': {
      body.push(box(0, 1.2, 0, 11, 2.4, 10, 0x3a3848), box(3, 3, 2, 4, 3, 4, 0x46445a))
      const pal = [0x6ff6ff, 0xd28cff]
      glow.push(box(0, 15, 0, 4.2, 26, 4.2, pal[0], true), box(0, 29, 0, 2.2, 3, 2.2, 0xe9fbff, true))
      glow.push(box(-3.4, 8, 1.6, 2.4, 12, 2.4, pal[1], true), box(3.6, 6, -1.4, 2.0, 9, 2.0, pal[0], true))
      glow.push(box(1.2, 4, 3.6, 1.6, 5, 1.6, pal[1], true))
      break
    }
    case 'observatory': {
      const hull = 0xc8cce0, dark = 0x4a5070
      body.push(box(0, 1.2, 0, 13, 2.4, 13, dark), box(0, 6, 0, 10, 7.2, 10, hull), box(0, 11.5, 0, 11, 3.8, 11, hull),
        box(0, 14.4, 0, 8, 2.2, 8, hull), box(0, 16.2, 0, 4.4, 1.6, 4.4, hull))
      // the telescope, raised toward the planet
      body.push({ x: 1.5, y: 17.5, z: -2.5, sx: 2.6, sy: 2.6, sz: 12, c: dark, rx: 0.6 })
      glow.push(box(0, 6, 5.05, 5, 1.2, 0.2, 0x7fe8ff, true), box(-5.05, 6, 0, 0.2, 1.2, 5, 0x7fe8ff, true))
      body.push(box(5, 20, 4, 0.4, 10, 0.4, dark))
      glow.push(box(5, 25.5, 4, 1.0, 1.0, 1.0, 0xff5a7a, true))
      break
    }
    case 'serpentIdol': {
      const stone = 0x8f9a7a, moss = 0x4f8a3f
      body.push(box(0, 1.2, 0, 12, 2.4, 10, stone), box(0, 4, 0, 9, 3.2, 8, shuffleColor(stone, 0.06, rng)))
      // a coiled body rising into a head
      body.push(box(-2.5, 8, 0, 3.4, 5, 3.4, stone), box(0, 11.5, -1, 3.4, 4, 3.4, stone), box(2.5, 15, 0, 3.4, 4, 3.4, stone))
      body.push(box(1.2, 19.5, 1.0, 5, 4, 6, stone), box(1.2, 18.2, 4.6, 4.2, 1.2, 2.4, shuffleColor(stone, 0.1, rng)))
      body.push(box(-2.5, 6, 1.8, 3.6, 0.8, 0.4, moss), box(2.5, 17, 1.8, 3.6, 0.8, 0.4, moss))
      glow.push(box(-0.4, 20.4, 4.1, 0.9, 0.9, 0.4, 0x7fff6a, true), box(2.8, 20.4, 4.1, 0.9, 0.9, 0.4, 0x7fff6a, true))
      break
    }
    case 'iceSpire': {
      body.push(box(0, 1, 0, 12, 2, 11, 0xe8f2f8))
      const ice = [0xbfe8ff, 0x9fd4f2, 0xdff4ff]
      body.push(box(0, 14, 0, 4.4, 26, 4.4, ice[0]), box(0, 28.5, 0, 2.2, 3, 2.2, ice[2]))
      body.push(box(-3.6, 9, 1, 2.8, 16, 2.8, ice[1]), box(3.4, 7, -1.5, 2.4, 12, 2.4, ice[2]), box(1.5, 5, 3.5, 2, 8, 2, ice[0]))
      glow.push(box(0, 16, 2.25, 1.2, 8, 0.1, 0x9ffff0, true))
      break
    }
    case 'stormSpire': {
      const stone = 0x5a5e66, dark = 0x3a3e46
      body.push(box(0, 1.2, 0, 12, 2.4, 12, dark))
      let w = 7.5
      for (let i = 0; i < 7; i++) {
        body.push(box(0, 3.4 + i * 3.6, 0, w, 3.6, w, i % 2 ? dark : stone))
        w = Math.max(3, w - 0.6)
      }
      body.push(box(0, 29.5, 0, 0.6, 5, 0.6, 0x4a4e58), box(0, 27.5, 0, 4.4, 0.4, 0.4, 0x4a4e58))
      glow.push(box(0, 32.4, 0, 1.2, 1.2, 1.2, 0x9fdcff, true), box(0, 14, 3.1, 1.2, 2.2, 0.2, 0xffd98f, true))
      break
    }
    case 'eclipseAltar': {
      const stone = 0x3a3350, pale = 0xcfc6b0
      body.push(box(0, 1, 0, 14, 2, 14, stone), box(0, 3, 0, 10, 2, 10, shuffleColor(stone, 0.1, rng)))
      for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        body.push(box(dx * 5.5, 10, dz * 5.5, 2.2, 16, 2.2, pale))
        glow.push(box(dx * 5.5, 18.5, dz * 5.5, 1.2, 1.0, 1.2, 0xffc36a, true))
      }
      // a black sun held in a golden ring
      body.push(box(0, 15, 0, 6, 6, 1.2, 0x0a0710))
      glow.push(box(0, 18.4, 0, 7.4, 0.8, 0.8, 0xffc36a, true), box(0, 11.6, 0, 7.4, 0.8, 0.8, 0xffc36a, true),
        box(3.4, 15, 0, 0.8, 6, 0.8, 0xffc36a, true), box(-3.4, 15, 0, 0.8, 6, 0.8, 0xffc36a, true))
      break
    }
    default:
      return null
  }
  return { parts: { body: [...body, ...glow] }, scale }
}

// ---------------- endpoints ----------------

/** portal stone and glow per Frontier theme */
export const PORTAL_PALETTE: Record<string, [number, number]> = {
  blossom: [0x6a5a66, 0xff7ab0],
  desert: [0x9a7450, 0xffa03c],
  skyreach: [0x6f7a88, 0x8f7aff],
  reef: [0x6f7f86, 0x4fe8d8],
  cavern: [0x34323f, 0x6ff6ff],
  cosmos: [0x2e2a44, 0xb37aff],
  jungle: [0x5a6a4a, 0x7fff6a],
  aurora: [0x6f8098, 0x6fffc8],
  storm: [0x3a3e46, 0x9fdcff],
  eclipse: [0x241c34, 0xffb347],
}

/** wall, wall shade and roof per Frontier theme */
export const CASTLE_PALETTE: Record<string, [number, number, number]> = {
  blossom: [0xe8e0d6, 0xc4b8ae, 0xc0485a],
  desert: [0xe2c79a, 0xc4a474, 0x3f8fa8],
  skyreach: [0xeef2f6, 0xc8d0da, 0x3f7fd0],
  reef: [0xf2ead8, 0xd6cab2, 0x2fa8a0],
  cavern: [0x8a8aa4, 0x66667e, 0x3a8fb8],
  cosmos: [0xc8cce0, 0x8f94b0, 0x6a4ad0],
  jungle: [0xb8b08f, 0x908a6e, 0x3f7a38],
  aurora: [0xdde8f2, 0xaebccc, 0x2f5a8f],
  storm: [0x8a8e96, 0x62666e, 0x5a2f3a],
  eclipse: [0xcfc6b0, 0x9a9282, 0x2a1f4a],
}

/** decoration pickers: each theme's scenery, weighted, and which props twinkle */
export interface DecorEntry { weight: number, make: (rng: () => number) => VoxModel, animated?: boolean }
