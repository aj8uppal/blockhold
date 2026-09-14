import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { frontierLevels } from '../src/game/frontier.ts'
import { levelById, levels } from '../src/game/levels.ts'
import { LanePath, buildPaths, gridToWorld, rampHeight } from '../src/game/path.ts'
import { Terrain } from '../src/game/terrain.ts'
import type { LevelDef } from '../src/game/types.ts'

/**
 * Roads that climb. The Frontier boards give lane waypoints a height, and
 * everything that stands on a road - enemies, traps, the keep, the hero -
 * reads it from the same two places: the lane's own sample, and the terrain's
 * surface under a point. These hold the two together, and hold every
 * campaign board to exactly the flat roads it has always had.
 */
describe('ramp heights', () => {
  it('holds level landings for half a cell around each waypoint and ramps straight between', () => {
    expect(rampHeight(0, 1, 0, 4)).toBe(0)
    expect(rampHeight(0, 1, 0.5, 4)).toBe(0)
    expect(rampHeight(0, 1, 2, 4)).toBeCloseTo(0.5)
    expect(rampHeight(0, 1, 3.5, 4)).toBe(1)
    expect(rampHeight(0, 1, 4, 4)).toBe(1)
    expect(rampHeight(0.7, 0.7, 2.2, 5)).toBe(0.7)
  })

  it('samples a lane at its waypoint heights, flat through corners, and never jumps', () => {
    const pts: [number, number, number][] = [[0, 0, 0], [4, 0, 0], [4, 4, 1.2], [8, 4, 1.2]]
    const lane = new LanePath(pts.map(([c, r]) => new THREE.Vector2(c, r)), 0.38, pts.map(p => p[2]))
    expect(lane.elevated).toBe(true)
    expect(lane.sample(0).y).toBe(0)
    expect(lane.sample(lane.length).y).toBeCloseTo(1.2)
    let last = lane.sample(0).y
    for (let d = 0; d <= lane.length; d += 0.05) {
      const y = lane.sample(d, 0.2).y
      expect(Math.abs(y - last)).toBeLessThan(0.05)
      expect(lane.heightAt(d)).toBeCloseTo(y)
      last = y
    }
  })
})

describe('the campaign stays on the ground', () => {
  it('builds every campaign road flat at exactly zero', () => {
    for (const lvl of levels) {
      const paths = buildPaths(lvl)
      expect(paths.elevated, lvl.id).toBe(false)
      for (const lane of paths.lanes) {
        expect(lane.elevated).toBe(false)
        for (let d = 0; d < lane.length; d += 0.7) expect(Object.is(lane.sample(d, 0.27).y, 0)).toBe(true)
      }
    }
  })
})

describe('Frontier roads and the ground under them', () => {
  const elevated = frontierLevels.filter(l => buildPaths(l).elevated)

  it('has boards whose roads really climb, and bridges that really cross the sky', () => {
    expect(elevated.length).toBeGreaterThanOrEqual(6)
    const bridged = frontierLevels.filter(l => {
      const p = buildPaths(l)
      return [...p.roadCells].some(k => { const [c, r] = k.split(',').map(Number); return l.voids.some(([a, b, x, y]) => c >= a && c <= x && r >= b && r <= y) })
    })
    expect(bridged.length).toBeGreaterThanOrEqual(5)
  })

  /** an enemy stands where the lane says; the hero, soldiers and effects stand where the terrain says */
  it('puts the lane and the terrain surface at the same height everywhere a walker goes', () => {
    for (const lvl of elevated) {
      const terrain = new Terrain(lvl, buildPaths(lvl))
      for (const lane of terrain.paths.lanes) {
        for (let d = 0.2; d < lane.length - 0.2; d += 0.25) {
          const s = lane.sample(d)
          expect(Math.abs(terrain.groundTopAt(s.x, s.z) - s.y), `${lvl.id} at ${d.toFixed(2)}`).toBeLessThan(0.03)
        }
      }
      terrain.dispose()
    }
  })

  it('gives a soldier stepping off the side of a bridge the deck to stand on, not the sky below', () => {
    let checked = 0
    for (const lvl of elevated) {
      const terrain = new Terrain(lvl, buildPaths(lvl))
      for (const key of terrain.paths.roadCells) {
        const [c, r] = key.split(',').map(Number)
        if (!lvl.voids.some(([a, b, x, y]) => c >= a && c <= x && r >= b && r <= y)) continue
        const [x, z] = gridToWorld(c, r, lvl.width, lvl.height)
        for (const [dx, dz] of [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]]) {
          const [nc, nr] = terrain.worldToCell(x + dx, z + dz)
          if (terrain.paths.roadCells.has(`${nc},${nr}`) || !lvl.voids.some(([a, b, x1, y1]) => nc >= a && nc <= x1 && nr >= b && nr <= y1)) continue
          const deck = terrain.roadHeight(c, r, 0.5 + Math.sign(dx) * 0.5, 0.5 + Math.sign(dz) * 0.5)
          expect(Math.abs(terrain.groundTopAt(x + dx, z + dz) - deck), `${lvl.id} beside ${key}`).toBeLessThan(0.05)
          checked++
        }
      }
      terrain.dispose()
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('stands the keep, the gates and the traps on the road they belong to', () => {
    for (const lvl of elevated) {
      const terrain = new Terrain(lvl, buildPaths(lvl))
      const lane0 = terrain.paths.lanes[0]
      expect(terrain.castle.position.y).toBeCloseTo(lane0.sample(lane0.length).y)
      terrain.spawnMarkers.forEach((m, i) => expect(m.position.y).toBeCloseTo(terrain.paths.lanes[i].sample(0).y))
      for (const spot of terrain.trapSpots) {
        expect(spot.pos.y).toBeCloseTo(terrain.roadHeight(spot.cell[0], spot.cell[1], 0.5, 0.5) + 0.03)
      }
      terrain.dispose()
    }
  })

  it('walks the hero up ramps rather than up the side of a causeway', () => {
    const lvl: LevelDef = levelById('stormcrown')
    const terrain = new Terrain(lvl, buildPaths(lvl))
    // from the field below the outer wall to the citadel above it
    const [fx, fz] = gridToWorld(3, 8, lvl.width, lvl.height)
    const [tx, tz] = gridToWorld(25, 10, lvl.width, lvl.height)
    const path = terrain.findPath(fx, fz, tx, tz)
    expect(path).not.toBeNull()
    for (let i = 1; i < path!.length; i++) {
      const a = path![i - 1], b = path![i]
      const steps = Math.ceil(a.distanceTo(b) / 0.1)
      let prev = terrain.groundTopAt(a.x, a.z)
      for (let k = 1; k <= steps; k++) {
        const y = terrain.groundTopAt(a.x + (b.x - a.x) * k / steps, a.z + (b.z - a.z) * k / steps)
        expect(Math.abs(y - prev), 'a walker climbed a wall').toBeLessThanOrEqual(0.36)
        prev = y
      }
    }
    terrain.dispose()
  })
})
