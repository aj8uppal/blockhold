/** Historical save → co-op → solo → reload using isolated, synthetic player accounts. */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const base = (process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5178/').replace(/\/?$/, '/')
const battle = JSON.parse(readFileSync(new URL('../tests/fixtures/seraph-v9-battle.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const pages = [], errors = []
try {
  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({ viewport: { width: 960, height: 600 } })
    await context.addInitScript(({ battle, player }) => {
      if (!localStorage.getItem('blockhold.recovery-check')) {
        localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: player ? 7000 : 5000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
        if (!player) localStorage.setItem('blockhold.session.v1', JSON.stringify(battle))
        localStorage.setItem('blockhold.quality', 'low')
        localStorage.setItem('blockhold.recovery-check', '1')
      }
    }, { battle, player: i })
    const page = await context.newPage(); pages.push(page)
    page.on('pageerror', error => errors.push(error.message))
  }
  const [host, guest] = pages
  await host.goto(base)
  await host.getByRole('button', { name: /Continue The Bone Procession/ }).click()
  await host.waitForFunction(() => window.vg.game.legacyCombat && !window.vg.game.isRecovering && window.vg.game.paused)
  assert.equal(await host.evaluate(() => window.vg.game.sessionStateHash(9)), battle.stateHash)
  await host.getByRole('button', { name: 'Invite a friend to this battle' }).click()
  await host.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
  const code = await host.evaluate(() => window.vg.game.coop.code)
  await guest.goto(`${base}?coop=${code}`)
  await guest.waitForFunction(() => window.vg?.game?.coop && window.vg.game.legacyCombat && !window.vg.game.isRecovering)
  const hash = await host.evaluate(() => window.vg.game.sessionStateHash())
  assert.equal(hash, await guest.evaluate(() => window.vg.game.sessionStateHash()))
  const earned = await guest.evaluate(() => window.vg.game.liveXpEarned)
  assert.equal(await guest.evaluate(() => window.vg.game.xpPreview()), 7000 + earned)
  assert.equal(await guest.evaluate(() => window.vg.game.roster.xp), 20000)
  await guest.evaluate(() => window.vg.game.continueSolo())
  const paid = await guest.evaluate(() => window.vg.game.save.xp)
  assert.equal(paid, 7000 + earned)
  await guest.evaluate(() => window.vg.game.saveSession())
  assert.equal(await guest.evaluate(() => window.vg.game.save.xp), paid)
  await guest.reload()
  await guest.getByRole('button', { name: /Continue The Bone Procession/ }).click()
  await guest.waitForFunction(() => window.vg.game.legacyCombat && !window.vg.game.isRecovering && window.vg.game.paused)
  assert.equal(await guest.evaluate(() => window.vg.game.sessionStateHash()), hash)
  assert.equal(await guest.evaluate(() => window.vg.game.xpPreview()), paid)
  assert.deepEqual(errors, [])
  console.log('PASS: actual v9 Seraph save restores; co-op and solo/reload preserve exact battle state and each player’s own XP without double payment.')
} finally { await browser.close() }
