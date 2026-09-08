import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'

/**
 * Co-op rooms: a relay and a metronome, nothing more.
 *
 * Blockhold's battle is a deterministic fixed-step simulation - seeded RNG,
 * sixty ticks a second, and every decision a player makes is already a small
 * command (build this on plot 12, call the wave). So co-op is lockstep: every
 * player runs the whole simulation, and only commands travel. This service
 * does two things to make that hold:
 *
 *   1. it puts every message from every seat into one total order (`seq`) and
 *      broadcasts it to all seats over Server-Sent Events;
 *   2. it keeps time. Every TURN_MS it emits a turn marker saying how many
 *      ticks that turn is worth (twelve at 1x, twenty-four at 2x, none while
 *      paused). A command arriving during turn n is stamped for turn n+1, and
 *      every client applies it exactly when it reaches that turn - the same
 *      tick everywhere, whatever the network did in between.
 *
 * SSE and plain POSTs rather than WebSockets so the service stays dependency-
 * free and any proxy passes it. Rooms live in memory: they are minutes long,
 * and a machine restart simply ends them.
 */

export const TURN_MS = 200
export const TICKS_PER_TURN = 12
const MAX_SEATS = 4
const ROOM_TTL_MS = 2 * 3_600_000
const EMPTY_TTL_MS = 10 * 60_000
const MAX_ROOMS = 500
/** per seat: enough for a frantic player, not for a loop */
const SEND_LIMIT = 40
const SEND_WINDOW_MS = 1000
const MAX_PAYLOAD = 4096

interface Seat {
  key: string
  res: ServerResponse | null
  lastSeen: number
  sent: { n: number, until: number }
}

interface Room {
  code: string
  createdAt: number
  touchedAt: number
  seats: Map<number, Seat>
  setup: unknown
  started: boolean
  ended: boolean
  seq: number
  turn: number
  speed: number
  paused: boolean
  timer: ReturnType<typeof setInterval> | null
}

const rooms = new Map<string, Room>()

/** a five-letter code without the letters people misread */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
function newCode(): string {
  for (;;) {
    let code = ''
    const bytes = randomBytes(5)
    for (let i = 0; i < 5; i++) code += ALPHABET[bytes[i] % ALPHABET.length]
    if (!rooms.has(code)) return code
  }
}

function broadcast(room: Room, msg: Record<string, unknown>): void {
  const line = `data: ${JSON.stringify({ seq: ++room.seq, ...msg })}\n\n`
  for (const seat of room.seats.values()) {
    if (!seat.res) continue
    try { seat.res.write(line) } catch { /* a dead stream is dropped on close */ }
  }
}

function presence(room: Room): { seats: number, connected: number[] } {
  return { seats: room.seats.size, connected: [...room.seats.entries()].filter(([, s]) => s.res).map(([n]) => n) }
}

function startMetronome(room: Room): void {
  if (room.timer) return
  room.timer = setInterval(() => {
    if (room.ended) { stopRoom(room); return }
    room.turn++
    broadcast(room, { type: 'turn', n: room.turn, ticks: room.paused ? 0 : TICKS_PER_TURN * room.speed })
  }, TURN_MS)
}

function stopRoom(room: Room): void {
  if (room.timer) { clearInterval(room.timer); room.timer = null }
}

function closeRoom(room: Room): void {
  stopRoom(room)
  for (const seat of room.seats.values()) {
    try { seat.res?.end() } catch { /* already gone */ }
    seat.res = null
  }
  rooms.delete(room.code)
}

/** rooms nobody has touched, or that everyone has left, are let go */
export function sweepRooms(now = Date.now()): number {
  let n = 0
  for (const room of rooms.values()) {
    const anyone = [...room.seats.values()].some(s => s.res)
    if (now - room.touchedAt > ROOM_TTL_MS || (!anyone && now - room.touchedAt > EMPTY_TTL_MS) || room.ended) {
      closeRoom(room); n++
    }
  }
  return n
}

/** test seam */
export function resetRooms(): void {
  for (const room of rooms.values()) closeRoom(room)
}

export function roomCount(): number { return rooms.size }

const ROOM_PATH = /^\/v1\/coop\/rooms\/([A-Z0-9]{5})\/(join|events|send)$/

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function seatOf(room: Room, url: URL, body: Record<string, unknown> | null): [number, Seat] | null {
  const raw = body?.seat ?? url.searchParams.get('seat')
  const key = body?.key ?? url.searchParams.get('key')
  const n = typeof raw === 'number' ? raw : Number(raw)
  const seat = room.seats.get(n)
  if (!seat || typeof key !== 'string' || key !== seat.key) return null
  return [n, seat]
}

/**
 * The co-op routes. Returns false when the request is not one of them, so
 * the caller can fall through to the rest of the service.
 */
