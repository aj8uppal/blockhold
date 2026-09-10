import type { CoopSession } from '../core/coop.ts'

/** Room chat is UI-only: it never enters the deterministic command journal. */
export function mountCoopChat(parent: HTMLElement, session: CoopSession): () => void {
  const wrap = document.createElement('details')
  wrap.className = 'coop-chat'
  Object.assign(wrap.style, { position: 'fixed', right: '12px', bottom: '12px', zIndex: '45', width: 'auto', maxWidth: 'calc(100vw - 24px)', background: 'rgba(24,20,16,.96)', color: '#f3e5ca', border: '1px solid #967238', borderRadius: '10px', font: '14px sans-serif', pointerEvents: 'auto', boxShadow: '0 3px 18px #0008' })
  const summary = document.createElement('summary')
  summary.textContent = 'Room chat'
  Object.assign(summary.style, { cursor: 'pointer', padding: '10px 12px', userSelect: 'none' })
  wrap.append(summary)
  const log = document.createElement('div')
  log.setAttribute('role', 'log')
  log.setAttribute('aria-label', 'Room messages')
  log.setAttribute('aria-live', 'polite')
  Object.assign(log.style, { maxHeight: 'min(190px, 30vh)', overflowY: 'auto', padding: '0 12px', overflowWrap: 'anywhere' })
  wrap.append(log)
  const form = document.createElement('form')
  Object.assign(form.style, { display: 'flex', gap: '6px', padding: '10px' })
  const input = document.createElement('input')
  input.type = 'text'
  input.maxLength = 240
  input.placeholder = 'Message your allies'
  input.setAttribute('aria-label', 'Chat message')
  Object.assign(input.style, { minWidth: '0', flex: '1', padding: '7px', color: '#f3e5ca', background: '#ffffff0b', border: '1px solid #967238', borderRadius: '5px' })
  const send = document.createElement('button')
  send.type = 'submit'
  send.textContent = 'Send'
  send.className = 'btn small'
  form.append(input, send)
  wrap.append(form)
  const status = document.createElement('div')
  status.setAttribute('role', 'status')
  Object.assign(status.style, { padding: '0 12px 8px', fontSize: '12px' })
  wrap.append(status)
  let unread = 0
  const add = (seat: number, text: string, historical = false) => {
    const row = document.createElement('p')
    row.textContent = `${seat === session.seat ? 'You' : `Warden ${seat + 1}`}: ${text}`
    row.style.margin = '7px 0'
    log.append(row)
    while (log.childElementCount > 30) log.firstElementChild?.remove()
    if (!wrap.open && seat !== session.seat && !historical) unread = Math.min(99, unread + 1)
    summary.textContent = unread ? `Room chat · ${unread} new` : 'Room chat'
    if (wrap.open) log.scrollTop = log.scrollHeight
  }
  for (const event of session.replayEvents.filter(event => event.type === 'chat').slice(-30)) {
    if (event.type === 'chat') add(event.seat, event.payload, true)
  }
  wrap.ontoggle = () => {
    wrap.style.width = wrap.open ? 'min(280px, calc(100vw - 24px))' : 'auto'
    if (wrap.open) { unread = 0; summary.textContent = 'Room chat'; log.scrollTop = log.scrollHeight }
  }
  // Typing, sending and scrolling chat must not command the hero or zoom the battlefield.
  for (const name of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'wheel']) {
    wrap.addEventListener(name, event => event.stopPropagation())
  }
  form.onsubmit = async event => {
    event.preventDefault()
    const text = input.value.trim()
    if (!text || send.disabled) return
    send.disabled = true
    status.textContent = ''
    const ok = await session.send('chat', text)
    if (ok) input.value = ''
    else status.textContent = 'Could not send. Check the connection or wait a few seconds.'
    send.disabled = false
    input.focus()
  }
  const unsubscribe = session.on(event => {
    if (event.type === 'chat') add(event.seat, event.payload)
    if (event.type === 'connection') status.textContent = event.connected ? '' : session.lost ? 'This room is no longer available.' : 'Reconnecting…'
  })
  parent.append(wrap)
  return () => { unsubscribe(); wrap.remove() }
}
