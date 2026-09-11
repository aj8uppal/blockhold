/** Two real browser seats: Void pulse combat, rejoin and save recovery.
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
  await host.evaluate(() => window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox'))
  await host.waitForFunction(() => window.vg.game.sessionTick > 30)
  await host.evaluate(() => {
    const g=window.vg.game, point=g.lanes[0].sample(5)
    const plot=[...g.terrain.plots].sort((a,b)=>Math.hypot(a.pos.x-point.x,a.pos.z-point.z)-Math.hypot(b.pos.x-point.x,b.pos.z-point.z))[0]
    g.buildTower('seraph',plot)
    for(let i=0;i<5;i++)g.upgradeTower(g.towers[0],i===2?1:0)
  })
  await host.evaluate(() => window.vg.game.togglePause())
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  const code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await Promise.all(pages.map(p => p.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering && window.vg.game.hasSharedMythic('seraph'))))
  await host.evaluate(() => window.vg.game.togglePause())
  await Promise.all(pages.map(p => p.waitForFunction(() => !window.vg.game.paused)))
  await guest.evaluate(() => window.vg.game.sandboxOrder({kind:'sandboxSpawn',enemy:'gargoyle',count:20,hp:100,lane:0}))
  await Promise.all(pages.map(p => p.waitForFunction(() => window.vg.game.towers[0].damage>1000)))
  await host.evaluate(() => window.vg.game.togglePause())
  await Promise.all(pages.map(p => p.waitForFunction(() => {
    const g=window.vg.game
    return g.paused && g.coopBudget===0 && g.coopMarkers.every(m=>m.ticks===0)
  })))
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
  assert.equal(await guest.evaluate(() => window.vg.game.towers[0].def.splash),1.65)
  assert.deepEqual(errors,[])
  console.log('PASS: guest-triggered Void combat matches both seats; rejoin and solo continuation preserve splash damage and the same state hash.')
} finally { await browser.close() }
