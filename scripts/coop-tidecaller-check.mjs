/** Two real browser seats: water placement, wave flow, duplicate commands and save recovery.
 * Run with BLOCKHOLD_CHECK_URL pointing to a frontend connected to a matching sync server.
 */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const base = (process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5178/').replace(/\/?$/, '/')
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
try {
  const pages = []
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 960, height: 600 } })
    await context.addInitScript(guest => {
      if (!localStorage.getItem('blockhold.save.v1')) localStorage.setItem('blockhold.save.v1', JSON.stringify({
        xp: 20000, taughtBasics: true, sfxMuted: true, musicMuted: true,
        honors: guest ? ['mastery:seraph:ossuary', 'mastery:seraph:empress'] : [],
      }))
      localStorage.setItem('blockhold.quality', 'low')
    }, i === 1)
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    pages.push(page)
  }
  const [host, guest] = pages
  await host.goto(base)
  await host.waitForFunction(() => window.vg?.game)
  await host.evaluate(() => window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign'))
  await host.waitForFunction(() => window.vg.game.sessionTick > 30)
  await host.evaluate(() => window.vg.game.togglePause())
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  const code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await Promise.all(pages.map(p => p.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering && window.vg.game.hasSharedMythic('seraph'))))
  await guest.evaluate(() => window.vg.game.setAutoWaves(false))
  await Promise.all(pages.map(p => p.waitForFunction(() => !window.vg.game.autoWaves)))
  await host.evaluate(() => window.vg.game.togglePause())
  await Promise.all(pages.map(p => p.waitForFunction(() => !window.vg.game.paused)))
  const cell = await host.evaluate(() => {
    const g=window.vg.game
    for(let r=0;r<g.level.height;r++)for(let c=0;c<g.level.width;c++)if(g.terrain.waterPlot(c,r))return [c,r]
    throw Error('No water site')
  })
  const gold = await host.evaluate(() => window.vg.game.gold)
  await Promise.all(pages.map(p => p.evaluate(async cell => {
    await window.vg.game.coop.send('cmd',{kind:'waterBuild',c:cell[0],r:cell[1]})
  },cell)))
  await Promise.all(pages.map(p => p.waitForFunction(() => window.vg.game.towers.length===1)))
  await host.evaluate(() => window.vg.game.togglePause())
  await Promise.all(pages.map(p => p.waitForFunction(() => {
    const g=window.vg.game
    return g.paused && g.coopBudget===0 && g.coopMarkers.every(m=>m.ticks===0)
  })))
  assert.equal(await host.evaluate(() => window.vg.game.gold),gold-180)
  const hash = await host.evaluate(() => window.vg.game.sessionStateHash())
  assert.equal(hash,await guest.evaluate(() => window.vg.game.sessionStateHash()))
  await guest.reload()
  await guest.getByRole('button',{name:'Co-op',exact:true}).click()
  await guest.getByRole('button',{name:'Rejoin your room'}).click()
  await guest.waitForFunction(() => window.vg.game.towers.length===1 && !window.vg.game.isRecovering)
  assert.equal(hash,await guest.evaluate(() => window.vg.game.sessionStateHash()))
  assert.equal(await guest.evaluate(() => window.vg.game.continueSolo()),true)
  assert.equal(await guest.evaluate(async () => await window.vg.game.resumeSession(JSON.parse(localStorage.getItem('blockhold.session.v1')))),true)
  assert.equal(hash,await guest.evaluate(() => window.vg.game.sessionStateHash()))
  assert.equal(await guest.evaluate(() => window.vg.game.autoWaves),false)
  assert.deepEqual(errors,[])
  console.log('PASS: manual waves synchronize while paused; simultaneous water purchases spend once; rejoin and solo continuation preserve the same board.')
} finally { await browser.close() }
