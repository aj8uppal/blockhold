import * as THREE from 'three'

/**
 * Death by disassembly.
 *
 * Blockhold is built entirely out of blocks, and until now its enemies
 * evaporated: every one of them toppled backwards and scaled to zero over
 * 0.7s, from a Husk to the Veil Regent. Voxel games are known for exactly one
 * thing at the moment of destruction, and this is it.
 *
 * A dying unit's authored parts are detached from its group and handed to
 * this system, which throws them with the force that killed them and lets
 * them tumble, settle and fade. The parts already exist - the models are
 * named groups of merged boxes - so nothing new has to be authored.
 *
 * Geometry is cached and shared, so it is never disposed here. Unit materials
 * are per-instance clones, and this system takes ownership of disposing them
 * once the chunk it detached is gone.
 */

interface Chunk {
  obj: THREE.Object3D
  vel: THREE.Vector3
  spin: THREE.Vector3
  life: number
  ttl: number
  settled: boolean
  groundY: number
}

/** keeps a heavy wave from turning into a debris field */
const MAX_CHUNKS = 160
const GRAVITY = 15

const chunks: Chunk[] = []
let root: THREE.Group | null = null

export function attachDebris(scene: THREE.Scene): void {
  if (!root) root = new THREE.Group()
  scene.add(root)
}

export type DeathFlavor = 'physical' | 'magic' | 'fire' | 'frost' | 'shock' | 'true'

const FLAVOR_TINT: Record<DeathFlavor, number | null> = {
  physical: null,
  true: null,
  magic: 0x8f5aff,
  fire: 0xff6a2a,
  frost: 0x7fd4ff,
  shock: 0xbff4ff,
}

function disposeChunk(c: Chunk): void {
  c.obj.traverse(o => {
    if (o instanceof THREE.Mesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) if (!m.userData.shared) m.dispose()
    }
  })
  root?.remove(c.obj)
}

function makeRoom(needed: number): void {
  while (chunks.length + needed > MAX_CHUNKS && chunks.length) {
    disposeChunk(chunks.shift()!)
  }
}

/**
 * Break a unit's model apart in place.
 * `force` scales how hard the blocks are thrown, so chip damage crumbles a
 * body and a cannon shell blows it across the road.
 */
export function shatter(
  group: THREE.Group,
  opts: {
    force?: number
    dir?: THREE.Vector3
    flavor?: DeathFlavor
    scale?: number
    rng?: () => number,
  } = {},
): void {
  if (!root) return
  const parts = [...group.children]
  if (!parts.length) return
  makeRoom(parts.length)

  const force = opts.force ?? 1
  const rng = opts.rng ?? Math.random
  const tint = FLAVOR_TINT[opts.flavor ?? 'physical']
  const dir = opts.dir ? opts.dir.clone().setY(0).normalize() : new THREE.Vector3()

  group.updateMatrixWorld(true)
  const centre = new THREE.Vector3()
  group.getWorldPosition(centre)

  for (const part of parts) {
    const worldPos = new THREE.Vector3()
    const worldQuat = new THREE.Quaternion()
    const worldScale = new THREE.Vector3()
    part.matrixWorld.decompose(worldPos, worldQuat, worldScale)

    root.add(part)
    part.position.copy(worldPos)
    part.quaternion.copy(worldQuat)
    part.scale.copy(worldScale)

    if (tint !== null) {
      part.traverse(o => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          o.material.emissive.setHex(tint)
          o.material.emissiveIntensity = 0.55
        }
      })
    }

    // throw outward from the body, biased along whatever hit it
    const out = worldPos.clone().sub(centre)
    if (out.lengthSq() < 1e-6) out.set(rng() - 0.5, 0, rng() - 0.5)
    out.normalize()
    const speed = (1.1 + rng() * 1.5) * force
    chunks.push({
      obj: part,
      vel: new THREE.Vector3(
        (out.x * 0.75 + dir.x * 1.1) * speed + (rng() - 0.5) * 0.6,
        (1.7 + rng() * 1.9) * Math.min(1.6, force),
        (out.z * 0.75 + dir.z * 1.1) * speed + (rng() - 0.5) * 0.6,
      ),
      spin: new THREE.Vector3((rng() - 0.5) * 14, (rng() - 0.5) * 14, (rng() - 0.5) * 14).multiplyScalar(force),
      life: 0,
      ttl: 2.4 + rng() * 1.4,
      settled: false,
      groundY: 0.045 * (opts.scale ?? 1),
    })
  }
}

export function updateDebris(dt: number): void {
  if (!chunks.length) return
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i]
    c.life += dt
    if (!c.settled) {
      c.vel.y -= GRAVITY * dt
      c.obj.position.addScaledVector(c.vel, dt)
      c.obj.rotation.x += c.spin.x * dt
      c.obj.rotation.y += c.spin.y * dt
      c.obj.rotation.z += c.spin.z * dt
      if (c.obj.position.y <= c.groundY) {
        c.obj.position.y = c.groundY
        // bounce once or twice, then lie still
        if (Math.abs(c.vel.y) > 1.4) {
          c.vel.y = -c.vel.y * 0.34
          c.vel.x *= 0.6; c.vel.z *= 0.6
          c.spin.multiplyScalar(0.45)
        } else {
          c.settled = true
          c.vel.set(0, 0, 0)
          c.spin.set(0, 0, 0)
        }
      }
    }
    // fade over the last stretch, then hand the materials back
    const fadeFrom = c.ttl * 0.65
    if (c.life > fadeFrom) {
      const k = Math.max(0, 1 - (c.life - fadeFrom) / (c.ttl - fadeFrom))
      c.obj.traverse(o => {
        if (o instanceof THREE.Mesh) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) { m.transparent = true; m.opacity = k }
        }
      })
    }
    if (c.life >= c.ttl) {
      disposeChunk(c)
      chunks.splice(i, 1)
    }
  }
}

export function clearDebris(): void {
  for (const c of chunks) disposeChunk(c)
  chunks.length = 0
  if (root && root.parent) root.parent.remove(root)
}

export function debrisCount(): number { return chunks.length }
