import { bindDialog } from './dialog.ts'
import { icon } from './icons.ts'
import type { SaveData } from '../core/save.ts'
import { levels } from '../game/levels.ts'
import { trophyCatalog, newTrophies, markTrophiesSeen, nextTrophy, MAP_NAMES, HEROES, TROPHY_MAPS, TROPHY_FAMILIES, TROPHY_PATHS, type Trophy } from '../game/trophies.ts'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

export interface TrophiesApi {
  save: () => SaveData
  /** write the save after the newly earned have been marked seen */
  persist: () => void
  /** open the battle, hunt or daily that earns a trophy */
  go: (trophy: Trophy) => void
  /** share a picture of the castle; false when it could not be made */
  share: () => Promise<boolean>
}

const FAMILY_ICON: Record<string, string> = { arrow: 'bow', mage: 'orb', cannon: 'bomb', barracks: 'helm', beacon: 'flame', ballista: 'target', seraph: 'seraph', tidecaller: 'wave' }
const title = (s: string) => s[0].toUpperCase() + s.slice(1)

/** A row of the sheet: a name and the trophies that belong to it. */
interface Row { label: string, lead?: string, locked?: boolean, chips: { id: string, face: string }[] }
interface Group { heading: string, legend?: string, rows: Row[] }

/**
 * The trophy sheet.
 *
 * Fifty-nine trophies as a list of cards was a wall. Most of them come in
 * small sets - three per battlefield, two per tower family - so each set is
 * one row of marks that reads at a glance: lit is earned, hollow is not.
 * Tapping a mark says what it asks and opens the battle that earns it; the
 * one worth chasing next sits at the top.
 */
