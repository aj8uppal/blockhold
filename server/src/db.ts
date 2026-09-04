import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes } from 'node:crypto'

/**
 * Storage for cloud saves, telemetry and the daily leaderboard.
 *
 * SQLite on a single small machine, because the whole dataset is one small
 * JSON blob per player and this is a browser tower defense, not a bank. Node
 * 24 ships SQLite in core, so the service has no dependencies at all.
 *
 * There is no personal data here by design: an account is a random token and
 * a progress blob. Nobody's email is stored because none is ever collected.
 * Telemetry follows the same rule - a raw IP address is never written to
 * disk, only a salted hash of one, and the salt lives in this database so it
 * cannot be recovered from a leaked copy of the events table alone.
 */

export interface Account {
  id: string
  save: string
  updatedAt: number
}

/** the token a device holds, and the code a player types to move devices */
export interface NewAccount {
  id: string
  token: string
  linkCode: string
}

/** one telemetry event as it arrives: a type and a small flat bag of fields */
export interface EventIn {
  type: string
  session: string | null
  payload: string
}

/** a leaderboard submission after validation, ready to store */
export interface DailyScoreIn {
  day: number
  accountId: string
  nickname: string
  seed: number
  ruleset: number
  wave: number
  lives: number
  won: boolean
  score: number
  replay: string | null
}

/** a stored leaderboard row, as handed back to the client */
export interface DailyScore {
  day: number
  nickname: string
  seed: number
  ruleset: number
  wave: number
  lives: number
  won: boolean
  score: number
  createdAt: number
}

/** everything GET /v1/stats reports, all of it aggregate counts */
export interface Stats {
  days: number
  totalEvents: number
  byType: { type: string, count: number }[]
  sessionsPerDay: { day: string, sessions: number }[]
  runEndWaves: { wave: number, count: number }[]
}

// no vowels and no look-alikes: a link code gets read aloud and typed by hand
const CODE_ALPHABET = '23456789ACDEFGHJKLMNPQRTUVWXYZ'

function code(len = 8): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
    if (i === 3) out += '-'
  }
  return out
}

function token(): string {
  return randomBytes(32).toString('base64url')
}

