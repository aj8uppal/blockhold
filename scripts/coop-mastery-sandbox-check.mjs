/** Two real browser seats: late-join Mythic sharing and a portable co-op sandbox.
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
  let code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await Promise.all(pages.map(p => p.waitForFunction(() => window.vg?.game?.hasSharedMythic('seraph'))))
  for (const page of pages) assert.equal(await page.evaluate(() => window.vg.game.mythicLock({ level: 5, kind: 'seraph' })), null)
  assert.deepEqual(await host.evaluate(() => window.vg.game.save.honors), [])
  assert.equal(await host.evaluate(() => window.vg.game.sessionStateHash()), await guest.evaluate(() => window.vg.game.sessionStateHash()))
  await guest.reload()
  await guest.getByRole('button', { name: 'Co-op', exact: true }).click()
  await guest.getByRole('button', { name: 'Rejoin your room' }).click()
  await guest.waitForFunction(() => window.vg.game.hasSharedMythic('seraph') && !window.vg.game.isRecovering)
  console.log('PASS: a late guest shares Seraph mastery with both players, including a page reload.')
  await host.evaluate(() => {
    const g = window.vg.game
    g.continueSolo()
    window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox')
    g.buildTower('seraph', g.terrain.plots[0])
    for (let i = 0; i < 5; i++) g.upgradeTower(g.towers[0], 0)
    g.clearSelection()
    g.togglePause()
  })
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await guest.waitForFunction(() => window.vg?.game?.coop && window.vg.game.isSandbox && !window.vg.game.isRecovering)
  await host.evaluate(() => window.vg.game.togglePause())
  await guest.waitForFunction(() => !window.vg.game.paused)
  await guest.evaluate(() => window.vg.game.sandboxOrder({ kind: 'sandboxSpawn', enemy: 'brute', count: 10, lane: 0, hp: 100 }))
  await host.waitForFunction(() => window.vg.game.enemies.length >= 3)
  await host.evaluate(() => window.vg.game.togglePause())
  await Promise.all(pages.map(p => p.waitForFunction(() => {
    const g = window.vg.game
    return g.paused && g.coopBudget === 0 && !g.coopMarkers.some(m => m.ticks > 0) && g.hasSharedMythic('seraph')
  })))
  const hash = await host.evaluate(() => window.vg.game.sessionStateHash())
  assert.equal(hash, await guest.evaluate(() => window.vg.game.sessionStateHash()))
  await guest.evaluate(() => window.vg.game.continueSolo())
  assert.equal(hash, await guest.evaluate(() => window.vg.game.sessionStateHash()))
  assert.equal(await guest.evaluate(async () => {
    const g = window.vg.game
    return await g.resumeSession(JSON.parse(localStorage.getItem('blockhold.session.v1')))
  }), true)
  assert.equal(hash, await guest.evaluate(() => window.vg.game.sessionStateHash()))
  assert.deepEqual(errors, [])
  console.log('PASS: co-op sandbox spawn orders converge; Mythic towers and queued enemies survive shared → solo → reload.')
} finally { await browser.close() }
