#!/usr/bin/env node
/**
 * The download budget, enforced.
 *
 * This is a browser game whose whole distribution model is a link: the first
 * visit is the product demo, and on a phone over mobile data the bundle size
 * *is* the bounce rate. Bundle size is also the one quality that degrades
 * silently - nobody notices an import that pulled in another 40 KB until the
 * numbers are read side by side, which is exactly what nobody does by hand.
 *
 * Two budgets, because they fail for different reasons:
 *   - the app chunk, which is ours and which every deploy re-downloads;
 *   - total JS, which is what the player actually waits for on a cold visit.
 *
 * `three` is measured and printed but is not held to the app budget: it is a
 * pinned dependency, it is cached across deploys, and trimming it is not a
 * thing this repo can do from one commit to the next.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const assets = join(root, 'dist', 'assets')

/** gzip, not brotli: it is the floor every host and browser agrees on */
const APP_CHUNK_LIMIT = 130 * 1024
const TOTAL_JS_LIMIT = 250 * 1024

const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`

if (!existsSync(assets)) {
  console.error(`No build to measure: ${assets} does not exist. Run \`vite build\` first.`)
  process.exit(1)
}

const chunks = readdirSync(assets)
  .filter(f => f.endsWith('.js'))
  .map(file => {
    const raw = readFileSync(join(assets, file))
    return {
      file,
      raw: raw.length,
      gzip: gzipSync(raw, { level: 9 }).length,
      // the vendor split configured in vite.config.ts
      vendor: file.startsWith('three-'),
    }
  })
  .sort((a, b) => b.gzip - a.gzip)

if (!chunks.length) {
  console.error(`No JavaScript found in ${assets}. Did the build succeed?`)
  process.exit(1)
}

// "the app chunk" is the biggest thing that is not the pinned vendor bundle;
// the lazily-loaded pieces beside it are counted in the total, not here
const app = chunks.find(c => !c.vendor)
const totalGzip = chunks.reduce((sum, c) => sum + c.gzip, 0)

const rows = chunks.map(c => ({
  chunk: c.file,
  kind: c.vendor ? 'vendor' : c === app ? 'app' : 'lazy',
  raw: kb(c.raw),
  gzip: kb(c.gzip),
  budget: c === app ? kb(APP_CHUNK_LIMIT) : '-',
}))

console.log('\nBundle budget (gzip)\n')
const widths = ['chunk', 'kind', 'raw', 'gzip', 'budget']
  .map(k => Math.max(k.length, ...rows.map(r => String(r[k]).length)))
const line = cells => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')
console.log(line(['chunk', 'kind', 'raw', 'gzip', 'budget']))
console.log(widths.map(w => '-'.repeat(w)).join('  '))
for (const r of rows) console.log(line([r.chunk, r.kind, r.raw, r.gzip, r.budget]))
console.log(widths.map(w => '-'.repeat(w)).join('  '))
console.log(line(['total JS', '', '', kb(totalGzip), kb(TOTAL_JS_LIMIT)]))
console.log()

const failures = []
if (app && app.gzip > APP_CHUNK_LIMIT) {
  failures.push(
    `The app chunk (${app.file}) is ${kb(app.gzip)} gzipped, over its ${kb(APP_CHUNK_LIMIT)} budget `
    + `by ${kb(app.gzip - APP_CHUNK_LIMIT)}.\n`
    + '  This is code we wrote, and every returning player downloads it again. Find what grew\n'
    + '  (`npx vite build` prints per-chunk sizes), split it behind a dynamic import, or raise\n'
    + '  APP_CHUNK_LIMIT in scripts/bundle-budget.mjs on purpose and say why.',
  )
}
if (totalGzip > TOTAL_JS_LIMIT) {
  failures.push(
    `Total JavaScript is ${kb(totalGzip)} gzipped, over the ${kb(TOTAL_JS_LIMIT)} budget `
    + `by ${kb(totalGzip - TOTAL_JS_LIMIT)}.\n`
    + '  That is what a first-time visitor waits for before anything is playable.',
  )
}

if (failures.length) {
  console.error(`Bundle budget exceeded:\n\n${failures.map(f => `- ${f}`).join('\n\n')}\n`)
  process.exit(1)
}

console.log(
  `Within budget: app ${kb(app.gzip)} / ${kb(APP_CHUNK_LIMIT)}, `
  + `total ${kb(totalGzip)} / ${kb(TOTAL_JS_LIMIT)}.\n`,
)
