import * as THREE from 'three'
import type { EnemyDef } from '../game/types.ts'
import { enemyModelFactories } from '../game/units.ts'
import { buildModel, disposeClonedMaterials } from '../voxel/builder.ts'
import { prefersReducedMotion } from '../core/platform.ts'

/**
 * A new enemy, turning slowly on a stone plinth inside its introduction card.
 *
 * A name and a paragraph describe a threat; the model is what the player will
 * actually have to recognise on the road a moment later. The card already
 * pauses the battle, so this small view has the GPU to itself while it is
 * open. It runs in its own little renderer, released the moment the card
 * closes; if WebGL cannot start, the card simply keeps its text.
 *
 * Returns a function that stops and frees everything.
 */
export function mountPedestal(host: HTMLElement, def: EnemyDef): () => void {
  const factory = enemyModelFactories[def.model]
  if (!factory) return () => {}
  const canvas = document.createElement('canvas')
  canvas.className = 'pedestal-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  } catch {
    return () => {}
  }
  host.appendChild(canvas)
  host.classList.add('has-pedestal')
  // a boss portrait stood in while this loaded; the backdrop takes over now
  const portrait = host.style.backgroundImage
  host.style.backgroundImage = ''
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x5a4a38, 1.1))
  const key = new THREE.DirectionalLight(0xfff0d0, 2.4)
  key.position.set(-3, 6, 5)
  const rim = new THREE.DirectionalLight(0xffc46b, 1.4)
  rim.position.set(4, 3, -5)
  scene.add(key, rim)

  // the plinth: a worn stone block on a wider step, gold-trimmed like the HUD
  const owned: { dispose(): void }[] = []
  const stone = (w: number, h: number, d: number, color: number, y: number) => {
    const g = new THREE.BoxGeometry(w, h, d), m = new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
    owned.push(g, m)
    const mesh = new THREE.Mesh(g, m)
    mesh.position.y = y
    return mesh
  }
  const plinth = new THREE.Group()
  plinth.add(stone(2.3, 0.28, 2.3, 0x5d5446, -0.14), stone(1.9, 0.5, 1.9, 0x8d8776, -0.53), stone(1.98, 0.08, 1.98, 0xc9850f, -0.04))
  plinth.position.y = 0
  scene.add(plinth)

  const turn = new THREE.Group()
  const model = buildModel(factory(), `enemy:${def.model}`, { cloneMaterials: true, castShadow: false, receiveShadow: false })
  if (def.tint !== undefined) {
    model.traverse(o => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && !o.material.userData.shared) {
        o.material.emissive.set(def.tint!)
        o.material.emissiveIntensity = 0.28
      }
    })
  }
  // stand it on the plinth, sized to fill the frame whatever its real size
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3())
  // wings and tails may sweep a little past the plinth as it turns; height may not
  const fit = 1.7 / Math.max(size.x * 0.85, size.z * 0.85, size.y * 0.8)
  model.scale.setScalar(fit)
  box.setFromObject(model)
  const lift = def.flying ? 0.35 : 0
  model.position.set(-(box.min.x + box.max.x) / 2, -box.min.y + lift, -(box.min.z + box.max.z) / 2)
  turn.add(model)
  turn.rotation.y = -0.6
  scene.add(turn)

  const height = box.max.y - box.min.y + lift
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50)
  const aim = new THREE.Vector3(0, Math.max(0.2, height * 0.42), 0)
  const distance = 3.7 + Math.max(0, height - 1.2) * 2.1
  camera.position.set(0, aim.y + distance * 0.32, distance)
  camera.lookAt(aim)

  const size2 = () => {
    const w = host.clientWidth || 140, h = host.clientHeight || 140
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  size2()

  const still = prefersReducedMotion()
  let raf = 0, last = performance.now(), t = 0
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    if (!still) {
      turn.rotation.y += dt * 0.7
      if (def.flying) model.position.y = -box.min.y + lift + Math.sin(t * 2) * 0.06
    }
    renderer.render(scene, camera)
    raf = still ? 0 : requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    disposeClonedMaterials(model)
    for (const o of owned) o.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
    host.classList.remove('has-pedestal')
    host.style.backgroundImage = portrait
  }
}
