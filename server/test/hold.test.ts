import { test } from 'node:test'
import assert from 'node:assert/strict'
import { harness, account } from './helpers.ts'
import { blankHold } from '../../src/core/holdData.ts'

test('cloud persists the atomic Hold layout through older clients and later daily results', async () => {
  const h = await harness()
  try {
    const token = await account(h)
    const hold = { ...blankHold(), name: 'Cedar Watch', placements: [{ id: 'tree:0', x: 1, z: 1, r: 2 }], updatedAt: 200 }
    const first = await h.call('PUT', '/v1/save', { token, body: { save: { hold, dailyBest: { day: 1, wave: 16, won: true, score: 200 } } } })
    assert.equal(first.status, 200)
    const second = await h.call('PUT', '/v1/save', { token, body: { save: { xp: 1000, updatedAt: 900, dailyBest: { day: 2, wave: 1, won: false, score: 5 } } } })
    assert.equal(second.json.save.hold.name, 'Cedar Watch')
    assert.equal(second.json.save.hold.dailyWon, true)
    assert.deepEqual(second.json.save.hold.placements, hold.placements)
    await h.call('PUT', '/v1/save', { token, body: { save: { hold: { ...hold, name: 'Stale', updatedAt: 100 }, updatedAt: 1000 } } })
    const saved = await h.call('GET', '/v1/save', { token })
    assert.equal(saved.json.save.hold.name, 'Cedar Watch')
    assert.equal(saved.json.save.xp, 1000)
  } finally { await h.close() }
})
