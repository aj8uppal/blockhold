/**
 * The two ways Blockhold can fail before it ever draws a frame.
 *
 * Both used to end at the same place: a dark rectangle, forever, with nothing
 * in it. The body is painted `#0d1420` by the stylesheet, so a player whose
 * browser cannot run the game saw something that looked exactly like a game
 * still loading.
 *
 *   No WebGL. `new THREE.WebGLRenderer()` throws synchronously. Nothing caught
 *   it, so the rest of `main.ts` never ran - no screens, no error handler, not
 *   even the keyboard bindings.
 *
 *   No storage. Reading `localStorage` *throws* in a sandboxed iframe without
 *   `allow-same-origin`, and under "block all cookies". An unguarded read at
 *   module scope aborted the boot the same way. This is not a corner case: it
 *   is the portal-embedding path the game is being built for.
 *
 * Neither is recoverable, but both are explainable, and a player who is told
 * "your browser has 3D graphics turned off" can act on it.
 */

/** localStorage that cannot take the page down with it */
export const safeLocal = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* private mode, sandboxed frame */ }
  },
  /** whether storage works at all, for telling a player their progress is not being kept */
  available(): boolean {
    try {
      localStorage.setItem('blockhold.probe', '1')
      localStorage.removeItem('blockhold.probe')
      return true
    } catch {
      return false
    }
  },
}

/**
 * Can this browser actually give us a 3D context?
 *
 * Probed on a throwaway canvas so the real one is never left with a failed
 * context attached, and cheap enough to run before anything else boots.
 */
export function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl')
    if (!gl) return false
    // free it immediately rather than waiting on GC for a context we do not use
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return true
  } catch {
    return false
  }
}

/**
 * The last thing the page shows when the game cannot start.
 *
 * Deliberately built from `document.createElement` and inline styles: it has to
 * work when the stylesheet, the bundle, or both are the thing that broke.
 */
export function showFatal(title: string, body: string, hint?: string): void {
  const host = document.getElementById('screens') ?? document.body
  host.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.setAttribute('role', 'alert')
  wrap.style.cssText = [
    'position:fixed', 'inset:0', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:14px',
    'padding:24px', 'text-align:center', 'background:#0d1420', 'color:#cfe0f0',
    'font-family:system-ui,-apple-system,sans-serif', 'z-index:9999',
  ].join(';')
  const h = document.createElement('h1')
  h.textContent = title
  h.style.cssText = 'font-size:1.4rem;margin:0;font-weight:700;color:#e0b24a'
  const p = document.createElement('p')
  p.textContent = body
  p.style.cssText = 'margin:0;max-width:44ch;line-height:1.5;font-size:.95rem'
  wrap.append(h, p)
  if (hint) {
    const small = document.createElement('p')
    small.textContent = hint
    small.style.cssText = 'margin:0;max-width:44ch;font-size:.82rem;opacity:.7'
    wrap.append(small)
  }
  host.append(wrap)
  const canvas = document.getElementById('game')
  if (canvas) (canvas as HTMLElement).style.display = 'none'
  document.getElementById('loading')?.remove()
}
