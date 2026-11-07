import { box, type VoxBox, type VoxModel } from '../voxel/builder.ts'
import { pineTree, roundTree, bush, rock, flowers } from '../voxel/models_env.ts'
import { seededRandom } from '../core/utils.ts'

/**
 * The rock the Hold stands on, shown behind the menu.
 *
 * The keep used to sit on a flat green slab in empty sky, which on a fresh
 * save meant a grey box on a green square. A floating island gives even a
 * bare keep somewhere to be: a meadow with a path up to the gate, a pond that
 * spills over the edge, and a stepped underside of earth and stone that tapers
 * to a point over the cloud sea - the same island the battles are fought on,
 * seen from the side.
 *
 * Everything here is scenery and fixed by seed, so the island is the same on
 * every boot; what changes with progress is the keep on top of it.
 */

const C = {
  grass: 0x78b04e, grassAlt: 0x6aa344, grassLight: 0x86bd58,
  dirt: 0x7a5a3a, dirtDark: 0x664a30,
  rockWarm: 0xb5a58e, rockMid: 0x9d9080, rockCool: 0x8c8794, rockDeep: 0x7a7686,
  path: 0xd2b98a, pathAlt: 0xc4a978,
  water: 0x5fb3db, waterDeep: 0x3f8fc0, foam: 0xf2f9fc, fall: 0x9ad6f0, fallLight: 0xd8f1fb,
  root: 0x5b4128, vine: 0x4f8a3c,
}

/** cell size, in voxel units */
const S = 2
/** island half-extents, in voxel units */
const RX = 22, RZ = 20

/** where the keep and its approach stand; scenery keeps out */
const keepZone = (x: number, z: number) => Math.abs(x) < 15 && z > -10 && z < 12.5
const pathZone = (x: number, z: number) => Math.abs(x - pathX(z)) < 3.2 && z > 6

/** the path wanders a little on its way from the gate to the near edge */
function pathX(z: number): number { return Math.sin(z * 0.16) * 2.2 }

/** the pond at the island's left shoulder, and the stream to the edge */
const POND = { x: -15, z: -6, rx: 4.6, rz: 3.6 }

/** place another model's boxes into this one, scaled and moved */
function put(into: VoxBox[], m: VoxModel, x: number, y: number, z: number, s: number): void {
  for (const part of Object.values(m.parts)) for (const b of part) {
    into.push({ ...b, x: x + b.x * s, y: y + b.y * s, z: z + b.z * s, sx: b.sx * s, sy: b.sy * s, sz: b.sz * s })
  }
}

