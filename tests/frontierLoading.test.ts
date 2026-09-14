import { describe, expect, it } from 'vitest'
import { allLevels, levels, loadFrontier } from '../src/game/levels.ts'
import { FRONTIER_BOARDS } from '../src/game/frontierIndex.ts'
import { THEMES } from '../src/game/terrain.ts'

/**
 * The Frontier arrives in its own chunk. Until it is asked for, the game is
 * exactly the campaign; once loaded, every board, theme and sky it needs is in
 * place before anything tries to open one.
 */
describe('loading the Frontier on demand', () => {
  it('starts with the campaign alone and adds every board, theme and sky once loaded', async () => {
    expect(allLevels.map(l => l.id)).toEqual(levels.map(l => l.id))
    expect(THEMES.cosmos).toBeUndefined()
    await loadFrontier()
    await loadFrontier()
    for (const b of FRONTIER_BOARDS) {
      expect(allLevels.filter(l => l.id === b.id)).toHaveLength(1)
      expect(THEMES[b.theme]?.sky, b.theme).toBeDefined()
    }
    expect(allLevels).toHaveLength(levels.length + FRONTIER_BOARDS.length)
  })
})
