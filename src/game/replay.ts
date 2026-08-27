import type { TowerKind } from './types.ts'

/**
 * A run's build history.
 *
 * Nothing about a finished battle was recoverable: the board existed only as
 * live objects, so a run could not be replayed, re-watched, or turned into
 * anything a player could show anyone. This records the decisions - what was
 * built, where, when, and what it became - which is enough to reconstruct how
 * a defense came together without replaying the whole simulation.
 *
 * Paired with the seeded RNG and the ruleset stamp, this is also the
 * foundation a full deterministic replay would build on.
 */

export type ReplayEvent =
  | { t: number, kind: 'build', tower: TowerKind, plot: number }
  | { t: number, kind: 'upgrade', plot: number, level: number, branch: 0 | 1 | null }
  | { t: number, kind: 'sell', plot: number }
  | { t: number, kind: 'trap', spot: number, trap: string }
  | { t: number, kind: 'earthwork', spot: number, work: string }
  | { t: number, kind: 'wave', index: number }

export class ReplayLog {
  private events: ReplayEvent[] = []
  /** a long battle must not grow this without bound */
  private static readonly LIMIT = 2000

  reset(): void { this.events.length = 0 }

  record(e: ReplayEvent): void {
    if (this.events.length >= ReplayLog.LIMIT) return
    this.events.push(e)
  }

  all(): ReplayEvent[] { return this.events }

  get length(): number { return this.events.length }

  /** every tower that was standing at the end, in the order it went up */
  finalBuilds(): { plot: number, tower: TowerKind, t: number }[] {
    const byPlot = new Map<number, { plot: number, tower: TowerKind, t: number }>()
    for (const e of this.events) {
      if (e.kind === 'build') byPlot.set(e.plot, { plot: e.plot, tower: e.tower, t: e.t })
      else if (e.kind === 'sell') byPlot.delete(e.plot)
    }
    return [...byPlot.values()].sort((a, b) => a.t - b.t)
  }

  /** how long the battle ran, by its own clock */
  duration(): number {
    return this.events.length ? this.events[this.events.length - 1].t : 0
  }
}
