import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GHOST_POWER, applyGhostLook } from '../src/game/towers.ts'

describe('the Three Watches', () => {
  it('makes an echo weaker than a living tower, but not harmless', () => {
    expect(GHOST_POWER).toBeGreaterThan(0)
    expect(GHOST_POWER).toBeLessThan(1)
  })

  it('washes a model out so it reads as a memory', () => {
    const model = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ opacity: 1 })
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat))
    applyGhostLook(model)
    expect(mat.transparent).toBe(true)
    expect(mat.opacity).toBeLessThan(1)
    expect(mat.opacity).toBeGreaterThan(0)
  })

  /**
   * The same trap the debris fade fell into: writing opacity onto a cached,
   * shared material makes every tower using it translucent, not just the echo.
   */
  it('never washes out a shared material', () => {
    const model = new THREE.Group()
    const shared = new THREE.MeshStandardMaterial({ opacity: 1 })
    shared.userData.shared = true
    model.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared))
    applyGhostLook(model)
    expect(shared.opacity).toBe(1)
    expect(shared.transparent).toBe(false)
  })
})
