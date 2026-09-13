/** Rebuild transparent upgrade portraits directly from the shipped voxel models.
 * Run with Vite serving locally: BLOCKHOLD_CHECK_URL=http://127.0.0.1:5195 node scripts/render-upgrade-previews.mjs
 * Portraits are static assets: opening an upgrade never creates another WebGL renderer.
 */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const url = process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage()
  await page.route('**/upgrade-capture.html', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Upgrade portraits</title>' }))
  await page.goto(`${url}/upgrade-capture.html`)
  const portraits = await page.evaluate(async () => {
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const { towerModel, muzzleHeights } = await import('/src/voxel/models_towers.ts')
    const { buildModel } = await import('/src/voxel/builder.ts')
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setSize(384, 384); renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xdcefff, 0x5d5144, 2))
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.3); sun.position.set(-3, 6, 5); scene.add(sun)
    const rim = new THREE.DirectionalLight(0xc6dfff, .7); rim.position.set(4, 3, -4); scene.add(rim)
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100)
    const result = []
    for (const id of Object.keys(muzzleHeights)) {
      const model = buildModel(towerModel(id), `preview:${id}`, { castShadow: false })
      scene.add(model)
      const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3())
      camera.position.copy(center).add(new THREE.Vector3(-5, 3.6, 7)); camera.lookAt(center); camera.updateMatrixWorld()
      let extent = 0
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse)
        extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y))
      }
      extent *= 1.06
      camera.left = -extent; camera.right = extent; camera.top = extent; camera.bottom = -extent; camera.updateProjectionMatrix()
      renderer.render(scene, camera)
      result.push([id, renderer.domElement.toDataURL('image/webp', .92).split(',')[1]])
      scene.remove(model)
    }
    renderer.dispose(); renderer.forceContextLoss()
    return result
  })
  await mkdir('public/art/towers', { recursive: true })
  for (const [id, data] of portraits) await writeFile(`public/art/towers/${id}.webp`, Buffer.from(data, 'base64'))
  console.log(`Rendered ${portraits.length} tower previews at 384 × 384.`)
} finally { await browser.close() }
