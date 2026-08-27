import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Store } from './db.ts'
import { mergeSaves, sanitizeCloudSave } from '../../src/core/saveMerge.ts'

/**
 * Blockhold cloud saves.
 *
 * Five endpoints, no dependencies, no personal data. An account is a random
 * token a device holds and a short link code the player can type on another
 * device. Nobody signs up, nobody enters an email, and there is nothing here
 * worth breaching.
 *
 * Progress is merged rather than overwritten - see src/core/saveMerge.ts for
 * why last-write-wins would quietly delete a player's afternoon.
 */

const PORT = Number(process.env.PORT ?? 8080)
const DB_PATH = process.env.DB_PATH ?? './blockhold.db'
const MAX_BODY = 64 * 1024

/** origins allowed to call this. The game is static, so it is not same-origin. */
const ALLOWED = (process.env.ALLOWED_ORIGINS
  ?? 'https://aj8uppal.github.io,http://localhost:5173,http://localhost:4173')
  .split(',').map(s => s.trim()).filter(Boolean)

const store = new Store(DB_PATH)

/** crude per-IP limiter: enough to stop a loop, not a security boundary */
const hits = new Map<string, { n: number, until: number }>()
const RATE_LIMIT = 60
const RATE_WINDOW = 60_000

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = hits.get(ip)
  if (!rec || rec.until < now) {
    hits.set(ip, { n: 1, until: now + RATE_WINDOW })
    if (hits.size > 10_000) hits.clear()   // never grow without bound
    return false
  }
  rec.n++
  return rec.n > RATE_LIMIT
}

function cors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(text)
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0
    let over = false
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      if (over) return
      size += c.length
      if (size > MAX_BODY) {
        // drain rather than destroy: the caller deserves a status code, not a
        // dropped socket it has to guess about
        over = true
        chunks.length = 0
        req.resume()
        reject(new Error('body too large'))
        return
      }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new Error('bad json')) }
    })
    req.on('error', reject)
  })
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return null
  const t = h.slice(7).trim()
  return t.length >= 16 && t.length <= 128 ? t : null
}

const server = createServer(async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const ip = String(req.headers['fly-client-ip'] ?? req.socket.remoteAddress ?? 'unknown')
  if (rateLimited(ip)) { send(res, 429, { error: 'slow down' }); return }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const route = `${req.method} ${url.pathname}`

  try {
    if (route === 'GET /health') {
      send(res, 200, { ok: true, accounts: store.count() })
      return
    }

    // create an account. The device's existing local progress comes with it,
    // so a player who has been playing offline loses nothing by signing up.
    if (route === 'POST /v1/account') {
      const body = await readBody(req) as { save?: unknown }
      const save = sanitizeCloudSave(body.save ?? {})
      save.updatedAt = save.updatedAt || Date.now()
      const acct = store.create(JSON.stringify(save))
      send(res, 201, { id: acct.id, token: acct.token, linkCode: acct.linkCode, save })
      return
    }

    // hand a link code back for the account's token, so another device joins
    if (route === 'POST /v1/link') {
      const body = await readBody(req) as { linkCode?: unknown }
      const codeIn = typeof body.linkCode === 'string' ? body.linkCode : ''
      if (!/^[0-9A-Za-z-]{4,16}$/.test(codeIn)) { send(res, 400, { error: 'bad link code' }); return }
      const t = store.tokenForLinkCode(codeIn)
      if (!t) { send(res, 404, { error: 'no such link code' }); return }
      const acct = store.byToken(t)!
      send(res, 200, { token: t, save: JSON.parse(acct.save) })
      return
    }

    const t = bearer(req)
    const acct = t ? store.byToken(t) : null
    if (!acct) { send(res, 401, { error: 'unknown account' }); return }

    if (route === 'GET /v1/save') {
      send(res, 200, { save: JSON.parse(acct.save), linkCode: acct.linkCode })
      return
    }

    if (route === 'PUT /v1/save') {
      const body = await readBody(req) as { save?: unknown }
      const incoming = sanitizeCloudSave(body.save ?? {})
      incoming.updatedAt = incoming.updatedAt || Date.now()
      const stored = sanitizeCloudSave(JSON.parse(acct.save))
      const merged = mergeSaves(stored, incoming)
      store.write(acct.id, JSON.stringify(merged), merged.updatedAt)
      // hand the merged copy back so the device adopts anything it was missing
      send(res, 200, { save: merged })
      return
    }

    if (route === 'POST /v1/link/rotate') {
      send(res, 200, { linkCode: store.rotateLinkCode(acct.id) })
      return
    }

    send(res, 404, { error: 'not found' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    // a bad request is the client's problem; anything else is ours, and the
    // detail stays in the logs rather than going back over the wire
    if (msg === 'bad json') { send(res, 400, { error: msg }); return }
    if (msg === 'body too large') { send(res, 413, { error: msg }); return }
    console.error('[blockhold-sync]', e)
    send(res, 500, { error: 'server error' })
  }
})

server.listen(PORT, () => console.log(`[blockhold-sync] listening on ${PORT}`))

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => { store.close(); process.exit(0) })
  })
}
