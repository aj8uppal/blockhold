import type { SaveData } from '../core/save.ts'
import type { Difficulty, HeroId } from '../game/types.ts'
import { levels } from '../game/levels.ts'
import { HERO_DEFS } from '../game/hero.ts'
import { isUnlocked } from '../game/progress.ts'
import { difficultyMods } from '../game/difficulty.ts'
import { newRunSeed } from '../game/ruleset.ts'
import { CoopSession, type CoopSetup } from '../core/coop.ts'
import { icon } from './icons.ts'
import type { ScreenName } from './screens.ts'

/**
 * The co-op lobby: a room, a code to share, who is here, and - for the host -
 * what to fight. Its own chunk, loaded when the Co-op button is pressed, so
 * the first visit never pays for it.
 */
export interface LobbyApi {
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
  coopSession?.close()
  coopSession = null
  coopSetup = null
}

/**
 * The room. A code to share, who is here, and - for the host - what to
 * fight. The battle starts for everyone on the host's word; the room is
 * then the game's, and this lobby only rerenders while it is on screen.
 */
export function renderCoopLobby(api: LobbyApi, prefill?: string): void {
  const save = api.save()
  const wrap = el('div', 'screen menu-screen', api.root)
  const card = el('div', 'menu-hero coop-card', wrap)
  el('h2', 'coop-title', card, `${icon('helmPlume')} Co-op`)
  const session = coopSession

  if (!session) {
    el('div', 'coop-sub', card, 'One battle, one board, two or more wardens. Shared gold, shared lives, and everything either of you builds counts.')
    const open = el('button', 'btn primary big', card, `${icon('castle')} Open a room`) as HTMLButtonElement
    const err = el('div', 'coop-error', card, '')
    open.onclick = async () => {
      open.disabled = true
      try {
        coopSession = await CoopSession.create()
        attachCoop(api)
        api.show('coop')
      } catch (e) {
        err.textContent = e instanceof Error ? e.message : 'Could not open a room'
        open.disabled = false
      }
    }
    el('div', 'diff-sub', card, 'or join a friend')
    const row = el('div', 'coop-join', card)
    const input = el('input', 'coop-input', row) as HTMLInputElement
    input.placeholder = 'ROOM CODE'
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
        coopSession = await CoopSession.join(code)
        attachCoop(api)
        api.show('coop')
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
    return
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
  const who = el('div', 'coop-who', card, '')
  const paintWho = () => {
    const n = session.connected.length
    who.innerHTML = `${icon('helmPlume')} <b>${n}</b> of <b>${session.seats}</b> ${session.seats === 1 ? 'warden' : 'wardens'} connected` +
      (session.seats < 2 ? ' · waiting for a friend' : n < session.seats ? ' · someone is reconnecting' : '')
  }
  paintWho()

  if (session.isHost) {
    const setup = coopSetup ?? defaultCoopSetup(save)
    coopSetup = setup
    const sendSetup = () => { coopSetup = setup; void session.send('setup', setup) }
    el('div', 'diff-sub', card, 'Choose the battlefield')
    const sel = el('select', 'coop-select', card) as HTMLSelectElement
    levels.forEach((lvl, i) => {
      if (i >= save.unlocked) return
      const o = document.createElement('option')
      o.value = lvl.id; o.textContent = `${i + 1}. ${lvl.name}`
      if (lvl.id === setup.levelId) o.selected = true
      sel.appendChild(o)
    })
    sel.onchange = () => { setup.levelId = sel.value; sendSetup() }
    el('div', 'diff-sub', card, 'Champion')
    const heroRow = el('div', 'mode-row', card)
    for (const def of Object.values(HERO_DEFS)) {
      if (!isUnlocked(save, 'hero', def.id)) continue
      const b = el('button', `mode-option${setup.hero === def.id ? ' picked' : ''}`, heroRow, def.name) as HTMLButtonElement
      b.onclick = () => { setup.hero = def.id; heroRow.querySelectorAll('.mode-option').forEach(x => x.classList.toggle('picked', x === b)); sendSetup() }
    }
    el('div', 'diff-sub', card, 'Challenge')
    const diffRow = el('div', 'mode-row', card)
    for (const key of ['casual', 'normal', 'veteran'] as Difficulty[]) {
      const d = difficultyMods(setup.levelId, key)
      const b = el('button', `mode-option${setup.difficulty === key ? ' picked' : ''}`, diffRow, d.name) as HTMLButtonElement
      b.onclick = () => { setup.difficulty = key; diffRow.querySelectorAll('.mode-option').forEach(x => x.classList.toggle('picked', x === b)); sendSetup() }
    }
    const start = el('button', 'btn primary big', card, `${icon('swords')} Start the battle`) as HTMLButtonElement
    const paintStart = () => { start.disabled = session.seats < 2 || session.connected.length < session.seats }
    paintStart()
    start.onclick = () => {
      setup.seed = newRunSeed()
      setup.loadout = { armory: { ...save.armory }, xp: save.xp }
      void session.send('start', setup)
    }
    // the first setup goes out as soon as the room has a picture to send
    sendSetup()
    coopPaint = () => { paintWho(); paintStart() }
  } else {
    const plan = el('div', 'coop-plan', card, '')
    const paintPlan = () => {
      const st = session.setup
      if (!st) { plan.textContent = 'The host is choosing…'; return }
      const lvl = levels.find(l => l.id === st.levelId)
      plan.innerHTML = `${icon('swords')} <b>${lvl?.name ?? st.levelId}</b> · ${difficultyMods(st.levelId, st.difficulty).name} · ${HERO_DEFS[st.hero]?.name ?? st.hero}`
    }
    paintPlan()
    el('div', 'coop-sub dim', card, 'Waiting for the host to start…')
    coopPaint = () => { paintWho(); paintPlan() }
  }
  const leave = el('button', 'btn ghost', card, 'Leave the room') as HTMLButtonElement
  leave.onclick = () => { leaveCoopLobby(); api.show('menu') }
}

let coopPaint: () => void = () => {}

function defaultCoopSetup(save: SaveData): CoopSetup {
  const last = levels[Math.max(0, Math.min(save.unlocked, levels.length) - 1)]
  const hero = (isUnlocked(save, 'hero', save.lastHero as HeroId) ? save.lastHero : 'aldric') as HeroId
  return { levelId: last.id, difficulty: 'normal', hero, seed: 0, loadout: { armory: { ...save.armory }, xp: save.xp } }
}

function attachCoop(api: LobbyApi): void {
  const session = coopSession
  if (!session) return
  coopUnsub?.()
  coopUnsub = session.on(e => {
    if (e.type === 'start') {
      // the game takes the room from here; the lobby lets go without closing it
      coopUnsub?.()
      coopUnsub = null
      coopSession = null
      coopSetup = null
      api.onCoopStart(session, e.setup)
      return
    }
    if (!api.isCurrent()) return
    if (e.type === 'presence' || e.type === 'hello' || e.type === 'setup') coopPaint()
    if (e.type === 'end') { leaveCoopLobby(); api.show('coop') }
  })
  session.connect()
}

