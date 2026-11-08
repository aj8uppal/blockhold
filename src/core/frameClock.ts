/**
 * A steadier frame time for the fixed-step simulation.
 *
 * The battle advances in exact 1/60 s steps, as many as the frame time covers.
 * iOS WebKit hands out frame timestamps rounded to whole milliseconds, so a
 * steady 60 Hz display reports 16, 17, 17, 16, 17, 17 ms. Fed raw into the
 * step counter, that sequence keeps landing on either side of 16.67 ms: some
 * frames run no step and the next runs two, and every moving thing freezes for
 * a frame and then jumps. On a phone that reads as the game not being smooth,
 * however fast it renders.
 *
 * A frame time within 2 ms of a whole number of 60 Hz frames is taken to be
 * exactly that many frames. Anything else - a 120 Hz frame, a real hitch -
 * passes through unchanged, so the game clock never runs fast or slow.
 */
export const SIM_STEP = 1 / 60

export function steadyFrameTime(dt: number, step = SIM_STEP): number {
  const frames = Math.round(dt / step)
  if (frames >= 1 && frames <= 6 && Math.abs(dt - frames * step) < 0.002) return frames * step
  return dt
}
