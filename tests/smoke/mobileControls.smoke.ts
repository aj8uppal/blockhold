import type { Page } from '@playwright/test'
import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

// Real Chromium touch input and the shipped bundle. Fullscreen is the one
// browser API mocked: headless fullscreen support varies across CI hosts.
test.use({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
})

async function startFrostmere(page: Page): Promise<void> {
  await bootToMenu(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.taughtBasics = true
    ;(window.vg.screens as unknown as Screens).onPlayLevel('frostmere', 'normal', 'aldric', 'campaign')
    // Stage a generous planning window; no towers, gold, or combat outcomes
    // are fabricated. This suite checks controls and layout, not balance.
    g.waves!.countdown = 120
  })
  await expect(page.locator('.wave-call')).toBeVisible()
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
}

test('portrait and 1 toggle hero selection; abilities follow 1, 2, 3, 4', async ({ page, consoleErrors }) => {
  await startFrostmere(page)
  const hero = page.locator('.hero-btn')
  await expect(hero).toHaveAttribute('aria-pressed', 'false')
  for (const selected of [true, false]) {
    await hero.tap()
    await expect(hero).toHaveAttribute('aria-pressed', String(selected))
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).heroSelected)).toBe(selected)
  }
  for (const selected of [true, false]) {
    await page.keyboard.press('Digit1')
    await expect(hero).toHaveAttribute('aria-pressed', String(selected))
  }
  await expect(page.locator('.abilities > .ability .hotkey')).toHaveText(['1', '2', '3', '4'])
  const controls = [hero, page.getByRole('button', { name: 'Hero signature ability', exact: true }),
    page.getByRole('button', { name: 'Meteor Storm', exact: true }), page.getByRole('button', { name: 'Reinforcements', exact: true })]
  let lastRight = 0
  for (const control of controls) {
    await expect(control).toBeInViewport({ ratio: 1 })
    const box = (await control.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(lastRight)
    lastRight = box.x + box.width
  }
  // Observe the real signature handler, preserving its behavior (an empty
  // field correctly does not spend a signature cooldown).
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.hero!.abilityCooldown = 0
    const cast = g.castHeroSignature.bind(g)
    document.documentElement.dataset.signatureCalls = '0'
    g.castHeroSignature = () => {
      document.documentElement.dataset.signatureCalls = String(Number(document.documentElement.dataset.signatureCalls) + 1)
      cast()
    }
  })
  await expect(controls[1]).toBeEnabled()
  await controls[1].tap()
  await page.keyboard.press('Digit2')
  expect(await page.evaluate(() => document.documentElement.dataset.signatureCalls)).toBe('2')
  for (const [index, mode, key] of [[2, 'meteor', 'Digit3'], [3, 'reinforce', 'Digit4']] as const) {
    await controls[index].tap()
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).targetMode)).toBe(mode)
    await page.keyboard.press(key)
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).targetMode)).toBeNull()
    await page.keyboard.press(key)
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).targetMode)).toBe(mode)
    await controls[index].tap()
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).targetMode)).toBeNull()
  }
  expect(consoleErrors).toEqual([])
})

test('direct fullscreen toggles in battle without pausing', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => {
    let active: Element | null = null
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => true })
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active })
    const changed = () => {
      document.documentElement.dataset.fullscreenCalls = String(Number(document.documentElement.dataset.fullscreenCalls ?? 0) + 1)
      document.dispatchEvent(new Event('fullscreenchange'))
    }
    HTMLElement.prototype.requestFullscreen = async () => { active = document.documentElement; changed() }
    document.exitFullscreen = async () => { active = null; changed() }
  })
  await startFrostmere(page)
  const control = page.getByRole('button', { name: 'Toggle fullscreen', exact: true })
  await expect(control).toBeInViewport({ ratio: 1 })
  const before = await page.evaluate(() => Number(document.documentElement.dataset.fullscreenCalls ?? 0))
  for (let i = 1; i <= 2; i++) {
    await control.tap()
    expect(await page.evaluate(() => Number(document.documentElement.dataset.fullscreenCalls))).toBe(before + i)
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).paused)).toBe(false)
    await expect(page.locator('.pause-overlay')).toHaveClass(/hidden/)
  }
  const time = await page.evaluate(() => (window.vg.game as unknown as Game).time)
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).time)).toBeGreaterThan(time)
  expect(consoleErrors).toEqual([])
})

