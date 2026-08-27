import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { LevelDef, ThemeId, Rect } from './types.ts'
import { PathsInfo, gridToWorld } from './path.ts'
import { seededRandom, shuffleColor } from '../core/utils.ts'
import { buildModel, box, type VoxBox, type VoxModel } from '../voxel/builder.ts'
import * as env from '../voxel/models_env.ts'
import { TrapSpotInfo, trapSpotModel } from './traps.ts'
import { deriveEarthworkSpots, type EarthworkSpot, type EarthworkKind } from './earthworks.ts'

export interface ThemeColors {
  grass: number
  grassAlt: number
  dirt: number
  road: number
  roadAlt: number
  waterDeep: number
  waterShallow: number
  waterGlow: number     // >0 for lava
  skyTop: number
  skyBottom: number
  fog: number
  sunColor: number
  sunIntensity: number
  hemiSky: number
  hemiGround: number
  ambient: number
}

export const THEMES: Record<ThemeId, ThemeColors> = {
  forest: {
    grass: 0x71b04b, grassAlt: 0x63a041, dirt: 0x7a5c3d, road: 0xc9ad74, roadAlt: 0xbfa066,
    waterDeep: 0x2e6f9e, waterShallow: 0x54aacd, waterGlow: 0,
    skyTop: 0x5ea9e8, skyBottom: 0xcfeaf5, fog: 0xbfe0ef,
    sunColor: 0xfff0d0, sunIntensity: 2.6, hemiSky: 0xbfd9ff, hemiGround: 0x6a8a55, ambient: 0.25,
  },
  winter: {
    grass: 0xe3ecf2, grassAlt: 0xd2dfe8, dirt: 0x8d7f6f, road: 0xb5a689, roadAlt: 0xa89a7e,
    waterDeep: 0x3d7ba8, waterShallow: 0x8fd0e8, waterGlow: 0,
    skyTop: 0x7fb2e0, skyBottom: 0xe8f2f8, fog: 0xdcebf4,
    sunColor: 0xeef4ff, sunIntensity: 2.2, hemiSky: 0xcfe2ff, hemiGround: 0x9aa8b5, ambient: 0.32,
  },
  ember: {
    grass: 0x9c8a60, grassAlt: 0x8a7852, dirt: 0x5f4a3d, road: 0x55483e, roadAlt: 0x4d413a,
    waterDeep: 0xc23f14, waterShallow: 0xff9b2f, waterGlow: 1,
    skyTop: 0x352a4a, skyBottom: 0xc97a55, fog: 0xa8705f,
    sunColor: 0xffcf9f, sunIntensity: 2.1, hemiSky: 0x9a7f98, hemiGround: 0x6f5a45, ambient: 0.3,
  },
  swamp: {
    grass: 0x6f8a4f, grassAlt: 0x5f7a44, dirt: 0x53483a, road: 0x9a8a68, roadAlt: 0x8d7f5e,
    waterDeep: 0x2b4f42, waterShallow: 0x4f7a5f, waterGlow: 0,
    skyTop: 0x6f8fa8, skyBottom: 0xc9d4c0, fog: 0xb2c2ad,
    sunColor: 0xf2e8c9, sunIntensity: 2.0, hemiSky: 0xa8bfb2, hemiGround: 0x5a6a48, ambient: 0.34,
  },
  void: {
    grass: 0x5a5270, grassAlt: 0x4d4660, dirt: 0x352f45, road: 0x8f8aa5, roadAlt: 0x817c96,
    waterDeep: 0x6f2adf, waterShallow: 0xb37aff, waterGlow: 1,
    skyTop: 0x181228, skyBottom: 0x6f4a8f, fog: 0x584a70,
    sunColor: 0xd8c9ff, sunIntensity: 1.9, hemiSky: 0x8f7ab8, hemiGround: 0x453e58, ambient: 0.36,
  },
}

