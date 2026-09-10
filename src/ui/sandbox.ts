import type { Game } from '../game/game.ts'
import { enemyDefs } from '../game/enemyDefs.ts'

/** A compact drawer: the board remains selectable outside the controls. */
export function mountSandbox(root: HTMLElement, game: Game): void {
  root.querySelector('.sandbox-tools')?.remove()
  const drawer = document.createElement('details')
  drawer.className = 'sandbox-tools'
  const summary = document.createElement('summary')
  summary.textContent = 'Sandbox tools'
  drawer.append(summary)
  const body = document.createElement('div')
  body.className = 'sandbox-body'
  drawer.append(body)
  const note = document.createElement('p')
  note.textContent = 'Free building · no account rewards'
  body.append(note)
  const select = (title: string, options: Array<[string, string]>) => {
    const label = document.createElement('label')
    label.textContent = title
    const input = document.createElement('select')
    input.setAttribute('aria-label', title)
    for (const [value, text] of options) {
      const option = document.createElement('option')
      option.value = value; option.textContent = text; input.append(option)
    }
    label.append(input); body.append(label)
    return input
  }
  const enemy = select('Enemy', [...enemyDefs.values()].map(def => [def.id, def.name]))
  const count = select('Count', [1, 5, 10, 25].map(n => [`${n}`, `${n}`]))
  const hp = select('Health', [1, 5, 20, 100].map(n => [`${n}`, `${n}× health`]))
  const lane = select('Road', game.lanes.map((_, i) => [`${i}`, `Road ${i + 1}`]))
  const action = (text: string, fn: () => void, primary = false) => {
    const button = document.createElement('button')
    button.className = `btn${primary ? ' primary' : ''}`
    button.textContent = text
    button.onclick = fn
    body.append(button)
  }
  action('Send enemies', () => {
    game.sandboxOrder({ kind: 'sandboxSpawn', enemy: enemy.value, count: Number(count.value), hp: Number(hp.value), lane: Number(lane.value) })
    if (!game.paused) drawer.open = false
  }, true)
  action('Clear enemies', () => game.sandboxOrder({ kind: 'sandboxClear' }))
  action('Reset abilities', () => game.sandboxOrder({ kind: 'sandboxReset' }))
  action('Close tools', () => { drawer.open = false })
  for (const event of ['pointerdown', 'pointerup', 'click', 'wheel']) drawer.addEventListener(event, e => e.stopPropagation())
  const parent = root.querySelector('.topbar') ?? root
  parent.append(drawer)
}
