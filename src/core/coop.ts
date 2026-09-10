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

const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '')

export function coopEnabled(): boolean { return API.length > 0 }

/** what the host chooses, and what everyone starts from */
export interface CoopSetup {
  levelId: string
  difficulty: Difficulty
  hero: HeroId
  seed: number
  /** the host's Armory and ladder, so both boards play by the same loadout */
  loadout: { armory: Record<string, number>, xp: number, honors?: string[], heroPaths?: Record<string, string> }
}

export type CoopEvent =
  | { type: 'hello', seat: number, setup: CoopSetup | null, started: boolean, turn: number, speed: number, paused: boolean, seats: number, connected: number[] }
  | { type: 'presence', seats: number, connected: number[] }
  | { type: 'setup', setup: CoopSetup }
  | { type: 'start', setup: CoopSetup }
  | { type: 'turn', n: number, ticks: number }
  | { type: 'cmd', seat: number, turn: number, cmd: unknown }
  | { type: 'speed', speed: number, seat: number }
  | { type: 'pause', on: boolean, seat: number }
  | { type: 'hash', seat: number, payload: { turn: number, h: number } }
  | { type: 'chat', seat: number, payload: string }
  | { type: 'end', seat: number }

export class CoopSession {
  private es: EventSource | null = null
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
  ) {}

  get isHost(): boolean { return this.seat === 0 }

  static async create(): Promise<CoopSession> {
    const r = await fetch(`${API}/v1/coop/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (!r.ok) throw new Error(`could not open a room (${r.status})`)
    const j = await r.json()
    return new CoopSession(j.code, j.seat, j.key, j.turnMs, j.ticksPerTurn)
  }

  static async join(code: string): Promise<CoopSession> {
    const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
    const r = await fetch(`${API}/v1/coop/rooms/${clean}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    if (r.status === 404) throw new Error('No room with that code')
    if (r.status === 409) throw new Error((await r.json()).error === 'room is full' ? 'That room is full' : 'That battle has already begun')
    if (!r.ok) throw new Error(`could not join (${r.status})`)
    const j = await r.json()
    const s = new CoopSession(j.code, j.seat, j.key, j.turnMs, j.ticksPerTurn)
    s.seats = j.seats
    s.connected = j.connected
    s.setup = j.setup
    return s
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
    if (this.es) return
    const url = `${API}/v1/coop/rooms/${this.code}/events?seat=${this.seat}&key=${encodeURIComponent(this.key)}`
    const es = new EventSource(url)
    this.es = es
    es.onmessage = ev => {
      let msg: CoopEvent
      try { msg = JSON.parse(ev.data) } catch { return }
      switch (msg.type) {
        case 'hello':
          this.seats = msg.seats; this.connected = msg.connected; this.setup = msg.setup; this.started = msg.started
          break
        case 'presence':
          this.seats = msg.seats; this.connected = msg.connected
          break
        case 'setup':
          this.setup = msg.setup
          break
        case 'start':
          this.setup = msg.setup; this.started = true
          break
      }
      for (const fn of this.listeners) fn(msg)
    }
    // EventSource reconnects on its own; the server replays nothing, so a long
    // drop mid-battle is a desync and the Game says so when the hashes disagree
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) this.lost = true
    }
  }

  async send(type: string, payload?: unknown): Promise<boolean> {
    try {
      const r = await fetch(`${API}/v1/coop/rooms/${this.code}/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seat: this.seat, key: this.key, type, payload }),
        keepalive: true,
      })
      return r.ok
    } catch {
      return false
    }
  }

  close(): void {
    this.es?.close()
    this.es = null
    this.listeners.clear()
  }
}

/** a `?coop=CODE` on the URL is an invitation; read it once and clear it */
export function inviteCodeFromUrl(): string | null {
  const u = new URL(location.href)
  const code = u.searchParams.get('coop')
  if (!code) return null
  u.searchParams.delete('coop')
  history.replaceState(null, '', u.toString())
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || null
}
