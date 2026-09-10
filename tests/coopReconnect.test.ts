import { RULESET_VERSION } from '../src/game/ruleset.ts'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'

let local: Map<string, string>
const seatKey = 'abcdefghijklmnop'
const setup = { levelId: 'greenhollow', seed: 42, difficulty: 'normal', hero: 'aldric', loadout: { armory: {}, xp: 12 } }
beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SYNC_URL', 'https://sync.test')
  local = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => local.get(key) ?? null, setItem: (key: string, value: string) => local.set(key, value), removeItem: (key: string) => local.delete(key) })
  vi.stubGlobal('location', { href: 'https://game.test/?other=1#old' })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

it('persists a private seat, keeps credentials out of invitations, and forgets only on explicit leave', async () => {
  const { CoopSession } = await import('../src/core/coop.ts')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ code: 'ABCDE', seat: 0, key: seatKey, turnMs: 200, ticksPerTurn: 12 })))
  const session = await CoopSession.create()
  expect(CoopSession.savedRoom()).toBe('ABCDE')
  expect(session.shareUrl()).toBe('https://game.test/?coop=ABCDE')
  expect(session.shareUrl()).not.toContain(seatKey)
  session.close()
  expect(CoopSession.savedRoom()).toBe('ABCDE')
  session.close(true)
  expect(CoopSession.savedRoom()).toBeNull()
})

it('rejoining our saved invitation recovers the original seat and exposes ordered replay to the game', async () => {
  local.set('blockhold.coop.seat.v1', JSON.stringify({ code: 'ABCDE', seat: 2, key: seatKey, expiresAt: Date.now() + 60000 }))
  const { CoopSession } = await import('../src/core/coop.ts')
  const history = [{ type: 'cmd', seat: 0, turn: 1, cmd: { kind: 'wave' }, seq: 3 }, { type: 'turn', n: 1, ticks: 12, seq: 4 }]
  const request = vi.fn(async (url: string, init: RequestInit) => {
    expect(url).toBe(`https://sync.test/v1/coop/rooms/ABCDE/resume?ruleset=${RULESET_VERSION}&paced=1`)
    expect(JSON.parse(init.body as string)).toEqual({ seat: 2, key: seatKey })
    return Response.json({ setup, seats: 3, connected: [0], started: true, history, seq: 4, paused: true, speed: 2, turnMs: 200, ticksPerTurn: 12 })
  })
  vi.stubGlobal('fetch', request)
  const session = await CoopSession.join('abcde')
  expect(session.seat).toBe(2)
  expect(session.replayEvents).toEqual(history)
  expect(session.replaySeq).toBe(4)
  expect(session.paused).toBe(true)
  expect(session.speed).toBe(2)
  expect(request).toHaveBeenCalledTimes(1)
})

it('reconnect stream authenticates in headers and delivers missing events before moving to the hello cursor', async () => {
  const { CoopSession } = await import('../src/core/coop.ts')
  const encode = new TextEncoder()
  let requests = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (!url.includes('/events')) return Response.json({ code: 'ABCDE', seat: 0, key: seatKey, turnMs: 200, ticksPerTurn: 12 })
    requests++
    expect(url).toBe(`https://sync.test/v1/coop/rooms/ABCDE/events?seat=0&after=0&ruleset=${RULESET_VERSION}&paced=1`)
    expect(url).not.toContain(seatKey)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${seatKey}`)
    return new Response(new ReadableStream({ start(controller) {
      const events = [
        { type: 'hello', seq: 10, setup, started: true, seats: 1, connected: [0], paused: true, speed: 2 },
        { type: 'cmd', seq: 5, turn: 1, seat: 0, cmd: { kind: 'wave' } },
        { type: 'turn', seq: 6, n: 1, ticks: 12 },
        { type: 'caughtup', seq: 10 },
      ]
      controller.enqueue(encode.encode(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join('')))
    } }))
  }))
  const session = await CoopSession.create()
  const received: string[] = []
  session.on(event => received.push(event.type))
  session.connect()
  await vi.waitFor(() => expect(session.replaySeq).toBe(10))
  expect(received).toEqual(['hello', 'cmd', 'turn', 'connection', 'caughtup'])
  expect(requests).toBe(1)
  expect(session.paused).toBe(true)
  expect(session.speed).toBe(2)
  session.close(true)
})

it('an expired server room clears its saved credentials with a recoverable error', async () => {
  local.set('blockhold.coop.seat.v1', JSON.stringify({ code: 'ABCDE', seat: 0, key: seatKey, expiresAt: Date.now() + 60000 }))
  const { CoopSession } = await import('../src/core/coop.ts')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'no room' }, { status: 404 })))
  await expect(CoopSession.resume()).rejects.toThrow('expired')
  expect(CoopSession.savedRoom()).toBeNull()
})

it('a protocol mismatch tells the player to refresh while preserving the saved seat', async () => {
  local.set('blockhold.coop.seat.v1', JSON.stringify({ code: 'ABCDE', seat: 0, key: seatKey, expiresAt: Date.now() + 60000 }))
  const { CoopSession } = await import('../src/core/coop.ts')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'version mismatch' }, { status: 409 })))
  await expect(CoopSession.resume()).rejects.toThrow('Refresh Blockhold')
  expect(CoopSession.savedRoom()).toBe('ABCDE')
})

it('large adopted journals bypass the browser keepalive upload quota while small commands can finish on navigation', async () => {
  const { CoopSession } = await import('../src/core/coop.ts')
  const requests: RequestInit[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes('/send')) { requests.push(init); return Response.json({ ok: true }, { status: 202 }) }
    return Response.json({ code: 'ABCDE', seat: 0, key: seatKey, turnMs: 200, ticksPerTurn: 12 })
  }))
  const session = await CoopSession.create()
  const adopted = { ...setup, battle: { ruleset: RULESET_VERSION, tick: 3000, initialSave: { xp: 500 },
    commands: Array.from({ length: 2500 }, (_, tick) => ({ tick, cmd: { kind: 'heroMove', x: tick % 10, z: 1 } })) } }
  for (const type of ['setup', 'start']) {
    expect(await session.send(type, adopted)).toBe(true)
    const request = requests.at(-1)!
    expect(new TextEncoder().encode(request.body as string).byteLength).toBeGreaterThan(65_536)
    expect(request.keepalive).toBe(false)
    expect(JSON.parse(request.body as string).payload.battle.commands).toHaveLength(2500)
  }
  expect(await session.send('cmd', { kind: 'wave' })).toBe(true)
  expect(requests.at(-1)?.keepalive).toBe(true)
})
