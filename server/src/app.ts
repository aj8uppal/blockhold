import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { Store, type DailyScore, type EventIn } from './db.ts'
import { mergeSaves, sanitizeCloudSave } from '../../src/core/saveMerge.ts'

/**
 * Blockhold cloud saves, telemetry and the daily leaderboard.
 *
 * No dependencies, no personal data. An account is a random token a device
 * holds and a short link code the player can type on another device. Nobody
 * signs up, nobody enters an email, and there is nothing here worth breaching.
 *
 * Progress is merged rather than overwritten - see src/core/saveMerge.ts for
 * why last-write-wins would quietly delete a player's afternoon.
 *
 * The routing lives here rather than in index.ts so a test can stand the whole
 * service up against a temporary database on an ephemeral port, without an
 * HTTP framework and without reaching into private state.
 */

const MAX_BODY = 64 * 1024

/**
 * The version of the rules a daily run was played under.
 *
 * A leaderboard is only comparable within one set of rules. Bump this
 * whenever a balance change would make old scores incomparable - tower costs,
 * wave composition, scoring - and submissions from a client still running the
 * old rules are refused with a 409 rather than silently mixed in.
 */
export const RULESET_VERSION = 2

const MAX_EVENTS_PER_REQUEST = 64
const MAX_EVENT_PAYLOAD = 2048
const MAX_REPLAY_BYTES = 32 * 1024
const TOP_N = 50

/** the shared per-IP ceiling: enough to stop a loop, not a security boundary */
const RATE_LIMIT = 60
const RATE_WINDOW = 60_000

const HOUR = 3_600_000

/**
 * The tight buckets, all persisted in SQLite rather than in a Map.
 *
 * These are the calls that cost something to absorb - a row that lives
 * forever, or a name on a public board - so their budgets have to survive the
 * machine suspending, which it does whenever nobody is playing.
 */
const BUCKETS = {
  /** an account is a permanent row; five a hour from one address is generous */
  account: { limit: 5, window: HOUR },
  /** telemetry is anonymous and unauthenticated, so it gets the least trust */
  events: { limit: 20, window: HOUR },
  /** a score submission is cheap but public; a run takes minutes to play */
  daily: { limit: 30, window: HOUR },
} as const

export interface AppConfig {
  /** origins allowed to call this. The game is static, so it is not same-origin. */
  allowedOrigins: string[]
  /**
   * Bearer token for GET /v1/stats. With this unset the endpoint answers 404
   * exactly like a route that does not exist, so a forgotten deploy cannot
   * quietly publish the dashboard - and cannot advertise that it is there.
   */
  statsToken: string | null
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    allowedOrigins: (env.ALLOWED_ORIGINS
      ?? 'https://aj8uppal.github.io,http://localhost:5173,http://localhost:4173')
      .split(',').map(s => s.trim()).filter(Boolean),
    statsToken: env.STATS_TOKEN && env.STATS_TOKEN.length >= 16 ? env.STATS_TOKEN : null,
  }
}

/**
 * The coarse in-memory limiter, in front of everything.
 *
 * It is deliberately not persisted: it exists to keep one client from
 * spinning, and a per-request write for that would cost more than the abuse.
 */
const hits = new Map<string, { n: number, until: number }>()
const MAX_TRACKED = 10_000

/**
 * Drop what has expired, and only then, if the map is still full, the entries
 * closest to expiring.
 *
 * The obvious `hits.clear()` is worse than no limiter at all under load: the
 * map only reaches its cap when traffic is heavy, which is exactly when a
 * clear hands every caller - including whoever filled it - a fresh budget.
 * That turns the ceiling into a metronome an abuser can drive.
 */
function evict(now: number): void {
  for (const [k, v] of hits) if (v.until <= now) hits.delete(k)
  if (hits.size <= MAX_TRACKED) return
  const byExpiry = [...hits.entries()].sort((a, b) => a[1].until - b[1].until)
  for (let i = 0; i < byExpiry.length - MAX_TRACKED; i++) hits.delete(byExpiry[i][0])
}

export function rateLimited(ip: string, now = Date.now()): boolean {
  const rec = hits.get(ip)
  if (rec && rec.until > now) {
    rec.n++
    return rec.n > RATE_LIMIT
  }
  hits.set(ip, { n: 1, until: now + RATE_WINDOW })
  if (hits.size > MAX_TRACKED) evict(now)
  return false
}

/** test seam: the limiter is module state, and a test needs a clean slate */
export function resetRateLimiter(): void { hits.clear() }

