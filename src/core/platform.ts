/**
 * Where this copy of the game is running.
 *
 * Browser games are discovered through portals as much as through shared
 * links, and portals have house rules: CrazyGames treats 800x450 as an
 * important mobile iframe size and asks games not to ship their own
 * fullscreen control, because the portal frame provides one. A game that
 * fights its host loses placement.
 */

/** running inside someone else's page */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true   // cross-origin frame access throws, which means embedded
  }
}

/**
 * Portal mode: hand chrome back to the host. Embedded by default, and
 * forceable with ?portal=1 so it can be tested outside a real frame.
 */
export function isPortalMode(search = location.search): boolean {
  if (/[?&]portal=1/.test(search)) return true
  return isEmbedded()
}

/**
 * Where the player came from, for attribution. Reads an explicit ?src=
 * first, then falls back to the embedding page's host. Never records a full
 * referrer URL - the host is all that is useful and all that is anyone's
 * business.
 */
export function acquisitionSource(search = location.search, referrer = document.referrer): string {
  const m = /[?&]src=([A-Za-z0-9_.-]{1,32})/.exec(search)
  if (m) return m[1].toLowerCase()
  if (!referrer) return 'direct'
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').slice(0, 40) || 'direct'
  } catch {
    return 'direct'
  }
}

/** the player asked their system for less movement */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * True inside the iOS app shell (Capacitor), where the page is served from
 * the app bundle rather than the web: there is no service worker to install,
 * nothing to add to a Home Screen, and the app already owns the whole screen.
 */
export function isNativeApp(): boolean {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return location.protocol === 'capacitor:' || !!cap?.isNativePlatform?.()
}

/** where the game lives on the web; links that leave the app point here */
export const SITE_URL = 'https://blockhold.app/'

/**
 * The address to build a shareable link from.
 *
 * In a browser that is the page itself, so a link made on a local preview
 * stays local. Inside the iOS app the page is capacitor://localhost, which
 * nobody it is sent to can open, so the public site stands in.
 */
export function shareBase(): string {
  return /^https?:$/.test(location.protocol) ? location.href.split('#')[0].split('?')[0] : SITE_URL
}

/** a page of the public site (privacy, support), as a link that works from the app too */
export function sitePage(page: string): string {
  return new URL(page, isNativeApp() ? SITE_URL : location.href).href
}
