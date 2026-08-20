import { describe, expect, it } from 'vitest'
import { enemyDefs } from '../src/game/enemyDefs.ts'
import { levels } from '../src/game/levels.ts'
import { buildPaths } from '../src/game/path.ts'
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
