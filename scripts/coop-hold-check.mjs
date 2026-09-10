/** Real transport regression: a disconnected guest retries Hold the Line in a paused room.
 * The cleared board is staged; commands, SSE, clocks, input and result UI are real.
 * Run against a frontend connected to a matching server via BLOCKHOLD_CHECK_URL.
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
    await context.addInitScript(() => {
      localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 20000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
      localStorage.setItem('blockhold.quality', 'low')
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
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
  await guest.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering)
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const g = window.vg.game
    return g.paused && g.coopBudget === 0 && g.coopMarkers.every(marker => marker.ticks === 0)
  })))
  for (const page of pages) await page.evaluate(() => {
    const g = window.vg.game
    g.waves.resumeAt(g.waves.authoredWaves)
    g.endGame(true)
    window.vg.hud.setPaused(false) // leave the result card accessible while the room clock is paused
  })
  await guest.context().setOffline(true)
  await guest.getByRole('button', { name: 'Hold the line', exact: true }).click()
  await guest.getByText(/Could not reach the room/).waitFor()
  assert.equal(await guest.locator('.end-screen').count(), 1)
  assert.equal(await guest.evaluate(() => window.vg.game.phase), 'victory')
  await guest.context().setOffline(false)
  await guest.getByRole('button', { name: 'Hold the line', exact: true }).click()
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const g = window.vg.game
    return g.isFreeplay && g.phase === 'playing' && !g.paused && !document.querySelector('.end-screen')
  })))
  const original = await guest.evaluate(() => window.vg.game.hero.group.position.toArray())
  await guest.evaluate(() => {
    const g = window.vg.game
    const spot = g.lanes[0].sample(g.lanes[0].length * 0.3)
    const point = g.projectToScreen(spot.x, 0, spot.z)
    g.selectHero()
    g.handleClick(point.x, point.y, true)
    g.callWave()
  })
  await Promise.all(pages.map(page => page.waitForFunction(before => {
    const g = window.vg.game
    return g.enemies.length > 0 && g.hero.group.position.toArray().some((value, i) => Math.abs(value - before[i]) > 0.1)
  }, original)))
  await host.evaluate(() => window.vg.game.togglePause())
  await Promise.all(pages.map(page => page.waitForFunction(() => {
    const g = window.vg.game
    return g.paused && g.coopBudget === 0 && g.coopMarkers.every(marker => marker.ticks === 0)
  })))
  assert.equal(await host.evaluate(() => window.vg.game.sessionStateHash()),
    await guest.evaluate(() => window.vg.game.sessionStateHash()))
  assert.deepEqual(errors, [])
  console.log('PASS: failed Hold keeps victory actions; reconnect resumes the room, starts waves and moves the hero on both matching boards.')
} finally { await browser.close() }
