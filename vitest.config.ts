import { defineConfig } from 'vitest/config'

/**
 * Vitest owns exactly one thing: the game's unit tests in `tests/`.
 *
 * Two other suites live in this repo and neither is vitest's to run - the sync
 * service's tests use node:test (`npm test` inside `server/`), and the smoke
 * suite drives a real browser through Playwright. Left to its default glob,
 * vitest collects both and fails on files it cannot interpret, so the include
 * is narrowed to the unit tests and the other two are excluded by name as
 * well: the intent should survive someone renaming a file.
 */
export default defineConfig({
  test: {
    include: ['tests/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'server/**', 'tests/smoke/**'],
  },
})
