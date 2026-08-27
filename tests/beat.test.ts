import { describe, expect, it } from 'vitest'
import { onBeat, beatIndex, beatPhase, isDownbeat, BEAT_SECONDS, BEATS_PER_BAR, BEAT_BONUS } from '../src/game/beat.ts'

describe('the Bellfoundry beat', () => {
  it('rings exactly on the beat', () => {
    expect(onBeat(0)).toBe(true)
    expect(onBeat(BEAT_SECONDS)).toBe(true)
    expect(onBeat(BEAT_SECONDS * 5)).toBe(true)
  })

  it('does not ring between beats', () => {
    expect(onBeat(BEAT_SECONDS * 0.5)).toBe(false)
    expect(onBeat(BEAT_SECONDS * 2.5)).toBe(false)
  })

  it('rings just before as well as just after, so a shot is not punished for arriving early', () => {
    expect(onBeat(BEAT_SECONDS - 0.02)).toBe(true)
    expect(onBeat(BEAT_SECONDS + 0.02)).toBe(true)
  })

  it('counts a bar and wraps', () => {
    expect(beatIndex(0)).toBe(0)
    expect(beatIndex(BEAT_SECONDS * 3)).toBe(3)
    expect(beatIndex(BEAT_SECONDS * BEATS_PER_BAR)).toBe(0)
  })

  it('marks the downbeat as its own thing', () => {
    expect(isDownbeat(0)).toBe(true)
    expect(isDownbeat(BEAT_SECONDS * 3)).toBe(false)
  })

  it('runs the phase from 0 to 1 across a beat', () => {
    expect(beatPhase(0)).toBeCloseTo(0, 5)
    expect(beatPhase(BEAT_SECONDS * 0.5)).toBeCloseTo(0.5, 5)
  })

  /**
   * The beat is deliberately a bonus rather than a constraint. Quantising fire
   * would mean a loaded tower with a target in range refusing to shoot, which
   * reads as broken rather than musical - so the only thing the beat can do is
   * add.
   */
  it('is worth something without ever being required', () => {
    expect(BEAT_BONUS).toBeGreaterThan(0)
    expect(BEAT_BONUS).toBeLessThan(1)
  })
})
