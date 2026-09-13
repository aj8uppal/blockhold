import { CRIMSON_SOVEREIGN } from '../game/seraphFusion.ts'
import type { Game } from '../game/game.ts'
import type { Tower } from '../game/towers.ts'
import { bindDialog } from './dialog.ts'
import './seraphFusion.css'

/** Explicitly choose the plot that disappears. Battle commands are still
 * checked when the room executes them, since a teammate may act first. */
export function showSeraphFusion(game: Game, keeper: Tower): void {
  if (document.querySelector('.fusion-overlay')) return
  const candidates = game.fusionCandidates(keeper)
  if (!candidates.length) { game.hud.showToast('Requires an opposite tier-six Seraph.', 3); return }
  const overlay = document.createElement('div')
  overlay.className = 'fusion-overlay'
  overlay.innerHTML = `<section class="fusion-card">
    <header><div><small>SOLAR + VOID</small><h2>Awaken the Crimson Sovereign</h2></div><button class="btn small" data-close aria-label="Close preview">✕</button></header>
    <div class="fusion-result"><img src="art/towers/seraphCrimson.webp" width="384" height="384" alt="Crimson Sovereign"><div><strong>One overwhelming gaze.</strong><p>${CRIMSON_SOVEREIGN.description}</p></div></div>
    <p class="fusion-keeps"></p><fieldset><legend>Choose the tower to sacrifice</legend><div class="fusion-donors"></div></fieldset>
    <p class="fusion-warning">Permanent sacrifice, no refund. The plot stays available. The survivor keeps its ascension, targeting and sell value.</p>
    <p class="fusion-status" role="status"></p><footer><button class="btn" data-cancel>Keep both towers</button><button class="btn fusion-confirm" disabled>Sacrifice & awaken</button></footer>
  </section>`
  const card = overlay.querySelector<HTMLElement>('.fusion-card')!
  overlay.querySelector('.fusion-keeps')!.textContent = `Stays: ${keeper.def.name} · plot ${keeper.plot.index + 1}. No additional gold needed.`
  const confirm = overlay.querySelector<HTMLButtonElement>('.fusion-confirm')!
  let donor: Tower | null = null
  for (const candidate of candidates) {
    const label = document.createElement('label')
    const radio = document.createElement('input')
    radio.type = 'radio'; radio.name = 'fusion-donor'; radio.value = String(candidate.plot.index)
    const text = document.createElement('span')
    text.textContent = `${candidate.def.name} · plot ${candidate.plot.index + 1}`
    label.append(radio, text)
    radio.onchange = () => { donor = candidate; confirm.disabled = false; confirm.textContent = `Sacrifice plot ${candidate.plot.index + 1} & awaken` }
    overlay.querySelector('.fusion-donors')!.append(label)
  }
  document.body.append(overlay)
  const focus = bindDialog(overlay, card, close)
  function close() { focus(false); overlay.remove() }
  overlay.querySelector<HTMLButtonElement>('[data-close]')!.onclick = close
  overlay.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = close
  confirm.onclick = () => {
    if (!donor || !game.fuseSeraph(keeper, donor)) {
      overlay.querySelector('.fusion-status')!.textContent = game.paused ? 'Resume the battle before awakening.' : 'Defense changed. Close and choose again.'
      return
    }
    close()
  }
}
