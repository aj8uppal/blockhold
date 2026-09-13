import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
const base = process.env.BLOCKHOLD_CHECK_URL ?? 'http://127.0.0.1:5193/'
const out = '/tmp/blockhold-gameplay-ui'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errors = []
try {
  for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 667, 375], ['portrait', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: name !== 'desktop', isMobile: name !== 'desktop' })
    await context.addInitScript(() => {
      localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
      localStorage.setItem('blockhold.quality', 'low')
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base)
    await page.waitForFunction(() => window.vg?.game)
    await page.getByRole('button', { name: 'Co-op', exact: true }).click()
    await page.screenshot({ path: `${out}/${name}-lobby.png` })
    if (name === 'portrait') { await context.close(); continue }
    await page.evaluate(() => {
      const g = window.vg.game
      window.vg.screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox')
      g.buildTower('cannon', g.terrain.plots[0])
      for (let i = 1; i < 5; i++) g.upgradeTower(g.towers[0], 0)
      g.clearSelection()
    })
    if (name !== 'portrait') {
      await page.locator('.sandbox-tools > summary').click()
      await page.getByRole('button', { name: 'Send enemies', exact: true }).click()
      assert.equal(await page.locator('.sandbox-tools').evaluate(d => d.open), true)
      await page.screenshot({ path: `${out}/${name}-sandbox.png` })
      await page.getByRole('button', { name: 'Close tools' }).click()
    }
    await page.evaluate(() => window.vg.game.togglePause())
    await page.evaluate(() => window.vg.game.hud.onCoopSwitch())
    await page.waitForFunction(() => window.vg.game.coop && !window.vg.game.isRecovering)
    await page.evaluate(async () => await window.vg.game.coop.send('pause', false))
    await page.waitForFunction(() => !window.vg.game.paused)
    await page.evaluate(() => window.vg.game.selectTower(window.vg.game.towers[0]))
    await page.locator('.coop-chat > summary').click()
    await page.getByRole('textbox', { name: 'Chat message' }).fill('Covering the left road')
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await page.getByRole('log').getByText('You: Covering the left road').waitFor()
    await page.getByRole('textbox', { name: 'Chat message' }).blur()
    await page.waitForTimeout(300)
    const bounds = await page.evaluate(() => {
      const tower = document.querySelector('.tower-panel').getBoundingClientRect()
      const chat = document.querySelector('.coop-chat').getBoundingClientRect()
      const speed = document.querySelector('[aria-label="Game speed"]').getBoundingClientRect()
      const flow = document.querySelector('.wave-flow-btn').getBoundingClientRect()
      return { tower: { top: tower.top, bottom: tower.bottom, height: tower.height }, chat: { top: chat.top, bottom: chat.bottom }, speed: { right: speed.right, top: speed.top }, flow: { left: flow.left, top: flow.top } }
    })
    console.log(name, JSON.stringify(bounds))
    if (name !== 'portrait') {
      assert.ok(bounds.tower.bottom + 8 <= bounds.chat.top, `${name}: inspector above chat`)
      assert.ok(bounds.tower.top >= 0 && bounds.tower.height >= 50, `${name}: inspector remains usable`)
      assert.ok(bounds.flow.left >= bounds.speed.right && bounds.flow.top === bounds.speed.top, `${name}: wave flow beside speed`)
    }
    await page.screenshot({ path: `${out}/${name}-chat-inspector.png` })
    await context.close()
  }
  assert.deepEqual(errors, [])
  console.log(`PASS: sandbox remains open; chat has its own space; screenshots at ${out}`)
} finally { await browser.close() }
