import { VoxModel, VoxBox, box } from './builder.ts'
import { shuffleColor } from '../core/utils.ts'

/** Environment & projectile models. Decorations take an rng for variety. */

export function pineTree(rng: () => number): VoxModel {
  const trunk = 0x6d4c28
  const leaf = shuffleColor(0x3f7a3a, 0.5, rng)
  const h = 2 + Math.floor(rng() * 3)
  const base: VoxBox[] = [box(0, h / 2, 0, 1.1, h, 1.1, trunk)]
  const tiers = 3 + Math.floor(rng() * 2)
  for (let i = 0; i < tiers; i++) {
    const w = 5.5 - i * (4 / tiers)
    base.push(box(0, h + 0.9 + i * 1.7, 0, w, 1.8, w, shuffleColor(leaf, 0.15, rng)))
  }
  base.push(box(0, h + 0.9 + tiers * 1.7, 0, 1, 1.4, 1, leaf))
  return { parts: { base } }
}

export function roundTree(rng: () => number): VoxModel {
  const trunk = 0x7a5a30
  const leaf = shuffleColor(0x5a9a42, 0.5, rng)
  const h = 2.5 + rng() * 2
  const base: VoxBox[] = [
    box(0, h / 2, 0, 1.3, h, 1.3, trunk),
    box(0, h + 1.8, 0, 4.6, 3.6, 4.6, leaf),
    box(0, h + 3.9, 0, 3.2, 1.4, 3.2, shuffleColor(leaf, 0.2, rng)),
    box(1.6, h + 1.2, 1.6, 2.2, 2.0, 2.2, shuffleColor(leaf, 0.2, rng)),
    box(-1.7, h + 2.6, -1.2, 2.0, 1.8, 2.0, shuffleColor(leaf, 0.2, rng)),
  ]
  return { parts: { base } }
}

export function deadTree(rng: () => number): VoxModel {
  const c = 0x4a3b30
  const h = 4 + rng() * 3
  const base: VoxBox[] = [
    box(0, h / 2, 0, 1.0, h, 1.0, c),
    box(-1.2, h * 0.7, 0, 1.6, 0.6, 0.6, c),
    box(1.0, h * 0.9, 0.3, 1.4, 0.5, 0.5, shuffleColor(c, 0.2, rng)),
    box(-1.9, h * 0.7 + 0.8, 0, 0.5, 1.4, 0.5, c),
  ]
  return { parts: { base } }
}

export function rock(rng: () => number): VoxModel {
  const c = shuffleColor(0x8d8e96, 0.3, rng)
  const s = 1.2 + rng() * 2.2
  const base: VoxBox[] = [
    box(0, s * 0.4, 0, s * 1.4, s * 0.8, s * 1.2, c),
    box(s * 0.5, s * 0.75, s * 0.3, s * 0.7, s * 0.7, s * 0.6, shuffleColor(c, 0.15, rng)),
    box(-s * 0.5, s * 0.3, -s * 0.3, s * 0.8, s * 0.6, s * 0.7, shuffleColor(c, 0.15, rng)),
  ]
  return { parts: { base } }
}

export function bush(rng: () => number): VoxModel {
  const c = shuffleColor(0x4f8a3c, 0.4, rng)
  return {
    parts: {
      base: [
        box(0, 0.9, 0, 2.6, 1.8, 2.6, c),
        box(1.0, 0.7, 0.8, 1.4, 1.4, 1.4, shuffleColor(c, 0.2, rng)),
        box(-1.0, 0.6, -0.6, 1.3, 1.2, 1.3, shuffleColor(c, 0.2, rng)),
      ],
    },
  }
}

export function flowers(rng: () => number): VoxModel {
  const colors = [0xe86a8a, 0xf2d54a, 0xffffff, 0xb37aff, 0xff8c42]
  const base: VoxBox[] = []
  const n = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * 4, z = (rng() - 0.5) * 4
    base.push(box(x, 0.5, z, 0.28, 1.0, 0.28, 0x4f8a3c))
    base.push(box(x, 1.15, z, 0.7, 0.55, 0.7, colors[Math.floor(rng() * colors.length)]))
  }
  return { parts: { base } }
}

