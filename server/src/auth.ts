import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Store } from './db.ts'

export interface GoogleConfig {
  clientId: string
  clientSecret: string
  callbackUrl: string
  returnUrls: string[]
  /** Test transport seam; production always uses Google's fixed HTTPS endpoints. */
  fetch?: typeof fetch
}

export function googleFromEnv(env: NodeJS.ProcessEnv): GoogleConfig | undefined {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return undefined
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackUrl: env.GOOGLE_CALLBACK_URL ?? 'https://blockhold-sync.fly.dev/v1/auth/google/callback',
    returnUrls: (env.AUTH_RETURN_URLS ?? 'https://aj8uppal.github.io/blockhold/').split(',').map(s => s.trim()).filter(Boolean),
  }
}

const random = () => randomBytes(32).toString('base64url')
const digest = (v: string) => createHash('sha256').update(v).digest('base64url')
const PROOF = /^[A-Za-z0-9_-]{43}$/
interface Flow { returnUrl: string, challenge: string, providerVerifier: string, accountId: string | null }
interface Completion extends Flow { subject: string }

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Bearer sessions avoid requiring third-party cookies between Pages and Fly. */
export async function handleAuth(
  req: IncomingMessage, res: ServerResponse, url: URL, store: Store,
  cfg: GoogleConfig | undefined, allowedOrigins: string[], readBody: () => Promise<unknown>, token: string | null,
): Promise<boolean> {
  if (!url.pathname.startsWith('/v1/auth/')) return false
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'no-referrer')
  const route = `${req.method} ${url.pathname}`
  if (route === 'GET /v1/auth/providers') {
    send(res, 200, { google: !!cfg }); return true
  }
  if (route === 'GET /v1/auth/session') {
    const account = token ? store.byToken(token) : null
    send(res, account ? 200 : 401, account ? { provider: store.providerFor(account.id) } : { error: 'Sign in again to sync.' })
    return true
  }
  // Mutation endpoints are only usable by the configured game origins.
  if (req.method === 'POST' && (!req.headers.origin || !allowedOrigins.includes(req.headers.origin))) {
    send(res, 403, { error: 'Origin not allowed.' }); return true
  }
  if (route === 'POST /v1/auth/logout') {
    if (token) store.revokeSession(token)
    send(res, 200, { ok: true }); return true
  }
  if (!cfg) { send(res, 503, { error: 'Google sign-in is not configured yet. Your progress stays on this device.' }); return true }
  if (route === 'POST /v1/auth/google/start') {
    const ip = String(req.headers['fly-client-ip'] ?? req.socket.remoteAddress ?? 'unknown')
    if (!store.takeToken('auth', store.ipHash(ip), 20, 3_600_000)) { send(res, 429, { error: 'Please try again later.' }); return true }
    const body = await readBody() as Record<string, unknown>
    if (!body || typeof body.returnUrl !== 'string' || !cfg.returnUrls.includes(body.returnUrl)
      || new URL(body.returnUrl).origin !== req.headers.origin
      || typeof body.challenge !== 'string' || !PROOF.test(body.challenge)) {
      send(res, 400, { error: 'Invalid sign-in request.' }); return true
    }
    const account = token ? store.byToken(token) : null
    if (token && !account) { send(res, 401, { error: 'Sign in again to sync.' }); return true }
    const state = random()
    const providerVerifier = random()
    store.putAuth(state, 'google', { returnUrl: body.returnUrl, challenge: body.challenge, providerVerifier, accountId: account?.id ?? null }, 10 * 60_000)
    const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorization.search = new URLSearchParams({
      client_id: cfg.clientId, redirect_uri: cfg.callbackUrl, response_type: 'code', scope: 'openid',
      state, code_challenge: digest(providerVerifier), code_challenge_method: 'S256', prompt: 'select_account',
    }).toString()
    send(res, 200, { url: authorization.href }); return true
  }
  if (route === 'GET /v1/auth/google/callback') {
    const state = url.searchParams.get('state') ?? ''
    const raw = PROOF.test(state) ? store.takeAuth(state, 'google') : null
    if (!raw) { send(res, 400, { error: 'Sign-in expired or already used. Return to Blockhold and try again.' }); return true }
    const flow = JSON.parse(raw) as Flow
    const destination = new URL(flow.returnUrl)
    try {
      const code = url.searchParams.get('code')
      if (!code || code.length > 4096 || url.searchParams.has('error')) throw new Error('cancelled')
      const request = cfg.fetch ?? fetch
      const response = await request('https://oauth2.googleapis.com/token', {
        method: 'POST', signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret,
          redirect_uri: cfg.callbackUrl, grant_type: 'authorization_code', code, code_verifier: flow.providerVerifier }),
      })
      if (!response.ok) throw new Error('exchange failed')
      const tokens = await response.json() as { access_token?: unknown }
      if (typeof tokens.access_token !== 'string' || !tokens.access_token) throw new Error('missing token')
      // Only trust identity received directly from Google using the server-exchanged token.
      // No email-based matching and no client-supplied ID token claims are accepted.
      const userResponse = await request('https://openidconnect.googleapis.com/v1/userinfo', {
        signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (!userResponse.ok) throw new Error('identity failed')
      const user = await userResponse.json() as { sub?: unknown }
      if (typeof user.sub !== 'string' || !user.sub || user.sub.length > 255) throw new Error('invalid identity')
      const completion = random()
      store.putAuth(completion, 'completion', { ...flow, subject: user.sub }, 60_000)
      destination.hash = new URLSearchParams({ blockhold_auth: completion }).toString()
    } catch {
      destination.hash = 'blockhold_auth_error=Sign-in+was+cancelled+or+could+not+finish.+Please+try+again.'
    }
    res.writeHead(303, { Location: destination.href }); res.end(); return true
  }
  if (route === 'POST /v1/auth/exchange') {
    const body = await readBody() as Record<string, unknown>
    if (!body || typeof body.code !== 'string' || !PROOF.test(body.code)
      || typeof body.verifier !== 'string' || !PROOF.test(body.verifier)) {
      send(res, 400, { error: 'Invalid sign-in proof.' }); return true
    }
    const raw = store.takeAuth(body.code, 'completion')
    const flow = raw ? JSON.parse(raw) as Completion : null
    if (!flow || digest(body.verifier) !== flow.challenge || new URL(flow.returnUrl).origin !== req.headers.origin) {
      send(res, 400, { error: 'Sign-in expired or could not be verified. Please try again.' }); return true
    }
    // Linking happens only after the originating browser proves possession of its verifier.
    try {
      const result = store.signInIdentity('google', flow.subject, flow.accountId)
      send(res, 200, { token: result.token, provider: 'google', save: JSON.parse(result.account.save) })
    } catch (e) {
      if (!(e instanceof Error) || e.message !== 'account conflict') throw e
      send(res, 409, { error: 'This Google account is already connected to another save. Sign out on this device, then sign in with Google; your local progress will be kept and synced.' })
    }
    return true
  }
  send(res, 404, { error: 'Not found.' }); return true
}
