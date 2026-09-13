import * as THREE from 'three'
import type { LanePath } from '../path.ts'

/** A non-overlapping road union, with distance to its outer shore baked once per tide. */
export function floodSurface(lanes: LanePath[], closed: ReadonlySet<number>): {
  geometry: THREE.BufferGeometry, shore: THREE.DataTexture
} {
  const cells = new Map<string, [number, number]>()
  const origin = lanes[0]?.points[0] ?? new THREE.Vector2()
  for (const i of closed) {
    const lane = lanes[i]
    if (!lane) continue
    for (let d = 0; d <= lane.length; d += .25) {
      const p = lane.sample(d)
      const c = Math.round(p.x - origin.x), r = Math.round(p.z - origin.y)
      const x = c + origin.x, z = r + origin.y
      if (!lanes.some((other, j) => !closed.has(j) && other.distanceToPath(x, z) < .85)) cells.set(`${c},${r}`, [c, r])
    }
  }
  const coords = [...cells.values()]
  const minC = Math.min(...(coords.length ? coords.map(p => p[0]) : [0])) - 1, minR = Math.min(...(coords.length ? coords.map(p => p[1]) : [0])) - 1
  const cols = Math.max(...(coords.length ? coords.map(p => p[0]) : [0])) - minC + 2, rows = Math.max(...(coords.length ? coords.map(p => p[1]) : [0])) - minR + 2
  // Only exterior edges contribute: there are no seams between adjacent road cells.
  const boundaries = new Map<string, [number, number, number, number][]>()
  const positions: number[] = [], uv: number[] = [], indices: number[] = []
  for (const [c, r] of coords) {
    const boundary: [number, number, number, number][] = []
    boundaries.set(`${c},${r}`, boundary)
    for (const [dc, dr] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!cells.has(`${c + dc},${r + dr}`)) {
      boundary.push([c + dc * .5 - Math.abs(dr) * .5, r + dr * .5 - Math.abs(dc) * .5,
        c + dc * .5 + Math.abs(dr) * .5, r + dr * .5 + Math.abs(dc) * .5])
    }
    const offset = positions.length / 3
    for (const [dx, dz] of [[-.5, -.5], [-.5, .5], [.5, -.5], [.5, .5]]) {
      positions.push(c + origin.x + dx, .085, r + origin.y + dz)
      uv.push((c + dx - minC + .5) / cols, (r + dz - minR + .5) / rows)
    }
    indices.push(offset, offset + 1, offset + 2, offset + 1, offset + 3, offset + 2)
  }
  const width = cols * 16, height = rows * 16, data = new Uint8Array(width * height * 4)
  // Shore distance is capped at one cell. Bucket nearby edges, then take one
  // square root per texel instead of scanning the whole coastline with hypot.
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const c = minC + col, r = minR + row, inside = cells.has(`${c},${r}`)
    const nearby: [number, number, number, number][] = []
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const edges = boundaries.get(`${c + dc},${r + dr}`)
      if (edges) nearby.push(...edges)
    }
    for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
      const x = c - .5 + (px + .5) / 16, z = r - .5 + (py + .5) / 16
      let squared = 1
      for (const [x0, z0, x1, z1] of nearby) {
        const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1)
        squared = Math.min(squared, dx * dx + dz * dz)
      }
      const value = Math.round((.5 + (inside ? 1 : -1) * Math.sqrt(squared) * .5) * 255)
      const offset = ((row * 16 + py) * width + col * 16 + px) * 4
      data[offset] = data[offset + 1] = data[offset + 2] = value
      data[offset + 3] = 255
    }
  }
  const shore = new THREE.DataTexture(data, width, height)
  shore.minFilter = shore.magFilter = THREE.LinearFilter
  shore.needsUpdate = true
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  return { geometry, shore }
}

export class FloodWater {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  private retired: number | null = null

  constructor(lanes: LanePath[], closed: ReadonlySet<number>, private started: number) {
    const { geometry, shore } = floodSurface(lanes, closed)
    this.mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uShore: { value: shore } },
      vertexShader: /* glsl */`
        varying vec2 vUv, vXZ;
        void main() {
          vUv = uv; vXZ = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFade;
        uniform sampler2D uShore;
        varying vec2 vUv, vXZ;
        void main() {
          float wave = sin(vXZ.x * 3.2 + vXZ.y * 2.8 - uTime * 1.3);
          float crossWave = sin(vXZ.x * 1.7 - vXZ.y * 4.1 + uTime * 0.85);
          float shore = (texture2D(uShore, vUv).r - 0.5) * 2.0;
          float wash = shore + wave * 0.014 + crossWave * 0.008;
          float alpha = smoothstep(0.0, 0.028, wash) * uFade;
          float depth = smoothstep(0.025, 0.22, shore);
          vec3 color = mix(vec3(0.07, 0.26, 0.27), vec3(0.018, 0.12, 0.16), depth);
          color += (wave * crossWave * 0.5 + 0.5) * vec3(0.015, 0.045, 0.045);
          float foam = (1.0 - smoothstep(0.008, 0.027, abs(wash - 0.045)))
            * smoothstep(-0.25, 0.65, wave + crossWave * 0.5);
          color = mix(color, vec3(0.53, 0.73, 0.69), foam * 0.43);
          float ripple = 1.0 - smoothstep(0.025, 0.09, abs(sin(vXZ.x * 1.8 + vXZ.y * 5.0 - uTime * 0.9)
            + 0.15 * sin(vXZ.x * 3.1 - uTime * 0.3)));
          ripple *= smoothstep(0.25, 0.9, sin(vXZ.x * 3.7 - vXZ.y * 0.3 + uTime * 0.5));
          color += ripple * depth * vec3(0.06, 0.10, 0.10);
          gl_FragColor = vec4(color, alpha * mix(0.60, 0.91, depth));
          #include <colorspace_fragment>
        }`,
    }))
    this.mesh.name = 'causeway-flood'
    this.mesh.renderOrder = 2
  }

  retire(time: number): void { this.retired ??= time }

  /** Returns false once the retreating water has disappeared. */
  update(time: number): boolean {
    const fade = this.retired === null ? (time - this.started) / .85 : 1 - (time - this.retired) / .85
    this.mesh.material.uniforms.uTime.value = time
    this.mesh.material.uniforms.uFade.value = Math.max(0, Math.min(1, fade))
    return this.retired === null || fade > 0
  }

  dispose(): void {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mesh.material.uniforms.uShore.value.dispose()
    this.mesh.material.dispose()
  }
}
