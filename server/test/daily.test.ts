import { test } from 'node:test'
import assert from 'node:assert/strict'
import { account, harness } from './helpers.ts'
import { RULESET_VERSION, parseDay, sanitizeNickname } from '../src/app.ts'

const run = (over: Record<string, unknown> = {}) => ({
  seed: 12345, ruleset: RULESET_VERSION, wave: 10, lives: 5, won: false, score: 1000, ...over,
})

test('a submission needs a token', async () => {
  const h = await harness()
  try {
    assert.equal((await h.call('POST', '/v1/daily/20000/score', { body: run() })).status, 401)
  } finally { await h.close() }
})

test('keeps only the best result for a day', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    const first = await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 5000, wave: 20 }), token })
    assert.equal(first.status, 200)
    assert.equal(first.json.best.score, 5000)
    assert.equal(first.json.rank, 1)
    assert.equal(first.json.total, 1)

    // a worse run must not overwrite it
    const worse = await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 100, wave: 2 }), token })
    assert.equal(worse.json.best.score, 5000)
    assert.equal(worse.json.best.wave, 20)
    assert.equal(worse.json.total, 1)

    // a better one must
    const better = await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 9000, wave: 30 }), token })
    assert.equal(better.json.best.score, 9000)
    assert.equal(better.json.best.wave, 30)
    assert.equal(better.json.total, 1)
  } finally { await h.close() }
})

test('an equal score is broken by the higher wave', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 500, wave: 4 }), token })
    const tie = await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 500, wave: 9 }), token })
    assert.equal(tie.json.best.wave, 9)
    const back = await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 500, wave: 1 }), token })
    assert.equal(back.json.best.wave, 9)
  } finally { await h.close() }
})

test('a ruleset mismatch is a 409 and stores nothing', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    const res = await h.call('POST', '/v1/daily/20000/score', {
      body: run({ ruleset: RULESET_VERSION - 1 }),
      token,
    })
    assert.equal(res.status, 409)
    assert.equal(res.json.expected, RULESET_VERSION)
    assert.equal(res.json.got, RULESET_VERSION - 1)
    assert.equal(h.store.dailyTotal(20000), 0)

    assert.equal((await h.call('POST', '/v1/daily/20000/score', { body: run({ ruleset: 'two' }), token })).status, 400)
  } finally { await h.close() }
})

test('out of range numbers and days are refused', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    for (const bad of [{ wave: 1000 }, { wave: -1 }, { lives: 100 }, { score: 100_000_000 }, { seed: 'x' }]) {
      const res = await h.call('POST', '/v1/daily/20000/score', { body: run(bad), token })
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(bad)}`)
    }
    // a day outside the plausible range never reaches the handler at all
    assert.equal((await h.call('POST', '/v1/daily/9999999/score', { body: run(), token })).status, 404)
    assert.equal((await h.call('GET', '/v1/daily/notaday', { token })).status, 404)
  } finally { await h.close() }
})

test('nicknames are stripped to a safe alphabet, never rejected', () => {
  assert.equal(sanitizeNickname('Bob'), 'Bob')
  assert.equal(sanitizeNickname('  spaced  out  '), 'spaced out')
  assert.equal(sanitizeNickname('Bob<script>'), 'Bobscript')
  assert.equal(sanitizeNickname('emoji 🎉 here'), 'emoji here')
  assert.equal(sanitizeNickname('a'.repeat(40)).length, 16)
  assert.equal(sanitizeNickname('🎉🎉🎉'), 'Anonymous')
  assert.equal(sanitizeNickname(''), 'Anonymous')
  assert.equal(sanitizeNickname(undefined), 'Anonymous')
  assert.equal(sanitizeNickname(42), 'Anonymous')
  assert.equal(sanitizeNickname('ok_name-1'), 'ok_name-1')
})

test('a submitted nickname is sanitized before it reaches the board', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    const res = await h.call('POST', '/v1/daily/20000/score', {
      body: run({ nickname: '<img src=x>' }),
      token,
    })
    assert.equal(res.json.best.nickname, 'img srcx')
    const board = await h.call('GET', '/v1/daily/20000')
    assert.equal(board.json.top[0].nickname, 'img srcx')
  } finally { await h.close() }
})

test('parseDay only accepts a plausible integer', () => {
  assert.equal(parseDay('0'), 0)
  assert.equal(parseDay('20000'), 20000)
  assert.equal(parseDay('999999'), 999999)
  assert.equal(parseDay('1000000'), null)
  assert.equal(parseDay('-1'), null)
  assert.equal(parseDay('1.5'), null)
  assert.equal(parseDay(''), null)
})

test('the board ranks by score then wave and caps at 50', async () => {
  const h = await harness()
  try {
    const now = Date.now()
    for (let i = 0; i < 60; i++) {
      const acct = h.store.create('{}')
      h.store.submitDaily({
        day: 20000, accountId: acct.id, nickname: `P${i}`, seed: 1, ruleset: 2,
        wave: i, lives: 1, won: false, score: i * 10, replay: null,
      }, now + i)
    }
    const res = await h.call('GET', '/v1/daily/20000')
    assert.equal(res.status, 200)
    assert.equal(res.json.day, 20000)
    assert.equal(res.json.total, 60)
    assert.equal(res.json.top.length, 50)
    assert.deepEqual(res.json.top[0], { rank: 1, nickname: 'P59', wave: 59, score: 590, won: false })
    assert.equal(res.json.top[49].rank, 50)
    assert.equal('you' in res.json, false)
  } finally { await h.close() }
})

test('a token adds the caller own placing to the board', async () => {
  const h = await harness()
  try {
    const mine = await account(h)
    for (const score of [9000, 8000]) {
      const acct = h.store.create('{}')
      h.store.submitDaily({
        day: 20000, accountId: acct.id, nickname: 'Rival', seed: 1, ruleset: 2,
        wave: 5, lives: 1, won: false, score, replay: null,
      })
    }
    await h.call('POST', '/v1/daily/20000/score', { body: run({ score: 100, nickname: 'Me' }), token: mine })
    const res = await h.call('GET', '/v1/daily/20000', { token: mine })
    assert.deepEqual(res.json.you, { rank: 3, wave: 10, score: 100, nickname: 'Me' })
    assert.equal(res.json.total, 3)
  } finally { await h.close() }
})

test('a replay is retained, and an oversized one is refused', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    const ok = await h.call('POST', '/v1/daily/20000/score', {
      body: run({ replay: { inputs: [1, 2, 3] } }),
      token,
    })
    assert.equal(ok.status, 200)

    const huge = await h.call('POST', '/v1/daily/20000/score', {
      body: run({ score: 2000, replay: { inputs: 'x'.repeat(33 * 1024) } }),
      token,
    })
    assert.equal(huge.status, 413)
    // the refused submission left the earlier best untouched
    const board = await h.call('GET', '/v1/daily/20000', { token })
    assert.equal(board.json.you.score, 1000)
    assert.equal(board.json.total, 1)
  } finally { await h.close() }
})

test('health does not leak the account count', async () => {
  const h = await harness()
  try {
    await account(h)
    const res = await h.call('GET', '/health')
    assert.equal(res.status, 200)
    assert.deepEqual(res.json, { ok: true })
  } finally { await h.close() }
})
