import { describe, it, expect } from 'vitest'
import { steadyFrameTime, SIM_STEP } from '../src/core/frameClock.ts'

/** steps the battle runs on each frame, fed the way the game loop feeds them */
function stepsPerFrame(frameMs: number[], smooth: boolean, start = 0): number[] {
  let acc = start
  return frameMs.map(ms => {
    acc += smooth ? steadyFrameTime(ms / 1000) : ms / 1000
    let n = 0
    while (acc >= SIM_STEP - 1e-9) { acc -= SIM_STEP; n++ }
    return n
  })
}

describe('the frame clock', () => {
  // a 60 Hz display as iOS reports it: timestamps rounded to whole milliseconds
  const ios = Array.from({ length: 120 }, (_, i) => Math.round((i + 1) * 1000 / 60) - Math.round(i * 1000 / 60))

  it('runs exactly one step per frame at 60 Hz, whatever the rounding', () => {
    for (const start of [0, SIM_STEP * 0.001, SIM_STEP * 0.5, SIM_STEP * 0.999]) {
      expect(new Set(stepsPerFrame(ios, true, start))).toEqual(new Set([1]))
    }
  })

  it('stuttered before: raw rounded times skip and double steps', () => {
    const raw = stepsPerFrame(ios, false, SIM_STEP * 0.999)
    expect(raw).toContain(0)
    expect(raw).toContain(2)
  })

  it('keeps 30 Hz frames at two steps and leaves odd frame times alone', () => {
    expect(steadyFrameTime(0.033)).toBeCloseTo(2 * SIM_STEP, 12)
    expect(steadyFrameTime(1 / 120)).toBe(1 / 120)
    expect(steadyFrameTime(0.025)).toBe(0.025)
    expect(steadyFrameTime(0.1)).toBe(0.1)
  })
})
