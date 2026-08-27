import { describe, expect, it } from 'vitest'
import { levels, levelById } from '../src/game/levels.ts'
import { buildPaths, gridToWorld } from '../src/game/path.ts'
import { Terrain, SIGHT_CLEARANCE } from '../src/game/terrain.ts'

/**
 * The three battlefields past Veilscar each carry a mechanic the earlier maps
 * do not. These guard the parts that are easy to break from a distance: the
 * terrain a sightline depends on, and the roads a tide is allowed to close.
 */
describe('Sunderfall: shooting over terrain', () => {
  const lvl = levelById('sunderfall')
  const terrain = () => new Terrain(lvl, buildPaths(lvl))

  it('leaves the older maps untouched', () => {
    // their plateaus sit below the clearance a tower shoots over, so the rule
    // exists everywhere and only bites where a board was built for it
    for (const l of levels.filter(x => !['sunderfall', 'emberwind', 'tidereach'].includes(x.id))) {
      for (const [, , , , h] of l.plateaus ?? []) {
        expect(h, `${l.id} would start blocking shots at ${h}`).toBeLessThanOrEqual(SIGHT_CLEARANCE)
      }
    }
  })

  it('blocks low ground and never high ground', () => {
    const t = terrain()
    let fromLow = 0, fromHigh = 0
    for (const [pc, pr] of lvl.plots) {
      const [px, pz] = gridToWorld(pc, pr, lvl.width, lvl.height)
      const footing = t.cellTop(pc, pr)
      for (const lane of buildPaths(lvl).lanes) {
        for (let d = 0; d < lane.length; d += 1.5) {
          const s = lane.sample(d)
          if (Math.hypot(s.x - px, s.z - pz) > 6.5) continue
          if (!t.sightBlocked(px, pz, footing, s.x, s.z)) continue
          if (footing > SIGHT_CLEARANCE) fromHigh++; else fromLow++
        }
      }
    }
    expect(fromLow, 'the ridges block nothing, so height buys nothing').toBeGreaterThan(20)
    // a tower on the mesa looks over it; only the shelves either side can be blocked
    expect(fromHigh).toBeLessThan(fromLow / 4)
  })

  it('offers both a high and a low answer', () => {
    const t = terrain()
    const high = lvl.plots.filter(([c, r]) => t.cellTop(c, r) > SIGHT_CLEARANCE).length
    expect(high, 'no elevated foundations').toBeGreaterThanOrEqual(6)
    expect(lvl.plots.length - high, 'no low foundations either').toBeGreaterThanOrEqual(6)
  })
})

describe('Tidereach: roads that close', () => {
  const lvl = levelById('tidereach')

  it('never shuts every road, nor the one the gate sits on', () => {
    const lanes = buildPaths(lvl).lanes.length
    // mirrors ShiftingRoads.planFor; a closed road with nowhere to reroute
    // would swallow a wave outright
    for (let wave = 0; wave < lvl.waves.length; wave++) {
      const out = new Set<number>()
      if (lanes >= 3 && wave >= 3) {
        const shut = wave >= 14 && lanes >= 5 ? 2 : 1
        const rotating = lanes - 1
        for (let k = 0; k < Math.min(shut, rotating - 1); k++) {
          out.add(1 + (Math.floor(wave / 4) + k * 2) % rotating)
        }
      }
      expect(out.has(0), `wave ${wave + 1} shuts the gate road`).toBe(false)
      expect(out.size, `wave ${wave + 1} shuts every road`).toBeLessThan(lanes)
    }
  })

  it('has roads worth closing', () => {
    expect(buildPaths(lvl).lanes.length).toBeGreaterThanOrEqual(4)
  })
})

describe('the three new battlefields', () => {
  const late = ['sunderfall', 'emberwind', 'tidereach']

  it('each grows on the last', () => {
    const areas = levels.map(l => l.width * l.height)
    for (let i = levels.length - 3; i < levels.length; i++) {
      expect(areas[i], `${levels[i].id} is not bigger than ${levels[i - 1].id}`).toBeGreaterThan(areas[i - 1])
    }
  })

  it('asks more of the player than the maps before them', () => {
    for (const id of late) {
      const l = levelById(id)
      expect(l.waves.length, `${id} is shorter than Veilscar`).toBeGreaterThanOrEqual(28)
    }
  })
})
