import { icon, BOSS_ART } from './icons.ts'
import { enemyDefs } from '../game/enemyDefs.ts'
import { traitsOf, counterFor, isNotable } from '../game/dossier.ts'
import type { EnemyDef } from '../game/types.ts'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

/**
 * The field guide: everything the player has met, and what beats it.
 *
 * Kingdom Rush's encyclopedia is where a first meeting becomes knowledge the
 * player can reread before a wave. Blockhold's dossiers explained things once
 * and then were gone. The guide is built from the same definitions and the
 * same counters, so it never disagrees with the dossier, and it only shows
 * what has been seen: the rest is a count, which is its own reason to play.
 */
export function renderFieldGuide(root: HTMLElement, seen: readonly string[], onClose: () => void): HTMLElement {
  const overlay = el('div', 'help-overlay guide-overlay', root)
  const card = el('div', 'help-card guide-card', overlay)
  el('h2', '', card, `${icon('eye')} Field guide`)
  const all = [...enemyDefs.values()].filter(d => !d.id.endsWith('Landed'))
  const known = all.filter(d => seen.includes(d.id) || (d.phaseInto ? seen.includes(d.phaseInto) : false))
  const bosses = known.filter(d => d.boss)
  const others = known.filter(d => !d.boss)
  const unseen = all.length - known.length
  el('div', 'guide-sub', card, known.length
    ? `${known.length} of ${all.length} met${unseen > 0 ? ` · ${unseen} still out there` : ' · every one of them'}`
    : 'Nothing met yet. The road will introduce them.')
  const list = el('div', 'guide-list', card)
  const entry = (d: EnemyDef) => {
    const row = el('div', `guide-entry${d.boss ? ' boss' : ''}`, list)
    const head = el('div', 'ge-head', row)
    if (BOSS_ART.has(d.id)) {
      const art = el('div', 'ge-art', head)
      art.style.backgroundImage = `url(art/boss-${d.id}.webp)`
    }
    const t = el('div', 'ge-title', head)
    el('b', '', t, d.name)
    el('span', 'ge-blurb', t, d.description)
    const traits = traitsOf(d)
    if (traits.length) el('div', 'ge-traits', row, traits.map(x => `<span class="ge-trait">${x.label}</span>`).join(''))
    if (isNotable(d)) el('div', 'ge-counter', row, `${icon('target')} ${counterFor(d)}`)
    // the second phase is part of the same entry
    if (d.phaseInto) {
      const next = enemyDefs.get(d.phaseInto)
      if (next) el('div', 'ge-phase', row, `${icon('respawn')} Then: <b>${next.name}</b> — ${counterFor(next)}`)
    }
  }
  for (const d of bosses) entry(d)
  for (const d of others) entry(d)
  const close = el('button', 'btn primary', card, 'Close') as HTMLButtonElement
  close.onclick = () => { overlay.remove(); onClose() }
  overlay.onclick = (e: MouseEvent) => { if (e.target === overlay) { overlay.remove(); onClose() } }
  return overlay
}
