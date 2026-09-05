import { icon } from './icons.ts'
import { towerTrees } from '../game/towerDefs.ts'
import type { TowerKind } from '../game/types.ts'
import { familiesCompleted } from '../game/hold.ts'

/**
 * The capstone cards: twelve, one per crown of every family.
 *
 * A card is stamped the first time a campaign battle is won with that
 * capstone standing. It is the collection Bloons gets from its tower
 * profiles and Kingdom Rush from its encyclopedia: proof of what you have
 * actually flown, with the Hold raising a pennant for every family whose
 * both crowns are stamped. Cosmetic, deliberately - no power is behind it.
 */
const FAMILIES: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon']
const FAMILY_NAME: Record<TowerKind, string> = { arrow: 'Arrow', mage: 'Mage', cannon: 'Cannon', barracks: 'Barracks', beacon: 'Beacon', ballista: 'Ballista' }
const FAMILY_ICON: Record<TowerKind, string> = { arrow: 'bow', mage: 'orb', cannon: 'bomb', barracks: 'helm', beacon: 'flame', ballista: 'target' }

export const CAPSTONE_COUNT = FAMILIES.length * 2

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

export function renderCapstoneCards(root: HTMLElement, cards: readonly string[], onClose: () => void): HTMLElement {
  const overlay = el('div', 'help-overlay guide-overlay', root)
  const card = el('div', 'help-card guide-card', overlay)
  el('h2', '', card, `${icon('crown')} Capstone cards`)
  const done = familiesCompleted(cards)
  el('div', 'guide-sub', card,
    `${cards.length} of ${CAPSTONE_COUNT} stamped · ${done} ${done === 1 ? 'family' : 'families'} mastered` +
    (cards.length < CAPSTONE_COUNT ? ' · win a campaign battle with a crown standing to stamp its card' : ' · every crown in the realm has flown'))
  const grid = el('div', 'cards-grid', card)
  for (const kind of FAMILIES) {
    towerTrees[kind].capstones.forEach((cap, branch) => {
      const id = `${kind}:${branch}`
      const have = cards.includes(id)
      const c = el('div', `cap-card${have ? ' stamped' : ''}`, grid)
      el('div', 'cc-family', c, `${icon(FAMILY_ICON[kind])} ${FAMILY_NAME[kind]} · ${towerTrees[kind].branches[branch].name}`)
      el('div', 'cc-name', c, `${have ? '✦ ' : ''}${cap.name}`)
      el('div', 'cc-desc', c, have ? cap.description : 'Not yet flown.')
    })
  }
  const close = el('button', 'btn primary', card, 'Close') as HTMLButtonElement
  close.onclick = () => { overlay.remove(); onClose() }
  overlay.onclick = (e: MouseEvent) => { if (e.target === overlay) { overlay.remove(); onClose() } }
  return overlay
}
