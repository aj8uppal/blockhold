import { test, expect, bootToMenu } from './fixtures.ts'
import type { Game } from '../../src/game/game.ts'
import type { Screens } from '../../src/ui/screens.ts'

test('cuttings leave the scene on exit, restore once, and never follow a retry or another map', async ({ page, consoleErrors }) => {
  await page.addInitScript(() => {
    localStorage.setItem('blockhold.save.v1', JSON.stringify({ xp: 30000, taughtBasics: true, sfxMuted: true, musicMuted: true }))
    localStorage.setItem('blockhold.quality', 'low')
  })
  await bootToMenu(page)
  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayLevel('greenhollow', 'normal', 'aldric', 'campaign'))
  const original = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    g.buildEarthwork(g.terrain!.earthworkSpots[0])
    return g.earthworks[0].group.uuid
  })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('button', { name: 'Save & exit', exact: true }).click()
  expect(await page.evaluate(id => !!(window.vg.game as unknown as Game).dynamic.getObjectByProperty('uuid', id), original)).toBe(false)

  await page.getByRole('button', { name: /Continue Greenhollow/ }).click()
  await page.waitForFunction(() => {
    const g = window.vg.game as unknown as Game
    return g.phase === 'playing' && !g.isRecovering && g.paused
  })
  const restored = await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { count: g.earthworks.length, meshes: g.dynamic.children.filter(o => o.getObjectByName('dug')).length }
  })
  expect(restored).toEqual({ count: 1, meshes: 1 })

  // Retry uses the same scene container. Repeating it must not accumulate models.
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => (window.vg.screens as unknown as Screens).onRetry())
    expect(await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      return { count: g.earthworks.length, meshes: g.dynamic.children.filter(o => o.getObjectByName('dug')).length }
    })).toEqual({ count: 0, meshes: 0 })
    await page.evaluate(() => {
      const g = window.vg.game as unknown as Game
      g.buildEarthwork(g.terrain!.earthworkSpots[0])
      g.selectedEarthwork = g.earthworks[0]
      g.selectedEarthSpot = g.terrain!.earthworkSpots[1]
    })
  }

  await page.evaluate(() => (window.vg.screens as unknown as Screens).onPlayLevel('cloudstep', 'normal', 'aldric', 'sandbox'))
  await page.waitForFunction(() => (window.vg.game as unknown as Game).level?.id === 'cloudstep')
  expect(await page.evaluate(() => {
    const g = window.vg.game as unknown as Game
    return { count: g.earthworks.length, meshes: g.dynamic.children.filter(o => o.getObjectByName('dug')).length,
      selected: g.selectedEarthwork, spot: g.selectedEarthSpot }
  })).toEqual({ count: 0, meshes: 0, selected: null, spot: null })
  expect(consoleErrors).toEqual([])
})
