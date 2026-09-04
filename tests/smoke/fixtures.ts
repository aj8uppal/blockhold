/**
 * Shared plumbing for the smoke suite.
 *
 * The unit tests run the game's modules in isolation; these run the shipped
 * bundle in a real browser, so the things they can catch are the things no
 * unit test can see: a module that throws on import, a menu that never paints,
 * an interaction that is wired in the source but unreachable through the DOM.
 *
 * Every page therefore collects console errors and uncaught exceptions for the
 * whole of its life and attaches them to the report when a test fails - a
 * smoke failure that only says "timed out waiting for .menu-screen" is nearly
 * useless, and the console almost always says why.
 */
import { test as base, expect, type Page } from '@playwright/test'

/** the game's dev handle, exposed by src/main.ts on `window.vg` */
interface GameHandle {
  phase: string
  gold: number
  towers: unknown[]
  enemies: unknown[]
  waves: { waveIndex: number } | null
  terrain: { plots: { index: number, occupied: boolean, pos: { x: number, y: number, z: number } }[] } | null
  projectToScreen(x: number, y: number, z: number): { x: number, y: number } | null
}

interface ScreensHandle {
  dailySeedForShare: number
  show(name: string, opts?: Record<string, unknown>): void
}

declare global {
  interface Window {
    vg: { game: GameHandle, screens: ScreensHandle, hud: unknown }
  }
}

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use, testInfo) => {
    const errors: string[] = []
    // a failed request is not by itself an error the game notices, so it is
    // never asserted on - but it is very often the explanation for one that is
    const failedRequests: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`)
    })
    page.on('pageerror', err => errors.push(`uncaught: ${err.message}`))
    page.on('requestfailed', req => {
      failedRequests.push(`request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`)
    })
    await use(errors)
    const noise = [...errors, ...failedRequests]
    if (testInfo.status !== testInfo.expectedStatus && noise.length) {
      const dump = noise.join('\n')
      console.log(`\n--- browser console during "${testInfo.title}" ---\n${dump}\n---`)
      await testInfo.attach('browser-console', { body: dump, contentType: 'text/plain' })
    }
  },
})

export { expect }

/** load the game and wait for the main menu to exist */
export async function bootToMenu(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'load' })
  await page.waitForSelector('.menu-screen', { timeout: 45_000 })
  await expect(playButton(page)).toBeVisible()
}

/** the menu's primary action: "Play" on a fresh save, "To Battle" afterwards */
export function playButton(page: Page) {
  return page.locator('.menu-screen .btn.primary.big')
}

/** press Play and wait until a level is actually running */
export async function startBattle(page: Page, tap = false): Promise<void> {
  const play = playButton(page)
  if (tap) await play.tap()
  else await play.click()
  await page.waitForFunction(() => window.vg?.game?.phase === 'playing', undefined, { timeout: 30_000 })
  await page.waitForSelector('.topbar .stat.gold', { timeout: 15_000 })
  await page.waitForFunction(
    () => (window.vg.game.terrain?.plots.length ?? 0) > 0,
    undefined,
    { timeout: 15_000 },
  )
  // the camera swings into place over the first moment of a battle, so a plot
  // projected before it settles is no longer under that pixel by the time the
  // click lands
  await page.waitForTimeout(1200)
}

/**
 * Screen coordinates of a buildable plot.
 *
 * The plots are meshes in a 3D scene, so there is no selector for them: the
 * test asks the running game to project one onto the screen and then clicks
 * that pixel, exactly as a player's finger would. Plots too close to an edge
 * are skipped so the build menu has somewhere to open and the HUD chrome is
 * not what receives the tap.
 */
export async function freePlotPoint(page: Page): Promise<{ x: number, y: number }> {
  const point = await page.evaluate(() => {
    const g = window.vg.game
    const plots = g.terrain?.plots ?? []
    for (const p of plots) {
      if (p.occupied) continue
      const s = g.projectToScreen(p.pos.x, p.pos.y, p.pos.z)
      if (!s) continue
      if (s.x > 40 && s.y > 80 && s.x < window.innerWidth - 40 && s.y < window.innerHeight - 90) {
        return { x: Math.round(s.x), y: Math.round(s.y) }
      }
    }
    return null
  })
  expect(point, 'no buildable plot projected onto the screen').not.toBeNull()
  return point!
}

/**
 * Tap a buildable plot until the build menu is open.
 *
 * The plot is a mesh in a moving 3D scene: a click is aimed at a projected
 * pixel, and a camera that is still easing, or a plot that turns out to be
 * behind the HUD, means the ray misses. Re-projecting and trying again is what
 * a player does too, and it keeps the test about "can a tower be built" rather
 * than about hitting a coordinate first time.
 */
export async function openBuildMenu(page: Page, tap = false): Promise<void> {
  const menu = page.locator('.build-menu')
  for (let attempt = 0; attempt < 6; attempt++) {
    const point = await freePlotPoint(page)
    if (tap) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.click(point.x, point.y)
    try {
      await expect(menu).not.toHaveClass(/hidden/, { timeout: 1500 })
      await expect(menu.locator('.build-option').first()).toBeVisible({ timeout: 1500 })
      // the menu ignores input for 350ms after opening, so that the tap which
      // opened it cannot fall through onto a button underneath the finger
      await page.waitForTimeout(450)
      return
    } catch {
      await page.waitForTimeout(300)
    }
  }
  throw new Error('the build menu never opened after six taps on a buildable plot')
}

/** gold as the player reads it, off the HUD rather than out of the model */
export async function hudGold(page: Page): Promise<number> {
  const text = await page.locator('.topbar .stat.gold b').innerText()
  return Number(text.replace(/[^\d]/g, ''))
}

/** the HUD wave counter, e.g. "1/16" -> 1 */
export async function hudWave(page: Page): Promise<number> {
  const text = await page.locator('.topbar .stat.wave b').innerText()
  return Number(text.split('/')[0].replace(/[^\d]/g, ''))
}
