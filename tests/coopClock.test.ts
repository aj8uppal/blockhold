import { describe, expect, it } from 'vitest'
import { CoopClock } from '../src/core/coopClock.ts'

describe('co-op render pacing', () => {
  it('buffers startup and runs smoothly between 200ms markers at either speed', () => {
    for (const speed of [1, 2]) {
      const clock = new CoopClock()
      let available = 0
      const frames: number[] = []
      for (let frame = 1; frame <= 180; frame++) {
        if (frame % 12 === 0) available += 12 * speed
        const ticks = clock.take(1 / 60, speed, available, 12)
        available -= ticks
        if (frame >= 24) frames.push(ticks)
      }
      expect(frames.every(t => t === speed)).toBe(true)
      expect(available).toBeGreaterThan(0)
    }
  })

  it('does not turn a network stall into a burst of accumulated work', () => {
    const clock = new CoopClock()
    for (let i = 0; i < 120; i++) expect(clock.take(1 / 60, 1, 0, 12)).toBe(0)
    expect(clock.take(1 / 60, 1, 12, 12)).toBe(0)
    expect(clock.take(1 / 60, 1, 24, 12)).toBe(1)
    expect(clock.take(1 / 60, 1, 0, 12)).toBe(0)
    expect(clock.take(1 / 60, 1, 24, 12)).toBe(1)
  })

  it('bounds catch-up work and never runs past the server', () => {
    const clock = new CoopClock()
    expect(clock.take(2, 2, 240, 12)).toBe(12)
    expect(clock.take(1 / 60, 2, 1, 12)).toBe(1)
    expect(clock.take(1 / 60, 2, 0, 12)).toBe(0)
  })

  it('keeps fractional ticks at high refresh rates', () => {
    const clock = new CoopClock()
    let total = 0
    for (let i = 0; i < 144; i++) total += clock.take(1 / 144, 1, 24, 12)
    expect(total).toBeCloseTo(60, 0)
  })
})
