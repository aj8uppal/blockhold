import { describe, expect, it } from 'vitest'
import { MOTIF } from '../src/core/audio.ts'

describe('the Blockhold motif', () => {
  /**
   * A theme needs a landmark that does not move. The old score chose one to
   * three random pentatonic notes per bar with a 40% chance of skipping each,
   * which is unauthored rather than adaptive - nothing to remember.
   */
  it('is a fixed four-note phrase, not a random walk', () => {
    expect(MOTIF).toHaveLength(4)
    expect(MOTIF.every(n => Number.isInteger(n))).toBe(true)
  })

  it('starts on the root so it reads as a statement', () => {
    expect(MOTIF[0]).toBe(0)
  })

  it('actually moves, rather than sitting on one note', () => {
    expect(new Set(MOTIF).size).toBeGreaterThan(2)
  })

  it('stays inside an octave so it transposes cleanly', () => {
    for (const step of MOTIF) {
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThan(12)
    }
  })
})
