import { describe, expect, it } from 'vitest'
import { projectedRangeGeometry } from '../src/game/rangeIndicator.ts'

const surface = {
  level: { width: 14, height: 12, voids: [] as [number, number, number, number][] },
  cellTop: (c: number) => c < 7 ? 2 : 0,
}
describe('range projected onto terrain', () => {
  it('steps from a plateau onto the road without bridging the cliff', () => {
    const geo = projectedRangeGeometry(surface, { x: -0.5, z: 0.5 }, 4)
    const p = geo.getAttribute('position')
    const heights = new Set<number>()
    for (let i = 0; i < p.count; i += 3) {
      const y = p.getY(i)
      heights.add(Math.round(y * 1000))
      expect(p.getY(i + 1)).toBe(y)
      expect(p.getY(i + 2)).toBe(y)
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
      expect(y).toBeCloseTo(x < 0 ? 2.035 : 0.035)
      for (let j = i; j < i + 3; j++) {
        expect(Math.hypot(p.getX(j) + 0.5, p.getZ(j) - 0.5)).toBeLessThanOrEqual(4.000001)
      }
    }
    expect(heights).toEqual(new Set([2035, 35]))
    geo.dispose()
  })

  it('continues the footprint as separated dashes over voids and outside the board', () => {
    const s = { ...surface, level: { ...surface.level, voids: [[0, 0, 2, 11] as [number, number, number, number]] } }
    const geo = projectedRangeGeometry(s, { x: -5.5, z: 0 }, 4)
    const p = geo.getAttribute('position')
    expect(p.count).toBeGreaterThan(0)
    const occupied = new Set<number>()
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
      if (x >= -4) continue
      expect(p.getY(i)).toBeCloseTo(.035)
      const angle = (Math.atan2(z, x + 5.5) + Math.PI * 2) % (Math.PI * 2)
      occupied.add(Math.floor(angle / (Math.PI * 2) * 128))
    }
    expect(occupied.size).toBeGreaterThan(10)
    expect([...occupied].every(i => i % 4 < 2)).toBe(true)
    expect(Array.from({ length: p.count }, (_, i) => p.getX(i)).some(x => x < -7)).toBe(true)
    geo.dispose()
  })

  it('keeps bridge decks solid and lifted even though the cells are over void', () => {
    const s = { level: { width: 2, height: 2, voids: [[0, 0, 1, 1] as [number, number, number, number]] },
      paths: { roadCells: new Set(['0,0', '0,1', '1,0', '1,1']) }, cellTop: () => 1 }
    const geo = projectedRangeGeometry(s, { x: 0, z: 0 }, .8)
    const p = geo.getAttribute('position')
    expect(p.count).toBeGreaterThanOrEqual(128 * 6)
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBeCloseTo(1.035)
    geo.dispose()
  })

  it('uses raised ground and the water surface without scaling the elevation with range', () => {
    const s = { ...surface, cellTop: (c: number) => c < 7 ? 0.45 : -0.4 }
    for (const radius of [2, 5]) {
      const geo = projectedRangeGeometry(s, { x: 0, z: 0 }, radius)
      const p = geo.getAttribute('position')
      expect(new Set(Array.from({ length: p.count }, (_, i) => Math.round(p.getY(i) * 1000)))).toEqual(new Set([485, -145]))
      geo.dispose()
    }
  })
})
