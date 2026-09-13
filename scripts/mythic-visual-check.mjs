/** Render the shipping voxel factories, then check actual weapon origins and mobile hero controls. */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

const out = '.lavish/mythic-pass'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.addInitScript(() => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'high')
  })
  await page.goto(process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5194/')
  await page.waitForFunction(() => window.vg?.game)
  const catalog = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const { towerModel, plotModel } = await import('/src/voxel/models_towers.ts')
    const { buildModel, disposeClonedMaterials } = await import('/src/voxel/builder.ts')
    const { towerTrees } = await import('/src/game/towerDefs.ts')
    const { mythicFor } = await import('/src/game/mythics.ts')
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(640, 580); renderer.setPixelRatio(1)
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x18232a)
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(-9, 16, 7); sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -4
    sun.shadow.camera.right = sun.shadow.camera.top = 4; sun.shadow.normalBias = .02
    scene.add(sun, new THREE.HemisphereLight(0xbfd9ff, 0x6a8a55, .7), new THREE.AmbientLight(0xffffff, .25))
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.3, .18, 1.3), new THREE.MeshStandardMaterial({ color: 0x687c58, roughness: .9 }))
    floor.position.y = -.12; floor.receiveShadow = true; scene.add(floor)
    const plot = buildModel(plotModel(), 'review-plot'); scene.add(plot)
    const camera = new THREE.OrthographicCamera(-2, 2, 1.82, -1.82, .1, 100)
    camera.position.set(4, 3.8, 6)
    const rows = []
    for (const [family, tree] of Object.entries(towerTrees)) for (const branch of [0, 1]) {
      const before = tree.capstones[branch], after = mythicFor(family, branch)
      const models = [before, after].map((def, i) => {
        const m = buildModel(towerModel(def.model), `review:${def.model}`, { cloneMaterials: true })
        m.scale.setScalar(i ? 1.38 : 1.3)
        return m
      })
      const height = Math.max(...models.map(m => new THREE.Box3().setFromObject(m).max.y))
      const extent = Math.max(1.75, height * .78)
      camera.left = -extent; camera.right = extent; camera.top = extent * 580 / 640; camera.bottom = -camera.top
      camera.position.set(4, height * .55 + 3, 6); camera.lookAt(0, height * .48, 0); camera.updateProjectionMatrix()
      floor.material.color.set(family === 'tidecaller' ? 0x436878 : 0x687c58)
      const images = []
      for (const m of models) {
        scene.add(m); renderer.render(scene, camera); images.push(renderer.domElement.toDataURL('image/png'))
        scene.remove(m); disposeClonedMaterials(m)
      }
      rows.push({ family, branch, before: { name: before.name, model: before.model }, after: { name: after.name, model: after.model, description: after.description, cost: after.cost }, images })
    }
    renderer.dispose()
    return rows
  })
  for (const row of catalog) {
    for (const [i, image] of row.images.entries()) await writeFile(`${out}/${i ? row.after.model : row.before.model}.png`, Buffer.from(image.split(',')[1], 'base64'))
    delete row.images
  }
  await writeFile(`${out}/catalog.json`, JSON.stringify(catalog, null, 2))
  await page.evaluate(() => {
    const g = window.vg.game
    window.vg.screens.onPlayLevel('greenhollow', 'normal', 'liora', 'sandbox')
    const plot = g.terrain.plots[0]
    g.buildTower('arrow', plot)
    for (let i = 1; i < 6; i++) g.upgradeTower(g.towers[0], i === 3 ? 1 : 0)
    g.clearSelection()
    g.engine.camTargetGoal.set(plot.pos.x, plot.pos.y + .6, plot.pos.z)
    g.engine.distGoal = 5.5
  })
  await page.waitForTimeout(700)
  const muzzle = await page.evaluate(() => {
    const g = window.vg.game, t = g.towers[0]
    const socket = t.model.getObjectByName('muzzle'), bow = socket.getWorldPosition(t.pos.clone())
    const from = t.muzzle()
    return { distance: bow.distanceTo(from), heightAbovePlot: from.y - t.pos.y }
  })
  assert.ok(muzzle.distance < .0001 && muzzle.heightAbovePlot < 2)
  await page.screenshot({ path: `${out}/thousandwing-live.png` })
  await page.setViewportSize({ width: 740, height: 390 })
  await page.evaluate(() => {
    const g = window.vg.game
    g.hero.gainXp(30000, g)
    for (let i = 0; i < 5; i++) g.upgradeHeroSignature()
    g.hud.openHeroPanel(g.hero)
  })
  const upgrade = page.locator('.hero-rank-upgrade')
  await upgrade.scrollIntoViewIfNeeded()
  assert.ok(await upgrade.isEnabled())
  assert.match(await upgrade.textContent(), /Legendary/)
  await page.screenshot({ path: `${out}/hero-mobile.png` })
  await upgrade.click()
  await page.waitForFunction(() => window.vg.game.hero.signatureRank === 6)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ models: catalog.length * 2, muzzle, mobileRank: 6 }))
} finally { await browser.close() }
