import type { CoopSession } from '../core/coop.ts'

/** Room chat is UI-only: it never enters the deterministic command journal. */
export function mountCoopChat(parent: HTMLElement, session: CoopSession): () => void {
  const wrap = document.createElement('details')
  wrap.className = 'coop-chat'
  document.body.classList.add('has-room-chat')
  const summary = document.createElement('summary')
  summary.textContent = 'Room chat'
  wrap.append(summary)
  const log = document.createElement('div')
  log.className = 'chat-log'
  log.setAttribute('role', 'log')
  log.setAttribute('aria-label', 'Room messages')
  log.setAttribute('aria-live', 'polite')
  wrap.append(log)
  const form = document.createElement('form')
  const input = document.createElement('input')
  input.type = 'text'
  input.maxLength = 240
  input.placeholder = 'Message your allies'
  input.setAttribute('aria-label', 'Chat message')
  const send = document.createElement('button')
  send.type = 'submit'
  send.textContent = 'Send'
  send.className = 'btn small'
  form.append(input, send)
  wrap.append(form)
  const status = document.createElement('div')
  status.className = 'chat-status'
  status.setAttribute('role', 'status')
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
    summary.setAttribute('aria-label', wrap.open ? 'Close room chat' : 'Open room chat')
    if (wrap.open) { unread = 0; summary.textContent = 'Room chat'; log.scrollTop = log.scrollHeight }
  }
  // Typing, sending and scrolling chat must not command the hero or zoom the battlefield.
  for (const name of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'wheel']) {
    wrap.addEventListener(name, event => {
      if (name === 'keydown' && (event as KeyboardEvent).key === 'Escape') { wrap.open = false; input.blur(); summary.focus() }
      event.stopPropagation()
    })
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
  const resize = new ResizeObserver(() => document.documentElement.style.setProperty('--room-chat-height', `${wrap.getBoundingClientRect().height}px`))
  resize.observe(wrap)
  return () => { unsubscribe(); resize.disconnect(); wrap.remove(); document.body.classList.remove('has-room-chat'); document.documentElement.style.removeProperty('--room-chat-height') }
}
