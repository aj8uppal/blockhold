/** Verify readable Void travel at 1x/4x and render the actual Dawnfall synth offline. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.addInitScript(() => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'low')
  })
  await page.goto(process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5193/')
  await page.waitForFunction(() => window.vg?.game)
  for (const speed of [1, 4]) {
    await page.evaluate(speed => {
      const g = window.vg.game
      window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox')
      const at = g.lanes[0].sample(5)
      const plot = [...g.terrain.plots].sort((a,b) => Math.hypot(a.pos.x-at.x,a.pos.z-at.z)-Math.hypot(b.pos.x-at.x,b.pos.z-at.z))[0]
      g.buildTower('seraph', plot)
      for (let i = 1; i < 6; i++) g.upgradeTower(g.towers[0], i === 3 ? 1 : 0)
      g.clearSelection()
      g.spawnEnemyAt('brute', 0, 5, { hpMult: 1000 })
      g.enemies[0].def = { ...g.enemies[0].def, speed: 0 }
      g.towers[0].cooldown = 100
      g.engine.camTargetGoal.set(at.x, 0, at.z)
      g.engine.distGoal = 7
      g.speed = speed
    }, speed)
    await page.waitForTimeout(1000)
    await page.evaluate(() => {
      const g = window.vg.game
      g.towers[0].fire(g.enemies[0], g)
      window.checkedPulse = g.projectiles.find(p => p.mesh.name === 'void-pulse')
    })
    await page.waitForFunction(() => {
      const p = window.checkedPulse
      if (p?.visualAge >= .17) { window.vg.game.paused = true; return true }
      return false
    })
    const pulse = await page.evaluate(() => ({ age: window.checkedPulse.visualAge, alive: !!window.checkedPulse.mesh.parent, visible: window.checkedPulse.mesh.children[1].material.opacity, done: window.checkedPulse.done }))
    assert.ok(pulse.age < .42 && pulse.alive && pulse.visible > .5)
    if (speed === 4) assert.equal(pulse.done, true, 'visual continues after historical sim lifetime')
    await page.screenshot({ path: `/tmp/blockhold-void-${speed}x.png` })
    await page.evaluate(() => { window.vg.game.paused = false })
    await page.waitForFunction(() => !window.checkedPulse.mesh.parent)
    console.log(JSON.stringify({ speed, pulse }))
  }
  const audio = await page.evaluate(async () => {
    const { AudioSystem } = await import('/src/core/audio.ts')
    const ctx = new OfflineAudioContext(1, 48000, 48000), sound = new AudioSystem()
    sound.ctx = ctx; sound.master = ctx.createGain(); sound.master.gain.value = .5
    sound.master.connect(ctx.destination)
    sound.play('dawnfall', .65)
    const data = (await ctx.startRendering()).getChannelData(0)
    let peak = 0, energy = 0
    for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample }
    return { peak, rms: Math.sqrt(energy / data.length) }
  })
  assert.ok(audio.peak > .005 && audio.peak < .1)
  console.log(JSON.stringify({ dawnfall: audio }))
  assert.deepEqual(errors, [])
} finally { await browser.close() }
