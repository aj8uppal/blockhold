/** Small entry-point helpers; room transport is loaded only when needed. */
export function coopEnabled(): boolean { return (import.meta.env?.VITE_SYNC_URL ?? '').length > 0 }

/** a `?coop=CODE` on the URL is an invitation; read it once and clear it */
export function inviteCodeFromUrl(): string | null {
  const u = new URL(location.href)
  const code = u.searchParams.get('coop')
  if (!code) return null
  u.searchParams.delete('coop')
  history.replaceState(null, '', u.toString())
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || null
}
