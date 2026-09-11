/** Shared keyboard and dismissal behavior for sheets, including nested help. */
type Sheet = { overlay: HTMLElement, card: HTMLElement, dismiss: () => void }
let sheets: Sheet[] = []
let nextId = 0
const visible = (node: HTMLElement) => node.isConnected && node.getClientRects().length > 0 && !node.closest('.hidden')
const controls = (card: HTMLElement) => [...card.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, summary, [tabindex="0"]')].filter(visible)

export function bindDialog(overlay: HTMLElement, card: HTMLElement, close: () => void): (open: boolean) => void {
  sheets = sheets.filter(sheet => sheet.overlay.isConnected)
  let previous = document.activeElement as HTMLElement | null
  const restore = () => {
    if (document.activeElement instanceof HTMLElement && card.contains(document.activeElement)) document.activeElement.blur()
    if (previous?.isConnected && visible(previous)) previous.focus({ preventScroll: true })
  }
  const dismiss = () => { close(); restore() }
  card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.tabIndex = -1
  const title = card.querySelector('h1, h2, h3')
  if (title && !card.hasAttribute('aria-label')) { title.id ||= `sheet-title-${++nextId}`; card.setAttribute('aria-labelledby', title.id) }
  sheets.push({ overlay, card, dismiss })
  overlay.onclick = event => { if (event.target === overlay) dismiss() }
  overlay.addEventListener('click', () => { if (!visible(overlay)) restore() })
  // Keep pointer users where they tapped; keyboard users enter the new sheet.
  if (previous?.matches(':focus-visible')) queueMicrotask(() => { if (visible(card)) (controls(card)[0] ?? card).focus({ preventScroll: true }) })
  return open => {
    if (!open) { restore(); return }
    previous = document.activeElement as HTMLElement | null
    if (previous?.matches(':focus-visible')) (controls(card)[0] ?? card).focus({ preventScroll: true })
  }
}

if (typeof document !== 'undefined') document.addEventListener('keydown', event => {
  sheets = sheets.filter(sheet => sheet.overlay.isConnected)
  const sheet = [...sheets].reverse().find(sheet => visible(sheet.overlay))
  if (!sheet) return
  // No gameplay hotkeys, including Space and Pause, may pass through a sheet.
  event.stopPropagation()
  if (event.key === 'Escape') { event.preventDefault(); sheet.dismiss(); return }
  if (event.key !== 'Tab') return
  const items = controls(sheet.card), first = items[0], last = items.at(-1)
  const active = document.activeElement
  if (!first) { event.preventDefault(); sheet.card.focus(); return }
  if (!sheet.card.contains(active) || event.shiftKey && active === first || !event.shiftKey && active === last) {
    event.preventDefault(); (event.shiftKey ? last : first)?.focus()
  }
})
