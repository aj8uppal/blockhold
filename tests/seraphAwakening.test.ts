import { expect, it } from 'vitest'
import * as THREE from 'three'
import { seraphAwakening } from '../src/game/effects/seraphAwakening.ts'

function awaken() {
  const scene = new THREE.Group(), tower = new THREE.Group(), model = new THREE.Group()
  scene.add(tower); tower.add(model)
  tower.position.set(3, 2, 5)
  model.scale.setScalar(1.38)
  const effect = seraphAwakening(new THREE.Vector3(), new THREE.Vector3(3, 5, 5), 2, false, model)
  return { scene, tower, model, effect }
}

it('grows from zero independently of normal tower scaling and releases its presentation transform', () => {
  const { tower, model, effect } = awaken(), scale = new THREE.Vector3()
  expect(model.getWorldScale(scale).x).toBe(0)
  effect.updateVisual!(.6)
  const halfway = model.getWorldScale(scale).x
  expect(halfway).toBeGreaterThan(0)
  expect(halfway).toBeLessThan(1.38)
  // Normal build/attack updates must not replace the emergence transform.
  model.scale.setScalar(1.38)
  effect.updateVisual!(0)
  expect(model.getWorldScale(scale).x).toBeCloseTo(halfway)
  effect.updateVisual!(.8)
  expect(model.getWorldScale(scale).x).toBeCloseTo(1.38)
  expect(model.getWorldPosition(new THREE.Vector3())).toEqual(tower.position)
  expect(effect.updateVisual!(1.5)).toBe(false)
  effect.dispose!()
  expect(model.parent).toBe(tower)
  expect(tower.children).toEqual([model])
  expect(model.getWorldScale(scale).x).toBeCloseTo(1.38)
})

it('early cleanup restores full size without putting a sold tower back in the scene', () => {
  const { scene, tower, model, effect } = awaken()
  effect.updateVisual!(.2)
  tower.removeFromParent()
  effect.dispose!()
  expect(scene.children).toHaveLength(0)
  expect(tower.children).toEqual([model])
  expect(model.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(1.38)
})
