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
    <p class="fusion-keeps"></p><details class="fusion-location"><summary>Show tower positions</summary><div class="fusion-map"></div><small>Gold circle: stays · red cross: sacrificed</small></details><fieldset><legend>Choose the tower to sacrifice</legend><div class="fusion-donors"></div></fieldset>
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
    const preview = document.createElement('img')
    preview.src = `art/towers/${candidate.def.model}.webp`; preview.alt = ''; preview.width = preview.height = 60
    label.append(radio, preview, text)
    radio.onchange = () => { donor = candidate; confirm.disabled = false; confirm.textContent = `Sacrifice plot ${candidate.plot.index + 1} & awaken`; drawMap() }
    overlay.querySelector('.fusion-donors')!.append(label)
  }
  function drawMap() {
    if (!game.level || !game.terrain) return
    const w = game.level.width, h = game.level.height
    const point = (x: number, z: number) => `${x+w/2},${z+h/2}`
    overlay.querySelector('.fusion-map')!.innerHTML = `<svg viewBox="-1 -1 ${w+2} ${h+2}" role="img" aria-label="Battlefield positions. Plot ${keeper.plot.index+1} stays${donor ? `; plot ${donor.plot.index+1} is sacrificed` : ''}.">
      ${game.lanes.map(l=>`<polyline points="${l.points.map(p=>point(p.x,p.y)).join(' ')}" fill="none" stroke="#55636a" stroke-width=".3"/>`).join('')}
      ${game.terrain.plots.map(p=>`<rect x="${p.pos.x+w/2-.25}" y="${p.pos.z+h/2-.25}" width=".5" height=".5" fill="#7d878b"/>`).join('')}
      ${[keeper,...candidates].map(t=>`<g transform="translate(${point(t.pos.x,t.pos.z)})">${t===donor ? '<path d="M-.45,-.45 L.45,.45 M-.45,.45 L.45,-.45" stroke="#ff8584" stroke-width=".2"/>' : `<circle r=".4" fill="${t===keeper?'#e2c489':'#8296a5'}"/>`}<text y="-0.7" text-anchor="middle" fill="#f3f1e9" font-size=".8">${t.plot.index+1}</text></g>`).join('')}</svg>`
  }
  drawMap()
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
