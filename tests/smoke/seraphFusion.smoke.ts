import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`Seraph sacrifice selects, cancels, confirms and survives reload at ${viewport.width}px`, async ({ page, consoleErrors }) => {
    await page.setViewportSize(viewport)
    await bootToMenu(page)
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      g.save.taughtBasics = true
      ;(window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'sandbox')
    })
    await page.waitForFunction(() => window.vg.game.phase === 'playing')
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      for (const branch of [0, 1]) {
        g.buildTower('seraph', g.terrain!.plots[branch])
        for (let i = 1; i < 6; i++) g.upgradeTower(g.towers[branch], i === 3 ? branch : 0)
      }
      g.selectTower(g.towers[0])
    })
    const awaken = page.getByRole('button', { name: /Awaken Crimson Sovereign/ })
    await awaken.click()
    const modal = page.getByRole('dialog', { name: 'Awaken the Crimson Sovereign' })
    await expect(modal).toBeVisible()
    const confirm = modal.getByRole('button', { name: 'Sacrifice & awaken' })
    await expect(confirm).toBeDisabled()
    expect(await modal.locator('.fusion-result img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth === 384)).toBe(true)
    await modal.getByRole('button', { name: 'Keep both towers' }).click()
    expect(await page.evaluate(() => window.vg.game.towers.length)).toBe(2)
    await awaken.click()
    await modal.getByRole('radio').check()
    await modal.locator('summary').click()
    await expect(modal.locator('.fusion-map svg')).toHaveAttribute('aria-label', /Plot 1 stays; plot 2 is sacrificed/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await modal.getByRole('button', { name: /Sacrifice plot/ }).click()
    await expect(modal).not.toBeVisible()
    expect(await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      return { count: g.towers.length, model: g.towers[0].def.model, donorPlot: g.terrain!.plots[1].occupied }
    })).toEqual({ count: 1, model: 'seraphCrimson', donorPlot: false })
    await page.evaluate(() => { const g = window.vg.game as unknown as Game; g.saveSession() })
    await page.reload()
    await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
    await page.waitForFunction(() => window.vg.game.phase === 'playing' && (window.vg.game as unknown as Game).towers[0]?.isFused)
    await page.getByRole('button', { name: 'Resume', exact: true }).click()
    await page.waitForFunction(() => {
      const tower = (window.vg.game as unknown as Game).towers[0]
      return tower.model.visible && tower.model.parent === tower.group && tower.model.scale.x > 1.37
    })
    expect(await page.evaluate(() => (window.vg.game as unknown as Game).towers[0].def.model)).toBe('seraphCrimson')
    expect(consoleErrors).toEqual([])
  })
}
