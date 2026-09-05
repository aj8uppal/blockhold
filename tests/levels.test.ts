import { deriveEarthworkSpots } from '../src/game/earthworks.ts'
import { describe, expect, it } from 'vitest'
import { enemyDefs } from '../src/game/enemyDefs.ts'
import { levels } from '../src/game/levels.ts'
import { REACTION_RADIUS } from '../src/game/towers.ts'
import { buildPaths, gridToWorld } from '../src/game/path.ts'
import { Terrain } from '../src/game/terrain.ts'
import type { Rect } from '../src/game/types.ts'

function expectRectInBounds(rect: Rect, width: number, height: number): void {
  const [c0, r0, c1, r1] = rect
  expect(c0).toBeGreaterThanOrEqual(0)
  expect(r0).toBeGreaterThanOrEqual(0)
  expect(c1).toBeGreaterThanOrEqual(c0)
  expect(r1).toBeGreaterThanOrEqual(r0)
  expect(c1).toBeLessThan(width)
  expect(r1).toBeLessThan(height)
}

function rectContains(rect: Rect, c: number, r: number): boolean {
  const [c0, r0, c1, r1] = rect
  return c >= c0 && c <= c1 && r >= r0 && r <= r1
}

describe('level data', () => {
  it('uses only axis-aligned lane segments', () => {
    for (const level of levels) {
      for (const lane of level.lanes) {
        for (let i = 1; i < lane.length; i++) {
          const [c0, r0] = lane[i - 1]
          const [c1, r1] = lane[i]
          expect(c0 === c1 || r0 === r1, `${level.id} lane segment ${i - 1}-${i}`).toBe(true)
        }
      }
    }
  })

  it('keeps every lane waypoint inside the grid', () => {
    for (const level of levels) {
      for (const lane of level.lanes) {
        for (const [c, r] of lane) {
          expect(c, `${level.id} waypoint column`).toBeGreaterThanOrEqual(0)
          expect(c, `${level.id} waypoint column`).toBeLessThan(level.width)
          expect(r, `${level.id} waypoint row`).toBeGreaterThanOrEqual(0)
          expect(r, `${level.id} waypoint row`).toBeLessThan(level.height)
        }
      }
    }
  })

  it('does not place plots on rasterized road cells', () => {
    for (const level of levels) {
      const { roadCells } = buildPaths(level)
      for (const [c, r] of level.plots) {
        expect(roadCells.has(`${c},${r}`), `${level.id} plot ${c},${r}`).toBe(false)
      }
    }
  })

  it('places every trap spot on a rasterized road cell', () => {
    for (const level of levels) {
      const { roadCells } = buildPaths(level)
      for (const [c, r] of level.trapSpots ?? []) {
        expect(roadCells.has(`${c},${r}`), `${level.id} trap ${c},${r}`).toBe(true)
      }
    }
  })

  it('does not place trap spots on plots', () => {
    for (const level of levels) {
      const plotCells = new Set(level.plots.map(([c, r]) => `${c},${r}`))
      for (const [c, r] of level.trapSpots ?? []) {
        expect(plotCells.has(`${c},${r}`), `${level.id} trap ${c},${r}`).toBe(false)
      }
    }
  })

  it('references only defined enemies in waves', () => {
    for (const level of levels) {
      for (const wave of level.waves) {
        for (const group of wave.groups) {
          expect(enemyDefs.has(group.enemy), `${level.id} enemy ${group.enemy}`).toBe(true)
        }
      }
    }
  })

  it('separates surge waves with at least one non-surge wave', () => {
    for (const level of levels) {
      let previousSurge = -2
      for (let i = 0; i < level.waves.length; i++) {
        if (!level.waves[i].surge) continue
        expect(i - previousSurge, `${level.id} surge wave ${i + 1}`).toBeGreaterThan(1)
        previousSurge = i
      }
    }
  })

  it('converges every Shattered Crown lane on the same final waypoint', () => {
    const level = levels.find(level => level.id === 'shatteredcrown')
    expect(level).toBeDefined()
    if (!level) throw new Error('missing shatteredcrown level')

    expect(level.lanes).toHaveLength(3)
    const finalWaypoint = level.lanes[0][level.lanes[0].length - 1]
    for (const lane of level.lanes) {
      expect(lane[lane.length - 1]).toEqual(finalWaypoint)
    }
  })

  it('keeps water, hill, and void rectangles inside the grid', () => {
    for (const level of levels) {
      for (const rect of [...level.water, ...level.hills, ...level.voids]) {
        expectRectInBounds(rect, level.width, level.height)
      }
    }
  })

  it('does not place plots in water or void rectangles', () => {
    for (const level of levels) {
      const blocked = [...level.water, ...level.voids]
      for (const [c, r] of level.plots) {
        expect(blocked.some(rect => rectContains(rect, c, r)), `${level.id} plot ${c},${r}`).toBe(false)
      }
    }
  })
})

