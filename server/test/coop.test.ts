import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './helpers.ts'
import { resetRooms, TURN_MS } from '../src/coop.ts'

/** read SSE lines from a room stream until `pred` matches or the deadline passes */
async function readUntil(base: string, path: string, pred: (msg: any) => boolean, ms = 3000): Promise<any[]> {
  const ctrl = new AbortController()
  const res = await fetch(base + path, { signal: ctrl.signal })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/)
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  const seen: any[] = []
  let buf = ''
  const deadline = Date.now() + ms
  try {
    while (Date.now() < deadline) {
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined, done: true }>(r => setTimeout(() => r({ value: undefined, done: true }), Math.max(1, deadline - Date.now()))),
      ])
      if (done || !value) break
      buf += dec.decode(value, { stream: true })
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2)
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const msg = JSON.parse(line.slice(6))
          seen.push(msg)
          if (pred(msg)) return seen
        }
      }
    }
  } finally {
    ctrl.abort()
  }
  return seen
}

test('a room is created, joined, set up, started, and keeps time', async () => {
  resetRooms()
  const h = await harness()
  try {
    const created = await h.call('POST', '/v1/coop/rooms', { body: {} })
    assert.equal(created.status, 201)
    const { code, seat: hostSeat, key: hostKey } = created.json
    assert.match(code, /^[A-Z0-9]{5}$/)
    assert.equal(hostSeat, 0)

    const joined = await h.call('POST', `/v1/coop/rooms/${code}/join`, { body: {} })
    assert.equal(joined.status, 200)
    assert.equal(joined.json.seat, 1)
    const guestKey = joined.json.key

    // the wrong key is refused
    const bad = await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 1, key: 'nope', type: 'ping' } })
    assert.equal(bad.status, 403)
    // a guest cannot set the room up
    const notHost = await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 1, key: guestKey, type: 'setup', payload: { levelId: 'x' } } })
    assert.equal(notHost.status, 403)
    // commands before the start are refused
    const early = await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key: hostKey, type: 'cmd', payload: { kind: 'wave' } } })
    assert.equal(early.status, 409)

    // the guest listens; the host sets up, starts, and sends a command
    const listening = readUntil(h.base, `/v1/coop/rooms/${code}/events?seat=1&key=${guestKey}`,
      m => m.type === 'cmd', 4000)
    await new Promise(r => setTimeout(r, 50))
    const setup = await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key: hostKey, type: 'setup', payload: { levelId: 'greenhollow', seed: 7 } } })
    assert.equal(setup.status, 202)
    const start = await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key: hostKey, type: 'start' } })
    assert.equal(start.status, 202)
    await new Promise(r => setTimeout(r, TURN_MS * 2 + 20))
    const cmd = await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key: hostKey, type: 'cmd', payload: { kind: 'wave' } } })
    assert.equal(cmd.status, 202)
    const seen = await listening

    const hello = seen.find(m => m.type === 'hello')
    assert.ok(hello, 'the stream opens with hello')
    assert.equal(hello.seat, 1)
    assert.ok(seen.some(m => m.type === 'setup' && m.setup.levelId === 'greenhollow'), 'setup is relayed')
    assert.ok(seen.some(m => m.type === 'start'), 'start is relayed')
    const turns = seen.filter(m => m.type === 'turn')
    assert.ok(turns.length >= 2, 'the metronome ticks')
    assert.equal(turns[0].ticks, 12)
    const c = seen.find(m => m.type === 'cmd')
    assert.equal(c.seat, 0)
    assert.deepEqual(c.cmd, { kind: 'wave' })
    // stamped for the turn after the last marker the guest had seen
    const lastTurnBefore = Math.max(...seen.filter(m => m.type === 'turn' && m.seq < c.seq).map(m => m.n))
    assert.equal(c.turn, lastTurnBefore + 1)
    // total order: seq climbs monotonically
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i].seq >= seen[i - 1].seq)

    // a joined room cannot be joined once started
    const late = await h.call('POST', `/v1/coop/rooms/${code}/join`, { body: {} })
    assert.equal(late.status, 409)
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key: hostKey, type: 'end' } })
  } finally {
    resetRooms()
    await h.close()
  }
})

test('pause stops the clock and speed doubles it', async () => {
  resetRooms()
  const h = await harness()
  try {
    const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'start' } })
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'speed', payload: 2 } })
    let seen = await readUntil(h.base, `/v1/coop/rooms/${code}/events?seat=0&key=${key}`, m => m.type === 'turn', 2000)
    assert.equal(seen.find(m => m.type === 'turn').ticks, 24)
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'pause', payload: true } })
    seen = await readUntil(h.base, `/v1/coop/rooms/${code}/events?seat=0&key=${key}`, m => m.type === 'turn', 2000)
    assert.equal(seen.find(m => m.type === 'turn').ticks, 0)
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'end' } })
  } finally {
    resetRooms()
    await h.close()
  }
})