export interface PlotInfo {
  index: number
  cell: [number, number]
  pos: THREE.Vector3
  occupied: boolean
  mesh: THREE.Group
}

const inRects = (c: number, r: number, rects: Rect[]) =>
  rects.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)

export class Terrain {
  group = new THREE.Group()
  plots: PlotInfo[] = []
  trapSpots: TrapSpotInfo[] = []
  earthworkSpots: EarthworkSpot[] = []
  spawnMarkers: THREE.Group[] = []
  castle!: THREE.Group
  theme: ThemeColors
  private waterMat: THREE.ShaderMaterial | null = null
  private clouds: { mesh: THREE.Group, speed: number }[] = []
  private flags: THREE.Object3D[] = []
  private crystals: THREE.Object3D[] = []
  private worldW: number
  private time = 0
  private owned: (THREE.BufferGeometry | THREE.Material)[] = []

  constructor(readonly level: LevelDef, readonly paths: PathsInfo) {
    this.theme = THEMES[level.theme]
    this.worldW = level.width
    const rng = seededRandom(level.seed)
    this.buildGround(rng)
    this.buildPlots()
    this.buildDecorations(rng)
    this.buildEndpoints()
    this.buildClouds(rng)
  }

  private cellKind(c: number, r: number): 'void' | 'water' | 'hill' | 'road' | 'grass' | 'plot' {
    const { level } = this
    if (c < 0 || r < 0 || c >= level.width || r >= level.height) return 'void'
    if (inRects(c, r, level.voids)) return 'void'
    if (this.paths.roadCells.has(`${c},${r}`)) return 'road'
    if (level.plots.some(([pc, pr]) => pc === c && pr === r)) return 'plot'
    if (inRects(c, r, level.water)) return 'water'
    if (inRects(c, r, level.hills)) return 'hill'
    return 'grass'
  }

