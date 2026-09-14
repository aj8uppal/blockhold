import type { LevelDef, Rect } from './types.ts'

/**
 * A board drawn as text.
 *
 * The campaign's boards are rectangles with a few rectangles knocked out of
 * them, and rect lists describe that well. A round island, a ring around a
 * chasm or five islands strung together by bridges would be hundreds of
 * one-cell rects nobody could read or edit. So the Frontier maps are drawn:
 * one character per cell, top row first, and this turns the drawing into the
 * same plain `LevelDef` fields everything else already understands.
 *
 *   #  open sky (no ground)          .  ground
 *   ~  water                         w  water with a boat mooring
 *   ^  hill                          o  foundation on the ground
 *   =  road on the ground            x  road with a trap spot
 *   %  road over open sky: a bridge
 *   a-h  raised ground (height from `heights`)
 *   A-H  a foundation standing on that raised ground
 *
 * Roads are drawn for the reader; the lanes' waypoints still decide where
 * enemies walk, and a test holds the two to each other.
 */
export interface GridTerrain {
  width: number
  height: number
  plots: [number, number][]
  trapSpots: [number, number][]
  water: Rect[]
  waterPlots: [number, number][]
  hills: Rect[]
  plateaus: [number, number, number, number, number][]
  voids: Rect[]
  /** every cell drawn as road, bridge or trap: "c,r" */
  drawnRoads: Set<string>
  /** the cells drawn as bridges */
  drawnBridges: Set<string>
}

export const RAISED = 'abcdefgh'

export function parseGrid(rows: readonly string[], heights: Readonly<Record<string, number>> = {}): GridTerrain {
  const height = rows.length
  const width = Math.max(...rows.map(r => r.length))
  const out: GridTerrain = {
    width, height, plots: [], trapSpots: [], water: [], waterPlots: [], hills: [], plateaus: [], voids: [],
    drawnRoads: new Set(), drawnBridges: new Set(),
  }
  const at = (c: number, r: number) => rows[r][c] ?? '#'
  // merge each row's runs of a class into one rect; boards stay small this way
  const runs = (test: (ch: string) => boolean, into: Rect[]) => {
    for (let r = 0; r < height; r++) {
      let c = 0
      while (c < width) {
        if (!test(at(c, r))) { c++; continue }
        const start = c
        while (c < width && test(at(c, r))) c++
        into.push([start, r, c - 1, r])
      }
    }
  }
  runs(ch => ch === '#' || ch === '%', out.voids)
  runs(ch => ch === '~' || ch === 'w', out.water)
  runs(ch => ch === '^', out.hills)
  for (const letter of RAISED) {
    const h = heights[letter]
    const cells: Rect[] = []
    runs(ch => ch === letter || ch === letter.toUpperCase(), cells)
    if (cells.length && h === undefined) throw new Error(`grid uses raised ground '${letter}' with no height`)
    for (const [c0, r0, c1, r1] of cells) out.plateaus.push([c0, r0, c1, r1, h])
  }
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const ch = at(c, r)
      if (ch === 'o' || (ch >= 'A' && ch <= 'H')) out.plots.push([c, r])
      else if (ch === 'w') out.waterPlots.push([c, r])
      else if (ch === 'x') out.trapSpots.push([c, r])
      if (ch === '=' || ch === 'x' || ch === '%') out.drawnRoads.add(`${c},${r}`)
      if (ch === '%') out.drawnBridges.add(`${c},${r}`)
    }
  }
  return out
}

/** the drawn board's fields, ready to spread into a LevelDef */
export function gridLevel(rows: readonly string[], heights: Readonly<Record<string, number>> = {}): Pick<LevelDef,
  'width' | 'height' | 'plots' | 'trapSpots' | 'water' | 'waterPlots' | 'hills' | 'plateaus' | 'voids'> {
  const { width, height, plots, trapSpots, water, waterPlots, hills, plateaus, voids } = parseGrid(rows, heights)
  return { width, height, plots, trapSpots, water, waterPlots, hills, plateaus, voids }
}
