import { describe, expect, it } from 'vitest'
import { ReplayLog } from '../src/game/replay.ts'
import { tapeFileExtension } from '../src/core/capture.ts'

describe('the build history', () => {
  it('remembers what was built, in the order it went up', () => {
    const log = new ReplayLog()
    log.record({ t: 4, kind: 'build', tower: 'arrow', plot: 2 })
    log.record({ t: 9, kind: 'build', tower: 'cannon', plot: 5 })
    log.record({ t: 12, kind: 'build', tower: 'mage', plot: 1 })
    expect(log.finalBuilds().map(b => b.tower)).toEqual(['arrow', 'cannon', 'mage'])
  })

  /** a tape of the final defense must not show towers that were torn down */
  it('forgets towers that were sold', () => {
    const log = new ReplayLog()
    log.record({ t: 1, kind: 'build', tower: 'arrow', plot: 2 })
    log.record({ t: 2, kind: 'build', tower: 'mage', plot: 3 })
    log.record({ t: 6, kind: 'sell', plot: 2 })
    expect(log.finalBuilds().map(b => b.plot)).toEqual([3])
  })

  it('keeps the latest tower on a plot that was rebuilt', () => {
    const log = new ReplayLog()
    log.record({ t: 1, kind: 'build', tower: 'arrow', plot: 4 })
    log.record({ t: 5, kind: 'sell', plot: 4 })
    log.record({ t: 6, kind: 'build', tower: 'barracks', plot: 4 })
    const builds = log.finalBuilds()
    expect(builds).toHaveLength(1)
    expect(builds[0].tower).toBe('barracks')
  })

  it('does not grow without bound over a long battle', () => {
    const log = new ReplayLog()
    for (let i = 0; i < 5000; i++) log.record({ t: i, kind: 'wave', index: i })
    expect(log.length).toBeLessThanOrEqual(2000)
  })

  it('clears between battles', () => {
    const log = new ReplayLog()
    log.record({ t: 1, kind: 'build', tower: 'arrow', plot: 0 })
    log.reset()
    expect(log.length).toBe(0)
    expect(log.finalBuilds()).toEqual([])
  })
})

describe('siege tapes', () => {
  it('names the file for the container the browser actually gave us', () => {
    expect(tapeFileExtension('video/webm;codecs=vp9')).toBe('webm')
    expect(tapeFileExtension('video/mp4')).toBe('mp4')
  })
})
