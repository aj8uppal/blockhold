import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { loadSave } from '../src/core/save.ts'

let local: Map<string, string>
let session: Map<string, string>
const storage = (map: Map<string, string>) => ({
  getItem: (key: string) => map.get(key) ?? null,
  setItem: (key: string, value: string) => map.set(key, value),
  removeItem: (key: string) => map.delete(key),
})
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SYNC_URL', 'https://sync.example')
  local = new Map()
  session = new Map()
  vi.stubGlobal('localStorage', storage(local))
  vi.stubGlobal('sessionStorage', storage(session))
  vi.stubGlobal('location', { hash: '', pathname: '/blockhold/', search: '', origin: 'https://game.example', assign: vi.fn() })
  vi.stubGlobal('history', { replaceState: vi.fn() })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

it('sign-in completion merges existing local and cloud progress and keeps device settings', async () => {
  const { Cloud } = await import('../src/core/cloud.ts')
  const cloud = new Cloud()
  location.hash = '#blockhold_auth=completion'
  session.set('blockhold.auth.verifier', 'browser-proof')
  const save = { ...loadSave(), stars: { local: 3 }, xp: 100, sfxMuted: true, honors: ['hunt:ossuary:normal'] }
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    if (_url.endsWith('/v1/auth/exchange')) {
      expect(JSON.parse(init.body as string)).toEqual({ code: 'completion', verifier: 'browser-proof' })
      return Response.json({ token: 'new-session', provider: 'google', save: { stars: { remote: 2 }, xp: 200 } })
    }
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer new-session')
    return Response.json({ save: JSON.parse(init.body as string).save })
  })
  vi.stubGlobal('fetch', fetchMock)
  const merged = await cloud.finishSignIn(save)
  expect(merged?.stars).toEqual({ local: 3, remote: 2 })
  expect(merged?.xp).toBe(200)
  expect(merged?.sfxMuted).toBe(true)
  expect(merged?.honors).toContain('hunt:ossuary:normal')
  expect(session.has('blockhold.auth.verifier')).toBe(false)
  expect(history.replaceState).toHaveBeenCalledWith(null, '', '/blockhold/')
  expect(cloud.status().provider).toBe('google')
})

it('a callback without its original tab proof cannot replace the current account', async () => {
  local.set('blockhold.cloud.token', 'legacy-token')
  const { Cloud } = await import('../src/core/cloud.ts')
  const cloud = new Cloud()
  location.hash = '#blockhold_auth=untrusted'
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  expect(await cloud.finishSignIn(loadSave())).toBeNull()
  expect(request).not.toHaveBeenCalled()
  expect(local.get('blockhold.cloud.token')).toBe('legacy-token')
  expect(cloud.status().lastError).toContain('same browser tab')
})

it('sign-out clears only device authentication and revokes its server session', async () => {
  local.set('blockhold.cloud.token', 'session-token')
  local.set('blockhold.cloud.provider', 'google')
  local.set('blockhold.save.v1', '{"xp":400}')
  const { Cloud } = await import('../src/core/cloud.ts')
  const cloud = new Cloud()
  const request = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ ok: true }))
  vi.stubGlobal('fetch', request)
  await cloud.signOut()
  expect(cloud.signedIn).toBe(false)
  expect(local.get('blockhold.save.v1')).toBe('{"xp":400}')
  expect(local.has('blockhold.cloud.token')).toBe(false)
  expect(request.mock.calls[0][0]).toBe('https://sync.example/v1/auth/logout')
})

it('a sync completing after sign-out cannot reapply the old account save', async () => {
  local.set('blockhold.cloud.token', 'session-token')
  const { Cloud } = await import('../src/core/cloud.ts')
  const cloud = new Cloud()
  let finish!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/v1/save')
    ? new Promise<Response>(resolve => { finish = resolve }) : Promise.resolve(Response.json({ ok: true }))))
  const pending = cloud.sync(loadSave())
  await cloud.signOut()
  finish(Response.json({ save: { xp: 9999 } }))
  expect(await pending).toBeNull()
})
