/** Real desktop/mobile seats, all speeds, combat, pause, reconnect and resync. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
const base = (process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5193/').replace(/\/?$/, '/')
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const pages = [], errors = [], checks = []
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: i ? { width: 740, height: 390 } : { width: 1280, height: 800 }, hasTouch: !!i, isMobile: !!i })
    await context.addInitScript(mobile => {
      localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
      localStorage.setItem('blockhold.quality', mobile ? 'battery' : 'low')
    }, !!i)
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    pages.push(page)
  }
  const [host, guest] = pages
  await host.goto(base)
  await host.waitForFunction(() => window.vg?.game)
  await host.evaluate(() => {
    const g = window.vg.game
    window.vg.screens.onPlayLevel('frostmere', 'normal', 'zephyra', 'sandbox')
    for (const [i, kind] of ['arrow', 'mage', 'cannon', 'ballista', 'barracks', 'beacon', 'seraph'].entries()) {
      g.buildTower(kind, g.terrain.plots[i])
      for (let level = 1; level < 6; level++) g.upgradeTower(g.towers[i], level === 3 ? i % 2 : 0)
      g.ascendTower(g.towers[i], 1)
    }
    g.togglePause()
  })
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  const code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await guest.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering)
  const cdp = await guest.context().newCDPSession(guest)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 120, downloadThroughput: -1, uploadThroughput: -1 })
  for (const page of pages) await page.evaluate(() => {
    const g = window.vg.game
    window.hashes = []
    const send = g.sendCoopHash.bind(g)
    g.sendCoopHash = turn => { window.hashes.push({ turn, tick: g.sessionTick, hash: g.sessionStateHash() }); send(turn) }
  })
  async function pauseAndCompare(label) {
    await host.evaluate(async () => await window.vg.game.coop.send('pause', true))
    await Promise.all(pages.map(p => p.waitForFunction(() => {
      const g = window.vg.game
      return g.paused && !g.coopBudget && g.coopMarkers.every(m => !m.ticks)
    })))
    const state = await Promise.all(pages.map(p => p.evaluate(() => ({ hash: window.vg.game.sessionStateHash(), tick: window.vg.game.sessionTick, desync: window.vg.game.coopDesync }))))
    checks.push({ label, state })
    assert.equal(state[0].tick, state[1].tick, `${label}: ticks`)
    assert.equal(state[0].hash, state[1].hash, `${label}: hashes`)
    assert.equal(state[0].desync, null, `${label}: host sync`)
    assert.equal(state[1].desync, null, `${label}: guest sync`)
  }
  await pauseAndCompare('initial journal')
  for (const speed of [1, 2, 3, 4]) {
    await host.evaluate(async speed => {
      const g = window.vg.game
      await g.coop.send('speed', speed)
      await g.coop.send('pause', false)
    }, speed)
    await guest.waitForFunction(speed => window.vg.game.speed === speed && !window.vg.game.paused, speed)
    await guest.evaluate(speed => {
      const g = window.vg.game
      g.sandboxOrder({ kind: 'sandboxSpawn', enemy: speed % 2 ? 'brute' : 'veilqueen', count: 30, hp: 30, lane: 0 })
      g.sandboxOrder({ kind: 'sandboxSpawn', enemy: 'wraith', count: 20, hp: 10, lane: 1 })
    }, speed)
    const tick = await host.evaluate(() => window.vg.game.sessionTick)
    for (let i = 0; i < 4; i++) {
      await host.waitForTimeout(500)
      await host.evaluate(async i => {
        const g = window.vg.game
        await g.coop.send('cmd', { kind: 'heroMove', x: -3 + i, z: 2 })
        g.setAutoWaves(i % 2 === 0)
      }, i)
    }
    await host.waitForFunction(tick => window.vg.game.sessionTick > tick + 300, tick)
    await pauseAndCompare(`${speed}x combat`)
  }
  await guest.reload()
  await guest.getByRole('button', { name: 'Co-op', exact: true }).click()
  await guest.getByRole('button', { name: 'Rejoin your room' }).click()
  await guest.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  await pauseAndCompare('reload replay')
  // An intentional local corruption must be noticed and recover via the real UI.
  await guest.evaluate(() => { window.vg.game.gold -= 123 })
  await guest.waitForFunction(() => window.vg.game.coopDesync)
  await guest.getByRole('button', { name: 'Resync battle', exact: true }).click()
  await guest.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering && !window.vg.game.coopDesync)
  // The other seat keeps its diagnostic until it too replays or sees a matching turn.
  await host.getByRole('button', { name: 'Resync battle', exact: true }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering && !window.vg.game.coopDesync)
  await pauseAndCompare('repaired from room journal')
  assert.deepEqual(errors, [])
  console.log('PASS: desktop/mobile combat agrees at 1–4x; reload and in-game resync restore the same paused battle.')
} finally {
  writeFileSync('/tmp/blockhold-coop-gameplay.json', JSON.stringify({ checks, errors, hashes: await Promise.all(pages.map(p => p.evaluate(() => window.hashes).catch(() => []))) }, null, 2))
  await browser.close()
}
