import { bindDialog } from './dialog.ts'
import { downloadBattleBackup } from '../game/battleBackup.ts'
import { readSession, readSessionIssue } from '../game/session.ts'
import { huntById, type HuntId } from '../game/hunts.ts'
import { heroPath } from '../game/heroPaths.ts'
// the field guide and the cards are reading rooms, opened on demand: lazy chunks
import type { CoopSession, CoopSetup } from '../core/coop.ts'
import { coopEnabled } from '../core/coopLink.ts'
import { levels, levelById } from '../game/levels.ts'
import { Difficulty, HeroId } from '../game/types.ts'
import { difficultyMods } from '../game/difficulty.ts'
import { HERO_DEFS } from '../game/hero.ts'
import { starsAvailable, starsEarned, buyTier, respec, armoryTier, crownStars, visibleTracks, trialStars, ARMORY_TOTAL_COST } from '../game/armory.ts'
import { TRIAL_KINDS, TRIAL_NAMES, TRIAL_ICONS, trialFor, trialsWon, type TrialKind } from '../game/trials.ts'
import { writeSave } from '../core/save.ts'
import type { SaveData } from '../core/save.ts'
import { icon } from './icons.ts'
import { readCheckpoint } from '../game/checkpoint.ts'
import { setTelemetryAllowed, telemetryAllowed } from '../core/sink.ts'
import { fetchDaily, leaderboardEnabled, nickname, setNickname } from '../core/leaderboard.ts'
import { holdPieces, holdSummary } from '../game/hold.ts'
import { isUnlocked, levelProgress, nextUnlock, unlockLevel, xpForLevel, MAX_LEVEL, type UnlockDef } from '../game/progress.ts'
import { cloud } from '../core/cloud.ts'
import { dailyShareText, challengeUrl, runChallengeUrl, runShareText, type DailyResult } from '../game/share.ts'

export type ScreenName = 'menu' | 'sandbox' | 'levels' | 'victory' | 'defeat' | 'coop' | 'hunts' | 'none'

const THEME_ART: Record<string, string> = {
  forest: 'linear-gradient(160deg, #79c057 0%, #4e9a3d 55%, #2e7a52 100%)',
  winter: 'linear-gradient(160deg, #d8ecf6 0%, #9cc4dd 55%, #5b87b0 100%)',
  ember: 'linear-gradient(160deg, #e8935f 0%, #b05038 55%, #5f2d44 100%)',
  swamp: 'linear-gradient(160deg, #8fae72 0%, #5f7a4f 55%, #3a4f42 100%)',
  void: 'linear-gradient(160deg, #8f7ab8 0%, #5f4a8f 55%, #2a1d45 100%)',
  highland: 'linear-gradient(160deg, #a8c8e4 0%, #6f8f5e 55%, #3d4a3a 100%)',
  ashfall: 'linear-gradient(160deg, #ffb070 0%, #b0502a 55%, #3f1c14 100%)',
  tidal: 'linear-gradient(160deg, #9fd0cf 0%, #3f97a8 55%, #1d3f4e 100%)',
}

/**
 * Escape a string that came from somewhere other than this codebase.
 *
 * Leaderboard nicknames are written by other players and land in `innerHTML`.
 * The server already restricts them to letters, numbers, spaces, hyphens and
 * underscores, but a client that renders remote text into markup must not
 * depend on a server rule staying correct forever - that is exactly the class
 * of assumption that turns one relaxed validator into stored XSS for everyone.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

export type GameMode = 'campaign' | 'endless' | 'sandbox'

export interface BattleStats {
  kills: number, gold: number, shards: number, wavesReached: number, wavesCleared: number, totalWaves: number,
  timeSec: number, heroLevel: number, endless: boolean, bestEndless: number,
  score: number, prevBestScore: number, newBestScore: boolean, newWaveRecord: boolean,
  perfectWaves: number, bestStreak: number, noleak: boolean, livesLeft: number,
  lastLeak: { name: string, wave: number } | null,
  topKiller: { name: string, kills: number, damage: number } | null,
  heroKills: number,
  daily?: DailyResult,
  freeplay: boolean, freeplayDepth: number,
  canHoldTheLine?: boolean,
  xpEarned: number, levelBefore: number, levelAfter: number, newUnlocks: UnlockDef[],
  starTarget: number | null, livesShort: number,
  starLossLeak: { name: string, wave: number } | null,
  difficulty: Difficulty,
  /** this win was the map's first */
  firstClear: boolean,
  trial?: { kind: TrialKind, name: string, newStar: boolean },
  newCards?: string[],
  hunt?: { id: HuntId, name: string, honors: string[] },
}

/**
 * The one thing to do next, named.
 *
 * Kingdom Rush never lets a result screen end in "well done": a missing star
 * buys and opens something, and the next map is right there. Every result in
 * Blockhold now ends in one named objective, chosen by the same rule on the
 * result card and the menu, so a session never closes without a reason to
 * open the next one.
 */
export interface Objective { text: string, action: 'retry' | 'next' | 'replay' | 'veteran' | 'trial' | 'hold' | 'levels', levelId: string, trial?: TrialKind }

export function nextObjective(save: SaveData, ctx: { won: boolean, levelId: string, stars: number, leak?: { name: string, wave: number } | null, livesShort?: number, firstClear?: boolean }): Objective {
  const idx = levels.findIndex(l => l.id === ctx.levelId)
  const lvl = levels[idx]
  const name = lvl?.name ?? 'the map'
  if (!ctx.won) {
    return {
      text: ctx.leak ? `Retry ${name} - a ${ctx.leak.name} broke through on wave ${ctx.leak.wave}` : `Retry ${name}`,
      action: 'retry', levelId: ctx.levelId,
    }
  }
  const nextLvl = levels[idx + 1]
  if (nextLvl && (save.stars[nextLvl.id] ?? 0) === 0 && (ctx.firstClear || ctx.stars === 3)) {
    return { text: `Next: ${nextLvl.name}`, action: 'next', levelId: nextLvl.id }
  }
  if (ctx.stars < 3) {
    const short = ctx.livesShort ?? 0
    return {
      text: short > 0 ? `Three stars on ${name}: keep ${short} more ${short === 1 ? 'life' : 'lives'}` : `Three stars on ${name}`,
      action: 'replay', levelId: ctx.levelId,
    }
  }
  const medals = save.medals[ctx.levelId] ?? []
  if (!medals.includes('veteran')) return { text: `Conquer ${name} on Veteran`, action: 'veteran', levelId: ctx.levelId }
  // the two trials are the map's last two stars
  const won = trialsWon(save.trials, ctx.levelId)
  const trial = TRIAL_KINDS.find(k => !won.includes(k))
  if (trial) return { text: `${TRIAL_NAMES[trial]} on ${name}: one more star for the Armory`, action: 'trial', levelId: ctx.levelId, trial }
  if (nextLvl && (save.stars[nextLvl.id] ?? 0) === 0) return { text: `Next: ${nextLvl.name}`, action: 'next', levelId: nextLvl.id }
  const unbeaten = levels.find(l => (save.stars[l.id] ?? 0) === 0)
  if (unbeaten) return { text: `Next: ${unbeaten.name}`, action: 'levels', levelId: unbeaten.id }
  const held = Math.max(...(['casual', 'normal', 'veteran'] as const).map(d => save.bestFreeplay?.[`${ctx.levelId}:${d}`] ?? 0))
  const nextBoss = (Math.floor(held / 10) + 1) * 10
  return { text: `Hold the line past +${nextBoss} on ${name} - a boss waits there`, action: 'hold', levelId: ctx.levelId }
}

