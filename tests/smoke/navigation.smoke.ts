import { test, expect, bootToMenu, playButton } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test('a new player can browse the campaign without starting a battle or bypassing locks', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.getByRole('button', { name: 'Campaign', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your battlefield' })).toBeVisible()
  expect(await page.evaluate(() => window.vg.game.phase)).not.toBe('playing')
  const locked = page.getByRole('button', { name: 'Frostmere Pass, locked. Complete Greenhollow to unlock', exact: true })
  await expect(locked).toBeDisabled()
  await expect(locked).toContainText('Complete Greenhollow')
  await page.getByRole('button', { name: 'Greenhollow, 0 of 3 stars', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Greenhollow', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close battle setup' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: false }).click()
  await playButton(page).click()
  await page.waitForFunction(() => window.vg.game.phase === 'playing')
  expect(consoleErrors).toEqual([])
})

test('campaign progress counts cleared maps and earned map stars separately from Veteran medals', async ({ page, consoleErrors }) => {
  await bootToMenu(page)
  await page.evaluate(() => {
    const game = window.vg.game as unknown as Game
    game.save.stars = { greenhollow: 3, frostmere: 2 }
    game.save.medals = { greenhollow: ['veteran'] }
    game.save.unlocked = 3
    ;(window.vg.screens as unknown as Screens).show('levels')
  })
  await expect(page.locator('.campaign-summary')).toContainText('2 / 10')
  await expect(page.locator('.campaign-summary')).toContainText('5 campaign stars')
  await expect(page.getByRole('button', { name: 'The Emberwastes, 0 of 3 stars', exact: true })).toBeEnabled()
  // Visiting the later chapters must never request artwork that does not exist.
  await page.locator('.level-card').last().scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  expect(consoleErrors).toEqual([])
})

test('the smallest portrait menu keeps primary actions and expanded settings reachable', async ({ page, consoleErrors }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await bootToMenu(page)
  await expect(playButton(page)).toBeInViewport({ ratio: 1 })
  await page.locator('.menu-settings summary').click()
  const help = page.getByRole('button', { name: 'How to play', exact: true })
  await help.scrollIntoViewIfNeeded()
  await expect(help).toBeInViewport({ ratio: 1 })
  await help.click()
  await expect(page.getByRole('dialog', { name: 'How to play', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await page.locator('.home-screen').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(consoleErrors).toEqual([])
})
