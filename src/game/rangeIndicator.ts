import * as THREE from 'three'
import type { LevelDef } from './types.ts'

type Point = [number, number]
type Surface = { level: Pick<LevelDef, 'width' | 'height' | 'voids'>, cellTop(c: number, r: number): number }

/** Clip a ring sector to one cell before lifting it: no triangle bridges a cliff. */
function clip(points: Point[], axis: 0 | 1, bound: number, sign: number): Point[] {
  const out: Point[] = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const insideA = (a[axis] - bound) * sign >= 0, insideB = (b[axis] - bound) * sign >= 0
    if (insideA) out.push(a)
    if (insideA !== insideB) {
      const t = (bound - a[axis]) / (b[axis] - a[axis])
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return out
}

/** The XZ attack footprint projected onto actual terrain, including water.
 * Each cell gets its own flat triangles; cliffs produce a step, never a
 * sloping ribbon or a circle suspended at the tower's elevation.
 */
export function projectedRangeGeometry(surface: Surface, center: { x: number, z: number }, radius: number): THREE.BufferGeometry {
  const { width: w, height: h, voids } = surface.level
  const vertices: number[] = [], steps = radius > 0 ? 128 : 0
  const point = (angle: number, scale: number): Point => [center.x + Math.cos(angle) * radius * scale, center.z + Math.sin(angle) * radius * scale]
  for (let i = 0; i < steps; i++) {
    const a = i / steps * Math.PI * 2, b = (i + 1) / steps * Math.PI * 2
    const sector = [point(a, 0.97), point(a, 1), point(b, 1), point(b, 0.97)]
    const xs = sector.map(p => p[0] + w / 2), zs = sector.map(p => p[1] + h / 2)
    for (let c = Math.max(0, Math.floor(Math.min(...xs))); c <= Math.min(w - 1, Math.floor(Math.max(...xs))); c++) {
      for (let r = Math.max(0, Math.floor(Math.min(...zs))); r <= Math.min(h - 1, Math.floor(Math.max(...zs))); r++) {
        if (voids.some(([x0, z0, x1, z1]) => c >= x0 && c <= x1 && r >= z0 && r <= z1)) continue
        const x = c - w / 2, z = r - h / 2
        let poly = clip(sector, 0, x, 1)
        poly = clip(poly, 0, x + 1, -1)
        poly = clip(poly, 1, z, 1)
        poly = clip(poly, 1, z + 1, -1)
        const top = surface.cellTop(c, r), y = (top < 0 ? -0.18 : top) + 0.035
        for (let j = 1; j + 1 < poly.length; j++) {
          for (const p of [poly[0], poly[j], poly[j + 1]]) vertices.push(p[0], y, p[1])
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  return geometry
}
