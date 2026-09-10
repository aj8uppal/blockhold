import type { PlotInfo, Terrain } from './terrain.ts'

/** A completed endless wave counts once, whether held perfectly or recovered. */
export const EXPANSION_EVERY = 15

/** Campaign approach waves never contribute; callers count only endless clears. */
export function earnedExpansionPlots(completedEndlessWaves: number): number {
  if (!Number.isSafeInteger(completedEndlessWaves) || completedEndlessWaves < 0) return 0
  return Math.floor(completedEndlessWaves / EXPANSION_EVERY)
}

/** Spending is derived from the real appended plots, not a second mutable balance. */
export function availableExpansionPlots(completedEndlessWaves: number, terrain: Pick<Terrain, 'plots'>): number {
  const spent = terrain.plots.filter(plot => plot.expanded).length
  return Math.max(0, earnedExpansionPlots(completedEndlessWaves) - spent)
}

/** An invalid placement cannot consume a credit; a repeated cell cannot spend twice. */
export function placeExpansionPlot(terrain: Terrain, completedEndlessWaves: number, c: number, r: number): PlotInfo | null {
  if (availableExpansionPlots(completedEndlessWaves, terrain) <= 0) return null
  return terrain.addExpansionPlot(c, r)
}
