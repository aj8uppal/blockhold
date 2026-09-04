import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

/** the repo root, whatever directory playwright was invoked from */
const root = fileURLToPath(new URL('../..', import.meta.url))

/**
 * The smoke suite runs the *production build* in a real browser.
 *
 * It is deliberately not part of `vitest run`: the unit suite is 161 fast
 * pure-TypeScript tests and has to stay that way, so these files are named
 * `*.smoke.ts` (which vitest's `**\/*.{test,spec}.ts` pattern does not match)
 * and are collected only by this config.
 *
 * WebGL: there is no GPU on a CI runner, and Chromium refuses a WebGL context
 * without one unless it is told to rasterise in software. ANGLE over SwiftShader
 * is that software path; without these flags the game never gets a renderer and
 * every test here fails at the first frame.
 */
export default defineConfig({
  testDir: '.',
  // vitest must not pick these up, and this config must not pick up the unit
  // tests next door: both are settled by the filename
  testMatch: '**/*.smoke.ts',
  outputDir: 'output',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  // a battle test waits out a ~14s wave countdown; everything else is seconds
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        // newer Chromium treats the software path as unsafe and blocks it by
        // default; the alternative is no WebGL at all
        '--enable-unsafe-swiftshader',
        '--disable-lcd-text',
      ],
    },
  },
  webServer: {
    // the built bundle on a fixed port, not the dev server: this suite exists
    // to test what actually ships
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    // playwright resolves this against the config's directory, not the repo
    cwd: root,
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
