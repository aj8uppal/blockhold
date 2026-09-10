import { RULESET_VERSION } from '../game/ruleset.ts'
import type { BattleSession } from '../game/session.ts'
import type { Difficulty, HeroId } from '../game/types.ts'

/**
 * The client half of co-op: one room, one seat, one event stream.
 *
 * The battle is lockstep (see server/src/coop.ts): every player runs the
 * whole simulation and only commands travel. This class owns the room
 * membership and the stream; the Game owns the clock discipline - it advances
 * only as far as the server's turn markers allow, and applies each turn's
 * commands at that turn's first tick.
 */

const ROOM_KEY = 'blockhold.coop.seat.v1'
const ROOM_TTL = 2 * 60 * 60 * 1000
interface SavedSeat { code: string, seat: number, key: string, expiresAt: number }

const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '')

const apiUrl = (path: string) => `${API}${path}${path.includes('?') ? '&' : '?'}ruleset=${RULESET_VERSION}&paced=1`
const REFRESH_MESSAGE = 'This game version cannot join the room. Refresh Blockhold and try again.'

export { coopEnabled, inviteCodeFromUrl } from './coopLink.ts'

/** what the host chooses, and what everyone starts from */
export interface CoopSetup {
  levelId: string
  difficulty: Difficulty
  hero: HeroId
  seed: number
  mode?: 'campaign' | 'endless'
  battle?: BattleSession
  startPaused?: boolean
  /** the host's Armory and ladder, so both boards play by the same loadout */
  loadout: { armory: Record<string, number>, xp: number, honors?: string[], heroPaths?: Record<string, string> }
}

export type CoopEvent =
  | { type: 'hello', seat: number, setup: CoopSetup | null, started: boolean, turn: number, speed: number, paused: boolean, seats: number, connected: number[] }
  | { type: 'presence', seats: number, connected: number[] }
  | { type: 'setup', setup: CoopSetup }
  | { type: 'start', setup: CoopSetup, preparing?: boolean }
  | { type: 'turn', n: number, ticks: number }
  | { type: 'cmd', seat: number, turn: number, cmd: unknown }
  | { type: 'speed', speed: number, seat: number }
  | { type: 'pause', on: boolean, seat: number }
  | { type: 'hash', seat: number, payload: { turn: number, h: number } }
  | { type: 'chat', seat: number, payload: string }
  | { type: 'end', seat: number }
  | { type: 'caughtup', seq: number }
  | { type: 'connection', connected: boolean }

export class CoopSession {
  private stream: AbortController | null = null
  private lastRememberedAt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  replayEvents: CoopEvent[] = []
  replaySeq = 0
  paused = false
  speed: 1 | 2 = 1
  private listeners = new Set<(e: CoopEvent) => void>()
  seats = 1
  connected: number[] = []
  setup: CoopSetup | null = null
  started = false
  /** the stream dropped and could not be reopened */
  lost = false

  private constructor(
    readonly code: string,
    readonly seat: number,
    private readonly key: string,
    readonly turnMs: number,
    readonly ticksPerTurn: number,
    readonly paced = false,
  ) { this.remember() }

  get isHost(): boolean { return this.seat === 0 }

