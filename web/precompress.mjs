// Writes a .br and a .gz copy beside every text file worth compressing, once,
// at image build time. Caddy then hands each browser the smallest copy it can
// read, at full Brotli strength, without compressing anything per request on
// a machine with a shared CPU.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { brotliCompressSync, constants, gzipSync } from 'node:zlib'

const TEXT = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt', '.xml'])
const root = process.argv[2]
if (!root) throw new Error('usage: node precompress.mjs <dir>')

let files = 0, before = 0, after = 0
for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !TEXT.has(extname(entry.name))) continue
  const path = join(entry.parentPath, entry.name)
  const raw = readFileSync(path)
  // below this the headers outweigh the saving
  if (raw.length < 1024) continue
  const br = brotliCompressSync(raw, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: raw.length,
    },
  })
  writeFileSync(`${path}.br`, br)
  writeFileSync(`${path}.gz`, gzipSync(raw, { level: 9 }))
  files++
  before += raw.length
  after += br.length
}
console.log(`precompressed ${files} files: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB brotli`)
