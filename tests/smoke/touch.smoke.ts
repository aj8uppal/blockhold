/**
 * Touch: hold reads, tap acts.
 *
 * Regression cover for a bug that was invisible to every unit test and to
 * every desktop run of this suite. On a coarse pointer a build option is meant
 * to show its stats when you press and hold it, and to swallow the click that
 * ends the hold - so reading a tower never costs you 70 gold. Wiring only half
 * of that (the hold, or the commit) reintroduces the bug: the hold appears to
 * work and the release quietly buys the tower anyway.
 *
 * The two halves are therefore asserted together: a 700ms press must arm the
 * option and build nothing, and a plain tap on the same option must build.
 */
import { test, expect, bootToMenu, startBattle, openBuildMenu } from './fixtures.ts'

// iPhone 14 Pro Max, landscape - the game refuses to play in portrait
test.use({
  viewport: { width: 932, height: 430 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
    + '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})

test('press-and-hold on a build option inspects instead of building, and a tap builds', async ({ page, context }) => {
  await bootToMenu(page)
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'emulation is not a coarse pointer')
    .toBe(true)

  await startBattle(page, true)

  await openBuildMenu(page, true)
  const option = page.locator('.build-menu .build-option').first()

  const box = await option.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width / 2
  const y = box!.y + box!.height / 2

  const goldBefore = await page.evaluate(() => window.vg.game.gold)
  expect(await page.evaluate(() => window.vg.game.towers.length)).toBe(0)

  // Playwright's touchscreen only knows how to tap, so the hold is dispatched
  // over CDP: a real touchstart, 700ms of nothing, a real touchend.
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, radiusX: 12, radiusY: 12, force: 1, id: 1 }],
  })
  await page.waitForTimeout(700)
  // the hold has to be doing something visible, or "nothing was built" would
  // also pass with hold-to-inspect ripped out entirely
  await expect(option, 'the held option never armed - hold-to-inspect is unwired')
    .toHaveClass(/armed/)
  await expect(page.locator('#build-tip'), 'holding did not show the tower stats')
    .not.toHaveClass(/hidden/)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  // give the click that ends the hold every chance to land
  await page.waitForTimeout(700)
  const afterHold = await page.evaluate(() => ({
    gold: window.vg.game.gold,
    towers: window.vg.game.towers.length,
  }))
  expect(afterHold.towers, 'a press-and-hold built a tower').toBe(0)
  expect(afterHold.gold, 'a press-and-hold spent gold').toBe(goldBefore)

  // ...and the same option, tapped, does buy
  await page.touchscreen.tap(x, y)
  await expect.poll(() => page.evaluate(() => window.vg.game.towers.length), {
    message: 'a plain tap on a build option did not build',
    timeout: 10_000,
  }).toBe(1)
  expect(await page.evaluate(() => window.vg.game.gold)).toBeLessThan(goldBefore)
})
