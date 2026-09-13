/** Capture the actual WebGL flame and phasing visuals at a readable camera distance. */
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  await page.addInitScript(() => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'high')
  })
  await page.goto(process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5193/')
  await page.waitForFunction(() => window.vg?.game)
  await page.evaluate(() => {
    const g = window.vg.game
    window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox')
    const at = g.lanes[0].sample(5)
    const plot = [...g.terrain.plots].sort((a,b) => Math.hypot(a.pos.x-at.x,a.pos.z-at.z)-Math.hypot(b.pos.x-at.x,b.pos.z-at.z))[0]
    g.buildTower('cannon', plot)
    for (let i = 1; i < 4; i++) g.upgradeTower(g.towers[0], 0)
    g.clearSelection()
    g.engine.camTargetGoal.set(at.x, 0, at.z)
    g.engine.distGoal = 6
    g.engine.pitchGoal = .65
    g.spawnEnemyAt('brute', 0, 5, { hpMult: 1000 })
    g.enemies[0].def = { ...g.enemies[0].def, speed: 0 }
    g.towers[0].fire(g.enemies[0], g)
  })
  await page.waitForFunction(() => window.vg.game.dynamic.children.some(o => o.isInstancedMesh && o.material.color.getHex() === 0xff681c && o.material.opacity > .5))
  await page.waitForTimeout(250)
  await page.screenshot({ path: '/tmp/blockhold-fire.png' })
  await page.waitForTimeout(130)
  await page.screenshot({ path: '/tmp/blockhold-fire-next.png' })
  await page.evaluate(() => {
    const g = window.vg.game
    g.sellTower(g.towers[0])
    g.spawnEnemyAt('mistwalker', 0, 5, { hpMult: 1000 })
    g.spawnEnemyAt('mistwalker', 0, 6, { hpMult: 1000 })
    g.enemies[0].phaseTimer = 3.8
    g.enemies[1].phaseTimer = 1
  })
  await page.waitForTimeout(200)
  await page.screenshot({ path: '/tmp/blockhold-phase.png' })
} finally { await browser.close() }