describe('earthworks', () => {
  /**
   * Earthworks are derived from each map's own shape rather than authored, so
   * a map that drifts could silently end up with nowhere to dig. Both verbs
   * have to be available on every board or the mechanic is dead content -
   * exactly what happened to tower adjacency with too small a radius.
   */
  it('offers somewhere to cut the road on every map', () => {
    for (const lvl of levels) {
      const paths = buildPaths(lvl)
      const road = paths.roadCells
      const kindOf = (c: number, r: number): string => {
        if (c < 0 || r < 0 || c >= lvl.width || r >= lvl.height) return 'void'
        if (lvl.voids.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)) return 'void'
        if (road.has(`${c},${r}`)) return 'road'
        if (lvl.plots.some(([pc, pr]) => pc === c && pr === r)) return 'plot'
        if (lvl.water.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)) return 'water'
        if (lvl.hills.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)) return 'hill'
        return 'grass'
      }
      const isTrap = (c: number, r: number) => (lvl.trapSpots ?? []).some(([tc, tr]) => tc === c && tr === r)
      const spots = deriveEarthworkSpots(lvl, kindOf, isTrap)
      // raising happens on the foundations themselves now; the only derived sites are cuttings
      expect(spots.every(s => s.kind === 'cutting'), `${lvl.id} still derives a rampart site`).toBe(true)
      expect(spots.some(s => s.kind === 'cutting'), `${lvl.id} has nowhere to cut the road`).toBe(true)
    }
  })

  it('never puts a cutting where a trap already goes', () => {
    const lvl = levels.find(l => (l.trapSpots ?? []).length > 0)!
    const paths = buildPaths(lvl)
    const isTrap = (c: number, r: number) => (lvl.trapSpots ?? []).some(([tc, tr]) => tc === c && tr === r)
    const kindOf = (c: number, r: number) => paths.roadCells.has(`${c},${r}`) ? 'road' : 'grass'
    for (const s of deriveEarthworkSpots(lvl, kindOf, isTrap)) {
      if (s.kind === 'cutting') expect(isTrap(s.cell[0], s.cell[1])).toBe(false)
    }
  })
})

