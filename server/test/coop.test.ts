import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './helpers.ts'
import { RULESET_VERSION } from '../src/app.ts'
import { resetRooms, TURN_MS } from '../src/coop.ts'

/** read SSE lines from a room stream until `pred` matches or the deadline passes */
async function readUntil(base: string, path: string, pred: (msg: any) => boolean, ms = 3000): Promise<any[]> {
  const ctrl = new AbortController()
  const res = await fetch(base + path + `${path.includes('?') ? '&' : '?'}ruleset=${RULESET_VERSION}`, { signal: ctrl.signal })
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

    // late join receives its own seat plus replay history for deterministic catch-up
    const late = await h.call('POST', `/v1/coop/rooms/${code}/join`, { body: {} })
    assert.equal(late.status, 200)
    assert.equal(late.json.started, true)
    assert.ok(late.json.history.some((event: any) => event.type === 'cmd'))
    assert.ok(!JSON.stringify(late.json.history).includes(hostKey))
    assert.ok(!JSON.stringify(late.json.history).includes(guestKey))
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key: hostKey, type: 'end' } })
  } finally {
    resetRooms()
    await h.close()
  }
})

test('pause stops the clock and all four speeds authorize the correct ticks', async () => {
  resetRooms()
  const h = await harness()
  try {
    const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'start' } })
    for (const speed of [1, 2, 3, 4]) {
      await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'speed', payload: speed } })
      const seen = await readUntil(h.base, `/v1/coop/rooms/${code}/events?seat=0&key=${key}`, m => m.type === 'turn', 2000)
      assert.equal(seen.find(m => m.type === 'turn').ticks, 12 * speed)
    }
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'pause', payload: true } })
    const seen = await readUntil(h.base, `/v1/coop/rooms/${code}/events?seat=0&key=${key}`, m => m.type === 'turn', 2000)
    assert.equal(seen.find(m => m.type === 'turn').ticks, 0)
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'end' } })
  } finally {
    resetRooms()
    await h.close()
  }
})

test('reload resumes the same private seat without allocating another player', async () => {
  resetRooms()
  const h = await harness()
  try {
    const { json: { code, key, seat } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat, key, type: 'start', payload: { levelId: 'greenhollow', seed: 42 } } })
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat, key, type: 'cmd', payload: { kind: 'wave' } } })
    const resumed = await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat, key } })
    assert.equal(resumed.status, 200)
    assert.equal(resumed.json.seat, seat)
    assert.equal(resumed.json.seats, 1)
    assert.equal(resumed.json.started, true)
    assert.equal(resumed.json.setup.seed, 42)
    assert.ok(resumed.json.history.some((event: any) => event.type === 'cmd'))
    assert.ok(!JSON.stringify(resumed.json).includes(key), 'resume never echoes credentials')
    assert.equal((await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat, key: 'wrong' } })).status, 403)
    await h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat, key, type: 'end' } })
    assert.equal((await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat, key } })).status, 410)
  } finally { resetRooms(); await h.close() }
})

test('authenticated reconnect replays only events newer than its cursor with no keys in URLs or messages', async () => {
  resetRooms()
  const h = await harness()
  const controller = new AbortController()
  try {
    const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    const send = (type: string, payload?: unknown) => h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type, payload } })
    await send('start', { levelId: 'greenhollow' })
    await send('cmd', { kind: 'wave' })
    const snapshot = await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat: 0, key } })
    await send('cmd', { kind: 'heroSig' })
    const stream = await fetch(`${h.base}/v1/coop/rooms/${code}/events?seat=0&after=${snapshot.json.seq}&ruleset=${RULESET_VERSION}`, {
      headers: { Authorization: `Bearer ${key}` }, signal: controller.signal,
    })
    assert.equal(stream.status, 200)
    const reader = stream.body!.getReader()
    const chunk = await reader.read()
    const text = new TextDecoder().decode(chunk.value)
    assert.ok(text.includes('heroSig'))
    assert.ok(!text.includes('"kind":"wave"'))
    assert.ok(!text.includes(key))
    assert.match(text, /id: \d+\ndata:/)
    controller.abort()
    const bad = await fetch(`${h.base}/v1/coop/rooms/${code}/events?seat=0&after=0&ruleset=${RULESET_VERSION}`, { headers: { Authorization: 'Bearer wrong' } })
    assert.equal(bad.status, 403)
  } finally { controller.abort(); resetRooms(); await h.close() }
})

