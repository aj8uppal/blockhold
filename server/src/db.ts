import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'

/**
 * Storage for cloud saves.
 *
 * SQLite on a single small machine, because the whole dataset is one small
 * JSON blob per player and this is a browser tower defense, not a bank. Node
 * 24 ships SQLite in core, so the service has no dependencies at all.
 *
 * There is no personal data here by design: an account is a random token and
 * a progress blob. Nobody's email is stored because none is ever collected.
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
    `)
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

  close(): void { this.db.close() }
}
