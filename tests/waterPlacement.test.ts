import { describe, expect, it } from 'vitest'
import { Terrain } from '../src/game/terrain.ts'
import { buildPaths } from '../src/game/path.ts'
import { levels } from '../src/game/levels.ts'
import { HUNTS, huntLevel } from '../src/game/hunts.ts'
import { tidecallerTree } from '../src/game/tidecaller.ts'
import type { LevelDef } from '../src/game/types.ts'
import { writeFileSync } from 'node:fs'

/** Road length a base Tidecaller can actually see, including cliff occlusion. */
function coverage(level: LevelDef) {
  const terrain = new Terrain(level, buildPaths(level))
  const sites: { cell: [number, number], lanes: number[] }[] = []
  const range = tidecallerTree.levels[0].range, step = .25
  for (let r = 0; r < level.height; r++) for (let c = 0; c < level.width; c++) {
    const plot = terrain.waterPlot(c, r)
    if (!plot) continue
    const lanes = terrain.paths.lanes.map(lane => {
      let visible = 0
      for (let d = 0; d < lane.length; d += step) {
        const point = lane.sample(d)
        if (Math.hypot(point.x - plot.pos.x, point.z - plot.pos.z) <= range
          && !terrain.sightBlocked(plot.pos.x, plot.pos.z, terrain.cellTop(c, r), point.x, point.z)) visible += step
      }
      return visible
    })
    sites.push({ cell: [c, r], lanes })
  }
  terrain.dispose()
  return { sites: sites.length, useful: sites.filter(p => Math.max(...p.lanes) >= 4).length,
    best: Math.max(0, ...sites.map(p => Math.max(...p.lanes))),
    perLane: level.lanes.map((_, i) => Math.max(0, ...sites.map(p => p.lanes[i]))) }
}

describe('tactical shorelines', () => {
  it('gives water maps useful firing positions before upgrades, while lava maps have none', () => {
    const report: Record<string, unknown> = {}
    for (const level of levels) {
      const current = coverage(level)
      const lava = level.theme === 'ember' || level.theme === 'ashfall'
      if (lava) { expect(current.sites, level.id).toBe(0); continue }
      expect(current.useful, level.id).toBeGreaterThanOrEqual(2)
      expect(current.sites, level.id).toBe(level.waterPlots!.length)
      expect(current.sites, level.id).toBeLessThanOrEqual(4)
      expect(current.best, level.id).toBeGreaterThanOrEqual(5)
      for (const length of current.perLane) expect(length, level.id).toBeGreaterThanOrEqual(4)
      const before = coverage({ ...level, water: level.waterBefore14 ?? level.water, waterPlots: undefined })
      report[level.id] = { before, current }
    }
    if (process.env.REPORT_WATER) writeFileSync(process.env.REPORT_WATER, JSON.stringify(report, null, 2))
  })

  it('keeps every incoming lane on both mastery hunts reachable by a useful water site', () => {
    for (const hunt of HUNTS) {
      const result = coverage(huntLevel(hunt.id))
      for (const length of result.perLane) expect(length, hunt.id).toBeGreaterThanOrEqual(4)
    }
  })
})