/** 12,400 reads as 12.4k: the number is a badge, not a ledger */
export const fmtDamage = (d: number) => d >= 10000 ? `${(d / 1000).toFixed(1)}k` : `${Math.round(d).toLocaleString()}`

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`

/** nobody has played yet: no stars anywhere and nothing unlocked past the first map */
function isFirstRun(save: SaveData): boolean {
  return save.unlocked <= 1 && Object.values(save.stars).every(s => !s)
}

/** iPadOS masquerades as macOS but is the only "Mac" with a touchscreen */
export function isIPadOS(): boolean {
  return /iPad/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** true where the installed app beats (or is the only) fullscreen: iPhones have
 *  no Fullscreen API, and iPad Safari's fullscreen bans keyboard focus and
 *  exits on a swipe — the Home Screen app has neither problem */
export function needsInstallGuide(): boolean {
  const doc = document as Document & { webkitFullscreenEnabled?: boolean }
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(pointer: coarse)').matches
    && (!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled) || isIPadOS())
    && !nav.standalone
    && !window.matchMedia('(display-mode: standalone)').matches
    && !window.matchMedia('(display-mode: fullscreen)').matches
}

export class Screens {
  root: HTMLElement
  onPlayLevel: (levelId: string, difficulty?: Difficulty, hero?: HeroId, mode?: GameMode) => void = () => {}
  onMenu: () => void = () => {}
  onPlayHunt: (id: HuntId, difficulty: Difficulty, hero: HeroId) => void = () => {}
  onResume: () => void = () => {}
  onPlayDaily: () => void = () => {}
  onPlayWatches: () => void = () => {}
  onPlayBellfoundry: () => void = () => {}
  onNextWatch: () => void = () => {}
  onHoldTheLine: () => void = () => {}
  onRetry: () => void = () => {}
  onPlayTrial: (levelId: string, kind: TrialKind) => void = () => {}

  constructor(private save: () => SaveData) {
    this.root = document.getElementById('screens')!
  }

  private current: ScreenName = 'none'

  show(name: ScreenName, opts: { stars?: number, levelId?: string, stats?: BattleStats, coopCode?: string } = {}): void {
    this.root.innerHTML = ''
    this.current = name
    this.root.classList.toggle('hidden', name === 'none')
    this.root.classList.toggle('transparent-bg', name === 'victory' || name === 'defeat')
    switch (name) {
      case 'menu': this.renderMenu(); break
      case 'levels': this.renderLevels(); break
      case 'sandbox': this.renderLevels(true); break
      case 'hunts': void import('./endgame.ts').then(({ renderEndgame }) => { if (this.current === 'hunts') renderEndgame(this.root, this.save(), this.onPlayHunt, () => this.show('menu')) }); break
      case 'coop': this.renderCoop(opts.coopCode); break
      case 'victory': this.renderEnd(true, opts.stars ?? 1, opts.levelId!, opts.stats); break
      case 'defeat': this.renderEnd(false, 0, opts.levelId!, opts.stats); break
    }
  }

  private renderMenu(): void {
    const save = this.save()
    const wrap = el('div', 'screen menu-screen', this.root)
    const card = el('div', 'menu-hero main-menu', wrap)
    const head = el('div', 'menu-heading', card)
    // Keep the key art behind the wordmark, fading to a quiet surface under
    // the actions. Inline so the artwork URL resolves at runtime.
    card.style.background =
      'linear-gradient(180deg, rgba(20, 23, 28, 0.62), rgba(24, 26, 30, 0.96) 36%, #181a1e 70%), ' +
      'url(art/title.webp) center / cover'
    el('div', 'menu-crest', head, icon('castle', 'gilded'))
    el('h1', 'game-title', head, 'Blockhold')
    el('div', 'game-tagline', card, 'Hold the line, block by block.')
    // A newcomer has nothing to choose between yet, and a link-shared game has
    // about ten seconds. Drop them straight into the first battle; the level
    // select, heroes and difficulty appear once they have played one.
    const fresh = isFirstRun(save)
    const actions = el('div', 'menu-primary-actions', card)
    const play = el('button', 'btn primary big', actions,
      `${icon('swords')} &nbsp;${fresh ? 'Play' : 'To Battle'}`) as HTMLButtonElement
    play.onclick = () => {
      if (fresh) this.onPlayLevel(levels[0].id, 'normal', 'aldric', 'campaign')
      else this.show('levels')
    }
    // a battle interrupted mid-campaign is worth more than a fresh one
    const session = readSession()
    const sessionLevel = session ? (session.hunt ? huntById(session.hunt)?.name : levels.find(l => l.id === session.levelId)?.name) : null
    if (session && sessionLevel) {
      play.classList.replace('primary', 'ghost')
      play.textContent = 'New battle'
      const resume = el('button', 'btn primary menu-resume', actions, `<span>Continue<small>${sessionLevel} · Wave ${Math.max(1, session.wave)}</small></span><span aria-hidden="true">→</span>`) as HTMLButtonElement
      resume.onclick = () => this.onResume()
      play.before(resume)
    } else if (readSessionIssue()?.kind === 'incompatible') {
      el('p', 'menu-note', card, 'Your saved battle uses an older game version. Account progress is safe; start a new battle to use the updated rules.')
    }
    const cp = readCheckpoint()
    // a checkpoint whose level no longer exists (an older build saved one for
    // the Daily, or a map was renamed) must not offer a button that cannot open
    const cpLevel = cp ? levels.find(l => l.id === cp.levelId) : undefined
    if (!session && cp && cpLevel) {
      const depth = cp.waveIndex + 1 - cpLevel.waves.length
      const resume = el('button', 'btn primary menu-resume', actions, cp.freeplay
        ? `${icon('castle')} Hold the line on ${cpLevel.name} · +${Math.max(1, depth)}`
        : `${icon('respawn')} Resume ${cpLevel.name} · wave ${cp.waveIndex + 1}`) as HTMLButtonElement
      resume.onclick = () => this.onResume()
      play.classList.replace('primary', 'ghost'); play.textContent = 'New battle'; play.before(resume)
    }
    if (coopEnabled()) {
      const coop = el('button', 'btn ghost', actions, `${icon('helmPlume')} Co-op`) as HTMLButtonElement
      coop.onclick = () => this.show('coop')
    }
    const explore = el('button', 'menu-explore', card,
      `<span>Explore modes<small>Sandbox, boss hunts & daily challenges</small></span><span aria-hidden="true">›</span>`)
    let openingModes = false
    explore.onclick = async () => {
      if (openingModes) return
      openingModes = true
      try {
        const { renderModes } = await import('./modes.ts')
        if (this.current === 'menu') renderModes(this.root, this.save(), this)
      } finally { openingModes = false }
    }
    this.renderLevelBar(card, save)
    const settings = el('details', 'menu-settings', card)
    el('summary', '', settings, 'Help & settings')
    const utilities = el('div', 'menu-utilities', settings)
    if (session && sessionLevel) {
      const backup = el('button', 'btn ghost', utilities, 'Download saved battle')
      backup.onclick = () => downloadBattleBackup(this.save())
    }
    if (cloud.enabled) {
      const st = cloud.status()
      const acct = el('button', 'menu-account', head,
        `${st.provider ? 'Account' : 'Sign in'}`) as HTMLButtonElement
      acct.onclick = () => this.renderAccount()
    }
    const how = el('button', 'btn ghost', utilities, 'How to play') as HTMLButtonElement
    how.onclick = () => this.renderHelp()
    if (save.seenEnemies.length) {
      const guide = el('button', 'btn ghost', utilities, `${icon('eye')} Field guide`) as HTMLButtonElement
      guide.onclick = async () => { const { renderFieldGuide } = await import('./fieldGuide.ts'); renderFieldGuide(this.root, this.save().seenEnemies, () => {}) }
    }
    if (needsInstallGuide()) {
      const install = el('button', 'btn ghost', utilities, `${icon('fullscreen')} Play fullscreen`) as HTMLButtonElement
      install.onclick = () => this.renderInstallGuide()
    }
    const footer = el('div', 'menu-footer', settings, holdSummary(holdPieces(save)))
    // A keep nobody else can see is not a trophy. Offered only once there is
    // something standing, so a bare Hold never invites a picture of nothing.
    if (holdPieces(save).towers > 0) {
      const shot = el('button', 'hold-share', footer, `${icon('share')} Share my Hold`) as HTMLButtonElement
      shot.onclick = async () => {
        shot.disabled = true
        shot.textContent = 'Painting\u2026'
        try {
          const ok = await this.onSharePostcard()
          shot.textContent = ok ? 'Saved' : 'Could not save'
        } catch {
          shot.textContent = 'Could not save'
        }
        setTimeout(() => {
          shot.disabled = false
          shot.innerHTML = `${icon('share')} Share my Hold`
        }, 2600)
      }
    }
    this.renderPrivacyRow(settings)
  }

  /**
   * Account level, experience toward the next, and what that next level opens.
   *
   * The one line on the menu that answers "why play the next map": the bar is
   * the goal gradient, and the name beside it is the reason to want it.
   */
  private renderLevelBar(wrap: HTMLElement, save: SaveData): void {
    const { level, into, span } = levelProgress(save.xp)
    const next = nextUnlock(level)
    const row = el('div', 'level-row', wrap)
    el('span', 'level-badge', row, `${icon('sparkle')} Level ${level}`)
    const bar = el('span', 'level-bar', row)
    const fill = el('i', '', bar)
    fill.style.width = `${Math.round(level >= MAX_LEVEL ? 100 : Math.min(1, into / span) * 100)}%`
    el('span', 'level-xp', row, level >= MAX_LEVEL ? `${save.xp.toLocaleString()} XP` : `${(span - into).toLocaleString()} XP to Level ${level + 1}`)
    if (next) {
      el('span', 'level-next', row, `${icon(next.kind === 'hero' ? 'helmPlume' : 'castle')} ${next.name} at ${next.level}`)
    } else {
      const hunt = el('button', 'level-next', row, `${icon('crown')} Hunt victories unlock hero paths & Mythics`) as HTMLButtonElement
      hunt.onclick = () => this.show('hunts')
    }
  }

  /**
   * The whole of the privacy surface, in one line on the menu.
   *
   * Telemetry is off until this is switched on. It is here rather than buried
   * in a settings screen because a control nobody can find is not consent, and
   * the sentence says what is collected in the words a player would use.
   */
  private renderPrivacyRow(wrap: HTMLElement): void {
    const row = el('div', 'menu-privacy', wrap)
    const on = telemetryAllowed()
    const btn = el('button', 'privacy-toggle', row) as HTMLButtonElement
    const paint = () => {
      const isOn = telemetryAllowed()
      btn.textContent = isOn ? 'Anonymous play data: on' : 'Anonymous play data: off'
      btn.classList.toggle('on', isOn)
      btn.setAttribute('aria-pressed', String(isOn))
    }
    btn.title = 'Sends which wave you reached and which towers you built. No account, no cookies, no advertising, and never anything that identifies you.'
    btn.onclick = () => { setTelemetryAllowed(!telemetryAllowed()); paint() }
    void on
    paint()
  }

  /** iOS has no fullscreen API — walk the player through installing instead */
  renderInstallGuide(): void {
    const overlay = el('div', 'help-overlay', this.root)
    const card = el('div', 'help-card install-card', overlay)
    el('h2', '', card, `${icon('fullscreen')} Play fullscreen`)
    el('div', 'install-intro', card,
      'Safari fullscreen is a bad home for a game: iPhones don\'t allow it at all, and on iPad it blocks input and quits when you swipe. An installed Blockhold launches like a real app instead — true fullscreen, offline, no quirks. Takes ten seconds:')
    const steps = el('div', 'install-steps', card)
    const step = (n: number, ico: string, html: string) => {
      const s = el('div', 'install-step', steps)
      s.innerHTML = `<span class="is-num">${n}</span><span class="is-icon">${icon(ico, 'plain')}</span><span class="is-text">${html}</span>`
    }
    step(1, 'share', 'Tap the <b>Share</b> button — bottom bar on iPhone, top right on iPad. (Same button in Chrome, next to the address bar.)')
    step(2, 'plusSquare', 'Scroll down the share sheet and tap <b>Add to Home Screen</b>, then <b>Add</b>.')
    step(3, 'castle', 'Launch <b>Blockhold</b> from your Home Screen. That\'s the fullscreen app — this tab can stay behind.')
    const close = el('button', 'btn primary', card, 'Got it') as HTMLButtonElement
    close.onclick = () => overlay.remove()
    bindDialog(overlay, card, () => overlay.remove())
  }

  // ---------------- co-op lobby ----------------
  // the lobby is its own chunk: a room, a clock and a form that most sessions never open
  onCoopStart: (session: CoopSession, setup: CoopSetup) => void = () => {}

  private renderCoop(prefill?: string): void {
    const wrap = el('div', 'screen menu-screen', this.root)
    const card = el('div', 'menu-hero coop-card', wrap)
    el('h2', 'coop-title', card, `${icon('helmPlume')} Co-op`)
    el('div', 'coop-sub dim', card, 'Opening the room…')
    void import('./coopLobby.ts').then(({ renderCoopLobby }) => {
      if (this.current !== 'coop') return
      this.root.innerHTML = ''
      renderCoopLobby({
        root: this.root,
        save: this.save,
        show: (name) => this.show(name),
        isCurrent: () => this.current === 'coop',
        onCoopStart: (session, setup) => this.onCoopStart(session, setup),
      }, prefill)
    })
  }

  private renderLevels(sandbox = false): void {
    const save = this.save()
    const wrap = el('div', 'screen levels-screen', this.root)
    const head = el('div', 'levels-head', wrap)
    const back = el('button', 'btn ghost small', head, '← Back') as HTMLButtonElement
    back.onclick = () => this.show('menu')
    el('h2', 'levels-title', head, sandbox ? 'Sandbox · choose a map' : 'Choose your battlefield')
    const armoryBtn = el('button', 'btn ghost small', head, `${icon('swords')} Armory · ${starsAvailable(save)}★`) as HTMLButtonElement
    armoryBtn.onclick = () => this.renderArmory()
    const cardsBtn = el('button', 'btn ghost small', head, `${icon('crown')} Cards · ${(save.capstones ?? []).length}/14`) as HTMLButtonElement
    cardsBtn.title = 'Capstone cards: one for every crown you have flown to a campaign win'
    cardsBtn.onclick = async () => { const { renderCapstoneCards } = await import('./capstoneCards.ts'); renderCapstoneCards(this.root, save.capstones ?? [], () => {}) }
    const grid = el('div', 'levels-grid', wrap)
    levels.forEach((lvl, i) => {
      const locked = !sandbox && i >= save.unlocked
      const stars = save.stars[lvl.id] ?? 0
      const card = el('button', `level-card${locked ? ' locked' : ''}`, grid) as HTMLButtonElement
      const art = el('div', 'level-art', card, locked ? icon('lock', 'plain') : '')
      // painted card over the theme gradient (which shows until the image lands)
      art.style.background = `url(art/card-${lvl.id}.webp) center / cover, ${THEME_ART[lvl.theme]}`
      el('div', 'level-name', card, `${i + 1}. ${lvl.name}`)
      el('div', 'level-sub', card, lvl.subtitle)
      el('div', 'level-meta', card, `${sandbox ? 'Free building' : `${lvl.waves.length} waves`} · ${lvl.lanes.length === 1 ? 'single road' : `${lvl.lanes.length} roads`}`)
      const best = save.bestEndless[lvl.id] ?? 0
      const held = Math.max(...(['casual', 'normal', 'veteran'] as const).map(d => save.bestFreeplay?.[`${lvl.id}:${d}`] ?? 0))
      const medals = save.medals[lvl.id] ?? []
      if (!sandbox) el('div', 'level-stars', card, '★'.repeat(stars) + '<span class="dim">' + '★'.repeat(3 - stars) + '</span>' +
        (medals.includes('noleak') ? `<span class="level-medal" title="Flawless: won without a single leak"> ${icon('medal')}</span>` : '') +
        (medals.includes('veteran') ? `<span class="level-medal" title="Conquered on Veteran"> ${icon('medal', 'vet')}</span>` : '') +
        (trialsWon(save.trials, lvl.id).length ? `<span class="level-medal" title="Trials won"> ${icon('flag')}${trialsWon(save.trials, lvl.id).length}</span>` : '') +
        (best > 0 ? `<span class="level-endless"> ${icon('moon')}${best}</span>` : '') +
        (held > 0 ? `<span class="level-endless" title="Waves held past the end"> ${icon('castle')}+${held}</span>` : ''))
      // the goal ladder: always show the next rung
      if (!locked) {
        const goal = sandbox ? 'Open sandbox' : stars === 0 ? 'Clear the map'
          : stars < 3 ? 'Earn three stars'
          : !medals.includes('noleak') ? 'Win without a single leak'
          : !medals.includes('veteran') ? 'Conquer it on Veteran'
          : best === 0 ? 'Enter the Long Night'
          : `Survive past wave ${best} in the Long Night`
        el('div', 'level-goal', card, `➤ ${goal}`)
      }
      if (!locked) card.onclick = () => this.showDifficultyPicker(lvl.id, lvl.name, sandbox)
    })
  }

  /**
   * The daily's whole job is to become an object somebody can hand to a
   * friend, so the result is a spoiler-free block they can copy and a link
   * that drops that friend onto the exact same board.
   */
  private renderDailyResult(card: HTMLElement, r: DailyResult, won: boolean, stats?: BattleStats): void {
    el('div', 'end-emoji', card, icon('moon'))
    el('h2', 'end-title', card, `Daily Hold #${r.day}`)
    el('div', 'end-sub', card, won
      ? `Held all ${r.totalWaves} waves — ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} left`
      : `Wave ${r.wavesReached} of ${r.totalWaves}`)

    const url = challengeUrl(this.dailySeedForShare)
    const text = dailyShareText(r, url)
    el('pre', 'daily-blocks', card, text.split('\n').slice(2, 3).join(''))

    // the Daily pays experience like any other battle, and used to hide it
    if (stats) this.renderXp(card, stats)
    const row = el('div', 'end-actions', card)
    const copy = el('button', 'btn primary', row, 'Copy result') as HTMLButtonElement
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text)
        copy.textContent = 'Copied'
        this.onShared('daily')
      } catch {
        // clipboard can be blocked; show the text so it can still be taken
        const box = el('textarea', 'daily-fallback', card) as HTMLTextAreaElement
        box.value = text
        box.readOnly = true
        box.select()
        copy.textContent = 'Select and copy'
      }
      setTimeout(() => { copy.textContent = 'Copy result' }, 2500)
    }
    const again = el('button', 'btn ghost', row, 'Play again') as HTMLButtonElement
    again.onclick = () => this.onPlayDaily()
    const menu = el('button', 'btn ghost', row, 'Menu') as HTMLButtonElement
    menu.onclick = () => { this.show('menu'); this.onMenu() }

    this.renderDailyRank(card, r)
  }

  /**
   * Experience earned, the level it made, and anything that level opened.
   *
   * A level-up with an unlock is the biggest reward the game hands out, so it
   * gets the biggest treatment on the card - above the share row, since a new
   * hero is exactly the thing a player will want to tell someone about.
   */
  private renderXp(card: HTMLElement, stats: BattleStats): void {
    // a result rendered from a partial record (the Daily's share path, a
    // scripted card) may carry no XP fields at all
    const unlocks = stats.newUnlocks ?? []
    if (!(stats.xpEarned > 0) && unlocks.length === 0) return
    const box = el('div', 'end-xp', card)
    const leveled = stats.levelAfter > stats.levelBefore
    el('span', 'end-xp-gain', box, `+${stats.xpEarned} XP`)
    const { level, into, span } = levelProgress(this.save().xp)
    const bar = el('span', 'level-bar', box)
    el('i', '', bar).style.width = `${Math.round(level >= MAX_LEVEL ? 100 : Math.min(1, into / span) * 100)}%`
    el('span', 'end-xp-level', box, leveled
      ? `${icon('sparkle')} Level ${stats.levelAfter}!`
      : `Level ${stats.levelAfter}`)
    el('span', 'end-xp-next', box, level >= MAX_LEVEL ? 'Max level' : `${(span - into).toLocaleString()} XP to Level ${level + 1}`)
    // the exact distance to the next thing the account opens
    const next = nextUnlock(stats.levelAfter)
    if (next) {
      const remaining = Math.max(0, xpForLevel(next.level) - this.save().xp)
      el('span', 'end-xp-next', box, `${remaining.toLocaleString()} XP to ${next.name}`)
    }
    for (const u of unlocks) {
      const row = el('div', 'end-unlock', card)
      el('div', 'end-unlock-eyebrow', row, u.kind === 'hero' ? 'A champion answers the call' : 'A new engine of war')
      el('div', 'end-unlock-name', row, `${icon(u.kind === 'hero' ? 'helmPlume' : 'castle')} ${u.name} unlocked`)
      el('div', 'end-unlock-blurb', row, u.blurb)
    }
  }

  /**
   * Where today's result sits among everyone else's.
   *
   * A wave number on its own is a fact. The same number next to "142nd of 1,880
   * today" is a reason to come back tomorrow, and it is what turns the result
   * block from a souvenir into an argument. Rendered after the card is already
   * complete and standing on its own, so a slow or absent service costs the
   * player nothing but a line that never appears.
   */
  private renderDailyRank(card: HTMLElement, r: DailyResult): void {
    if (!leaderboardEnabled()) return
    const slot = el('div', 'daily-rank', card, 'Placing today\u2026')
    void (async () => {
      const placed = await this.onSubmitDaily(r)
      const board = await fetchDaily(r.day)
      if (!board) { slot.remove(); return }
      const you = placed ?? board.you
      slot.innerHTML = ''
      if (you) {
        el('span', 'dr-rank', slot, `#${you.rank.toLocaleString()}`)
        el('span', 'dr-of', slot, `of ${board.total.toLocaleString()} today`)
      } else {
        el('span', 'dr-of', slot, `${board.total.toLocaleString()} have played today`)
      }
      const top = board.top.slice(0, 3)
      if (top.length) {
        el('span', 'dr-top', slot,
          top.map(t => `${t.rank}. ${escapeHtml(t.nickname)} \u00b7 wave ${t.wave}`).join('   '))
      }
      // naming yourself is optional, and asked for only once there is a board
      // to be named on - nobody wants a "choose a handle" box before they play
      const name = el('button', 'dr-name', slot,
        nickname() ? `Playing as ${escapeHtml(nickname())}` : 'Add a name') as HTMLButtonElement
      name.onclick = () => {
        const next = prompt('A name for the leaderboard (letters, numbers, spaces):', nickname())
        if (next === null) return
        setNickname(next)
        name.textContent = nickname() ? `Playing as ${nickname()}` : 'Add a name'
      }
    })()
  }

  /** posts the finished daily and returns the placing, if there is one */
  onSubmitDaily: (r: DailyResult) => Promise<{ rank: number } | null> = async () => null

  /** the seed the daily just played, so the share link points at that board */
  dailySeedForShare = 0
  onShared: (kind: string) => void = () => {}
  /** the seed of the run that just ended, so its result can be handed on */
  runSeedForShare = 0

  /**
   * Hand a block of text to whoever the player wants to hand it to.
   *
   * Three routes, in order of how well they work on the device in hand: the
   * native share sheet on a phone (which reaches the chat app the link is
   * actually going to), the clipboard on a desktop, and a selectable textarea
   * when both are blocked - which they are inside some portal iframes, where
   * silently failing would look exactly like a broken button.
   */
  private async shareText(text: string, btn: HTMLButtonElement, card: HTMLElement, kind: string, label: string): Promise<void> {
    const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }
    if (nav.share && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await nav.share({ text })
        this.onShared(kind)
        btn.textContent = 'Shared'
        setTimeout(() => { btn.innerHTML = label }, 2500)
        return
      } catch {
        // a cancelled share sheet is not a failure; fall through to the clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      btn.textContent = 'Copied'
      this.onShared(kind)
    } catch {
      const box = el('textarea', 'daily-fallback', card) as HTMLTextAreaElement
      box.value = text
      box.readOnly = true
      box.select()
      btn.textContent = 'Select and copy'
    }
    setTimeout(() => { btn.innerHTML = label }, 2500)
  }

  private showDifficultyPicker(levelId: string, levelName: string, sandbox = false): void {
    const save = this.save()
    let hero: HeroId = (save.lastHero in HERO_DEFS ? save.lastHero : 'aldric') as HeroId
    let mode: GameMode = sandbox ? 'sandbox' : 'campaign'
    let difficulty: Difficulty = 'normal'
    const beaten = !sandbox && (save.stars[levelId] ?? 0) > 0
    const best = save.bestEndless[levelId] ?? 0
    const overlay = el('div', 'help-overlay', this.root)
    const card = el('div', 'help-card difficulty-card', overlay)
    el('h2', '', card, levelName)
    if (sandbox) el('p', 'diff-sub', card, 'Free building. All towers and heroes. Send enemies when you choose. No account rewards.')

    if (beaten) {
      const modeRow = el('div', 'mode-row', card)
      const mkMode = (m: GameMode, label: string) => {
        const btn = el('button', `mode-option${m === mode ? ' picked' : ''}`, modeRow, label) as HTMLButtonElement
        btn.setAttribute('aria-pressed', String(m === mode))
        btn.onclick = () => {
          mode = m
          modeRow.querySelectorAll('.mode-option').forEach((b, i) => {
            const selected = (i === 0) === (m === 'campaign')
            b.classList.toggle('picked', selected); b.setAttribute('aria-pressed', String(selected))
          })
        }
        return btn
      }
      mkMode('campaign', `${icon('swords')} Campaign`)
      mkMode('endless', `${icon('moon')} The Long Night${best > 0 ? ` · best ${best}` : ''}`)
    }

    if (beaten) {
      // Two more stars per map, each behind a short test. Shown where the map
      // is chosen, so the pursuit is visible every time the player comes back.
      const won = trialsWon(save.trials, levelId)
      const trials = el('details', 'setup-trials', card)
      el('summary', '', trials, `Bonus trials · ${won.length}/2 ★`)
      const trialRow = el('div', 'trial-row', trials)
      for (const kind of TRIAL_KINDS) {
        const def = trialFor(levelById(levelId), kind)
        const done = won.includes(kind)
        const btn = el('button', `trial-option${done ? ' won' : ''}`, trialRow) as HTMLButtonElement
        btn.innerHTML = `<span class="trial-name">${icon(TRIAL_ICONS[kind])} Start ${def.name}${done ? ' <span class="trial-star">★</span>' : ''}</span>` +
          `<span class="trial-blurb">${def.blurb}</span>` +
          `<span class="trial-stats">${icon('coin')} ${def.startGold} · ${icon('heart')} 1 · ${icon('gem')} ${def.shards} · tier ${def.maxTier} cap · no Armory</span>`
        btn.onclick = () => this.onPlayTrial(levelId, kind)
      }
    }

    const heroGroup = el('section', 'setup-hero-group', card)
    el('div', 'diff-sub', heroGroup, 'Champion')
    const heroRow = el('div', 'hero-row', heroGroup)
    const heroSummary = el('div', 'hero-selection', heroGroup)
    const describeHero = () => {
      const def = HERO_DEFS[hero], path = heroPath(hero, save.heroPaths?.[hero])
      heroSummary.innerHTML = `<p>${def.blurb}</p><details><summary>${path?.abilityName ?? def.ability.name}</summary><p>${path?.blurb ?? def.ability.blurb}</p></details>`
    }
    const heroBtns = new Map<HeroId, HTMLButtonElement>()
    // a hero the account has not reached is shown, named and priced in levels,
    // rather than hidden: the ladder only pulls if the rungs can be seen
    if (!sandbox && !isUnlocked(save, 'hero', hero)) hero = 'aldric'
    for (const def of Object.values(HERO_DEFS)) {
      const locked = !sandbox && !isUnlocked(save, 'hero', def.id)
      const btn = el('button', `hero-option${locked ? ' locked' : ''}`, heroRow) as HTMLButtonElement
      if (locked) {
        btn.innerHTML = `<img class="hero-portrait" src="art/hero-${def.id}.webp" alt="">` +
          `<span class="hero-name">${def.name}</span><span class="hero-title">${def.title}</span>` +
          `<span class="hero-lock">${icon('lock')} Unlocks at level ${unlockLevel('hero', def.id)}</span>`
        btn.disabled = true
        continue
      }
      btn.innerHTML = `<img class="hero-portrait" src="art/hero-${def.id}.webp" alt="">` +
        `<span class="hero-name">${def.name}</span><span class="hero-title">${def.title}</span>` +
        `<span class="hero-blurb">${def.blurb}</span>` +
        `<span class="hero-stats">${icon('heart')} ${def.hp} · ${icon('sword')} ${def.damage[0]}–${def.damage[1]}${def.attackRange ? ` · ${icon('range')} ${def.attackRange}` : ' · melee'}</span>` +
        `<span class="hero-ability">✦ ${heroPath(def.id, save.heroPaths?.[def.id])?.abilityName ?? def.ability.name}: ${heroPath(def.id, save.heroPaths?.[def.id])?.blurb ?? def.ability.blurb}</span>`
      btn.onclick = () => {
        hero = def.id
        heroBtns.forEach((b, id) => { b.classList.toggle('picked', id === hero); b.setAttribute('aria-pressed', String(id === hero)) })
        describeHero()
      }
      heroBtns.set(def.id, btn)
      btn.setAttribute('aria-pressed', String(def.id === hero))
    }
    heroBtns.get(hero)?.classList.add('picked')
    describeHero()

    const difficultyGroup = el('section', 'setup-difficulty-group', card)
    el('div', 'diff-sub', difficultyGroup, 'Difficulty')
    const row = el('div', 'diff-row', difficultyGroup)
    const hint = el('p', 'difficulty-hint', difficultyGroup, difficultyMods(levelId, difficulty).blurb)
    for (const key of ['casual', 'normal', 'veteran'] as Difficulty[]) {
      // the numbers this map will actually use, which on the late maps differ
      // from the global table; a picker that showed the table would lie
      const d = difficultyMods(levelId, key, (mode as GameMode) === 'endless' ? 'endless' : 'campaign')
      const btn = el('button', `diff-option ${key}`, row) as HTMLButtonElement
      btn.classList.toggle('picked', key === difficulty)
      btn.setAttribute('aria-pressed', String(key === difficulty))
      btn.innerHTML = `<span class="diff-name">${d.name}</span><span class="diff-blurb">${d.blurb}</span>` +
        `<span class="diff-stats">${icon('heart')} ${d.lives} · foes ${Math.round(d.enemyHp * 100)}% · gold ${Math.round(d.bounty * 100)}%` +
        `${d.eliteChance ? ` · elites ${Math.round(d.eliteChance * 100)}%` : ''}</span>`
      btn.onclick = () => {
        difficulty = key
        hint.textContent = d.blurb
        row.querySelectorAll('button').forEach(b => {
          const selected = b === btn
          b.classList.toggle('picked', selected); b.setAttribute('aria-pressed', String(selected))
        })
      }
    }
    const footer = el('div', 'setup-actions', card)
    const cancel = el('button', 'btn ghost', footer, 'Cancel') as HTMLButtonElement
    cancel.onclick = () => overlay.remove()
    const start = el('button', 'btn primary', footer, sandbox ? 'Start sandbox' : 'Start battle')
    start.onclick = () => this.onPlayLevel(levelId, difficulty, hero, mode)
    bindDialog(overlay, card, () => overlay.remove())
  }

  private renderEnd(won: boolean, stars: number, levelId: string, stats?: BattleStats): void {
    const idx = levels.findIndex(l => l.id === levelId)
    const endless = stats?.endless ?? false
    const hasNext = won && !endless && idx >= 0 && idx < levels.length - 1
    const daily = stats?.daily
    const hunt = stats?.hunt
    const wrap = el('div', 'screen end-screen', this.root)
    const card = el('div', `end-card ${won ? 'won' : 'lost'}`, wrap)
    if (daily) { this.renderDailyResult(card, daily, won, stats); return }
    if (hunt && stats) {
      el('div', 'end-emoji', card, icon(won ? 'crown' : 'skull'))
      el('h2', 'end-title', card, won ? `${hunt.name} conquered` : 'The hunt continues')
      el('p', 'end-sub', card, won ? 'The keep stands. Your hunt achievements are saved.' : `${stats.wavesCleared} waves held. Adjust your defense and try again.`)
      this.renderXp(card, stats)
      if (hunt.honors.length) {
        const lines = hunt.honors.map(code => code.startsWith('hero:') ? 'Hero path progress earned' : code.startsWith('mastery:') ? `${code.split(':')[1] === 'seraph' ? 'Seraph' : 'Barracks'} mastery earned` : 'First clear on this difficulty')
        el('div', 'end-objective', card, [...new Set(lines)].join('<br>'))
      }
      const row = el('div', 'end-actions', card)
      const retry = el('button', 'btn', row, 'Hunt again') as HTMLButtonElement
      retry.onclick = () => this.onPlayHunt(hunt.id, stats.difficulty, this.save().lastHero as HeroId)
      const next = el('button', 'btn primary', row, 'Hunts & hero paths') as HTMLButtonElement
      next.onclick = () => { this.onMenu(); this.show('hunts') }
      return
    }
    const freeplay = stats?.freeplay ?? false
    const trial = stats?.trial
    el('div', 'end-emoji', card, icon(trial ? TRIAL_ICONS[trial.kind] : endless ? 'moon' : freeplay ? 'castle' : won ? 'trophy' : 'skull'))
    el('h2', 'end-title', card, trial ? (won ? `${trial.name} held!` : `${trial.name} lost`) : endless ? 'The Long Night ends' : freeplay ? 'The line breaks' : won ? 'Victory!' : 'The gate has fallen')
    if (trial && stats) {
      // a trial is one star, once; the card says whether this was the once
      el('div', 'end-sub', card, won
        ? (trial.newStar ? `A star for the Armory ${icon('medal')} — ${starsAvailable(this.save())}★ to spend` : 'Already won, and held again.')
        : stats.lastLeak ? `A ${stats.lastLeak.name} broke through. One life was the whole point.` : 'The trial is lost. Try it again with what you learned.')
    } else if (freeplay && stats) {
      // how far past the map's end the line held, which is the whole score
      const held = Math.max(0, stats.freeplayDepth - 1)
      el('div', 'end-sub', card,
        `You held the line <b>${held}</b> wave${held === 1 ? '' : 's'} past the end of ${levels[idx]?.name ?? 'the map'}` +
        (stats.newWaveRecord ? ` — a new record! ${icon('medal')}` : ''))
    } else if (endless && stats) {
      // held and fell-on are different numbers, and reporting only one of them
      // next to the record read as though the record *was* the result
      el('div', 'end-sub', card,
        `You held <b>${stats.wavesCleared}</b> wave${stats.wavesCleared === 1 ? '' : 's'}` +
        `, and fell on wave <b>${stats.wavesReached}</b>` +
        (stats.newWaveRecord ? ` — a new record! ${icon('medal')}` : ` · your best is ${stats.bestEndless}`))
    } else if (won) {
      const starRow = el('div', 'end-stars', card)
      for (let i = 0; i < 3; i++) {
        const s = el('span', `end-star${i < stars ? ' earned' : ''}`, starRow, '★')
        s.style.animationDelay = `${0.3 + i * 0.35}s`
      }
      // "flawless" is only ever said when it is true
      el('div', 'end-sub', card, stats?.noleak ? `A flawless defense — not one got through! ${icon('medal')}`
        : stars === 3 ? 'The kingdom stands tall.' : stars === 2 ? 'The kingdom endures.' : 'A costly victory…')
      // the missing star, in lives: what it cost and what first took it
      if (stats && stars < 3 && stats.starTarget !== null && stats.livesShort > 0) {
        el('div', 'end-debrief', card,
          `${stats.livesShort} ${stats.livesShort === 1 ? 'life' : 'lives'} short of three stars — keep ${stats.starTarget} to earn it` +
          (stats.starLossLeak ? ` — the line fell to a <b>${stats.starLossLeak.name}</b> on wave ${stats.starLossLeak.wave}` : ''))
      }
    } else {
      // near-miss framing: name what broke through, and where
      el('div', 'end-sub', card, stats?.lastLeak
        ? `Wave ${stats.lastLeak.wave}${stats.totalWaves && !endless ? `/${stats.totalWaves}` : ''} — a ${stats.lastLeak.name} broke through. Rally and try again!`
        : 'The Veil has overrun the keep. Rally and try again!')
    }
    if (stats) {
      // the score line: self-competition made visible
      const delta = stats.score - stats.prevBestScore
      el('div', 'end-score', card,
        `Score <b>${stats.score.toLocaleString()}</b> ` +
        (stats.newBestScore
          ? `<span class="score-best">NEW BEST${stats.prevBestScore > 0 ? ` +${delta.toLocaleString()}` : ''}</span>`
          : `<span class="score-short">${Math.abs(delta).toLocaleString()} short of your best</span>`))
      el('div', 'end-stats', card,
        `${icon('swords')} ${stats.kills} slain · ${icon('shield')} ${stats.perfectWaves} waves held${stats.bestStreak >= 2 ? ` (${icon('flame')}×${stats.bestStreak})` : ''} · ` +
        `${icon('coin')} ${stats.gold} · ${icon('gem')} ${stats.shards} · ${icon('helmPlume')} lvl ${stats.heroLevel}${stats.heroKills > 0 ? ` ${icon('skull')}${stats.heroKills}` : ''} · ${icon('hourglass')} ${fmtTime(stats.timeSec)}`)
      if (stats.newCards?.length) {
        el('div', 'end-cards', card, `${icon('crown')} Card${stats.newCards.length === 1 ? '' : 's'} stamped: <b>${stats.newCards.join('</b>, <b>')}</b>`)
      }
      if (stats.topKiller && (stats.topKiller.kills > 0 || stats.topKiller.damage > 0)) {
        el('div', 'end-topkiller', card, `${icon('trophy')} Deadliest building: <b>${stats.topKiller.name}</b> — ${stats.topKiller.kills} slain · ${fmtDamage(stats.topKiller.damage)} damage`)
      }
    }
    if (stats) this.renderXp(card, stats)
    // one named next objective, always, and the button that does it
    const objective = !endless && !freeplay && !trial && idx >= 0
      ? nextObjective(this.save(), { won, levelId, stars, leak: stats?.lastLeak, livesShort: stats?.livesShort, firstClear: stats?.firstClear ?? false })
      : null
    if (objective) el('div', 'end-objective', card, `${icon('flag')} ${objective.text}`)
    const row = el('div', 'end-actions', card)
    if (objective?.action === 'veteran') {
      const vet = el('button', 'btn primary', row, `${icon('medal', 'vet')} Play on Veteran`) as HTMLButtonElement
      vet.onclick = () => this.onPlayLevel(levelId, 'veteran')
    }
    if (objective?.action === 'trial' && objective.trial) {
      const t = objective.trial
      const btn = el('button', 'btn primary', row, `${icon(TRIAL_ICONS[t])} ${TRIAL_NAMES[t]}`) as HTMLButtonElement
      btn.onclick = () => this.onPlayTrial(levelId, t)
    }
    // A cleared map is not over. Holding the line keeps the board the player
    // built and keeps the waves coming, with the ladder of bosses beyond.
    if (stats?.canHoldTheLine) {
      const hold = el('button', 'btn primary', row, `${icon('castle')} Hold the line`) as HTMLButtonElement
      hold.title = 'Keep your defense and keep fighting: harder waves, bigger bosses, a record to set'
      hold.onclick = () => this.onHoldTheLine()
    }
    if (hasNext && !trial) {
      const next = el('button', `btn${won && !endless && !freeplay ? '' : ' primary'}`, row, 'Next battle →') as HTMLButtonElement
      next.onclick = () => this.onPlayLevel(levels[idx + 1].id)
    }
    const retry = el('button', `btn ${won && !endless ? '' : 'primary'}`, row, endless ? 'Descend again' : won ? 'Replay' : 'Try again') as HTMLButtonElement
    retry.onclick = () => this.onRetry()
    if (won && this.watchesRemaining > 0) {
      const nextWatch = el('button', 'btn primary', row,
        `Stand the next watch (${4 - this.watchesRemaining} of 3)`) as HTMLButtonElement
      nextWatch.onclick = () => this.onNextWatch()
    }
    const menu = el('button', 'btn ghost', row, 'Level select') as HTMLButtonElement
    menu.onclick = () => { this.onMenu(); this.show('levels') }

    // Every finished run is worth handing on, not only the Daily's. The Long
    // Night record in particular is the number players most want to argue
    // about, and it used to have no way off the device that set it.
    // a trial's challenge link would open the campaign board, not the trial
    if (stats && this.runSeedForShare && !trial) {
      const shareLabel = `${icon('share')} ${endless ? 'Share your depth' : 'Share this hold'}`
      const share = el('button', 'btn ghost', row, shareLabel) as HTMLButtonElement
      share.title = 'Copy a result and a link that drops a friend onto this exact board'
      share.onclick = () => {
        const url = runChallengeUrl(this.runSeedForShare, levelId, endless)
        const text = runShareText({
          levelName: levels[idx]?.name ?? 'Blockhold',
          endless,
          won,
          wave: stats.wavesReached,
          totalWaves: stats.totalWaves,
          lives: stats.livesLeft,
          score: stats.score,
          best: stats.bestEndless,
        }, url)
        void this.shareText(text, share, card, endless ? 'endless' : 'campaign', shareLabel)
      }
    }

    // a result card is a claim; a clip is evidence
    if (this.canRecordTape()) {
      const tape = el('button', 'btn ghost', row, `${icon('share')} Siege Tape`) as HTMLButtonElement
      tape.title = 'Record your defense assembling itself, as a video you can share'
      tape.onclick = async () => {
        tape.disabled = true
        tape.textContent = 'Recording…'
        try {
          const ok = await this.onRecordTape()
          tape.textContent = ok ? 'Saved' : 'Nothing to record'
        } catch {
          tape.textContent = 'Recording failed'
        }
        setTimeout(() => {
          tape.disabled = false
          tape.innerHTML = `${icon('share')} Siege Tape`
        }, 2600)
      }
    }
  }

  renderAccount(): void {
    void import('./account.ts').then(({ renderAccountPanel }) =>
      renderAccountPanel(this.root, this.save, restored => this.onRestore(restored), () => this.show('menu')))
  }

  onRestore: (save: SaveData) => void = () => {}

  /** how many watches are still to come; 0 outside the mode */
  watchesRemaining = 0

  /** wired by main so screens never import the capture layer directly */
  /** paint the Hold as a picture and hand it to the player */
  onSharePostcard: () => Promise<boolean> = async () => false
  canRecordTape: () => boolean = () => false
  onRecordTape: () => Promise<boolean> = async () => false

  private renderArmory(): void {
    const save = this.save()
    const overlay = el('div', 'help-overlay', this.root)
    const card = el('div', 'help-card armory-card', overlay)
    el('h2', '', card, `${icon('swords')} The Royal Armory`)
    const starsLine = el('div', 'armory-stars', card)
    const grid = el('div', 'armory-grid', card)

    const rerender = () => {
      const crowns = crownStars(save)
      const trialN = trialStars(save)
      starsLine.innerHTML = `<b>${starsAvailable(save)}★</b> to spend · ${starsEarned(save)}★ of ${ARMORY_TOTAL_COST} earned` +
        (crowns ? ` <span class="dim">(${crowns} crown ${crowns === 1 ? 'star' : 'stars'} from Veteran clears${trialN ? `, ${trialN} from trials` : ''})</span>` : ' <span class="dim">· a Veteran clear adds a fourth crown star, and each map\'s two trials add two more</span>')
      grid.innerHTML = ''
      for (const track of visibleTracks(save)) {
        const tier = armoryTier(save, track.id)  // clamped to the track's real tier count
        const maxed = tier >= track.tierCosts.length
        const nextCost = maxed ? 0 : track.tierCosts[tier]
        const item = el('div', 'armory-item', grid)
        el('div', 'ai-icon', item, icon(track.icon))
        const body = el('div', 'ai-body', item)
        el('div', 'ai-name', body, `${track.name} <span class="ai-pips">${'●'.repeat(tier)}${'○'.repeat(track.tierCosts.length - tier)}</span>`)
        el('div', 'ai-desc', body, track.desc)
        const buy = el('button', 'btn small', item, maxed ? 'Maxed' : `Forge ${nextCost}★`) as HTMLButtonElement
        buy.disabled = maxed || starsAvailable(save) < nextCost
        buy.onclick = () => {
          if (buyTier(save, track.id)) { writeSave(save); rerender() }
        }
      }
    }
    rerender()

    const row = el('div', 'end-actions', card)
    const reset = el('button', 'btn ghost small', row, 'Reforge (free respec)') as HTMLButtonElement
    reset.onclick = () => { respec(save); writeSave(save); rerender() }
    const close = el('button', 'btn primary', row, 'Done') as HTMLButtonElement
    close.onclick = () => { overlay.remove(); this.show('levels') }
    bindDialog(overlay, card, () => { overlay.remove(); this.show('levels') })
  }

  private async renderHelp(): Promise<void> {
    const current = this.current
    const { renderHelp } = await import('./help.ts')
    if (this.current !== current) return
    renderHelp(this.root)
  }

}
