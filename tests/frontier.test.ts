import { describe, expect, it } from 'vitest'
import { deriveEarthworkSpots } from '../src/game/earthworks.ts'
import { enemyDefs } from '../src/game/enemyDefs.ts'
import { frontierLevels, FRONTIER_GRIDS, FRONTIER_TIERS } from '../src/game/frontier.ts'
import { FRONTIER_BOARDS } from '../src/game/frontierIndex.ts'
import { allLevels, dailyLevel, levelById, levels } from '../src/game/levels.ts'
import { parseGrid } from '../src/game/mapGrid.ts'
import { buildPaths, gridToWorld, waypointHeight } from '../src/game/path.ts'
import { REACTION_RADIUS } from '../src/game/towers.ts'
import { THEMES } from '../src/game/terrain.ts'
import { starsEarned, crownStars } from '../src/game/armory.ts'
import { parseSave, type SaveData } from '../src/core/save.ts'
import { nextObjective } from '../src/ui/screens.ts'
import type { LevelDef, Rect } from '../src/game/types.ts'

const defaultSave = (): SaveData => parseSave({})!

const inRects = (rects: Rect[], c: number, r: number) => rects.some(([c0, r0, c1, r1]) => c >= c0 && c <= c1 && r >= r0 && r <= r1)

describe('the Frontier collection', () => {
  it('has ten boards with unique ids that never collide with the campaign', () => {
    expect(frontierLevels).toHaveLength(10)
    const ids = allLevels.map(l => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of frontierLevels) expect(levelById(l.id)).toBe(l)
  })

  /** the menus describe the boards from a small index so the boards themselves can load on demand */
  it('describes every board truthfully in the index the menus read', () => {
    expect(FRONTIER_BOARDS.map(b => b.id)).toEqual(frontierLevels.map(l => l.id))
    for (const [i, b] of FRONTIER_BOARDS.entries()) {
      const l = frontierLevels[i]
      expect(b, l.id).toEqual({ id: l.id, name: l.name, theme: l.theme, tier: l.frontier!.tier, feature: l.frontier!.feature, waves: l.waves.length, roads: l.lanes.length })
    }
  })

  it('spans every difficulty tier, gentlest first', () => {
    const order = FRONTIER_TIERS.map(t => t.tier)
    const tiers = frontierLevels.map(l => l.frontier!.tier)
    for (const t of order) expect(tiers.filter(x => x === t).length, t).toBeGreaterThanOrEqual(3)
    expect([...tiers].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(tiers)
  })

  it('gives every board its own theme with a painted sky', () => {
    const themes = frontierLevels.map(l => l.theme)
    expect(new Set(themes).size).toBe(frontierLevels.length)
    for (const l of frontierLevels) expect(THEMES[l.theme].sky, l.id).toBeDefined()
    expect(frontierLevels.some(l => THEMES[l.theme].sky?.stars && THEMES[l.theme].sky?.body?.kind === 'planet'), 'a board in space').toBe(true)
  })

  it('keeps the campaign order, the Daily rotation and unlocks to the campaign alone', () => {
    expect(levels.some(l => l.frontier)).toBe(false)
    for (let seed = 0; seed < 40; seed++) expect(dailyLevel(seed).frontier).toBeUndefined()
  })

  it('does not pay Frontier stars or Veteran medals into the Armory', () => {
    const save = defaultSave()
    save.stars = { greenhollow: 3 }
    save.medals = { greenhollow: ['veteran'] }
    const campaignOnly = starsEarned(save)
    for (const l of frontierLevels) { save.stars[l.id] = 3; save.medals[l.id] = ['veteran'] }
    expect(starsEarned(save)).toBe(campaignOnly)
    expect(crownStars(save)).toBe(1)
  })

  it('points a finished Frontier board at the next unbeaten one', () => {
    const save = defaultSave()
    const [first, second] = frontierLevels
    save.stars[first.id] = 3
    save.medals[first.id] = ['veteran', 'noleak']
    const next = nextObjective(save, { won: true, levelId: first.id, stars: 3 })
    expect(next.action).toBe('next')
    expect(next.levelId).toBe(second.id)
    expect(nextObjective(save, { won: false, levelId: second.id, stars: 0 }).action).toBe('retry')
  })

  /** the same board grows harder the further down the list it sits */
  it('asks more of the player tier by tier', () => {
    const load = (l: LevelDef) => l.lanes.length * 10 + l.waves.length
    const mean = (tier: string) => {
      const xs = frontierLevels.filter(l => l.frontier!.tier === tier).map(load)
      return xs.reduce((a, b) => a + b, 0) / xs.length
    }
    expect(mean('medium')).toBeGreaterThan(mean('easy'))
    expect(mean('hard')).toBeGreaterThan(mean('medium'))
  })
})

describe('Frontier board data', () => {
  for (const lvl of frontierLevels) {
    describe(lvl.id, () => {
      const paths = buildPaths(lvl)

      it('draws exactly the roads its lanes walk, and bridges exactly where they cross the sky', () => {
        const drawn = parseGrid(FRONTIER_GRIDS[lvl.id].rows, FRONTIER_GRIDS[lvl.id].heights)
        expect([...drawn.drawnRoads].sort()).toEqual([...paths.roadCells].sort())
        const bridges = [...paths.roadCells].filter(k => { const [c, r] = k.split(',').map(Number); return inRects(lvl.voids, c, r) })
        expect(bridges.sort()).toEqual([...drawn.drawnBridges].sort())
      })

      it('uses axis-aligned lanes inside the grid, with a real ramp wherever the road changes height', () => {
        for (const lane of lvl.lanes) {
          for (const [c, r] of lane) {
            expect(c >= 0 && c < lvl.width && r >= 0 && r < lvl.height, `${c},${r}`).toBe(true)
          }
          for (let i = 1; i < lane.length; i++) {
            const a = lane[i - 1], b = lane[i]
            expect(a[0] === b[0] || a[1] === b[1]).toBe(true)
            const cells = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
            expect(cells, `${a} -> ${b}`).toBeGreaterThan(0)
            if (waypointHeight(a) !== waypointHeight(b)) expect(cells, `${a} -> ${b} steps without a ramp`).toBeGreaterThanOrEqual(2)
          }
        }
        expect(paths.surfaceConflicts).toEqual([])
      })

      it('keeps foundations, traps and set-pieces where they belong', () => {
        for (const [c, r] of lvl.plots) {
          expect(paths.roadCells.has(`${c},${r}`), `plot on road ${c},${r}`).toBe(false)
          expect(inRects(lvl.water, c, r) || inRects(lvl.voids, c, r), `plot off solid ground ${c},${r}`).toBe(false)
        }
        for (const [c, r] of lvl.trapSpots ?? []) {
          expect(paths.roadCells.has(`${c},${r}`)).toBe(true)
          expect(inRects(lvl.voids, c, r), `trap on a bridge ${c},${r}`).toBe(false)
        }
        for (const [c, r, kind] of lvl.landmarks ?? []) {
          expect(Math.min(c, r, lvl.width - 1 - c, lvl.height - 1 - r), `${kind} hugs the border`).toBeGreaterThanOrEqual(2)
          expect(paths.roadCells.has(`${c},${r}`) || lvl.plots.some(([pc, pr]) => pc === c && pr === r)
            || inRects(lvl.water, c, r) || inRects(lvl.voids, c, r), `${kind} blocked`).toBe(false)
        }
        for (const [c, r] of lvl.waterPlots ?? []) expect(inRects(lvl.water, c, r), `mooring ${c},${r}`).toBe(true)
      })

      it('references real enemies and spaces its surges', () => {
        let previous = -2
        lvl.waves.forEach((wave, i) => {
          for (const g of wave.groups) {
            expect(enemyDefs.has(g.enemy), g.enemy).toBe(true)
            expect(g.lane ?? 0).toBeLessThan(lvl.lanes.length)
          }
          if (wave.surge) { expect(i - previous).toBeGreaterThan(1); previous = i }
        })
      })

      it('gives every lane enough foundations, some of them neighbours and some on high ground', () => {
        const perLane = paths.lanes.map(() => 0)
        for (const [c, r] of lvl.plots) {
          const [x, z] = gridToWorld(c, r, lvl.width, lvl.height)
          paths.lanes.forEach((lane, i) => { if (lane.distanceToPath(x, z) <= 3.6) perLane[i]++ })
        }
        perLane.forEach((n, i) => expect(n, `lane ${i}`).toBeGreaterThanOrEqual(6))
        let pairs = 0
        for (let i = 0; i < lvl.plots.length; i++) for (let j = i + 1; j < lvl.plots.length; j++) {
          if (Math.hypot(lvl.plots[i][0] - lvl.plots[j][0], lvl.plots[i][1] - lvl.plots[j][1]) <= REACTION_RADIUS) pairs++
        }
        expect(pairs).toBeGreaterThanOrEqual(4)
        for (const [, , , , h] of lvl.plateaus ?? []) expect(h).toBeLessThanOrEqual(2)
        if ((lvl.plateaus ?? []).length) {
          expect(lvl.plots.some(([c, r]) => (lvl.plateaus ?? []).some(([a, b, x, y]) => c >= a && c <= x && r >= b && r <= y))).toBe(true)
        }
      })

      it('leaves somewhere to cut the road', () => {
        const kindOf = (c: number, r: number) => {
          if (c < 0 || r < 0 || c >= lvl.width || r >= lvl.height) return 'void'
          if (inRects(lvl.voids, c, r)) return paths.roadCells.has(`${c},${r}`) ? 'bridge' : 'void'
          if (paths.roadCells.has(`${c},${r}`)) return 'road'
          return lvl.plots.some(([pc, pr]) => pc === c && pr === r) ? 'plot' : 'grass'
        }
        const isTrap = (c: number, r: number) => (lvl.trapSpots ?? []).some(([tc, tr]) => tc === c && tr === r)
        expect(deriveEarthworkSpots(lvl, kindOf, isTrap).filter(s => s.kind === 'cutting').length).toBeGreaterThan(0)
      })
    })
  }
})
