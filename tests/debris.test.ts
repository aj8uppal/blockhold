import { describe, expect, it, beforeEach } from 'vitest'
import * as THREE from 'three'
import { shatter, updateDebris, clearDebris, debrisCount, HP_BAR_NAME } from '../src/game/debris.ts'

/** a unit group shaped like a real one: named model parts plus a health bar */
function makeUnit() {
  const group = new THREE.Group()
  const shared = new THREE.MeshBasicMaterial({ color: 0x62d84a, opacity: 1 })
  shared.userData.shared = true

  for (const name of ['body', 'head', 'legL']) {
    const part = new THREE.Group()
    part.name = name
    part.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()))
    group.add(part)
  }
  const bar = new THREE.Group()
  bar.name = HP_BAR_NAME
  bar.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shared))
  group.add(bar)
  return { group, bar, shared }
}

beforeEach(() => {
  clearDebris()
  const scene = new THREE.Scene()
  // attachDebris is required before shatter will do anything
  ;(globalThis as Record<string, unknown>).__scene = scene
})

describe('death by disassembly', () => {
  it('throws only the model parts, never the health bar', async () => {
    const { attachDebris } = await import('../src/game/debris.ts')
    attachDebris(new THREE.Scene())
    const { group, bar } = makeUnit()
    shatter(group)
    expect(debrisCount()).toBe(3)          // body, head, legL - not the bar
    expect(bar.parent).toBe(group)          // the bar stayed where it was
  })

  /**
   * The health bar uses module-level shared materials. Fading a chunk writes
   * opacity straight onto its materials, so a bar swept into the debris system
   * dimmed every health bar in the game at once - which is exactly what
   * happened the first time this shipped.
   */
  it('never writes opacity onto a shared material', async () => {
    const { attachDebris } = await import('../src/game/debris.ts')
    attachDebris(new THREE.Scene())
    const { group, shared } = makeUnit()

    // force a shared material into a chunk, the way the bug did
    const rogue = new THREE.Group()
    rogue.name = 'body'
    rogue.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared))
    group.add(rogue)

    shatter(group)
    for (let i = 0; i < 200; i++) updateDebris(0.05)   // run well past the fade
    expect(shared.opacity).toBe(1)
    expect(shared.transparent).toBe(false)
  })

  it('caps how much debris a heavy wave can leave', async () => {
    const { attachDebris } = await import('../src/game/debris.ts')
    attachDebris(new THREE.Scene())
    for (let i = 0; i < 120; i++) shatter(makeUnit().group)
    expect(debrisCount()).toBeLessThanOrEqual(160)
  })

  it('clears everything between battles', async () => {
    const { attachDebris } = await import('../src/game/debris.ts')
    attachDebris(new THREE.Scene())
    shatter(makeUnit().group)
    expect(debrisCount()).toBeGreaterThan(0)
    clearDebris()
    expect(debrisCount()).toBe(0)
  })
})