export async function handleCoop(
  req: IncomingMessage, res: ServerResponse, url: URL, readBody: () => Promise<unknown>,
): Promise<boolean> {
  const route = `${req.method} ${url.pathname}`
  if (route === 'POST /v1/coop/rooms') {
    sweepRooms()
    if (rooms.size >= MAX_ROOMS) { send(res, 503, { error: 'too many rooms' }); return true }
    const room: Room = {
      code: newCode(), createdAt: Date.now(), touchedAt: Date.now(), seats: new Map(),
      setup: null, started: false, ended: false, seq: 0, turn: 0, speed: 1, paused: false, timer: null,
    }
    const key = randomBytes(12).toString('base64url')
    room.seats.set(0, { key, res: null, lastSeen: Date.now(), sent: { n: 0, until: 0 } })
    rooms.set(room.code, room)
    send(res, 201, { code: room.code, seat: 0, key, turnMs: TURN_MS, ticksPerTurn: TICKS_PER_TURN })
    return true
  }
  const m = ROOM_PATH.exec(url.pathname)
  if (!m) return false
  const room = rooms.get(m[1])
  if (!room) { send(res, 404, { error: 'no such room' }); return true }
  room.touchedAt = Date.now()
  const action = m[2]

  if (action === 'join' && req.method === 'POST') {
    if (room.started) { send(res, 409, { error: 'already started' }); return true }
    if (room.seats.size >= MAX_SEATS) { send(res, 409, { error: 'room is full' }); return true }
    const seat = room.seats.size
    const key = randomBytes(12).toString('base64url')
    room.seats.set(seat, { key, res: null, lastSeen: Date.now(), sent: { n: 0, until: 0 } })
    broadcast(room, { type: 'presence', ...presence(room) })
    send(res, 200, { code: room.code, seat, key, setup: room.setup, turnMs: TURN_MS, ticksPerTurn: TICKS_PER_TURN, ...presence(room) })
    return true
  }

  if (action === 'events' && req.method === 'GET') {
    const who = seatOf(room, url, null)
    if (!who) { send(res, 403, { error: 'bad seat' }); return true }
    const [n, seat] = who
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(': hello\n\n')
    if (seat.res && seat.res !== res) { try { seat.res.end() } catch { /* replaced */ } }
    seat.res = res
    seat.lastSeen = Date.now()
    // the newcomer's own picture of the room, then everyone learns they are here
    res.write(`data: ${JSON.stringify({ seq: room.seq, type: 'hello', seat: n, setup: room.setup, started: room.started, turn: room.turn, speed: room.speed, paused: room.paused, ...presence(room) })}\n\n`)
    broadcast(room, { type: 'presence', ...presence(room) })
    const keepalive = setInterval(() => { try { res.write(': ping\n\n') } catch { /* closing */ } }, 15_000)
    req.on('close', () => {
      clearInterval(keepalive)
      if (seat.res === res) seat.res = null
      room.touchedAt = Date.now()
      broadcast(room, { type: 'presence', ...presence(room) })
    })
    return true
  }

  if (action === 'send' && req.method === 'POST') {
    const body = (await readBody()) as Record<string, unknown>
    const who = seatOf(room, url, body)
    if (!who) { send(res, 403, { error: 'bad seat' }); return true }
    const [n, seat] = who
    const now = Date.now()
    if (seat.sent.until <= now) seat.sent = { n: 0, until: now + SEND_WINDOW_MS }
    if (++seat.sent.n > SEND_LIMIT) { send(res, 429, { error: 'slow down' }); return true }
    const type = body.type
    const payload = body.payload
    if (JSON.stringify(payload ?? null).length > MAX_PAYLOAD) { send(res, 413, { error: 'payload too large' }); return true }
    switch (type) {
      case 'cmd': {
        if (!room.started) { send(res, 409, { error: 'not started' }); return true }
        // stamped for the turn after the one in progress: every client applies
        // it when its own clock reaches that turn, and not a tick sooner
        broadcast(room, { type: 'cmd', seat: n, turn: room.turn + 1, cmd: payload })
        break
      }
      case 'setup': {
        if (n !== 0) { send(res, 403, { error: 'host only' }); return true }
        room.setup = payload
        broadcast(room, { type: 'setup', setup: payload })
        break
      }
      case 'start': {
        if (n !== 0) { send(res, 403, { error: 'host only' }); return true }
        if (!room.started) {
          room.started = true
          room.turn = 0
          room.setup = payload ?? room.setup
          broadcast(room, { type: 'start', setup: room.setup })
          startMetronome(room)
        }
        break
      }
      case 'speed': {
        const s = payload === 2 ? 2 : 1
        room.speed = s
        broadcast(room, { type: 'speed', speed: s, seat: n })
        break
      }
      case 'pause': {
        room.paused = !!payload
        broadcast(room, { type: 'pause', on: room.paused, seat: n })
        break
      }
      case 'hash':
      case 'chat':
      case 'ping': {
        broadcast(room, { type, seat: n, payload })
        break
      }
      case 'end': {
        room.ended = true
        broadcast(room, { type: 'end', seat: n })
        stopRoom(room)
        break
      }
      default:
        send(res, 400, { error: 'unknown type' }); return true
    }
    send(res, 202, { ok: true, turn: room.turn })
    return true
  }
  send(res, 405, { error: 'method not allowed' })
  return true
}