test('room chat accepts only bounded text, has its own rate limit, and never becomes a game command', async () => {
  resetRooms()
  const h = await harness()
  try {
    const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    const chat = (payload: unknown) => h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'chat', payload } })
    for (const invalid of [{ kind: 'wave' }, '', ' '.repeat(12), 'x'.repeat(241)]) assert.equal((await chat(invalid)).status, 400)
    assert.equal((await chat('<img src=x onerror=alert(1)>\nHello')).status, 202)
    for (let i = 0; i < 4; i++) assert.equal((await chat(`Message ${i}`)).status, 202)
    assert.equal((await chat('too fast')).status, 429)
    const snapshot = await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat: 0, key } })
    const history = snapshot.json.history
    assert.equal(history.filter((event: any) => event.type === 'chat').length, 5)
    assert.equal(history[0].payload, '<img src=x onerror=alert(1)> Hello')
    assert.equal(history.some((event: any) => event.type === 'cmd'), false)
    assert.ok(!JSON.stringify(history).includes(key))
  } finally { resetRooms(); await h.close() }
})

test('adopted battle journals require the current ruleset and start paused', async () => {
  resetRooms()
  const h = await harness()
  try {
    const { RULESET_VERSION } = await import('../src/app.ts')
    const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    const battle = { ruleset: RULESET_VERSION, tick: 30, commands: [], initialSave: { xp: 123 } }
    const start = (payload: unknown) => h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type: 'start', payload } })
    assert.equal((await start({ battle: { ...battle, ruleset: -1 } })).status, 400)
    assert.equal((await start({ levelId: 'greenhollow', mode: 'campaign', battle })).status, 202)
    const state = await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat: 0, key } })
    assert.equal(state.json.paused, true)
    assert.equal(state.json.setup.battle.initialSave.xp, 123)
    assert.equal(state.json.history.some((event: any) => event.type === 'start'), false, 'large initial journal is kept once, in setup')
  } finally { resetRooms(); await h.close() }
})

test('missing or old client rulesets cannot create, join, resume, stream or send commands', async () => {
  resetRooms()
  const h = await harness()
  try {
    const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    for (const query of ['', `?ruleset=${RULESET_VERSION - 1}`]) {
      for (const [method, path] of [['POST', '/v1/coop/rooms'], ['POST', `/v1/coop/rooms/${code}/join`],
        ['POST', `/v1/coop/rooms/${code}/resume`], ['POST', `/v1/coop/rooms/${code}/send`], ['GET', `/v1/coop/rooms/${code}/events`]]) {
        const response = await fetch(h.base + path + query, {
          method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: method === 'POST' ? JSON.stringify({ seat: 0, key, type: 'cmd', payload: { kind: 'wave' } }) : undefined,
        })
        assert.equal(response.status, 409)
        assert.match((await response.json()).error, /Refresh Blockhold/)
      }
    }
  } finally { resetRooms(); await h.close() }
})