export function lampPost(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.3, 0, 1.4, 0.6, 1.4, 0x55575e),
        box(0, 2.6, 0, 0.45, 4.6, 0.45, 0x3a3c42),
        box(0, 5.2, 0, 1.3, 1.5, 1.3, 0x3a3c42),
        box(0, 5.15, 0, 1.0, 1.1, 1.0, 0xffd98f, true),
        box(0, 6.1, 0, 0.8, 0.4, 0.8, 0x3a3c42),
      ],
    },
  }
}

export function crystalShard(rng: () => number, palette: [number, number] = [0xff7a5a, 0xffa03c]): VoxModel {
  const c = rng() > 0.5 ? palette[0] : palette[1]
  const s = 1 + rng() * 1.4
  return {
    parts: {
      base: [
        box(0, s * 1.1, 0, s * 0.8, s * 2.2, s * 0.8, c, true),
        box(s * 0.6, s * 0.6, s * 0.3, s * 0.5, s * 1.2, s * 0.5, c, true),
        box(0, s * 0.2, 0, s * 1.8, s * 0.4, s * 1.8, 0x4a3b38),
      ],
    },
  }
}

export function stump(rng: () => number): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0.6, 0, 2.0, 1.2, 2.0, 0x6d4c28),
        box(0, 1.25, 0, 1.7, 0.2, 1.7, shuffleColor(0xb59a6a, 0.2, rng)),
      ],
    },
  }
}

/** Where enemies come from: a dark cave arch with an ominous glow. */
export function spawnPortal(theme: string): VoxModel {
  const stoneC = theme === 'ember' ? 0x4a3535 : theme === 'winter' ? 0x6a7285
    : theme === 'swamp' ? 0x4f5a42 : theme === 'void' ? 0x3a3350 : 0x5d5f52
  const glowC = theme === 'ember' ? 0xff5a3c : theme === 'void' ? 0xdd6bff : 0x9f5aff
  const base: VoxBox[] = [
    box(-3.2, 2.6, 0, 2.2, 5.2, 3.6, stoneC),
    box(3.2, 2.6, 0, 2.2, 5.2, 3.6, stoneC),
    box(0, 5.6, 0, 8.8, 2.2, 3.8, stoneC),
    box(0, 7.0, 0, 6.4, 1.2, 3.0, stoneC),
    box(-3.6, 5.0, 1.4, 1.0, 1.6, 1.0, stoneC),
    box(3.6, 5.0, 1.4, 1.0, 1.6, 1.0, stoneC),
    // dark maw + glow
    box(0, 2.2, -0.4, 4.4, 4.4, 2.4, 0x14121c),
    box(0, 2.2, -1.2, 3.6, 3.6, 0.5, glowC, true),
    // skull totem
    box(0, 8.0, 0.5, 1.4, 1.4, 1.2, 0xd8d4c4),
    box(-0.32, 8.1, 1.12, 0.32, 0.4, 0.14, 0x14121c),
    box(0.32, 8.1, 1.12, 0.32, 0.4, 0.14, 0x14121c),
  ]
  return { parts: { base } }
}

