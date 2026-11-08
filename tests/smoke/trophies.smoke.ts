import { test, expect, bootToMenu } from './fixtures.ts'

/** a save that has won Greenhollow with three stars, and never opened the trophies */
async function seedProgress(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1')
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ version: 1, unlocked: 2, xp: 400, stars: { greenhollow: 3 }, medals: {}, seenTutorial: true }))
  })
}

test('trophies show what is earned, mark it seen, and open the battle that earns the next', async ({ page, consoleErrors }) => {
  await seedProgress(page)
  await bootToMenu(page)
  const open = page.locator('.trophies-view')
  await expect(open).toContainText('2 new')
  await open.click()
  const sheet = page.getByRole('dialog', { name: 'Trophies' })
  await expect(sheet).toContainText('2 of 59 earned')
  await expect(sheet.locator('.trophy-next')).toContainText('Frostmere Watch')

  // a mark explains itself, and an unearned one leads to its battle
  const statue = sheet.getByRole('button', { name: /^Greenhollow Guardian, not earned/ })
  await statue.click()
  await expect(statue).toHaveAttribute('aria-expanded', 'true')
  await expect(sheet.locator('.trophy-detail:not([hidden])')).toContainText('without letting a single enemy through')
  await expect(sheet.getByRole('button', { name: /^Greenhollow Banner, earned, new/ })).toBeVisible()

  // closing clears the badge, and it stays cleared after a reload
  await sheet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(open.locator('.new-count')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.trophies-view')).toBeVisible()
  await expect(page.locator('.trophies-view .new-count')).toHaveCount(0)

  await page.locator('.trophies-view').click()
  await page.getByRole('dialog', { name: 'Trophies' }).locator('.trophy-next .btn').click()
  await expect(page.locator('.campaign-heading, .levels-screen').first()).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('trophies fit a phone held either way', async ({ browser }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true })
    const page = await context.newPage()
    await seedProgress(page)
    await page.goto('http://127.0.0.1:4173/')
    await page.waitForFunction(() => window.vg)
    const button = page.locator(viewport.width < 700 ? '.trophies-inline' : '.trophies-view')
    await button.tap()
    const sheet = page.getByRole('dialog', { name: 'Trophies' })
    await expect(sheet.locator('.trophy-next .btn')).toBeInViewport()
    const fits = await sheet.evaluate(card => card.scrollWidth <= card.clientWidth && card.getBoundingClientRect().right <= innerWidth)
    expect(fits).toBe(true)
    await sheet.getByRole('button', { name: 'Close', exact: true }).scrollIntoViewIfNeeded()
    await sheet.getByRole('button', { name: 'Close', exact: true }).tap()
    await expect(sheet).toHaveCount(0)
    await context.close()
  }
})
