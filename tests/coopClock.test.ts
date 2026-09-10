import { describe, expect, it } from 'vitest'
import { CoopClock } from '../src/core/coopClock.ts'

describe('co-op render pacing', () => {
  it('buffers startup and runs smoothly at either negotiated cadence and speed', () => {
    for (const ticksPerTurn of [6, 12]) {
    for (const speed of [1, 2]) {
      const clock = new CoopClock()
      let available = 0
      const frames: number[] = []
      for (let frame = 1; frame <= 180; frame++) {
        if (frame % ticksPerTurn === 0) available += ticksPerTurn * speed
        const ticks = clock.take(1 / 60, speed, available, ticksPerTurn)
        available -= ticks
        if (frame >= 24) frames.push(ticks)
      }
      expect(frames.every(t => t === speed)).toBe(true)
      expect(available).toBeGreaterThan(0)
    }
    }
  })

  it('eases into catch-up without a sudden double-speed burst', () => {
    const clock = new CoopClock()
    let simulated = 0
    for (let frame = 0; frame < 60; frame++) {
      const ticks = clock.take(1 / 60, 2, 240, 6)
      if (frame === 0) expect(ticks).toBe(2)
      expect(ticks).toBeLessThanOrEqual(3)
      simulated += ticks
    }
    expect(simulated).toBeGreaterThan(120)
    expect(simulated).toBeLessThan(180)
  })

  it('recovers ordered delivery jitter and a half-second outage at both speeds', () => {
    for (const speed of [1, 2]) {
      const clock = new CoopClock()
      let available = 0, delivered = 0, consumed = 0, next = 0
      let previousArrival = 0
      const arrivals = Array.from({ length: 300 }, (_, i) => {
        const jitter = [0, 40, 100, 20, 75, 150, 10][i % 7]
        // SSE preserves order, even when several messages arrive together.
        return previousArrival = Math.max(previousArrival, (i + 1) * 100 + jitter + (i >= 80 && i < 85 ? 500 : 0))
      })
      for (let frame = 1; frame <= 2100; frame++) {
        while (next < arrivals.length && arrivals[next] <= frame * 1000 / 60) {
          available += 6 * speed; delivered += 6 * speed; next++
        }
        const ticks = clock.take(1 / 60, speed, available, 6, next === arrivals.length)
        expect(ticks).toBeLessThanOrEqual(available)
        expect(ticks).toBeLessThanOrEqual(Math.ceil(speed * 1.5))
        available -= ticks; consumed += ticks
      }
      expect(consumed).toBe(delivered)
      expect(available).toBe(0)
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

  it('drains a paused room below the startup reserve without inventing simulation ticks', () => {
    for (const speed of [1, 2]) {
      const clock = new CoopClock()
      let available = 7
      expect(clock.take(1 / 60, speed, available, 12)).toBe(0)
      let total = 0
      for (let frame = 0; frame < 20; frame++) {
        const consumed = clock.take(1 / 60, speed, available, 12, true)
        available -= consumed
        total += consumed
      }
      expect(total).toBe(7)
      expect(available).toBe(0)
      // Resuming an empty connection requires its normal delivery reserve again.
      expect(clock.take(1 / 60, speed, 12, 12)).toBe(0)
    }
  })
})
