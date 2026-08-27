import * as THREE from 'three'
import { buildModel } from './builder.ts'
import { towerModel } from './models_towers.ts'
import * as units from './models_units.ts'
import * as env from './models_env.ts'
import { holdModel } from '../game/hold.ts'

/**
 * Dioramas: the game's own voxel work, staged.
 *
 * The painted key art sells monumental fantasy while the game delivers small
 * code-built toys, and the gap between the two is the weakest thing about how
 * Blockhold presents itself. These are the alternative: scenes composed from
 * the actual models the game renders, lit and framed deliberately, so the
 * product's face and its gameplay are finally the same visual language.
 *
 * They are built from what already exists rather than authored fresh, which is
 * the whole argument - if the voxel work cannot carry a poster, it cannot
 * carry the game either.
 */

export type DioramaId = 'lastGate' | 'meadowRoad' | 'theJuggernaut' | 'nightWatch'

export interface DioramaSpec {
  id: DioramaId
  title: string
  /** what this would actually be used for */
  use: string
  build: () => THREE.Group
  /** camera: distance, yaw, pitch, and what to look at */
  camera: { dist: number, yaw: number, pitch: number, target: [number, number, number] }
  /** background and lights, so each scene owns its mood */
  mood: {
    sky: number, ambient: number, key: number, keyIntensity: number,
    keyDir?: [number, number, number], fill?: number,
    /** back light that edges the subject off the ground */
    rim?: number, rimDir?: [number, number, number], rimIntensity?: number,
    /** both ends of the sky gradient; a diorama only ever sees the upper band */
    skyTop?: number, skyBottom?: number,
  }
}

const place = (g: THREE.Group, m: THREE.Object3D, x: number, y: number, z: number, ry = 0, s = 1) => {
  m.position.set(x, y, z)
  m.rotation.y = ry
  m.scale.setScalar(s)
  g.add(m)
  return m
}

/** a patch of ground to stand a scene on */
function ground(g: THREE.Group, w: number, d: number, top: number, side: number): void {
  const geo = new THREE.BoxGeometry(w, 1.2, d)
  geo.translate(0, -0.6, 0)
  const mats = [
    new THREE.MeshStandardMaterial({ color: side }),
    new THREE.MeshStandardMaterial({ color: side }),
    new THREE.MeshStandardMaterial({ color: top }),
    new THREE.MeshStandardMaterial({ color: side }),
    new THREE.MeshStandardMaterial({ color: side }),
    new THREE.MeshStandardMaterial({ color: side }),
  ]
  const mesh = new THREE.Mesh(geo, mats)
  mesh.receiveShadow = true
  g.add(mesh)
}

/** a stretch of road running through a scene */
function road(g: THREE.Group, len: number, width: number, color: number, z = 0): void {
  const geo = new THREE.BoxGeometry(len, 0.08, width)
  geo.translate(0, 0.04, z)
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color })))
}

const rng = () => 0.5   // dioramas are posed, not random

/**
 * Scatter a prop along a line, shrinking with distance.
 *
 * The first pass placed a handful of objects on an empty plane, which read as
 * a test scene rather than a picture: a diorama needs foreground, midground
 * and background doing different jobs. These fill the depth layers cheaply.
 */
function row(
  g: THREE.Group, make: () => THREE.Object3D,
  from: [number, number], to: [number, number], n: number, scale: number, jitter = 0,
): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const x = from[0] + (to[0] - from[0]) * t + (i % 2 ? jitter : -jitter)
    const z = from[1] + (to[1] - from[1]) * t
    place(g, make(), x, 0, z, (i % 4) * 0.6, scale * (1 - t * 0.18))
  }
}