export function holdIslandModel(): VoxModel {
  const rng = seededRandom(0x40d1)
  const top: VoxBox[] = []
  const under: VoxBox[] = []
  const water: VoxBox[] = []
  const scenery: VoxBox[] = []
  const hash = (x: number, z: number) => {
    const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
    return h - Math.floor(h)
  }

  // the outline: an ellipse with a few lobes, so no edge runs straight for long
  const reach = (a: number) => 1 + 0.07 * Math.sin(a * 3 + 0.6) + 0.05 * Math.sin(a * 5 + 2.1) + 0.03 * Math.sin(a * 9 + 4)

  const cells: { x: number, z: number, e: number }[] = []
  for (let x = -RX - S; x <= RX + S; x += S) {
    for (let z = -RZ - S; z <= RZ + S; z += S) {
      const nx = x / RX, nz = z / RZ
      const r = Math.hypot(nx, nz), lim = reach(Math.atan2(nz, nx))
      if (r > lim) continue
      cells.push({ x, z, e: 1 - r / lim })
    }
  }

  for (const { x, z, e } of cells) {
    const h = hash(x, z)
    const inPond = ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < 1
    const stream = z > POND.z - 2.5 && z < POND.z + 2.5 && x < POND.x - 2
    // the rim steps down a block here and there, so the edge is not a ruler line
    const lip = e < 0.09 && h < 0.45 && !stream ? -1 : 0
    const topY = lip

    if (inPond || stream) {
      water.push(box(x, -0.7, z, S, 0.6, S, (x + z) % 4 === 0 ? C.waterDeep : C.water))
      under.push(box(x, -1.6, z, S, 1.2, S, C.dirtDark))
    } else {
      const g = pathZone(x, z) && Math.abs(x - pathX(z)) < 1.6 ? null
        : h < 0.18 ? C.grassLight : (Math.round(x / S) + Math.round(z / S)) % 2 ? C.grass : C.grassAlt
      top.push(box(x, topY - 0.6, z, S, 1.2, S, g ?? C.dirt))
    }

    // earth, then stone, deepening toward the middle: an upturned, stepped cone
    const depth = 3 + Math.pow(e, 0.8) * 21 + h * 2.5
    const dirtD = 2.4 + h * 1.6
    const warmD = depth * (0.42 + h * 0.12)
    let y = topY - 1.2
    under.push(box(x, y - dirtD / 2, z, S, dirtD, S, h < 0.5 ? C.dirt : C.dirtDark))
    y -= dirtD
    const bands = [
      { d: Math.max(1, warmD - dirtD), c: h < 0.5 ? C.rockWarm : C.rockMid },
      { d: Math.max(1, depth * 0.3), c: h < 0.35 ? C.rockMid : C.rockCool },
      { d: Math.max(1, depth - warmD - depth * 0.3), c: C.rockDeep },
    ]
    for (const b of bands) {
      if (y <= topY - depth) break
      const d = Math.min(b.d, y - (topY - depth))
      under.push(box(x, y - d / 2, z, S, d, S, b.c))
      y -= d
    }
    // a few short drips under the deep middle
    if (e > 0.5 && h > 0.9) under.push(box(x, topY - depth - 1.2, z, S * 0.55, 2.4, S * 0.55, C.rockDeep))

    // roots and creepers over the rim
    if (e < 0.08 && h > 0.72 && !stream) {
      const len = 2 + h * 4
      under.push(box(x + (h - 0.8) * 3, topY - 1.2 - len / 2, z + (0.5 - h) * 2, 0.35, len, 0.35, h > 0.86 ? C.vine : C.root))
    }
  }

  // the pond's lip of stones and a few reeds
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3
    const x = POND.x + Math.cos(a) * (POND.rx + 0.6), z = POND.z + Math.sin(a) * (POND.rz + 0.6)
    if (x < POND.x - 3 && Math.abs(z - POND.z) < 2) continue
    scenery.push(box(x, 0.25, z, 0.9 + rng() * 0.5, 0.5, 0.8 + rng() * 0.5, i % 2 ? C.rockWarm : C.rockMid))
  }
  for (let i = 0; i < 5; i++) {
    scenery.push(box(POND.x + 2 + rng() * 2.5, 0.9, POND.z - 3.2 + rng() * 1.4, 0.18, 1.8 + rng(), 0.18, C.vine))
  }

  // the waterfall: a wide sheet off the left edge, streaked, breaking up into
  // spray before it reaches the island's point
  const edgeX = cells.filter(c => Math.abs(c.z - POND.z) < 1.5).reduce((m, c) => Math.min(m, c.x), 0) - S / 2
  const fallX = edgeX - 0.45
  let fy = -0.3, fw = 3.6
  for (let i = 0; i < 5; i++) {
    const len = 3.4 + i * 0.6
    water.push(box(fallX - i * 0.14, fy - len / 2, POND.z, 0.8, len, fw, C.fall))
    // bright streaks running down the face
    for (const off of [-0.32, 0.05, 0.36]) {
      if (rng() < 0.3) continue
      const sl = len * (0.5 + rng() * 0.5)
      water.push(box(fallX - i * 0.14 - 0.42, fy - sl / 2 - rng() * (len - sl), POND.z + off * fw, 0.1, sl, 0.32, C.fallLight))
    }
    fy -= len
    fw += 0.35
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 8
    water.push(box(fallX - 0.6 - t * 0.6 + (rng() - 0.5) * 0.6, fy - t * 4.5, POND.z + (rng() - 0.5) * fw, 0.7 - t * 0.35, 0.7 - t * 0.35, 0.7 - t * 0.35, C.foam))
  }
  // where the stream tips over the lip, it whitens
  water.push(box(fallX + 0.5, -0.25, POND.z, 1.4, 0.5, 3.8, C.foam))
  for (let i = 0; i < 3; i++) water.push(box(fallX - 0.5, -1.2 - i * 0.9, POND.z + (rng() - 0.5) * 2.6, 0.6, 0.5, 0.9, C.foam))

  // the path from the gate to the near edge, in worn flags
  for (let z = 8; z < RZ - 1; z += 1.8) {
    const x = pathX(z)
    scenery.push(box(x - 0.45, 0.06, z, 1.5, 0.14, 1.5, Math.round(z) % 2 ? C.path : C.pathAlt))
    scenery.push(box(x + 0.85, 0.06, z + 0.9, 1.1, 0.14, 1.1, C.pathAlt))
  }

  // trees, bushes, rocks and flowers around the shoulders of the island
  const spots: [number, number][] = []
  const free = (x: number, z: number, gap: number) =>
    !keepZone(x, z) && !pathZone(x, z)
    && ((x - POND.x) / (POND.rx + 2.5)) ** 2 + ((z - POND.z) / (POND.rz + 2.5)) ** 2 > 1
    && (x / (RX - 3)) ** 2 + (z / (RZ - 3)) ** 2 < 1
    && spots.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > gap)
  let tries = 0
  // trees stand behind the keep and off to its right, never between it and the view
  while (spots.length < 11 && tries++ < 800) {
    const x = (rng() * 2 - 1) * RX, z = (rng() * 2 - 1) * RZ
    if (!(z < -6 || x > 13) || !free(x, z, 5.5)) continue
    spots.push([x, z])
    const kind = rng()
    if (kind < 0.55) put(scenery, pineTree(rng), x, 0, z, 0.5 + rng() * 0.2)
    else put(scenery, roundTree(rng), x, 0, z, 0.55 + rng() * 0.15)
  }
  tries = 0
  let small = 0
  while (small < 14 && tries++ < 600) {
    const x = (rng() * 2 - 1) * RX, z = (rng() * 2 - 1) * RZ
    if (!free(x, z, 2.6)) continue
    spots.push([x, z]); small++
    const kind = rng()
    if (kind < 0.35) put(scenery, bush(rng), x, 0, z, 0.7)
    else if (kind < 0.6) put(scenery, rock(rng), x, 0, z, 0.55 + rng() * 0.3)
    else put(scenery, flowers(rng), x, 0, z, 0.9)
  }

  return { parts: { top, under, water, scenery }, scale: 0.1 }
}
