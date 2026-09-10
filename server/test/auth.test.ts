import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { harness, type Harness } from './helpers.ts'
import { googleFromEnv, type GoogleConfig } from '../src/auth.ts'

const origin = 'http://localhost:5173'
const returnUrl = origin + '/blockhold/'
const verifier = () => randomBytes(32).toString('base64url')
const digest = (v: string) => createHash('sha256').update(v).digest('base64url')
const google: GoogleConfig = {
  clientId: 'test-client', clientSecret: 'test-secret', callbackUrl: 'https://sync.example/v1/auth/google/callback', returnUrls: [returnUrl],
  fetch: async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      const body = init?.body as URLSearchParams
      assert.equal(body.get('client_secret'), 'test-secret')
      assert.equal(body.get('redirect_uri'), google.callbackUrl)
      assert.match(body.get('code_verifier') ?? '', /^[A-Za-z0-9_-]{43}$/)
      if (body.get('code') === 'failure') return new Response('{}', { status: 400 })
      return Response.json({ access_token: body.get('code') })
    }
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo')
    const subject = (init?.headers as Record<string, string>).Authorization.slice(7)
    return Response.json({ sub: subject })
  },
}

async function post(h: Harness, path: string, body: unknown = {}, token?: string, from = origin) {
  const response = await fetch(h.base + path, {
    method: 'POST', headers: { Origin: from, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: response.status, json: await response.json() as any }
}
async function start(h: Harness, token?: string) {
  const proof = verifier()
  const out = await post(h, '/v1/auth/google/start', { returnUrl, challenge: digest(proof) }, token)
  assert.equal(out.status, 200)
  const url = new URL(out.json.url)
  assert.equal(url.origin, 'https://accounts.google.com')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('scope'), 'openid')
  return { proof, state: url.searchParams.get('state')! }
}
async function callback(h: Harness, state: string, subject = 'alice') {
  return fetch(`${h.base}/v1/auth/google/callback?state=${state}&code=${subject}`, { redirect: 'manual' })
}
async function signIn(h: Harness, subject = 'alice', token?: string) {
  const flow = await start(h, token)
  const result = await callback(h, flow.state, subject)
  assert.equal(result.status, 303)
  const destination = new URL(result.headers.get('location')!)
  const code = new URLSearchParams(destination.hash.slice(1)).get('blockhold_auth')
  assert.ok(code)
  return post(h, '/v1/auth/exchange', { code, verifier: flow.proof })
}

test('provider configuration is honest and secrets are never returned', async () => {
  assert.equal(googleFromEnv({}), undefined)
  assert.equal(googleFromEnv({ GOOGLE_CLIENT_ID: 'id' }), undefined)
  const h = await harness()
  try {
    assert.deepEqual((await h.call('GET', '/v1/auth/providers')).json, { google: false })
    assert.equal((await post(h, '/v1/auth/google/start')).status, 503)
  } finally { await h.close() }
})

test('Google signs in across devices with distinct revocable sessions and preserves progress', async () => {
  const h = await harness({ google })
  try {
    const first = await signIn(h)
    assert.equal(first.status, 200)
    assert.equal(first.json.provider, 'google')
    const account = h.store.byToken(first.json.token)!
    await h.call('PUT', '/v1/save', { token: first.json.token, body: { save: { stars: { '0': 3 }, xp: 987, updatedAt: 123 } } })
    const second = await signIn(h)
    assert.equal(second.status, 200)
    assert.notEqual(first.json.token, second.json.token)
    assert.equal(h.store.byToken(second.json.token)!.id, account.id)
    assert.equal(second.json.save.xp, 987)
    assert.equal(second.json.save.stars['0'], 3)
    assert.equal((await post(h, '/v1/auth/logout', {}, first.json.token)).status, 200)
    assert.equal(h.store.byToken(first.json.token), null)
    assert.ok(h.store.byToken(second.json.token))
    assert.equal(h.store.count(), 1)
  } finally { await h.close() }
})

test('linking an authenticated legacy account preserves its ID, token, recovery code and save', async () => {
  const h = await harness({ google })
  try {
    const legacy = h.store.create(JSON.stringify({ xp: 2468, honors: ['earned'], heroPaths: { bastion: 'warden' } }))
    const flow = await start(h, legacy.token)
    const cb = await callback(h, flow.state)
    assert.equal(h.store.providerFor(legacy.id), null, 'callback must not link before browser proof')
    const code = new URLSearchParams(new URL(cb.headers.get('location')!).hash.slice(1)).get('blockhold_auth')
    const linked = await post(h, '/v1/auth/exchange', { code, verifier: flow.proof })
    assert.equal(linked.status, 200)
    assert.equal(h.store.byToken(linked.json.token)!.id, legacy.id)
    assert.equal(linked.json.save.xp, 2468)
    assert.deepEqual(linked.json.save.honors, ['earned'])
    assert.equal(h.store.tokenForLinkCode(legacy.linkCode), legacy.token)
    assert.ok(h.store.byToken(legacy.token))
  } finally { await h.close() }
})

test('identity collisions never merge or replace ownership', async () => {
  const h = await harness({ google })
  try {
    const alice = await signIn(h)
    const legacy = h.store.create('{"xp":99}')
    const collision = await signIn(h, 'alice', legacy.token)
    assert.equal(collision.status, 409)
    assert.equal(h.store.providerFor(legacy.id), null)
    assert.equal(JSON.parse(h.store.byToken(legacy.token)!.save).xp, 99)
    const switchAccount = await signIn(h, 'bob', alice.json.token)
    assert.equal(switchAccount.status, 409)
    assert.equal(h.store.count(), 2)
  } finally { await h.close() }
})

test('state and completion are single use; wrong browser proof cannot sign in', async () => {
  const h = await harness({ google })
  try {
    assert.equal((await callback(h, verifier())).status, 400)
    const flow = await start(h)
    const response = await callback(h, flow.state)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const destination = new URL(response.headers.get('location')!)
    assert.equal(destination.origin + destination.pathname, returnUrl)
    assert.equal(destination.search, '')
    const code = new URLSearchParams(destination.hash.slice(1)).get('blockhold_auth')
    assert.equal((await callback(h, flow.state)).status, 400)
    assert.equal((await post(h, '/v1/auth/exchange', { code, verifier: verifier() })).status, 400)
    assert.equal((await post(h, '/v1/auth/exchange', { code, verifier: flow.proof })).status, 400)
    assert.equal(h.store.count(), 0)
    const fresh = await start(h)
    const good = await callback(h, fresh.state)
    const goodCode = new URLSearchParams(new URL(good.headers.get('location')!).hash.slice(1)).get('blockhold_auth')
    assert.equal((await post(h, '/v1/auth/exchange', { code: goodCode, verifier: fresh.proof })).status, 200)
    assert.equal((await post(h, '/v1/auth/exchange', { code: goodCode, verifier: fresh.proof })).status, 400)
  } finally { await h.close() }
})

test('expired flows, untrusted origins, arbitrary redirects and invalid old tokens are rejected', async () => {
  const h = await harness({ google })
  try {
    const state = verifier()
    h.store.putAuth(state, 'google', {}, -1)
    assert.equal((await callback(h, state)).status, 400)
    const challenge = digest(verifier())
    assert.equal((await post(h, '/v1/auth/google/start', { returnUrl, challenge }, undefined, 'https://evil.example')).status, 403)
    for (const url of ['https://evil.example/', returnUrl + '?next=evil', returnUrl + '#evil']) {
      assert.equal((await post(h, '/v1/auth/google/start', { returnUrl: url, challenge })).status, 400)
    }
    assert.equal((await post(h, '/v1/auth/google/start', { returnUrl, challenge }, verifier())).status, 401)
  } finally { await h.close() }
})

test('provider failure returns a safe error without creating an identity', async () => {
  const h = await harness({ google })
  try {
    const flow = await start(h)
    const response = await callback(h, flow.state, 'failure')
    assert.equal(response.status, 303)
    const location = response.headers.get('location')!
    assert.ok(location.startsWith(returnUrl + '#blockhold_auth_error='))
    assert.ok(!location.includes('test-secret'))
    assert.equal(h.store.count(), 0)
  } finally { await h.close() }
})

test('Google-linked accounts survive retention while legacy retention remains unchanged', async () => {
  const h = await harness({ google })
  try {
    const legacy = h.store.create('{}')
    const signedIn = await signIn(h)
    const linkedId = h.store.byToken(signedIn.json.token)!.id
    h.store.write(legacy.id, '{}', 1)
    h.store.write(linkedId, '{"xp":500}', 1)
    h.store.sweep()
    assert.equal(h.store.byToken(legacy.token), null)
    assert.equal(JSON.parse(h.store.byToken(signedIn.json.token)!.save).xp, 500)
  } finally { await h.close() }
})

test('provider PKCE uses the verifier belonging to the original authorization request', async () => {
  let challenge = ''
  const checked: GoogleConfig = { ...google, fetch: async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      const fields = init?.body as URLSearchParams
      assert.equal(digest(fields.get('code_verifier')!), challenge)
    }
    return google.fetch!(url, init)
  } }
  const h = await harness({ google: checked })
  try {
    const proof = verifier()
    const begin = await post(h, '/v1/auth/google/start', { returnUrl, challenge: digest(proof) })
    const url = new URL(begin.json.url)
    challenge = url.searchParams.get('code_challenge')!
    assert.notEqual(challenge, digest(proof), 'provider and browser proofs are independent')
    assert.equal((await callback(h, url.searchParams.get('state')!)).status, 303)
  } finally { await h.close() }
})

test('missing or failed provider identity cannot create an account', async () => {
  for (const response of [() => new Response('{}', { status: 401 }), () => Response.json({ email: 'unverified@example.com' })]) {
    const h = await harness({ google: { ...google, fetch: async (url, init) =>
      url === 'https://openidconnect.googleapis.com/v1/userinfo' ? response() : google.fetch!(url, init) } })
    try {
      const flow = await start(h)
      const result = await callback(h, flow.state)
      assert.ok(result.headers.get('location')!.includes('blockhold_auth_error='))
      assert.equal(h.store.count(), 0)
    } finally { await h.close() }
  }
})

test('session expiration retains Google account progress and permits signing in again', async () => {
  const h = await harness({ google })
  try {
    const before = await signIn(h)
    const id = h.store.byToken(before.json.token)!.id
    h.store.write(id, '{"xp":888}', Date.now())
    h.store.sweep(Date.now() + 31 * 86_400_000)
    assert.equal(h.store.byToken(before.json.token), null)
    const after = await signIn(h)
    assert.equal(after.status, 200)
    assert.equal(after.json.save.xp, 888)
    assert.equal(h.store.byToken(after.json.token)!.id, id)
  } finally { await h.close() }
})
