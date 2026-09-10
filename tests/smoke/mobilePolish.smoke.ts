import { test, expect, bootToMenu, freePlotPoint } from './fixtures.ts'
import type { Page } from '@playwright/test'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test.use({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true })
async function battle(page: Page): Promise<void> {
  await bootToMenu(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.save.taughtBasics = true; g.save.xp = 10000
    ;(window.vg.screens as unknown as Screens).onPlayLevel('frostmere', 'normal', 'aldric', 'campaign')
    g.waves!.countdown = 120
  })
  await page.waitForTimeout(1000)
}
async function touchMove(page: Page, at: { x: number, y: number }, dx: number, cancel = false): Promise<void> {
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...at, id: 1 }] })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x + dx, y: at.y, id: 1 }] })
  await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] })
  // Keep this input session until page teardown; detaching resets Chromium
  // touch emulation and changes pointer:coarse during the layout assertions.
}

test('thumb drift still selects, every tower choice fits, and close preserves gold', async ({ page, consoleErrors }) => {
  await battle(page)
  const at = await freePlotPoint(page)
  const gold = await page.evaluate(() => window.vg.game.gold)
  // A small roll inside the touch tolerance is a tap; a pan must not be needed.
  await touchMove(page, { x: at.x - 8, y: at.y }, 8)
  const menu = page.locator('.build-menu')
  await expect(menu).toBeVisible()
  for (const option of await menu.locator('.build-option').all()) await expect(option).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport({ ratio: 1 })
  const fits = await menu.evaluate(el => {
    const r = el.getBoundingClientRect()
    const top = document.querySelectorAll('.topbar-group')[1].getBoundingClientRect()
    return r.top >= top.bottom && r.bottom < innerHeight - 64
  })
  expect(fits).toBe(true)
  await page.getByRole('button', { name: 'Close build menu' }).tap()
  await expect(menu).toBeHidden()
  expect(await page.evaluate(() => window.vg.game.gold)).toBe(gold)
  expect(consoleErrors).toEqual([])
})

test('tower taps toggle off and switching from hero fully releases hero selection', async ({ page, consoleErrors }) => {
  await battle(page)
  const at = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    const plot = g.terrain!.plots.find(p => {
      const s = g.projectToScreen(p.pos.x, p.pos.y, p.pos.z)
      return s && s.x > 65 && s.x < innerWidth * .48 && s.y > 110 && s.y < innerHeight - 100
    })!
    g.buildTower('arrow', plot); g.clearSelection()
    return g.projectToScreen(plot.pos.x, plot.pos.y + .4, plot.pos.z)!
  })
  await page.waitForTimeout(500)
  await page.locator('.hero-btn').tap()
  await expect(page.locator('.hero-btn')).toHaveAttribute('aria-pressed', 'true')
  await page.touchscreen.tap(at.x, at.y)
  await expect(page.locator('.tower-panel .tp-name')).toHaveText('Arrow Tower')
  await expect(page.locator('.hero-btn')).toHaveAttribute('aria-pressed', 'false')
  await page.touchscreen.tap(at.x, at.y)
  await expect(page.locator('.tower-panel')).toBeHidden()
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).selectedTower)).toBeNull()
  expect(consoleErrors).toEqual([])
})

test('cancel exits targeting without spending, and rally yields the panel then restores it', async ({ page, consoleErrors }) => {
  await battle(page)
  const before = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { gold: g.gold, shards: g.shards, cooldown: g.abilities.meteor.cooldown }
  })
  await page.getByRole('button', { name: 'Meteor Storm', exact: true }).tap()
  await expect(page.locator('.mode-hint')).toContainText('Tap to strike')
  await expect(page.getByRole('button', { name: 'Cancel targeting' })).toBeInViewport({ ratio: 1 })
  await page.getByRole('button', { name: 'Cancel targeting' }).tap()
  expect(await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { gold: g.gold, shards: g.shards, cooldown: g.abilities.meteor.cooldown }
  })).toEqual(before)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.buildTower('barracks', g.terrain!.plots.find(p => !p.occupied)!)
    g.setTargetMode('rally')
  })
  await expect(page.locator('.tower-panel')).toBeHidden()
  await expect(page.locator('.mode-hint')).toContainText('rally point')
  await page.getByRole('button', { name: 'Cancel targeting' }).tap()
  await expect(page.locator('.tower-panel')).toBeVisible()
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).targetMode)).toBeNull()
  expect(consoleErrors).toEqual([])
})

