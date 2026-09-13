import { holdSnapshot } from '../hold/catalog.ts'
import type { HoldSnapshot } from '../core/holdData.ts'
import { readSession } from '../game/session.ts'
import { HUNTS, huntAccess } from '../game/hunts.ts'
import type { SaveData } from '../core/save.ts'
import type { Difficulty, HeroId } from '../game/types.ts'
import { levels } from '../game/levels.ts'
import { HERO_DEFS } from '../game/hero.ts'
import { isUnlocked } from '../game/progress.ts'
import { difficultyMods } from '../game/difficulty.ts'
import { newRunSeed } from '../game/ruleset.ts'
import { CoopSession, type CoopSetup, type CoopEvent } from '../core/coop.ts'
import { icon } from './icons.ts'
import type { ScreenName } from './screens.ts'

/**
 * The co-op lobby: a room, a code to share, who is here, and - for the host -
 * what to fight. Its own chunk, loaded when the Co-op button is pressed, so
 * the first visit never pays for it.
 */
export interface LobbyApi {
  preview: (snapshot: HoldSnapshot) => Promise<() => void>
  root: HTMLElement
  save: () => SaveData
  show: (name: ScreenName) => void
  isCurrent: () => boolean
  onCoopStart: (session: CoopSession, setup: CoopSetup) => void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

let coopSession: CoopSession | null = null
let coopUnsub: (() => void) | null = null
let coopSetup: CoopSetup | null = null


/** leave whatever room the lobby holds */
export function leaveCoopLobby(): void {
  coopUnsub?.()
  coopUnsub = null
  coopSession?.close(true)
  coopSession = null
  coopSetup = null
}

/**
 * The room. A code to share, who is here, and - for the host - what to
 * fight. The battle starts for everyone on the host's word; the room is
 * then the game's, and this lobby only rerenders while it is on screen.
 */
export function renderCoopLobby(api: LobbyApi, prefill?: string): () => void {
  const save = api.save()
  let onlineCleanup = () => {}
  let disposed = false, sceneCleanup: (() => void) | null = null, sceneVersion = 0
  const preview = (snapshot: HoldSnapshot) => {
    const version = ++sceneVersion
    sceneCleanup?.(); sceneCleanup = null
    void api.preview(snapshot).then(cleanup => { if (disposed || version !== sceneVersion) cleanup(); else sceneCleanup = cleanup })
  }
  const cleanup = () => { disposed = true; sceneVersion++; sceneCleanup?.(); onlineCleanup() }
  const wrap = el('div', 'screen menu-screen gathering-screen', api.root)
  const card = el('div', 'menu-hero coop-card', wrap)
  el('h2', 'coop-title', card, `${icon('helmPlume')} Co-op`)
  const session = coopSession
  preview(session?.setup?.hold ?? holdSnapshot(save))

  if (!session) {
    el('div', 'coop-sub', card, 'Gather at your Hold, choose a battlefield, and defend together. Up to four wardens share gold and lives.')
    if (readSession()) el('p', 'coop-sub dim', card, 'Opening a room keeps your saved solo battle. Starting a new battle replaces that continuation.')
    const open = el('button', 'btn primary big', card, `${icon('castle')} Open a room`) as HTMLButtonElement
    const err = el('div', 'coop-error', card, '')
    if (CoopSession.savedRoom()) {
      const rejoin = el('button', 'btn', card, 'Rejoin your room')
      rejoin.onclick = async () => {
        rejoin.disabled = true
        try {
          const next = await CoopSession.resume()
          if (disposed) { next.close(); return }
          coopSession = next
          attachCoop(api)
          if (coopSession && !disposed) api.show('coop')
        } catch (e) { err.textContent = e instanceof Error ? e.message : 'Could not rejoin'; rejoin.disabled = false }
      }
    }
    open.onclick = async () => {
      open.disabled = true
      try {
        const next = await CoopSession.create()
          if (disposed) { next.close(); return }
          coopSession = next
        attachCoop(api)
        if (coopSession && !disposed) api.show('coop')
      } catch (e) {
        err.textContent = e instanceof Error ? e.message : 'Could not open a room'
        open.disabled = false
      }
    }
    el('div', 'diff-sub', card, 'or join a friend')
    const row = el('div', 'coop-join', card)
    const input = el('input', 'coop-input', row) as HTMLInputElement
    input.placeholder = 'ABCDE'
    input.setAttribute('aria-label', 'Room code')
    input.maxLength = 5
    input.autocapitalize = 'characters'
    input.spellcheck = false
    if (prefill) input.value = prefill
    const join = el('button', 'btn', row, 'Join') as HTMLButtonElement
    const doJoin = async () => {
      const code = input.value.trim()
      if (code.length < 5) { err.textContent = 'A room code is five letters'; return }
      join.disabled = true
      try {
        const next = await CoopSession.join(code)
          if (disposed) { next.close(); return }
          coopSession = next
        attachCoop(api)
        if (coopSession && !disposed) api.show('coop')
      } catch (e) {
        err.textContent = e instanceof Error ? e.message : 'Could not join'
        join.disabled = false
      }
    }
    join.onclick = doJoin
    input.onkeydown = ev => { if (ev.key === 'Enter') void doJoin() }
    if (prefill && prefill.length === 5) void doJoin()
    const back = el('button', 'btn ghost', card, '← Menu') as HTMLButtonElement
    back.onclick = () => api.show('menu')
    return cleanup
  }

  // in a room
  el('div', 'coop-code', card, session.code)
  el('div', 'coop-sub', card, session.isHost ? 'Send this code, or the link, to whoever is joining you.' : 'You are in. The host chooses the battle and starts it.')
  const share = el('button', 'btn', card, `${icon('share')} Copy invite link`) as HTMLButtonElement
  share.onclick = async () => {
    const url = session.shareUrl()
    try { await navigator.clipboard.writeText(url); share.textContent = 'Link copied' } catch { share.textContent = url }
    setTimeout(() => { share.innerHTML = `${icon('share')} Copy invite link` }, 2200)
  }
  let streamOnline = session.connected.includes(session.seat)
  const who = el('div', 'gathering-seats', card)
  const error = el('p', 'coop-error', card); error.setAttribute('role', 'status')
  let pending = false
  const plan = el('div', 'coop-plan', card)
  const paintWho = () => {
    who.replaceChildren()
    for (let id = 0; id < 4; id++) {
      const member = session.members.includes(id), connected = session.connected.includes(id) && (id !== session.seat || streamOnline && navigator.onLine), ready = session.readySeats.includes(id)
      const cell = el('div', `gathering-seat${connected ? ' connected' : ''}`, who)
      el('strong', '', cell, id === 0 ? 'Host' : `Warden ${id + 1}`)
      el('span', '', cell, !member ? 'Open seat' : !connected ? 'Reconnecting…' : ready ? 'Ready ✓' : 'Choosing')
    }
    const st = session.setup
    if (st) {
      const lvl = levels.find(l => l.id === st.levelId) ?? HUNTS.find(h => `hunt-${h.id}` === st.levelId)
      plan.textContent = `${st.mode === 'sandbox' ? 'Sandbox · ' : ''}${lvl?.name ?? st.levelId} · ${difficultyMods(st.levelId, st.difficulty).name} · ${HERO_DEFS[st.hero]?.name ?? st.hero}`
    } else plan.textContent = 'The host is choosing the battle…'
  }
  const send = async (type: string, payload?: unknown) => {
    pending = true; paint(); error.textContent = ''
    const ok = await session.send(type, payload)
    pending = false
    if (!ok) error.textContent = 'Could not update the room. Check your connection and try again.'
    if (!disposed) paint()
    return ok
  }
  if (session.isHost) {
    const setup = session.setup ?? coopSetup ?? defaultCoopSetup(save)
    coopSetup = setup
    const details = el('details', 'gathering-settings', card)
    el('summary', '', details, 'Battle settings')
    const update = async (patch: Partial<CoopSetup>) => {
      const next = { ...(session.setup ?? coopSetup ?? setup), ...patch }
      if (await send('setup', next)) coopSetup = next
    }
    el('label', 'diff-sub', details, 'Mode')
    const mode = el('select', 'coop-select', details); mode.setAttribute('aria-label', 'Co-op battle mode')
    for (const [value, label] of [['campaign', 'Campaign'], ['sandbox', 'Sandbox · no rewards']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = label; option.selected = value === (setup.mode ?? 'campaign'); mode.append(option)
    }
    mode.onchange = async () => { if (await send('setup', { ...setup, mode: mode.value, levelId: levels[0].id, hero: 'aldric' })) api.show('coop') }
    el('label', 'diff-sub', details, 'Battlefield')
    const sel = el('select', 'coop-select', details); sel.setAttribute('aria-label', 'Co-op battlefield')
    levels.forEach((lvl, i) => {
      if (setup.mode !== 'sandbox' && i >= save.unlocked) return
      const o = document.createElement('option'); o.value = lvl.id; o.textContent = lvl.name; o.selected = lvl.id === setup.levelId; sel.append(o)
    })
    if (setup.mode !== 'sandbox' && huntAccess(save)) for (const hunt of HUNTS) {
      const o = document.createElement('option'); o.value = `hunt-${hunt.id}`; o.textContent = hunt.name; o.selected = o.value === setup.levelId; sel.append(o)
    }
    sel.onchange = () => { void update({ levelId: sel.value }) }
    el('label', 'diff-sub', details, 'Champion')
    const hero = el('select', 'coop-select', details); hero.setAttribute('aria-label', 'Co-op champion')
    for (const def of Object.values(HERO_DEFS)) {
      if (setup.mode !== 'sandbox' && !isUnlocked(save, 'hero', def.id)) continue
      const option = document.createElement('option'); option.value = def.id; option.textContent = def.name; option.selected = def.id === setup.hero; hero.append(option)
    }
    hero.onchange = () => { void update({ hero: hero.value as HeroId }) }
    el('label', 'diff-sub', details, 'Difficulty')
    const diff = el('select', 'coop-select', details); diff.setAttribute('aria-label', 'Co-op difficulty')
    for (const key of ['casual', 'normal', 'veteran'] as Difficulty[]) {
      const option = document.createElement('option'); option.value = key; option.textContent = difficultyMods(setup.levelId, key).name; option.selected = key === setup.difficulty; diff.append(option)
    }
    diff.onchange = () => { void update({ difficulty: diff.value as Difficulty }) }
  }
  const ready = el('button', 'btn primary', card, 'Ready')
  ready.onclick = () => { void send('lobbyReady', { revision: session.lobbyRevision, ready: !session.readySeats.includes(session.seat) }) }
  const start = session.isHost ? el('button', 'btn primary big', card, 'Start the battle') : null
  if (start) start.onclick = () => { void send('start') }
  const help = el('p', 'coop-sub dim', card)
  let lastHold = JSON.stringify(session.setup?.hold)
  function paint(event?: CoopEvent): void {
    if (!session) return
    if (event?.type === 'connection') streamOnline = event.connected
    if (event?.type === 'hello' || event?.type === 'presence') streamOnline = true
    paintWho()
    const connected = navigator.onLine && streamOnline && session.connected.includes(session.seat)
    ready.textContent = session.readySeats.includes(session.seat) ? 'Ready ✓ · tap to undo' : 'Ready'
    ready.disabled = pending || !connected || !session.setup
    ready.setAttribute('aria-pressed', String(session.readySeats.includes(session.seat)))
    if (start) start.disabled = pending || !connected || !session.setup || !session.members.every(id => session.readySeats.includes(id) && session.connected.includes(id))
    card.querySelectorAll('select').forEach(select => { select.disabled = pending || !connected })
    help.textContent = !connected ? 'Reconnecting to the room…' : session.setup?.gathering ? 'Everyone readies up. The host starts when the party is ready. Tap a trophy to inspect it.' : 'This room uses an older lobby. The host can start when everyone is ready.'
    const current = JSON.stringify(session.setup?.hold)
    if (current !== lastHold && session.setup?.hold) { lastHold = current; preview(session.setup.hold) }
  }
  coopPaint = paint
  const networkChanged = () => paint()
  window.addEventListener('online', networkChanged); window.addEventListener('offline', networkChanged)
  onlineCleanup = () => { window.removeEventListener('online', networkChanged); window.removeEventListener('offline', networkChanged) }
  paint()
  if (session.isHost && !session.setup) {
    const setup = coopSetup ?? defaultCoopSetup(save)
    void send('setup', setup)
  }
  const leave = el('button', 'btn ghost', card, 'Leave the room') as HTMLButtonElement
  leave.onclick = async () => {
    leave.disabled = true
    if (await session.send('leaveLobby')) { leaveCoopLobby(); api.show('menu') }
    else { error.textContent = 'Could not leave the room. Try again when connected.'; leave.disabled = false }
  }
  const back = el('button', 'btn ghost', card, 'Back to menu')
  back.onclick = () => {
    // Keep the private seat so a dropped connection can be resumed later.
    coopUnsub?.(); coopUnsub = null; session.close(); coopSession = null; coopSetup = null; api.show('menu')
  }
  return cleanup
}

let coopPaint: (event?: CoopEvent) => void = () => {}

function defaultCoopSetup(save: SaveData): CoopSetup {
  const last = levels[Math.max(0, Math.min(save.unlocked, levels.length) - 1)]
  const hero = (Object.hasOwn(HERO_DEFS, save.lastHero) && isUnlocked(save, 'hero', save.lastHero as HeroId) ? save.lastHero : 'aldric') as HeroId
  return { levelId: last.id, difficulty: 'normal', hero, seed: newRunSeed(), gathering: true, hold: holdSnapshot(save), loadout: { armory: { ...save.armory }, xp: save.xp, stars: { ...save.stars }, honors: [...(save.honors ?? [])], heroPaths: { ...save.heroPaths } } }
}

function attachCoop(api: LobbyApi): void {
  const session = coopSession
  if (!session) return
  coopUnsub?.()
  coopUnsub = session.on(e => {
    if (e.type === 'start' || (e.type === 'hello' && e.started && e.setup)) {
      // the game takes the room from here; the lobby lets go without closing it
      coopUnsub?.()
      coopUnsub = null
      coopSession = null
      coopSetup = null
      api.onCoopStart(session, e.setup!)
      return
    }
    if (!api.isCurrent()) return
    if (e.type === 'presence' || e.type === 'hello' || e.type === 'setup' || e.type === 'connection') coopPaint(e)
    if (e.type === 'end') { leaveCoopLobby(); api.show('coop') }
  })
  if (session.started && session.setup) {
    coopUnsub?.(); coopUnsub = null; coopSession = null; coopSetup = null
    api.onCoopStart(session, session.setup)
  }
  session.connect()
}
