import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { box, buildModel, setFlash } from '../src/voxel/builder.ts'

const model = { parts: { body: [box(0, 0, 0, 1, 1, 1, 0x5588aa)] } }
function material(group: THREE.Group): THREE.MeshStandardMaterial {
  return (group.children[0].children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial
}

describe('temporary model flashes', () => {
  it('restores the original appearance after overlapping flashes', () => {
    const group = buildModel(model, 'flash-test', { cloneMaterials: true })
    const m = material(group)
    m.emissive.setHex(0x6fb8ff)
    m.emissiveIntensity = 0.25
    setFlash(group, 0.6, 0xffe6a0)
    setFlash(group, 0.3)
    setFlash(group, 0)
    expect(m.emissive.getHex()).toBe(0x6fb8ff)
    expect(m.emissiveIntensity).toBe(0.25)
    setFlash(group, 0)
    expect(m.emissiveIntensity).toBe(0.25)
  })

  it('never changes another model through shared materials', () => {
    const shared = buildModel(model, 'flash-test')
    const own = buildModel(model, 'flash-test', { cloneMaterials: true })
    setFlash(shared, 0.8, 0xffd98f)
    expect(material(shared).emissive.getHex()).toBe(0)
    setFlash(own, 0.8, 0xffd98f)
    expect(material(shared).emissive.getHex()).toBe(0)
    setFlash(own, 0)
    expect(material(own).emissive.getHex()).toBe(0)
  })
})
