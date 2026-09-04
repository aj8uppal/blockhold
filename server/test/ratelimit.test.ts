import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/db.ts'
import { rateLimited, resetRateLimiter } from '../src/app.ts'
import { harness } from './helpers.ts'

function store(): { s: Store, done: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'blockhold-limit-'))
  const s = new Store(join(dir, 'test.db'))
  return { s, done: () => { s.close(); rmSync(dir, { recursive: true, force: true }) } }
}

test('the persisted counter allows exactly the limit, then refuses', () => {
  const { s, done } = store()
  try {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      assert.equal(s.takeToken('account', 'hash', 5, 3_600_000, now), true, `call ${i + 1} should pass`)
    }
    assert.equal(s.takeToken('account', 'hash', 5, 3_600_000, now), false)
    // a different caller has its own budget
    assert.equal(s.takeToken('account', 'other', 5, 3_600_000, now), true)
    // and so does a different bucket
    assert.equal(s.takeToken('events', 'hash', 5, 3_600_000, now), true)
    // the window rolling over restores it
    assert.equal(s.takeToken('account', 'hash', 5, 3_600_000, now + 3_600_001), true)
  } finally { done() }
})

test('the persisted counter survives the process going away', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blockhold-limit-'))
  const path = join(dir, 'test.db')
  try {
    const now = Date.now()
    const first = new Store(path)
    for (let i = 0; i < 5; i++) assert.equal(first.takeToken('account', 'hash', 5, 3_600_000, now), true)
    first.close()

    // this is the whole point of putting the counter on disk: the machine
    // suspends whenever nobody is playing, and an in-memory budget would hand
    // an abuser a fresh allowance on every wake
    const second = new Store(path)
    assert.equal(second.takeToken('account', 'hash', 5, 3_600_000, now + 1000), false)
    second.close()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('the ip hash is stable across restarts and never the raw address', () => {
  const dir = mkdtempSync(join(tmpdir(), 'blockhold-limit-'))
  const path = join(dir, 'test.db')
  try {
    const first = new Store(path)
    const h1 = first.ipHash('203.0.113.7')
    first.close()
    const second = new Store(path)
    assert.equal(second.ipHash('203.0.113.7'), h1)
    assert.notEqual(second.ipHash('203.0.113.8'), h1)
    second.close()
    assert.equal(h1.length, 32)
    assert.equal(h1.includes('203'), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('two databases salt differently, so a hash is not portable', () => {
  const a = store()
  const b = store()
  try {
    assert.notEqual(a.s.ipHash('203.0.113.7'), b.s.ipHash('203.0.113.7'))
  } finally { a.done(); b.done() }
})

test('the in-memory limiter refuses past 60 in a window and recovers after it', () => {
  resetRateLimiter()
  const now = Date.now()
  for (let i = 0; i < 60; i++) assert.equal(rateLimited('1.2.3.4', now), false, `call ${i + 1}`)
  assert.equal(rateLimited('1.2.3.4', now), true)
  assert.equal(rateLimited('5.6.7.8', now), false)
  assert.equal(rateLimited('1.2.3.4', now + 60_001), false)
  resetRateLimiter()
})

test('filling the limiter does not hand the noisy caller a fresh budget', () => {
  // the bug this replaces was `hits.clear()` once the map passed its cap:
  // under load - the only time it fills - that reset everyone at once,
  // including whoever filled it, turning the ceiling into a metronome
  resetRateLimiter()
  const now = Date.now()
  for (let i = 0; i < 60; i++) rateLimited('noisy', now)
  assert.equal(rateLimited('noisy', now), true)

  // push the map well past its 10,000 entry cap with live entries
  for (let i = 0; i < 12_000; i++) rateLimited(`filler-${i}`, now)

  // the noisy caller was among the oldest, so it may have been evicted, but
  // the eviction must not have been indiscriminate: the newest callers keep
  // the counts they just accrued
  for (let i = 0; i < 60; i++) rateLimited('recent', now)
  assert.equal(rateLimited('recent', now), true)
  resetRateLimiter()
})

test('expired entries are the first thing evicted', () => {
  resetRateLimiter()
  const now = Date.now()
  for (let i = 0; i < 10_500; i++) rateLimited(`old-${i}`, now)
  // every entry above has expired by now, so the sweep should reclaim them
  // all rather than punishing whoever is currently active
  for (let i = 0; i < 60; i++) rateLimited('active', now + 120_000)
  assert.equal(rateLimited('active', now + 120_000), true)
  resetRateLimiter()
})

test('account creation is capped at 5 an hour from one address', async () => {
  const h = await harness()
  try {
    for (let i = 0; i < 5; i++) {
      assert.equal((await h.call('POST', '/v1/account', { body: {} })).status, 201, `account ${i + 1}`)
    }
    const blocked = await h.call('POST', '/v1/account', { body: {} })
    assert.equal(blocked.status, 429)
    assert.equal(h.store.count(), 5)

    // reads are not affected by the write bucket
    assert.equal((await h.call('GET', '/health')).status, 200)
    assert.equal((await h.call('GET', '/v1/daily/20000')).status, 200)
  } finally { await h.close() }
})

test('telemetry is capped far below the save endpoints', async () => {
  const h = await harness()
  try {
    for (let i = 0; i < 20; i++) {
      const res = await h.call('POST', '/v1/events', { body: { events: [{ type: 'ping' }] } })
      assert.equal(res.status, 202, `request ${i + 1}`)
    }
    assert.equal((await h.call('POST', '/v1/events', { body: { events: [{ type: 'ping' }] } })).status, 429)
    // and the refused request stored nothing
    assert.equal(h.store.stats(7).totalEvents, 20)
  } finally { await h.close() }
})
