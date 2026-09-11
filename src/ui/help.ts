import { bindDialog } from './dialog.ts'
import { icon } from './icons.ts'
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = cls
  if (html !== undefined) node.innerHTML = html
  parent.append(node); return node
}
export function renderHelp(root: HTMLElement): void {
    const overlay = el('div', 'help-overlay', root)
    const card = el('div', 'help-card', overlay)
    el('h2', '', card, 'How to play')
    card.insertAdjacentHTML('beforeend', `
      <div class="help-grid">
        <div><b>${icon('castle')} Build.</b> Click a stone plot and pick a tower. Arrows are cheap and quick, mages pierce armor, cannons splash groups, barracks block the road.</div>
        <div><b>⬆ Upgrade.</b> Towers level up three times, choose one of two elite specializations — then, for a small fortune, crown the tree with a capstone: Crown Volleys, Convergence Runes, Seismic Charges, or the Last Muster.</div>
        <div><b>${icon('shield')} Block.</b> Barracks soldiers hold enemies in place while your towers work. Move them with the rally flag.</div>
        <div><b>${icon('helmPlume')} Command your hero.</b> Sir Aldric levels up from nearby kills and slams groups of foes. Select him (or press H) to see his stats and guard ring, then click the ground to move his post.</div>
        <div><b>${icon('swords')} Call waves.</b> Call the next wave early for bonus gold — if you dare.</div>
        <div><b>${icon('meteor')} Abilities.</b> Meteor Storm (4) devastates an area. Reinforcements (3) plug a leak for a few seconds.</div>
        <div><b>${icon('spike')} Trap the road.</b> Rune circles on the road hold traps: spike snares, frost runes, and blast charges that fire on whatever crosses them.</div>
        <div><b>${icon('waves')} Moor your Tidecallers.</b> Marked water plots hold one boat each. Choose a mooring that covers the road; unmarked water and lava cannot hold towers.</div>
        <div><b>${icon('gem')} Harvest shards.</b> Shardbacks, elites, and bosses drop Veilshards. Spend them to Overcharge a tower's attack speed or Ascend a tier-4 tower with a permanent perk.</div>
        <div><b>${icon('moon')} Respect the Veiltide.</b> Marked waves surge with empowered enemies under a violet sky. Calling one early is a gamble.</div>
        <div><b>${icon('link')} Build in choirs.</b> Same-family towers standing adjacent resonate: +6% damage each (barracks: tougher soldiers).</div>
        <div><b>${icon('eye')} Know your enemy.</b> Hover any foe to inspect it. Armor shrugs off arrows; mystics resist magic; flyers sail over soldiers and cannons — and Mistwalkers phase out of reach entirely.</div>
        <div><b><span class="gold-star">★</span> Spend your stars.</b> Victory stars buy permanent upgrades in the Royal Armory, found on the level-select screen.</div>
        <div><b>${icon('moon')} Survive the Long Night.</b> Beat a map to unlock its Endless mode: ever-escalating waves, a boss every tenth, and a personal record to chase.</div>
        <div><b>${icon('range')} Camera.</b> Drag to pan; right-drag, middle-drag, or Shift+drag to orbit and tilt; scroll to zoom. Touch: pinch to zoom, twist to rotate, two-finger drag to tilt.</div>
        <div><b>${icon('rune')} Hotkeys.</b> Space = call wave · F = speed · P = pause · 1 = hero · 2 = hero ability · 3 = reinforcements · 4 = meteor · V = fullscreen · Q/E rotate · T/G tilt · C = reset view · Esc = cancel/close.</div>
      </div>
    `)
    const close = el('button', 'btn primary', card, 'Got it') as HTMLButtonElement
    close.onclick = () => overlay.remove()
    bindDialog(overlay, card, () => overlay.remove())
  }