export const DIORAMAS: DioramaSpec[] = [
  {
    id: 'lastGate',
    title: 'The Last Gate',
    use: 'Key art - the menu, the social card, the thing on a store page',
    mood: {
      sky: 0x241a36, skyTop: 0x3b2a63, skyBottom: 0xd8896b, ambient: 0x8f7cc8,
      key: 0xffc890, keyIntensity: 2.2,
      keyDir: [-5, 12, 9], fill: 0.62, rim: 0x9db4ff, rimDir: [7, 6, -9], rimIntensity: 1.5,
    },
    camera: { dist: 15.5, yaw: -0.44, pitch: 0.46, target: [-0.4, 1.3, -0.4] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 34, 24, 0x44643a, 0x53422f)
      road(g, 34, 3.6, 0xc9b083)
      // the keep, dressed as a campaign-worn Hold, anchoring the right third
      const hold = buildModel(holdModel({ towers: 5, banners: 4, statues: 2, gilding: 2, relics: 1 }), 'dio:hold')
      place(g, hold, 7.2, 0, -1.6, -0.62, 2.3)
      // the line that is holding it
      place(g, buildModel(towerModel('arrow5a'), 'dio:t1'), 2.8, 0, -3.4, 0.55, 1.55)
      place(g, buildModel(towerModel('mage5b'), 'dio:t2'), 1.6, 0, 3.2, -0.35, 1.55)
      place(g, buildModel(towerModel('cannon4a'), 'dio:t3'), 5.0, 0, 2.9, 0.2, 1.45)
      // and what is coming for it: a column, not a scatter
      const foes: [string, number, number][] = [
        ['husk', -2.6, -1.2], ['husk', -3.6, 1.4], ['shield', -1.6, 0.4],
        ['sprinter', -2.2, -2.2], ['husk', -4.8, -0.5], ['shield', -4.2, 2.3],
        ['sprinter', -6.0, 1.5], ['husk', -6.4, -1.7],
      ]
      for (const [id, x, z] of foes) {
        const f = enemyMesh(id)
        if (f) place(g, f, x, 0, z, 1.35, 1.5)
      }
      place(g, buildModel(units.gargoyleModel(), 'dio:gar'), -1.8, 2.6, -3.2, 1.35, 1.45)
      place(g, buildModel(units.gargoyleModel(), 'dio:gar2'), -4.6, 3.2, 2.9, 1.2, 1.35)
      place(g, buildModel(units.juggernautModel(), 'dio:jug'), -5.4, 0, 0.1, 1.32, 2.5)
      // background: a treeline and a spire give the sky something to sit on
      place(g, buildModel(env.landmark('spire', rng, 'void'), 'dio:spire'), -7.6, 0, -7.4, 0.4, 1.5)
      place(g, buildModel(env.landmark('arch', rng, 'forest'), 'dio:arch'), 2.6, 0, -8.2, 0.15, 1.25)
      row(g, () => buildModel(env.pineTree(rng), 'dio:bg'), [-12, -9.6], [12, -10.4], 10, 1.8, 0.5)
      row(g, () => buildModel(env.pineTree(rng), 'dio:fg'), [-10, 6.2], [10, 6.8], 7, 2.0, 0.6)
      place(g, buildModel(env.rock(rng), 'dio:rk1'), -8.2, 0, 4.2, 0.3, 2.0)
      place(g, buildModel(env.rock(rng), 'dio:rk2'), 8.0, 0, 4.8, 0.9, 1.7)
      // cloud bank: the upper band is half the frame, and it cannot be empty
      for (const [x, y, z, sc] of [[-7, 7.4, -6, 2.2], [4.5, 8.6, -7, 2.6], [-1, 9.4, -9, 2.0]]) {
        place(g, buildModel(env.cloud(rng), 'dio:cl'), x, y, z, 0, sc)
      }
      return g
    },
  },
  {
    id: 'meadowRoad',
    title: 'The Meadow Road',
    use: 'Map card — one per level, replacing the painted cards',
    mood: {
      sky: 0x8fd0ee, skyTop: 0x4d9fd6, skyBottom: 0xcfeaf7, ambient: 0xbcd8e8,
      key: 0xfff3d6, keyIntensity: 2.0, keyDir: [-6, 13, 8], fill: 0.62,
      rim: 0xbfe4ff, rimDir: [8, 5, -8], rimIntensity: 1.1,
    },
    camera: { dist: 12.5, yaw: -0.58, pitch: 0.44, target: [0.2, 1.1, -0.3] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 30, 22, 0x6aa04a, 0x6b5535)
      road(g, 30, 3, 0xd8c08f, 0.5)
      place(g, buildModel(towerModel('arrow3'), 'dio:m1'), -2.4, 0, -3.0, 0.6, 1.5)
      place(g, buildModel(towerModel('barracks2'), 'dio:m2'), 3.0, 0, -2.6, -0.4, 1.5)
      place(g, buildModel(env.landmark('greatTree', rng, 'forest'), 'dio:gt'), 5.6, 0, 3.6, 0, 1.15)
      for (const [x, z, s] of [[-6, 4, 1.5], [-4.4, -5, 1.3], [7, -4.4, 1.4], [1.6, 5.2, 1.2]]) {
        place(g, buildModel(env.pineTree(rng), 'dio:pt'), x, 0, z, 0, s)
      }
      place(g, buildModel(env.rock(rng), 'dio:rk'), -7.4, 0, -1.8, 0.3, 1.8)
      const h = buildModel(units.heroModel(), 'dio:hero')
      place(g, h, -0.6, 0, 1.7, -0.58, 2.1)
      // depth: a treeline behind, a framing hedge in front
      row(g, () => buildModel(env.pineTree(rng), 'dio:mbg'), [-11, -8.6], [11, -9.2], 9, 1.7, 0.4)
      row(g, () => buildModel(env.bush(rng), 'dio:mfg'), [-9, 5.8], [9, 6.2], 8, 1.9, 0.5)
      for (const [x, y, z, sc] of [[-6, 7.0, -6, 2.1], [5, 8.2, -7, 2.4]]) {
        place(g, buildModel(env.cloud(rng), 'dio:mcl'), x, y, z, 0, sc)
      }
      return g
    },
  },
  {
    id: 'theJuggernaut',
    title: 'The Juggernaut',
    use: 'Boss portrait — the dossier card and enemy tooltips',
    mood: {
      sky: 0x3a1410, skyTop: 0x5c1d12, skyBottom: 0xff9a4a, ambient: 0xd8905a,
      key: 0xffb070, keyIntensity: 2.8, keyDir: [-7, 11, 12], fill: 0.95,
      rim: 0xff7038, rimDir: [6, 5, -10], rimIntensity: 2.4,
    },
    camera: { dist: 8.2, yaw: -0.34, pitch: 0.3, target: [0, 2.1, -0.2] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 26, 20, 0x6b4a3f, 0x4a332a)
      road(g, 26, 4, 0xa87a5a)
      place(g, buildModel(units.juggernautModel(), 'dio:jug2'), 0, 0, 0, -0.42, 2.6)
      place(g, buildModel(units.huskModel(), 'dio:h1'), -3.2, 0, 2.2, -0.9, 1.5)
      place(g, buildModel(units.huskModel(), 'dio:h2'), 3.4, 0, 1.9, 0.2, 1.5)
      place(g, buildModel(env.landmark('ruin', rng, 'ember'), 'dio:ruin'), -5.2, 0, -3.4, 0.5, 1.1)
      place(g, buildModel(env.crystalShard(rng), 'dio:cs'), 4.6, 0, -2.8, 0, 1.6)
      // a ruined skyline so the boss has something to be bigger than
      place(g, buildModel(env.landmark('ruin', rng, 'ember'), 'dio:ru2'), 6.4, 0, -6.2, 1.2, 1.3)
      place(g, buildModel(env.landmark('spire', rng, 'ember'), 'dio:sp2'), -6.8, 0, -7.4, 0.3, 1.4)
      row(g, () => buildModel(env.deadTree(rng), 'dio:jdt'), [-9, -5.4], [9, -5.8], 7, 1.6, 0.5)
      row(g, () => buildModel(env.rock(rng), 'dio:jfg'), [-8, 5.0], [8, 5.4], 6, 1.7, 0.6)
      return g
    },
  },
  {
    id: 'nightWatch',
    title: 'The Night Watch',
    use: 'Mode art — the Daily, the Three Watches, the Bellfoundry',
    mood: {
      sky: 0x171a2e, skyTop: 0x1b2145, skyBottom: 0x4b5a9c, ambient: 0x8298cc,
      key: 0xbcd8ff, keyIntensity: 1.9, keyDir: [-6, 12, 9], fill: 0.7,
      rim: 0x7fe0ff, rimDir: [7, 5, -9], rimIntensity: 1.8,
    },
    camera: { dist: 10.8, yaw: -0.66, pitch: 0.42, target: [-0.3, 1.3, -0.3] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 28, 20, 0x39505f, 0x2a333f)
      road(g, 28, 3.2, 0x6a7383, -0.6)
      place(g, buildModel(towerModel('mage5b'), 'dio:n1'), -1.8, 0, 2.6, 0.4, 1.7)
      place(g, buildModel(towerModel('arrow4a'), 'dio:n2'), 3.6, 0, 2.2, -0.5, 1.6)
      place(g, buildModel(env.landmark('monolith', rng, 'void'), 'dio:mono'), 0.4, 0, -4.2, 0, 1.25)
      place(g, buildModel(env.lampPost(), 'dio:lamp'), -4.6, 0, 0.9, 0, 1.8)
      place(g, buildModel(units.mistwalkerModel(), 'dio:mw'), -2.6, 0, -0.6, 1.55, 1.6)
      place(g, buildModel(units.mistwalkerModel(), 'dio:mw2'), -5.4, 0, -1.1, 1.55, 1.6)
      place(g, buildModel(env.lampPost(), 'dio:lamp2'), 4.2, 0, -2.4, 0, 1.7)
      row(g, () => buildModel(env.deadTree(rng), 'dio:nbg'), [-10, -7.2], [10, -7.6], 8, 1.7, 0.5)
      row(g, () => buildModel(env.rock(rng), 'dio:nfg'), [-8, 5.4], [8, 5.8], 6, 1.6, 0.6)
      return g
    },
  },
]

function enemyMesh(id: string): THREE.Group | null {
  const map: Record<string, () => { parts: Record<string, unknown[]> }> = {
    husk: units.huskModel as never,
    shield: units.shieldGruntModel as never,
    sprinter: units.sprinterModel as never,
    gargoyle: units.gargoyleModel as never,
  }
  const f = map[id]
  return f ? buildModel(f() as never, `dio:e:${id}`) : null
}

export function dioramaById(id: DioramaId): DioramaSpec {
  return DIORAMAS.find(d => d.id === id) ?? DIORAMAS[0]
}
