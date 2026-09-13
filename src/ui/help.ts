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
        <div><b>⬆ Upgrade.</b> Level up a tower, choose a specialization, then save for its capstone. Each branch has a different final form.</div>
        <div><b>${icon('shield')} Block.</b> Barracks soldiers hold enemies in place while your towers work. Move them with the rally flag.</div>
        <div><b>${icon('helmPlume')} Command your hero.</b> Select your champion (1 or H), then click the ground to move. Battlefield kills earn hero XP. Upgrade their weapon and signature from the hero panel; use their ability with 2.</div>
        <div><b>${icon('swords')} Call waves.</b> Call the next wave early for bonus gold — if you dare.</div>
        <div><b>${icon('meteor')} Abilities.</b> Meteor Storm (4) devastates an area. Reinforcements (3) plug a leak for a few seconds.</div>
        <div><b>${icon('spike')} Trap the road.</b> Build spike snares, frost runes or blast charges on the road’s rune circles.</div>
        <div><b>${icon('wave')} Moor your Tidecallers.</b> Marked water plots hold one boat each. Choose a mooring that covers the road; unmarked water and lava cannot hold towers.</div>
        <div><b>${icon('gem')} Harvest shards.</b> Spend enemy-dropped Veilshards on Overcharge for a temporary boost, or Ascension for a permanent tier-4 perk.</div>
        <div><b>${icon('moon')} Respect the Veiltide.</b> Marked waves surge with empowered enemies under a violet sky. Calling one early is a gamble.</div>
        <div><b>${icon('link')} Combine towers.</b> Different tower families near each other unlock reactions. Inspect a tower to see its active bonuses and useful neighbors.</div>
        <div><b>${icon('eye')} Know your enemy.</b> Inspect foes for counters. Use magic against armor, arrows against mystics, and air defenses against flyers.</div>
        <div><b><span class="gold-star">★</span> Spend your stars.</b> Victory stars buy permanent upgrades in the Royal Armory, found on the level-select screen.</div>
        <div><b>${icon('moon')} The Long Night.</b> Beat a map to unlock Endless: escalating waves and a boss every tenth. How long can you hold?</div>
        <div><b>${icon('range')} Camera.</b> Drag to pan; right-drag, middle-drag, or Shift+drag to orbit and tilt; scroll to zoom. Touch: pinch to zoom, twist to rotate, two-finger drag to tilt.</div>
        <div><b>${icon('rune')} Hotkeys.</b> Space = call wave · F = speed · P = pause · 1 = hero · 2 = hero ability · 3 = reinforcements · 4 = meteor · V = fullscreen · Q/E rotate · T/G tilt · C = reset view · Esc = cancel/close.</div>
      </div>
    `)
    const close = el('button', 'btn primary', card, 'Got it') as HTMLButtonElement
    close.onclick = () => overlay.remove()
    bindDialog(overlay, card, () => overlay.remove())
  }

export function renderInstallGuide(root: HTMLElement): void {
  const overlay = el('div', 'help-overlay', root)
  const card = el('div', 'help-card install-card', overlay)
  el('h2', '', card, `${icon('fullscreen')} Play fullscreen`)
  el('p', 'install-intro', card, 'Add Blockhold to your Home Screen to play fullscreen on iPhone or iPad.')
  const steps = el('div', 'install-steps', card)
  for (const [i, text] of [
    'Open the <b>Share</b> menu in your browser.',
    'Choose <b>Add to Home Screen</b>, then <b>Add</b>.',
    'Launch <b>Blockhold</b> from your Home Screen.',
  ].entries()) el('div', 'install-step', steps, `<span class="is-num">${i + 1}</span><span class="is-text">${text}</span>`)
  const close = el('button', 'btn primary', card, 'Got it')
  close.onclick = () => overlay.remove()
  bindDialog(overlay, card, () => overlay.remove())
}
