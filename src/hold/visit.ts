import { sanitizeHoldSnapshot, type HoldSnapshot } from '../core/holdData.ts'
export function encodeVisit(snapshot: HoldSnapshot): string {
  const clean = sanitizeHoldSnapshot(snapshot)
  if (!clean) throw new Error('This Hold cannot be shared. Try saving the arrangement again.')
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(clean)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  if (encoded.length > 8000) throw new Error('This Hold is too large to share as a link.')
  return encoded
}
export function decodeVisit(code: string): HoldSnapshot | null {
  if (!code || code.length > 8000 || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  try { return sanitizeHoldSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))))) } catch { return null }
}
export function visitUrl(snapshot: HoldSnapshot): string {
  const url = new URL(location.href); url.search = ''; url.hash = new URLSearchParams({ visit: encodeVisit(snapshot) }).toString()
  return url.toString()
}