test('100ms rooms wait for both scenes, then order commands at six ticks per marker', async () => {
  resetRooms()
  const h = await harness()
  const streams = [new AbortController(), new AbortController()]
  try {
    const { json: host } = await h.call('POST', '/v1/coop/rooms?paced=1', { body: {} })
    const { json: guest } = await h.call('POST', `/v1/coop/rooms/${host.code}/join?paced=1`, { body: {} })
    assert.equal(host.turnMs, 100)
    assert.equal(guest.ticksPerTurn, 6)
    assert.equal(guest.paced, true)
    for (const [i, seat] of [host, guest].entries()) {
      const response = await fetch(`${h.base}/v1/coop/rooms/${host.code}/events?seat=${seat.seat}&ruleset=${RULESET_VERSION}`, {
        headers: { Authorization: `Bearer ${seat.key}` }, signal: streams[i].signal,
      })
      assert.equal(response.status, 200)
    }
    const send = (seat: typeof host, type: string, payload?: unknown) => h.call('POST', `/v1/coop/rooms/${host.code}/send`, { body: { seat: seat.seat, key: seat.key, type, payload } })
    const state = async () => (await h.call('POST', `/v1/coop/rooms/${host.code}/resume`, { body: { seat: 0, key: host.key } })).json
    await send(host, 'start', { levelId: 'greenhollow', seed: 71 })
    await send(host, 'ready')
    await send(host, 'ready') // duplicate cannot release another seat
    await send(guest, 'pause', false) // resume cannot bypass scene readiness
    await new Promise(r => setTimeout(r, 250))
    const waiting = await state()
    assert.equal(waiting.paused, true)
    assert.ok(waiting.history.some((m: any) => m.type === 'turn'))
    assert.ok(waiting.history.filter((m: any) => m.type === 'turn').every((m: any) => m.ticks === 0))
    await send(guest, 'ready')
    await send(host, 'cmd', { kind: 'wave' })
    await new Promise(r => setTimeout(r, 250))
    const running = await state()
    assert.equal(running.paused, false)
    const command = running.history.find((m: any) => m.type === 'cmd')
    const marker = running.history.find((m: any) => m.type === 'turn' && m.n === command.turn)
    assert.equal(marker.ticks, 6)
    assert.ok(command.seq < marker.seq)
    await send(host, 'speed', 2)
    await new Promise(r => setTimeout(r, 150))
    assert.equal((await state()).history.filter((m: any) => m.type === 'turn').at(-1).ticks, 12)
  } finally { streams.forEach(s => s.abort()); resetRooms(); await h.close() }
})

test('a disconnected loading seat cannot strand its ready ally', async () => {
  resetRooms()
  const h = await harness()
  const stream = new AbortController()
  try {
    const { json: host } = await h.call('POST', '/v1/coop/rooms?paced=1', { body: {} })
    const { json: guest } = await h.call('POST', `/v1/coop/rooms/${host.code}/join?paced=1`, { body: {} })
    await fetch(`${h.base}/v1/coop/rooms/${host.code}/events?seat=1&ruleset=${RULESET_VERSION}`, {
      headers: { Authorization: `Bearer ${guest.key}` }, signal: stream.signal,
    })
    const send = (type: string) => h.call('POST', `/v1/coop/rooms/${host.code}/send`, { body: { seat: 0, key: host.key, type } })
    const state = async () => (await h.call('POST', `/v1/coop/rooms/${host.code}/resume`, { body: { seat: 0, key: host.key } })).json
    await send('start'); await send('ready')
    assert.equal((await state()).paused, true)
    stream.abort()
    for (let i = 0; i < 30 && (await state()).paused; i++) await new Promise(r => setTimeout(r, 10))
    assert.equal((await state()).paused, false)
  } finally { stream.abort(); resetRooms(); await h.close() }
})

test('readiness preserves manual pauses and an adopted solo battle stays paused', async () => {
  resetRooms()
  const h = await harness()
  try {
    for (const adopted of [false, true]) {
      const { json: { code, key } } = await h.call('POST', '/v1/coop/rooms?paced=1', { body: {} })
      const send = (type: string, payload?: unknown) => h.call('POST', `/v1/coop/rooms/${code}/send`, { body: { seat: 0, key, type, payload } })
      const battle = { ruleset: RULESET_VERSION, tick: 30, commands: [], initialSave: { xp: 123 } }
      await send('start', { levelId: 'greenhollow', ...(adopted ? { battle } : {}) })
      if (!adopted) await send('pause', true)
      await send('ready')
      const state = await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat: 0, key } })
      assert.equal(state.json.paused, true)
      await send('pause', false)
      assert.equal((await h.call('POST', `/v1/coop/rooms/${code}/resume`, { body: { seat: 0, key } })).json.paused, false)
    }
  } finally { resetRooms(); await h.close() }
})


