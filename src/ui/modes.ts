import { bindDialog } from './dialog.ts'
import { icon } from './icons.ts'
import { dailyNumber } from '../game/ruleset.ts'
import type { SaveData } from '../core/save.ts'
import type { Screens } from './screens.ts'

/** Secondary ways to play, explained at the point of choosing one. */
export function renderModes(root: HTMLElement, save: SaveData, screens: Screens): void {
  const overlay = document.createElement('div')
  overlay.className = 'help-overlay'
  const card = document.createElement('div')
  card.className = 'help-card modes-sheet'
  card.innerHTML = '<header><h2>Explore modes</h2><button class="tp-close" aria-label="Close modes">×</button></header><p>A different way to hold the line.</p>'
  overlay.append(card); root.append(overlay)
  card.querySelector('button')!.onclick = () => overlay.remove()
  const day = dailyNumber()
  const modes: [string, string, string, () => void][] = [
    ['castle', 'Sandbox', 'Free building, every tower, and enemies on demand. No account rewards.', () => screens.show('sandbox')],
    ['crown', 'Boss hunts & hero paths', 'Take on two signature bosses. Earn hero paths and tower mastery.', () => screens.show('hunts')],
    ['moon', `Daily Hold #${day}`, `The same twelve-wave challenge for everyone. A new board each day.${save.dailyBest?.day === day ? ` Your best: wave ${save.dailyBest.wave}.` : ''}`, () => screens.onPlayDaily()],
    ['music', 'The Bellfoundry', 'A siege set to music. Hits on the beat deal 40% more damage.', () => screens.onPlayBellfoundry()],
    ['respawn', 'The Three Watches', 'Defend three times. Your earlier towers return as echoes to fight beside you.', () => screens.onPlayWatches()],
  ]
  for (const [ico, title, description, play] of modes) {
    const button = document.createElement('button')
    button.className = 'mode-choice'
    button.setAttribute('aria-label', title)
    button.innerHTML = `${icon(ico)}<span><b>${title}</b><small>${description}</small></span><span aria-hidden="true">›</span>`
    button.onclick = () => { overlay.remove(); play() }
    card.append(button)
  }
  bindDialog(overlay, card, () => overlay.remove())
}
