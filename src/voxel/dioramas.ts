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
  /** background and key light, so each scene owns its mood */
  mood: { sky: number, ambient: number, key: number, keyIntensity: number, keyDir?: [number, number, number], fill?: number }
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

export const DIORAMAS: DioramaSpec[] = [
  {
    id: 'lastGate',
    title: 'The Last Gate',
    use: 'Key art — the menu, the social card, the thing on a store page',
    mood: { sky: 0x2b1f3d, ambient: 0x8d7ec4, key: 0xffc890, keyIntensity: 1.9, keyDir: [-4, 13, 11], fill: 0.8 },
    camera: { dist: 15, yaw: -0.5, pitch: 0.34, target: [-1.5, 1.6, 0] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 26, 18, 0x4a6b3a, 0x5c4a35)
      road(g, 26, 3.4, 0xc9b083)
      // the keep, dressed as a campaign-worn Hold
      const hold = buildModel(holdModel({ towers: 5, banners: 4, statues: 2, gilding: 2, relics: 1 }), 'dio:hold')
      place(g, hold, 7.5, 0, -1.5, -0.5, 2.2)
      // the line that is holding it
      place(g, buildModel(towerModel('arrow5a'), 'dio:t1'), 2.2, 0, -3.2, 0.5, 1.5)
      place(g, buildModel(towerModel('mage5b'), 'dio:t2'), 1.0, 0, 3.4, -0.3, 1.5)
      place(g, buildModel(towerModel('cannon4a'), 'dio:t3'), 4.6, 0, 3.0, 0.2, 1.4)
      // and what is coming for it
      const foes: [string, number, number][] = [
        ['husk', -4.6, -1.0], ['husk', -5.4, 1.2], ['shield', -3.2, 0.6],
        ['sprinter', -4.0, -1.9], ['gargoyle', -2.2, -1.7],
      ]
      for (const [id, x, z] of foes) {
        const f = enemyMesh(id)
        if (f) place(g, f, x, id === 'gargoyle' ? 1.1 : 0, z, 1.35, 1.5)
      }
      place(g, buildModel(units.juggernautModel(), 'dio:jug'), -7.6, 0, 0.2, 1.25, 2.1)
      place(g, buildModel(env.landmark('spire', rng, 'void'), 'dio:spire'), -6, 0, -6.5, 0.4, 1.3)
      place(g, buildModel(env.pineTree(rng), 'dio:tree1'), 5.5, 0, -6.2, 0, 1.6)
      place(g, buildModel(env.pineTree(rng), 'dio:tree2'), -2.5, 0, 6.4, 0, 1.4)
      return g
    },
  },
  {
    id: 'meadowRoad',
    title: 'The Meadow Road',
    use: 'Map card — one per level, replacing the painted cards',
    mood: { sky: 0x8fd0ee, ambient: 0xbcd8e8, key: 0xfff3d6, keyIntensity: 1.7 },
    camera: { dist: 11.5, yaw: -0.62, pitch: 0.46, target: [0.4, 0.9, 0] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 20, 14, 0x6aa04a, 0x6b5535)
      road(g, 20, 3, 0xd8c08f, 0.5)
      place(g, buildModel(towerModel('arrow3'), 'dio:m1'), -2.4, 0, -3.0, 0.6, 1.5)
      place(g, buildModel(towerModel('barracks2'), 'dio:m2'), 3.0, 0, -2.6, -0.4, 1.5)
      place(g, buildModel(env.landmark('greatTree', rng, 'forest'), 'dio:gt'), 5.6, 0, 3.6, 0, 1.15)
      for (const [x, z, s] of [[-6, 4, 1.5], [-4.4, -5, 1.3], [7, -4.4, 1.4], [1.6, 5.2, 1.2]]) {
        place(g, buildModel(env.pineTree(rng), 'dio:pt'), x, 0, z, 0, s)
      }
      place(g, buildModel(env.rock(rng), 'dio:rk'), -7.4, 0, -1.8, 0.3, 1.8)
      const h = buildModel(units.heroModel(), 'dio:hero')
      place(g, h, -0.6, 0, 1.6, 2.4, 1.7)
      return g
    },
  },
  {
    id: 'theJuggernaut',
    title: 'The Juggernaut',
    use: 'Boss portrait — the dossier card and enemy tooltips',
    mood: { sky: 0x3a1410, ambient: 0xd8905a, key: 0xffb070, keyIntensity: 2.6, keyDir: [-7, 11, 12], fill: 1.15 },
    camera: { dist: 7.4, yaw: -0.42, pitch: 0.26, target: [0, 1.9, 0] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 14, 12, 0x6b4a3f, 0x4a332a)
      road(g, 14, 4, 0xa87a5a)
      place(g, buildModel(units.juggernautModel(), 'dio:jug2'), 0, 0, 0, -0.42, 2.6)
      place(g, buildModel(units.huskModel(), 'dio:h1'), -3.2, 0, 2.2, -0.9, 1.5)
      place(g, buildModel(units.huskModel(), 'dio:h2'), 3.4, 0, 1.9, 0.2, 1.5)
      place(g, buildModel(env.landmark('ruin', rng, 'ember'), 'dio:ruin'), -5.2, 0, -3.4, 0.5, 1.1)
      place(g, buildModel(env.crystalShard(rng), 'dio:cs'), 4.6, 0, -2.8, 0, 1.6)
      return g
    },
  },
  {
    id: 'nightWatch',
    title: 'The Night Watch',
    use: 'Mode art — the Daily, the Three Watches, the Bellfoundry',
    mood: { sky: 0x171a2e, ambient: 0x7a8fc4, key: 0xbcd8ff, keyIntensity: 1.7, keyDir: [-6, 12, 9], fill: 0.85 },
    camera: { dist: 9.6, yaw: -0.72, pitch: 0.4, target: [-0.4, 1.1, 0] },
    build: () => {
      const g = new THREE.Group()
      ground(g, 18, 13, 0x39505f, 0x2a333f)
      road(g, 18, 3.2, 0x6a7383, -0.6)
      place(g, buildModel(towerModel('mage5b'), 'dio:n1'), -1.8, 0, 2.6, 0.4, 1.7)
      place(g, buildModel(towerModel('arrow4a'), 'dio:n2'), 3.6, 0, 2.2, -0.5, 1.6)
      place(g, buildModel(env.landmark('monolith', rng, 'void'), 'dio:mono'), 0.4, 0, -4.2, 0, 1.25)
      place(g, buildModel(env.lampPost(), 'dio:lamp'), -4.6, 0, 0.9, 0, 1.8)
      place(g, buildModel(units.mistwalkerModel(), 'dio:mw'), -2.6, 0, -0.6, 1.55, 1.6)
      place(g, buildModel(units.mistwalkerModel(), 'dio:mw2'), -5.4, 0, -1.1, 1.55, 1.6)
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