  /**
   * Make the buildable pads obvious. A newcomer has no reason to know a grey
   * square is a foundation, so the guided first battle lights them.
   */
  pulsePlots(on: boolean): void {
    if (on === this.plotsPulsing) return
    this.plotsPulsing = on
    for (const p of this.plots) {
      p.mesh.traverse(o => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          if (o.material.userData.shared) return
          o.material.emissive.setHex(on ? 0xffd24a : 0x000000)
          o.material.emissiveIntensity = on ? 0.5 : 0
        }
      })
    }
  }

  private plotsPulsing = false

  /** is this cell part of the map's own raised ground? */
  isOnHill(c: number, r: number): boolean {
    return inRects(c, r, this.level.hills)
  }

  cellTop(c: number, r: number): number {
    const k = this.cellKind(c, r)
    return k === 'hill' ? 0.5 : k === 'water' ? -0.4 : 0
  }

  /** can ground units stand here? (flat grass or road) */
  isWalkable(x: number, z: number): boolean {
    const [c, r] = this.worldToCell(x, z)
    const k = this.cellKind(c, r)
    return k === 'grass' || k === 'road'
  }

  worldToCell(x: number, z: number): [number, number] {
    return [Math.round(x + this.level.width / 2 - 0.5), Math.round(z + this.level.height / 2 - 0.5)]
  }

  private cellWalkable(c: number, r: number): boolean {
    const k = this.cellKind(c, r)
    return k === 'grass' || k === 'road'
  }

  /** nearest walkable cell to a point (small BFS ring search) */
  nearestWalkable(x: number, z: number): [number, number] | null {
    const [c0, r0] = this.worldToCell(x, z)
    if (this.cellWalkable(c0, r0)) return [c0, r0]
    for (let radius = 1; radius <= 3; radius++) {
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== radius) continue
          if (this.cellWalkable(c0 + dc, r0 + dr)) return [c0 + dc, r0 + dr]
        }
      }
    }
    return null
  }

  /**
   * A* over walkable cells (4-connected), returning world-space waypoints with
   * a string-pulling pass so units cut corners naturally.
   */
  findPath(fromX: number, fromZ: number, toX: number, toZ: number): THREE.Vector3[] | null {
    const start = this.nearestWalkable(fromX, fromZ)
    const goal = this.nearestWalkable(toX, toZ)
    if (!start || !goal) return null
    const W = this.level.width
    const key = (c: number, r: number) => r * W + c
    const open: { c: number, r: number, f: number }[] = [{ c: start[0], r: start[1], f: 0 }]
    const gScore = new Map<number, number>([[key(start[0], start[1]), 0]])
    const cameFrom = new Map<number, number>()
    const closed = new Set<number>()
    let found = false
    while (open.length > 0) {
      let bi = 0
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
      const cur = open.splice(bi, 1)[0]
      const ck = key(cur.c, cur.r)
      if (closed.has(ck)) continue
      closed.add(ck)
      if (cur.c === goal[0] && cur.r === goal[1]) { found = true; break }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = cur.c + dc, nr = cur.r + dr
        if (!this.cellWalkable(nc, nr)) continue
        const nk = key(nc, nr)
        if (closed.has(nk)) continue
        const g = (gScore.get(ck) ?? 0) + 1
        if (g < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, g)
          cameFrom.set(nk, ck)
          const h = Math.abs(nc - goal[0]) + Math.abs(nr - goal[1])
          open.push({ c: nc, r: nr, f: g + h })
        }
      }
    }
    if (!found) return null
    // reconstruct
    const cells: [number, number][] = []
    let k = key(goal[0], goal[1])
    while (true) {
      cells.push([k % W, Math.floor(k / W)])
      const prev = cameFrom.get(k)
      if (prev === undefined) break
      k = prev
    }
    cells.reverse()
    const pts = cells.map(([c, r]) => {
      const [x, z] = gridToWorld(c, r, W, this.level.height)
      return new THREE.Vector3(x, 0, z)
    })
    // exact endpoints where walkable
    if (this.isWalkable(fromX, fromZ)) pts[0] = new THREE.Vector3(fromX, 0, fromZ)
    if (this.isWalkable(toX, toZ)) pts[pts.length - 1] = new THREE.Vector3(toX, 0, toZ)
    // string pulling: skip waypoints while the direct line stays walkable
    const pulled: THREE.Vector3[] = [pts[0]]
    let anchor = 0
    for (let i = 2; i < pts.length; i++) {
      if (!this.lineWalkable(pts[anchor], pts[i])) {
        pulled.push(pts[i - 1])
        anchor = i - 1
      }
    }
    pulled.push(pts[pts.length - 1])
    return pulled
  }

  private lineWalkable(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dist = Math.hypot(b.x - a.x, b.z - a.z)
    const steps = Math.max(2, Math.ceil(dist / 0.22))
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      if (!this.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false
    }
    return true
  }

  private buildGround(rng: () => number): void {
    const { level } = this
    const t = this.theme
    const geos: THREE.BufferGeometry[] = []
    const color = new THREE.Color()
    const dirtC = new THREE.Color(t.dirt)
    const deepC = new THREE.Color(t.dirt).multiplyScalar(0.55)

    const addBox = (x: number, z: number, y0: number, y1: number, sx: number, sz: number, topColor: number) => {
      const h = y1 - y0
      const geo = new THREE.BoxGeometry(sx, h, sz)
      geo.translate(x, y0 + h / 2, z)
      const count = geo.attributes.position.count
      const colors = new Float32Array(count * 3)
      const pos = geo.attributes.position
      const nor = geo.attributes.normal
      for (let i = 0; i < count; i++) {
        const ny = nor.getY(i)
        if (ny > 0.5) {
          color.set(topColor)
        } else if (ny < -0.5) {
          color.copy(deepC)
        } else {
          // side: grass lip near top, dirt fading darker downward
          const py = pos.getY(i)
          const depth = (y1 - py) / Math.max(0.4, y1 - y0)
          if (py > y1 - 0.16) color.set(topColor).multiplyScalar(0.82)
          else color.copy(dirtC).lerp(deepC, Math.min(1, depth * 0.9))
        }
        colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geos.push(geo)
    }

    const waterCells: [number, number][] = []
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        const kind = this.cellKind(c, r)
        if (kind === 'void') continue
        const [x, z] = gridToWorld(c, r, level.width, level.height)
        // edge cells hang deeper for the floating-island silhouette
        const edge = ['void'].includes(this.cellKind(c + 1, r)) || ['void'].includes(this.cellKind(c - 1, r))
          || ['void'].includes(this.cellKind(c, r + 1)) || ['void'].includes(this.cellKind(c, r - 1))
          || c === 0 || r === 0 || c === level.width - 1 || r === level.height - 1
        const bottom = edge ? -1.6 - rng() * 0.9 : -1.2
        switch (kind) {
          case 'road':
            addBox(x, z, bottom, 0.02, 1, 1, shuffleColor(rng() < 0.5 ? t.road : t.roadAlt, 0.06, rng))
            break
          case 'water':
            addBox(x, z, bottom, -0.4, 1, 1, shuffleColor(0xcbba8a, 0.08, rng)) // sandy bed
            waterCells.push([x, z])
            break
          case 'hill':
            addBox(x, z, bottom, 0.5, 1, 1, shuffleColor(rng() < 0.5 ? t.grass : t.grassAlt, 0.07, rng))
            break
          default:
            addBox(x, z, bottom, 0, 1, 1, shuffleColor(rng() < 0.5 ? t.grass : t.grassAlt, 0.07, rng))
        }
        // hanging bedrock chunks under some edge cells
        if (edge && rng() < 0.4) {
          const s = 0.4 + rng() * 0.35
          addBox(x + (rng() - 0.5) * 0.3, z + (rng() - 0.5) * 0.3, bottom - 0.9 - rng() * 0.7, bottom, s, s, 0x6b6155)
        }
      }
    }
    const merged = mergeGeometries(geos)
    geos.forEach(g => g.dispose())
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    const mesh = new THREE.Mesh(merged, mat)
    mesh.receiveShadow = true
    mesh.castShadow = true
    this.group.add(mesh)
    this.owned.push(merged, mat)

    // water surface: merged quads with an animated shader
    if (waterCells.length > 0) {
      const wgeos: THREE.BufferGeometry[] = []
      for (const [x, z] of waterCells) {
        const gq = new THREE.PlaneGeometry(1, 1, 2, 2)
        gq.rotateX(-Math.PI / 2)
        gq.translate(x, -0.18, z)
        wgeos.push(gq)
      }
      const wmerged = mergeGeometries(wgeos)
      wgeos.forEach(g => g.dispose())
      this.waterMat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uDeep: { value: new THREE.Color(t.waterDeep) },
          uShallow: { value: new THREE.Color(t.waterShallow) },
          uGlow: { value: t.waterGlow },
        },
        vertexShader: /* glsl */`
          uniform float uTime;
          varying vec2 vXZ;
          void main() {
            vec3 p = position;
            p.y += sin(p.x * 3.1 + uTime * 1.7) * 0.03 + cos(p.z * 2.7 + uTime * 1.3) * 0.03;
            vXZ = p.xz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform float uTime;
          uniform vec3 uDeep;
          uniform vec3 uShallow;
          uniform float uGlow;
          varying vec2 vXZ;
          void main() {
            float w = sin(vXZ.x * 4.0 + uTime * 1.9) * 0.5 + cos(vXZ.y * 3.4 + uTime * 1.4) * 0.5;
            w = w * 0.5 + 0.5;
            vec3 col = mix(uDeep, uShallow, w);
            float sparkle = step(0.965, fract(sin(dot(floor(vXZ * 9.0), vec2(12.9898, 78.233))) * 43758.5453) + 0.02 * sin(uTime * 3.0 + vXZ.x * 20.0));
            col += sparkle * 0.35;
            col *= 1.0 + uGlow * 1.2;
            gl_FragColor = vec4(col, uGlow > 0.5 ? 0.96 : 0.82);
          }`,
      })
      const wmesh = new THREE.Mesh(wmerged, this.waterMat)
      wmesh.renderOrder = 1
      this.group.add(wmesh)
      this.owned.push(wmerged, this.waterMat)
    }
  }

  private buildPlots(): void {
    const { level } = this
    level.plots.forEach(([c, r], i) => {
      const [x, z] = gridToWorld(c, r, level.width, level.height)
      const mesh = buildModel(plotVox(), 'plot', { castShadow: false, receiveShadow: true, cloneMaterials: true })
      mesh.position.set(x, 0, z)
      this.group.add(mesh)
      this.plots.push({ index: i, cell: [c, r], pos: new THREE.Vector3(x, 0.1, z), occupied: false, mesh })
    })
    ;(level.trapSpots ?? []).forEach(([c, r], i) => {
      if (!this.paths.roadCells.has(`${c},${r}`)) {
        console.warn(`level ${level.id}: trap spot [${c},${r}] is not on a road`)
      }
      const [x, z] = gridToWorld(c, r, level.width, level.height)
      const mesh = buildModel(trapSpotModel(), 'trapspot', { castShadow: false, receiveShadow: true })
      mesh.position.set(x, 0.01, z)
      this.group.add(mesh)
      this.trapSpots.push({ index: i, cell: [c, r], pos: new THREE.Vector3(x, 0.03, z), occupied: false, mesh })
    })
    // earthworks are derived from the map's own shape, so the seven existing
    // levels get them without being re-authored
    const isTrap = (c: number, r: number) => (level.trapSpots ?? []).some(([tc, tr]) => tc === c && tr === r)
    deriveEarthworkSpots(level, (c, r) => this.cellKind(c, r), isTrap).forEach((e, i) => {
      const [x, z] = gridToWorld(e.cell[0], e.cell[1], level.width, level.height)
      const mesh = buildModel(earthMarkerModel(e.kind), `earthmark:${e.kind}`, { castShadow: false, receiveShadow: true })
      mesh.position.set(x, 0.012, z)
      this.group.add(mesh)
      this.earthworkSpots.push({
        index: i, kind: e.kind, cell: e.cell,
        pos: new THREE.Vector3(x, 0.02, z), occupied: false, mesh,
      })
    })
  }

  private buildDecorations(rng: () => number): void {
    const { level } = this
    const theme = level.theme
    for (let r = 0; r < level.height; r++) {
      for (let c = 0; c < level.width; c++) {
        const kind = this.cellKind(c, r)
        if (kind !== 'grass' && kind !== 'hill') continue
        // keep a clear margin around roads so decorations never block the view of walkers
        const nearRoad = this.paths.roadCells.has(`${c},${r - 1}`) || this.paths.roadCells.has(`${c},${r + 1}`)
          || this.paths.roadCells.has(`${c - 1},${r}`) || this.paths.roadCells.has(`${c + 1},${r}`)
        const roll = rng()
        const density = nearRoad ? 0.10 : 0.34
        if (roll > density) continue
        const [x, z] = gridToWorld(c, r, level.width, level.height)
        const y = this.cellTop(c, r)
        const pickRoll = rng()
        let model
        if (theme === 'ember') {
          model = pickRoll < 0.3 ? env.deadTree(rng) : pickRoll < 0.55 ? env.rock(rng)
            : pickRoll < 0.72 ? env.crystalShard(rng) : pickRoll < 0.85 ? env.stump(rng) : env.bush(rng)
        } else if (theme === 'swamp') {
          model = pickRoll < 0.3 ? env.deadTree(rng) : pickRoll < 0.5 ? env.roundTree(rng)
            : pickRoll < 0.68 ? env.bush(rng) : pickRoll < 0.8 ? env.rock(rng)
            : pickRoll < 0.92 ? env.flowers(rng) : env.stump(rng)
        } else if (theme === 'void') {
          model = pickRoll < 0.34 ? env.crystalShard(rng, [0xb37aff, 0x7fd4ff]) : pickRoll < 0.6 ? env.rock(rng)
            : pickRoll < 0.82 ? env.deadTree(rng) : env.stump(rng)
        } else {
          model = pickRoll < 0.34 ? env.pineTree(rng) : pickRoll < 0.52 ? env.roundTree(rng)
            : pickRoll < 0.65 ? env.rock(rng) : pickRoll < 0.78 ? env.bush(rng)
            : pickRoll < 0.94 ? env.flowers(rng) : env.stump(rng)
        }
        if (theme === 'winter') snowify(model)
        const mesh = buildModel(model, `deco:${level.id}:${c},${r}`)
        mesh.position.set(x + (rng() - 0.5) * 0.35, y, z + (rng() - 0.5) * 0.35)
        mesh.rotation.y = rng() * Math.PI * 2
        const s = 0.8 + rng() * 0.4
        mesh.scale.setScalar(s)
        this.group.add(mesh)
        if ((theme === 'ember' && pickRoll >= 0.55 && pickRoll < 0.72) ||
            (theme === 'void' && pickRoll < 0.34)) this.crystals.push(mesh)
      }
    }
    // lamps along the road
    let lampCounter = 0
    for (const key of this.paths.roadCells) {
      lampCounter++
      if (lampCounter % 7 !== 3) continue
      const [c, r] = key.split(',').map(Number)
      // put lamp on an adjacent grass cell
      const spots: [number, number][] = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]
      const spot = spots.find(([cc, rr]) => this.cellKind(cc, rr) === 'grass')
      if (!spot) continue
      const [x, z] = gridToWorld(spot[0], spot[1], level.width, level.height)
      const lamp = buildModel(env.lampPost(), 'lamp')
      const [rx, rz] = gridToWorld(c, r, level.width, level.height)
      lamp.position.set(x + (rx - x) * 0.45, 0, z + (rz - z) * 0.45)
      this.group.add(lamp)
    }
  }

  private buildEndpoints(): void {
    const { level, paths } = this
    level.lanes.forEach((lane, i) => {
      const start = paths.lanes[i].sample(0)
      const next = paths.lanes[i].sample(0.6)
      const portal = buildModel(env.spawnPortal(level.theme), `portal:${level.theme}`)
      portal.position.set(start.x, 0, start.z)
      portal.rotation.y = Math.atan2(next.x - start.x, next.z - start.z)
      portal.scale.setScalar(1.35)
      this.group.add(portal)
      this.spawnMarkers.push(portal)
    })
    // castle at the shared end of lane 0, pulled slightly onto the island
    const lane0 = paths.lanes[0]
    const end = lane0.sample(lane0.length)
    const before = lane0.sample(lane0.length - 0.8)
    const castle = buildModel(env.exitCastle(level.theme), `castle:${level.theme}`)
    const inward = new THREE.Vector2(end.x - before.x, end.z - before.z).normalize()
    castle.position.set(end.x + inward.x * 0.15, 0, end.z + inward.y * 0.15)
    castle.rotation.y = Math.atan2(before.x - end.x, before.z - end.z)
    this.group.add(castle)
    this.castle = castle
    const flag = castle.children.find(c => c.name === 'flag')
    if (flag) this.flags.push(flag)
  }

  private buildClouds(rng: () => number): void {
    // clouds drift in the sky-sea AROUND the island, never over the battlefield
    const w = this.level.width, h = this.level.height
    for (let i = 0; i < 6; i++) {
      const mesh = buildModel(env.cloud(rng), `cloud:${this.level.id}:${i}`, { castShadow: false })
      const side = i % 2 === 0 ? -1 : 1
      mesh.position.set(
        (rng() - 0.5) * w * 1.6,
        side < 0 ? -1.5 - rng() * 2 : 4 + rng() * 3,   // some below the island, some above the horizon
        side * (h * 0.62 + 1.5 + rng() * 4),
      )
      mesh.scale.set(1.5, 0.7, 1.5)
      mesh.traverse(o => {
        if (o instanceof THREE.Mesh) {
          o.material = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 1, depthWrite: false })
          o.castShadow = false
          this.owned.push(o.material)
        }
      })
      this.group.add(mesh)
      this.clouds.push({ mesh, speed: 0.12 + rng() * 0.15 })
    }
  }

  /** release instance-owned GPU resources; cached voxel geometry stays */
  dispose(): void {
    for (const r of this.owned) r.dispose()
    this.owned = []
  }

  update(dt: number): void {
    this.time += dt
    if (this.waterMat) this.waterMat.uniforms.uTime.value = this.time
    for (const c of this.clouds) {
      c.mesh.position.x += c.speed * dt
      if (c.mesh.position.x > this.worldW * 0.75) c.mesh.position.x = -this.worldW * 0.75
    }
    for (const f of this.flags) {
      f.rotation.y = Math.sin(this.time * 2.2) * 0.18
    }
    for (const c of this.crystals) {
      c.scale.y = 1 + Math.sin(this.time * 1.8 + c.position.x) * 0.05
    }
  }
}

