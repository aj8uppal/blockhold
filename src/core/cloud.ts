import type { SaveData } from './save.ts'
import { mergeSaves, sanitizeCloudSave, type CloudSave } from './saveMerge.ts'

/**
 * Cloud saves, from the game's side.
 *
 * Progress lived only in localStorage, which one cache clear, one private
 * window or one new phone would erase - and there was no way to carry a
 * campaign from a laptop to a phone at all.
 *
 * Two rules shape this:
 *
 *   It never blocks play. Every call is best-effort and fails silently into
 *   local-only mode. A player with no network, a blocked request or a server
 *   that is down gets exactly the game they had before, immediately.
 *
 *   It never overwrites. Progress is merged both ways, so a device that has
 *   been offline contributes what it earned instead of clobbering or being
 *   clobbered. See saveMerge.ts.
 */

const TOKEN_KEY = 'blockhold.cloud.token'
const CODE_KEY = 'blockhold.cloud.code'
const TIMEOUT = 6000

/** where the sync service lives; empty disables cloud saves entirely */
const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '')

export interface CloudStatus {
  enabled: boolean
  signedIn: boolean
  linkCode: string | null
  lastError: string | null
  lastSyncedAt: number | null
}

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function writeLocal(key: string, v: string): void {
  try { localStorage.setItem(key, v) } catch { /* private mode */ }
}
function dropLocal(key: string): void {
  try { localStorage.removeItem(key) } catch { /* nothing to drop */ }
}

/** the syncable half of a save; device settings stay on the device */
export function toCloud(save: SaveData, updatedAt = Date.now()): CloudSave {
  return sanitizeCloudSave({
    unlocked: save.unlocked,
    stars: save.stars,
    armory: save.armory,
    bestEndless: save.bestEndless,
    bestScore: save.bestScore,
    medals: save.medals,
    lastHero: save.lastHero,
    dailyBest: save.dailyBest,
    updatedAt,
  })
}

/** fold a cloud copy back into the local save, leaving device settings alone */
export function applyCloud(save: SaveData, cloud: CloudSave): SaveData {
  return {
    ...save,
    unlocked: cloud.unlocked,
    stars: cloud.stars,
    armory: cloud.armory,
    bestEndless: cloud.bestEndless,
    bestScore: cloud.bestScore,
    medals: cloud.medals,
    lastHero: cloud.lastHero,
    dailyBest: cloud.dailyBest,
  }
}

export class Cloud {
  private token: string | null = readLocal(TOKEN_KEY)
  private code: string | null = readLocal(CODE_KEY)
  private lastError: string | null = null
  private lastSyncedAt: number | null = null
  private inFlight = false

  get enabled(): boolean { return API.length > 0 }
  get signedIn(): boolean { return this.enabled && !!this.token }

  status(): CloudStatus {
    return {
      enabled: this.enabled,
      signedIn: this.signedIn,
      linkCode: this.code,
      lastError: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
    }
  }

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
    try {
      const res = await fetch(`${API}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
      })
      if (res.status === 401) {
        // the account is gone or the token was revoked: fall back to local
        this.signOut()
        throw new Error('This device is no longer linked.')
      }
      if (!res.ok) throw new Error(`Sync failed (${res.status})`)
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  /** start syncing, carrying whatever this device has already earned */
  async createAccount(save: SaveData): Promise<CloudStatus> {
    if (!this.enabled) return this.status()
    try {
      const out = await this.call('/v1/account', {
        method: 'POST',
        body: JSON.stringify({ save: toCloud(save) }),
      }) as { token: string, linkCode: string }
      this.token = out.token
      this.code = out.linkCode
      writeLocal(TOKEN_KEY, out.token)
      writeLocal(CODE_KEY, out.linkCode)
      this.lastError = null
      this.lastSyncedAt = Date.now()
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : 'Sync unavailable'
    }
    return this.status()
  }

  /** adopt an existing account on this device using its link code */
  async linkDevice(linkCode: string): Promise<{ ok: boolean, save?: CloudSave, error?: string }> {
    if (!this.enabled) return { ok: false, error: 'Cloud saves are not enabled.' }
    try {
      const res = await fetch(`${API}/v1/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkCode }),
      })
      if (res.status === 404) return { ok: false, error: 'That code does not match an account.' }
      if (!res.ok) return { ok: false, error: `Could not link (${res.status})` }
      const out = await res.json() as { token: string, save: unknown }
      this.token = out.token
      writeLocal(TOKEN_KEY, out.token)
      const cloud = sanitizeCloudSave(out.save)
      this.lastError = null
      this.lastSyncedAt = Date.now()
      return { ok: true, save: cloud }
    } catch {
      return { ok: false, error: 'Could not reach the sync service.' }
    }
  }

  /**
   * Push local progress and take back the merged result. Returns the save to
   * adopt, or null when nothing could be synced - in which case the caller
   * carries on with exactly what it had.
   */
  async sync(save: SaveData): Promise<SaveData | null> {
    if (!this.signedIn || this.inFlight) return null
    this.inFlight = true
    try {
      const out = await this.call('/v1/save', {
        method: 'PUT',
        body: JSON.stringify({ save: toCloud(save) }),
      }) as { save: unknown }
      const merged = sanitizeCloudSave(out.save)
      this.lastError = null
      this.lastSyncedAt = Date.now()
      // merge locally too, so anything earned during the round trip survives
      return applyCloud(save, mergeSaves(toCloud(save), merged))
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : 'Sync unavailable'
      return null
    } finally {
      this.inFlight = false
    }
  }

  /** pull the current link code, refreshing it from the server if needed */
  async refreshLinkCode(): Promise<string | null> {
    if (!this.signedIn) return null
    try {
      const out = await this.call('/v1/save') as { linkCode?: string }
      if (out.linkCode) { this.code = out.linkCode; writeLocal(CODE_KEY, out.linkCode) }
      return this.code
    } catch {
      return this.code
    }
  }

  /** invalidate a code that has been shared too widely */
  async rotateLinkCode(): Promise<string | null> {
    if (!this.signedIn) return null
    try {
      const out = await this.call('/v1/link/rotate', { method: 'POST' }) as { linkCode: string }
      this.code = out.linkCode
      writeLocal(CODE_KEY, out.linkCode)
      return out.linkCode
    } catch {
      return null
    }
  }

  /** stop syncing this device. Local progress is untouched. */
  signOut(): void {
    this.token = null
    this.code = null
    dropLocal(TOKEN_KEY)
    dropLocal(CODE_KEY)
  }
}

export const cloud = new Cloud()
