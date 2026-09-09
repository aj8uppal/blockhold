import { describe, expect, it } from 'vitest'
import { closedRoadsFor, floodedRoadPoints, openRoadFor } from '../src/game/roads.ts'
import { WaveManager } from '../src/game/waves.ts'
import { levels, levelById, routeWaves } from '../src/game/levels.ts'
import type { WaveDef } from '../src/game/types.ts'
import { buildPaths, gridToWorld } from '../src/game/path.ts'
import { Terrain, SIGHT_CLEARANCE } from '../src/game/terrain.ts'

describe('rerouting authored wave columns', () => {
  const source: WaveDef[] = [{ groups: [
    { enemy: 'brute', count: 12, interval: 0.3, delay: 0, lane: 0, hpMult: 1.4 },
    { enemy: 'acolyte', count: 8, interval: 0.5, delay: 1, lane: 1 },
    { enemy: 'veilregent', count: 1, interval: 1, delay: 4, lane: 0 },
  ] }]

  it('retains every enemy and modifier without mutating the source', () => {
    const original = structuredClone(source)
    const routed = routeWaves(source, [0, 0])
    const payload = (wave: WaveDef) => wave.groups.map(({ enemy, count, hpMult, affix }) => ({ enemy, count, hpMult, affix }))
    expect(routed.map(payload)).toEqual(source.map(payload))
    expect(source).toEqual(original)
    const groups = routed[0].groups
    for (let i = 1; i < groups.length; i++) {
      const previous = groups[i - 1]
      expect(groups[i].delay).toBeGreaterThanOrEqual(previous.delay + (previous.count - 1) * previous.interval + 1.2)
    }
    expect(groups.every(g => g.lane === 0 && g.interval >= 0.4)).toBe(true)
  })

  it('keeps independent entrances concurrent', () => {
    const groups = routeWaves(source, [0, 1])[0].groups
    expect(groups[1].delay).toBe(source[0].groups[1].delay)
    expect(groups[2].delay).toBeGreaterThan(source[0].groups[2].delay)
  })
})

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
    expect(fromLow, 'the cliff must affect some low-angle shots').toBeGreaterThan(0)
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
    // A closed road with nowhere to reroute would swallow a wave outright.
    for (let wave = 0; wave < lvl.waves.length; wave++) {
      const out = closedRoadsFor(wave, lanes)
      expect(out.has(0), `wave ${wave + 1} shuts the gate road`).toBe(false)
      expect(out.size, `wave ${wave + 1} shuts every road`).toBeLessThan(lanes)
    }
  })

  it('has roads worth closing', () => {
    expect(buildPaths(lvl).lanes.length).toBe(3)
  })
})

describe('the three new battlefields', () => {
  const late = ['sunderfall', 'emberwind', 'tidereach']

  it('has three distinct, compact route structures instead of adding clutter', () => {
    expect(late.map(id => levelById(id).lanes.length)).toEqual([1, 2, 3])
    for (const id of late) {
      const l = levelById(id)
      expect(l.width).toBeLessThanOrEqual(32)
      expect(l.height).toBeLessThanOrEqual(18)
      expect(l.landmarks!.length).toBeLessThanOrEqual(3)
      expect(l.plots.length).toBeGreaterThanOrEqual(20)
    }
  })

  it('asks more of the player than the maps before them', () => {
    for (const id of late) {
      const l = levelById(id)
      expect(l.waves.length, `${id} is shorter than Veilscar`).toBeGreaterThanOrEqual(28)
    }
  })
})


describe('tidal route clarity', () => {
  const level = levelById('tidereach')
  const lanes = buildPaths(level).lanes

  it('keeps open shared stretches out of the flood overlay', () => {
    for (const wave of [3, 4, 8, 20]) {
      const closed = closedRoadsFor(wave, lanes.length)
      const points = floodedRoadPoints(lanes, closed)
      expect(points.length).toBeGreaterThan(8)
      for (const point of points) for (const [i, lane] of lanes.entries()) {
        if (closed.has(i)) continue
        expect(lane.distanceToPath(point.x, point.z)).toBeGreaterThanOrEqual(0.8)
      }
    }
  })

  it('announces the same open gates that receive every spawn, even after a resume', () => {
    for (const wave of [3, 4, 8, 13, 19, 28]) {
      const spawned: number[] = []
      const manager = new WaveManager(level, (_id, lane) => spawned.push(lane), () => {})
      manager.resolveLane = (lane, index) => openRoadFor(lane, lanes.length, closedRoadsFor(index, lanes.length))
      const preview = manager.lanesOf(wave)
      manager.resumeAt(wave)
      manager.callNext()
      while (manager.phase === 'spawning') manager.update(0.1)
      expect(new Set(spawned)).toEqual(new Set(preview))
      expect(spawned).toHaveLength(level.waves[wave].groups.reduce((n, g) => n + g.count, 0))
      expect(spawned.every(i => !closedRoadsFor(wave, lanes.length).has(i))).toBe(true)
    }
  })
})
