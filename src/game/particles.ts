import * as THREE from 'three'

/**
 * Two pooled point-sprite systems: 'normal' for dirt/debris/smoke,
 * 'add' for fire/magic/sparks. CPU-integrated, GPU-drawn, zero allocation
 * after construction.
 */

const VERT = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (240.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`

const FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.18, d);
    gl_FragColor = vec4(vColor, a);
  }`

export interface EmitOpts {
  x: number; y: number; z: number
  count: number
  color: number | number[]
  speed?: number          // base outward speed
  speedVar?: number
  dirY?: number           // upward bias 0..1
  gravity?: number
  drag?: number
  life?: number
  lifeVar?: number
  size?: number
  sizeEnd?: number
  spread?: number         // spawn position jitter
}

class ParticlePool {
  geometry: THREE.BufferGeometry
  points: THREE.Points
  private max: number
  private pos: Float32Array
  private col: Float32Array
  private size: Float32Array
  private vel: Float32Array
  private data: Float32Array // life, maxLife, gravity, drag per particle
  private baseCol: Float32Array
  private baseSize: Float32Array
  private endSize: Float32Array
  private cursor = 0

  constructor(max: number, additive: boolean) {
    this.max = max
    this.pos = new Float32Array(max * 3)
    this.col = new Float32Array(max * 3)
    this.size = new Float32Array(max)
    this.vel = new Float32Array(max * 3)
    this.data = new Float32Array(max * 4)
    this.baseCol = new Float32Array(max * 3)
    this.baseSize = new Float32Array(max)
    this.endSize = new Float32Array(max)
    this.geometry = new THREE.BufferGeometry()
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3))
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1))
    // park dead particles far below the map
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -100
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    this.points = new THREE.Points(this.geometry, mat)
    this.points.frustumCulled = false
  }

  emit(o: EmitOpts): void {
    const colors = Array.isArray(o.color) ? o.color : [o.color]
    const c = new THREE.Color()
    for (let n = 0; n < o.count; n++) {
      const i = this.cursor
      this.cursor = (this.cursor + 1) % this.max
      const spread = o.spread ?? 0.05
      this.pos[i * 3] = o.x + (Math.random() - 0.5) * spread * 2
      this.pos[i * 3 + 1] = o.y + (Math.random() - 0.5) * spread * 2
      this.pos[i * 3 + 2] = o.z + (Math.random() - 0.5) * spread * 2
      const speed = (o.speed ?? 1) + (Math.random() - 0.5) * (o.speedVar ?? (o.speed ?? 1) * 0.6)
      const theta = Math.random() * Math.PI * 2
      const up = o.dirY ?? 0.45
      const phi = Math.acos(1 - Math.random() * (1 - up) * 2) // biased up
      const sy = Math.cos(phi) * (Math.random() < 0.5 && up < 0.99 ? 1 : 1)
      const sxz = Math.sin(phi)
      this.vel[i * 3] = Math.cos(theta) * sxz * speed
      this.vel[i * 3 + 1] = Math.abs(sy) * speed * (0.4 + up)
      this.vel[i * 3 + 2] = Math.sin(theta) * sxz * speed
      const life = (o.life ?? 0.6) * (1 + (Math.random() - 0.5) * (o.lifeVar ?? 0.5))
      this.data[i * 4] = life
      this.data[i * 4 + 1] = life
      this.data[i * 4 + 2] = o.gravity ?? 3
      this.data[i * 4 + 3] = o.drag ?? 1.5
      c.set(colors[Math.floor(Math.random() * colors.length)])
      this.baseCol[i * 3] = c.r; this.baseCol[i * 3 + 1] = c.g; this.baseCol[i * 3 + 2] = c.b
      this.baseSize[i] = (o.size ?? 0.5) * (0.7 + Math.random() * 0.6)
      this.endSize[i] = o.sizeEnd ?? (o.size ?? 0.5) * 0.3
    }
  }

  clear(): void {
    for (let i = 0; i < this.max; i++) {
      this.data[i * 4] = 0
      this.pos[i * 3 + 1] = -100
      this.size[i] = 0
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.aSize.needsUpdate = true
  }

  update(dt: number): void {
    for (let i = 0; i < this.max; i++) {
      let life = this.data[i * 4]
      if (life <= 0) continue
      life -= dt
      this.data[i * 4] = life
      if (life <= 0) {
        this.pos[i * 3 + 1] = -100
        this.size[i] = 0
        continue
      }
      const drag = Math.max(0, 1 - this.data[i * 4 + 3] * dt)
      this.vel[i * 3] *= drag
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - this.data[i * 4 + 2] * dt
      this.vel[i * 3 + 2] *= drag
      this.pos[i * 3] += this.vel[i * 3] * dt
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt
      if (this.pos[i * 3 + 1] < 0.02 && this.data[i * 4 + 2] > 0) {
        this.pos[i * 3 + 1] = 0.02
        this.vel[i * 3 + 1] *= -0.3
        this.vel[i * 3] *= 0.7
        this.vel[i * 3 + 2] *= 0.7
      }
      const t = life / this.data[i * 4 + 1]
      const fade = t < 0.35 ? t / 0.35 : 1
      this.col[i * 3] = this.baseCol[i * 3] * fade
      this.col[i * 3 + 1] = this.baseCol[i * 3 + 1] * fade
      this.col[i * 3 + 2] = this.baseCol[i * 3 + 2] * fade
      this.size[i] = this.baseSize[i] * t + this.endSize[i] * (1 - t)
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.aColor.needsUpdate = true
    this.geometry.attributes.aSize.needsUpdate = true
  }
}

export class Particles {
  normal: ParticlePool
  add: ParticlePool
  group = new THREE.Group()

  constructor() {
    this.normal = new ParticlePool(1600, false)
    this.add = new ParticlePool(1600, true)
    this.group.add(this.normal.points, this.add.points)
  }

  update(dt: number): void {
    this.normal.update(dt)
    this.add.update(dt)
  }

  /** kill every live particle instantly (level boundaries) */
  clear(): void {
    this.normal.clear()
    this.add.clear()
  }

  // ---- recipe library ----

  explosion(x: number, y: number, z: number, scale = 1): void {
    this.add.emit({ x, y, z, count: Math.round(26 * scale), color: [0xffd23c, 0xff8c42, 0xff5a3c], speed: 2.2 * scale, life: 0.5, size: 0.75 * scale, gravity: 1.5, dirY: 0.5 })
    this.add.emit({ x, y, z, count: Math.round(10 * scale), color: 0xfff2c8, speed: 3 * scale, life: 0.25, size: 0.5, gravity: 0, dirY: 0.4 })
    this.normal.emit({ x, y, z, count: Math.round(16 * scale), color: [0x4a3b30, 0x6b5a45], speed: 2.6 * scale, life: 0.8, size: 0.5, gravity: 5, dirY: 0.6 })
    this.normal.emit({ x, y: y + 0.2, z, count: Math.round(8 * scale), color: [0x555555, 0x777777], speed: 0.8, life: 1.1, size: 0.9 * scale, sizeEnd: 1.4 * scale, gravity: -0.6, dirY: 0.8 })
  }

  hitSpark(x: number, y: number, z: number, color = 0xffe6a0): void {
    this.add.emit({ x, y, z, count: 6, color, speed: 1.6, life: 0.22, size: 0.28, gravity: 2, dirY: 0.4 })
  }

  magicImpact(x: number, y: number, z: number, color: number): void {
    this.add.emit({ x, y, z, count: 14, color: [color, 0xffffff], speed: 1.4, life: 0.35, size: 0.4, gravity: -0.5, dirY: 0.5 })
  }

  deathPuff(x: number, y: number, z: number, color: number): void {
    this.normal.emit({ x, y, z, count: 14, color: [color, 0x555560], speed: 1.2, life: 0.7, size: 0.55, sizeEnd: 0.9, gravity: 0.4, dirY: 0.6 })
  }

  buildDust(x: number, y: number, z: number): void {
    this.normal.emit({ x, y, z, count: 22, color: [0xbfa680, 0xd8c9a5], speed: 1.8, life: 0.7, size: 0.6, sizeEnd: 1.0, gravity: 2.5, dirY: 0.25 })
  }

  coinBurst(x: number, y: number, z: number): void {
    this.add.emit({ x, y, z, count: 7, color: [0xffd23c, 0xffe89f], speed: 1.3, life: 0.45, size: 0.3, gravity: 4, dirY: 0.75 })
  }

  bloodHit(x: number, y: number, z: number): void {
    this.normal.emit({ x, y, z, count: 5, color: [0x8f2f2f, 0x6b2222], speed: 1.4, life: 0.35, size: 0.3, gravity: 5, dirY: 0.5 })
  }

  poisonDrip(x: number, y: number, z: number): void {
    this.add.emit({ x, y, z, count: 3, color: [0x7fd44a, 0x4a9a2f], speed: 0.5, life: 0.5, size: 0.3, gravity: 2, dirY: 0.4 })
  }

  healSparkle(x: number, y: number, z: number): void {
    this.add.emit({ x, y, z, count: 10, color: [0xa8ffcf, 0xfff8c8], speed: 0.7, life: 0.7, size: 0.16, gravity: -1.2, dirY: 0.8 })
  }

  /**
   * A heal pulse used to be a handful of soft round motes, which at close zoom
   * looked like one unexplained pale orb sitting on the ground. A flat ring of
   * small motes reads as "something healed here" instead.
   */
  healRing(x: number, y: number, z: number, radius: number): void {
    const n = 16
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      this.add.emit({
        x: x + Math.cos(a) * radius * 0.9, y: y + 0.05, z: z + Math.sin(a) * radius * 0.9,
        count: 1, color: [0xa8ffcf, 0xfff8c8], speed: 0.18, life: 0.55, size: 0.14, gravity: -0.5, dirY: 0.6,
      })
    }
  }

  trail(x: number, y: number, z: number, color: number, size = 0.3): void {
    this.add.emit({ x, y, z, count: 1, color, speed: 0.1, life: 0.3, size, gravity: 0, dirY: 0.5, spread: 0.02 })
  }

  smokeTrail(x: number, y: number, z: number): void {
    this.normal.emit({ x, y, z, count: 1, color: [0x888888, 0xaaaaaa], speed: 0.15, life: 0.5, size: 0.35, sizeEnd: 0.6, gravity: -0.4, dirY: 0.6, spread: 0.03 })
  }

  burnEmber(x: number, y: number, z: number): void {
    this.add.emit({ x, y, z, count: 2, color: [0xff8c42, 0xffd23c], speed: 0.4, life: 0.6, size: 0.25, gravity: -1.6, dirY: 0.85, spread: 0.4 })
  }

  stunStars(x: number, y: number, z: number): void {
    this.add.emit({ x, y, z, count: 5, color: 0xfff2a8, speed: 0.6, life: 0.5, size: 0.25, gravity: -0.8, dirY: 0.9, spread: 0.2 })
  }

  leakFlash(x: number, y: number, z: number): void {
    this.add.emit({ x, y, z, count: 20, color: [0xff5a5a, 0xff9a9a], speed: 1.6, life: 0.5, size: 0.45, gravity: -0.5, dirY: 0.7 })
  }
}