test('either ally restarts once in the same room, clears adopted history, and waits for both scenes', async () => {
  resetRooms()
  const h = await harness(), streams = [new AbortController(), new AbortController()]
  try {
    const { json: host } = await h.call('POST', '/v1/coop/rooms?paced=1&restart=1', { body: {} })
    const { json: guest } = await h.call('POST', `/v1/coop/rooms/${host.code}/join?paced=1&restart=1`, { body: {} })
    const send = (seat: typeof host, type: string, payload?: unknown, generation = 0) => h.call('POST', `/v1/coop/rooms/${host.code}/send`, {
      body: { seat: seat.seat, key: seat.key, type, payload, generation },
    })
    const state = async () => (await h.call('POST', `/v1/coop/rooms/${host.code}/resume`, { body: { seat: 1, key: guest.key } })).json
    for (const [i, seat] of [host, guest].entries()) {
      const response = await fetch(`${h.base}/v1/coop/rooms/${host.code}/events?seat=${seat.seat}&ruleset=${RULESET_VERSION}&restart=1`, {
        headers: { Authorization: `Bearer ${seat.key}` }, signal: streams[i].signal,
      })
      assert.equal(response.status, 200)
    }
    const setup = { levelId: 'greenhollow', difficulty: 'normal', hero: 'aldric', seed: 991, loadout: { xp: 10000, armory: {} },
      battle: { ruleset: RULESET_VERSION, tick: 30, commands: [], initialSave: { xp: 10000 } } }
    await send(host, 'start', setup)
    await send(host, 'cmd', { kind: 'build', tower: 'arrow', plot: 0 })
    const replies = await Promise.all([send(guest, 'restart', 0), send(host, 'restart', 0)])
    assert.ok(replies.every(reply => reply.status === 202))
    const restarted = await state()
    assert.equal(restarted.code, host.code); assert.equal(restarted.seat, 1)
    assert.equal(restarted.seats, 2); assert.equal(restarted.generation, 1)
    assert.equal(restarted.setup.battle, undefined)
    assert.equal(restarted.setup.seed, 991); assert.equal(restarted.setup.loadout.xp, 10000)
    assert.ok(!restarted.history.some((e: any) => e.type === 'cmd'))
    assert.equal(restarted.paused, true)
    assert.equal((await send(host, 'cmd', { kind: 'wave' }, 0)).status, 409, 'stale attempt orders are rejected')
    await send(host, 'ready', undefined, 1)
    await send(guest, 'pause', false, 1)
    assert.equal((await state()).paused, true, 'resume cannot bypass the other loading scene')
    await send(guest, 'ready', undefined, 1)
    assert.equal((await state()).paused, false)
    await send(host, 'cmd', { kind: 'wave' }, 1)
    assert.equal((await state()).history.filter((e: any) => e.type === 'cmd').length, 1)
  } finally { streams.forEach(s => s.abort()); resetRooms(); await h.close() }
})

test('a mixed-version room asks for a refresh instead of restarting only the updated player', async () => {
  resetRooms()
  const h = await harness(), stream = new AbortController()
  try {
    const { json: host } = await h.call('POST', '/v1/coop/rooms?restart=1', { body: {} })
    const { json: guest } = await h.call('POST', `/v1/coop/rooms/${host.code}/join`, { body: {} })
    await fetch(`${h.base}/v1/coop/rooms/${host.code}/events?seat=1&ruleset=${RULESET_VERSION}`, {
      headers: { Authorization: `Bearer ${guest.key}` }, signal: stream.signal,
    })
    const send = (type: string, payload: unknown) => h.call('POST', `/v1/coop/rooms/${host.code}/send`, { body: { seat: 0, key: host.key, type, payload } })
    await send('start', { levelId: 'greenhollow', seed: 12 })
    const retry = await send('restart', 0)
    assert.equal(retry.status, 409); assert.match(retry.json.error, /Everyone.*refresh/)
    const state = await h.call('POST', `/v1/coop/rooms/${host.code}/resume`, { body: { seat: 0, key: host.key } })
    assert.equal(state.json.generation, 0); assert.equal(state.json.seats, 2)
  } finally { stream.abort(); resetRooms(); await h.close() }
})