function cors(req: IncomingMessage, res: ServerResponse, cfg: AppConfig): void {
  const origin = req.headers.origin
  if (origin && cfg.allowedOrigins.includes(origin)) {
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

// --- telemetry validation ----------------------------------------------------

const EVENT_TYPE = /^[a-z][a-z0-9_.-]{0,31}$/
const MAX_EVENT_KEYS = 16

/**
 * Reduce one client-supplied object to a type and a flat payload.
 *
 * Anything that is not a scalar is dropped rather than stored. Telemetry is
 * unauthenticated, so without this the endpoint is free unbounded storage for
 * whoever finds it, and a nested blob is also a payload the dashboard's
 * json_extract queries could never read anyway.
 */
export function sanitizeEvent(v: unknown): EventIn | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const type = typeof o.type === 'string' ? o.type.trim().toLowerCase() : ''
  if (!EVENT_TYPE.test(type)) return null

  let session: string | null = null
  if (typeof o.session === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(o.session)) session = o.session

  const payload: Record<string, string | number | boolean | null> = {}
  let n = 0
  for (const [k, val] of Object.entries(o)) {
    if (k === 'type' || k === 'session') continue
    if (n >= MAX_EVENT_KEYS) break
    if (k.length > 32 || !/^[A-Za-z0-9_.]+$/.test(k)) continue
    if (typeof val === 'string') payload[k] = val.slice(0, 128)
    else if (typeof val === 'number') payload[k] = Number.isFinite(val) ? val : 0
    else if (typeof val === 'boolean' || val === null) payload[k] = val
    else continue
    n++
  }
  const text = JSON.stringify(payload)
  // already bounded by the key and value caps above; this is the backstop
  if (text.length > MAX_EVENT_PAYLOAD) return null
  return { type, session, payload: text }
}

// --- leaderboard validation --------------------------------------------------

/**
 * A day index, the same integer the game uses for its daily seed.
 *
 * "Plausible" means an integer inside the range the game can actually
 * produce - roughly 1970 through the next few centuries - not a date that
 * exists. A number outside it is a bug or a probe, and either way it should
 * not become a row.
 */
const MAX_DAY = 999_999

export function parseDay(raw: string): number | null {
  if (!/^\d{1,6}$/.test(raw)) return null
  const day = Number(raw)
  return Number.isInteger(day) && day >= 0 && day <= MAX_DAY ? day : null
}

const NICKNAME_OK = /[^A-Za-z0-9 _-]/g

/**
 * Nicknames are shown to other players, so they are stripped rather than
 * rejected: a player who types an emoji should still get on the board, just
 * without it. Anything left empty falls back to Anonymous.
 */
export function sanitizeNickname(v: unknown): string {
  if (typeof v !== 'string') return 'Anonymous'
  const cleaned = v.replace(NICKNAME_OK, '').replace(/\s+/g, ' ').trim().slice(0, 16)
  return cleaned.length ? cleaned : 'Anonymous'
}

function int(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const n = Math.round(v)
  return n >= min && n <= max ? n : null
}

function topRow(row: DailyScore, rank: number) {
  return { rank, nickname: row.nickname, wave: row.wave, score: row.score, won: row.won }
}

const DAILY_SCORE = /^\/v1\/daily\/(\d{1,6})\/score$/
const DAILY_BOARD = /^\/v1\/daily\/(\d{1,6})$/

export function createApp(store: Store, cfg: AppConfig): Server {
  return createServer(async (req, res) => {
    cors(req, res, cfg)
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const ip = String(req.headers['fly-client-ip'] ?? req.socket.remoteAddress ?? 'unknown')
    if (rateLimited(ip)) { send(res, 429, { error: 'slow down' }); return }
    const ipHash = store.ipHash(ip)

    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = `${req.method} ${url.pathname}`

    /** spend from one of the persisted buckets, or answer 429 */
    const take = (bucket: keyof typeof BUCKETS): boolean => {
      const b = BUCKETS[bucket]
      if (store.takeToken(bucket, ipHash, b.limit, b.window)) return true
      send(res, 429, { error: 'slow down' })
      return false
    }

    try {
      // deliberately says nothing but that the process is up. The account
      // count it used to return is a business metric on an unauthenticated
      // endpoint - free intelligence for nobody's benefit.
      if (route === 'GET /health') {
        send(res, 200, { ok: true })
        return
      }

      // create an account. The device's existing local progress comes with it,
      // so a player who has been playing offline loses nothing by signing up.
      if (route === 'POST /v1/account') {
        if (!take('account')) return
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

      // anonymous telemetry. No account, no token: the client that sends this
      // may never have signed up, and asking it to would make the numbers
      // describe the players who signed up rather than the players.
      if (route === 'POST /v1/events') {
        if (!take('events')) return
        const body = await readBody(req) as { events?: unknown }
        if (!Array.isArray(body.events)) { send(res, 400, { error: 'events must be an array' }); return }
        if (body.events.length > MAX_EVENTS_PER_REQUEST) {
          send(res, 400, { error: `at most ${MAX_EVENTS_PER_REQUEST} events per request` })
          return
        }
        // a malformed event is dropped, not a 400: a telemetry client that
        // gets an error will retry, and a retry loop over a bad event is a
        // worse outage than a missing datapoint
        const clean = body.events.map(sanitizeEvent).filter((e): e is EventIn => e !== null)
        store.insertEvents(clean, ipHash)
        send(res, 202, { accepted: clean.length, rejected: body.events.length - clean.length })
        return
      }

      // the dashboard. Aggregates only, and invisible without its token.
      if (route === 'GET /v1/stats') {
        if (!cfg.statsToken || bearer(req) !== cfg.statsToken) { send(res, 404, { error: 'not found' }); return }
        send(res, 200, { ok: true, ...store.stats(7) })
        return
      }

      // the public board. A token is optional here and only adds the caller's
      // own placing, so a player can see where they stand without one.
      const board = DAILY_BOARD.exec(url.pathname)
      if (req.method === 'GET' && board) {
        const day = parseDay(board[1])
        if (day === null) { send(res, 400, { error: 'bad day' }); return }
        const top = store.dailyTop(day, TOP_N).map((row, i) => topRow(row, i + 1))
        const t = bearer(req)
        const acct = t ? store.byToken(t) : null
        const mine = acct ? store.daily(day, acct.id) : null
        send(res, 200, {
          day,
          total: store.dailyTotal(day),
          top,
          ...(mine
            ? {
                you: {
                  rank: store.dailyRank(day, acct!.id),
                  wave: mine.wave,
                  score: mine.score,
                  nickname: mine.nickname,
                },
              }
            : {}),
        })
        return
      }

      const t = bearer(req)
      const acct = t ? store.byToken(t) : null
      if (!acct) { send(res, 401, { error: 'unknown account' }); return }

      /**
       * Submit a daily result.
       *
       * What this checks is plausibility, not truth. The numbers are bounded,
       * the ruleset has to match, and the replay is kept verbatim - but the run
       * is NOT re-simulated here, so a determined client can still report a
       * score it did not earn. This is a filter against casual tampering and a
       * record for later, not an anti-cheat guarantee, and the board should be
       * read that way.
       *
       * The real check is re-simulation: replay the stored inputs against the
       * seed and confirm the reported wave and score fall out. That needs the
       * simulation to run headless, without the renderer, which it currently
       * cannot. Storing the replay now is what makes it possible to go back and
       * verify - or quietly drop - every score already on the board once it can.
       */
      const submit = DAILY_SCORE.exec(url.pathname)
      if (req.method === 'POST' && submit) {
        if (!take('daily')) return
        const day = parseDay(submit[1])
        if (day === null) { send(res, 400, { error: 'bad day' }); return }
        const body = await readBody(req) as Record<string, unknown>

        const ruleset = int(body.ruleset, 0, 9999)
        if (ruleset === null) { send(res, 400, { error: 'bad ruleset' }); return }
        if (ruleset !== RULESET_VERSION) {
          // a stale client's numbers are not comparable with today's, so the
          // honest answer is to refuse and let it tell the player to reload
          send(res, 409, { error: 'ruleset mismatch', expected: RULESET_VERSION, got: ruleset })
          return
        }

        const seed = int(body.seed, 0, Number.MAX_SAFE_INTEGER)
        const wave = int(body.wave, 0, 999)
        const lives = int(body.lives, 0, 99)
        const score = int(body.score, 0, 99_999_999)
        if (seed === null || wave === null || lives === null || score === null) {
          send(res, 400, { error: 'bad score' })
          return
        }

        let replay: string | null = null
        if (body.replay !== undefined && body.replay !== null) {
          replay = JSON.stringify(body.replay)
          if (Buffer.byteLength(replay, 'utf8') > MAX_REPLAY_BYTES) {
            send(res, 413, { error: 'replay too large' })
            return
          }
        }

        const { best } = store.submitDaily({
          day,
          accountId: acct.id,
          nickname: sanitizeNickname(body.nickname),
          seed,
          ruleset,
          wave,
          lives,
          won: !!body.won,
          score,
          replay,
        })
        send(res, 200, {
          rank: store.dailyRank(day, acct.id),
          total: store.dailyTotal(day),
          best: {
            day: best.day,
            nickname: best.nickname,
            seed: best.seed,
            ruleset: best.ruleset,
            wave: best.wave,
            lives: best.lives,
            won: best.won,
            score: best.score,
          },
        })
        return
      }

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
}
