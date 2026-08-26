/**
 * Inline SVG icon set — replaces emoji throughout the UI.
 * All icons share a 24×24 viewBox and a chunky, rounded, duotone style:
 * silhouettes fill currentColor, detail shapes use translucent overlays,
 * strokes are width 2 with round caps. Color comes from CSS (.ico-<name>
 * or an inherited text color), size from font-size (1em square).
 */

const S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const DARK = 'rgba(20, 12, 4, 0.45)'
const LIGHT = 'rgba(255, 255, 255, 0.35)'

const defs: Record<string, string> = {
  // ---- resources & stats ----
  heart: `<path fill="currentColor" d="M12 20.5C7.6 16.9 4 13.8 4 9.9 4 7.4 6 5.4 8.4 5.4c1.4 0 2.8.7 3.6 1.9.8-1.2 2.2-1.9 3.6-1.9C18 5.4 20 7.4 20 9.9c0 3.9-3.6 7-8 10.6Z"/>`,
  coin: `<circle cx="12" cy="12" r="8.4" fill="currentColor"/><circle cx="12" cy="12" r="4.7" fill="none" stroke="${DARK}" stroke-width="2"/>`,
  gem: `<path fill="currentColor" d="M12 2.6 18.9 9 12 21.4 5.1 9Z"/><path fill="${LIGHT}" d="M12 2.6 15.5 9 12 21.4 8.5 9Z"/>`,
  wave: `<g ${S}><path d="M3 9.2c2.3 0 2.3 2.1 4.5 2.1s2.2-2.1 4.5-2.1 2.3 2.1 4.5 2.1 2.2-2.1 4.5-2.1"/><path d="M3 15c2.3 0 2.3 2.1 4.5 2.1S9.7 15 12 15s2.3 2.1 4.5 2.1S18.7 15 21 15"/></g>`,
  hourglass: `<g ${S}><path d="M6.5 3.5h11M6.5 20.5h11M7.8 3.5v3.1L12 12l-4.2 5.4v3.1M16.2 3.5v3.1L12 12l4.2 5.4v3.1"/></g><path fill="currentColor" d="m12 14.2 2.7 3.4v1.6H9.3v-1.6Z"/>`,
  range: `<circle cx="12" cy="12" r="6.8" fill="none" stroke="currentColor" stroke-width="2"/><g ${S}><path d="M12 2.4v3.4M12 18.2v3.4M2.4 12h3.4M18.2 12h3.4"/></g><circle cx="12" cy="12" r="1.7" fill="currentColor"/>`,
  target: `<circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><g ${S}><path d="M12 1.6v3.2M12 19.2v3.2M1.6 12h3.2M19.2 12h3.2"/></g><circle cx="12" cy="12" r="1.3" fill="currentColor"/>`,
  respawn: `<path ${S} d="M18.9 13.5a7 7 0 1 1-1.2-5.2"/><path fill="currentColor" d="M20.6 3.4v5.3h-5.3Z"/>`,
  skull: `<path fill="currentColor" d="M12 2.6a7.8 7.8 0 0 0-7.8 7.8c0 2.5 1.2 4.7 3 6.2v3c0 .8.7 1.5 1.5 1.5h6.6c.8 0 1.5-.7 1.5-1.5v-3c1.8-1.5 3-3.7 3-6.2A7.8 7.8 0 0 0 12 2.6Z"/><circle cx="9.1" cy="10.6" r="1.9" fill="${DARK}"/><circle cx="14.9" cy="10.6" r="1.9" fill="${DARK}"/><path d="M10.4 17.4v1.9M13.6 17.4v1.9" stroke="${DARK}" stroke-width="1.7" stroke-linecap="round"/>`,
  link: `<g ${S}><path d="m9.6 14.4 4.8-4.8"/><path d="M12.7 6.5 15 4.2a3.9 3.9 0 0 1 5.5 5.5l-2.3 2.3"/><path d="M11.3 17.5 9 19.8a3.9 3.9 0 0 1-5.5-5.5l2.3-2.3"/></g>`,

  // ---- combat & towers ----
  swords: `<g ${S}><path d="M4.6 4.2 15.4 15M19.4 4.2 8.6 15"/><path d="m13.9 16.9 3-3M10.1 16.9l-3-3"/><path d="m16.3 19.8 3.2-3.2M7.7 19.8 4.5 16.6"/></g>`,
  sword: `<g ${S}><path d="M19.3 4.7 9.4 14.6"/><path d="m7.2 12.4 4.4 4.4"/><path d="M9.4 16.8 6 20.2"/></g><circle cx="5.1" cy="19" r="1.3" fill="currentColor"/>`,
  bow: `<g ${S}><path d="M7 3.5c7.2 2.4 7.2 14.6 0 17"/><path d="M7 3.5v17"/><path d="M10.5 12h8.6"/><path d="m15.8 8.8 3.6 3.2-3.6 3.2"/></g>`,
  orb: `<circle cx="12" cy="10.8" r="6.6" fill="none" stroke="currentColor" stroke-width="2"/><path ${S} d="M8.3 20.6h7.4"/><path fill="currentColor" d="m12 6.7 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1Z"/>`,
  bomb: `<circle cx="10.4" cy="14.1" r="6.6" fill="currentColor"/><path ${S} d="M14.8 9 17 6.6"/><path fill="currentColor" d="m19.6 2.9.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z"/>`,
  shield: `<path fill="currentColor" d="M12 2.4 19.2 5.2v6.4c0 4.6-2.9 7.8-7.2 9.9-4.3-2.1-7.2-5.3-7.2-9.9V5.2Z"/><path fill="${LIGHT}" d="M12 2.4 19.2 5.2v6.4c0 4.6-2.9 7.8-7.2 9.9Z"/>`,
  helm: `<path fill="currentColor" d="M5.4 11.4a6.6 6.6 0 0 1 13.2 0v6.8h-3.2v-3.7H8.6v3.7H5.4Z"/><rect x="8" y="10.4" width="8" height="2" rx="1" fill="${DARK}"/>`,
  helmPlume: `<path fill="currentColor" d="M5.4 12.4a6.6 6.6 0 0 1 13.2 0v6.4h-3.2v-3.5H8.6v3.5H5.4Z"/><rect x="8" y="11.6" width="8" height="2" rx="1" fill="${DARK}"/><path ${S} opacity=".8" d="M7.6 5.2c2.5-2.4 6.6-2.4 9.2.2"/>`,
  lightning: `<path fill="currentColor" d="M13.4 2 4.8 13.6h5.3L8.9 22l9.9-12.4h-5.5Z"/>`,
  sparkle: `<path fill="currentColor" d="M12 3.4 13.7 10.3 20.6 12 13.7 13.7 12 20.6 10.3 13.7 3.4 12 10.3 10.3Z"/><path fill="currentColor" opacity=".55" d="m18.6 3.2.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7Z"/>`,
  flame: `<path fill="currentColor" d="M12 2.6c1 2.4 2.6 4 4.1 5.7 1.5 1.7 2.4 3.3 2.4 5.3a6.5 6.5 0 1 1-13 0c0-1.7.6-3.2 1.8-4.7.5 1 1.2 1.8 2.2 2.4-.4-2.9.7-6 2.5-8.7Z"/><path fill="${LIGHT}" d="M12 20.2a3.3 3.3 0 0 1-3.3-3.3c0-1.4.9-2.5 1.9-3.6.4.8 1 1.4 1.8 1.9.5-.8.8-1.6.8-2.6 1.2 1.3 2.1 2.8 2.1 4.3a3.3 3.3 0 0 1-3.3 3.3Z"/>`,
  drop: `<path fill="currentColor" d="M12 2.6c3.6 4.8 6.1 8.2 6.1 11.4a6.1 6.1 0 1 1-12.2 0C5.9 10.8 8.4 7.4 12 2.6Z"/><path fill="${LIGHT}" d="M9.3 14.2a2.9 2.9 0 0 0 2 2.9"/>`,
  feather: `<path ${S} d="M20.2 4.3a6.2 6.2 0 0 0-8.8 0L5 10.7V19h8.3l6.9-6.9a6.2 6.2 0 0 0 0-8.8Z"/><path ${S} d="M16 8 3.6 20.4M17.6 12.4h-5.8M11.6 6.4v5.8"/>`,
  meteor: `<circle cx="8.6" cy="15.4" r="5.6" fill="currentColor"/><g ${S}><path d="M14.9 9.3 20 4.2M17 13.2l4-1.9M11 7l1.6-3.8"/></g>`,
  blast: `<path fill="currentColor" d="M12 2.4 13.9 8 19.2 4.8l-3 5.3 5.4 1.9-5.4 1.9 3 5.3-5.3-3.1L12 21.6l-1.9-5.5-5.3 3.1 3-5.3L2.4 12l5.4-1.9-3-5.3L10.1 8Z"/>`,
  quake: `<g ${S}><path d="M3 20.5h18"/><path d="M12.2 20.5 10 16.2l3.2-2.7-2.2-4L14.2 6"/></g>`,
  spike: `<path fill="currentColor" d="M2.6 20 6.1 9.6 9.6 20Z"/><path fill="currentColor" d="M8.5 20 12 5.8 15.5 20Z"/><path fill="currentColor" d="M14.4 20 17.9 9.6 21.4 20Z"/>`,
  frost: `<g ${S}><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></g><circle cx="12" cy="12" r="1.8" fill="currentColor"/>`,
  flag: `<path ${S} d="M5.6 21.2V3.2"/><path fill="currentColor" d="M5.6 3.8h11.2l-2.7 3.6 2.7 3.6H5.6Z"/>`,
  eye: `<path fill="none" stroke="currentColor" stroke-width="2" d="M2.4 12S6 5.7 12 5.7 21.6 12 21.6 12 18 18.3 12 18.3 2.4 12 2.4 12Z"/><circle cx="12" cy="12" r="2.7" fill="currentColor"/>`,
  blood: `<path fill="currentColor" d="M7 4.2c1.8 2.4 3.1 4.1 3.1 5.8a3.1 3.1 0 1 1-6.2 0C3.9 8.3 5.2 6.6 7 4.2Z"/><path fill="currentColor" opacity=".8" d="M16.8 8.2c1.8 2.4 3.1 4.1 3.1 5.8a3.1 3.1 0 1 1-6.2 0c0-1.7 1.3-3.4 3.1-5.8Z"/><path fill="currentColor" opacity=".6" d="M10.6 14.6c1.3 1.8 2.3 3.1 2.3 4.3a2.3 2.3 0 1 1-4.6 0c0-1.2 1-2.5 2.3-4.3Z"/>`,
  echo: `<g ${S}><circle cx="12" cy="12" r="2.2"/><path d="M16.6 7.4a6.5 6.5 0 0 1 0 9.2M7.4 16.6a6.5 6.5 0 0 1 0-9.2"/><path d="M19.4 4.6a10.4 10.4 0 0 1 0 14.8" opacity=".55"/><path d="M4.6 19.4a10.4 10.4 0 0 1 0-14.8" opacity=".55"/></g>`,
  veil: `<circle cx="12" cy="12" r="6.8" fill="none" stroke="currentColor" stroke-width="2"/><path ${S} d="M2.8 12h18.4"/><path fill="currentColor" d="M21.9 12 17 9.3v5.4Z"/>`,
  crown: `<path fill="currentColor" d="M3.4 8.2 8 11.9l4-6.6 4 6.6 4.6-3.7-1.7 9.6H5.1Z"/><rect x="5" y="18.7" width="14" height="2.4" rx="1.1" fill="currentColor"/>`,
  soldiers: `<circle cx="8.6" cy="7.6" r="3.1" fill="currentColor"/><path fill="currentColor" d="M3.4 19.6c0-3.4 2.3-5.6 5.2-5.6s5.2 2.2 5.2 5.6Z"/><circle cx="16.8" cy="8.6" r="2.6" fill="currentColor" opacity=".55"/><path fill="currentColor" opacity=".55" d="M15.2 14.8c2.9.4 4.9 2.4 4.9 4.8h-4.4a7.3 7.3 0 0 0-.5-4.8Z"/>`,
  rune: `<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M12 2.8 20.2 12 12 21.2 3.8 12Z"/><path fill="currentColor" opacity=".6" d="M12 7.4 16.1 12 12 16.6 7.9 12Z"/>`,
  chest: `<path fill="currentColor" opacity=".75" d="M4 9.4A4.6 4.6 0 0 1 8.6 4.8h6.8A4.6 4.6 0 0 1 20 9.4Z"/><path fill="currentColor" d="M4 10.6h16v7.2a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 17.8Z"/><rect x="10.6" y="9" width="2.8" height="4.8" rx="1.1" fill="${DARK}"/>`,

  // ---- screens & meta ----
  castle: `<path fill="currentColor" d="M4 21V8.4h2.7V5.6h2.5v2.8h1.6V5.6h2.4v2.8h1.6V5.6h2.5v2.8H20V21h-4.9v-3.9a3.1 3.1 0 0 0-6.2 0V21Z"/>`,
  lock: `<rect x="5" y="10.4" width="14" height="10.2" rx="2.2" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-width="2" d="M8.4 10.4V7.6a3.6 3.6 0 0 1 7.2 0v2.8"/><circle cx="12" cy="15.5" r="1.7" fill="${DARK}"/>`,
  moon: `<path fill="currentColor" d="M20.2 14.6A8.7 8.7 0 1 1 9.4 3.8a7.1 7.1 0 0 0 10.8 10.8Z"/>`,
  trophy: `<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M7.6 4.4h8.8v5.4a4.4 4.4 0 0 1-8.8 0Z"/><path fill="none" stroke="currentColor" stroke-width="2" d="M7.6 6.2H4.4A3.4 3.4 0 0 0 7.8 9.6M16.4 6.2h3.2a3.4 3.4 0 0 1-3.4 3.4"/><path fill="currentColor" d="M10.9 13.8h2.2v2.8h2.7v3H8.2v-3h2.7Z"/>`,
  medal: `<path fill="currentColor" opacity=".65" d="M8.2 2.8h3.2L9.7 8.4 6.6 9.8Z"/><path fill="currentColor" opacity=".65" d="M15.8 2.8h-3.2l1.7 5.6 3.1 1.4Z"/><circle cx="12" cy="14.6" r="5.7" fill="currentColor"/><path fill="${DARK}" d="m12 11.4 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3Z"/>`,
  tree: `<path fill="currentColor" d="M12 2.4 16.9 9h-2.5l3.5 5h-2.9l3.6 5.2H5.4L9 14H6.1l3.5-5H7.1Z"/><rect x="10.6" y="19.2" width="2.8" height="2.6" fill="currentColor" opacity=".7"/>`,
  volcano: `<path fill="currentColor" d="M9.2 8.6h5.6l6 11.9H3.2Z"/><circle cx="12" cy="4.6" r="1.8" fill="currentColor" opacity=".65"/><circle cx="15.4" cy="3.4" r="1.2" fill="currentColor" opacity=".45"/><circle cx="8.9" cy="3.1" r="1" fill="currentColor" opacity=".4"/>`,
  mushroom: `<path fill="currentColor" d="M12 2.8a8.6 8.6 0 0 1 8.6 8.6H3.4A8.6 8.6 0 0 1 12 2.8Z"/><path fill="currentColor" opacity=".7" d="M9.4 11.4h5.2l.8 8a1.8 1.8 0 0 1-1.8 1.8h-3.2a1.8 1.8 0 0 1-1.8-1.8Z"/><circle cx="8.9" cy="7.4" r="1.3" fill="${LIGHT}"/><circle cx="14.6" cy="6.2" r="1" fill="${LIGHT}"/>`,

  // ---- chrome ----
  pause: `<rect x="6" y="4.6" width="4.2" height="14.8" rx="1.3" fill="currentColor"/><rect x="13.8" y="4.6" width="4.2" height="14.8" rx="1.3" fill="currentColor"/>`,
  play: `<path fill="currentColor" d="M7.2 4.4v15.2L19.8 12Z"/>`,
  soundOn: `<path fill="currentColor" d="M4 9.4h3.4L13 4.8v14.4l-5.6-4.6H4Z"/><g ${S}><path d="M16 9.2a4.4 4.4 0 0 1 0 5.6"/><path d="M18.7 6.6a8.2 8.2 0 0 1 0 10.8"/></g>`,
  soundOff: `<path fill="currentColor" d="M4 9.4h3.4L13 4.8v14.4l-5.6-4.6H4Z"/><path ${S} d="m16.2 9.4 5.2 5.2m0-5.2-5.2 5.2"/>`,
  music: `<path fill="currentColor" d="M9.2 19.2a2.9 2.9 0 1 1-1.6-2.6V5.4L20.2 3.2v13.2a2.9 2.9 0 1 1-1.6-2.6V7L9.2 8.8Z"/>`,
  musicOff: `<path fill="currentColor" opacity=".6" d="M9.2 19.2a2.9 2.9 0 1 1-1.6-2.6V5.4L20.2 3.2v13.2a2.9 2.9 0 1 1-1.6-2.6V7L9.2 8.8Z"/><path ${S} d="M4.2 4.2 19.8 19.8"/>`,
  fullscreen: `<path ${S} d="M8.6 3.4H5.2a1.8 1.8 0 0 0-1.8 1.8v3.4M15.4 3.4h3.4a1.8 1.8 0 0 1 1.8 1.8v3.4M8.6 20.6H5.2a1.8 1.8 0 0 1-1.8-1.8v-3.4M15.4 20.6h3.4a1.8 1.8 0 0 0 1.8-1.8v-3.4"/>`,
  rotate: `<rect x="7" y="3.4" width="10" height="17.2" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17.6" r="1.1" fill="currentColor"/><path ${S} d="M20.8 9.4a9.3 9.3 0 0 0-3.4-4.6M3.2 14.6a9.3 9.3 0 0 0 3.4 4.6"/><path fill="currentColor" d="m21.9 6.5-.6 4-3.4-2.2Z"/><path fill="currentColor" d="m2.1 17.5.6-4 3.4 2.2Z"/>`,
  share: `<path ${S} d="M7.5 9.5H6a1.8 1.8 0 0 0-1.8 1.8v8A1.8 1.8 0 0 0 6 21.1h12a1.8 1.8 0 0 0 1.8-1.8v-8A1.8 1.8 0 0 0 18 9.5h-1.5"/><path ${S} d="M12 14.5V3.2M8.4 6.4 12 2.8l3.6 3.6"/>`,
  plusSquare: `<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path ${S} d="M12 7.8v8.4M7.8 12h8.4"/>`,
}

/** enemy ids with a painted tooltip portrait in public/art */
export const BOSS_ART = new Set(['juggernaut', 'veilqueen', 'veilregent'])

/** render an icon by name; extra classes are appended (e.g. sizing hooks) */
export function icon(name: string, cls = ''): string {
  const body = defs[name]
  if (!body) return ''
  return `<svg class="ico ico-${name}${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`
}