export class Store {
  private db: DatabaseSync
  private salt: string

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 4000;
      CREATE TABLE IF NOT EXISTS accounts (
        id         TEXT PRIMARY KEY,
        token      TEXT NOT NULL UNIQUE,
        link_code  TEXT NOT NULL UNIQUE,
        save       TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS accounts_token ON accounts(token);
      CREATE INDEX IF NOT EXISTS accounts_link ON accounts(link_code);

      -- key/value for the few things the process must not regenerate on a
      -- restart. Right now that is only the IP hashing salt: a fresh salt
      -- would give every returning player a new ip_hash, which would reset
      -- the persisted rate limits and inflate the session counts.
      CREATE TABLE IF NOT EXISTS meta (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      );

      -- anonymous telemetry. No account id and no raw IP: an event is a type,
      -- a small flat payload, and a salted hash used only for rate limiting
      -- and for counting distinct sessions.
      CREATE TABLE IF NOT EXISTS events (
        id          TEXT PRIMARY KEY,
        received_at INTEGER NOT NULL,
        ip_hash     TEXT NOT NULL,
        session     TEXT,
        type        TEXT NOT NULL,
        payload     TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS events_received ON events(received_at);
      CREATE INDEX IF NOT EXISTS events_type ON events(type, received_at);

      -- one row per account per day: the leaderboard keeps a player's best
      -- result, not their history, so a bad run can never push a good one off.
      CREATE TABLE IF NOT EXISTS daily_scores (
        day        INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        nickname   TEXT NOT NULL,
        seed       INTEGER NOT NULL,
        ruleset    INTEGER NOT NULL,
        wave       INTEGER NOT NULL,
        lives      INTEGER NOT NULL,
        won        INTEGER NOT NULL,
        score      INTEGER NOT NULL,
        replay     TEXT,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (day, account_id)
      );
      CREATE INDEX IF NOT EXISTS daily_rank ON daily_scores(day, score DESC, wave DESC, created_at ASC);

      -- rate limit counters live on disk rather than in a Map because this
      -- machine suspends whenever nobody is playing. An in-memory budget
      -- would hand a scripted client a fresh allowance every time Fly parked
      -- the process, which is exactly the interval an abuser would learn.
      CREATE TABLE IF NOT EXISTS rate_limits (
        k            TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        hits         INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rate_limits_window ON rate_limits(window_start);
    `)
    this.salt = this.meta('ip_hash_salt', () => randomBytes(32).toString('base64url'))
  }

  /** read a meta value, creating it from `make` the first time it is needed */
  private meta(k: string, make: () => string): string {
    const row = this.db.prepare('SELECT v FROM meta WHERE k = ?').get(k) as Record<string, unknown> | undefined
    if (row) return String(row.v)
    const v = make()
    this.db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').run(k, v)
    return v
  }

  /**
   * A stable pseudonym for a client address.
   *
   * The raw IP never reaches disk. It is salted with a per-database secret
   * and truncated to 128 bits, which is plenty to key a rate limit bucket and
   * far too little to be worth attacking. Truncation matters: the IPv4 space
   * is small enough to enumerate, so an unsalted or full-length hash would be
   * reversible by anyone who got the file.
   */
  ipHash(ip: string): string {
    return createHash('sha256').update(this.salt).update('\u0000').update(ip).digest('hex').slice(0, 32)
  }

  create(save: string): NewAccount {
    const now = Date.now()
    // a collision on either unique column is astronomically unlikely, but a
    // retry is cheaper than a 500 to a player who just wanted to play
    for (let attempt = 0; attempt < 5; attempt++) {
      const acct = { id: randomBytes(12).toString('hex'), token: token(), linkCode: code() }
      try {
        this.db.prepare(
          'INSERT INTO accounts (id, token, link_code, save, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(acct.id, acct.token, acct.linkCode, save, now, now)
        return acct
      } catch {
        continue
      }
    }
    throw new Error('could not allocate an account')
  }

  byToken(t: string): (Account & { linkCode: string }) | null {
    const row = this.db.prepare(
      'SELECT id, save, updated_at, link_code FROM accounts WHERE token = ?',
    ).get(t) as Record<string, unknown> | undefined
    if (!row) return null
    return {
      id: String(row.id),
      save: String(row.save),
      updatedAt: Number(row.updated_at),
      linkCode: String(row.link_code),
    }
  }

  /** exchange a link code for that account's token, so a new device can join */
  tokenForLinkCode(c: string): string | null {
    const row = this.db.prepare('SELECT token FROM accounts WHERE link_code = ?')
      .get(c.trim().toUpperCase()) as Record<string, unknown> | undefined
    return row ? String(row.token) : null
  }

  write(id: string, save: string, updatedAt: number): void {
    this.db.prepare('UPDATE accounts SET save = ?, updated_at = ? WHERE id = ?').run(save, updatedAt, id)
  }

  /** a fresh code, so a shared one can be revoked */
  rotateLinkCode(id: string): string {
    for (let attempt = 0; attempt < 5; attempt++) {
      const c = code()
      try {
        this.db.prepare('UPDATE accounts SET link_code = ? WHERE id = ?').run(c, id)
        return c
      } catch {
        continue
      }
    }
    throw new Error('could not rotate the link code')
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as Record<string, unknown>
    return Number(row.n)
  }

  // --- rate limiting -------------------------------------------------------

  /**
   * A fixed-window counter, one row per bucket and caller.
   *
   * Returns true when the call is allowed. A fixed window lets a caller spend
   * two windows' worth of budget across a window boundary; that is fine here,
   * because these buckets exist to stop a script hammering account creation,
   * not to meter a paid API.
   */
  takeToken(bucket: string, who: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const k = `${bucket}:${who}`
    const row = this.db.prepare('SELECT window_start, hits FROM rate_limits WHERE k = ?')
      .get(k) as Record<string, unknown> | undefined
    if (row && Number(row.window_start) + windowMs > now) {
      const hits = Number(row.hits) + 1
      this.db.prepare('UPDATE rate_limits SET hits = ? WHERE k = ?').run(hits, k)
      return hits <= limit
    }
    this.db.prepare(
      'INSERT INTO rate_limits (k, window_start, hits) VALUES (?, ?, 1)'
      + ' ON CONFLICT(k) DO UPDATE SET window_start = excluded.window_start, hits = 1',
    ).run(k, now)
    return limit >= 1
  }

  // --- telemetry -----------------------------------------------------------

  /** insert a batch in one transaction: 64 separate commits is 64 fsyncs */
  insertEvents(events: EventIn[], ipHash: string, now = Date.now()): number {
    if (!events.length) return 0
    const stmt = this.db.prepare(
      'INSERT INTO events (id, received_at, ip_hash, session, type, payload) VALUES (?, ?, ?, ?, ?, ?)',
    )
    this.db.exec('BEGIN')
    try {
      for (const e of events) {
        stmt.run(randomBytes(12).toString('hex'), now, ipHash, e.session, e.type, e.payload)
      }
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    return events.length
  }

  /**
   * Aggregate counts for the dashboard. Nothing here returns a single event,
   * a payload or an ip_hash - the endpoint is a scoreboard of totals, so a
   * leaked stats token cannot become a leak of what any one person did.
   */
  stats(days = 7, now = Date.now()): Stats {
    const since = now - days * 86_400_000
    const total = this.db.prepare('SELECT COUNT(*) AS n FROM events WHERE received_at >= ?')
      .get(since) as Record<string, unknown>
    const byType = this.db.prepare(
      'SELECT type, COUNT(*) AS n FROM events WHERE received_at >= ? GROUP BY type ORDER BY n DESC',
    ).all(since) as Record<string, unknown>[]
    // a client that sends no session id still counts as one session per day
    // per address, which is the closest honest answer available
    const sessions = this.db.prepare(
      "SELECT strftime('%Y-%m-%d', received_at / 1000, 'unixepoch') AS d,"
      + ' COUNT(DISTINCT COALESCE(session, ip_hash)) AS n'
      + ' FROM events WHERE received_at >= ? GROUP BY d ORDER BY d',
    ).all(since) as Record<string, unknown>[]
    // json_extract is in core SQLite, so the wave histogram needs no schema
    // column and no migration if the payload shape changes again
    const waves = this.db.prepare(
      "SELECT CAST(json_extract(payload, '$.wave') AS INTEGER) AS w, COUNT(*) AS n"
      + " FROM events WHERE received_at >= ? AND type = 'run_end'"
      + ' AND json_extract(payload, \'$.wave\') IS NOT NULL GROUP BY w ORDER BY w',
    ).all(since) as Record<string, unknown>[]
    return {
      days,
      totalEvents: Number(total.n),
      byType: byType.map(r => ({ type: String(r.type), count: Number(r.n) })),
      sessionsPerDay: sessions.map(r => ({ day: String(r.d), sessions: Number(r.n) })),
      runEndWaves: waves.map(r => ({ wave: Number(r.w), count: Number(r.n) })),
    }
  }

  // --- daily leaderboard ---------------------------------------------------

  /**
   * Keep the account's best result for a day and report where it lands.
   *
   * Best means higher score, and a higher wave breaks a tie. A worse run is
   * discarded rather than stored, so a player cannot lose a good placing by
   * playing again, and the table stays one row per account per day.
   */
  submitDaily(row: DailyScoreIn, now = Date.now()): { best: DailyScore, replaced: boolean } {
    const prev = this.daily(row.day, row.accountId)
    if (prev && (prev.score > row.score || (prev.score === row.score && prev.wave >= row.wave))) {
      return { best: prev, replaced: false }
    }
    this.db.prepare(
      'INSERT INTO daily_scores (day, account_id, nickname, seed, ruleset, wave, lives, won, score, replay, created_at)'
      + ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      + ' ON CONFLICT(day, account_id) DO UPDATE SET'
      + ' nickname = excluded.nickname, seed = excluded.seed, ruleset = excluded.ruleset,'
      + ' wave = excluded.wave, lives = excluded.lives, won = excluded.won, score = excluded.score,'
      + ' replay = excluded.replay, created_at = excluded.created_at',
    ).run(
      row.day, row.accountId, row.nickname, row.seed, row.ruleset,
      row.wave, row.lives, row.won ? 1 : 0, row.score, row.replay, now,
    )
    return { best: this.daily(row.day, row.accountId)!, replaced: true }
  }

  daily(day: number, accountId: string): DailyScore | null {
    const row = this.db.prepare(
      'SELECT day, nickname, seed, ruleset, wave, lives, won, score, created_at'
      + ' FROM daily_scores WHERE day = ? AND account_id = ?',
    ).get(day, accountId) as Record<string, unknown> | undefined
    return row ? toDaily(row) : null
  }

  dailyTotal(day: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM daily_scores WHERE day = ?')
      .get(day) as Record<string, unknown>
    return Number(row.n)
  }

  /**
   * Rank counts the rows that beat this one, using the same score/wave/time
   * ordering as the top list. Sorting by created_at last means two identical
   * results keep distinct ranks and the earlier one places higher, so the
   * list and the rank a player is told can never disagree.
   */
  dailyRank(day: number, accountId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) + 1 AS r FROM daily_scores me, daily_scores other'
      + ' WHERE me.day = ? AND me.account_id = ? AND other.day = me.day'
      + ' AND (other.score > me.score'
      + '   OR (other.score = me.score AND other.wave > me.wave)'
      + '   OR (other.score = me.score AND other.wave = me.wave AND other.created_at < me.created_at))',
    ).get(day, accountId) as Record<string, unknown> | undefined
    return row ? Number(row.r) : 0
  }

  dailyTop(day: number, limit = 50): DailyScore[] {
    const rows = this.db.prepare(
      'SELECT day, nickname, seed, ruleset, wave, lives, won, score, created_at FROM daily_scores'
      + ' WHERE day = ? ORDER BY score DESC, wave DESC, created_at ASC LIMIT ?',
    ).all(day, limit) as Record<string, unknown>[]
    return rows.map(toDaily)
  }

  // --- retention -----------------------------------------------------------

  /**
   * Delete what nobody needs any more.
   *
   * Telemetry past 90 days answers no question this dashboard asks, and an
   * account with no save write in 180 days is a device that was wiped or a
   * player who moved on - keeping either forever turns a service that stores
   * almost nothing into one that stores everything, slowly.
   *
   * Leaderboard rows go with their account, because a name on a board with no
   * account behind it can never be corrected or removed on request.
   */
  sweep(now = Date.now()): { events: number, accounts: number, limits: number } {
    const eventCutoff = now - 90 * 86_400_000
    const acctCutoff = now - 180 * 86_400_000
    this.db.exec('BEGIN')
    try {
      const events = this.db.prepare('DELETE FROM events WHERE received_at < ?').run(eventCutoff)
      this.db.prepare(
        'DELETE FROM daily_scores WHERE account_id IN (SELECT id FROM accounts WHERE updated_at < ?)',
      ).run(acctCutoff)
      const accounts = this.db.prepare('DELETE FROM accounts WHERE updated_at < ?').run(acctCutoff)
      // a counter whose window closed a day ago is not protecting anything
      const limits = this.db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run(now - 86_400_000)
      this.db.exec('COMMIT')
      return {
        events: Number(events.changes),
        accounts: Number(accounts.changes),
        limits: Number(limits.changes),
      }
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  close(): void { this.db.close() }
}

function toDaily(row: Record<string, unknown>): DailyScore {
  return {
    day: Number(row.day),
    nickname: String(row.nickname),
    seed: Number(row.seed),
    ruleset: Number(row.ruleset),
    wave: Number(row.wave),
    lives: Number(row.lives),
    won: Number(row.won) === 1,
    score: Number(row.score),
    createdAt: Number(row.created_at),
  }
}
