import { telemetry, type TelemetryRecord } from './telemetry.ts'
import { safeLocal } from './boot.ts'

/**
 * Where telemetry actually goes.
 *
 * `telemetry.ts` deliberately ships with no destination: it buffers events and
 * hands them to whatever sink is installed. For a long time nothing installed
 * one, so every event the game carefully recorded was written into an array and
 * then dropped on the floor. The instrumentation existed and the evidence did
 * not, which is the worst of both - the cost of the calls without the answer.
 *
 * This is the destination, and it is the game's own sync service rather than a
 * third party. That choice is what keeps the privacy story short: no analytics
 * vendor, no cookies, no advertising identifiers, no cross-site anything. The
 * server stores a salted hash of the IP address and never the address itself.
 *
 * Three rules hold:
 *
 *   It is off unless the player leaves it on. There is a visible control and
 *   the choice persists. Opting out drops the buffer as well as the sink.
 *
 *   It never blocks or breaks play. Failures are swallowed. A batch that
 *   cannot be sent is discarded rather than retried forever.
 *
 *   It carries nothing identifying. The session id below is random, lives in
 *   this tab only, and is never written to storage.
 */

const API = (import.meta.env?.VITE_SYNC_URL ?? '').replace(/\/$/, '')
const CONSENT_KEY = 'blockhold.telemetry'

/**
 * A random id for this session, so a funnel can tell one visit's events apart
 * from another's. Deliberately not persisted: it cannot follow anyone between
 * visits, which is exactly the property that keeps this out of consent-banner
 * territory.
 */
const sessionId = Math.random().toString(36).slice(2, 12)

/** the player's choice; default off, because the honest default is off */
export function telemetryAllowed(): boolean {
  return safeLocal.get(CONSENT_KEY) === 'on'
}

export function setTelemetryAllowed(on: boolean): void {
  safeLocal.set(CONSENT_KEY, on ? 'on' : 'off')
  telemetry.setEnabled(on)
  if (on) installSink()
  else telemetry.setSink(null)
}

/** whether a choice has ever been made, so the game can ask once */
export function telemetryAsked(): boolean {
  const v = safeLocal.get(CONSENT_KEY)
  return v === 'on' || v === 'off'
}

function send(batch: TelemetryRecord[]): void {
  if (!API) return
  // Flatten to what the server accepts: one object per event, scalars only.
  const events = batch.slice(0, 64).map(r => ({
    ...r.event,
    session: sessionId,
    at: r.at,
  }))
  const body = JSON.stringify({ events })
  // `sendBeacon` survives the page being closed, which is when the most
  // interesting event of all - the player leaving - is recorded.
  try {
    if (navigator.sendBeacon?.(`${API}/v1/events`, new Blob([body], { type: 'application/json' }))) return
  } catch { /* fall through to fetch */ }
  try {
    void fetch(`${API}/v1/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* telemetry is never worth a retry storm */ })
  } catch { /* nothing here may throw into a frame */ }
}

export function installSink(): void {
  if (!API) return
  telemetry.setSink(send)
}

/**
 * Apply the stored choice at boot. Called before the first event is tracked, so
 * a player who has opted out never even buffers one.
 */
export function initTelemetryConsent(): void {
  const on = telemetryAllowed()
  telemetry.setEnabled(on)
  if (on) installSink()
}