test('quality selection persists reload and preserves fixed combat ticks', async ({ page, consoleErrors }) => {
  await startFrostmere(page)
  await page.locator('.wave-call').tap()
  await page.waitForFunction(() => window.vg.game.enemies.length > 0)
  await page.getByRole('button', { name: 'Pause', exact: true }).tap()
  const quality = page.getByLabel('Visual quality', { exact: true })
  await expect(quality).toBeVisible()
  for (const preference of ['high', 'low', 'battery']) {
    await quality.selectOption(preference)
    const result = await page.evaluate(preference => {
      const g = window.vg.game as unknown as Game
      // Feed equal elapsed-time budgets synchronously, so software GPU speed
      // and other Playwright workers cannot distort a wall-clock comparison.
      // Battery uses 30-Hz-sized frames; both paths must still tick at 60 Hz.
      const state = g as unknown as { sessionTick: number }
      const before = { tick: state.sessionTick, time: g.time, speed: g.speed }
      const frames = preference === 'battery' ? 30 : 60
      g.paused = false
      for (let i = 0; i < frames; i++) g.update(1 / frames)
      g.paused = true
      g.hud.refresh(g)
      return { ticks: state.sessionTick - before.tick, seconds: g.time - before.time,
        speed: g.speed, previousSpeed: before.speed, quality: g.engine.qualityPreference }
    }, preference)
    expect(result.quality).toBe(preference)
    expect(result.speed).toBe(result.previousSpeed)
    expect(result.ticks).toBe(60)
    expect(result.seconds).toBeCloseTo(1, 8)
    expect(await page.evaluate(() => localStorage.getItem('blockhold.quality'))).toBe(preference)
  }
  await page.reload()
  await page.waitForFunction(() => !!window.vg?.game)
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).engine.qualityPreference)).toBe('battery')
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.taughtBasics = true
    ;(window.vg.screens as unknown as Screens).onPlayLevel('frostmere', 'normal', 'aldric', 'campaign')
  })
  await page.getByRole('button', { name: 'Pause', exact: true }).tap()
  await expect(page.getByLabel('Visual quality', { exact: true })).toHaveValue('battery')
  expect(consoleErrors).toEqual([])
})

for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
  test(`Frostmere wave prompt stays compact and usable at ${viewport.width}×${viewport.height}`, async ({ page, consoleErrors }, testInfo) => {
    await page.setViewportSize(viewport)
    await startFrostmere(page)
    // Stage an authored wave with several enemy types and real counter tags.
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      g.waves!.resumeAt(4)
      g.waves!.countdown = 14
      g.hud.refresh(g)
    })
    const prompt = page.locator('.wave-call-wrap')
    const button = page.locator('.wave-call')
    await expect(button).toContainText('Call wave 5')
    await expect(button).toBeInViewport({ ratio: 1 })
    const details = page.locator('.wave-details')
    await expect(details).not.toHaveAttribute('open', '')
    await expect(details.locator('summary')).toContainText('incoming')
    const geometry = await prompt.evaluate(el => {
      const box = el.getBoundingClientRect()
      const controls = Array.from(document.querySelectorAll('.topbar-group')).map(control => {
        const rect = control.getBoundingClientRect()
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
      })
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, height: box.height,
        overflow: el.scrollWidth > el.clientWidth + 1,
        controlsOverlap: controls.some(rect => box.x < rect.right && box.right > rect.x && box.y < rect.bottom && box.bottom > rect.y) }
    })
    expect(geometry.x).toBeGreaterThanOrEqual(0)
    expect(geometry.right).toBeLessThanOrEqual(viewport.width)
    expect(geometry.height, 'wave prompt consumes too much of a landscape battlefield').toBeLessThanOrEqual(100)
    expect(geometry.bottom, 'wave prompt extends beyond the upper third of the battlefield').toBeLessThanOrEqual(viewport.height / 3 + 5)
    expect(geometry.overflow).toBe(false)
    expect(geometry.controlsOverlap).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`frostmere-wave-${viewport.width}.png`) })
    await details.locator('summary').tap()
    await expect(page.locator('.wave-preview')).toBeVisible()
    await expect(page.locator('.wave-preview')).toBeInViewport({ ratio: 1 })
    await expect(page.locator('.wave-preview .wp-unit')).toHaveCount(2)
    expect(await page.locator('.wave-preview .wp-tag').count()).toBeGreaterThan(0)
    await page.screenshot({ path: testInfo.outputPath(`frostmere-details-${viewport.width}.png`) })
    await details.locator('summary').tap()
    await expect(page.locator('.wave-preview')).not.toBeVisible()
    await button.tap()
    expect(await page.evaluate(() => window.vg.game.waves!.waveIndex)).toBe(4)
    expect(consoleErrors).toEqual([])
  })
}
