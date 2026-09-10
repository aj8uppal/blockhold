import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Terrain } from '../src/game/terrain.ts'
import { buildPaths, gridToWorld } from '../src/game/path.ts'
import { levelById, levels } from '../src/game/levels.ts'
import type { LevelDef } from '../src/game/types.ts'
import { RAISE_HEIGHT } from '../src/game/earthworks.ts'
import { availableExpansionPlots, earnedExpansionPlots, placeExpansionPlot } from '../src/game/expansion.ts'
import { setSimSeed, simRandom } from '../src/core/utils.ts'

const terrains: Terrain[] = []
afterEach(() => { terrains.splice(0).forEach(t => t.dispose()); setSimSeed(null) })
function terrain(level: LevelDef = {
  ...levelById('greenhollow'), id: 'expansion-fixture', seed: 313, width: 18, height: 14,
  lanes: [[[0, 6], [17, 6]]], plots: [[5, 4]], trapSpots: [[10, 6]],
  hills: [[9, 0, 17, 3]], plateaus: [[9, 9, 17, 13, 1.6]],
  voids: [[3, 2, 3, 2]], water: [[2, 2, 2, 2]], landmarks: [[7, 10, 'greatTree']],
}): Terrain {
  const t = new Terrain(level, buildPaths(level)); terrains.push(t); return t
}
function validCells(t: Terrain): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 0; r < t.level.height; r++) for (let c = 0; c < t.level.width; c++) if (t.canAddExpansionPlot(c, r)) cells.push([c, r])
  return cells
}

describe('earned endless foundations', () => {
  it('earns a credit on every fifteenth completed endless wave, with no fractional or malformed grants', () => {
    for (const [completed, earned] of [[0, 0], [14, 0], [15, 1], [29, 1], [30, 2], [150, 10]]) expect(earnedExpansionPlots(completed)).toBe(earned)
    for (const invalid of [-1, 15.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(earnedExpansionPlots(invalid)).toBe(0)
  })

  it('spends only for successful placements and refuses duplicate cells or credit reuse', () => {
    const t = terrain(), [first, second] = validCells(t)
    const authored = JSON.stringify(t.level.plots), originalCount = t.plots.length
    expect(placeExpansionPlot(t, 14, ...first)).toBeNull()
    expect(placeExpansionPlot(t, 15, 2, 2)).toBeNull()
    expect(availableExpansionPlots(15, t)).toBe(1)
    const one = placeExpansionPlot(t, 15, ...first)!
    expect(one.index).toBe(originalCount)
    expect(one.expanded).toBe(true)
    expect(placeExpansionPlot(t, 15, ...second)).toBeNull()
    expect(placeExpansionPlot(t, 30, ...first)).toBeNull()
    expect(availableExpansionPlots(30, t)).toBe(1)
    const two = placeExpansionPlot(t, 30, ...second)!
    expect(two.index).toBe(originalCount + 1)
    expect(availableExpansionPlots(30, t)).toBe(0)
    expect(JSON.stringify(t.level.plots)).toBe(authored)
    expect(t.isWalkable(one.pos.x, one.pos.z)).toBe(false)
  })

  it('rejects roads, water, missing ground, existing plots, malformed coordinates and map edges', () => {
    const t = terrain(), size = t.group.children.length
    for (const [c, r] of [[0, 6], [10, 6], [2, 2], [3, 2], [5, 4], [-1, 0], [0, -1], [18, 1], [1, 14], [0.5, 1], [NaN, 1], [Infinity, 1]]) {
      expect(t.expansionBlockReason(c, r), `${c},${r}`).toBeTruthy()
      expect(placeExpansionPlot(t, 150, c, r)).toBeNull()
    }
    expect(t.group.children).toHaveLength(size)
  })

  it('blocks generated scenery and the whole footprint of large landmarks', () => {
    const t = terrain()
    expect(t.expansionBlockReason(7, 10)).toMatch(/obstacle/)
    // The great tree extends beyond its authored center cell.
    const neighbors = [[6, 10], [8, 10], [7, 9], [7, 11]]
    expect(neighbors.filter(([c, r]) => t.expansionBlockReason(c, r)?.includes('obstacle')).length).toBeGreaterThan(0)
    const excluded = new Set<THREE.Object3D>([...t.plots.map(p => p.mesh), t.castle, ...t.spawnMarkers])
    let decorations = 0
    for (const child of t.group.children) {
      if (!(child instanceof THREE.Group) || excluded.has(child) || !child.children.some(x => x.name === 'base')) continue
      const [c, r] = t.worldToCell(child.position.x, child.position.z)
      if (c < 0 || c >= t.level.width || r < 0 || r >= t.level.height || t.paths.roadCells.has(`${c},${r}`)) continue
      expect(t.canAddExpansionPlot(c, r), `scenery at ${c},${r}`).toBe(false)
      decorations++
    }
    expect(decorations).toBeGreaterThan(10)
  })

  it('preserves natural shelf and hill height, including a later raised foundation', () => {
    const t = terrain()
    for (const height of [0.5, 1.6]) {
      const cell = validCells(t).find(([c, r]) => t.cellTop(c, r) === height)!
      expect(cell).toBeDefined()
      const plot = t.addExpansionPlot(...cell)!
      const [x, z] = gridToWorld(...cell, t.level.width, t.level.height)
      expect(plot.pos.toArray()).toEqual([x, height + 0.1, z])
      expect(plot.mesh.position.y).toBe(height)
      expect(t.cellTop(...cell)).toBeCloseTo(height)
      expect(t.isOnHill(...cell)).toBe(true)
      t.raisePlot(plot)
      expect(t.cellTop(...cell)).toBeCloseTo(height + RAISE_HEIGHT)
      expect(t.groundTopAt(x, z)).toBeCloseTo(height + RAISE_HEIGHT)
      expect(plot.pos.y).toBeCloseTo(height + RAISE_HEIGHT + 0.1)
    }
  })

  it('replays the same placements with stable indices and consumes no simulation randomness', () => {
    setSimSeed(918); const next = simRandom(); setSimSeed(918)
    const a = terrain(), cells = validCells(a).slice(0, 3)
    for (const [i, cell] of cells.entries()) placeExpansionPlot(a, (i + 1) * 15, ...cell)
    expect(simRandom()).toBe(next)
    // Warm another geometry cache between live construction and replay.
    terrain(levelById('frostmere'))
    const b = terrain()
    for (const [i, cell] of cells.entries()) placeExpansionPlot(b, (i + 1) * 15, ...cell)
    const snapshot = (t: Terrain) => t.plots.map(p => ({ index: p.index, cell: p.cell, pos: p.pos.toArray(), expanded: p.expanded }))
    expect(snapshot(b)).toEqual(snapshot(a))
    expect(validCells(b)).toEqual(validCells(a))
  })

  it('leaves expansion options on every existing battlefield', () => {
    for (const level of levels) expect(validCells(terrain(level)).length, level.id).toBeGreaterThan(0)
  })

  it('disposes newly owned plot materials with the terrain', () => {
    const t = terrain(), plot = t.addExpansionPlot(...validCells(t)[0])!
    const mesh = plot.mesh.children[0].children[0] as THREE.Mesh
    const material = mesh.material as THREE.Material
    const dispose = vi.spyOn(material, 'dispose')
    t.dispose()
    expect(dispose).toHaveBeenCalledOnce()
    expect(material.userData.shared).toBe(false)
  })
})
