import * as THREE from 'three'
import type { Engine } from '../core/engine.ts'
import { HOLD_WIDTH, HOLD_HEIGHT, holdFootprint, type HoldSnapshot, type HoldPlacement } from '../core/holdData.ts'
import { buildModel, box, disposeClonedMaterials } from '../voxel/builder.ts'
import { THEMES } from '../game/terrain.ts'
import { keepModel, pieceGroup } from './models.ts'

export class HoldScene {
  readonly group = new THREE.Group()
  private pieces = new THREE.Group()
  private floor: THREE.Group | null = null
  private keep: THREE.Group | null = null
  private ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf2ce7e, transparent: true, opacity: .35, depthWrite: false }))
  private grid: THREE.LineSegments
  private ghost: THREE.Group | null = null
  private ray = new THREE.Raycaster()
  private snapshot!: HoldSnapshot
  private camera: { dist: number, pitch: number, yaw: number, target: THREE.Vector3 }
  constructor(readonly engine: Engine, snapshot: HoldSnapshot, private restoreBackdrop: () => void, private lobby = false) {
    this.group.name = 'your-hold'
    this.camera = { dist: engine.distGoal, pitch: engine.pitchGoal, yaw: engine.yawGoal, target: engine.camTargetGoal.clone() }
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.ring.renderOrder = 5
    const positions: number[] = []
    for (let i = 0; i <= HOLD_WIDTH; i++) positions.push(i - 6.5, .018, -5.5, i - 6.5, .018, 5.5)
    for (let i = 0; i <= HOLD_HEIGHT; i++) positions.push(-6.5, .018, i - 5.5, 6.5, .018, i - 5.5)
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xf3dfab, transparent: true, opacity: .3 })); this.grid.visible = false
    this.group.add(this.pieces, this.ring, this.grid); engine.scene.add(this.group)
    this.update(snapshot); this.frame(); window.addEventListener('resize', this.frame)
  }
  frame = (): void => {
    const e = this.engine, w = innerWidth, h = innerHeight, portrait = h > w
    e.resetView(18, 16, 3)
    e.camera.clearViewOffset(); e.pitchGoal = e.pitch = .82; e.yawGoal = e.yaw = -.45
    e.camTargetGoal.set(0, .8, 0); e.camTarget.copy(e.camTargetGoal)
    const area = portrait ? { x: 12, y: 135, w: w - 24, h: h * (this.lobby ? .35 : .42) - 40 }
      : { x: this.lobby ? Math.min(400, w * .4) : 16, y: h < 580 ? 60 : 135, w: w - Math.min(400, w * .4) - 32, h: h < 580 ? h - 100 : h - 215 }
    this.group.updateMatrixWorld(true)
    const corners: THREE.Vector3[] = []
    for (const object of [this.floor, this.keep, ...this.pieces.children]) {
      if (!object) continue
      const box = new THREE.Box3().setFromObject(object)
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
    }
    let bounds = { left: 0, right: w, top: 0, bottom: h }
    for (let dist = 16; dist < 110; dist *= 1.06) {
      e.distGoal = e.dist = dist; e.updateCamera(0); e.camera.updateMatrixWorld(true)
      const points = corners.map(p => p.clone().project(e.camera))
      bounds = { left: Math.min(...points.map(p => (p.x + 1) * w / 2)), right: Math.max(...points.map(p => (p.x + 1) * w / 2)), top: Math.min(...points.map(p => (1 - p.y) * h / 2)), bottom: Math.max(...points.map(p => (1 - p.y) * h / 2)) }
      if (bounds.right - bounds.left < area.w && bounds.bottom - bounds.top < area.h) break
    }
    e.camera.setViewOffset(w, h, (bounds.left + bounds.right) / 2 - (area.x + area.w / 2), (bounds.top + bounds.bottom) / 2 - (area.y + area.h / 2), w, h)
  }

  update(snapshot: HoldSnapshot): void {
    const previous = this.snapshot; this.snapshot = snapshot
    this.group.userData.holdName = snapshot.name
    if (!previous || previous.theme !== snapshot.theme) {
      if (this.floor) this.group.remove(this.floor)
      const t = THEMES[snapshot.theme], a = [box(0, -.48, 0, 13.5, .9, 11.5, t.dirt)]
      for (let x = 0; x < 13; x++) for (let z = 0; z < 11; z++) a.push(box(x - 6, -.03, z - 5, 1, .1, 1, x === 6 && z >= 6 ? t.road : (x + z) % 2 ? t.grass : t.grassAlt))
      // Retaining lip and four corner lantern foundations give the island an authored edge.
      for (const x of [-6.65, 6.65]) a.push(box(x, -.02, 0, .2, .2, 11.5, 0x9b9f91))
      for (const z of [-5.65, 5.65]) a.push(box(0, -.02, z, 13.5, .2, .2, 0x9b9f91))
      this.floor = buildModel({ parts: { land: a }, scale: 1 }, `courtyard-land:${snapshot.theme}`, { receiveShadow: true })
      this.group.add(this.floor); this.engine.applyTheme(t, 18, 16)
      this.engine.scene.fog = new THREE.Fog(t.fog, 100, 180)
    }
    if (!previous || previous.keep !== snapshot.keep || previous.color !== snapshot.color) {
      if (this.keep) this.group.remove(this.keep)
      this.keep = buildModel(keepModel(snapshot), `courtyard-keep:${snapshot.keep}:${snapshot.color}`, { receiveShadow: true }); this.keep.position.set(0, 0, -1); this.group.add(this.keep)
    }
    this.pieces.clear()
    for (const p of snapshot.pieces) { const g = pieceGroup(p.id, snapshot); this.position(g, p); this.pieces.add(g) }
  }
  private position(g: THREE.Object3D, p: HoldPlacement): void {
    const [w, h] = holdFootprint(p.id, p.r); g.position.set(p.x + w / 2 - 6.5, .04, p.z + h / 2 - 5.5); g.rotation.y = p.r * Math.PI / 2
  }
  editing(on: boolean): void { this.grid.visible = on }
  highlight(p?: HoldPlacement, valid = true, ghost = false): void {
    if (this.ghost) { this.group.remove(this.ghost); disposeClonedMaterials(this.ghost); this.ghost = null }
    this.ring.visible = !!p
    if (!p) return
    this.position(this.ring, { ...p, r: 0 }); this.ring.rotation.set(-Math.PI / 2, 0, 0)
    const [w, h] = holdFootprint(p.id, p.r); this.ring.scale.set(w, h, 1); this.ring.material.color.set(valid ? 0xf0d18b : 0xf27570)
    if (ghost) {
      this.ghost = pieceGroup(p.id, this.snapshot, true); this.position(this.ghost, p)
      this.ghost.traverse(o => { if (o instanceof THREE.Mesh) { const m = o.material as THREE.MeshStandardMaterial; m.transparent = true; m.opacity = .55; m.depthWrite = false; m.color.set(valid ? 0xc8edbb : 0xe58383) } }); this.group.add(this.ghost)
    }
  }
  pick(x: number, y: number): { id?: string, x: number, z: number } | null {
    const rect = this.engine.canvas.getBoundingClientRect()
    this.ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.engine.camera)
    const point = new THREE.Vector3()
    if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return null
    const hit = this.ray.intersectObjects(this.pieces.children, true)[0]
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && !o.userData.holdId) o = o.parent
    return { id: o?.userData.holdId, x: Math.floor(point.x + 6.5), z: Math.floor(point.z + 5.5) }
  }
  /** Capture a landscape card synchronously without changing the live camera or UI. */
  postcardSource(): HTMLCanvasElement {
    const renderer = this.engine.renderer, size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio()
    const camera = this.engine.camera.clone(); camera.clearViewOffset(); camera.aspect = 1.6; camera.updateProjectionMatrix()
    const target = new THREE.Vector3(0, .6, 0), direction = this.engine.camera.position.clone().sub(this.engine.camTarget).normalize()
    camera.position.copy(target).addScaledVector(direction, 21); camera.lookAt(target)
    const source = document.createElement('canvas'); source.width = 1200; source.height = 750
    try {
      renderer.setPixelRatio(1); renderer.setSize(1200, 750, false); renderer.render(this.engine.scene, camera)
      source.getContext('2d')!.drawImage(this.engine.canvas, 0, 0)
    } finally { renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); this.engine.render(true) }
    return source
  }
  dispose(): void {
    window.removeEventListener('resize', this.frame)
    this.highlight(); this.engine.scene.remove(this.group); this.group.clear()
    this.ring.geometry.dispose(); this.ring.material.dispose(); this.grid.geometry.dispose(); (this.grid.material as THREE.Material).dispose()
    this.restoreBackdrop()
    const e = this.engine; e.camera.clearViewOffset(); e.resetView(16, 12); e.applyTheme(THEMES.forest, 16, 12)
    e.distGoal = e.dist = this.camera.dist; e.pitchGoal = e.pitch = this.camera.pitch; e.yawGoal = e.yaw = this.camera.yaw
    e.camTargetGoal.copy(this.camera.target); e.camTarget.copy(this.camera.target)
  }
}
