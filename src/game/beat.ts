import { BAR_SECONDS } from '../core/audio.ts'

/**
 * The Bellfoundry: the battle keeps time.
 *
 * The original idea was to quantise tower fire to a musical grid - arrows on
 * eighths, cannons on downbeats. Built literally, that means a tower that is
 * loaded and has a target in range deliberately does not shoot, which in a
 * tower defense reads as broken rather than musical. It would also fight the
 * impact hold, the 2x speed toggle and every attack-rate bonus in the game.
 *
 * So the beat is a bonus, never a constraint. Towers always fire the instant
 * they are ready; a shot that happens to land on the beat rings out and hits
 * harder. Nothing is ever withheld from the player, and the skill is in
 * arranging a defense whose rhythms fall on the beat more often than not.
 *
 * The grid is the music's own bar, so the battle and the score are counting
 * the same time.
 */

export const BEATS_PER_BAR = 8
export const BEAT_SECONDS = BAR_SECONDS / BEATS_PER_BAR

/** how close to a beat a shot has to land to ring */
export const BEAT_WINDOW = 0.09

/** what an on-beat shot is worth */
export const BEAT_BONUS = 0.4

/** 0..1 position within the current beat */
export function beatPhase(time: number): number {
  const t = (time % BEAT_SECONDS) / BEAT_SECONDS
  return t < 0 ? t + 1 : t
}

/** which beat of the bar we are on, 0..BEATS_PER_BAR-1 */
export function beatIndex(time: number): number {
  return Math.floor(time / BEAT_SECONDS) % BEATS_PER_BAR
}

/** did this moment land on the beat? */
export function onBeat(time: number, window = BEAT_WINDOW): boolean {
  const offset = time % BEAT_SECONDS
  const d = Math.min(offset, BEAT_SECONDS - offset)
  return d <= window
}

/** the downbeat carries more weight than the rest of the bar */
export function isDownbeat(time: number): boolean {
  return onBeat(time) && beatIndex(time) === 0
}