export function renderTrophies(root: HTMLElement, api: TrophiesApi, onClose: () => void): void {
  const save = api.save()
  const fresh = new Set(newTrophies(save).map(t => t.id))
  if (markTrophiesSeen(save)) api.persist()
  const list = trophyCatalog(save)
  const byId = new Map(list.map(t => [t.id, t]))
  const earned = list.filter(t => t.owned).length

  const overlay = el('div', 'help-overlay trophies-overlay', root)
  const card = el('div', 'help-card trophies-card', overlay)
  el('h2', '', card, `${icon('trophy')} Trophies`)
  el('div', 'guide-sub', card, `${earned} of ${list.length} earned${fresh.size ? ` · <b class="trophy-fresh">${fresh.size} new</b>` : ''}`)

  const close = () => { overlay.remove(); onClose() }
  const go = (t: Trophy) => { close(); api.go(t) }
  const goLabel = (t: Trophy) => t.action === 'hunts' ? 'Go to the hunts' : t.action === 'daily' ? "Play today's Daily" : `Play ${t.source ? MAP_NAMES[TROPHY_MAPS.indexOf(t.source as typeof TROPHY_MAPS[number])] : 'the campaign'}`

  const next = nextTrophy(list)
  const spot = el('section', 'trophy-next', card)
  if (next) {
    el('span', 'eyebrow', spot, 'Next up')
    el('b', '', spot, next.name)
    el('p', '', spot, `${next.requirement} <small>${next.progress}</small>`)
    const b = el('button', 'btn primary', spot, `${goLabel(next)} ${icon('arrowRight')}`) as HTMLButtonElement
    b.onclick = () => go(next)
  } else {
    el('span', 'eyebrow', spot, 'All earned')
    el('b', '', spot, 'Every trophy is yours.')
  }

  const unlocked = save.unlocked
  const groups: Group[] = [
    {
      heading: 'Battlefields',
      legend: `${icon('castle')} Win · ${icon('star')} Three stars · ${icon('shield')} Flawless (nothing gets through)`,
      rows: TROPHY_MAPS.map((id, i) => ({
        label: MAP_NAMES[i], locked: levels.findIndex(l => l.id === id) >= unlocked,
        chips: [{ id: `watch:${id}`, face: icon('castle') }, { id: `banner:${id}`, face: icon('star') }, { id: `statue:${id}`, face: icon('shield') }],
      })),
    },
    {
      heading: 'Tower families',
      legend: `${icon('flag')} Pennant: win with both tier-five branches · ${icon('crown')} Masterwork: level 30 and both hunts`,
      rows: TROPHY_FAMILIES.map(id => ({
        label: title(id), lead: icon(FAMILY_ICON[id] ?? 'castle'),
        chips: [{ id: `pennant:${id}`, face: icon('flag') }, { id: `mastery:${id}`, face: icon('crown') }],
      })),
    },
    {
      heading: 'Hunts & heroes',
      rows: [
        { label: 'Boss hunts', lead: icon('skull'), chips: [{ id: 'hunt:ossuary', face: 'Bones' }, { id: 'hunt:empress', face: 'Empress' }] },
        ...HEROES.map((hero, h) => ({
          label: title(hero), lead: icon('helmPlume'),
          chips: TROPHY_PATHS.slice(h * 2, h * 2 + 2).map(p => ({ id: `hero:${p}`, face: byId.get(`hero:${p}`)!.name.replace(' Standard', '') })),
        })),
      ],
    },
    {
      heading: 'Endurance',
      rows: [
        { label: 'Hold the line', lead: icon('moon'), chips: [15, 30, 60, 100].map(n => ({ id: `endless:${n}`, face: `+${n}` })) },
        { label: 'Daily Hold', lead: icon('calendar'), chips: [{ id: 'daily:relic', face: 'Win' }] },
      ],
    },
  ]

  for (const g of groups) {
    const section = el('section', 'trophy-group', card)
    const owned = g.rows.flatMap(r => r.chips).filter(c => byId.get(c.id)?.owned).length
    const total = g.rows.flatMap(r => r.chips).length
    el('h3', '', section, `${g.heading} <span>${owned}/${total}</span>`)
    if (g.legend) el('p', 'trophy-legend', section, g.legend)
    const rows = el('div', 'trophy-rows', section)
    // one detail line per group, moved under whichever row was tapped
    const detail = el('div', 'trophy-detail', rows)
    detail.hidden = true
    let open: HTMLButtonElement | null = null
    for (const r of g.rows) {
      const row = el('div', `trophy-row${r.locked ? ' locked' : ''}`, rows)
      el('span', 'tr-name', row, `${r.lead ?? ''}${r.label}${r.locked ? ` ${icon('lock')}` : ''}`)
      const chips = el('span', 'tr-chips', row)
      for (const c of r.chips) {
        const t = byId.get(c.id)
        if (!t) continue
        const isText = !c.face.startsWith('<')
        const chip = el('button', `trophy-chip${t.owned ? ' on' : ''}${fresh.has(t.id) ? ' new' : ''}${isText ? ' text' : ''}`, chips, c.face) as HTMLButtonElement
        chip.type = 'button'
        chip.setAttribute('aria-label', `${t.name}, ${t.owned ? 'earned' : 'not earned'}${fresh.has(t.id) ? ', new' : ''}`)
        chip.setAttribute('aria-expanded', 'false')
        chip.title = t.name
        chip.onclick = () => {
          if (open) open.setAttribute('aria-expanded', 'false')
          if (open === chip) { open = null; detail.hidden = true; return }
          open = chip
          chip.setAttribute('aria-expanded', 'true')
          detail.replaceChildren()
          el('b', '', detail, `${t.name}${t.owned ? ` <span class="trophy-earned">${icon('check')} Earned</span>` : ''}`)
          el('p', '', detail, `${t.requirement} <small>${t.progress}</small>`)
          if (!t.owned) {
            const b = el('button', 'btn small', detail, `${goLabel(t)} ${icon('arrowRight')}`) as HTMLButtonElement
            b.onclick = () => go(t)
          }
          row.after(detail)
          detail.hidden = false
        }
      }
    }
  }

  const foot = el('footer', 'trophies-foot', card)
  const share = el('button', 'btn', foot, `${icon('share')} Share a picture`) as HTMLButtonElement
  share.onclick = async () => {
    share.disabled = true
    const ok = await api.share().catch(() => false)
    share.disabled = false
    share.innerHTML = ok ? `${icon('check')} Picture ready` : 'Could not make the picture'
    setTimeout(() => { if (share.isConnected) share.innerHTML = `${icon('share')} Share a picture` }, 2500)
  }
  const done = el('button', 'btn primary', foot, 'Close') as HTMLButtonElement
  done.onclick = close
  bindDialog(overlay, card, close)
}
