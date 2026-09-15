import { expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Engine } from '../src/core/engine.ts'

/** Exercise the actual camera update without allocating a WebGL renderer. */
function cameraFrame(distance: number, amplitude: number, phase: number) {
  const camera = new THREE.PerspectiveCamera(45, 1.5, .1, 200)
  const sky = new THREE.Mesh()
  const rig = { camera, sky, updateChillBlend: vi.fn(), updateSky: vi.fn(), cineT: 0,
    yaw: .4, yawGoal: .4, pitch: .8, pitchGoal: .8, dist: distance, distGoal: distance,
    camTarget: new THREE.Vector3(), camTargetGoal: new THREE.Vector3(), shakeAmp: amplitude, shakeT: phase, shakeOffset: new THREE.Vector3() }
  Engine.prototype.updateCamera.call(rig as unknown as Engine, 0)
  camera.updateMatrixWorld()
  return { camera, sky }
}

it('shakes the board without changing the painted sky orientation', () => {
  const still = cameraFrame(13, 0, 1)
  for (const phase of [1, 2, 3, 4, 5]) {
    const { camera, sky } = cameraFrame(13, .5, phase)
    expect(camera.quaternion.angleTo(still.camera.quaternion)).toBeLessThan(1e-7)
    expect(sky.position).toEqual(camera.position)
    const star = new THREE.Vector3(0, 5, -20)
    const before = star.clone().add(still.sky.position).project(still.camera)
    const after = star.clone().add(sky.position).project(camera)
    expect(after.distanceTo(before)).toBeLessThan(1e-7)
    expect(new THREE.Vector3().project(camera).distanceTo(new THREE.Vector3().project(still.camera))).toBeGreaterThan(.001)
  }
})

it('keeps close-zoom screen displacement below the normal gameplay shake', () => {
  for (const phase of [1, 2, 3, 4, 5]) {
    const displacement = (dist: number) => {
      const still = cameraFrame(dist, 0, phase).camera, shaken = cameraFrame(dist, .5, phase).camera
      return new THREE.Vector3().project(still).distanceTo(new THREE.Vector3().project(shaken))
    }
    expect(displacement(5.5)).toBeLessThan(displacement(13) * .85)
  }
})
