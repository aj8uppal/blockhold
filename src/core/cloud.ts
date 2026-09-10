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
const PROVIDER_KEY = 'blockhold.cloud.provider'
const PROOF_KEY = 'blockhold.auth.verifier'
const TIMEOUT = 6000

/** where the sync service lives; empty disables cloud saves entirely */
const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '')

export interface CloudStatus {
  enabled: boolean
  signedIn: boolean
  provider: string | null
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

/**
 * The syncable half of a save; device settings stay on the device.
 *
 * `updatedAt` defaults to when the save last changed, not to now, so the
 * "newest wins" fields resolve by when the player made the choice.
 */
export function toCloud(save: SaveData, updatedAt = save.changedAt ?? Date.now()): CloudSave {
  return sanitizeCloudSave({
    unlocked: save.unlocked,
    stars: save.stars,
    armory: save.armory,
    bestEndless: save.bestEndless,
    bestFreeplay: save.bestFreeplay,
    bestScore: save.bestScore,
    medals: save.medals,
    trials: save.trials ?? {},
    capstones: save.capstones ?? [],
    honors: save.honors ?? [],
    heroPaths: save.heroPaths ?? {},
    lastHero: save.lastHero,
    dailyBest: save.dailyBest,
    xp: save.xp,
    xpClaims: save.xpClaims,
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
    bestFreeplay: cloud.bestFreeplay,
    bestScore: cloud.bestScore,
    medals: cloud.medals,
    trials: cloud.trials ?? {},
    capstones: cloud.capstones ?? [],
    honors: cloud.honors ?? [],
    heroPaths: cloud.heroPaths ?? {},
    lastHero: cloud.lastHero,
    dailyBest: cloud.dailyBest,
    xp: Math.max(save.xp, cloud.xp),
    xpClaims: cloud.xpClaims ?? save.xpClaims,
  }
}

export class Cloud {
  private token: string | null = readLocal(TOKEN_KEY)
  private code: string | null = readLocal(CODE_KEY)
  private provider: string | null = readLocal(PROVIDER_KEY)
  private authVersion = 0
  private lastError: string | null = null
  private lastSyncedAt: number | null = null
  private inFlight = false

  get enabled(): boolean { return API.length > 0 }
  get signedIn(): boolean { return this.enabled && !!this.token }

  /**
   * The Authorization header for this device, or nothing when it has no token.
   * Exposed so the leaderboard can authenticate as the same anonymous account
   * without a second identity system.
   */
  authHeader(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {}
  }

  status(): CloudStatus {
    return {
      enabled: this.enabled,
      signedIn: this.signedIn,
      provider: this.provider,
      linkCode: this.code,
      lastError: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
    }
  }

  private async call(path: string, init: RequestInit = {}): Promise<unknown> {
    const requestToken = this.token
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
        // The token is no longer accepted. Drop it so this device stops trying,
        // but KEEP the link code: dropping both used to make one bad 401 - a
        // restored volume, a bad migration, a machine booted on the wrong
        // database - permanently unrecoverable, because the code the player
        // needed to link again had been deleted from their device along with
        // the token. Local progress is untouched either way.
        if (this.token === requestToken) this.dropToken()
        throw new Error('Sign in again to sync. Your progress is still on this device.')
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Sync failed (${res.status})`)
      }
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async googleAvailable(): Promise<boolean> {
    if (!this.enabled) return false
    const out = await this.call('/v1/auth/providers') as { google?: boolean }
    return out.google === true
  }

  async refreshIdentity(): Promise<void> {
    if (!this.signedIn) return
    const version = this.authVersion
    try {
      const out = await this.call('/v1/auth/session') as { provider: string | null }
      if (version !== this.authVersion) return
      this.provider = out.provider
      if (this.provider) writeLocal(PROVIDER_KEY, this.provider)
      else dropLocal(PROVIDER_KEY)
    } catch (e) { this.lastError = e instanceof Error ? e.message : 'Sync unavailable' }
  }

  async signInGoogle(): Promise<void> {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const encode = (v: Uint8Array) => btoa(String.fromCharCode(...v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const verifier = encode(bytes)
    // A tab-bound proof keeps a copied redirect from signing somebody else in.
    sessionStorage.setItem(PROOF_KEY, verifier)
    const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
    const out = await this.call('/v1/auth/google/start', {
      method: 'POST', body: JSON.stringify({ challenge, returnUrl: location.origin + location.pathname }),
    }) as { url: string }
    const target = new URL(out.url)
    if (target.origin !== 'https://accounts.google.com') throw new Error('Invalid sign-in destination.')
    location.assign(target.href)
  }

  /** Complete a redirect before normal startup sync, returning the union of both saves. */
  async finishSignIn(save: SaveData): Promise<SaveData | null> {
    const params = new URLSearchParams(location.hash.slice(1))
    const code = params.get('blockhold_auth')
    const error = params.get('blockhold_auth_error')
    if (!code && !error) return null
    history.replaceState(null, '', location.pathname + location.search)
    try {
      const verifier = sessionStorage.getItem(PROOF_KEY)
      sessionStorage.removeItem(PROOF_KEY)
      if (error) throw new Error('Sign-in was cancelled or could not finish. Please try again.')
      if (!verifier) throw new Error('Sign-in must finish in the same browser tab. Please try again.')
      const out = await this.call('/v1/auth/exchange', {
        method: 'POST', body: JSON.stringify({ code, verifier }),
      }) as { token: string, provider: string, save: unknown }
      this.authVersion++
      this.token = out.token
      this.provider = out.provider
      this.code = null
      writeLocal(TOKEN_KEY, out.token)
      writeLocal(PROVIDER_KEY, out.provider)
      dropLocal(CODE_KEY)
      this.lastError = null
      const merged = applyCloud(save, mergeSaves(toCloud(save), sanitizeCloudSave(out.save)))
      return (await this.sync(merged)) ?? merged
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : 'Could not finish sign-in.'
      return null
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
      this.authVersion++
      this.provider = null
      dropLocal(PROVIDER_KEY)
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

  /**
   * Adopt an existing account on this device using its link code.
   *
   * Linking merges, in both directions. The account's progress comes down and
   * this device's progress goes up, so a player who beat three maps here before
   * remembering they had an account keeps those three maps - and the account
   * gains them too. Taking the server copy wholesale, which is what this used
   * to do, silently deleted whatever had been earned on this device first.
   */
  async linkDevice(linkCode: string, save: SaveData): Promise<{ ok: boolean, save?: CloudSave, error?: string }> {
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
      this.authVersion++
      this.provider = null
      dropLocal(PROVIDER_KEY)
      this.token = out.token
      writeLocal(TOKEN_KEY, out.token)
      // the code that got us here is this account's code; remember it so the
      // player is not shown dots on the device they just restored onto
      this.code = linkCode.trim().toUpperCase()
      writeLocal(CODE_KEY, this.code)
      const local = toCloud(save)
      const merged = mergeSaves(local, sanitizeCloudSave(out.save))
      this.lastError = null
      this.lastSyncedAt = Date.now()
      // push the union straight back up so the account is not one device behind
      // until the next sync. Best-effort: the local half is already correct.
      try {
        await this.call('/v1/save', { method: 'PUT', body: JSON.stringify({ save: merged }) })
      } catch { /* the next sync carries it */ }
      return { ok: true, save: merged }
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
    const version = this.authVersion
    try {
      const out = await this.call('/v1/save', {
        method: 'PUT',
        body: JSON.stringify({ save: toCloud(save) }),
      }) as { save: unknown }
      if (version !== this.authVersion) return null
      const merged = sanitizeCloudSave(out.save)
      this.lastError = null
      this.lastSyncedAt = Date.now()
      // merge locally too, so anything earned during the round trip survives
      return applyCloud(save, mergeSaves(toCloud(save), merged))
    } catch (e) {
      if (version === this.authVersion) this.lastError = e instanceof Error ? e.message : 'Sync unavailable'
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
  async signOut(): Promise<void> {
    const request = this.token ? this.call('/v1/auth/logout', { method: 'POST' }).catch(() => null) : Promise.resolve(null)
    this.authVersion++
    this.token = null
    this.provider = null
    this.code = null
    this.lastError = null
    this.lastSyncedAt = null
    dropLocal(TOKEN_KEY)
    dropLocal(PROVIDER_KEY)
    dropLocal(CODE_KEY)
    await request
  }

  /**
   * Stop using a token the server rejected, while keeping the link code.
   *
   * The player did not ask for this, so it must stay recoverable: the code is
   * the only thing that can get the account back.
   */
  private dropToken(): void {
    this.authVersion++
    this.token = null
    dropLocal(TOKEN_KEY)
  }
}

export const cloud = new Cloud()
