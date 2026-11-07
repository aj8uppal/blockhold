import { expect, it } from 'vitest'
import * as THREE from 'three'
import { BlastFx } from '../src/game/effects/explosions.ts'
import { GroundFire } from '../src/game/effects/groundFire.ts'
import { setFxQuality, fxOctaves } from '../src/game/effects/fxShaders.ts'

const births = (fx: BlastFx) => fx.group.children.map(mesh => {
  const geometry = (mesh as THREE.Mesh).geometry as THREE.InstancedBufferGeometry
  const attr = geometry.getAttribute('aA') as THREE.InstancedBufferAttribute
  return Array.from({ length: attr.count }, (_, i) => attr.getW(i))
})

it('blasts write into bounded rings, draw in three calls, and clear back to nothing', () => {
  const fx = new BlastFx()
  expect(fx.group.children).toHaveLength(3)
  for (let i = 0; i < 200; i++) {
    fx.explosion(i, .15, 0, 1.6, { scorch: true })
    fx.muzzle(0, 1, 0, 1, 0, .8)
    fx.shellSmoke(0, 1, 0)
    fx.update(1 / 60)
  }
  // a storm of shells overwrites the oldest slots rather than growing
  for (const mesh of fx.group.children) {
    const geometry = (mesh as THREE.Mesh).geometry as THREE.InstancedBufferGeometry
    expect(geometry.instanceCount).toBe(geometry.getAttribute('aA').count)
  }
  expect(births(fx).flat().some(t => t > 0)).toBe(true)
  fx.clear()
  expect(births(fx).flat().every(t => t < -1000)).toBe(true)
  fx.dispose()
})

it('lower quality draws fewer flame cards, embers and smoke, with coarser turbulence', () => {
  const fire = new GroundFire(new THREE.Vector3(), 1, 0, 3)
  const count = (i: number) => ((fire.group.children[i] as THREE.Mesh).geometry as THREE.InstancedBufferGeometry).instanceCount
  setFxQuality(0)
  const high = [count(1), count(2), count(3)], octaves = fxOctaves.value
  setFxQuality(2)
  const low = [count(1), count(2), count(3)]
  low.forEach((n, i) => expect(n).toBeLessThan(high[i]))
  expect(fxOctaves.value).toBeLessThan(octaves)
  setFxQuality(0)
  fire.dispose()
})
