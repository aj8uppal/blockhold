import * as THREE from 'three'
import { prefersReducedMotion } from './platform.ts'
import { clamp, lerp } from './utils.ts'
import { ThemeColors } from '../game/terrain.ts'

const panRaycaster = new THREE.Raycaster()
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export class Engine {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  sun!: THREE.DirectionalLight
  private hemi!: THREE.HemisphereLight
  private ambient!: THREE.AmbientLight
  private skyMat: THREE.ShaderMaterial | null = null
  private sky: THREE.Mesh | null = null

  // camera rig (goals are public: game code steers them imperatively)
  camTarget = new THREE.Vector3()
  camTargetGoal = new THREE.Vector3()
  yaw = 0
  yawGoal = 0
  pitch = 0.93
  pitchGoal = 0.93
  dist = 13
  distGoal = 13
  bounds = { x: 12, z: 8 }
  readonly reducedMotion = prefersReducedMotion()
  private shakeAmp = 0
  private shakeT = 0
  /**
   * Directed camera. Reserved for moments the player is watching rather than
   * playing - a level opening, a boss arriving, the gate falling. It never
   * fires during placement or targeting, and any camera input cancels it
   * immediately: taking the camera away mid-decision is the fastest way to
   * make direction feel like a bug.
   */
  private cineT = 0
  private cineRestore: { dist: number, pitch: number } | null = null

  /** 0 = desktop full, 1 = mobile (smaller shadows, capped DPR), 2 = potato (no shadows) */
  qualityTier = 0
  private frameTimes: number[] = []
  private lastFrameAt = performance.now()

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220)
    this.setupLights()
    // touch devices start one tier down; the watchdog can drop further
    this.qualityTier = window.matchMedia?.('(pointer: coarse)').matches ? 1 : 0
    this.applyQuality()
    this.resize()
    window.addEventListener('resize', () => this.resize())
    // background tabs produce garbage frame timings; start the window fresh
    document.addEventListener('visibilitychange', () => { this.frameTimes.length = 0; this.slowWindows = 0 })
  }

  private applyQuality(): void {
    const dprCap = [2, 1.75, 1.25][this.qualityTier]
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, dprCap))
    const shadowSize = [2048, 1024, 0][this.qualityTier]
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
    if (shadowSize > 0) {
      this.renderer.shadowMap.enabled = true
      this.sun.castShadow = true
      this.sun.shadow.mapSize.set(shadowSize, shadowSize)
    } else {
      this.renderer.shadowMap.enabled = false
      this.sun.castShadow = false
    }
    this.resize()
  }

  private slowWindows = 0

  /** frame-time watchdog: degrade only on sustained, tier-appropriate slowness.
   *  Thresholds sit well past 30Hz-display frame times so refresh-rate-limited
   *  devices are never punished; two consecutive slow windows are required. */
  private watchQuality(): void {
    const now = performance.now()
    const dt = now - this.lastFrameAt
    this.lastFrameAt = now
    if (dt > 100 || this.qualityTier >= 2) { this.frameTimes.length = 0; return }
    this.frameTimes.push(dt)
    if (this.frameTimes.length >= 180) {
      const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
      this.frameTimes.length = 0
      const threshold = this.qualityTier === 0 ? 36 : 45   // ~<28fps / ~<22fps sustained
      if (avg > threshold) {
        this.slowWindows++
        if (this.slowWindows >= 2) {
          this.slowWindows = 0
          this.qualityTier++
          this.applyQuality()
        }
      } else {
        this.slowWindows = 0
      }
    }
  }

  private setupLights(): void {
    this.sun = new THREE.DirectionalLight(0xfff0d0, 2.6)
    this.sun.position.set(-9, 16, 7)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 2
    this.sun.shadow.camera.far = 60
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.02
    this.scene.add(this.sun, this.sun.target)
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6a8a55, 0.7)
    this.scene.add(this.hemi)
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25)
    this.scene.add(this.ambient)
  }

  private baseTheme: ThemeColors | null = null

  applyTheme(t: ThemeColors, mapW: number, mapH: number): void {
    this.baseTheme = t
    this.sun.color.set(t.sunColor)
    this.sun.intensity = t.sunIntensity
    this.hemi.color.set(t.hemiSky)
    this.hemi.groundColor.set(t.hemiGround)
    this.ambient.intensity = t.ambient
    const ext = Math.max(mapW, mapH) * 0.62
    const sc = this.sun.shadow.camera
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext
    sc.updateProjectionMatrix()
    this.scene.fog = new THREE.Fog(t.fog, 26, 70)
    this.bounds = { x: mapW * 0.45, z: mapH * 0.5 }
    this.buildSky(t)
  }

  private surgeBlendAmt = 0
  private chillBlendAmt = 0

  /** Veiltide surge: blend the world's light toward an ominous violet (0..1) */
  setSurgeBlend(blend: number): void {
    this.surgeBlendAmt = blend
    this.applyAmbientBlend()
  }

  /** Deep Chill: blend toward pale aurora blue (0..1); surge takes precedence */
  /**
   * Target for the chill grade. The world used to snap between grades the
   * instant a hazard flipped, which reads as a rendering glitch rather than
   * weather; it eases now, like the surge blend already did.
   */
  setChillBlend(blend: number): void {
    this.chillTarget = blend
  }

  private chillTarget = 0

  private updateChillBlend(dt: number): void {
    if (Math.abs(this.chillBlendAmt - this.chillTarget) < 0.003) {
      if (this.chillBlendAmt !== this.chillTarget) {
        this.chillBlendAmt = this.chillTarget
        this.applyAmbientBlend()
      }
      return
    }
    this.chillBlendAmt += (this.chillTarget - this.chillBlendAmt) * Math.min(1, dt * 1.8)
    this.applyAmbientBlend()
  }

  private applyAmbientBlend(): void {
    const t = this.baseTheme
    if (!t) return
    const s = this.surgeBlendAmt
    const c = this.chillBlendAmt * (1 - s)
    const mix = (base: number, surge: number, chill: number) =>
      new THREE.Color(base).lerp(new THREE.Color(surge), s).lerp(new THREE.Color(chill), c)
    this.sun.color.copy(mix(t.sunColor, 0xb98fd8, 0xcfe8ff))
    this.sun.intensity = t.sunIntensity * (1 - s * 0.35) * (1 - c * 0.15)
    this.hemi.color.copy(mix(t.hemiSky, 0x7a5aa8, 0x9fd0f0))
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(mix(t.fog, 0x584a78, 0xb8d8ea))
    if (this.skyMat) {
      ;(this.skyMat.uniforms.uTop.value as THREE.Color).copy(mix(t.skyTop, 0x2a1d45, 0x6fa8d0))
      ;(this.skyMat.uniforms.uBottom.value as THREE.Color).copy(mix(t.skyBottom, 0x6f4a8f, 0xd0ecff))
    }
  }

  private buildSky(t: ThemeColors): void {
    if (this.sky) {
      this.scene.remove(this.sky)
      this.sky.geometry.dispose()
      ;(this.sky.material as THREE.Material).dispose()
    }
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(t.skyTop) },
        uBottom: { value: new THREE.Color(t.skyBottom) },
      },
      vertexShader: /* glsl */`
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          vec3 col = mix(uBottom, uTop, smoothstep(0.42, 0.75, h));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 16), this.skyMat)
    this.scene.add(this.sky)
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // orientation change re-derives the zoom ceiling (portrait needs more
    // headroom, and a big board needs more than either default)
    this.maxZoomOut = this.zoomCeiling(this.board.w, this.board.h, this.liftFor(this.tallest))
    this.distGoal = Math.min(this.distGoal, this.maxZoomOut)
    this.dist = Math.min(this.dist, this.maxZoomOut)
  }

  // ---- camera control ----

  orbit(dx: number, dy: number): void {
    this.cancelCinematic()
    this.yawGoal -= dx * 0.0052
    this.pitchGoal = clamp(this.pitchGoal + dy * 0.004, 0.34, 1.5)
  }

  /** tilt only (camera pitch), used by two-finger vertical drag and T/G keys */
  tilt(dy: number): void {
    this.cancelCinematic()
    this.pitchGoal = clamp(this.pitchGoal + dy * 0.004, 0.34, 1.5)
  }

  /** orbit by a raw angle (radians) — used by the two-finger twist gesture */
  orbitByAngle(rad: number): void {
    this.cancelCinematic()
    this.yawGoal += rad
  }

  private maxZoomOut = 22

  zoom(delta: number): void {
    this.cancelCinematic()
    this.distGoal = clamp(this.distGoal * Math.exp(delta * 0.0011), 5.5, this.maxZoomOut)
  }

  /** screen-delta pan on the ground plane (keyboard, two-finger centroid).
   *  Scaled by world-units-per-pixel and pitch foreshortening so the world
   *  roughly tracks the pointer at any zoom/tilt/orbit. */
  pan(dx: number, dz: number): void {
    this.cancelCinematic()
    const wpp = 2 * this.dist * Math.tan(this.camera.fov * Math.PI / 360) / window.innerHeight
    const vert = 1 / Math.max(0.3, Math.sin(this.pitch))
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw)
    this.camTargetGoal.x += (dx * cos + dz * vert * sin) * wpp
    this.camTargetGoal.z += (dz * vert * cos - dx * sin) * wpp
    this.camTargetGoal.x = clamp(this.camTargetGoal.x, -this.bounds.x, this.bounds.x)
    this.camTargetGoal.z = clamp(this.camTargetGoal.z, -this.bounds.z, this.bounds.z)
  }

  // ---- grab-the-ground pan (primary pointer drag) ----

  private goalCam: THREE.PerspectiveCamera | null = null
  private panAnchor: THREE.Vector3 | null = null

  /** camera posed at the goal rig state — panning against goals (not the lerped
   *  live camera) makes each correction exact instead of compounding */
  private poseGoalCamera(): THREE.PerspectiveCamera {
    const cam = this.goalCam ??= new THREE.PerspectiveCamera()
    cam.fov = this.camera.fov
    cam.aspect = this.camera.aspect
    cam.updateProjectionMatrix()
    cam.position.set(
      this.camTargetGoal.x + Math.sin(this.yawGoal) * Math.cos(this.pitchGoal) * this.distGoal,
      this.camTargetGoal.y + Math.sin(this.pitchGoal) * this.distGoal,
      this.camTargetGoal.z + Math.cos(this.yawGoal) * Math.cos(this.pitchGoal) * this.distGoal,
    )
    cam.lookAt(this.camTargetGoal)
    cam.updateMatrixWorld()
    return cam
  }

  private groundAtGoal(sx: number, sy: number): THREE.Vector3 | null {
    panRaycaster.setFromCamera(
      new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1),
      this.poseGoalCamera(),
    )
    const out = new THREE.Vector3()
    return panRaycaster.ray.intersectPlane(groundPlane, out) ? out : null
  }

  /** grab the ground point under the pointer; panTo keeps it under the finger.
   *  A grab near the horizon (far outside the framed view) is refused — one
   *  pixel there spans enormous ground distance, so delta panning feels better. */
  panGrab(sx: number, sy: number): void {
    this.cancelCinematic()
    const p = this.groundAtGoal(sx, sy)
    this.panAnchor = p && Math.hypot(p.x - this.camTargetGoal.x, p.z - this.camTargetGoal.z) < this.distGoal * 1.2
      ? p
      : null
  }

  /** returns false when the pointer has no ground under it (caller may fall back to pan()) */
  panTo(sx: number, sy: number): boolean {
    if (!this.panAnchor) return false
    const hit = this.groundAtGoal(sx, sy)
    if (!hit) return false
    let dx = this.panAnchor.x - hit.x
    let dz = this.panAnchor.z - hit.z
    // near the horizon one pixel spans huge ground distance; cap the step
    const cap = this.distGoal * 0.9
    const len = Math.hypot(dx, dz)
    if (len > cap) { dx *= cap / len; dz *= cap / len }
    const wantX = this.camTargetGoal.x + dx
    const wantZ = this.camTargetGoal.z + dz
    this.camTargetGoal.x = clamp(wantX, -this.bounds.x, this.bounds.x)
    this.camTargetGoal.z = clamp(wantZ, -this.bounds.z, this.bounds.z)
    // clamped or capped: re-anchor to what is now under the finger, otherwise
    // the unapplied overshoot must be unwound before a reverse drag responds
    if (len > cap || Math.abs(wantX - this.camTargetGoal.x) > 1e-6 || Math.abs(wantZ - this.camTargetGoal.z) > 1e-6) {
      this.panAnchor = this.groundAtGoal(sx, sy)
    }
    return true
  }

  panRelease(): void {
    this.panAnchor = null
  }

  focusOn(x: number, z: number): void {
    this.camTargetGoal.x = clamp(x, -this.bounds.x, this.bounds.x)
    this.camTargetGoal.z = clamp(z, -this.bounds.z, this.bounds.z)
  }

  /** the board this camera is framing, so a resize can re-fit it */
  private board = { w: 24, h: 14 }

  /**
   * How far back the camera may pull.
   *
   * This used to be a flat 22 (34 in portrait), which silently became a bug the
   * moment the later boards grew: Veilscar needs about 25 to fit, so the map
   * ran off all four edges and no amount of zooming could show it. The ceiling
   * is now whatever the board actually needs, plus room to breathe. It uses the
   * roomier desktop margins on purpose: a ceiling only has to be generous
   * enough never to clamp the fit below what `resetView` asked for.
   */
  private zoomCeiling(mapW: number, mapH: number, lift = 0): number {
    const base = this.camera.aspect < 1 ? 34 : 22
    const t = Math.tan((this.camera.fov * Math.PI / 180) / 2)
    const need = Math.max((mapH * 0.62 + lift) / t, (mapW * 0.56) / t / this.camera.aspect)
    return Math.max(base, need * 1.12)
  }

  /** how much extra depth the tallest set-piece asks the fit to allow for */
  private liftFor(tallest: number): number { return Math.min(tallest, 7) * 0.22 }

  private tallest = 0

  /**
   * @param tallest height of the biggest set-piece on the board, in world
   *   units. The camera looks down, so anything standing on the far rows
   *   projects upward in frame: fitting to the flat board alone sheared the
   *   tops off Mistfen's monoliths. The fit treats the board as deeper by
   *   that height, so a monolith on the back row still reads whole.
   */
  resetView(mapW = 24, mapH = 14, tallest = 0): void {
    this.board = { w: mapW, h: mapH }
    this.tallest = tallest
    this.camTargetGoal.set(0, 0, 0.5)
    this.yawGoal = 0
    this.pitchGoal = 0.98
    // Frame the island. The old margins left roughly a third of a phone screen
    // as empty sky while units rendered 8-14px tall, so short viewports get a
    // tighter fit: the whole board still reads, it just fills the frame.
    const tight = window.innerHeight <= 500 || window.matchMedia('(pointer: coarse)').matches
    const mh = tight ? 0.545 : 0.62
    const mw = tight ? 0.50 : 0.56
    // a set-piece on the far rows projects upward, so the board is framed as
    // if it were deeper by a share of the tallest thing standing on it
    const lift = this.liftFor(tallest)
    const fitH = (mapH * mh + lift) / Math.tan((this.camera.fov * Math.PI / 180) / 2)
    const fitW = (mapW * mw) / Math.tan((this.camera.fov * Math.PI / 180) / 2) / this.camera.aspect
    const maxDist = this.zoomCeiling(mapW, mapH, lift)
    this.maxZoomOut = maxDist
    this.distGoal = clamp(Math.max(fitH, fitW), 10, maxDist)
    this.dist = this.distGoal
    this.yaw = this.yawGoal
    this.pitch = this.pitchGoal
    this.camTarget.copy(this.camTargetGoal)
  }

  /**
   * Dev-only: light a diorama with its own mood.
   *
   * This has to go through the same sky the themes use - setting
   * scene.background alone does nothing, because applyTheme builds a gradient
   * dome that sits in front of it.
   */
  /** a back light used only by dioramas, to edge the subject off the ground */
  private dioRim: THREE.DirectionalLight | null = null

  setDioramaMood(m: { sky: number, ambient: number, key: number, keyIntensity: number, keyDir?: [number, number, number], fill?: number, rim?: number, rimDir?: [number, number, number], rimIntensity?: number, skyTop?: number, skyBottom?: number }): void {
    /*
     * A diorama frames close to the horizon, so the band of sky actually in
     * shot is the dome's *upper* half - the lighter horizon colour sits behind
     * the terrain and is never seen. Deriving both ends from one hue therefore
     * rendered as a flat dead slab. Scenes name both ends themselves.
     */
    const top = new THREE.Color(m.skyTop ?? m.sky)
    const bottom = new THREE.Color(m.skyBottom ?? m.sky).lerp(new THREE.Color(m.ambient), 0.55)
    this.buildSky({ skyTop: top.getHex(), skyBottom: bottom.getHex() } as never)
    this.scene.background = new THREE.Color(m.skyTop ?? m.sky)
    this.scene.fog = new THREE.Fog(bottom.getHex(), 30, 90)
    this.hemi.color.setHex(m.ambient)
    this.hemi.groundColor.setHex(m.ambient)
    this.hemi.intensity = 0.9
    // a dark subject lit from behind is a silhouette, not a portrait, so each
    // scene says where its key comes from
    this.ambient.intensity = m.fill ?? 0.55
    this.sun.color.setHex(m.key)
    this.sun.intensity = m.keyIntensity
    const [kx, ky, kz] = m.keyDir ?? [9, 14, 7]
    this.sun.position.set(kx, ky, kz)
    const sc = this.sun.shadow.camera
    sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18
    sc.updateProjectionMatrix()

    /*
     * Rim light. Flat-shaded voxels lit from one side turn into a single
     * silhouette against a same-value background - which is exactly how the
     * first pass read. A cool back light catches the top and rear faces only,
     * so the subject gets an edge and separates from the ground behind it.
     */
    if (!this.dioRim) {
      this.dioRim = new THREE.DirectionalLight(0xffffff, 0)
      this.scene.add(this.dioRim)
    }
    const [rx, ry, rz] = m.rimDir ?? [-kx, Math.abs(ky) * 0.65, -kz]
    this.dioRim.position.set(rx, ry, rz)
    this.dioRim.color.setHex(m.rim ?? 0xbcd8ff)
    this.dioRim.intensity = m.rimIntensity ?? 0.9
  }

  /** dioramas own the rim light; every other scene must not inherit it */
  clearDioramaRim(): void {
    if (this.dioRim) this.dioRim.intensity = 0
  }

  addShake(strength: number): void {
    // CSS reduced-motion never reached the camera or the effects; a player who
    // asked their system for less movement was still getting shaken
    if (this.reducedMotion) return
    this.shakeAmp = Math.min(0.5, this.shakeAmp + strength)
  }

  /** frame a spot for `hold` seconds, then hand the camera back */
  cinematic(x: number, z: number, dist: number, hold: number, pitch?: number): void {
    if (!this.cineRestore) this.cineRestore = { dist: this.distGoal, pitch: this.pitchGoal }
    this.cineT = Math.max(this.cineT, hold)
    this.focusOn(x, z)
    this.distGoal = clamp(dist, 5.5, this.maxZoomOut)
    if (pitch !== undefined) this.pitchGoal = pitch
  }

  /** the player moved the camera: their input always wins */
  cancelCinematic(): void {
    if (!this.cineRestore) return
    this.cineT = 0
    this.cineRestore = null
  }

  private releaseCinematic(): void {
    if (!this.cineRestore) return
    this.distGoal = this.cineRestore.dist
    this.pitchGoal = this.cineRestore.pitch
    this.cineRestore = null
  }

  updateCamera(dt: number): void {
    this.updateChillBlend(dt)
    if (this.cineT > 0) {
      this.cineT -= dt
      if (this.cineT <= 0) this.releaseCinematic()
    }
    const k = 1 - Math.exp(-dt * 9)
    this.yaw = lerp(this.yaw, this.yawGoal, k)
    this.pitch = lerp(this.pitch, this.pitchGoal, k)
    this.dist = lerp(this.dist, this.distGoal, k)
    this.camTarget.lerp(this.camTargetGoal, k)

    this.shakeT += dt * 30
    const shake = this.shakeAmp
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 1.6)

    const cx = this.camTarget.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist
    const cz = this.camTarget.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist
    const cy = this.camTarget.y + Math.sin(this.pitch) * this.dist
    this.camera.position.set(
      cx + Math.sin(this.shakeT * 1.3) * shake * 0.3,
      cy + Math.sin(this.shakeT * 1.7) * shake * 0.2,
      cz + Math.cos(this.shakeT * 1.1) * shake * 0.3,
    )
    this.camera.lookAt(this.camTarget.x, this.camTarget.y, this.camTarget.z)
    if (this.sky) this.sky.position.copy(this.camera.position)
  }

  render(): void {
    this.watchQuality()
    this.renderer.render(this.scene, this.camera)
  }
}
