import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness } from './helpers.ts'
import { sanitizeEvent } from '../src/app.ts'

test('ingests a batch and reports what it kept', async () => {
  const h = await harness()
  try {
    const res = await h.call('POST', '/v1/events', {
      body: { events: [{ type: 'run_start', map: 'frostmere' }, { type: 'run_end', wave: 12 }] },
    })
    assert.equal(res.status, 202)
    assert.deepEqual(res.json, { accepted: 2, rejected: 0 })
    assert.equal(h.store.stats(7).totalEvents, 2)
  } finally { await h.close() }
})

test('refuses more than 64 events in one request', async () => {
  const h = await harness()
  try {
    const events = Array.from({ length: 65 }, () => ({ type: 'ping' }))
    const res = await h.call('POST', '/v1/events', { body: { events } })
    assert.equal(res.status, 400)
    assert.equal(h.store.stats(7).totalEvents, 0)

    const ok = await h.call('POST', '/v1/events', { body: { events: events.slice(0, 64) } })
    assert.equal(ok.status, 202)
    assert.equal(ok.json.accepted, 64)
  } finally { await h.close() }
})

test('rejects a body that is not an array of events', async () => {
  const h = await harness()
  try {
    assert.equal((await h.call('POST', '/v1/events', { body: {} })).status, 400)
    assert.equal((await h.call('POST', '/v1/events', { body: { events: 'nope' } })).status, 400)
  } finally { await h.close() }
})

test('drops malformed events instead of failing the batch', async () => {
  const h = await harness()
  try {
    const res = await h.call('POST', '/v1/events', {
      body: { events: [{ type: 'ok_event' }, { type: 'BAD TYPE!' }, { nope: 1 }, 'string', null] },
    })
    assert.equal(res.status, 202)
    assert.equal(res.json.accepted, 1)
    assert.equal(res.json.rejected, 4)
  } finally { await h.close() }
})

test('flattens payloads and discards nested junk', () => {
  const e = sanitizeEvent({
    type: 'run_end',
    wave: 7,
    won: false,
    note: 'x'.repeat(500),
    nested: { a: 1 },
    list: [1, 2, 3],
  })
  assert.ok(e)
  const payload = JSON.parse(e.payload)
  assert.equal(payload.wave, 7)
  assert.equal(payload.won, false)
  assert.equal(payload.note.length, 128)
  assert.equal('nested' in payload, false)
  assert.equal('list' in payload, false)
})

test('stats is a 404 with no token configured, and refuses a wrong one', async () => {
  const h = await harness()
  try {
    assert.equal((await h.call('GET', '/v1/stats')).status, 404)
    assert.equal((await h.call('GET', '/v1/stats', { token: 'x'.repeat(32) })).status, 404)
  } finally { await h.close() }
})

test('stats needs the configured token and returns aggregates only', async () => {
  const token = 's'.repeat(32)
  const h = await harness({ statsToken: token })
  try {
    assert.equal((await h.call('GET', '/v1/stats')).status, 404)
    assert.equal((await h.call('GET', '/v1/stats', { token: 'w'.repeat(32) })).status, 404)

    await h.call('POST', '/v1/events', {
      body: {
        events: [
          { type: 'run_end', wave: 5, session: 'abcdefgh' },
          { type: 'run_end', wave: 5, session: 'abcdefgh' },
          { type: 'run_end', wave: 9, session: 'ijklmnop' },
          { type: 'run_start', session: 'ijklmnop' },
        ],
      },
    })

    const res = await h.call('GET', '/v1/stats', { token })
    assert.equal(res.status, 200)
    assert.equal(res.json.totalEvents, 4)
    assert.deepEqual(res.json.byType, [
      { type: 'run_end', count: 3 },
      { type: 'run_start', count: 1 },
    ])
    assert.deepEqual(res.json.runEndWaves, [{ wave: 5, count: 2 }, { wave: 9, count: 1 }])
    assert.equal(res.json.sessionsPerDay.length, 1)
    assert.equal(res.json.sessionsPerDay[0].sessions, 2)
    // aggregates only: no payloads, no ip hashes, no individual rows
    assert.equal(JSON.stringify(res.json).includes('ip_hash'), false)
  } finally { await h.close() }
})

test('the retention sweep drops events past 90 days and keeps the rest', async () => {
  const h = await harness()
  try {
    const now = Date.now()
    h.store.insertEvents([{ type: 'old', session: null, payload: '{}' }], 'hash', now - 91 * 86_400_000)
    h.store.insertEvents([{ type: 'new', session: null, payload: '{}' }], 'hash', now)
    const swept = h.store.sweep(now)
    assert.equal(swept.events, 1)
    assert.deepEqual(h.store.stats(365, now).byType, [{ type: 'new', count: 1 }])
  } finally { await h.close() }
})

test('the sweep collects accounts with no save write in 180 days', async () => {
  const h = await harness()
  try {
    const now = Date.now()
    const stale = h.store.create('{}')
    const fresh = h.store.create('{}')
    h.store.write(stale.id, '{}', now - 181 * 86_400_000)
    h.store.write(fresh.id, '{}', now - 10 * 86_400_000)
    h.store.submitDaily({
      day: 1, accountId: stale.id, nickname: 'Ghost', seed: 1, ruleset: 2,
      wave: 3, lives: 1, won: false, score: 10, replay: null,
    }, now)

    assert.equal(h.store.sweep(now).accounts, 1)
    assert.equal(h.store.byToken(stale.token), null)
    assert.ok(h.store.byToken(fresh.token))
    // the board row goes with the account: a name nobody can correct or
    // remove has no business staying on a public list
    assert.equal(h.store.dailyTotal(1), 0)
  } finally { await h.close() }
})