  static async create(): Promise<CoopSession> {
    const r = await fetch(apiUrl(`/v1/coop/rooms`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (r.status === 409) throw new Error(REFRESH_MESSAGE)
    if (!r.ok) throw new Error(`could not open a room (${r.status})`)
    const j = await r.json()
    return new CoopSession(j.code, j.seat, j.key, j.turnMs, j.ticksPerTurn, j.paced === true)
  }

  static async join(code: string): Promise<CoopSession> {
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
    if (this.savedRoom() === clean) return this.resume(clean)
    const r = await fetch(apiUrl(`/v1/coop/rooms/${clean}/join`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (r.status === 404) throw new Error('No room with that code')
    if (r.status === 409) { const error = await r.json(); throw new Error(error.error === 'room is full' ? 'That room is full' : REFRESH_MESSAGE) }
    if (r.status === 410) throw new Error('That battle can no longer be joined')
    if (!r.ok) throw new Error(`could not join (${r.status})`)
    const j = await r.json()
    const s = new CoopSession(j.code, j.seat, j.key, j.turnMs, j.ticksPerTurn, j.paced === true)
    s.adopt(j)
    return s
  }

  private remember(): void {
    this.lastRememberedAt = Date.now()
    try { localStorage.setItem(ROOM_KEY, JSON.stringify({ code: this.code, seat: this.seat, key: this.key, expiresAt: Date.now() + ROOM_TTL })) } catch { /* play without reload recovery */ }
  }

  private static saved(): SavedSeat | null {
    try {
      const seat = JSON.parse(localStorage.getItem(ROOM_KEY) ?? 'null') as SavedSeat | null
      if (seat && /^[A-Z0-9]{5}$/.test(seat.code) && Number.isInteger(seat.seat) && seat.seat >= 0 && seat.seat < 4
        && /^[A-Za-z0-9_-]{16}$/.test(seat.key) && seat.expiresAt > Date.now()) return seat
    } catch { /* corrupt or blocked storage */ }
    return null
  }

  static savedRoom(): string | null { return this.saved()?.code ?? null }

  static async resume(code?: string): Promise<CoopSession> {
    const saved = this.saved()
    if (!saved || (code && saved.code !== code)) throw new Error('No saved seat on this device.')
    const response = await fetch(apiUrl(`/v1/coop/rooms/${saved.code}/resume`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seat: saved.seat, key: saved.key }),
    })
    if (!response.ok) {
      if (response.status === 409) throw new Error(REFRESH_MESSAGE)
      if ([403, 404, 410].includes(response.status)) { try { localStorage.removeItem(ROOM_KEY) } catch {} }
      throw new Error(response.status === 404 ? 'That room has expired. Open a new room to play again.' : 'That saved seat could not be recovered.')
    }
    const data = await response.json()
    const session = new CoopSession(saved.code, saved.seat, saved.key, data.turnMs, data.ticksPerTurn, data.paced === true)
    session.adopt(data)
    return session
  }

  private adopt(data: { seats: number, connected: number[], setup: CoopSetup | null, started?: boolean, history?: CoopEvent[], seq?: number, paused?: boolean, speed?: number }): void {
    this.seats = data.seats; this.connected = data.connected; this.setup = data.setup
    this.started = !!data.started; this.replayEvents = data.history ?? []; this.replaySeq = data.seq ?? 0
    this.paused = !!data.paused; this.speed = data.speed === 2 ? 2 : 1
  }

  /** Explicitly leaving forgets the private seat; closing a stream alone preserves reload recovery. */
  forget(): void {
    if (CoopSession.saved()?.code !== this.code) return
    try { localStorage.removeItem(ROOM_KEY) } catch {}
  }

  /** the link a friend opens to land straight in this room */
  shareUrl(): string {
    const u = new URL(location.href)
    u.search = ''
    u.hash = ''
    u.searchParams.set('coop', this.code)
    return u.toString()
  }

  on(fn: (e: CoopEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  connect(): void {
    if (this.stream) return
    const controller = new AbortController()
    this.stream = controller
    const emit = (event: CoopEvent) => { for (const listener of this.listeners) listener(event) }
    const read = async () => {
      try {
        // Credentials stay in headers; invitations and request URLs contain only the room code and seat index.
        const response = await fetch(apiUrl(`/v1/coop/rooms/${this.code}/events?seat=${this.seat}&after=${this.replaySeq}`), {
          headers: { Authorization: `Bearer ${this.key}` }, signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          if ([403, 404, 409, 410].includes(response.status)) { this.lost = true; if (response.status !== 409) this.forget(); controller.abort(); emit({ type: 'connection', connected: false }); return }
          throw new Error('Stream unavailable')
        }
        this.lost = false
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += decoder.decode(chunk.value, { stream: true })
          let boundary: number
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const packet = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
            const line = packet.split('\n').find(value => value.startsWith('data: '))
            if (!line) continue
            const msg = JSON.parse(line.slice(6)) as CoopEvent & { seq?: number }
            if (msg.type === 'hello') {
              this.seats = msg.seats; this.connected = msg.connected; this.setup = msg.setup; this.started = msg.started
              this.paused = msg.paused; this.speed = msg.speed === 2 ? 2 : 1
              // Keep the replay cursor unchanged: ordered historical events still follow hello.
            } else if (msg.type === 'caughtup') {
              this.replaySeq = Math.max(this.replaySeq, msg.seq)
              this.remember()
              emit({ type: 'connection', connected: true })
            } else {
              if (msg.seq !== undefined && msg.seq <= this.replaySeq) continue
              if (msg.seq !== undefined) this.replaySeq = msg.seq
              if (msg.type === 'presence') { this.seats = msg.seats; this.connected = msg.connected }
              if (msg.type === 'setup') this.setup = msg.setup
              if (msg.type === 'start') { this.setup = msg.setup; this.started = true; this.paused = !!(msg.preparing || msg.setup?.startPaused || msg.setup?.battle) }
              if (msg.type === 'pause') this.paused = msg.on
              if (msg.type === 'speed') this.speed = msg.speed === 2 ? 2 : 1
              if (msg.type === 'end') this.forget()
            }
            if (Date.now() - this.lastRememberedAt > 60_000) this.remember()
            emit(msg)
          }
        }
      } catch { /* transient network loss reconnects from the last delivered sequence */ }
      if (!controller.signal.aborted) {
        emit({ type: 'connection', connected: false })
        this.reconnectTimer = setTimeout(() => { void read() }, 1200)
      }
    }
    void read()
  }

  async send(type: string, payload?: unknown): Promise<boolean> {
    try {
      const r = await fetch(apiUrl(`/v1/coop/rooms/${this.code}/send`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat: this.seat, key: this.key, type, payload }),
        // Large adopted journals exceed the browser's keepalive upload quota.
        keepalive: type !== 'start' && type !== 'setup',
      })
      return r.ok
    } catch {
      return false
    }
  }

  close(forget = false): void {
    this.stream?.abort()
    this.stream = null
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (forget) this.forget()
    this.listeners.clear()
  }

}