test('panning and cancelled touches never select or buy', async ({ page, consoleErrors }) => {
  await battle(page)
  const at = await freePlotPoint(page)
  await touchMove(page, at, 35)
  await expect(page.locator('.build-menu')).toBeHidden()
  await touchMove(page, await freePlotPoint(page), 0, true)
  await expect(page.locator('.build-menu')).toBeHidden()
  expect(await page.evaluate(() => window.vg.game.towers.length)).toBe(0)
  expect(consoleErrors).toEqual([])
})

test('portrait menus remain usable; rotating during a battle pauses and allows save and exit', async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await bootToMenu(page)
  await expect(page.locator('#rotate-overlay')).toBeHidden()
  await page.setViewportSize({ width: 667, height: 375 })
  await battle(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#rotate-overlay')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).paused)).toBe(true)
  const time = await page.evaluate(() => (window.vg.game as unknown as Game).time)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).time)).toBe(time)
  await expect(page.locator('#rotate-exit')).toHaveText('Save & exit')
  await page.locator('#rotate-exit').tap()
  await expect(page.locator('.menu-screen')).toBeVisible()
  await expect(page.locator('#rotate-overlay')).toBeHidden()
  expect(await page.evaluate(() => !!localStorage.getItem('blockhold.session.v1'))).toBe(true)
  expect(consoleErrors).toEqual([])
})

test('rally shows invalid-point feedback and restores its inspector after a valid tap', async ({ page, consoleErrors }) => {
  await battle(page)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.buildTower('barracks', g.terrain!.plots.find(p => !p.occupied)!)
    g.setTargetMode('rally')
  })
  const points = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    let valid: { x: number, y: number } | null = null, invalid: { x: number, y: number } | null = null
    for (let y = 105; y < innerHeight - 125; y += 5) for (let x = 20; x < innerWidth - 20; x += 5) {
      if (document.elementFromPoint(x, y)?.id !== 'game') continue
      const at = g.groundPoint(x, y)
      if (!at) continue
      if (g.selectedTower!.isValidRally(at.x, at.z, g)) valid ??= { x, y }
      else invalid ??= { x, y }
    }
    return { valid, invalid }
  })
  expect(points.valid).not.toBeNull(); expect(points.invalid).not.toBeNull()
  await page.touchscreen.tap(points.invalid!.x, points.invalid!.y)
  await expect(page.locator('.mode-hint')).toHaveClass(/invalid/)
  await expect(page.locator('.mode-hint')).toContainText('within rally range')
  await page.touchscreen.tap(points.valid!.x, points.valid!.y)
  await expect(page.locator('.mode-hint')).toBeHidden()
  await expect(page.locator('.tower-panel')).toBeVisible()
  expect(await page.evaluate(() => (window.vg.game as unknown as Game).selectedTower?.kind)).toBe('barracks')
  expect(consoleErrors).toEqual([])
})

test('portrait exit labels an unsavable run and requires a second abandon tap', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayDaily())
  await page.waitForFunction(() => window.vg.game.phase === 'playing')
  await page.setViewportSize({ width: 390, height: 844 })
  const exit = page.locator('#rotate-exit')
  await expect(exit).toHaveText('Abandon mission')
  await exit.tap()
  await expect(exit).toHaveText('Abandon without saving?')
  expect(await page.evaluate(() => window.vg.game.phase)).toBe('playing')
  await exit.tap()
  await expect(page.locator('.menu-screen')).toBeVisible()
  await expect(page.locator('#rotate-overlay')).toBeHidden()
  expect(consoleErrors).toEqual([])
})
