/**
 * Per-day link previews for Blockhold.
 *
 * Everything else about this Worker is a pass-through. It exists for one
 * reason: a static host serves one `index.html` to every visitor, so a Daily
 * result posted into a chat previews as the generic homepage - the same title
 * and the same picture as every other Blockhold link in the world. The link is
 * the payload of the whole share loop, and that made all of them look alike.
 *
 * So the body, the bundle and every asset are proxied untouched, and only the
 * handful of meta tags a preview crawler reads are rewritten from the query
 * string. The game itself never sees a difference.
 */

/**
 * The campaign maps, in array order, mirroring `levels` in
 * src/game/levels.ts. `dailyLevel()` picks its board with `seed % levels.length`,
 * so this list has to stay in the same order and the same length or a preview
 * will name a different map than the link actually opens.
 */
const LEVELS = [
  { id: 'greenhollow', name: 'Greenhollow' },
  { id: 'frostmere', name: 'Frostmere Pass' },
  { id: 'emberwastes', name: 'The Emberwastes' },
  { id: 'mistfen', name: 'Mistfen Crossing' },
  { id: 'shatteredcrown', name: 'The Shattered Crown' },
  { id: 'cinderwake', name: 'Cinderwake Caldera' },
  { id: 'veilscar', name: 'Veilscar Confluence' },
  { id: 'sunderfall', name: 'Sunderfall Terraces' },
  { id: 'emberwind', name: 'Emberwind Reach' },
  { id: 'tidereach', name: 'Tidereach Causeway' },
]

/** the day number shown beside a daily result; mirrors dailyNumber() */
function dailyNumber(now = new Date()) {
  const epoch = Date.UTC(2026, 7, 1) // 2026-08-01
  const day = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - epoch) / 86400000,
  )
  return Math.max(1, day + 1)
}

/** what this particular link should say it is */
function describe(url) {
  const hold = url.searchParams.get('hold')
  if (!hold) return null

  const seed = parseInt(hold, 36)
  if (!Number.isFinite(seed) || seed <= 0) return null

  const mapId = url.searchParams.get('m')
  const endless = url.searchParams.get('e') === '1'

  if (mapId) {
    const level = LEVELS.find(l => l.id === mapId)
    if (!level) return null
    return endless
      ? {
        title: `Blockhold · The Long Night on ${level.name}`,
        description: 'Someone held this board. The same seed, the same waves, the same escalation. See how far you get.',
      }
      : {
        title: `Blockhold · ${level.name}`,
        description: 'A challenge on this exact board. Same map, same seed, same fight. Free in your browser.',
      }
  }

  // a bare ?hold= is the Daily, whose board rotates with the seed
  const level = LEVELS[seed % LEVELS.length]
  return {
    title: `Blockhold Daily #${dailyNumber()} · ${level.name}`,
    description: 'One battle a day, the same one for everyone in the world. Twelve waves. See how far you hold.',
  }
}

/** replace the content of one meta tag, leaving the rest of the head alone */
class MetaRewriter {
  constructor(value) { this.value = value }
  element(el) { el.setAttribute('content', this.value) }
}

class TitleRewriter {
  constructor(value) { this.value = value }
  element(el) { el.setInnerContent(this.value) }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = (env.ORIGIN || 'https://aj8uppal.github.io/blockhold').replace(/\/$/, '')

    // Pages is the source of truth for every byte; the path is passed through
    // verbatim so hashed assets, the manifest and the service worker all
    // resolve exactly as they do today.
    const upstream = `${origin}${url.pathname === '/' ? '/' : url.pathname}${url.search}`
    const res = await fetch(upstream, {
      headers: request.headers,
      method: request.method,
      redirect: 'follow',
    })

    const isHtml = (res.headers.get('content-type') || '').includes('text/html')
    const meta = isHtml ? describe(url) : null
    if (!meta) return res

    return new HTMLRewriter()
      .on('title', new TitleRewriter(meta.title))
      .on('meta[property="og:title"]', new MetaRewriter(meta.title))
      .on('meta[property="og:description"]', new MetaRewriter(meta.description))
      .on('meta[name="description"]', new MetaRewriter(meta.description))
      .on('meta[property="og:url"]', new MetaRewriter(url.toString()))
      .transform(res)
  },
}
