import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/**
 * Voxel models are authored as lists of colored boxes in "voxel units"
 * (1 vu = 0.1 world units by default), grouped into named parts so the
 * game can animate limbs / turrets independently. Each part is merged
 * into a single BufferGeometry with vertex colors — one draw call per part.
 */

export interface VoxBox {
  x: number; y: number; z: number      // center, voxel units (y up from ground)
  sx: number; sy: number; sz: number   // size, voxel units
  c: number                            // color
  glow?: boolean                       // unlit bright material (crystals, magic)
}

export interface VoxModel {
  parts: Record<string, VoxBox[]>
  /** rotation pivot per part, voxel units, model space. Parts author boxes in
   *  absolute model space; the builder re-bases them around the pivot. */
  pivots?: Record<string, [number, number, number]>
  scale?: number // world units per voxel unit, default 0.1
}

export const box = (
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  c: number, glow = false,
): VoxBox => ({ x, y, z, sx, sy, sz, c, glow })

const litMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 })
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
// Every uncloned model in the game draws with these two. Tagging them means a
// per-object effect - a glow, a fade, a wash - can check before writing, and
// cannot accidentally repaint the entire world.
litMaterial.userData.shared = true
glowMaterial.userData.shared = true

const geoCache = new Map<string, { lit: THREE.BufferGeometry | null, glow: THREE.BufferGeometry | null }>()

function buildGeometry(boxes: VoxBox[], scale: number, pivot: [number, number, number]): THREE.BufferGeometry | null {
  if (boxes.length === 0) return null
  const geos: THREE.BufferGeometry[] = []
  const color = new THREE.Color()
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.sx * scale, b.sy * scale, b.sz * scale)
    g.translate((b.x - pivot[0]) * scale, (b.y - pivot[1]) * scale, (b.z - pivot[2]) * scale)
    const count = g.attributes.position.count
    const colors = new Float32Array(count * 3)
    color.set(b.c)
    // subtle per-face shading variation for a hand-shaded look
    const normals = g.attributes.normal
    for (let i = 0; i < count; i++) {
      const ny = normals.getY(i)
      const nx = normals.getX(i)
      let shade = 1
      if (ny > 0.5) shade = 1.08
      else if (ny < -0.5) shade = 0.72
      else if (Math.abs(nx) > 0.5) shade = 0.9
      colors[i * 3] = Math.min(1, color.r * shade)
      colors[i * 3 + 1] = Math.min(1, color.g * shade)
      colors[i * 3 + 2] = Math.min(1, color.b * shade)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geos.push(g)
  }
  const merged = mergeGeometries(geos)
  geos.forEach(g => g.dispose())
  return merged
}

/**
 * Build a model into a Group. Children are named after parts.
 * Geometries are cached per cacheKey; materials are shared unless
 * `cloneMaterials` (needed for per-instance damage flashes).
 */
export function buildModel(model: VoxModel, cacheKey: string, opts: {
  cloneMaterials?: boolean, castShadow?: boolean, receiveShadow?: boolean,
} = {}): THREE.Group {
  const scale = model.scale ?? 0.1
  const group = new THREE.Group()
  for (const [name, boxes] of Object.entries(model.parts)) {
    const pivot = model.pivots?.[name] ?? [0, 0, 0] as [number, number, number]
    const key = `${cacheKey}:${name}`
    let entry = geoCache.get(key)
    if (!entry) {
      entry = {
        lit: buildGeometry(boxes.filter(b => !b.glow), scale, pivot),
        glow: buildGeometry(boxes.filter(b => b.glow), scale, pivot),
      }
      geoCache.set(key, entry)
    }
    const partGroup = new THREE.Group()
    partGroup.name = name
    partGroup.position.set(pivot[0] * scale, pivot[1] * scale, pivot[2] * scale)
    if (entry.lit) {
      const mat = opts.cloneMaterials ? litMaterial.clone() : litMaterial
      const mesh = new THREE.Mesh(entry.lit, mat)
      mesh.castShadow = opts.castShadow ?? true
      mesh.receiveShadow = opts.receiveShadow ?? false
      partGroup.add(mesh)
    }
    if (entry.glow) {
      // glow must be cloned too when instances mutate materials (phasing opacity)
      const mesh = new THREE.Mesh(entry.glow, opts.cloneMaterials ? glowMaterial.clone() : glowMaterial)
      partGroup.add(mesh)
    }
    group.add(partGroup)
  }
  return group
}

/** Set emissive flash on all lit meshes of a model instance (requires cloned materials). */
export function setFlash(group: THREE.Group, intensity: number, color = 0xffffff): void {
  group.traverse(o => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
      o.material.emissive.set(color)
      o.material.emissiveIntensity = intensity
    }
  })
}

export function getPart(group: THREE.Group, name: string): THREE.Object3D | undefined {
  return group.children.find(c => c.name === name)
}

/** Dispose per-instance cloned materials; cached geometries, the shared base
 *  materials, and anything tagged userData.shared are left alone. */
export function disposeClonedMaterials(group: THREE.Object3D): void {
  group.traverse(o => {
    if (o instanceof THREE.Mesh && o.material !== litMaterial && o.material !== glowMaterial) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (!m.userData.shared) m.dispose()
      }
    }
  })
}
