import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { LanePath } from '../src/game/path.ts'

const waypoints = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(5, 0),
  new THREE.Vector2(5, 4),
  new THREE.Vector2(9, 4),
]

describe('LanePath', () => {
  it('stays close to the waypoint Manhattan length while chamfering corners', () => {
    const path = new LanePath(waypoints)
    const manhattanLength = 13

    expect(path.length).toBeLessThan(manhattanLength)
    expect(path.length).toBeGreaterThan(manhattanLength - 0.5)
  })

  it('samples the exact start and end points', () => {
    const path = new LanePath(waypoints)

    expect(path.sample(0)).toMatchObject({ x: 0, z: 0 })
    expect(path.sample(path.length).x).toBeCloseTo(9)
    expect(path.sample(path.length).z).toBeCloseTo(4)
  })

  it('finds the distance along the path for a point on a straight segment', () => {
    const path = new LanePath(waypoints)

    expect(path.closestDistance(3, 0)).toBeCloseTo(3)
  })

  it('applies a perpendicular offset of the requested magnitude', () => {
    const path = new LanePath(waypoints)
    const base = path.sample(2)
    const offset = path.sample(2, 0.6)

    expect(Math.hypot(offset.x - base.x, offset.z - base.z)).toBeCloseTo(0.6)
    expect((offset.x - base.x) * base.dirX + (offset.z - base.z) * base.dirZ).toBeCloseTo(0)
  })
})
