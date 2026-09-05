import { describe, it, expect } from 'vitest'
import { onHoldLine, HOLD_LINE_HALF_WIDTH } from '../src/game/towers.ts'

/**
 * The corridor rule, on its own. What the tower fires on and what the player
 * is shown are both this function, so these are the numbers that matter.
 */
describe('a held firing line', () => {
  const from = { x: 0, z: 0 }
  const east = { x: 1, z: 0 }
  const reach = 4

  it('takes what stands on the line, out to reach', () => {
    expect(onHoldLine(from, east, reach, { x: 1, z: 0 }, 0.2)).toBe(true)
    expect(onHoldLine(from, east, reach, { x: 4, z: 0 }, 0.2)).toBe(true)
  })

  it('ignores what stands past the end of it', () => {
    expect(onHoldLine(from, east, reach, { x: 4.5, z: 0 }, 0.2)).toBe(false)
    expect(onHoldLine(from, east, reach, { x: 4.15, z: 0 }, 0.2)).toBe(true)
  })

  it('ignores what stands behind the engine', () => {
    expect(onHoldLine(from, east, reach, { x: -1, z: 0 }, 0.2)).toBe(false)
  })

  it('takes a body whose edge clips the corridor, and nothing wider', () => {
    const r = 0.3
    expect(onHoldLine(from, east, reach, { x: 2, z: HOLD_LINE_HALF_WIDTH + r - 0.01 }, r)).toBe(true)
    expect(onHoldLine(from, east, reach, { x: 2, z: HOLD_LINE_HALF_WIDTH + r + 0.01 }, r)).toBe(false)
  })

  it('works on any bearing, not just the axes', () => {
    const ne = { x: Math.SQRT1_2, z: Math.SQRT1_2 }
    expect(onHoldLine(from, ne, reach, { x: 2, z: 2 }, 0.2)).toBe(true)
    expect(onHoldLine(from, ne, reach, { x: 2, z: -2 }, 0.2)).toBe(false)
  })
})
