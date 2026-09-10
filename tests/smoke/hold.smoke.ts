import { test, expect, bootToMenu, startBattle } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { CoopEvent, CoopSession } from '../../src/core/coop.ts'
import type { Screens } from '../../src/ui/screens.ts'

/** Stage the cleared board through the real result-screen callback. */
async function victory(page: import('@playwright/test').Page, coop = false) {
  await bootToMenu(page)
  await startBattle(page)
  await page.evaluate(shared => {
    const g = window.vg.game as unknown as Game
    g.paused = false
    g.waves!.resumeAt(g.waves!.authoredWaves)
    ;(g as unknown as { endGame(won: boolean): void }).endGame(true)
    if (shared) g.coop = {
      seat: 0, seats: 2, connected: [0, 1], ticksPerTurn: 6, paused: false,
      send: async () => false,
    } as unknown as CoopSession
  }, coop)
  await expect(page.getByRole('button', { name: 'Hold the line', exact: true })).toBeVisible()
}

test('solo Hold the Line starts waves and accepts hero movement', async ({ page, consoleErrors }) => {
  await victory(page)
  await page.getByRole('button', { name: 'Hold the line', exact: true }).click()
  await expect(page.locator('.end-screen')).toHaveCount(0)
  const before = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.selectHero()
    return { time: g.time, index: g.waves!.waveIndex, hero: g.hero!.group.position.toArray() }
  })
  // Move to another reachable road position using the same click handler as touch.
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    const spot = g.lanes[0].sample(g.lanes[0].length * 0.5)
    const screen = g.projectToScreen(spot.x, 0, spot.z)!
    g.handleClick(screen.x, screen.y, true)
    g.callWave()
  })
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).waves!.waveIndex)).toBe(before.index + 1)
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).time)).toBeGreaterThan(before.time)
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).hero!.group.position.toArray())).not.toEqual(before.hero)
  expect(consoleErrors).toEqual([])
})

test('an unreachable room keeps the victory actions available', async ({ page, consoleErrors }) => {
  await victory(page, true)
  await page.getByRole('button', { name: 'Hold the line', exact: true }).click()
  await expect(page.locator('.end-screen')).toBeVisible()
  await expect(page.getByText(/Could not reach the room/)).toBeVisible()
  expect(await page.evaluate(() => window.vg.game.phase)).toBe('victory')
  expect(consoleErrors).toEqual([])
})

test('an ally starting Hold the Line dismisses this player’s victory screen', async ({ page, consoleErrors }) => {
  await victory(page, true)
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game & { onCoopEvent(event: CoopEvent): void }
    g.onCoopEvent({ type: 'cmd', seat: 1, turn: 1, cmd: { kind: 'hold' } })
    for (let n = 1; n <= 20; n++) g.onCoopEvent({ type: 'turn', n, ticks: 6 })
  })
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).isFreeplay)).toBe(true)
  await expect(page.locator('.end-screen')).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})

test('Bellfoundry retries its generated board and offers only supported victory actions', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  const seed = await page.evaluate(() => {
    ;(window.vg.screens as unknown as Screens).onPlayBellfoundry()
    const g = window.vg.game as unknown as Game
    ;(g as unknown as { endGame(won: boolean): void }).endGame(false)
    return g.runSeed
  })
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.vg.game.phase)).toBe('playing')
  expect(await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { seed: g.runSeed, bellfoundry: g.isBellfoundry, watches: g.isWatches, coop: !!g.coop }
  })).toEqual({ seed, bellfoundry: true, watches: false, coop: false })
  await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.waves!.resumeAt(g.waves!.authoredWaves)
    ;(g as unknown as { endGame(won: boolean): void }).endGame(true)
  })
  await expect(page.locator('.end-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hold the line', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.vg.game.phase)).toBe('playing')
  expect(consoleErrors).toEqual([])
})

test('leaving Three Watches does not prevent a later solo campaign from holding the line', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => {
    const screens = window.vg.screens as unknown as Screens
    screens.onPlayWatches()
    screens.onMenu()
    screens.onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign')
    const g = window.vg.game as unknown as Game
    g.waves!.resumeAt(g.waves!.authoredWaves)
    ;(g as unknown as { endGame(won: boolean): void }).endGame(true)
  })
  await page.getByRole('button', { name: 'Hold the line', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window.vg.game as unknown as Game).isFreeplay)).toBe(true)
  await expect(page.locator('.end-screen')).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})

test('Three Watches retries the current watch and only advances after a win', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayWatches())
  for (let watch = 0; watch < 3; watch++) {
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      ;(g as unknown as { endGame(won: boolean): void }).endGame(false)
    })
    await expect(page.getByRole('button', { name: /Stand the next watch/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    expect(await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      return { phase: g.phase, watch: g.watchIndex, watches: g.isWatches }
    })).toEqual({ phase: 'playing', watch, watches: true })
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      g.waves!.resumeAt(g.waves!.authoredWaves)
      ;(g as unknown as { endGame(won: boolean): void }).endGame(true)
    })
    await expect(page.getByRole('button', { name: 'Hold the line', exact: true })).toHaveCount(0)
    if (watch < 2) await page.getByRole('button', { name: /Stand the next watch/ }).click()
  }
  await expect(page.getByRole('button', { name: /Stand the next watch/ })).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})