test('Hold gatherings validate snapshots, preserve readiness on reconnect, reset on settings and gate all four seats', async () => {
  resetRooms()
  const h = await harness()
  const controllers: AbortController[] = []
  try {
    const { json: host } = await h.call('POST', '/v1/coop/rooms?paced=1', { body: {} })
    const path = `/v1/coop/rooms/${host.code}`
    const seats = [host]
    for (let i = 0; i < 3; i++) seats.push((await h.call('POST', `${path}/join?paced=1`, { body: {} })).json)
    const send = (id: number, type: string, payload?: unknown) => h.call('POST', `${path}/send`, { body: { seat: seats[id].seat, key: seats[id].key, type, payload } })
    const hold = { version: 1, name: 'Gathering', theme: 'forest', color: 'ruby', keep: 'stone', pieces: [{ id: 'tree:0', x: 0, z: 0, r: 0 }], date: 100 }
    const setup = { gathering: true, hold, levelId: 'greenhollow', seed: 42 }
    assert.equal((await send(0, 'setup', { ...setup, hold: { ...hold, pieces: Array(81).fill(hold.pieces[0]) } })).status, 400)
    assert.equal((await send(1, 'setup', setup)).status, 403)
    assert.equal((await send(0, 'setup', setup)).status, 202)
    assert.equal((await send(0, 'start')).status, 409)
    const connect = async (id: number) => {
      const ctrl = new AbortController(); controllers.push(ctrl)
      const response = await fetch(`${h.base}${path}/events?seat=${id}&key=${seats[id].key}&paced=1&ruleset=${RULESET_VERSION}`, { signal: ctrl.signal })
      assert.equal(response.status, 200)
      return ctrl
    }
    for (let i = 0; i < 4; i++) await connect(i)
    for (let i = 0; i < 4; i++) assert.equal((await send(i, 'lobbyReady', { revision: 1, ready: true })).status, 202)
    // A newer settings snapshot invalidates every previous confirmation.
    assert.equal((await send(0, 'setup', { ...setup, seed: 43 })).status, 202)
    assert.equal((await send(0, 'lobbyReady', { revision: 1, ready: true })).status, 409)
    let resumed = await h.call('POST', `${path}/resume`, { body: { seat: 1, key: seats[1].key } })
    assert.deepEqual(resumed.json.readySeats, [])
    assert.equal(resumed.json.lobbyRevision, 2)
    for (let i = 0; i < 4; i++) await send(i, 'lobbyReady', { revision: 2, ready: true })
    controllers[1].abort()
    await new Promise(r => setTimeout(r, 30))
    assert.equal((await send(0, 'start')).status, 409)
    await connect(1)
    resumed = await h.call('POST', `${path}/resume`, { body: { seat: 1, key: seats[1].key } })
    assert.deepEqual(resumed.json.readySeats, [0, 1, 2, 3])
    assert.deepEqual(resumed.json.setup.hold, hold)
    // Host cannot change the plan as part of the start request.
    assert.equal((await send(0, 'start', { ...setup, seed: 99 })).status, 409)
    assert.equal((await send(0, 'start')).status, 202)
    // The paced renderer-ready signal still completes battle preparation separately.
    for (let i = 0; i < 4; i++) await send(i, 'ready')
    resumed = await h.call('POST', `${path}/resume`, { body: { seat: 1, key: seats[1].key } })
    assert.equal(resumed.json.started, true)
    assert.equal(resumed.json.paused, false)
  } finally { controllers.forEach(c => c.abort()); resetRooms(); await h.close() }
})

test('leaving a gathering frees only the guest seat and new guests never inherit its ready state', async () => {
  resetRooms(); const h = await harness()
  try {
    const { json: host } = await h.call('POST', '/v1/coop/rooms', { body: {} })
    const path = `/v1/coop/rooms/${host.code}`
    const { json: guest } = await h.call('POST', `${path}/join`, { body: {} })
    const { json: guest2 } = await h.call('POST', `${path}/join`, { body: {} })
    assert.equal((await h.call('POST', `${path}/send`, { body: { ...guest, type: 'leaveLobby' } })).status, 202)
    const { json: next } = await h.call('POST', `${path}/join`, { body: {} })
    assert.equal(next.seat, guest.seat); assert.notEqual(next.key, guest.key)
    assert.equal((await h.call('POST', `${path}/resume`, { body: guest2 })).status, 200)
    assert.equal((await h.call('POST', `${path}/resume`, { body: guest })).status, 403)
    assert.deepEqual(next.readySeats, [])
  } finally { resetRooms(); await h.close() }
})
