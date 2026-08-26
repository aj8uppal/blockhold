/**
 * Funnel and run telemetry.
 *
 * The game shipped with no instrumentation of any kind, so there was no way
 * to learn which wave players actually quit on, which towers nobody ever
 * builds, or whether a redesign helped. Every judgement about the game was
 * therefore opinion, including the ones in reviews/breakout-review.md.
 *
 * This deliberately has no third-party sink wired in. Events are buffered
 * locally and handed to whatever `sink` the owner installs, so choosing an
 * analytics vendor (and its consent story) stays a decision for the
 * developer rather than something a refactor smuggled in.
 */

export type TelemetryEvent =
  | { type: 'session_start', firstRun: boolean, source: string, embedded: boolean }
  | { type: 'battle_start', level: string, difficulty: string, hero: string, mode: string, seed: number, resumed: boolean }
  | { type: 'wave_cleared', level: string, wave: number, lives: number, leaked: boolean }
  | { type: 'battle_end', level: string, difficulty: string, won: boolean, wave: number, totalWaves: number, lives: number, score: number, seconds: number }
  | { type: 'quit_to_menu', level: string, wave: number }
  | { type: 'tower_built', kind: string, level: string, wave: number }
  | { type: 'first_build_delay', seconds: number }
  | { type: 'daily_completed', day: number, wave: number, won: boolean }
  | { type: 'share_copied', kind: string }
  | { type: 'save_write_failed' }
  | { type: 'error', message: string }
  | { type: 'slow_frames', worstMs: number, tier: number }

export interface TelemetryRecord {
  at: number
  event: TelemetryEvent
}

type Sink = (batch: TelemetryRecord[]) => void

const BUFFER_LIMIT = 500

class Telemetry {
  private buffer: TelemetryRecord[] = []
  private sink: Sink | null = null
  private enabled = true

  /** install a destination; nothing leaves the device until one is set */
  setSink(sink: Sink | null): void {
    this.sink = sink
    if (sink && this.buffer.length) this.flush()
  }

  /** the player's call, for a consent control later */
  setEnabled(on: boolean): void {
    this.enabled = on
    if (!on) this.buffer.length = 0
  }

  get isEnabled(): boolean { return this.enabled }

  track(event: TelemetryEvent): void {
    if (!this.enabled) return
    this.buffer.push({ at: Date.now(), event })
    // never grow without bound on a long session with no sink installed
    if (this.buffer.length > BUFFER_LIMIT) this.buffer.splice(0, this.buffer.length - BUFFER_LIMIT)
    if (this.sink && this.buffer.length >= 25) this.flush()
  }

  flush(): void {
    if (!this.sink || !this.buffer.length) return
    const batch = this.buffer.slice()
    this.buffer.length = 0
    try { this.sink(batch) } catch { /* a broken sink must never break a battle */ }
  }

  /** for local inspection during development */
  peek(): TelemetryRecord[] { return this.buffer.slice() }
}

export const telemetry = new Telemetry()
