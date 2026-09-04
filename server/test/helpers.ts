import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { Store } from '../src/db.ts'
import { createApp, resetRateLimiter, type AppConfig } from '../src/app.ts'

/**
 * Stand the real service up on an ephemeral port against a throwaway database.
 *
 * Tests go over HTTP rather than calling the handlers directly, because half
 * of what is being tested here - status codes, auth, body limits - only exists
 * at that boundary.
 */

export interface Harness {
  store: Store
  base: string
  call: (method: string, path: string, opts?: { body?: unknown, token?: string }) => Promise<{ status: number, json: any }>
  close: () => Promise<void>
}

export async function harness(cfg: Partial<AppConfig> = {}): Promise<Harness> {
  // the coarse limiter is module state shared by every test in this file, and
  // a leftover budget from the previous test would show up as a stray 429
  resetRateLimiter()
  const dir = mkdtempSync(join(tmpdir(), 'blockhold-test-'))
  const store = new Store(join(dir, 'test.db'))
  const server: Server = createApp(store, {
    allowedOrigins: ['http://localhost:5173'],
    statsToken: null,
    ...cfg,
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no port')
  const base = `http://127.0.0.1:${addr.port}`

  return {
    store,
    base,
    async call(method, path, opts = {}) {
      const headers: Record<string, string> = {}
      if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
      if (opts.token) headers.Authorization = `Bearer ${opts.token}`
      const res = await fetch(base + path, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      })
      const text = await res.text()
      return { status: res.status, json: text ? JSON.parse(text) : null }
    },
    async close() {
      await new Promise<void>(resolve => server.close(() => resolve()))
      store.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** an account plus its token, which most of the authenticated routes need */
export async function account(h: Harness): Promise<string> {
  const res = await h.call('POST', '/v1/account', { body: {} })
  if (res.status !== 201) throw new Error(`account creation returned ${res.status}`)
  return res.json.token as string
}
