/** Capture actual causeway water at both tides and check rendering errors. */
import { chromium } from '@playwright/test'
const mobile = process.env.BLOCKHOLD_MOBILE === '1'
const suffix = mobile ? '-mobile' : ''
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: mobile ? { width: 740, height: 390 } : { width: 1200, height: 800 }, hasTouch: mobile, isMobile: mobile })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.addInitScript(mobile => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', mobile ? 'battery' : 'high')
  }, mobile)
  await page.goto(process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5193/')
  await page.waitForFunction(() => window.vg?.game)
  await page.evaluate(() => {
    const g = window.vg.game
    window.vg.screens.onPlayLevel('tidereach', 'normal', 'aldric', 'sandbox')
    g.waves.waveIndex = 3
    g.waves.timer = 1000
    g.engine.camTargetGoal.set(.5, 0, -4)
    g.engine.distGoal = 7
    g.engine.pitchGoal = .8
  })
  await page.waitForFunction(() => window.vg.game.dynamic.getObjectByName('causeway-flood')?.material.uniforms.uFade.value === 1)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `/tmp/blockhold-flood-close${suffix}.png` })
  await page.evaluate(() => {
    const g = window.vg.game
    g.engine.camTargetGoal.set(0, 0, 0)
    g.engine.distGoal = 24
  })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `/tmp/blockhold-flood-wide${suffix}.png` })
  await page.evaluate(() => { window.vg.game.waves.waveIndex = 4 })
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `/tmp/blockhold-flood-south${suffix}.png` })
  const floods = await page.evaluate(() => window.vg.game.dynamic.children.filter(o => o.name === 'causeway-flood').length)
  if (floods !== 1) throw new Error(`Expected retired water to be removed; found ${floods} surfaces`)
  if (errors.length) throw new Error(errors.join('\n'))
} finally { await browser.close() }
