/** Two real seats retry, click simultaneously, reload, and recover a missed rematch. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const base = process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5193/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
try {
  const pages = []
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 740, height: 390 } : { width: 1200, height: 800 }, hasTouch: mobile, isMobile: mobile })
    await context.addInitScript(() => {
      localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
      localStorage.setItem('blockhold.quality', 'battery')
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    pages.push(page)
  }
  const [host, guest] = pages
  await host.goto(base)
  await host.waitForFunction(() => window.vg?.game)
  await host.evaluate(() => {
    window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign')
    window.vg.game.togglePause()
  })
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  const code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await guest.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering)
  async function lose() {
    await Promise.all(pages.map(page => page.evaluate(() => {
      const g = window.vg.game
      g.hud.setPaused(false)
      g.endGame(false)
    })))
    await Promise.all(pages.map(p => p.getByRole('button', { name: 'Try again', exact: true }).waitFor()))
  }
  async function sameAttempt(generation) {
    for (const p of pages) {
      await p.waitForFunction(({ generation, code }) => {
        const g = window.vg.game
        return g.coop?.code === code && g.coop.generation === generation && !g.isRecovering && g.phase === 'playing' && !g.paused
      }, { generation, code })
      assert.equal(await p.locator('.end-screen').count(), 0)
    }
    await host.waitForFunction(() => window.vg.game.time > .5)
    await host.evaluate(() => window.vg.game.coop.send('cmd', { kind: 'heroMove', x: -5, z: 1 }))
    await host.waitForTimeout(350)
    await host.evaluate(() => window.vg.game.coop.send('pause', true))
    for (const p of pages) await p.waitForFunction(() => {
      const g = window.vg.game
      return g.paused && !g.coopBudget && g.coopMarkers.every(m => !m.ticks)
    })
    const state = await Promise.all(pages.map(p => p.evaluate(() => {
      const g = window.vg.game
      return { hash: g.sessionStateHash(), tick: g.sessionTick, seats: g.coop.seats, generation: g.coop.generation }
    })))
    assert.deepEqual(state[0], state[1]); assert.equal(state[0].seats, 2)
    console.log(JSON.stringify({ generation, sameRoom: true, state }))
  }
  await lose()
  await guest.getByRole('button', { name: 'Try again', exact: true }).click()
  await sameAttempt(1)
  await lose()
  // Invoke both still-visible result buttons in the same event-loop window.
  await Promise.all(pages.map(p => p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Try again').click())))
  await sameAttempt(2)
  await guest.reload()
  await guest.getByRole('button', { name: 'Co-op', exact: true }).click()
  await guest.getByRole('button', { name: 'Rejoin your room' }).click()
  await guest.waitForFunction(() => window.vg?.game?.coop?.generation === 2 && !window.vg.game.isRecovering)
  assert.equal(await guest.evaluate(() => window.vg.game.coop.code), code)
  await lose()
  await guest.context().setOffline(true)
  await host.getByRole('button', { name: 'Try again', exact: true }).click()
  await host.waitForFunction(() => window.vg.game.coop?.generation === 3 && !window.vg.game.isRecovering)
  await guest.context().setOffline(false)
  await sameAttempt(3)
  assert.deepEqual(errors, [])
} catch (error) {
  for (const context of browser.contexts()) for (const p of context.pages()) {
    console.error(await p.evaluate(() => { const g = window.vg?.game; return { phase: g?.phase, paused: g?.paused, generation: g?.coop?.generation, activeGeneration: g?.coopBattleGeneration, recovering: g?.isRecovering, time: g?.time, lost: g?.coop?.lost } }).catch(() => null))
  }
  throw error
} finally { await browser.close() }