describe('map set-pieces', () => {
  /**
   * A landmark is deliberately oversized. Dropped on a road, a foundation or
   * open water it does not read as scenery, it reads as a bug - and seven of
   * the first placements did exactly that before this test existed.
   */
  it('never stands a landmark on road, plot, water or void', () => {
    for (const lvl of levels) {
      const paths = buildPaths(lvl)
      for (const [c, r, kind] of lvl.landmarks ?? []) {
        const onRoad = paths.roadCells.has(`${c},${r}`)
        const onPlot = lvl.plots.some(([pc, pr]) => pc === c && pr === r)
        const inRect = (rects: number[][]) =>
          rects.some(([a, b, x, y]) => c >= a && c <= x && r >= b && r <= y)
        expect(onRoad, `${lvl.id} ${kind} on road`).toBe(false)
        expect(onPlot, `${lvl.id} ${kind} on plot`).toBe(false)
        expect(inRect(lvl.water), `${lvl.id} ${kind} in water`).toBe(false)
        expect(inRect(lvl.voids), `${lvl.id} ${kind} over the void`).toBe(false)
      }
    }
  })

  it('escalates terrain drama through the campaign', () => {
    const drama = levels.map(l => (l.landmarks?.length ?? 0) + (l.plateaus?.length ?? 0))
    const early = drama.slice(0, 3).reduce((a, b) => a + b, 0)
    const late = drama.slice(-3).reduce((a, b) => a + b, 0)
    expect(late, 'later maps should be more dramatic than earlier ones').toBeGreaterThan(early)
  })

  it('keeps plateaus inside their map', () => {
    for (const lvl of levels) {
      for (const [c0, r0, c1, r1, h] of lvl.plateaus ?? []) {
        expect(c0).toBeGreaterThanOrEqual(0)
        expect(r0).toBeGreaterThanOrEqual(0)
        expect(c1).toBeLessThan(lvl.width)
        expect(r1).toBeLessThan(lvl.height)
        expect(h).toBeGreaterThan(0)
      }
    }
  })

  /**
   * Tower adjacency is a real mechanic, and it has died twice: once because
   * its radius was smaller than the gap between plots, and again when the
   * later boards grew and scaled every plot apart. Both times it became dead
   * content that no player could ever trigger. Each map has to keep enough
   * neighbouring foundations for the mechanic to exist at all.
   */
  it('keeps tower adjacency reachable on every map', () => {
    for (const lvl of levels) {
      let pairs = 0
      for (let i = 0; i < lvl.plots.length; i++) {
        for (let j = i + 1; j < lvl.plots.length; j++) {
          const d = Math.hypot(lvl.plots[i][0] - lvl.plots[j][0], lvl.plots[i][1] - lvl.plots[j][1])
          if (d <= REACTION_RADIUS) pairs++
        }
      }
      expect(pairs, `${lvl.id} has no adjacent foundations`).toBeGreaterThanOrEqual(4)
    }
  })

  /** high ground is only a mechanic if foundations actually stand on it */
  it('puts foundations on the high ground it authors', () => {
    const covered = levels.map(lvl => {
      const rects = (lvl.plateaus ?? []).map(([a, b, x, y]) => [a, b, x, y])
      return lvl.plots.filter(([c, r]) =>
        rects.some(([a, b, x, y]) => c >= a && c <= x && r >= b && r <= y)).length
    })
    for (const [i, lvl] of levels.entries()) {
      if ((lvl.plateaus?.length ?? 0) === 0) continue
      expect(covered[i], `${lvl.id} raises ground no tower can use`).toBeGreaterThan(0)
    }
    const early = covered.slice(0, 3).reduce((a, b) => a + b, 0)
    const late = covered.slice(-3).reduce((a, b) => a + b, 0)
    expect(late, 'later maps should offer more high ground').toBeGreaterThan(early)
  })

  /** later boards are meant to be bigger and longer walks, not just busier */
  it('grows the board through the campaign', () => {
    const area = levels.map(l => l.width * l.height)
    const early = Math.max(...area.slice(0, 3))
    const late = Math.min(...area.slice(-3))
    expect(late, 'late maps should outgrow early ones').toBeGreaterThan(early)
  })

  /**
   * A set-piece is tall, and the camera looks down at the board - so anything
   * near the rim projects up past the frame the camera fitted and renders half
   * off-screen, which reads as a clipping bug rather than scenery. Two cells of
   * margin is what it takes for the tallest of them to stay fully visible.
   */
  it('keeps landmarks off the outer ring', () => {
    for (const lvl of levels) {
      for (const [c, r, kind] of lvl.landmarks ?? []) {
        const margin = Math.min(c, r, lvl.width - 1 - c, lvl.height - 1 - r)
        expect(margin, `${lvl.id} ${kind} at [${c},${r}] hugs the border`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('raised ground', () => {
  /**
   * Enemies ride a flat rail and the hero walks at ground level, so a road
   * lifted onto a plateau puts both inside the hillside - Veilscar raised
   * fourteen road cells to 1.8 and the whole column walked through it. Roads
   * are carved through raised ground, never ramped over it.
   */
  it('never raises a road cell', () => {
    for (const lvl of levels) {
      if (!(lvl.plateaus ?? []).length) continue
      const terrain = new Terrain(lvl, buildPaths(lvl))
      for (const [c0, r0, c1, r1] of lvl.plateaus ?? []) {
        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            if (!terrain.paths.roadCells.has(`${c},${r}`)) continue
            expect(terrain.plateauAt(c, r), `${lvl.id} raised road [${c},${r}]`).toBe(0)
            expect(terrain.cellTop(c, r), `${lvl.id} road [${c},${r}] off the ground`).toBe(0)
          }
        }
      }
    }
  })

  /**
   * Raised ground has to stay something a unit stands *on*.
   *
   * This was capped at a 0.35 shelf when plateaus were lifting the roads
   * themselves and burying whatever walked there. Both causes are fixed - a
   * road is never raised, and every ground unit now takes its height from the
   * terrain - so real terraces are allowed again. The ceiling is only here to
   * keep a plateau from becoming a wall taller than the things on it.
   */
  it('keeps raised ground to something a unit can stand on', () => {
    for (const lvl of levels) {
      for (const [, , , , h] of lvl.plateaus ?? []) {
        expect(h, `${lvl.id} plateau is a wall at ${h}`).toBeLessThanOrEqual(2)
      }
    }
  })
})

describe('lane coverage', () => {
  /**
   * Every road has to be defensible. A lane with only a handful of plots in
   * reach cannot be held however well the player plays, and growing the boards
   * is exactly the kind of change that could quietly starve one - Veilscar has
   * three roads and twenty foundations, but they are not evenly shared.
   */
  it('gives every lane enough foundations to hold it', () => {
    const REACH = 3.6   // a mid-tier tower
    for (const lvl of levels) {
      const paths = buildPaths(lvl)
      const perLane = paths.lanes.map(() => 0)
      for (const [c, r] of lvl.plots) {
        const [x, z] = gridToWorld(c, r, lvl.width, lvl.height)
        paths.lanes.forEach((lane, i) => {
          if (lane.distanceToPath(x, z) <= REACH) perLane[i]++
        })
      }
      perLane.forEach((n, i) => {
        expect(n, `${lvl.id} lane ${i} has only ${n} plots in reach`).toBeGreaterThanOrEqual(6)
      })
    }
  })
})
