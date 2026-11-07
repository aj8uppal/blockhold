/**
 * Render every piece of Blockhold's 2D art from the game's own voxel models.
 *
 * Nothing here is painted or generated: map cards are the real boards, lit by
 * their own themes; heroes, bosses and towers are the shipped models in one
 * studio light; the app icon is a keep from the same kit. If the voxel work
 * cannot carry a card, it cannot carry the game either.
 *
 * Run with Vite serving this checkout:
 *   npx vite --port 5302 &
 *   BLOCKHOLD_ART_URL=http://127.0.0.1:5302 node scripts/render-art.mjs [--only=maps,heroes,bosses,towers,icons,key] [--ids=a,b]
 *
 * Needs Chrome (channel 'chrome') with a GPU, `cwebp` on PATH, and Python 3 with Pillow
 * for the high-quality downscale.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.env.BLOCKHOLD_ART_URL ?? 'http://127.0.0.1:5302'
const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const only = new Set((arg('only') ?? 'maps,heroes,bosses,towers,icons,key').split(','))
const ids = arg('ids')?.split(',') ?? null
const tmp = join(tmpdir(), `blockhold-art-${process.pid}`)
await mkdir(tmp, { recursive: true })

/** downscale (Lanczos) and encode; alpha survives for transparent renders */
function encode(srcPng, dest, { width, height, quality = 80, alpha = false, png = false }) {
  const scaled = join(tmp, `scaled-${Math.random().toString(36).slice(2)}.png`)
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA' if sys.argv[5] == '1' else 'RGB')
im = im.resize((int(sys.argv[3]), int(sys.argv[4])), Image.LANCZOS)
im.save(sys.argv[2])
`, srcPng, scaled, String(width), String(height), alpha ? '1' : '0'])
  if (png) { execFileSync('cp', [scaled, dest]); return }
  const args = ['-quiet', '-q', String(quality), '-m', '6', '-sharp_yuv']
  if (alpha) args.push('-alpha_q', '90')
  execFileSync('cwebp', [...args, scaled, '-o', dest])
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })

async function gamePage(viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
  page.on('pageerror', e => console.error('pageerror:', e.message))
  await page.addInitScript(() => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, unlocked: 10, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'high')
  })
  await page.goto(url)
  await page.waitForFunction(() => window.vg?.game)
  await page.addStyleTag({ content: '#hud,#screens,#loading,#rotate-overlay,.coop-chat{display:none!important}' })
  return page
}

// ---------------------------------------------------------------- maps

/** one photographer: the same bearing, elevation and fill for every board */
const MAP_SHOT = { yaw: 0.62, pitch: 0.56, fillX: 0.93, top: 0.5, bottom: -0.92, propTop: 0.86, shift: 0.5, ...JSON.parse(process.env.MAP_SHOT ?? '{}') }

async function renderMaps() {
  const page = await gamePage({ width: 1280, height: 800 })
  const list = await page.evaluate(async () => {
    const { levels, loadFrontier } = await import('/src/game/levels.ts')
    const { FRONTIER_BOARDS } = await import('/src/game/frontierIndex.ts')
    await loadFrontier()
    return [...levels.map(l => l.id), ...FRONTIER_BOARDS.map(b => b.id)]
  })
  await mkdir('public/art/maps', { recursive: true })
  for (const id of list.filter(id => !ids || ids.includes(id))) {
    await page.evaluate(async (id) => {
      const g = window.vg.game
      window.vg.screens.onPlayLevel(id, 'normal', 'aldric', 'sandbox')
      await new Promise(r => { const t = () => (g.level?.id === id && g.phase === 'playing' && g.terrain) ? r() : setTimeout(t, 50); t() })
    }, id)
    await page.waitForTimeout(900)
    await page.evaluate(async (shot) => {
      const THREE = await import('/node_modules/.vite/deps/three.js')
      const g = window.vg.game, e = g.engine
      e.cancelCinematic()
      g.clearSelection?.()
      // the hero is the player's, not the board's: keep the card about the land
      if (g.hero) g.hero.group.visible = false
      for (const r of [g.rangeRing, g.upgradeRing, g.selectRing, g.targetRing, g.heroRing, g.heroGuardRing, g.holdLineMesh]) if (r) r.visible = false
      // drifting voxel clouds read as stray white boxes once the board is frozen in a still
      for (const c of g.terrain.clouds ?? []) c.mesh.visible = false
      // a card is clear air: fog belongs to the battle camera, not to a portrait of the land
      e.scene.fog = null
      const ground = g.terrain.groundMesh
      ground.updateMatrixWorld(true)
      ground.geometry.computeBoundingBox()
      const box = ground.geometry.boundingBox.clone().applyMatrix4(ground.matrixWorld)
      // Fit on the silhouette, not a bounding box: an AABB's far-top and
      // near-bottom corners are empty air and shrank every island to half the card.
      const corners = [], props = []
      const pos = ground.geometry.attributes.position, v = new THREE.Vector3()
      const step = Math.max(1, Math.floor(pos.count / 6000))
      for (let i = 0; i < pos.count; i += step) corners.push(v.fromBufferAttribute(pos, i).applyMatrix4(ground.matrixWorld).clone())
      const clouds = new Set((g.terrain.clouds ?? []).map(c => c.mesh))
      for (const child of g.terrain.group.children) {
        if (child === ground || clouds.has(child)) continue
        const b = new THREE.Box3().setFromObject(child)
        if (b.isEmpty()) continue
        const c = b.getCenter(new THREE.Vector3())
        if (c.x < box.min.x - 1 || c.x > box.max.x + 1 || c.z < box.min.z - 1 || c.z > box.max.z + 1) continue
        // props stand on the ground already counted: only their height can widen
        // the frame, and a chimney may rise into the sky band the land may not
        props.push(new THREE.Vector3(c.x, b.max.y, c.z))
      }
      // Lens shift, like an architectural camera: aim at the island but slide
      // the frame up, so the card shows the theme's sky above the horizon
      // instead of a flat field of the dome's lower colour.
      const W = window.innerWidth, H = window.innerHeight
      if (shot.shift) e.camera.setViewOffset(W, H, 0, -shot.shift * H / 2, W, H)
      else e.camera.clearViewOffset()
      const cam = e.camera.clone()
      const target = new THREE.Vector3((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2)
      const pose = (dist) => {
        cam.position.set(
          target.x + Math.sin(shot.yaw) * Math.cos(shot.pitch) * dist,
          target.y + Math.sin(shot.pitch) * dist,
          target.z + Math.cos(shot.yaw) * Math.cos(shot.pitch) * dist)
        cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix()
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, py = -Infinity
        for (const c of corners) { const p = c.clone().project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y) }
        for (const c of props) { const p = c.clone().project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); py = Math.max(py, p.y) }
        return { x0, x1, y0, y1, py }
      }
      const forward = new THREE.Vector3(-Math.sin(shot.yaw), 0, -Math.cos(shot.yaw))
      const right = new THREE.Vector3(Math.cos(shot.yaw), 0, -Math.sin(shot.yaw))
      let dist = 20
      for (let iter = 0; iter < 8; iter++) {
        // fit: the wider of the two spans sets the distance
        let lo = 4, hi = 200
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2, b = pose(mid)
          const fits = (b.x1 - b.x0) <= shot.fillX * 2 && (b.y1 - b.y0) <= (shot.top - shot.bottom)
            && b.py - b.y0 <= shot.propTop - shot.bottom
          if (fits) hi = mid; else lo = mid
        }
        dist = hi
        const b = pose(dist)
        // centre horizontally, sit the island in the band below the sky
        // the land is centred in its band unless a prop would leave the frame
        const wantY = (shot.top + shot.bottom) / 2
        const gotY = Math.max((b.y0 + b.y1) / 2, b.py - (shot.propTop - wantY))
        const gotX = (b.x0 + b.x1) / 2
        const unit = dist * Math.tan(cam.fov * Math.PI / 360)
        target.addScaledVector(forward, (gotY - wantY) * unit / Math.sin(shot.pitch) * 0.9)
        target.addScaledVector(right, gotX * unit * cam.aspect)
      }
      e.camTargetGoal.copy(target); e.camTarget.copy(target)
      e.yawGoal = e.yaw = shot.yaw
      e.pitchGoal = e.pitch = shot.pitch
      e.distGoal = e.dist = dist
      e.maxZoomOut = Math.max(e.maxZoomOut, dist + 1)
    }, MAP_SHOT)
    await page.waitForTimeout(700)
    const png = join(tmp, `map-${id}.png`)
    await page.locator('#game').screenshot({ path: png })
    encode(png, `public/art/maps/${id}.webp`, { width: 1280, height: 800, quality: 78 })
    console.log(`map ${id}`)
  }
  await page.close()
}

// ---------------------------------------------------------------- studio

/**
 * One studio for every model: a warm key from the viewer's upper left, a cool
 * fill from the right and a warm rim from behind, placed relative to the
 * camera so a tower, a hero and a boss shot from different bearings are still
 * lit the same way. Transparent, so the UI can stand them on any surface.
 *
 * jobs: { id, model: 'hero:<id>' | 'enemy:<model>' | 'tower:<id>' | 'castle:<theme>',
 *         size, lens: 'ortho' | 'persp', yaw, rise, fill, pose?, shadow? }
 */
async function studio(page, jobs) {
  return page.evaluate(async (jobs) => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const { buildModel } = await import('/src/voxel/builder.ts')
    const { towerModel } = await import('/src/voxel/models_towers.ts')
    const units = await import('/src/voxel/models_units.ts')
    const { enemyModelFactories } = await import('/src/game/units.ts')
    const env = await import('/src/voxel/models_env.ts')
    const heroes = { aldric: units.heroModel, liora: units.lioraModel, zephyra: units.zephyraModel }
    const make = (spec) => {
      const [kind, id] = spec.split(':')
      if (kind === 'hero') return heroes[id]()
      if (kind === 'enemy') return enemyModelFactories[id]()
      if (kind === 'tower') return towerModel(id)
      if (kind === 'castle') return env.exitCastle(id)
      throw new Error(`unknown model ${spec}`)
    }
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    const scene = new THREE.Scene()
    const hemi = new THREE.HemisphereLight(0xe4ecff, 0x4a3c30, 0.55)
    const key = new THREE.DirectionalLight(0xfff1dc, 3.3)
    const fill = new THREE.DirectionalLight(0xbcd6ff, 0.95)
    const rim = new THREE.DirectionalLight(0xffd9a0, 3.4)
    scene.add(hemi, key, fill, rim, key.target, fill.target, rim.target)
    // a soft contact shadow, so a figure stands on something rather than floats
    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256
      const x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128)
      g.addColorStop(0, 'rgba(10,6,2,0.55)'); g.addColorStop(0.55, 'rgba(10,6,2,0.22)'); g.addColorStop(1, 'rgba(10,6,2,0)')
      x.fillStyle = g; x.fillRect(0, 0, 256, 256)
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
    })()
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }))
    shadow.rotation.x = -Math.PI / 2
    shadow.renderOrder = -1
    const out = []
    for (const job of jobs) {
      const model = buildModel(make(job.model), `studio:${job.model}`, { castShadow: false })
      for (const [part, [rx, ry, rz]] of Object.entries(job.pose ?? {})) {
        const p = model.getObjectByName(part)
        if (p) p.rotation.set(rx, ry, rz)
      }
      scene.add(model)
      model.updateMatrixWorld(true)
      // every vertex, in world space: framing on the silhouette, not a box
      const pts = []
      model.traverse(o => {
        if (!o.isMesh) return
        const pos = o.geometry.attributes.position
        for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld))
      })
      const bounds = new THREE.Box3().setFromPoints(pts)
      const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
      shadow.visible = !!job.shadow
      if (job.shadow) {
        const r = Math.max(size.x, size.z) * job.shadow
        shadow.scale.set(r, r, 1)
        shadow.position.set(center.x, bounds.min.y + 0.002, center.z)
        scene.add(shadow)
      }
      const S = job.size
      renderer.setSize(S, S)
      const dir = new THREE.Vector3(Math.sin(job.yaw), job.rise, Math.cos(job.yaw)).normalize()
      const look = new THREE.Vector3(center.x, bounds.min.y + size.y * (job.lookAt ?? 0.5), center.z)
      const cam = job.lens === 'ortho' ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200) : new THREE.PerspectiveCamera(job.fov ?? 24, 1, 0.01, 200)
      const project = (d, offset) => {
        cam.position.copy(look).addScaledVector(dir, d).add(offset)
        cam.lookAt(look.clone().add(offset)); cam.updateMatrixWorld(); cam.updateProjectionMatrix()
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
        for (const p of pts) { const q = p.clone().project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y) }
        return { x0, x1, y0, y1 }
      }
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
      const up = new THREE.Vector3().crossVectors(dir, right).normalize()
      const offset = new THREE.Vector3()
      let d = 10
      if (job.lens === 'ortho') {
        cam.position.copy(look).addScaledVector(dir, 20); cam.lookAt(look); cam.updateMatrixWorld()
        let e = 0
        for (const p of pts) { const q = p.clone().applyMatrix4(cam.matrixWorldInverse); e = Math.max(e, Math.abs(q.x), Math.abs(q.y)) }
        e /= job.fill
        cam.left = -e; cam.right = e; cam.top = e; cam.bottom = -e
        d = 20
        cam.position.copy(look).addScaledVector(dir, d); cam.lookAt(look); cam.updateMatrixWorld(); cam.updateProjectionMatrix()
      } else {
        for (let iter = 0; iter < 6; iter++) {
          let lo = 0.5, hi = 400
          for (let i = 0; i < 40; i++) {
            const mid = (lo + hi) / 2, b = project(mid, offset)
            const span = job.fitHeight ? b.y1 - b.y0 : Math.max(b.x1 - b.x0, b.y1 - b.y0)
            if (span <= job.fill * 2 && b.x1 - b.x0 <= job.fill * 2) hi = mid; else lo = mid
          }
          d = hi
          const b = project(d, offset)
          const half = d * Math.tan((cam.fov * Math.PI / 180) / 2)
          offset.addScaledVector(right, ((b.x0 + b.x1) / 2) * half)
          offset.addScaledVector(up, ((b.y0 + b.y1) / 2 - (job.centerY ?? 0)) * half)
        }
        project(d, offset)
      }
      // lights ride with the camera: upper-left-front key, right fill, rear rim
      const toCam = dir.clone()
      const at = look.clone().add(offset)
      const place = (light, r, u, f) => {
        light.position.copy(at).addScaledVector(right, r * 10).addScaledVector(up, u * 10).addScaledVector(toCam, f * 10)
        light.target.position.copy(at)
      }
      place(key, -0.75, 0.85, 0.55)
      place(fill, 0.95, 0.15, 0.45)
      place(rim, 0.35, 0.7, -1.0)
      renderer.render(scene, cam)
      out.push([job.id, renderer.domElement.toDataURL('image/png').split(',')[1]])
      scene.remove(model)
      scene.remove(shadow)
    }
    renderer.dispose(); renderer.forceContextLoss()
    return out
  }, jobs)
}

async function saveStudio(results, dir, outSize, { quality = 88 } = {}) {
  await mkdir(dir, { recursive: true })
  for (const [id, data] of results) {
    const png = join(tmp, `studio-${id}.png`)
    await writeFile(png, Buffer.from(data, 'base64'))
    encode(png, `${dir}/${id}.webp`, { width: outSize, height: outSize, quality, alpha: true })
    console.log(`${dir}/${id}.webp`)
  }
}

/** a three-quarter view from the front right, the camera a little below the eyes */
const FIGURE = { lens: 'persp', fov: 22, yaw: 0.6, rise: 0.02, lookAt: 0.52, fill: 0.84, fitHeight: true, centerY: -0.02, shadow: 1.25 }

const HERO_POSES = {
  // sword brought forward and up, shield squared to the viewer
  aldric: { armR: [-0.55, 0, 0.12], armL: [-0.3, 0, -0.08], head: [0, 0.18, 0] },
  // the bow carried low and ready, eyes on the road
  liora: { armL: [-0.32, 0, -0.14], armR: [0.22, 0, 0.12], head: [0, 0.3, 0] },
  // the staff lifted, the free hand open to the storm
  zephyra: { armR: [-0.42, 0, 0.18], armL: [-0.25, 0, -0.42], head: [0, 0.12, 0] },
}

async function renderHeroes(page) {
  const jobs = Object.keys(HERO_POSES).filter(id => !ids || ids.includes(id))
    .map(id => ({ id, model: `hero:${id}`, size: 1024, ...FIGURE, pose: HERO_POSES[id] }))
  await saveStudio(await studio(page, jobs), 'public/art/heroes', 512)
}

async function renderBosses(page) {
  const bosses = await page.evaluate(async () => {
    const { enemyDefs } = await import('/src/game/enemyDefs.ts')
    return [...enemyDefs.values()].filter(d => d.boss).map(d => ({ id: d.id, model: d.model, flying: !!d.flying }))
  })
  const jobs = bosses.filter(b => !ids || ids.includes(b.id)).map(b => ({
    id: b.id, model: `enemy:${b.model}`, size: 1024, ...FIGURE,
    // a boss is shot wider and a touch lower: it should loom
    fov: 26, rise: 0.06, fitHeight: false, fill: 0.86, shadow: b.flying ? 0 : 1.1,
  }))
  await saveStudio(await studio(page, jobs), 'public/art/bosses', 512)
}

async function renderTowers(page) {
  const list = await page.evaluate(async () => Object.keys((await import('/src/voxel/models_towers.ts')).muzzleHeights))
  // the old portraits' bearing (from the front left, well above), so every
  // upgrade card keeps the composition players already know
  const jobs = list.filter(id => !ids || ids.includes(id)).map(id => ({
    id, model: `tower:${id}`, size: 768, lens: 'ortho', yaw: Math.atan2(-5, 7), rise: 3.6 / Math.hypot(5, 7), fill: 1 / 1.06, lookAt: 0.5, shadow: 0,
  }))
  await saveStudio(await studio(page, jobs), 'public/art/towers', 384, { quality: 86 })
}

/**
 * The app icon: the gatehouse every board ends at (the meadow keep players
 * meet first), on a warm-ink tile with a low ember glow behind it. Subject stays inside the central 80% so a
 * maskable crop (circle, squircle) never clips the keep.
 */
async function renderIcons(page) {
  const subject = process.env.ICON_SUBJECT ?? 'castle:forest'
  const [[, data]] = await studio(page, [{ id: 'icon', model: subject, size: 1024, lens: 'persp', fov: 20, yaw: 0.52, rise: 0.32, lookAt: 0.48, fill: 0.94, shadow: 0 }])
  const src = join(tmp, 'icon-subject.png')
  await writeFile(src, Buffer.from(data, 'base64'))
  // [file, size, subject fraction]: a favicon is never masked, so it fills more
  for (const [file, size, frac] of [['public/icon-512.png', 512, 0.66], ['public/icon-192.png', 192, 0.66], ['public/icon-180.png', 180, 0.72], ['public/favicon-64.png', 64, 0.86]]) {
    execFileSync('python3', ['-c', `
import sys
from PIL import Image, ImageDraw, ImageFilter
src, dest, size, frac = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4])
S = 1024
tile = Image.new('RGBA', (S, S), (0x17, 0x13, 0x0f, 255))
# warm glow: a soft ember disc low behind the keep, then a fainter wide halo
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(glow)
d.ellipse((S*.18, S*.30, S*.82, S*.94), fill=(0xe8, 0x57, 0x2a, 165))
d.ellipse((S*.30, S*.40, S*.70, S*.82), fill=(0xf2, 0xb1, 0x34, 150))
glow = glow.filter(ImageFilter.GaussianBlur(S*.11))
tile.alpha_composite(glow)
sub = Image.open(src).convert('RGBA')
sub = sub.crop(sub.getbbox())
k = frac * S / max(sub.width, sub.height)
sub = sub.resize((max(1, int(sub.width*k)), max(1, int(sub.height*k))), Image.LANCZOS)
# a dark contact shadow grounds it on the tile
sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
ImageDraw.Draw(sh).ellipse((S/2 - sub.width*.42, S/2 + sub.height*.40, S/2 + sub.width*.42, S/2 + sub.height*.56), fill=(0, 0, 0, 150))
tile.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S*.02)))
tile.alpha_composite(sub, ((S - sub.width)//2, (S - sub.height)//2 + int(S*.02)))
tile.convert('RGB').resize((size, size), Image.LANCZOS).save(dest, optimize=True)
`, src, file, String(size), String(frac)])
    console.log(file)
  }
}

// ---------------------------------------------------------------- key art

/**
 * One wide hero shot of a real battle: a built defense, a column on the road,
 * capstones firing. The frame is lens-shifted so the fight sits in the right
 * 60% and the left stays sky and soft ground for a wordmark.
 */
const KEY = {
  level: 'lanternbloom', spot: [-6.5, 1.5], fov: 30, yaw: 0.1, pitch: 0.58, dist: 14, shiftX: 0.34, shiftY: 0.04, wait: 2600,
  ...JSON.parse(process.env.KEY_SHOT ?? '{}'),
}

async function renderKey() {
  const page = await gamePage({ width: 1920, height: 1080 })
  await page.evaluate(async (k) => {
    const g = window.vg.game
    window.vg.screens.onPlayLevel(k.level, 'normal', 'aldric', 'sandbox')
    await new Promise(r => { const t = () => (g.level?.id === k.level && g.phase === 'playing' && g.terrain) ? r() : setTimeout(t, 50); t() })
    await new Promise(r => setTimeout(r, 600))
    const lane = g.lanes[0]
    // the fight happens where the road passes closest to the chosen spot
    let best = 0, bestD = Infinity
    for (let d = 0; d < lane.length; d += 0.25) {
      const s = lane.sample(d), dd = Math.hypot(s.x - k.spot[0], s.z - k.spot[1])
      if (dd < bestD) { bestD = dd; best = d }
    }
    const focus = lane.sample(best)
    // a defense worth photographing: capstones on the nearest foundations
    // ...and never between the camera and the road: a tower in front of the
    // fight hides the fight. Foundations behind or beside the column win.
    const toCam = [Math.sin(k.yaw), Math.cos(k.yaw)]
    const score = p => {
      const dx = p.pos.x - focus.x, dz = p.pos.z - focus.z
      const front = dx * toCam[0] + dz * toCam[1]
      return Math.hypot(dx, dz) + Math.max(0, front - 0.4) * 3
    }
    const plots = [...g.terrain.plots].filter(p => !p.water).sort((a, b) => score(a) - score(b))
    const build = [['arrow', [0, 0, 0, 0]], ['mage', [0, 0, 0, 1]], ['ballista', [0, 0, 0, 0]], ['barracks', [0, 0, 0, 0]], ['beacon', [0, 0, 0, 0]], ['arrow', [0, 0, 0, 1]], ['mage', [0, 0, 0, 0]]]
    build.forEach(([kind, path], i) => {
      const plot = plots[i]
      if (!plot) return
      g.buildTower(kind, plot)
      const t = g.towers.find(t => t.plot === plot)
      if (t) for (const opt of path) g.upgradeTower(t, opt)
    })
    g.clearSelection()
    // the column: grunts first, a brute in the middle, a boss behind
    const d0 = best
    const column = [['husk', 1.6], ['shield', 1.1], ['husk', 0.7], ['brute', 0.1], ['husk', -0.5], ['sprinter', -0.9], ['shield', -1.4], ['hollowking', -2.4], ['husk', -3.4], ['acolyte', -3.9]]
    for (const [id, off] of column) g.spawnEnemyAt(id, 0, Math.max(0, d0 + off - 2.2), { hpMult: 400 })
    // health bars are a gameplay readout, not part of the picture
    // (the game re-shows a bar on every hit, so its visibility is pinned off)
    const pin = (bar) => { if (bar && !bar.group.userData.pinned) { bar.group.userData.pinned = true; Object.defineProperty(bar.group, 'visible', { get: () => false, set: () => {} }) } }
    const hide = () => { for (const e of g.enemies) pin(e.bar); for (const s of g.soldiers ?? []) pin(s.bar); if (g.hero) pin(g.hero.bar); requestAnimationFrame(hide) }
    hide()
    for (const r of [g.rangeRing, g.upgradeRing, g.selectRing, g.targetRing, g.heroRing, g.heroGuardRing, g.holdLineMesh]) if (r) r.visible = false
    for (const c of g.terrain.clouds ?? []) c.mesh.visible = Math.hypot(c.mesh.position.x - focus.x, c.mesh.position.z - focus.z) > 9
    const e = g.engine
    e.cancelCinematic()
    e.scene.fog = null
    const W = window.innerWidth, H = window.innerHeight
    // a longer lens than the battle camera: less distortion, a calmer frame
    e.camera.fov = k.fov
    e.camera.setViewOffset(W, H, -k.shiftX * W / 2, -k.shiftY * H / 2, W, H)
    e.camTargetGoal.set(focus.x, focus.y ?? 0, focus.z); e.camTarget.copy(e.camTargetGoal)
    e.yawGoal = e.yaw = k.yaw
    e.pitchGoal = e.pitch = k.pitch
    e.maxZoomOut = Math.max(e.maxZoomOut, k.dist + 1)
    e.distGoal = e.dist = k.dist
  }, KEY)
  await mkdir('public/art/key', { recursive: true })
  // a few frames a beat apart; keep them all so the best moment can be chosen
  const frames = Number(process.env.KEY_FRAMES ?? 1)
  await page.waitForTimeout(KEY.wait)
  for (let i = 0; i < frames; i++) {
    const png = join(tmp, `key-${i}.png`)
    await page.locator('#game').screenshot({ path: png })
    encode(png, frames === 1 ? 'public/art/key/scene.webp' : `public/art/key/scene-${i}.webp`, { width: 1920, height: 1080, quality: 82 })
    console.log(`key frame ${i}`)
    await page.waitForTimeout(450)
  }
  await page.close()
}

if (only.has('maps')) await renderMaps()
if (only.has('key')) await renderKey()
if (only.has('icons')) {
  const page = await gamePage({ width: 800, height: 600 })
  await renderIcons(page)
  await page.close()
}
if (only.has('heroes') || only.has('bosses') || only.has('towers')) {
  const page = await gamePage({ width: 800, height: 600 })
  if (only.has('heroes')) await renderHeroes(page)
  if (only.has('bosses')) await renderBosses(page)
  if (only.has('towers')) await renderTowers(page)
  await page.close()
}

await browser.close()
await rm(tmp, { recursive: true, force: true })
