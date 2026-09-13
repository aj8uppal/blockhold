import * as THREE from 'three'

const noise = /* glsl */`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
      mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), f.x), f.y);
  }
`
const flameGeometry = new THREE.PlaneGeometry(1, 1)
flameGeometry.translate(0, .5, 0)
const groundGeometry = new THREE.PlaneGeometry(2, 2)
groundGeometry.rotateX(-Math.PI / 2)

/** Camera-facing tongues of flame; two draws per patch, no per-frame geometry uploads. */
export class GroundFire {
  readonly group = new THREE.Group()
  private uniforms = { uTime: { value: 0 }, uFade: { value: 0 } }
  private flames: THREE.InstancedMesh
  private hearth: THREE.Mesh

  constructor(at: THREE.Vector3, radius: number, private started: number, private until: number) {
    this.group.name = 'mortar-fire'
    this.group.position.set(at.x, .045, at.z)
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        uniform float uTime;
        varying vec2 vUv;
        varying float vSeed;
        void main() {
          vUv = uv;
          vec4 center = modelMatrix * instanceMatrix * vec4(0, 0, 0, 1);
          vSeed = dot(center.xz, vec2(13.7, 8.3));
          float height = length(instanceMatrix[1].xyz);
          float width = length(instanceMatrix[0].xyz);
          height *= 0.88 + 0.12 * sin(uTime * 4.0 + vSeed);
          vec3 right = vec3(viewMatrix[0][0], 0, viewMatrix[2][0]);
          right = normalize(right);
          center.xyz += right * position.x * width + vec3(0, position.y * height, 0);
          gl_Position = projectionMatrix * viewMatrix * center;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFade;
        varying vec2 vUv;
        varying float vSeed;
        ${noise}
        void main() {
          float y = vUv.y, t = uTime * 1.65;
          vec2 flow = vec2(vUv.x * 3.8 + vSeed, y * 5.2 - t * 1.6);
          float n = noise(flow) * 0.7 + noise(flow * 2.1 - t * 0.4) * 0.3;
          float bend = sin(y * 5.0 - t * 2.0 + vSeed) * y * 0.13;
          float x = abs(vUv.x - 0.5 + bend + (n - 0.5) * y * 0.3);
          float width = sin(3.14159 * pow(y, 0.62)) * 0.33 * (1.0 - y * 0.35);
          float shape = (width - x) * 3.5 + (n - 0.5) * (0.4 + y * 1.4);
          float body = smoothstep(0.0, 0.16, shape);
          float tip = 1.0 - smoothstep(0.80, 1.0, y + (n - 0.5) * 0.3);
          float alpha = body * tip * smoothstep(0.0, 0.09, y) * uFade;
          alpha *= 1.0 - smoothstep(0.43, 0.5, abs(vUv.x - 0.5));
          vec3 color = mix(vec3(1.0, 0.13, 0.015), vec3(1.0, 0.38, 0.025), body * (1.0 - y));
          color = mix(color, vec3(1.0, 0.72, 0.18), smoothstep(0.55, 0.9, shape) * (1.0 - smoothstep(0.05, 0.45, y)));
          gl_FragColor = vec4(color, alpha * 0.92);
          #include <colorspace_fragment>
        }`,
    })
    this.flames = new THREE.InstancedMesh(flameGeometry, material, 11)
    this.flames.frustumCulled = false
    this.flames.renderOrder = 3
    const pose = new THREE.Object3D()
    for (let i = 0; i < this.flames.count; i++) {
      const angle = i * 2.39996, spread = radius * .60 * Math.sqrt(i / 10)
      pose.position.set(Math.cos(angle) * spread, .025, Math.sin(angle) * spread)
      pose.scale.set(.48 + radius * .21, .85 + .65 * (Math.sin(i * 7.3) * .5 + .5), 1)
      pose.updateMatrix(); this.flames.setMatrixAt(i, pose.matrix)
    }
    this.flames.instanceMatrix.needsUpdate = true
    this.hearth = new THREE.Mesh(groundGeometry, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, uniforms: this.uniforms,
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1); }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uFade;
        varying vec2 vUv;
        ${noise}
        void main() {
          float n = noise(vUv * 8.0);
          float edge = 1.0 - smoothstep(0.65, 1.0, length(vUv * 2.0 - 1.0) + (n - 0.5) * 0.2);
          float ember = smoothstep(0.57, 0.83, n) * (0.7 + 0.3 * sin(uTime * 3.0 + n * 20.0));
          vec3 color = mix(vec3(0.065, 0.022, 0.012), vec3(0.9, 0.18, 0.015), ember);
          gl_FragColor = vec4(color, edge * 0.48 * uFade);
          #include <colorspace_fragment>
        }`,
    }))
    this.hearth.scale.setScalar(radius)
    this.hearth.renderOrder = 2
    this.group.add(this.hearth, this.flames)
    this.update(started)
  }

  update(time: number): void {
    this.uniforms.uTime.value = time - this.started
    this.uniforms.uFade.value = Math.max(0, Math.min(1, (time - this.started) / .18, (this.until - time) / .65))
  }

  dispose(): void {
    this.group.removeFromParent()
    this.flames.dispose()
    ;(this.flames.material as THREE.Material).dispose()
    ;(this.hearth.material as THREE.Material).dispose()
    // Both tiny geometries are shared by all patches.
  }
}
