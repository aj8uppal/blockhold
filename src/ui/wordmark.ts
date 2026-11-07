/**
 * The Blockhold wordmark, built the way the game is: out of blocks.
 *
 * Every letter is a 6×7 grid of cubes drawn in oblique projection — a front
 * face, and a side and floor only where a neighbour does not hide them — so
 * the logo is a small voxel model rather than a typeface. It is generated
 * once as SVG, which keeps it crisp from a 16px favicon to a full-width title.
 */

const GLYPHS: Record<string, string[]> = {
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '######'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  C: ['.#####', '##....', '##....', '##....', '##....', '##....', '.#####'],
  K: ['##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##'],
  H: ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  D: ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
}

interface Palette { face: string, side: string, floor: string }

const BONE: Palette = { face: '#f3ecdd', side: '#b8a582', floor: '#8a7754' }
const GOLD: Palette = { face: '#f2b134', side: '#c27f12', floor: '#8c560a' }
const INK: Palette = { face: '#1b1712', side: '#0d0b08', floor: '#000000' }

/** depth of each cube, in cells, toward the lower right */
const DEPTH = 0.42

function build(words: [string, Palette][], gap = 1, wordGap = 1): { svg: string, w: number, h: number } {
  const cells: { x: number, y: number, p: Palette }[] = []
  let cursor = 0
  words.forEach(([word, palette], wi) => {
    if (wi > 0) cursor += wordGap
    ;[...word].forEach((ch, i) => {
      const glyph = GLYPHS[ch]
      if (i > 0) cursor += gap
      glyph.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') cells.push({ x: cursor + x, y, p: palette }) }))
      cursor += glyph[0].length
    })
  })
  const filled = new Set(cells.map(c => `${c.x},${c.y}`))
  const has = (x: number, y: number) => filled.has(`${x},${y}`)
  const d = DEPTH
  const sides = new Map<Palette, string>(), floors = new Map<Palette, string>(), faces = new Map<Palette, string>()
  const add = (m: Map<Palette, string>, p: Palette, s: string) => m.set(p, (m.get(p) ?? '') + s)
  const n = (v: number) => +v.toFixed(3)
  for (const { x, y, p } of cells) {
    // the side shows where nothing stands to the right; the floor where nothing stands below
    if (!has(x + 1, y)) add(sides, p, `M${x + 1} ${y}L${n(x + 1 + d)} ${n(y + d)}L${n(x + 1 + d)} ${n(y + 1 + d)}L${x + 1} ${y + 1}Z`)
    if (!has(x, y + 1)) add(floors, p, `M${x} ${y + 1}L${x + 1} ${y + 1}L${n(x + 1 + d)} ${n(y + 1 + d)}L${n(x + d)} ${n(y + 1 + d)}Z`)
    add(faces, p, `M${x} ${y}h1v1h-1z`)
  }
  // a quiet grain on the faces, so the letters read as stacked blocks
  let grain = ''
  for (const { x, y } of cells) if ((x * 7 + y * 13) % 5 === 0) grain += `M${x} ${y}h1v1h-1z`
  let body = ''
  for (const [p, path] of floors) body += `<path fill="${p.floor}" d="${path}"/>`
  for (const [p, path] of sides) body += `<path fill="${p.side}" d="${path}"/>`
  for (const [p, path] of faces) body += `<path fill="${p.face}" d="${path}"/>`
  body += `<path fill="rgba(0,0,0,.06)" d="${grain}"/>`
  const w = cursor + d, h = 7 + d
  return { svg: body, w, h }
}

/** BLOCK in bone, HOLD in gold: the full mark */
export function wordmark(cls = 'wordmark', tone: 'light' | 'ink' = 'light'): string {
  const { svg, w, h } = build([['BLOCK', tone === 'ink' ? INK : BONE], ['HOLD', GOLD]], 1, 1)
  return `<svg class="${cls}" viewBox="-0.1 -0.1 ${n2(w + 0.2)} ${n2(h + 0.2)}" role="img" aria-label="Blockhold" shape-rendering="geometricPrecision">${svg}</svg>`
}

/** a single gold B on its own: the app glyph */
export function monogram(cls = 'monogram'): string {
  const { svg, w, h } = build([['B', GOLD]])
  return `<svg class="${cls}" viewBox="-0.1 -0.1 ${n2(w + 0.2)} ${n2(h + 0.2)}" aria-hidden="true">${svg}</svg>`
}

const n2 = (v: number) => +v.toFixed(2)
