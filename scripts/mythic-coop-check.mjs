/** A mobile seat replays and rejoins a live ruleset-17 Mythic defense. */
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const base = process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5194/'
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
    page.on('pageerror', e => errors.push(e.message)); pages.push(page)
  }
  const [host, guest] = pages
  await host.goto(base)
  await host.waitForFunction(() => window.vg?.game)
  await host.evaluate(() => {
    window.vg.screens.onPlayLevel('greenhollow', 'normal', 'zephyra', 'sandbox')
    const g = window.vg.game, plots = g.terrain.plots.filter(p => !p.water)
    for (const [i, kind] of ['arrow', 'mage', 'cannon', 'ballista', 'beacon', 'barracks', 'arrow', 'mage'].entries()) {
      g.buildTower(kind, plots[i])
      for (let tier = 1; tier < 6; tier++) g.upgradeTower(g.towers[i], tier === 3 ? i % 2 : 0)
    }
    for (let i = 0; i < 3; i++) g.upgradeHeroSignature()
    g.clearSelection(); g.togglePause()
  })
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  const code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await guest.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering)
  assert.ok(await host.evaluate(() => window.vg.game.coop.send('pause', false)))
  for (const page of pages) await page.waitForFunction(() => !window.vg.game.paused)
  const sent = await host.evaluate(async () => {
    const c = window.vg.game.coop
    return [
      await c.send('cmd', { kind: 'sandboxSpawn', enemy: 'juggernaut', count: 25, lane: 0, hp: 100 }),
      await c.send('cmd', { kind: 'sandboxSpawn', enemy: 'gargoyle', count: 25, lane: 0, hp: 100 }),
      await c.send('speed', 4),
    ]
  })
  assert.deepEqual(sent, [true, true, true])
  await host.waitForFunction(() => window.vg.game.enemies.length > 0)
  const combatStart = await host.evaluate(() => window.vg.game.time)
  await host.waitForFunction(t => window.vg.game.time > t + 30, combatStart, { timeout: 60000 })
  await guest.evaluate(() => window.vg.game.castHeroSignature())
  await host.evaluate(() => window.vg.game.coop.send('pause', true))
  async function compare(label) {
    for (const p of pages) await p.waitForFunction(() => {
      const g = window.vg.game
      return g.paused && !g.isRecovering && !g.coopBudget && g.coopMarkers.every(m => !m.ticks)
    })
    const state = await Promise.all(pages.map(p => p.evaluate(() => {
      const g = window.vg.game
      return { hash: g.sessionStateHash(), tick: g.sessionTick, ruleset: g.balanceRuleset, towers: g.towers.length, levels: g.towers.map(t=>t.level), mode:g.mode, sandbox:g.isSandbox, enemies:g.enemies.length, powers: g.towers.map(t => t.mythicAbility.readyAt) }
    })))
    console.log(JSON.stringify({ label, ...state[0] }))
    assert.deepEqual(state[0], state[1]); assert.equal(state[0].ruleset, 17)
    assert.equal(state[0].towers, 8); assert.ok(state[0].powers.some(t => t > 3))
  }
  await compare('four-speed combat')
  await guest.reload()
  await guest.getByRole('button', { name: 'Co-op', exact: true }).click()
  await guest.getByRole('button', { name: 'Rejoin your room' }).click()
  await guest.waitForFunction(() => window.vg?.game?.coop && !window.vg.game.isRecovering)
  await compare('mobile rejoin')
  await host.evaluate(() => window.vg.game.coop.send('pause', false))
  await host.waitForFunction(t => window.vg.game.time > t + 40, combatStart, { timeout: 60000 })
  await guest.evaluate(() => window.vg.game.coop.send('pause', true))
  await compare('continued after rejoin')
  assert.deepEqual(errors, [])
} finally { await browser.close() }