/** What you defend: a small keep with banners. */
export function exitCastle(theme: string): VoxModel {
  const wallC = theme === 'ember' ? 0x8f8378 : theme === 'void' ? 0x9a92b5 : 0xb8bfc9
  const wallD = theme === 'ember' ? 0x6b6055 : theme === 'void' ? 0x6f688a : 0x8f96a3
  const roofC = theme === 'winter' ? 0x37548f : theme === 'ember' ? 0x8f2f2f
    : theme === 'swamp' ? 0x4a7a3f : theme === 'void' ? 0x6f3aaf : 0x3d6fb8
  const base: VoxBox[] = [
    // gatehouse
    box(0, 3.4, 0, 9, 6.8, 5, wallC),
    box(0, 2.2, 2.6, 3.4, 4.4, 0.6, 0x3a2e1f),           // gate
    box(0, 2.2, 2.95, 2.8, 3.8, 0.2, 0x584a33),
    box(0, 4.9, 2.6, 4.2, 0.9, 0.5, wallD),               // arch
    // towers
    box(-5.4, 4.4, 0, 3.4, 8.8, 3.4, wallD),
    box(5.4, 4.4, 0, 3.4, 8.8, 3.4, wallD),
    box(-5.4, 10.2, 0, 4.2, 2.6, 4.2, roofC),
    box(-5.4, 12.2, 0, 2.6, 1.6, 2.6, roofC),
    box(5.4, 10.2, 0, 4.2, 2.6, 4.2, roofC),
    box(5.4, 12.2, 0, 2.6, 1.6, 2.6, roofC),
    // battlements on gatehouse
    box(-3.2, 7.4, 0, 1.2, 1.2, 5, wallD),
    box(0, 7.4, 0, 1.2, 1.2, 5, wallD),
    box(3.2, 7.4, 0, 1.2, 1.2, 5, wallD),
    // windows
    box(-5.4, 6.4, 1.8, 0.9, 1.4, 0.2, 0xffd98f, true),
    box(5.4, 6.4, 1.8, 0.9, 1.4, 0.2, 0xffd98f, true),
    // flag poles
    box(-5.4, 14.2, 0, 0.3, 2.6, 0.3, 0x3a2e1f),
    box(5.4, 14.2, 0, 0.3, 2.6, 0.3, 0x3a2e1f),
  ]
  const flag: VoxBox[] = [
    box(-4.6, 14.9, 0, 1.5, 1.0, 0.14, 0xd8b64a),
    box(6.2, 14.9, 0, 1.5, 1.0, 0.14, 0xd8b64a),
  ]
  return { parts: { base, flag }, pivots: { flag: [0, 14.9, 0] } }
}

export function cloud(rng: () => number): VoxModel {
  const c = 0xffffff
  const base: VoxBox[] = [box(0, 0, 0, 6 + rng() * 6, 1.6, 3.5 + rng() * 3, c)]
  const n = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < n; i++) {
    base.push(box((rng() - 0.5) * 7, 0.9 + rng() * 0.8, (rng() - 0.5) * 3, 2.5 + rng() * 3, 1.4, 2 + rng() * 2, c))
  }
  return { parts: { base } }
}

// ---------------- projectiles ----------------

export function arrowProjectile(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0, 0.1, 0.16, 0.16, 2.4, 0x8a6a3c),
        box(0, 0, 1.4, 0.3, 0.3, 0.5, 0xc8cdd6),
        box(0, 0, -1.0, 0.4, 0.4, 0.4, 0xe8e4d4),
      ],
    },
  }
}

export function boltProjectile(color: number): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0, 0, 0.9, 0.9, 0.9, color, true),
        box(0, 0, -0.8, 0.55, 0.55, 0.9, color, true),
        box(0, 0, -1.5, 0.32, 0.32, 0.7, 0xffffff, true),
      ],
    },
  }
}

export function bombProjectile(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0, 0, 1.5, 1.5, 1.5, 0x2f333d),
        box(0, 0.9, 0, 0.5, 0.4, 0.5, 0x55575e),
        box(0, 1.3, 0, 0.22, 0.5, 0.22, 0xffa03c, true),
      ],
    },
  }
}

export function meteorProjectile(): VoxModel {
  return {
    parts: {
      base: [
        box(0, 0, 0, 2.6, 2.6, 2.6, 0x4a3535),
        box(0.9, 0.9, 0, 1.4, 1.4, 1.4, 0x38302a),
        box(-0.6, -0.6, 0.8, 1.2, 1.2, 1.2, 0xff5a3c, true),
        box(0.4, -0.9, -0.6, 1.0, 1.0, 1.0, 0xffa03c, true),
      ],
    },
  }
}