function earthMarkerModel(kind: EarthworkKind): VoxModel {
  const c = kind === 'rampart' ? 0x7a6a44 : 0x4a5a6a
  // lifted clear of y=0 so the corner marks do not z-fight the ground
  const mark: VoxBox[] = [
    box(0, 0.12, -4.2, 3.0, 0.14, 0.5, c),
    box(0, 0.12, 4.2, 3.0, 0.14, 0.5, c),
    box(-4.2, 0.12, 0, 0.5, 0.14, 3.0, c),
    box(4.2, 0.12, 0, 0.5, 0.14, 3.0, c),
  ]
  return { parts: { mark }, scale: 0.1 }
}

function plotVox() {
  return {
    parts: {
      base: [
        { x: 0, y: 0.35, z: 0, sx: 10, sy: 0.7, sz: 10, c: 0x8d8776 },
        { x: 0, y: 0.75, z: 0, sx: 8.6, sy: 0.35, sz: 8.6, c: 0xa39c88 },
        { x: -3.4, y: 0.95, z: -3.4, sx: 1.2, sy: 0.3, sz: 1.2, c: 0x76705f },
        { x: 3.4, y: 0.95, z: 3.4, sx: 1.2, sy: 0.3, sz: 1.2, c: 0x76705f },
        { x: 3.4, y: 0.95, z: -3.4, sx: 1.2, sy: 0.3, sz: 1.2, c: 0x76705f },
        { x: -3.4, y: 0.95, z: 3.4, sx: 1.2, sy: 0.3, sz: 1.2, c: 0x76705f },
      ],
    },
  }
}

/** dust snow on top surfaces of a decoration model */
function snowify(model: { parts: Record<string, { x: number, y: number, z: number, sx: number, sy: number, sz: number, c: number, glow?: boolean }[]> }): void {
  for (const part of Object.values(model.parts)) {
    const tops = [...part].sort((a, b) => (b.y + b.sy / 2) - (a.y + a.sy / 2)).slice(0, 2)
    for (const t of tops) {
      if (t.glow) continue
      part.push({ x: t.x, y: t.y + t.sy / 2 + 0.15, z: t.z, sx: t.sx * 0.96, sy: 0.3, sz: t.sz * 0.96, c: 0xeef4f8 })
    }
  }
}
