/** Staged visual review only: authored honors and abundant gold are injected for
 * presentation, never used as combat/balance evidence. Actual game renderer/UI.
 * node scripts/endgame-review.mjs
 */
import { createServer } from 'vite'
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
const out = `${process.cwd()}/reviews/endgame`
mkdirSync(out, { recursive: true })
const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const captures = [], errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1.5 })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(server.resolvedUrls.local[0])
  await page.waitForFunction(() => window.vg?.game)
  await page.evaluate(async () => {
    const g = window.vg.game
    const { xpForLevel } = await import('/src/game/progress.ts')
    const { enemyDefs } = await import('/src/game/enemyDefs.ts')
    g.save.xp = xpForLevel(30)
    g.save.honors = ['hero:aldric:ossuary', 'hero:aldric:empress', 'hunt:ossuary:normal', 'hunt:empress:normal',
      'mastery:seraph:ossuary', 'mastery:seraph:empress', 'mastery:barracks:ossuary', 'mastery:barracks:empress']
    g.save.seenEnemies = [...enemyDefs.keys()]
    g.save.heroPaths = {}; g.save.taughtBasics = true
    const caption = document.createElement('div')
    caption.id = 'review-stage-caption'
    Object.assign(caption.style, { position: 'fixed', left: '16px', bottom: '12px', zIndex: '9999', color: '#f3e6cc',
      background: 'rgba(18,22,25,.82)', padding: '8px 12px', borderRadius: '6px', font: '12px system-ui', pointerEvents: 'none' })
    document.body.append(caption)
  })
  for (const [kind, branch, name] of [['seraph', 0, 'helios-engine'], ['seraph', 1, 'event-horizon'], ['barracks', 0, 'last-legion']]) {
    const data = await page.evaluate(async ({ kind, branch }) => {
      const { game: g, screens } = window.vg
      const { levelById } = await import('/src/game/levels.ts')
      g.startLevel(levelById('greenhollow'), 'normal', 'aldric', 'campaign', { seed: 91 })
      screens.show('none'); g.paused = false; g.gold = 100000
      const plot = g.terrain.plots.slice().sort((a, b) => a.pos.lengthSq() - b.pos.lengthSq())[0]
      g.buildTower(kind, plot)
      const tower = g.towers[0]
      for (let tier = 1; tier < 6; tier++) { g.upgradeTower(tower, tier === 3 ? branch : 0); tower.update(.2, g) }
      g.paused = true; tower.update(1, g); tower.update(1, g)
      g.clearSelection(); g.hero.group.visible = false
      if (kind === 'seraph') {
        for (let i = 0; i < 7; i++) {
          g.spawnEnemyAt(i % 3 === 0 ? 'gargoyle' : 'husk', 0, 0)
          const e = g.enemies.at(-1), angle = .3 + i * Math.PI * 2 / 7
          e.pos.set(tower.pos.x + Math.cos(angle) * 2.2, i % 3 === 0 ? 1 : 0, tower.pos.z + Math.sin(angle) * 2.2)
          e.hp = e.maxHp = 30000; e.group.rotation.y = angle + Math.PI / 2
        }
        tower.cooldown = 0; tower.update(1 / 60, g)
      } else {
        tower.activateMythic(g)
        for (const soldier of tower.soldiers) soldier.update(0, g)
      }
      g.engine.cancelCinematic(); g.engine.camTargetGoal.copy(tower.pos); g.engine.camTargetGoal.y = kind === 'seraph' && branch === 1 ? 1.5 : .8
      g.engine.distGoal = kind === 'seraph' && branch === 1 ? 12 : 10.5; g.engine.pitchGoal = .77; g.engine.yawGoal = .25; g.engine.updateCamera(5)
      document.querySelectorAll('#hud,#screens,#build-menu,#tower-panel').forEach(x => x.style.display = 'none')
      document.querySelector('#review-stage-caption').textContent = `${tower.def.name} · staged model review · injected gold/unlocks · not balance evidence`
      g.engine.render()
      return { name: tower.def.name, model: tower.def.model, tier: tower.level, beamTargets: tower.def.beamTargets, draws: g.engine.renderer.info.render.calls }
    }, { kind, branch })
    await page.screenshot({ path: `${out}/${name}.png` })
    captures.push({ file: `${name}.png`, ...data })
    if (process.argv.includes('--motion') && kind === 'seraph') {
      const bytes = await page.evaluate(async () => {
        const g = window.vg.game, tower = g.towers[0]
        const previousRatio = g.engine.renderer.getPixelRatio()
        g.engine.renderer.setPixelRatio(1); g.engine.render()
        const stream = g.engine.renderer.domElement.captureStream(30), chunks = []
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 2400000 })
        recorder.ondataavailable = event => chunks.push(event.data)
        const stopped = new Promise(resolve => recorder.onstop = resolve)
        if (tower.branch === 0) tower.mythicCharge = 70
        else tower.mythicReadyAt = g.time + .8
        recorder.start()
        let previousTime = performance.now()
        const timer = setInterval(() => {
          const now = performance.now(), dt = Math.min(.12, (now - previousTime) / 1000); previousTime = now
          g.time += dt; tower.update(dt, g)
          for (const p of g.projectiles) { p.update(dt); if (p.done) { g.dynamic.remove(p.mesh); p.dispose?.() } }
          g.projectiles = g.projectiles.filter(p => !p.done)
          g.particles.update(dt); g.engine.render()
        }, 1000 / 30)
        await new Promise(resolve => setTimeout(resolve, 4200))
        clearInterval(timer); recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop())
        g.engine.renderer.setPixelRatio(previousRatio)
        return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))
      })
      writeFileSync(`${out}/${name}-motion.webm`, new Uint8Array(bytes))
    }
  }
  for (const [id, bossId, name] of [['ossuary', 'ossuary', 'ossuary-radius'], ['empress', 'veilempress', 'empress-air'], ['empress', 'veilempressLanded', 'empress-ground']]) {
    const data = await page.evaluate(async ({ id, bossId }) => {
      const { game: g, screens } = window.vg
      const { huntLevel } = await import('/src/game/hunts.ts')
      g.startLevel(huntLevel(id), 'normal', 'aldric', 'campaign', { seed: 91, hunt: id })
      screens.show('none'); g.paused = true; g.hud.reset(); g.hud.setChrome(true)
      document.querySelector('#hud').style.display = ''
      document.querySelector('#screens').style.display = ''
      g.waves.waveIndex = 9
      g.spawnEnemyAt(bossId, 0, g.lanes[0].length * .45, { hpMult: id === 'ossuary' ? 5.1 : 4.8 })
      const boss = g.enemies.at(-1)
      boss.hp = boss.maxHp * (bossId === 'veilempressLanded' ? .58 : .81)
      boss.update(0, g); boss.group.rotation.y = .15
      g.hero.group.visible = false
      g.engine.cancelCinematic(); g.engine.camTargetGoal.copy(boss.pos); g.engine.camTargetGoal.y = .7
      g.engine.distGoal = 11.8; g.engine.pitchGoal = .78; g.engine.yawGoal = .15; g.engine.updateCamera(5)
      g.cameraQuat.copy(g.engine.camera.quaternion); boss.bar.set(boss.hp / boss.maxHp, g.cameraQuat)
      g.hud.refresh(g)
      document.querySelectorAll('.intro,.banner,.toast,.wave-preview,.wave-call-wrap').forEach(x => x.style.display = 'none')
      Object.assign(document.querySelector('#review-stage-caption').style, { left: 'auto', right: '16px' })
      document.querySelector('#review-stage-caption').textContent = `${boss.def.name} · staged phase/telegraph review · not balance evidence`
      g.engine.render()
      const status = document.querySelector('.hunt-status')
      return { boss: boss.def.id, hp: boss.maxHp, hud: status?.textContent, bounds: status?.getBoundingClientRect().toJSON() }
    }, { id, bossId })
    await page.screenshot({ path: `${out}/${name}.png` })
    captures.push({ file: `${name}.png`, ...data })
  }
  await page.evaluate(() => {
    const { game: g, screens } = window.vg
    g.disposeLevel(); g.showMenuBackdrop(); g.hud.setChrome(false)
    document.querySelector('#hud').style.display = 'none'
    document.querySelector('#screens').style.display = ''
    document.querySelector('#review-stage-caption').style.display = 'none'
    screens.show('hunts')
  })
  await page.locator('.endgame-screen').waitFor()
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.waitForTimeout(200)
  await page.screenshot({ path: `${out}/hub-desktop.png` })
  captures.push({ file: 'hub-desktop.png', viewport: { width: 1440, height: 1100 }, ...await page.evaluate(() => {
    const s = document.querySelector('.endgame-screen')
    return { scrollHeight: s.scrollHeight, clientHeight: s.clientHeight, horizontalOverflow: s.scrollWidth > s.clientWidth }
  }) })
  await page.setViewportSize({ width: 844, height: 390 })
  await page.waitForTimeout(200)
  const small = await page.evaluate(() => {
    const s = document.querySelector('.endgame-screen')
    const hunt = s.querySelector('section.endgame-card')
    s.scrollTop = hunt.offsetTop - s.offsetTop - 10
    return { scrollHeight: s.scrollHeight, clientHeight: s.clientHeight, horizontalOverflow: s.scrollWidth > s.clientWidth,
      cards: [...s.querySelectorAll('.endgame-card')].map(x => ({ title: x.querySelector('h2,h3')?.textContent, width: x.clientWidth, scrollWidth: x.scrollWidth })) }
  })
  await page.screenshot({ path: `${out}/hub-small-landscape.png` })
  captures.push({ file: 'hub-small-landscape.png', viewport: { width: 844, height: 390 }, ...small })
  writeFileSync(`${out}/captures.json`, JSON.stringify({ note: 'Staged actual-renderer/UI visual review; gold, honors and enemy placement injected. Not combat evidence.', captures, errors }, null, 2) + '\n')
  if (errors.length) throw new Error(errors.join('\n'))
  console.log(JSON.stringify(captures, null, 2))
} finally { await browser.close(); await server.close() }
