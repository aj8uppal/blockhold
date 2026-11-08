import { bindDialog } from './dialog.ts'
import { HUNTS, masteryReady } from '../game/hunts.ts'
import { QUALITY_OPTIONS, type QualityPreference } from '../core/quality.ts'
import { fmtDamage } from './screens.ts'
import type { Game, TargetMode } from '../game/game.ts'
import type { Hero } from '../game/hero.ts'
import type { Tower, TargetPolicy } from '../game/towers.ts'
import type { PlotInfo } from '../game/terrain.ts'
import type { Enemy } from '../game/units.ts'
import type { Trap, TrapSpotInfo } from '../game/traps.ts'
import {
  TowerKind, TowerLevelDef, TrapKind, TRAP_DEFS,
  OVERCHARGE_SHARD_COST, OVERCHARGE_DURATION, ASCEND_SHARD_COST, ASCEND_GOLD_COST,
} from '../game/types.ts'
import { towerTrees } from '../game/towerDefs.ts'
import { mythicFor } from '../game/mythics.ts'
import { TARGET_POLICY_LABEL, REACTIONS } from '../game/towers.ts'
import { isCoarsePointer } from '../core/utils.ts'
import { isPortalMode, isNativeApp } from '../core/platform.ts'
import { EARTHWORK_DEFS, raiseCost, type EarthworkSpot, type Earthwork, RAMPART_DAMAGE_BONUS, RAMPART_RANGE_BONUS } from '../game/earthworks.ts'
import { beatIndex, BEATS_PER_BAR } from '../game/beat.ts'
import { traitsOf, counterFor } from '../game/dossier.ts'
import { heroRankCost, heroRankGold, heroRankLevel } from '../game/hero.ts'
import type { EnemyDef, PerkDef } from '../game/types.ts'
import { icon, checkMark, BOSS_ART } from './icons.ts'
import { unlockLevel, levelForXp, levelProgress, MAX_LEVEL } from '../game/progress.ts'

/** a tower's rendered portrait, for the build bar */
const towerArt = (model: string) => `<span class="b-art"><img src="art/towers/${model}.webp" width="384" height="384" alt="" decoding="async" draggable="false"></span>`

function chip(label: string, value: string, cls = ''): string {
  return `<span class="chip${cls ? ' ' + cls : ''}"${cls.split(' ').includes('lit') ? ' title="Boosted · see Details"' : ''}><span class="chip-label">${label}</span><span class="chip-value">${value}</span></span>`
}

const TOWER_ICONS: Record<TowerKind, string> = { arrow: 'bow', mage: 'orb', cannon: 'bomb', barracks: 'helm', beacon: 'flame', ballista: 'target', seraph: 'seraph', tidecaller: 'wave' }
const TOWER_NAMES: Record<TowerKind, string> = { arrow: 'Arrow', mage: 'Mage', cannon: 'Cannon', barracks: 'Barracks', beacon: 'Beacon', ballista: 'Ballista', seraph: 'Seraph', tidecaller: 'Tidecaller' }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

/** how long a press has to last before it counts as inspecting rather than acting */
const HOLD_MS = 340

export class HUD {
  root: HTMLElement
  onHome: () => void = () => {}
  onFullscreen: () => void = () => {}
  onCoopSwitch: () => void = () => {}
  onCoopResync: () => Promise<void> = async () => {}
  private coopSwitchBtn!: HTMLButtonElement
  private resyncBtn!: HTMLButtonElement
  private resyncBusy = false
  private syncNote!: HTMLElement
  private inviteBtn!: HTMLButtonElement
  private overchargeAllBtn!: HTMLButtonElement

  private goldEl!: HTMLElement
  private shardsEl!: HTMLElement
  private livesEl!: HTMLElement
  private waveEl!: HTMLElement
  private speedBtn!: HTMLButtonElement
  private flowBtn!: HTMLButtonElement
  private pauseBtn!: HTMLButtonElement
  private sfxBtn!: HTMLButtonElement
  private musicBtn!: HTMLButtonElement
  private waveBtn!: HTMLButtonElement
  private wavePreviewEl!: HTMLElement
  private waveDetails!: HTMLDetailsElement
  private expansionBtn!: HTMLButtonElement
  private lastWavePreviewHtml = ''
  private beatEl!: HTMLElement
  private lastBeat = -1
  /** coarse pointers arm a build option on first tap and commit on the second */
  private armedBuild: string | null = null
  private abilityBtns: Record<'meteor' | 'reinforce', HTMLButtonElement> = {} as never
  private buildMenu!: HTMLElement
  private towerPanel!: HTMLElement
  private enemyTip!: HTMLElement
  private vignette!: HTMLElement
  private tipEnemy: Enemy | null = null
  /** ghost-click shield: taps that opened a menu must not also press its buttons */
  private menuOpenedAt = 0

  private menuGuard(fn: (ev: MouseEvent) => void): (ev: MouseEvent) => void {
    return (ev: MouseEvent) => {
      ev.stopPropagation()
      if (performance.now() - this.menuOpenedAt < 350) return
      fn(ev)
    }
  }
  private bannerEl!: HTMLElement
  private toastEl!: HTMLElement
  private modeHint!: HTMLElement
  private pauseOverlay!: HTMLElement
  private floaterPool: HTMLElement[] = []

  private lastGold = -1
  private xpEl!: HTMLElement
  private lastXp = -1
  private xpGainPending = 0
  private xpGainTimer = 0
  private lastOcHtml = ''
  private lastShards = -1
  private lastLives = -1
  private lastWaveText = ''
  private lastWaveBtnText = ''
  private currentTower: Tower | null = null
  private lastHeroId = ''
  private bannerTimer = 0
  private toastTimer = 0
  private lastRefreshAt = performance.now()
  private pauseDialogFocus: ((open: boolean) => void) | null = null

  constructor(private game: Game) {
    this.root = document.getElementById('hud')!
    // Safari (iPad) exits HTML5 fullscreen when anything keeps keyboard focus
    // ("typing isn't allowed in full screen"). Release button focus; selects
    // still need it so the visual quality picker remains usable
    this.root.addEventListener('focusin', (e) => {
      if (document.fullscreenElement && e.target instanceof HTMLButtonElement && !e.target.matches(':focus-visible')) e.target.blur()
    })
    this.buildTopBar()
    this.buildWaveButton()
    this.buildAbilities()
    this.buildMenu = el('div', 'build-menu hidden', this.root)
    this.buildMenu.setAttribute('role', 'region'); this.buildMenu.setAttribute('aria-label', 'Build options')
    // A fresh press on an existing control is intentional, even immediately
    // after the panel opens. Compatibility clicks still face the time guard.
    this.root.addEventListener('pointerdown', event => {
      if (event.target instanceof Element && event.target.closest('.build-menu button, .tower-panel button')) this.menuOpenedAt = 0
    }, { capture: true })
    this.towerPanel = el('div', 'tower-panel hidden', this.root)
    this.towerPanel.setAttribute('role', 'region'); this.towerPanel.setAttribute('aria-label', 'Selection details')
    document.addEventListener('pointerdown', event => {
      if (!(event.target instanceof Node)) return
      this.root.querySelectorAll<HTMLDetailsElement>('.wave-details[open], .sandbox-tools[open]').forEach(details => {
        if (!details.contains(event.target as Node)) details.open = false
      })
    })
    new ResizeObserver(() => this.syncInspectorOverflow()).observe(this.towerPanel)
    this.towerPanel.addEventListener('scroll', () => this.syncInspectorOverflow(), { passive: true })
    this.enemyTip = el('div', 'enemy-tip hidden', this.root)
    this.vignette = el('div', 'damage-vignette', this.root)
    this.bannerEl = el('div', 'banner hidden', this.root)
    this.toastEl = el('div', 'toast hidden', this.root)
    this.toastEl.setAttribute('role', 'status')
    this.toastEl.setAttribute('aria-live', 'polite')
    this.modeHint = el('div', 'mode-hint hidden', this.root)
    this.coachMark = el('div', 'coach-mark hidden', this.root)
    this.abilityTip = el('div', 'ability-tip hidden', this.root)
    this.beatEl = el('div', 'beat-meter hidden', this.root)
    this.beatEl.innerHTML = Array.from({ length: BEATS_PER_BAR }, () => '<i></i>').join('')
    this.buildPauseOverlay()
    game.hud = this
  }

  private buildTopBar(): void {
    const bar = el('div', 'topbar', this.root)
    new ResizeObserver(() => {
      const groups = [...bar.querySelectorAll(':scope > .topbar-group')].map(group => group.getBoundingClientRect().bottom)
      document.documentElement.style.setProperty('--hud-top-bottom', `${Math.max(...groups)}px`)
      // the inspector docks under the right-hand buttons, which stay on one
      // line when a narrow phone wraps the resource chips onto two
      if (groups[1] !== undefined) document.documentElement.style.setProperty('--hud-top-right', `${groups[1]}px`)
    }).observe(bar)
    const left = el('div', 'topbar-group', bar)
    this.livesEl = el('div', 'stat lives', left, `${icon('heart')} <b>20</b><span class="star-target" title="Keep this many lives for three stars"></span>`)
    this.goldEl = el('div', 'stat gold', left, `${icon('coin')} <b>0</b>`)
    this.shardsEl = el('div', 'stat shards', left, `${icon('gem')} <b>0</b>`)
    this.shardsEl.title = 'Veilshards — dropped by Shardbacks, elites, and bosses. Spend on tower Overcharge and Ascension.'
    this.waveEl = el('div', 'stat wave', left, `${icon('wave')} <b>0/10</b>`)
    for (const [stat, label] of [[this.livesEl, 'Lives'], [this.goldEl, 'Gold'], [this.shardsEl, 'Shards'], [this.waveEl, 'Wave']] as const) {
      const name = el('span', 'stat-label', stat, label)
      stat.prepend(name)
    }
    this.coopEl = el('div', 'stat coop hidden', left, '')
    // account experience, live: the level, a bar to the next, and the gain
    // from the last few kills. Before this the bar existed only on the menu,
    // so a battle never showed the thing it was earning.
    this.xpEl = el('div', 'stat xp', left,
      `<span class="xp-level">${icon('sparkle')} <b>1</b></span><span class="xp-progress"><span class="xp-bar" role="progressbar" aria-label="Account level progress"><i></i></span><span class="xp-remaining"></span></span><span class="xp-gain"></span>`)
    this.xpEl.title = 'Account experience. Every wave held pays; holding the map pays more.'
    const right = el('div', 'topbar-group', bar)
    this.speedBtn = el('button', 'icon-btn', right, '1×') as HTMLButtonElement
    this.speedBtn.title = 'Game speed (F)'
    this.speedBtn.setAttribute('aria-label', 'Game speed')
    this.speedBtn.onclick = () => this.game.toggleSpeed()
    this.flowBtn = el('button', 'icon-btn wave-flow-btn', right, `${icon('respawn')}<small class="flow-label">Auto</small>`)
    this.flowBtn.setAttribute('aria-label', 'Keep waves coming')
    this.flowBtn.onclick = () => this.game.setAutoWaves(!this.game.autoWaves)
    const doc = document as Document & { webkitFullscreenEnabled?: boolean }
    if ((doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && !isPortalMode() && !isNativeApp()) {
      const fs = el('button', 'icon-btn', right, icon('fullscreen', 'plain')) as HTMLButtonElement
      fs.setAttribute('aria-label', 'Toggle fullscreen'); fs.title = 'Fullscreen (V)'
      fs.onclick = () => this.onFullscreen()
    }
    this.pauseBtn = el('button', 'icon-btn', right, icon('pause', 'plain')) as HTMLButtonElement
    this.pauseBtn.title = 'Pause (P)'
    this.pauseBtn.setAttribute('aria-label', 'Pause')
    this.pauseBtn.onclick = () => this.game.togglePause()
    const home = el('button', 'icon-btn', right, icon('castle', 'plain')) as HTMLButtonElement
    home.title = 'Back to castle (menu)'
    home.setAttribute('aria-label', 'Back to the menu')
    home.onclick = () => this.onHome()
  }

  private buildWaveButton(): void {
    const wrap = el('div', 'wave-call-wrap', this.root.querySelector('.topbar') as HTMLElement)
    this.waveBtn = el('button', 'wave-call hidden', wrap) as HTMLButtonElement
    this.waveBtn.onclick = () => this.game.callWave()
    // The roster used to be hover-only, which made it unreachable on touch:
    // a tap on this button calls the wave, so there is no hover to gate on.
    // It is now always on screen while a wave is pending, for every pointer.
    this.waveDetails = el('details', 'wave-details hidden', wrap)
    const summary = el('summary', '', this.waveDetails, 'Incoming')
    summary.setAttribute('aria-label', 'Wave details')
    this.wavePreviewEl = el('div', 'wave-preview hidden', this.waveDetails)
  }

  /** roster + decisive counters for the pending wave; empty string when none */
  private wavePreviewHtml(): string {
    const w = this.game.waves
    const preview = w?.nextWavePreview()
    if (!preview || !preview.length) return ''
    const roster = preview
      .map(p => `<span class="wp-unit${p.boss ? ' boss' : ''}">${p.count}× ${p.name}</span>`)
      .join('')
    const threats = w!.nextWaveThreats()
    const tags = threats.length
      ? `<span class="wp-threats">${threats.map(t => `<span class="wp-tag">${t}</span>`).join('')}</span>`
      : ''
    return `<span class="wp-label">Incoming</span>${roster}${tags}`
  }

  private heroBtn!: HTMLButtonElement
  private waveMode!: HTMLSelectElement

  private coopEl!: HTMLElement
  /** the room this battle is shared with, or nothing */
  setCoop(info: { code: string, seats: number, connected: number } | null): void {
    this.coopEl.classList.toggle('hidden', !info)
    if (!info) return
    this.coopEl.innerHTML = `${icon('helmPlume')} <b>${info.connected}/${info.seats}</b> <span class="coop-code">${info.code}</span>`
    this.coopEl.title = `Co-op room ${info.code}: ${info.connected} of ${info.seats} wardens connected`
  }
  /** the room's clock has gone quiet */
  setCoopWaiting(on: boolean): void {
    this.coopEl.classList.toggle('waiting', on)
    if (on && !this.coopEl.dataset.waitSaid) { this.coopEl.dataset.waitSaid = '1'; this.showToast('Waiting for the room…', 2) }
    if (!on) delete this.coopEl.dataset.waitSaid
  }
  private sigEl: HTMLElement | null = null
  private lastSigText = ''
  private lastBarkAt = -10
  private barkTimer: number | null = null
  private bumpTimer: number | null = null

  /**
   * The hero acknowledges the player: the portrait nods every time, and a
   * short caption appears unless one did a moment ago. Repeated move orders
   * stay quiet; a level or a signature always speaks.
   */
  heroBark(text: string): void {
    this.heroBtn.classList.remove('bump')
    void this.heroBtn.offsetWidth   // restart the animation
    this.heroBtn.classList.add('bump')
    if (this.bumpTimer) clearTimeout(this.bumpTimer)
    this.bumpTimer = window.setTimeout(() => this.heroBtn.classList.remove('bump'), 360)
    if (!text) return
    const now = performance.now() / 1000
    if (now - this.lastBarkAt < 2.2) return
    this.lastBarkAt = now
    const cap = this.heroBtn.querySelector('.hero-bark') as HTMLElement | null
    if (!cap) return
    cap.textContent = text
    cap.classList.add('show')
    if (this.barkTimer) clearTimeout(this.barkTimer)
    this.barkTimer = window.setTimeout(() => cap.classList.remove('show'), 1700)
  }

  private buildAbilities(): void {
    const bar = el('div', 'abilities', this.root)
    this.heroBtn = el('button', 'ability hero-btn', bar) as HTMLButtonElement
    this.heroBtn.innerHTML =
      `<span class="ability-icon"><img class="hero-face" src="art/heroes/aldric.webp" alt=""></span><span class="cd-sweep"></span>` +
      '<span class="hotkey">1</span><span class="hero-level">1</span><span class="hero-hp"><span class="hero-hp-fill"></span></span>' +
      '<span class="hero-bark" aria-live="polite"></span>'
    this.heroBtn.title = 'Select or deselect your hero (1). Tap the ground to move.'
    this.heroBtn.setAttribute('aria-label', 'Select your hero')
    this.heroBtn.onclick = () => this.game.selectHero(true)
    const mk = (key: 'meteor' | 'reinforce', ico: string, name: string, hotkey: string, desc: string) => {
      const btn = el('button', 'ability', bar) as HTMLButtonElement
      btn.innerHTML = `<span class="ability-icon">${icon(ico)}</span><span class="cd-sweep"></span><span class="hotkey">${hotkey}</span><span class="ability-caption">${key === 'meteor' ? 'Meteor' : 'Guard'}</span>`
      btn.title = `${name} — ${desc}`
      btn.setAttribute('aria-label', name)
      // title tooltips do not exist on touch, so the abilities were unlabelled
      // on the platform this game targets: first tap explains, second commits
      // one tap enters targeting and shows what it does while you aim; the tap
      // that follows is the target itself, which is the only step this ability
      // genuinely needs. Holding reads it without arming anything.
      this.tapOrHold(`ability:${key}`, btn, () => this.showAbilityTip(name, desc), () => this.hideAbilityTip())
      btn.onclick = () => {
        if (this.heldFor === `ability:${key}`) { this.heldFor = null; return }
        const on = this.game.targetMode === key
        this.game.setTargetMode(on ? null : key)
        this.hideAbilityTip()
      }
      this.abilityBtns[key] = btn
    }
    mk('reinforce', 'shield', 'Reinforcements', '3', 'Summon two militia anywhere on the road for 14s. Hotkey 3.')
    mk('meteor', 'meteor', 'Meteor Storm', '4', 'Rain three meteors on a target area (true damage + stun). Hotkey 4.')
    // the hero's signature used to fire itself; it is the player's to spend now
    this.signatureBtn = el('button', 'ability', bar) as HTMLButtonElement
    this.signatureBtn.innerHTML =
      `<span class="ability-icon">${icon('quake')}</span><span class="cd-sweep"></span><span class="hotkey">2</span><span class="ability-caption">Ability</span>`
    bar.insertBefore(this.signatureBtn, this.abilityBtns.reinforce)
    this.overchargeAllBtn = el('button', 'ability overcharge-all hidden', bar) as HTMLButtonElement
    this.overchargeAllBtn.onclick = () => this.game.overchargeAll()
    this.expansionBtn = el('button', 'ability expansion-button hidden', bar) as HTMLButtonElement
    this.expansionBtn.onclick = () => this.game.setTargetMode(this.game.targetMode === 'expand' ? null : 'expand')
    this.signatureBtn.setAttribute('aria-label', 'Hero signature ability')
    // the signature lands on the hero, so there is nowhere to aim and nothing
    // to confirm: one tap casts it
    this.tapOrHold('ability:signature', this.signatureBtn, () => {
      const h = this.game.hero
      if (h) this.showAbilityTip(h.abilityName, h.abilityBlurb)
    }, () => this.hideAbilityTip())
    this.signatureBtn.onclick = () => {
      if (this.heldFor === 'ability:signature') { this.heldFor = null; return }
      this.hideAbilityTip()
      this.game.castHeroSignature()
    }
  }

  private signatureBtn!: HTMLButtonElement
  private lastSignatureId = ''
  private armedAbility: string | null = null
  private coachMark!: HTMLElement
  private lastCoach: string | null = null

  /**
   * One thing at a time, in the player's language. Never blocks play: it is a
   * line of text with a way to dismiss it, not a modal.
   */
  setCoachMark(text: string | null): void {
    if (text === this.lastCoach) return
    this.lastCoach = text
    if (!text) { this.coachMark.classList.add('hidden'); return }
    this.coachMark.innerHTML = ''
    el('span', 'coach-text', this.coachMark, text)
    const skip = el('button', 'coach-skip', this.coachMark, 'Skip') as HTMLButtonElement
    skip.title = 'Stop showing these'
    skip.onclick = () => this.game.skipOnboarding()
    this.coachMark.classList.remove('hidden')
  }
  private abilityTip!: HTMLElement

  private showAbilityTip(name: string, desc: string): void {
    this.abilityTip.innerHTML = `<b>${name}</b> — ${desc}`
    this.abilityTip.classList.remove('hidden')
  }

  private hideAbilityTip(): void {
    if (this.armedAbility) return
    this.abilityTip.classList.add('hidden')
  }

  private static readonly SIGNATURE_ICON: Record<string, string> = {
    slam: 'quake', volley: 'bow', nova: 'lightning',
  }

  /**
   * Sound, music, fullscreen and home used to sit in the combat bar, so four
   * of its six buttons were configuration competing with tactical information
   * on the smallest screens the game supports. They live behind pause now,
   * which is also what portals ask for: CrazyGames provides its own
   * fullscreen control and asks games not to ship one.
   */
  private buildPauseOverlay(): void {
    this.pauseOverlay = el('div', 'pause-overlay hidden', this.root)
    this.pauseOverlay.onclick = event => { if (event.target === this.pauseOverlay) this.game.togglePause() }
    const card = el('div', 'pause-card', this.pauseOverlay)
    el('h2', '', card, 'Paused')
    this.pauseDialogFocus = bindDialog(this.pauseOverlay, card, () => this.game.togglePause())
    const resume = el('button', 'btn primary', card, 'Resume') as HTMLButtonElement
    resume.onclick = () => this.game.togglePause()
    const guide = el('button', 'btn ghost', card, `${icon('eye')} Field guide`) as HTMLButtonElement
    guide.onclick = async () => { const { renderFieldGuide } = await import('./fieldGuide.ts'); renderFieldGuide(this.root, this.game.save.seenEnemies, () => {}) }

    const settings = el('div', 'pause-settings', card)
    const sfxIcon = () => icon(this.game.save.sfxMuted ? 'soundOff' : 'soundOn', 'plain')
    this.sfxBtn = el('button', 'icon-btn', settings, sfxIcon()) as HTMLButtonElement
    this.sfxBtn.title = 'Sound effects'
    this.sfxBtn.setAttribute('aria-label', 'Toggle sound effects')
    this.sfxBtn.setAttribute('aria-pressed', String(!this.game.save.sfxMuted))
    this.sfxBtn.onclick = () => { this.game.toggleSfx(); this.sfxBtn.innerHTML = sfxIcon(); this.sfxBtn.setAttribute('aria-pressed', String(!this.game.save.sfxMuted)) }
    this.musicBtn = el('button', 'icon-btn', settings, icon(this.game.save.musicMuted ? 'musicOff' : 'music', 'plain')) as HTMLButtonElement
    this.musicBtn.title = 'Music'
    this.musicBtn.setAttribute('aria-label', 'Toggle music')
    this.musicBtn.classList.toggle('muted', this.game.save.musicMuted)
    this.musicBtn.setAttribute('aria-pressed', String(!this.game.save.musicMuted))
    this.musicBtn.onclick = () => {
      this.game.toggleMusic()
      this.musicBtn.innerHTML = icon(this.game.save.musicMuted ? 'musicOff' : 'music', 'plain')
      this.musicBtn.classList.toggle('muted', this.game.save.musicMuted)
      this.musicBtn.setAttribute('aria-pressed', String(!this.game.save.musicMuted))
    }
    const qualityLabel = el('label', 'quality-setting', card, 'Visual quality ')
    const quality = el('select', '', qualityLabel) as HTMLSelectElement
    quality.setAttribute('aria-label', 'Visual quality')
    for (const [value, name] of Object.entries(QUALITY_OPTIONS)) {
      const option = document.createElement('option'); option.value = value; option.textContent = name; quality.append(option)
    }
    quality.value = this.game.engine.qualityPreference
    quality.onchange = () => this.game.engine.setQuality(quality.value as QualityPreference)
    el('small', 'quality-note', card, 'Low reduces detail and shadows. Battery saver also draws at 30 fps. Combat speed stays the same.')
    const wavesLabel = el('label', 'quality-setting', card, 'Wave flow ')
    this.waveMode = el('select', '', wavesLabel) as HTMLSelectElement
    this.waveMode.setAttribute('aria-label', 'Wave flow')
    this.waveMode.innerHTML = '<option value="auto">Keep waves coming</option><option value="manual">Wait between rounds</option>'
    this.waveMode.onchange = () => this.game.setAutoWaves(this.waveMode.value === 'auto')
    el('small', 'quality-note', card, 'Wait between rounds clears the field, then lets you start the next wave. Manual waves give no early-call bonus.')
    this.coopSwitchBtn = el('button', 'btn ghost pause-coop', card, 'Invite a friend to this battle') as HTMLButtonElement
    this.coopSwitchBtn.onclick = () => this.onCoopSwitch()
    this.resyncBtn = el('button', 'btn ghost pause-resync hidden', card, 'Resync battle')
    this.resyncBtn.onclick = async () => {
      if (this.resyncBusy) return
      this.resyncBusy = true
      this.resyncBtn.textContent = 'Rejoining…'
      try { await this.onCoopResync() }
      finally { this.resyncBusy = false; this.resyncBtn.textContent = 'Resync battle' }
    }
    this.syncNote = el('small', 'quality-note hidden', card)
    this.inviteBtn = el('button', 'btn ghost pause-invite hidden', card, 'Copy invite link') as HTMLButtonElement
    this.inviteBtn.onclick = async () => {
      const session = this.game.coop
      if (!session) return
      try { await navigator.clipboard.writeText(session.shareUrl()); this.showToast('Invite link copied', 2) }
      catch { this.showToast(`Invite your friend with room code ${session.code}`, 6) }
    }

    this.quitBtn = el('button', 'btn pause-exit', card, 'Abandon mission') as HTMLButtonElement
    this.quitBtn.onclick = () => {
      if (!this.game.canSaveSession && !this.game.coop && this.game.bankedWave() === null && !this.exitArmed) {
        this.exitArmed = true
        this.quitBtn.textContent = 'Abandon without saving?'
        this.quitBtn.classList.add('confirming')
        const exit = document.getElementById('rotate-exit')
        if (exit) exit.textContent = this.quitBtn.textContent
        return
      }
      if (this.game.canSaveSession && !this.game.saveSession()) {
        this.showToast('Could not save this battle. Keep the game open and try again.', 5)
        const note = document.getElementById('rotate-note')
        if (note) note.textContent = 'Could not save. Keep the game open and try again.'
        return
      }
      this.onHome()
    }
    resume.after(this.quitBtn)
    this.bankedEl = el('div', 'pause-banked', card)
  }
  private exitArmed = false
  private quitBtn!: HTMLButtonElement
  private bankedEl!: HTMLElement

  // ---------------- per-frame refresh ----------------

  private huntStatus: HTMLElement | null = null
  private huntStatusText = ''
  private refreshHunt(game: Game): void {
    if (!this.huntStatus) {
      this.huntStatus = el('div', 'hunt-status hidden', this.root)
      this.huntStatus.innerHTML = '<span></span><progress max="1" value="1" aria-label="Boss health"></progress>'
    }
    const show = !!game.hunt && game.phase === 'playing'
    this.huntStatus.classList.toggle('hidden', !show)
    if (!show) return
    const boss = game.enemies.find(e => e.alive && (e.def.id === game.hunt!.boss || e.def.id === 'veilempressLanded'))
    const stage = !boss ? `Wave ${Math.max(1, (game.waves?.waveIndex ?? 0) + 1)} / 10 · prepare your defense`
      : boss.def.id === 'veilempress' ? 'Phase 1 / 2 · break her wings; keep ground coverage ready'
      : boss.def.id === 'veilempressLanded' ? 'Phase 2 / 2 · she has landed; focus the armored crown'
      : 'Final boss · the green ring raises fallen escorts; focus the Ossuary'
    const text = `${game.hunt!.name} · ${stage}`
    if (text !== this.huntStatusText) { this.huntStatus.querySelector('span')!.textContent = text; this.huntStatusText = text }
    const hp = this.huntStatus.querySelector('progress')!
    hp.hidden = !boss
    if (boss) { hp.value = Math.max(0, boss.hp / boss.maxHp); hp.setAttribute('aria-valuetext', `${Math.ceil(Math.max(0, boss.hp))} of ${boss.maxHp} health`) }
  }

  private lastTowerLevel = -1
  refresh(game: Game): void {
    const towerLevel = levelForXp(game.towerXp)
    if (towerLevel !== this.lastTowerLevel) {
      this.lastTowerLevel = towerLevel
      if (game.selectedPlot && !this.buildMenu.classList.contains('hidden')) {
        const rect = this.buildMenu.getBoundingClientRect()
        this.openBuildMenu(game.selectedPlot, rect.left + rect.width / 2, rect.bottom + 24)
      }
    }
    this.coopSwitchBtn.disabled = !game.canSwitchCoop
    this.resyncBtn.classList.toggle('hidden', !game.coop)
    this.resyncBtn.disabled = this.resyncBusy || game.isRecovering || !game.coop || game.coop.lost
    this.syncNote.classList.toggle('hidden', !game.coop)
    const syncNote = game.coopDesync
      ? `Boards diverged at turn ${game.coopDesync.turn}. Resync rebuilds your board from the room’s orders.`
      : 'Resync rebuilds this board from the shared orders and leaves the battle paused.'
    if (this.syncNote.textContent !== syncNote) this.syncNote.textContent = syncNote
    this.coopEl.classList.toggle('out-of-sync', !!game.coopDesync)
    this.coopSwitchBtn.title = game.coop && !game.canSwitchCoop ? 'Waiting for the shared board to finish pending orders.' : ''
    this.refreshHunt(game)
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.lastRefreshAt) / 1000)
    this.lastRefreshAt = now
    if (game.phase === 'idle') return
    if (game.gold !== this.lastGold) {
      this.lastGold = game.gold
      this.goldEl.querySelector('b')!.textContent = game.isSandbox ? '∞' : `${game.gold}`
    }
    if (game.shards !== this.lastShards) {
      this.lastShards = game.shards
      this.shardsEl.querySelector('b')!.textContent = game.isSandbox ? '∞' : `${game.shards}`
    }
    if (game.lives !== this.lastLives) {
      this.lastLives = game.lives
      this.livesEl.querySelector('b')!.textContent = game.isSandbox ? '∞' : `${game.lives}`
      // the three-star line, beside the number it is measured against
      const target = game.starTarget()
      const tEl = this.livesEl.querySelector('.star-target') as HTMLElement
      tEl.textContent = target === null ? '' : `${target}`
      tEl.classList.toggle('below', target !== null && game.lives < target)
    }
    // a capstone's special attack, counting down where the player can see it
    if (this.currentTower && this.sigEl) {
      const r = this.currentTower.signatureReadout(game.time)
      const text = r ? `${icon('sparkle')} ${r.text}` : ''
      if (text !== this.lastSigText) { this.lastSigText = text; this.sigEl.innerHTML = text; this.sigEl.classList.toggle('next', !!r?.next) }
    }
    const xp = game.xpPreview()
    if (xp !== this.lastXp) {
      this.lastXp = xp
      const { level, into, span } = levelProgress(xp)
      this.xpEl.querySelector('.xp-level b')!.textContent = `${level}`
      const maxed = level >= MAX_LEVEL
      const percent = maxed ? 100 : Math.round(Math.min(1, into / span) * 100)
      const remaining = maxed ? 'Max level' : `${(span - into).toLocaleString()} XP to Lv ${level + 1}`
      this.xpEl.querySelector('.xp-remaining')!.textContent = remaining
      const bar = this.xpEl.querySelector('.xp-bar')!
      bar.setAttribute('aria-valuemin', '0')
      bar.setAttribute('aria-valuemax', '100')
      bar.setAttribute('aria-valuenow', `${percent}`)
      bar.setAttribute('aria-valuetext', maxed ? remaining : `${into.toLocaleString()} of ${span.toLocaleString()} XP; ${remaining}`)
      ;(this.xpEl.querySelector('.xp-bar i') as HTMLElement).style.width = `${percent}%`
      this.xpEl.title = maxed ? 'Maximum account level reached' : `${into.toLocaleString()} / ${span.toLocaleString()} XP · ${remaining}`
      this.xpEl.classList.remove('pulse'); void this.xpEl.offsetWidth; this.xpEl.classList.add('pulse')
    }
    // the gain readout batches a burst of kills into one number and fades
    if (this.xpGainTimer > 0) {
      this.xpGainTimer -= dt
      if (this.xpGainTimer <= 0) {
        this.xpGainPending = 0
        this.xpEl.querySelector('.xp-gain')!.textContent = ''
        this.xpEl.classList.remove('gaining')
      }
    }
    const w = game.waves
    this.waveMode.value = game.autoWaves ? 'auto' : 'manual'
    this.flowBtn.disabled = game.isSandbox
    const flowLabel = game.isSandbox ? 'Waves' : game.autoWaves ? 'Auto' : 'Wait'
    const flowText = this.flowBtn.querySelector('.flow-label')!
    if (flowText.textContent !== flowLabel) flowText.textContent = flowLabel
    this.flowBtn.setAttribute('aria-pressed', String(game.autoWaves))
    this.flowBtn.title = game.isSandbox ? 'Use Sandbox tools to send enemies' : game.autoWaves ? 'Wave flow: automatic · tap to wait between rounds' : 'Wave flow: manual · tap to keep waves coming'
    this.flowBtn.classList.toggle('manual', !game.autoWaves)
    this.waveMode.disabled = game.isSandbox
    if (w) {
      const waveText = game.isSandbox ? 'Sandbox' : game.isEndless
        ? `${Math.max(1, w.waveIndex + 1)}/∞`
        // past the authored end the count is "held past the end", not a
        // fraction of a chunk whose size means nothing to the player
        : w.totalWaves > w.authoredWaves
          ? `${w.authoredWaves}+${w.freeplayDepth}`
          : `${Math.min(w.waveIndex + 1, w.totalWaves)}/${w.totalWaves}`
      if (waveText !== this.lastWaveText) {
        this.lastWaveText = waveText
        this.waveEl.querySelector('b')!.textContent = waveText
      }
      // wave call button
      let btnText = ''
      const noCall = !!game.trial && !game.trial.earlyCall && w.waveIndex >= 0
      if (!game.isSandbox && game.phase === 'playing' && w.phase === 'countdown' && !w.isLastWaveStarted && !noCall) {
        const bonus = game.autoWaves ? w.earlyCallBonus() : 0
        const secs = Math.ceil(w.countdown)
        // the whole bargain: the gold, the shard a defied surge pays, and what is still out there
        const onField = game.enemies.filter(e => e.alive).length
        const shard = w.nextWaveIsSurge() && w.countdown >= 8 ? ` +1${icon('gem')}` : ''
        const surgeWarn = (w.nextWaveIsSurge() ? ` · ${icon('moon')} Veiltide!` : '') + (onField > 0 ? ` · ${onField} still on the field` : '')
        btnText = w.waveIndex < 0
          ? `${icon('swords')} Begin assault <span class="call-sub">${secs}s · +${bonus}${icon('coin')}${shard}<span class="call-explanation"> if called now${surgeWarn}</span></span>`
          : `${icon('swords')} Call wave ${w.waveIndex + 2} <span class="call-sub">${secs}s · +${bonus}${icon('coin')}${shard}<span class="call-explanation"> early bonus${surgeWarn}</span></span>`
        if (!game.autoWaves) btnText = onField > 0 ? '' : `${icon('swords')} ${w.waveIndex < 0 ? 'Begin assault' : `Start wave ${w.waveIndex + 2}`}`
      }
      if (btnText !== this.lastWaveBtnText) {
        this.lastWaveBtnText = btnText
        if (btnText) {
          this.waveBtn.innerHTML = btnText
          this.waveBtn.classList.remove('hidden')
        } else {
          this.waveBtn.classList.add('hidden')
          this.wavePreviewEl.classList.add('hidden')
          this.waveDetails.classList.add('hidden'); this.waveDetails.open = false
          this.lastWavePreviewHtml = ''
        }
      }
      // the roster rides with the button, so it is never hover-gated
      if (btnText) {
        const html = this.wavePreviewHtml()
        if (html !== this.lastWavePreviewHtml) {
          this.lastWavePreviewHtml = html
          this.wavePreviewEl.innerHTML = html
          const incoming = w.nextWavePreview() ?? []
          this.waveDetails.querySelector('summary')!.textContent = incoming.length === 1 ? `${incoming[0].count}× ${incoming[0].name}` : `${incoming.reduce((sum, unit) => sum + unit.count, 0)} incoming`
          this.waveDetails.classList.toggle('boss', incoming.some(unit => unit.boss))
          this.waveDetails.classList.toggle('hidden', !html)
          this.wavePreviewEl.classList.toggle('hidden', !html)
        }
      }
    }
    // live enemy tooltip: follow the enemy, keep hp/armor fresh, hide on death
    if (this.tipEnemy) {
      if (!this.tipEnemy.alive) {
        this.hideEnemyTip()
      } else {
        const p = game.projectToScreen(this.tipEnemy.pos.x, this.tipEnemy.pos.y + this.tipEnemy.barY + 0.1, this.tipEnemy.pos.z)
        if (!p) this.hideEnemyTip()
        else { this.updateEnemyTip(this.tipEnemy); this.positionEnemyTip(p.x, p.y) }
      }
    }
    // hero portrait (reflects the chosen hero)
    const hero = game.hero
    if (hero) {
      if (this.lastHeroId !== hero.heroDef.id) {
        this.lastHeroId = hero.heroDef.id
        const heroIco = this.heroBtn.querySelector('.ability-icon') as HTMLElement
        if (heroIco) heroIco.innerHTML = `<img class="hero-face" src="art/heroes/${hero.heroDef.id}.webp" alt="">`
        this.heroBtn.title = `${hero.heroDef.name} ${hero.heroDef.title} — select, then click the ground to move. ${hero.abilityName}: ${hero.abilityBlurb} Hotkey 1; press again to deselect.`
      }
      const sweep = this.heroBtn.querySelector('.cd-sweep') as HTMLElement
      // dead: respawn countdown · alive: signature-ability recharge
      sweep.classList.toggle('ability-cd', !hero.dead)
      sweep.style.setProperty('--p', `${(hero.dead ? hero.respawnFraction : hero.abilityFraction) * 100}%`)
      const fill = this.heroBtn.querySelector('.hero-hp-fill') as HTMLElement
      const frac = Math.max(0, hero.hp / hero.maxHp)
      fill.style.width = `${frac * 100}%`
      fill.style.background = frac > 0.55 ? '#62d84a' : frac > 0.25 ? '#e8b23c' : '#d8452f'
      const lvl = this.heroBtn.querySelector('.hero-level') as HTMLElement
      if (lvl.textContent !== `${hero.level}`) lvl.textContent = `${hero.level}`
      this.heroBtn.classList.toggle('ready', !hero.dead && hero.abilityCooldown <= 0)
      this.heroBtn.classList.toggle('downed', hero.dead)
      this.heroBtn.classList.toggle('active', game.heroSelected)
      this.heroBtn.setAttribute('aria-pressed', String(game.heroSelected))
    }
    const credits = game.expansionCredits
    this.expansionBtn.classList.toggle('hidden', credits <= 0)
    this.expansionBtn.classList.toggle('active', game.targetMode === 'expand')
    this.expansionBtn.disabled = game.paused
    const expansionText = game.isSandbox ? 'Place plot · unlimited' : `Place plot · ${credits} available`
    if (this.expansionBtn.getAttribute('aria-label') !== expansionText) {
      this.expansionBtn.setAttribute('aria-label', expansionText)
      this.expansionBtn.innerHTML = `${icon('castle')}<span>Plot · ${game.isSandbox ? '∞' : credits}</span>`
      this.expansionBtn.title = game.isSandbox ? 'Place a new foundation on clear ground.' : 'Place a new foundation on clear ground. Earn one every 15 endless waves cleared.'
    }
    const chargeCost = game.overchargeAllCost
    this.overchargeAllBtn.classList.toggle('hidden', game.towers.every(t => t.isBarracks || t.isBeacon || t.isGhost))
    this.overchargeAllBtn.disabled = !chargeCost || game.shards < chargeCost || game.paused
    const chargeText = `Overcharge all · ${chargeCost} shards`
    if (this.overchargeAllBtn.getAttribute('aria-label') !== chargeText) {
      this.overchargeAllBtn.setAttribute('aria-label', chargeText)
      this.overchargeAllBtn.innerHTML = `${icon('lightning')}<span>All · ${chargeCost}${icon('gem')}</span>`
      this.overchargeAllBtn.title = `Overcharge every ready attacking tower. Costs ${chargeCost} shards. Towers already charged or cooling down are skipped.`
    }
    // ability cooldowns
    for (const key of ['meteor', 'reinforce'] as const) {
      const st = game.abilities[key]
      const btn = this.abilityBtns[key]
      const frac = st.cooldown / st.max
      const sweep = btn.querySelector('.cd-sweep') as HTMLElement
      sweep.style.setProperty('--p', `${frac * 100}%`)
      btn.classList.toggle('ready', st.cooldown <= 0)
      btn.classList.toggle('active', game.targetMode === key)
    }
    // hero signature button: icon follows the chosen hero, sweep follows its cooldown
    if (game.hero) {
      const h = game.hero
      if (this.lastSignatureId !== h.heroDef.id) {
        this.lastSignatureId = h.heroDef.id
        const ico = HUD.SIGNATURE_ICON[h.heroDef.ability.kind] ?? 'sparkle'
        const slot = this.signatureBtn.querySelector('.ability-icon') as HTMLElement
        if (slot) slot.innerHTML = icon(ico)
        this.signatureBtn.title = `${h.abilityName} — ${h.abilityBlurb} Hotkey 2.`
      }
      const sweep = this.signatureBtn.querySelector('.cd-sweep') as HTMLElement
      sweep.style.setProperty('--p', `${h.abilityFraction * 100}%`)
      this.signatureBtn.classList.toggle('ready', h.signatureReady)
      this.signatureBtn.classList.toggle('downed', h.dead)
    }
    // the beat meter: only in the Bellfoundry, and only while a battle runs
    if (game.isBellfoundry && game.phase === 'playing') {
      this.beatEl.classList.remove('hidden')
      const b = beatIndex(game.time)
      if (b !== this.lastBeat) {
        this.lastBeat = b
        const pips = this.beatEl.children
        for (let i = 0; i < pips.length; i++) {
          pips[i].classList.toggle('on', i === b)
          pips[i].classList.toggle('downbeat', i === 0)
        }
      }
    } else if (!this.beatEl.classList.contains('hidden')) {
      this.beatEl.classList.add('hidden')
      this.lastBeat = -1
    }
    this.refreshHeroPanel()
    // live kill tally on the open tower/trap/hero panel
    const killSource = this.currentTower ?? this.currentTrap ?? this.currentHero
    if (killSource && !this.towerPanel.classList.contains('hidden')) {
      const killsEl = this.towerPanel.querySelector('.tp-kill-n')
      if (killsEl) {
        const text = `${killSource.kills}`
        if (killsEl.textContent !== text) killsEl.textContent = text
      }
      const dmgEl = this.towerPanel.querySelector('.tp-dmg-n')
      if (dmgEl) {
        const text = fmtDamage(killSource.damage)
        if (dmgEl.textContent !== text) dmgEl.textContent = text
      }
    }
    this.refreshMasteryProgress()
    // tower panel gold/shard-dependent button states
    if (this.currentTower && !this.towerPanel.classList.contains('hidden')) {
      this.refreshStatBlock()
      const setNeed = (b: HTMLButtonElement, text: string) => {
        const n = b.querySelector('.u-need')
        if (n && n.textContent !== text) n.textContent = text
      }
      this.towerPanel.querySelectorAll<HTMLButtonElement>('button[data-cost]').forEach(b => {
        const short = Number(b.dataset.cost) - game.gold
        b.disabled = short > 0
        setNeed(b, short > 0 ? `Needs ${short} more gold` : '')
      })
      this.towerPanel.querySelectorAll<HTMLButtonElement>('button.ascend').forEach(b => {
        const shards = Math.max(0, ASCEND_SHARD_COST - game.shards), gold = Math.max(0, ASCEND_GOLD_COST - game.gold)
        b.disabled = shards > 0 || gold > 0
        setNeed(b, shards > 0 || gold > 0
          ? `Needs ${[shards > 0 ? `${shards} more ${shards === 1 ? 'shard' : 'shards'}` : '', gold > 0 ? `${gold} more gold` : ''].filter(Boolean).join(' and ')}`
          : '')
      })
      const oc = document.getElementById('oc-btn') as HTMLButtonElement | null
      if (oc && !oc.classList.contains('confirming')) {
        const t = this.currentTower
        oc.disabled = !t.canOvercharge(game)
        const cdLeft = Math.max(0, t.overchargeCdUntil - game.time)
        const live = t.isOvercharged(game)
        const secs = Math.ceil(live ? t.overchargeUntil - game.time : cdLeft)
        const html = icon('lightning') + (live || cdLeft > 0 ? `<span>${secs}s</span>` : `${icon('gem')}<span>${OVERCHARGE_SHARD_COST}</span>`)
        if (html !== this.lastOcHtml) {
          this.lastOcHtml = html
          oc.innerHTML = html
          oc.classList.toggle('lit', live)
          oc.setAttribute('aria-label', live ? `Overcharged · ${secs}s left` : cdLeft > 0 ? `Overcharge recharging · ${secs}s` : `Overcharge · ${OVERCHARGE_SHARD_COST} shards`)
        }
      }
    }
    if (!this.buildMenu.classList.contains('hidden')) {
      this.buildMenu.querySelectorAll<HTMLButtonElement>('button[data-cost]').forEach(b => {
        b.classList.toggle('poor', game.gold < Number(b.dataset.cost))
        b.setAttribute('aria-disabled', String(game.gold < Number(b.dataset.cost)))
      })
    }
    // timers
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt
      if (this.bannerTimer <= 0) this.bannerEl.classList.add('hidden')
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toastEl.classList.add('hidden')
    }
  }

  // ---------------- build menu ----------------

  private resetBuildMenu(): void {
    this.buildMenu.innerHTML = ''
    this.buildMenu.style.gridTemplateColumns = ''
    const head = el('div', 'build-head', this.buildMenu)
    const label = el('div', '', head)
    el('b', '', label, 'Build')
    el('small', '', label, isCoarsePointer() ? 'Tap to build · hold to inspect' : 'Hover to inspect · click to build')
    const close = el('button', 'tp-close', head, icon('close')) as HTMLButtonElement
    close.setAttribute('aria-label', 'Close build menu')
    close.onclick = () => this.game.clearSelection()
    this.buildMenu.scrollTop = 0
  }

  openBuildMenu(plot: PlotInfo, x: number, y: number): void {
    this.armedBuild = null
    this.resetBuildMenu()
    if (plot.water) {
      this.buildMenu.style.gridTemplateColumns = '1fr'
      this.buildMenu.querySelector('.build-head b')!.textContent = 'Build on water'
      this.buildMenu.querySelector('.build-head small')!.textContent = 'One Tidecaller per mooring'
    }
    const kinds: TowerKind[] = plot.water ? ['tidecaller'] : ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon', 'seraph']
    for (const kind of kinds) {
      const def = towerTrees[kind].levels[0]
      // a tower the account has not reached stays on the menu, greyed and
      // labelled with its level, so the player knows the roster is bigger
      // than what they can build today and what it takes to grow it
      if (!this.game.towerUnlocked(kind)) {
        const lockBtn = el('button', 'build-option locked', this.buildMenu) as HTMLButtonElement
        lockBtn.innerHTML = `${towerArt(def.model)}<span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">${icon('lock')} Lv ${unlockLevel('tower', kind)}</span>`
        lockBtn.disabled = true
        lockBtn.title = `${TOWER_NAMES[kind]} unlocks at account level ${unlockLevel('tower', kind)}`
        continue
      }
      // a trial's arsenal is the trial: the rest of the roster stays visible
      // and shut, so the restriction reads as a rule and not a missing button
      if (this.game.trial && !this.game.trial.kinds.includes(kind)) {
        const lockBtn = el('button', 'build-option locked', this.buildMenu) as HTMLButtonElement
        lockBtn.innerHTML = `${towerArt(def.model)}<span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">${icon('lock')} Trial</span>`
        lockBtn.disabled = true
        lockBtn.title = `${this.game.trial.name}: not on this board`
        continue
      }
      const btn = el('button', 'build-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `${towerArt(def.model)}<span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
      this.bindSpend(kind, btn, () => {
        this.game.previewRange(kind)
        this.showBuildTooltip(def, kind)
      }, () => {
        if (this.armedBuild) return   // keep an armed touch selection visible
        this.game.previewRange(null)
        this.hideBuildTooltip()
      }, () => this.game.buildTower(kind))
      btn.classList.toggle('poor', this.game.gold < def.cost)
      btn.setAttribute('aria-disabled', String(this.game.gold < def.cost))
    }
    // the ground itself is buildable: raise this foundation before or after a tower goes on it
    if (!plot.raised && !plot.water) this.raiseOption(this.buildMenu, plot, 'build-option trap-option')
    const tip = el('div', 'build-tooltip hidden', this.buildMenu)
    tip.id = 'build-tip'
    this.placeMenu(x, y)
  }

  /** clamp the popup menu to the viewport using its real rendered size */
  private placeMenu(x: number, y: number): void {
    this.menuOpenedAt = performance.now()
    this.buildMenu.classList.remove('hidden')
    if (isCoarsePointer()) { this.buildMenu.style.left = ''; this.buildMenu.style.top = ''; this.buildMenu.style.maxHeight = ''; return }
    const pad = 12
    const top = (this.root.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 48) + 8
    this.buildMenu.style.maxHeight = `${Math.max(44, window.innerHeight - top - pad)}px`
    const rect = this.buildMenu.getBoundingClientRect()
    const mw = rect.width || 232, mh = rect.height || 150
    const px = Math.max(pad, Math.min(window.innerWidth - mw - pad, x - mw / 2))
    const py = Math.max(top, Math.min(window.innerHeight - mh - pad, y - mh - 24))
    this.buildMenu.style.left = `${px}px`
    this.buildMenu.style.top = `${py}px`
    this.buildMenu.style.maxHeight = `${Math.max(44, window.innerHeight - py - pad)}px`
  }

  private mults(kind: TowerKind): StatMults {
    return {
      dmg: this.game.towerDamageMult(kind),
      splash: this.game.splashMult(),
      soldierHp: this.game.soldierHpMult(),
    }
  }

  /**
   * Touch has no hover, so a single tap used to spend gold before the player
   * could read a single stat. On coarse pointers the first tap arms the option
   * (showing its stats and range ring) and only the second tap builds.
   * Fine pointers keep one-tap building, since hover already showed them.
   */
  private commitBuild(key: string, btn: HTMLButtonElement, inspect: () => void, build: () => void): void {
    // A hold has already shown this option's stats and put the preview ring on
    // the board, and it swallows the click that follows; a tap means the player
    // has decided. See `tapOrHold`.
    if (this.heldFor === key) { this.heldFor = null; return }
    build()
  }

  /**
   * Bind one option that spends gold: hold to read it, tap to buy it.
   *
   * Every such option has to register BOTH halves. `commitBuild` only knows to
   * swallow the tap that ends a hold if `tapOrHold` set `heldFor` first, and
   * for a long while the build, trap, earthwork and upgrade buttons wired the
   * commit half alone - so on touch, where there is no hover, the only way to
   * see a tower's stats was to buy it and read them afterwards. Going through
   * one helper is what keeps the two halves from drifting apart again.
   */
  private bindSpend(
    key: string,
    btn: HTMLButtonElement,
    inspect: () => void,
    release: () => void,
    build: () => void,
  ): void {
    // fine pointers get hover from `tapOrHold`; coarse ones get press-and-hold
    this.tapOrHold(key, btn, inspect, release)
    btn.onclick = this.menuGuard(() => this.commitBuild(key, btn, inspect, () => {
      const short = Number(btn.dataset.cost ?? 0) - this.game.gold
      if (short > 0) { this.showToast(`Need ${Math.ceil(short).toLocaleString()} more gold`, 2); this.flashGold(); return }
      build()
    }))
  }

  /**
   * Tap acts, hold inspects.
   *
   * Touch has no hover, so every option that wanted to show its stats first was
   * costing two taps to use - three for a targeted ability. Charging the player
   * a tap on every single use to solve a problem they only have once is the
   * wrong trade. Pressing and holding shows the same thing hover did and
   * cancels the tap; a plain tap does the thing.
   */
  private heldFor: string | null = null
  private holdTimer: number | null = null

  private tapOrHold(key: string, btn: HTMLButtonElement, inspect: () => void, release?: () => void): void {
    if (!isCoarsePointer()) {
      btn.onmouseenter = inspect
      btn.onmouseleave = () => release?.()
      return
    }
    const cancel = () => {
      if (this.holdTimer !== null) { clearTimeout(this.holdTimer); this.holdTimer = null }
    }
    btn.addEventListener('pointerdown', () => {
      cancel()
      this.heldFor = null
      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null
        this.heldFor = key
        btn.classList.add('armed')
        inspect()
      }, HOLD_MS)
    })
    const up = () => {
      cancel()
      btn.classList.remove('armed')
      // the preview stays up for a moment after the finger leaves, so a hold
      // that ends is still readable
      if (this.heldFor === key) window.setTimeout(() => {
        if (btn.isConnected && !btn.closest('.hidden')) release?.()
      }, 900)
    }
    btn.addEventListener('pointerup', up)
    btn.addEventListener('pointercancel', up)
    btn.addEventListener('pointerleave', up)
  }

  /**
   * A confirm tap, kept for the three actions that cannot be undone.
   *
   * Selling burns most of a tower's gold, and ascending and overcharging spend
   * shards for good. These were the *only* single-tap actions on touch while
   * building and upgrading each cost two, which is exactly backwards.
   */
  private confirmOnTouch(btn: HTMLButtonElement, label: string, act: () => void, onArm?: () => void, onDisarm?: () => void): void {
    if (!isCoarsePointer()) { btn.onclick = this.menuGuard(act); return }
    const original = btn.innerHTML
    let armed = false
    let name: string | null = null
    const disarm = () => {
      armed = false; btn.innerHTML = original; btn.classList.remove('confirming')
      if (name !== null) btn.setAttribute('aria-label', name)
      onDisarm?.()
    }
    btn.onclick = this.menuGuard(() => {
      if (armed) { disarm(); act(); return }
      armed = true
      // a compact button names itself in aria-label; while it asks, the question is its name
      name = btn.getAttribute('aria-label')
      if (name !== null) btn.setAttribute('aria-label', label)
      btn.innerHTML = `<span class="u-name">${label}</span>`
      btn.classList.add('confirming')
      onArm?.()
      window.setTimeout(() => { if (armed) disarm() }, 2600)
    })
  }

  private clearArmedBuild(): void {
    this.armedBuild = null
    for (const b of this.buildMenu.querySelectorAll('.build-option')) b.classList.remove('armed')
  }

  private showBuildTooltip(def: TowerLevelDef, kind: TowerKind): void {
    const tip = document.getElementById('build-tip')
    if (!tip) return
    // what this ground and these neighbours would buy, before the gold is spent
    const pv = this.game.placementPreview(kind)
    const gains: string[] = []
    for (const r of pv.reactions) gains.push(`${icon('sparkle')} <b>${r.name}</b> with ${r.tower.def.name}: ${r.description}`)
    if (pv.beacon) gains.push(`${icon('flame')} Lit by ${pv.beacon.name}: +${Math.round(pv.beacon.damage * 100)}% damage`)
    if (pv.lights.length) gains.push(`${icon('flame')} Would light ${pv.lights.length} tower${pv.lights.length === 1 ? '' : 's'}`)
    if (pv.reactions.length || pv.beacon || pv.lights.length) gains.unshift('Gold links show these bonuses:')
    if (pv.highGround) gains.push(kind === 'beacon' ? `${icon('quake')} High ground: +15% aura reach` : `${icon('quake')} High ground: +${Math.round(RAMPART_DAMAGE_BONUS * 100)}% damage, +${Math.round(RAMPART_RANGE_BONUS * 100)}% range`)
    tip.innerHTML = `<span class="tip-head"><b>${def.name}</b><span class="tip-cost">${icon('coin')}${def.cost}</span></span>`
      + `<span class="tip-desc">${def.description}</span><span class="tip-stats">${keyStats(def, this.mults(kind))}</span>`
      + (gains.length ? `<span class="tip-gains">${gains.join('<br>')}</span>` : '')
    tip.classList.remove('hidden')
  }

  private hideBuildTooltip(): void {
    document.getElementById('build-tip')?.classList.add('hidden')
  }

  closeBuildMenu(): void {
    this.game.previewRange(null)
    this.clearArmedBuild()
    this.buildMenu.classList.add('hidden')
  }

  closeDisclosure(): boolean {
    const open = this.root.querySelector<HTMLDetailsElement>('.wave-details[open], .sandbox-tools[open]')
    if (!open) return false
    open.open = false
    return true
  }

  /** one option: this ground can take exactly one kind of work */
  openEarthworkMenu(spot: EarthworkSpot, x: number, y: number): void {
    this.armedBuild = null
    this.resetBuildMenu()
    const def = EARTHWORK_DEFS[spot.kind]
    const btn = el('button', 'build-option trap-option', this.buildMenu) as HTMLButtonElement
    btn.dataset.cost = `${def.cost}`
    btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">${def.name}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
    const showTip = () => {
      const tip = document.getElementById('build-tip')
      if (tip) {
        tip.innerHTML = `<span class="tip-head"><b>${def.name}</b><span class="tip-cost">${icon('coin')}${def.cost}</span></span><span class="tip-desc">${def.description}</span>`
        tip.classList.remove('hidden')
      }
    }
    this.bindSpend(
      `earth:${spot.kind}`, btn, showTip,
      () => { if (!this.armedBuild) this.hideBuildTooltip() },
      () => this.game.buildEarthwork(),
    )
    btn.classList.toggle('poor', this.game.gold < def.cost)
    const tip = el('div', 'build-tooltip hidden', this.buildMenu)
    tip.id = 'build-tip'
    this.placeMenu(x, y)
  }

  /** the raise-ground option, shared by the empty-plot menu and the tower panel */
  private raiseOption(parent: HTMLElement, plot: PlotInfo, cls: string): HTMLButtonElement {
    const def = EARTHWORK_DEFS.rampart
    const cost = this.game.nextRaiseCost()
    const btn = el('button', cls, parent) as HTMLButtonElement
    if (plot.raised || this.game.terrain?.isOnHill(...plot.cell)) {
      btn.disabled = true
      btn.title = 'Already elevated: the high-ground bonus is active. Raising adds no range.'
      if (cls.includes('build-option')) btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">High ground<br><small>Bonus already active</small></span>`
      else btn.innerHTML = `${icon(def.icon)}${icon('check')}<span class="sr-only">High ground · Bonus already active; raising adds no range.</span>`
      return btn
    }
    btn.dataset.cost = `${cost}`
    if (cls.includes('build-option')) btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">${def.name}</span><span class="b-cost">${icon('coin')}${cost}</span>`
    else {
      // in the inspector's action row: the build menu's own icon, and the price
      btn.innerHTML = `${icon(def.icon)}${icon('coin')}<span>${cost}</span>`
      btn.setAttribute('aria-label', `${def.name} · ${cost} gold`)
    }
    const description = this.game.towers.find(t => t.plot === plot)?.isBeacon ? 'Raise this Beacon onto high ground to extend its aura by 15%.' : def.description
    btn.title = `${description} Permanent. The next foundation after this costs ${raiseCost(this.game.raisedCount() + 1)} gold.`
    const showTip = () => {
      const tip = document.getElementById('build-tip')
      // A desktop hover must not resize the bottom-anchored inspector: moving
      // the hovered button can alternate enter/leave forever. Its native title
      // supplies the details; touch players can still hold to inspect them.
      if (tip && (isCoarsePointer() || !parent.closest('.tower-panel'))) {
        tip.innerHTML = `<span class="tip-head"><b>${def.name}</b><span class="tip-cost">${icon('coin')}${cost}</span></span><span class="tip-desc">${description}</span><span class="tip-stats">Permanent · the next one costs ${icon('coin')}${raiseCost(this.game.raisedCount() + 1)}</span>`
        tip.classList.remove('hidden')
      }
      this.game.previewRaise(plot)
    }
    this.bindSpend(`raise:${plot.index}`, btn, showTip, () => { if (!this.armedBuild) { this.hideBuildTooltip(); this.game.previewRaise(null) } }, () => this.game.raisePlot(plot))
    btn.classList.toggle('poor', this.game.gold < cost)
    return btn
  }

  /** what an existing earthwork is doing, and what it is doing it to */
  openEarthworkPanel(work: Earthwork): void {
    this.closeTowerPanel()
    this.currentTower = null
    const p = this.towerPanel
    p.innerHTML = ''
    p.classList.remove('hidden')
    this.currentTrap = null
    this.currentHero = null
    this.menuOpenedAt = performance.now()
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, icon(work.def.icon))
    const t = el('div', 'tp-title', head)
    el('div', 'tp-name', t, work.def.name)
    el('div', 'tp-level', t, work.kind === 'rampart' ? 'High ground' : 'Sunken road')
    const close = el('button', 'tp-close', head, icon('close')) as HTMLButtonElement
    close.setAttribute('aria-label', 'Close')
    close.onclick = () => this.game.clearSelection()

    el('div', 'tp-traits', p, work.def.description)
  }

  // ---------------- trap menu & panel ----------------

  openTrapMenu(spot: TrapSpotInfo, x: number, y: number): void {
    this.armedBuild = null
    this.resetBuildMenu()
    for (const kind of ['spike', 'frost', 'blast'] as TrapKind[]) {
      const def = TRAP_DEFS[kind]
      const btn = el('button', 'build-option trap-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">${def.name}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
      const showTrapTip = () => {
        const tip = document.getElementById('build-tip')
        if (tip) {
          tip.innerHTML = `<span class="tip-head"><b>${def.name}</b><span class="tip-cost">${icon('coin')}${def.cost}</span></span><span class="tip-desc">${def.description}</span>`
          tip.classList.remove('hidden')
        }
      }
      this.bindSpend(
        `trap:${kind}`, btn, showTrapTip,
        () => { if (!this.armedBuild) this.hideBuildTooltip() },
        () => this.game.buildTrap(kind),
      )
      btn.classList.toggle('poor', this.game.gold < def.cost)
    }
    const tip = el('div', 'build-tooltip hidden', this.buildMenu)
    tip.id = 'build-tip'
    this.placeMenu(x, y)
  }

  private currentTrap: Trap | null = null

  openTrapPanel(trap: Trap): void {
    this.currentTower = null
    this.currentTrap = trap
    this.currentHero = null
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, icon(trap.def.icon))
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, trap.def.name)
    el('div', 'tp-level', title, `Road trap<span class="tp-kills" title="Enemies slain by this trap, and the health it has taken from them"> · ${icon('skull')} <span class="tp-kill-n">${trap.kills}</span> · ${icon('swords')} <span class="tp-dmg-n">${fmtDamage(trap.damage)}</span></span>`)
    const close = el('button', 'tp-close', head, icon('close')) as HTMLButtonElement
    close.setAttribute('aria-label', 'Close')
    close.onclick = () => this.game.clearSelection()
    el('div', 'tp-stats', p, trap.def.description)
    const actions = el('div', 'tp-actions', p)
    const row = el('div', 'tp-row', actions)
    const sell = el('button', 'btn small sell', row, `Dismantle ${icon('coin')}${Math.round(trap.def.cost * 0.6)}`) as HTMLButtonElement
    this.confirmOnTouch(sell, 'Sell it? Tap again', () => this.game.sellTrap(trap))
    p.classList.remove('hidden')
  }

  // ---------------- tower panel ----------------

  /**
   * The strip compares the tower with one option at a time: the one under the
   * cursor or finger, or, when there is only one way up, that one. The panel
   * used to print a before/after table inside every upgrade card and then the
   * same four numbers again underneath; one row with the change in green says
   * the same thing in a third of the room.
   */
  private statPreview: StatPreview = null

  private setStatPreview(preview: StatPreview): void {
    this.statPreview = preview
    this.refreshStatBlock()
  }

  private refreshStatBlock(): void {
    const tower = this.currentTower
    const block = this.towerPanel.querySelector<HTMLElement>('.tp-combat-stats')
    if (!tower || !block) return
    const html = this.statBlock(tower)
    if (block.dataset.readout !== html) { block.innerHTML = html; block.dataset.readout = html }
  }

  /** every way up the panel offers: tiers unless a trial caps them, and the two ascensions */
  private panelOptions(tower: Tower): { tiers: TowerLevelDef[], perks: PerkDef[], capped: boolean } {
    const capped = !!this.game.trial && tower.level >= this.game.trial.maxTier
    return { capped, tiers: capped ? [] : tower.upgradeOptions, perks: tower.level >= 4 && !tower.perk ? tower.ascensionOptions : [] }
  }

  /** towers standing in a beacon's light */
  private litBy(beacon: Tower): Tower[] {
    return this.game.towers.filter(t => t !== beacon && !t.isBeacon
      && Math.hypot(t.pos.x - beacon.pos.x, t.pos.z - beacon.pos.z) <= beacon.auraReach)
  }

  private statBlock(tower: Tower): string {
    const m = this.mults(tower.kind), def = tower.def
    const { tiers, perks } = this.panelOptions(tower)
    const options = [
      ...tiers.map((t, i) => ({ id: `tier:${i}`, deltas: upgradeDeltas(tower, t, m) })),
      ...perks.map(p => ({ id: `perk:${p.id}`, deltas: perkDeltas(tower, p.id, m) })),
    ]
    const preview = this.statPreview
    const active = preview ? ('tier' in preview ? `tier:${preview.tier}` : `perk:${preview.perk}`) : tiers.length === 1 ? 'tier:0' : null
    const cells: StatCell[] = []
    const notes: string[] = []
    if (def.aura) {
      const a = def.aura
      const pct = (n: number) => `+${Math.round(n * 100)}%`
      cells.push(
        { key: 'Reach', ico: 'range', value: tower.auraReach.toFixed(1) },
        { key: 'Damage', ico: 'sword', value: pct(a.damage + (tower.perk?.id === 'zeal' ? 0.08 : 0)) },
        { key: 'Range', ico: 'range', value: pct(a.range) },
        { key: 'Speed', ico: 'hourglass', value: pct(a.rate) })
      const lit = this.litBy(tower)
      notes.push(lit.length
        ? `${icon('flame')} Lighting <b>${lit.length}</b>: ${lit.map(t => t.def.name).join(', ')}`
        : `${icon('flame')} Lighting nothing yet — build inside the ring`)
    } else if (def.soldier) {
      const s = def.soldier
      const mult = tower.soldierDamageMult
      cells.push(
        { key: 'Squad', ico: 'soldiers', value: `${tower.squadSize}` },
        { key: 'Health', ico: 'heart', value: `${Math.round(s.hp * m.soldierHp)}` },
        { key: 'Damage', ico: 'sword', value: `${Math.round(s.damage[0] * mult)}–${Math.round(s.damage[1] * mult)}` },
        { key: 'Armor', ico: 'shield', value: `${Math.round(s.armor * 100)}%` },
        { key: 'Respawn', ico: 'respawn', value: `${def.respawnTime}s` })
      notes.push(`${tower.squadSize}× ${s.name} · swings every ${fmtSecs(s.attackInterval / (1 + tower.auraRate))}`)
      // the Warcamp throws: its own attack is the reason to build it
      if (def.damage && def.attackInterval) {
        const [lo, hi] = tower.effectiveDamage()!.map(Math.round)
        notes.push(`${icon('feather')} Axes vs air ${lo}–${hi} every ${fmtSecs(tower.effectiveInterval()!)} · reach ${fmtNum(tower.range)}`)
      }
    } else {
      const [lo, hi] = tower.effectiveDamage()!.map(v => Math.round(v * m.dmg)) as [number, number]
      const interval = tower.effectiveInterval()!
      cells.push(
        { key: 'Damage', ico: def.damageType === 'magic' ? 'sparkle' : def.splash ? 'blast' : 'sword', value: `${lo}–${hi}`, lit: tower.damageMult > 1 },
        { key: 'Rate', ico: 'hourglass', value: fmtSecs(interval), lit: tower.rateMult > 1, title: 'Seconds between attacks' },
        { key: 'Range', ico: 'range', value: fmtNum(tower.range), lit: tower.range > def.range },
        { key: 'DPS', ico: 'swords', value: ((lo + hi) / 2 / interval).toFixed(1), lit: tower.damageMult > 1 || tower.rateMult > 1,
          title: tower.isFused ? 'Primary DPS' : def.beamTargets ? 'DPS per target' : 'Damage per second' })
      if (def.beamTargets) cells.push({ key: 'Targets', ico: 'target', value: `${def.beamTargets}` })
      if (def.splash && !tower.isSeraph) cells.push({ key: 'Blast', ico: 'blast', value: fmtNum(def.splash * m.splash, 2), title: 'Blast radius in tiles' })
      // whether it can hit a flyer is the question asked most, so it comes first
      notes.push(def.flying ? `${icon('feather')} Hits flyers` : 'Ground only')
      notes.push(def.damageType === 'magic' ? `${icon('sparkle')} Magic · ignores armor` : def.splash ? `${icon('blast')} Splash` : `${icon('sword')} Physical`)
      if (def.beamTargets) notes.push(`${def.beamTargets} beams, full damage each`)
      if (tower.isSeraph && def.splash) notes.push(`Splash radius ${Math.round(def.splash * m.splash * 100) / 100} tiles`, tower.isFused ? 'Splash damage 40%' : 'Targets: All in area')
    }
    // anything an option would change that the strip does not show yet gets
    // a cell up front, so hovering an option never reflows the panel
    for (const { deltas } of options) for (const [key, v] of Object.entries(deltas)) {
      if (v.from !== v.to && !cells.some(c => c.key === key)) cells.push({ key, ico: STAT_ICONS[key] ?? 'sparkle', value: v.from })
    }
    // every option's figure is laid out in the same spot and only the active
    // one is shown, so each cell is already as wide as its widest change
    const strip = cells.map(c => {
      const nexts = options.map(({ id, deltas }) => {
        const d = deltas[c.key]
        return d && d.from !== d.to ? `<span class="${id === active ? 'on' : ''}${d.better ? '' : ' same'}">→ ${d.to}</span>` : ''
      }).join('')
      const next = options.length ? `<span class="chip-next">${nexts}</span>` : ''
      const title = c.lit ? `${c.title ?? c.key} · boosted, see Details` : c.title
      return `<span class="chip${c.lit ? ' lit' : ''}"${title ? ` title="${title}"` : ''}><span class="chip-label">${icon(c.ico)}${c.key}</span><span class="chip-value">${c.value}</span>${next}</span>`
    }).join('')
    return `<div class="stat-chips${cells.length > 4 ? ' dense' : ''}">${strip}</div><div class="ts-note">${notes.join(' · ')}</div>`
  }

  private refreshMasteryProgress(): void {
    const tower = this.currentTower
    const target = this.towerPanel.querySelector('.tp-mastery-body')
    if (!tower || !target) return
    const game = this.game
    const save = game.hasSharedMythic(tower.kind) && masteryReady(game.save, tower.kind) ? game.save : game.roster
    const earned = (id: string) => save.honors?.includes(`mastery:${tower.kind}:${id}`)
    const stamps = HUNTS.map(h => `<div>${checkMark(!!earned(h.id))} ${h.name}</div>`).join('')
    let status: string
    if (game.isSandbox) status = 'All Mythics available · sandbox earns no mastery.'
    else if (game.hasSharedMythic(tower.kind) && !masteryReady(save, tower.kind)) status = 'Available for this defense · shared by a player who earned mastery.'
    else if (masteryReady(save, tower.kind)) status = 'Unlocked permanently · upgrade from tier five with battle gold.'
    else if (!game.hunt) status = 'Earn stamps in Boss hunts on Normal or Veteran. Campaign battles do not count.'
    else if (game.difficulty === 'casual') status = 'Play this hunt on Normal or Veteran to earn mastery.'
    else if (earned(game.hunt.id)) status = 'This hunt stamp is already earned for this family.'
    else {
      const damage = tower.isBeacon ? tower.supportedDamage : tower.damage
      const ready = tower.level >= 5 && damage >= 4000
      status = `<div>${checkMark(tower.level >= 5)} Tier five · currently ${tower.level}</div>`
        + `<div>${checkMark(damage >= 4000)} ${Math.floor(damage).toLocaleString()} / 4,000 ${tower.isBeacon ? 'supported damage' : 'damage'}</div>`
        + `<progress max="4000" value="${Math.min(4000, damage)}" aria-label="${tower.isBeacon ? 'Supported damage' : 'Damage'} toward mastery"></progress>`
        + `<div>${ready ? 'Ready — win' : 'Then win'} ${game.hunt.name} with this tower still standing.</div>`
    }
    const html = `<div>Level ${Math.min(30, levelForXp(save.xp))} / 30${game.coop ? ' · shared arsenal' : ''}</div>${stamps}<div class="tp-mastery-status">${status}</div>`
    if (target.getAttribute('data-progress') !== html) {
      target.innerHTML = html
      target.setAttribute('data-progress', html)
    }
  }

  /**
   * The inspector, in reading order: what it is, what it does (with what the
   * next step would change, in green), the way up, the four things you can do
   * to it, and everything else folded away under Details.
   */
  openTowerPanel(tower: Tower): void {
    if (this.currentTower !== tower) this.towerPanel.scrollTop = 0
    this.currentTower = tower
    this.currentTrap = null
    this.currentHero = null
    this.statPreview = null
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const def = tower.def
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, `<img src="art/towers/${def.model}.webp" width="384" height="384" alt="" decoding="async">`)
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, def.name)
    const pips = Array.from({ length: 6 }, (_, i) => `<i class="t${i + 1}${i < tower.level ? ' on' : ''}"></i>`).join('')
    const rank = tower.isFused ? 'Fusion' : tower.level === 6 ? 'Mythic' : ''
    el('div', 'tp-level tp-meta', title,
      `<span class="tp-tier" role="img" aria-label="Tier ${tower.level} of 6" title="Tier ${tower.level} of 6">${pips}</span>`
      + (rank ? `<span class="tp-rank">${rank}</span>` : '')
      + `<span class="tp-kills" title="Enemies slain by this building, and the health it has taken from them">${icon('skull')}<span class="tp-kill-n">${tower.kills}</span>${icon('swords')}<span class="tp-dmg-n">${fmtDamage(tower.damage)}</span></span>`)
    const close = el('button', 'tp-close', head, icon('close')) as HTMLButtonElement
    close.setAttribute('aria-label', 'Close')
    close.onclick = () => this.game.clearSelection()

    el('div', 'tp-combat-stats', p)
    this.refreshStatBlock()

    // the special attack's counter, live (refresh() keeps it current)
    this.sigEl = null
    this.lastSigText = ''
    if (tower.signatureReadout(this.game.time)) this.sigEl = el('div', 'tp-signature', p)

    const { tiers, perks, capped } = this.panelOptions(tower)
    const primary = el('div', 'tp-primary', p)
    if (capped) el('div', 'tp-traits', primary, `${icon('lock')} ${this.game.trial!.name}: tier ${this.game.trial!.maxTier} is the ceiling`)
    // Tier four is a fork, and the two greyed options used to read as locked
    // when the only thing between the player and either was gold. Say what
    // the step is, and (below, live) exactly how much gold is missing.
    if (tiers.length > 1) el('div', 'tp-choice', primary, 'Choose a specialization · permanent')
    const ups = el('div', `tp-upgrades${tiers.length > 1 ? ' split' : ''}`, primary)
    const mythicLock = this.game.mythicLock(tower)
    tiers.forEach((opt, i) => {
      const btn = el('button', `btn upgrade${tower.level === 4 ? ' capstone' : ''}`, ups) as HTMLButtonElement
      if (!mythicLock) btn.dataset.cost = `${opt.cost}`
      btn.innerHTML = `<img class="u-model" src="art/towers/${opt.model}.webp" width="384" height="384" alt="" decoding="async">`
        + `<span class="u-name">${opt.name}</span><span class="u-cost">${icon('coin')}${opt.cost}</span>`
        + `<span class="u-desc">${opt.description}</span><span class="u-need"></span>`
      btn.title = opt.description
      // what the upgrade buys, on both pointers: the strip shows the numbers
      // and the board shows the reach - hover for a mouse, hold for a finger
      const preview = () => { this.game.previewUpgradeRange(tower, opt); this.setStatPreview({ tier: i }) }
      const clearPreview = () => { if (!this.armedBuild) this.game.previewUpgradeRange(tower, null); this.setStatPreview(null) }
      this.bindSpend(
        `upgrade:${tower.plot.index}:${i}`, btn, preview, clearPreview,
        () => { this.game.previewUpgradeRange(tower, null); this.game.upgradeTower(tower, i) },
      )
      if (!isCoarsePointer()) { btn.addEventListener('focus', preview); btn.addEventListener('blur', clearPreview) }
      if (mythicLock) {
        btn.disabled = true
        btn.querySelector('.u-need')!.textContent = mythicLock
        return
      }
      btn.disabled = this.game.gold < opt.cost
      if (btn.disabled) btn.querySelector('.u-need')!.textContent = `Needs ${opt.cost - this.game.gold} more gold`
    })
    if (tower.isSeraph && tower.level === 6 && !tower.isGhost) {
      if (tower.isFused) el('div', 'tp-traits', primary, tower.def.description)
      else {
        const fusion = el('button', 'btn upgrade', ups) as HTMLButtonElement
        fusion.innerHTML = '<img class="u-model" src="art/towers/seraphCrimson.webp" width="384" height="384" alt="" decoding="async">'
          + '<span class="u-name">Awaken Crimson Sovereign</span><span class="u-desc">Sacrifice an opposite tier-six Seraph. Choose which tower stays.</span>'
        fusion.title = 'Sacrifice an opposite tier-six Seraph. Choose which tower stays.'
        fusion.onclick = this.menuGuard(() => { void import('./seraphFusion.ts').then(({ showSeraphFusion }) => showSeraphFusion(this.game, tower)) })
      }
    }
    if (!ups.childElementCount) ups.remove()
    // ascension: tier-4+ towers pick one of two shard-bought perks; both cost
    // the same, so the price is said once above them
    if (perks.length) {
      const ascend = el('div', 'tp-ascend', primary)
      el('div', 'tp-choice ascend', ascend, `<span>Ascend</span><span class="tp-price">${icon('gem')}${ASCEND_SHARD_COST} ${icon('coin')}${ASCEND_GOLD_COST}</span><span class="tp-pick">choose one</span>`)
      const list = el('div', 'tp-upgrades split', ascend)
      perks.forEach((perk, i) => {
        const btn = el('button', 'btn upgrade ascend', list) as HTMLButtonElement
        btn.innerHTML = `<span class="u-art">${icon(perk.icon)}</span><span class="u-name"><span class="sr-only">Ascend: </span>${perk.name}</span>`
          + `<span class="u-desc">${perk.description}</span><span class="u-need"></span>`
        btn.title = perk.description
        // a perk that reaches further draws the reach it would buy, the same
        // way a tier upgrade does; the others have nothing spatial to show
        const reach = perk.id === 'hawkeye' || perk.id === 'windlass' && tower.worldBalance >= 16
        const show = () => {
          if (reach) this.game.previewUpgradeRange(tower, { range: perk.id === 'hawkeye' ? tower.def.range + 0.8 : tower.def.range * 1.2 })
          this.setStatPreview({ perk: perk.id })
        }
        const hide = () => { if (reach) this.game.previewUpgradeRange(tower, null); this.setStatPreview(null) }
        if (!isCoarsePointer()) for (const [on, fn] of [['mouseenter', show], ['focus', show], ['mouseleave', hide], ['blur', hide]] as const) btn.addEventListener(on, fn)
        this.confirmOnTouch(btn, `Ascend to ${perk.name}?`, () => this.game.ascendTower(tower, i as 0 | 1), show, hide)
        btn.disabled = this.game.shards < ASCEND_SHARD_COST || this.game.gold < ASCEND_GOLD_COST
      })
    }
    if (!primary.childElementCount) primary.remove()

    // the four things you can do to a standing tower, in one row
    const actions = el('div', 'tp-actions', p)
    const row = el('div', 'tp-row', actions)
    if (tower.isBarracks) {
      const rally = el('button', 'btn small', row, `${icon('flag')}<span>Rally</span>`) as HTMLButtonElement
      rally.setAttribute('aria-label', 'Rally point')
      rally.title = 'Rally point: choose where the squad stands'
      rally.onclick = this.menuGuard(() => this.game.setTargetMode('rally'))
    } else if (!tower.isBeacon) {
      // a beacon aims at nothing, so it has no targeting rule to cycle
      const tgt = el('button', 'btn small target', row) as HTMLButtonElement
      const label = (policy: TargetPolicy) => {
        tgt.innerHTML = `${icon('target')}<span>${POLICY_SHORT[policy]}</span>`
        tgt.setAttribute('aria-label', `Targeting: ${TARGET_POLICY_LABEL[policy]}`)
      }
      label(tower.targetPolicy)
      tgt.title = 'Which enemy this tower shoots: closest to the gate, furthest from it, the toughest, or the weakest'
      tgt.onclick = this.menuGuard(() => {
        const next = this.game.cycleTargetPolicy(tower)
        if (next) label(next)
      })
    }
    if (!tower.isBarracks && !tower.isBeacon) {
      const oc = el('button', 'btn small overcharge', row, `${icon('lightning')}${icon('gem')}<span>${OVERCHARGE_SHARD_COST}</span>`) as HTMLButtonElement
      oc.setAttribute('aria-label', `Overcharge · ${OVERCHARGE_SHARD_COST} shards`)
      oc.title = `Overcharge: +60% attack speed for ${OVERCHARGE_DURATION}s, for ${OVERCHARGE_SHARD_COST} shards`
      oc.id = 'oc-btn'
      this.lastOcHtml = ''
      this.confirmOnTouch(oc, `Spend ${OVERCHARGE_SHARD_COST} shards?`, () => this.game.overchargeTower(tower), undefined, () => { this.lastOcHtml = '' })
      oc.disabled = !tower.canOvercharge(this.game)
    }
    // the ground under a standing tower can be raised too
    const raisable = !tower.plot.raised && !tower.plot.water
    if (raisable) this.raiseOption(row, tower.plot, 'btn small raise')
    const sell = el('button', 'btn small sell', row, `<span>Sell</span>${icon('coin')}<span>${tower.sellValue}</span>`) as HTMLButtonElement
    sell.setAttribute('aria-label', `Sell for ${tower.sellValue} gold`)
    this.confirmOnTouch(sell, `Sell for ${tower.sellValue}?`, () => this.game.sellTower(tower))
    if (raisable) {
      const tip = el('div', 'build-tooltip hidden', actions)
      tip.id = 'build-tip'
    }
    if (tower.canHoldLine) {
      // The engine has a second mode, and it needs room to say which one it is in.
      const lineRow = el('div', 'tp-row', actions)
      const held = !!tower.holdLine
      const lay = el('button', `btn small${held ? ' lit' : ''}`, lineRow,
        `${icon('range')}<span>${held ? 'Re-lay the line' : 'Hold a line'}</span>`) as HTMLButtonElement
      lay.title = 'Lay this engine on a fixed bearing: click the ground, and it fires down that line and nowhere else. Deadly along a straight road, blind to everything off it.'
      lay.onclick = this.menuGuard(() => this.game.setTargetMode('holdline'))
      if (held) {
        const track = el('button', 'btn small', lineRow, `${icon('target')}<span>Track again</span>`) as HTMLButtonElement
        track.title = 'Go back to tracking whatever the targeting rule picks'
        track.onclick = this.menuGuard(() => this.game.clearHoldLine(tower))
      }
    }

    // everything else: the road taken, what modifies it, and Mythic progress
    const details = el('details', 'tp-details tp-mastery', p)
    el('summary', '', details, 'Details & Mythic progress')
    const body = el('div', 'tp-details-body', details)
    if (tower.level >= 2 || tower.perk) {
      const tree = towerTrees[tower.kind]
      const steps: string[] = tree.levels.slice(0, Math.min(tower.level, 3)).map(l => l.name)
      if (tower.level >= 4 && tower.branch !== null) steps.push(`${icon('star')} ${tree.branches[tower.branch].name}`)
      if (tower.level >= 5 && tower.branch !== null) steps.push(`${icon('sparkle')} ${tree.capstones[tower.branch].name}`)
      if (tower.level === 6) steps.push(tower.def.name)
      if (tower.isFused) steps.splice(0, steps.length, `${mythicFor('seraph', 0)!.name} + ${mythicFor('seraph', 1)!.name}`, tower.def.name)
      if (tower.perk) steps.push(`${icon(tower.perk.icon)} ${tower.perk.name}`)
      el('div', 'tp-lineage', body, steps.join(' <span class="dim">→</span> '))
    }
    const traits: string[] = []
    for (const note of tower.modifierNotes()) traits.push(`${icon(def.aura ? 'quake' : 'flame')} ${note}`)
    if (def.aura?.reveal) traits.push(`${icon('eye')} Phasing enemies in the light can be shot`)
    if (def.aura?.bounty) traits.push(`${icon('coin')} Kills in the light pay +${Math.round(def.aura.bounty * 100)}%`)
    if (def.soldier && def.damage && def.attackInterval) traits.push(`${icon('feather')} Shared axe attack · targets visible flyers within the camp’s range. Grounded foes are fought in melee.`)
    if (def.beamTargets) traits.push('Independent beams from the idol; full damage to each target')
    for (const r of REACTIONS) if (tower.has(r.id)) traits.push(`${icon(r.icon)} <b>${r.name}</b> — ${r.description}`)
    if (tower.perk) traits.push(`${icon(tower.perk.icon)} <b>${tower.perk.name}</b> — ${tower.perk.description}`)
    if (tower.plot.raised) traits.push(`${icon('quake')} Standing on raised ground.`)
    if (traits.length) el('div', 'tp-traits', body, traits.join('<br>'))
    el('div', 'tp-sub', body, 'Mythic progress')
    el('div', 'tp-mastery-body', body)
    this.refreshMasteryProgress()

    p.classList.remove('hidden')
  }

  closeTowerPanel(): void {
    this.currentTower = null
    this.currentTrap = null
    this.currentHero = null
    this.towerPanel.classList.add('hidden')
  }

  // ---------------- hero panel ----------------

  private currentHero: Hero | null = null
  private heroPanelLevel = 0
  private heroPanelEls: { hpFill: HTMLElement, hpNum: HTMLElement, xpFill: HTMLElement, xpNum: HTMLElement, cd: HTMLElement, upgrade: HTMLButtonElement | null } | null = null
  private heroPanelCache = { hp: '', xp: '', hpW: -1, xpW: -1 }

  openHeroPanel(hero: Hero): void {
    this.currentTower = null
    this.currentTrap = null
    this.towerPanel.scrollTop = 0
    this.currentHero = hero
    this.heroPanelLevel = hero.level
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, `<img class="tp-portrait" src="art/heroes/${hero.heroDef.id}.webp" alt="">`)
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, hero.heroDef.name)
    el('div', 'tp-level', title, `${hero.heroDef.title} · Level <span class="hp-lvl">${hero.level}</span>/${hero.levelMax}`
      + `<span class="tp-kills" title="Foes slain by the hero, and the health it has taken from them"> · ${icon('skull')} <span class="tp-kill-n">${hero.kills}</span> · ${icon('swords')} <span class="tp-dmg-n">${fmtDamage(hero.damage)}</span></span>`)
    const close = el('button', 'tp-close', head, icon('close')) as HTMLButtonElement
    close.setAttribute('aria-label', 'Close')
    close.onclick = () => this.game.clearSelection()

    const bars = el('div', 'stat-bars', p)
    bars.innerHTML =
      '<div class="stat-bar"><span class="sb-label">HP</span><span class="sb-track"><span class="sb-fill hp"></span></span><span class="sb-num hp-num"></span></div>' +
      '<div class="stat-bar"><span class="sb-label">XP</span><span class="sb-track"><span class="sb-fill xp"></span></span><span class="sb-num xp-num"></span></div>'

    const d = hero.def
    el('div', 'stat-chips', p,
      chip('Damage', `${icon('sword')} ${d.damage[0]}–${d.damage[1]}`) +
      chip('Armor', `${icon('shield')} ${Math.round(d.armor * 100)}%`) +
      chip('Regen', `${icon('heart')} ${d.regen ?? 0}/s`) +
      (hero.ranged
        ? chip('Range', `${icon('range')} ${hero.attackRange.toFixed(1)}`)
        : chip('Guards', `${icon('range')} r ${hero.guardRange}`)))

    el('div', 'tp-traits', p,
      `${icon('sparkle')} <b>${hero.abilityName}</b>${hero.signatureRank > 0 ? ` <span class="hero-rank">rank ${hero.signatureRank}</span>` : ''}`
      + ` — ${hero.abilityBlurb} <span class="ability-cd-num"></span>`)
    if (hero.signatureRank >= 6) el('div', 'tp-traits', p, `<b>Legendary signature</b> · ${hero.legendaryBlurb}`)
    if (hero.signatureRank < hero.rankMax) {
      const cost = heroRankCost(hero.signatureRank), gold = heroRankGold(hero.signatureRank), level = heroRankLevel(hero.signatureRank)
      const up = el('button', 'btn upgrade hero-rank-upgrade', p,
        `<span class="u-name">${icon('sparkle')} ${hero.rankTitle}</span>`
        + `<span class="u-cost">${gold ? `${icon('coin')}${gold.toLocaleString()} · ` : ''}${icon('gem')}${cost}</span>`
        + `<span class="u-desc">${hero.rankDescription}${hero.level < level ? ` <b>Requires hero level ${level}.</b>` : ''}</span>`) as HTMLButtonElement
      up.onclick = this.menuGuard(() => this.game.upgradeHeroSignature())
      up.disabled = hero.level < level || this.game.shards < cost || this.game.gold < gold
      up.classList.toggle('poor', up.disabled)
    }
    el('div', 'tp-lineage', p, hero.ranged
      ? 'Holds her ground where she stands. Select her, then tap the ground to move.'
      : 'Guards the ring around his post. Select him, then tap the ground to move.')
    this.heroPanelEls = {
      hpFill: p.querySelector('.sb-fill.hp') as HTMLElement,
      hpNum: p.querySelector('.hp-num') as HTMLElement,
      xpFill: p.querySelector('.sb-fill.xp') as HTMLElement,
      xpNum: p.querySelector('.xp-num') as HTMLElement,
      cd: p.querySelector('.ability-cd-num') as HTMLElement,
      upgrade: p.querySelector('.hero-rank-upgrade'),
    }
    this.heroPanelCache = { hp: '', xp: '', hpW: -1, xpW: -1 }
    p.classList.remove('hidden')
  }

  /** live hero panel numbers via cached refs; rebuilt wholesale on level-up */
  private refreshHeroPanel(): void {
    const hero = this.currentHero
    const els = this.heroPanelEls
    if (!hero || !els || this.towerPanel.classList.contains('hidden')) return
    if (hero.level !== this.heroPanelLevel) { this.openHeroPanel(hero); return }
    if (els.upgrade) {
      els.upgrade.disabled = hero.level < heroRankLevel(hero.signatureRank) || this.game.shards < heroRankCost(hero.signatureRank) || this.game.gold < heroRankGold(hero.signatureRank)
      els.upgrade.classList.toggle('poor', els.upgrade.disabled)
    }
    const c = this.heroPanelCache
    const hpW = hero.dead ? 0 : Math.round(Math.max(0, hero.hp / hero.maxHp) * 100)
    const hpText = hero.dead ? `back in ${Math.ceil(hero.respawnCountdown)}s` : `${Math.max(0, Math.ceil(hero.hp))}/${hero.maxHp}`
    if (hpW !== c.hpW) { c.hpW = hpW; els.hpFill.style.width = `${hpW}%` }
    if (hpText !== c.hp) { c.hp = hpText; els.hpNum.textContent = hpText }
    const next = hero.xpToNext
    const progress = hero.xpProgress
    const xpW = next === Infinity ? 100 : Math.round(Math.min(100, progress.into / progress.span * 100))
    const xpText = next === Infinity ? 'MAX' : `${Math.ceil(next - hero.xp)} XP to Lv ${hero.level + 1}`
    if (xpW !== c.xpW) { c.xpW = xpW; els.xpFill.style.width = `${xpW}%` }
    if (xpText !== c.xp) { c.xp = xpText; els.xpNum.textContent = xpText }
    const t = hero.abilityCooldown
    const cdText = hero.dead ? '' : t <= 0 ? '· Ready' : `· ${Math.ceil(t)}s`
    if (els.cd.textContent !== cdText) els.cd.textContent = cdText
  }

  // ---------------- enemy tooltip ----------------

  private tipArmorShown = -1

  showEnemyTip(enemy: Enemy, sx: number, sy: number): void {
    if (this.tipEnemy !== enemy) {
      this.tipEnemy = enemy
      this.tipArmorShown = -1
      this.rebuildEnemyTip(enemy)
    }
    this.updateEnemyTip(enemy)
    this.positionEnemyTip(sx, sy)
    this.enemyTip.classList.remove('hidden')
  }

  private rebuildEnemyTip(enemy: Enemy): void {
    const d = enemy.def
    const traits: string[] = []
    if (d.flying) traits.push(`${icon('feather')} flying`)
    // the enemy's own numbers, not the definition's: an affix, a shred or deep
    // endless toughness all move these, and the tip has to show what is true now
    if (enemy.armor > 0.005) traits.push(`${icon('shield')} ${Math.round(enemy.armor * 100)}% armor`)
    if (enemy.magicResistNow > 0.005) traits.push(`${icon('sparkle')} ${Math.round(enemy.magicResistNow * 100)}% magic resist`)
    if (d.regen) traits.push('regenerates')
    if (d.healAura) traits.push('heals allies')
    if (d.spawnOnDeath) traits.push('spawns brood')
    if (d.ranged) traits.push('ranged caster')
    if (d.phasing) traits.push(`${icon('veil')} phases out of reach`)
    if (d.summons) traits.push('sings reinforcements')
    if (enemy.surged) traits.push(`${icon('veil')} Veiltide-empowered`)
    if (d.boss) traits.push(`${icon('crown')} BOSS`)
    this.tipArmorShown = Math.round(enemy.armor * 100)
    const portrait = BOSS_ART.has(d.id) ? `<img class="et-portrait" src="art/bosses/${d.id}.webp" alt="">` : ''
    // an affix renames the thing, because that is what makes it recognisable
    // the next time it appears - and says in one line what to do about it
    const af = enemy.affix
    const title = af ? `${af.name} ${d.name}` : d.name
    this.enemyTip.innerHTML = portrait +
      `<b>${title}</b> ${icon('heart')}<span class="et-hp"></span>` +
      (af ? `<span class="et-affix">${icon(af.icon)} ${af.name} elite</span>` : '') +
      (traits.length ? `<span class="et-traits">${traits.join(' · ')}</span>` : '') +
      (af ? `<span class="et-desc">${af.blurb}</span>` : '') +
      `<span class="et-desc">${d.description}</span>`
  }

  private updateEnemyTip(enemy: Enemy): void {
    if (Math.round(enemy.armor * 100) !== this.tipArmorShown) this.rebuildEnemyTip(enemy)  // armor shred
    const hpEl = this.enemyTip.querySelector('.et-hp') as HTMLElement
    if (hpEl) hpEl.textContent = ` ${Math.max(0, Math.ceil(enemy.hp))}/${enemy.maxHp}`
  }

  private positionEnemyTip(sx: number, sy: number): void {
    this.enemyTip.style.left = `${Math.min(sx + 18, window.innerWidth - 260)}px`
    this.enemyTip.style.top = `${Math.max(60, sy - 20)}px`
  }

  hideEnemyTip(): void {
    if (this.tipEnemy) {
      this.tipEnemy = null
      this.enemyTip.classList.add('hidden')
    }
  }

  // ---------------- transient messaging ----------------

  /**
   * Introduce an enemy the player has not met. The battle is paused behind
   * this, so it is a card to read rather than something to dismiss in a
   * hurry - and it is DOM, so it works the same on a phone as on a desktop.
   */
  showDossier(def: EnemyDef, onClose: () => void): void {
    // A dossier interrupts mid-wave, and it used to open *over* whatever the
    // player already had open: the tower panel stayed visible behind it and
    // floaters kept drawing on top of it. Clear the board furniture first, so
    // the one thing asking to be read is the only thing on screen.
    this.closeTowerPanel()
    this.closeBuildMenu()
    this.hideEnemyTip()
    const overlay = el('div', 'help-overlay dossier-overlay', this.root)
    const card = el('div', 'help-card dossier-card', overlay)
    el('div', 'dossier-eyebrow', card, def.boss ? 'A boss walks the road' : 'Something new is coming')

    const head = el('div', 'dossier-head', card)
    // the newcomer itself, turning on a plinth; a boss shows its portrait
    // until the model is ready, and keeps it if WebGL will not start
    const art = el('div', 'dossier-art', head)
    if (BOSS_ART.has(def.id)) art.style.backgroundImage = `url(art/bosses/${def.id}.webp)`
    let closed = false
    let unmount: (() => void) | null = null
    void import('./pedestal.ts').then(({ mountPedestal }) => {
      if (closed || !art.isConnected) return
      unmount = mountPedestal(art, def)
      if (!art.classList.contains('has-pedestal') && !BOSS_ART.has(def.id)) art.remove()
    }).catch(() => { if (!BOSS_ART.has(def.id)) art.remove() })
    const title = el('div', 'dossier-title', head)
    el('h2', '', title, def.name)
    el('div', 'dossier-blurb', title, def.description)

    const traits = traitsOf(def)
    if (traits.length) {
      const list = el('div', 'dossier-traits', card)
      for (const t of traits) {
        const row = el('div', 'dossier-trait', list)
        el('span', 'dt-label', row, t.label)
        el('span', 'dt-detail', row, t.detail)
      }
    }

    const counter = el('div', 'dossier-counter', card)
    el('span', 'dc-label', counter, 'How to beat it')
    el('span', 'dc-text', counter, counterFor(def))

    const go = el('button', 'btn primary', card, 'Understood') as HTMLButtonElement
    const finish = () => { closed = true; unmount?.(); overlay.remove(); onClose() }
    go.onclick = finish
    bindDialog(overlay, card, finish)
    setTimeout(() => go.focus?.(), 40)
  }

  showBanner(text: string, cls = ''): void {
    this.bannerEl.textContent = text
    this.bannerEl.className = `banner ${cls}`
    // retrigger animation
    void this.bannerEl.offsetWidth
    this.bannerEl.classList.add('pop')
    this.bannerTimer = 2.4
  }

  showToast(text: string, seconds = 4): void {
    this.toastEl.textContent = text
    this.toastEl.classList.remove('hidden')
    this.toastTimer = seconds
  }

  showTargetError(text: string): void {
    const label = this.modeHint.querySelector('.mode-message')
    if (!label) { this.showToast(text, 2); return }
    const original = label.getAttribute('data-prompt') ?? label.textContent ?? ''
    label.setAttribute('data-prompt', original)
    label.textContent = text
    this.modeHint.classList.add('invalid')
    window.setTimeout(() => {
      if (label.isConnected && label.textContent === text) {
        label.textContent = original
        this.modeHint.classList.remove('invalid')
      }
    }, 1800)
  }

  private syncInspectorOverflow(): void {
    const p = this.towerPanel
    p.classList.toggle('scrollable', p.scrollHeight > p.clientHeight + 4)
    p.classList.toggle('at-bottom', p.scrollTop + p.clientHeight >= p.scrollHeight - 4)
  }

  get hasSelection(): boolean {
    return !this.buildMenu.classList.contains('hidden') || !this.towerPanel.classList.contains('hidden') || !this.enemyTip.classList.contains('hidden')
  }

  dismissWaveDetails(): boolean {
    const open = this.waveDetails.open
    this.waveDetails.open = false
    return open
  }

  setTargetMode(mode: TargetMode): void {
    this.dismissWaveDetails()
    this.modeHint.replaceChildren()
    this.modeHint.classList.remove('invalid')
    this.modeHint.classList.toggle('hidden', mode === null)
    if (!mode) return
    this.toastEl.classList.add('hidden'); this.toastTimer = 0
    const verb = isCoarsePointer() ? 'Tap' : 'Click'
    const messages: Record<NonNullable<TargetMode>, string> = {
      meteor: `${verb} to strike with Meteor Storm`,
      reinforce: `${verb} the road to send reinforcements`,
      expand: `${verb} clear ground to place a plot`,
      rally: `${verb} near the road to set the rally point`,
      holdline: `${verb} to aim the firing line`,
    }
    this.hideAbilityTip()
    el('span', 'mode-message', this.modeHint, messages[mode])
    const cancel = el('button', 'mode-cancel', this.modeHint, 'Cancel') as HTMLButtonElement
    cancel.setAttribute('aria-label', 'Cancel targeting')
    cancel.onclick = () => this.game.setTargetMode(null)
  }

  setPaused(paused: boolean): void {
    this.exitArmed = false; this.quitBtn.classList.remove('confirming')
    this.inviteBtn.classList.toggle('hidden', !this.game.coop)
    this.coopSwitchBtn.textContent = this.game.coop ? 'Continue this battle solo' : 'Invite a friend to this battle'
    this.coopSwitchBtn.disabled = !this.game.canSwitchCoop
    this.pauseBtn.innerHTML = icon(paused ? 'play' : 'pause', 'plain')
    this.pauseBtn.setAttribute('aria-label', paused ? 'Resume game' : 'Pause')
    this.pauseOverlay.classList.toggle('hidden', !paused)
    this.pauseDialogFocus?.(paused)
    if (paused && this.game.canSaveSession) {
      this.quitBtn.textContent = 'Save & exit'
      this.bankedEl.textContent = 'Saves this moment on this device, including the current wave. Continue from the main menu after reloading.'
    } else if (paused && this.game.coop) {
      this.quitBtn.textContent = 'Leave room'
      this.bankedEl.textContent = 'Rejoin this room from Co-op on this device while it remains available. Allies can keep playing.'
    } else if (paused) {
      // leaving is not losing when the board is banked; the card says so
      const wave = this.game.bankedWave()
      const authored = this.game.waves?.authoredWaves ?? 0
      const where = wave === null ? '' : wave > authored ? `held +${wave - authored}` : `wave ${wave}`
      this.quitBtn.textContent = wave === null ? 'Abandon mission' : 'Bank and leave'
      this.bankedEl.textContent = wave === null
        ? (this.game.isFreeplay || (this.game.waves?.waveIndex ?? -1) >= 0 ? 'The board banks itself each time the field is clear.' : '')
        : `Banked at ${where} — Resume from the menu picks it up there.`
    }
    const exit = document.getElementById('rotate-exit'), note = document.getElementById('rotate-note')
    if (exit) exit.textContent = this.quitBtn.textContent
    if (note) note.textContent = this.bankedEl.textContent || 'This run has no saved checkpoint.'
  }

  setSpeed(speed: number): void {
    this.speedBtn.textContent = `${speed}×`
    this.speedBtn.classList.toggle('fast', speed > 1)
    this.speedBtn.title = `Game speed: ${speed}× · tap to cycle 1–4× (F)`
  }

  pulseLives(): void {
    this.livesEl.classList.remove('pulse')
    void this.livesEl.offsetWidth
    this.livesEl.classList.add('pulse')
    // red screen-edge flash when the gate is breached
    this.vignette.classList.remove('flash')
    void this.vignette.offsetWidth
    this.vignette.classList.add('flash')
  }

  flashGold(): void {
    this.goldEl.classList.remove('pulse')
    void this.goldEl.offsetWidth
    this.goldEl.classList.add('pulse')
  }

  /**
   * A number that rises off the board and fades.
   *
   * Its life is measured in *simulation* time, not wall-clock. Everything else
   * about a kill - the death animation, the particles, the debris - runs inside
   * the accelerated simulation, so at 2x these were the one thing still taking
   * a full real second: twice as many arrived in the same window and each one
   * outlived the event that caused it, which is what made double speed read as
   * mush rather than as speed.
   */
  /** experience just earned: shown beside the bar, summed over a short burst */
  xpTick(amount: number): void {
    this.xpGainPending += amount
    this.xpGainTimer = 1.6
    const n = this.xpGainPending
    this.xpEl.querySelector('.xp-gain')!.textContent = n >= 1 ? `+${Math.round(n)} xp` : `+${n.toFixed(1)} xp`
    this.xpEl.classList.add('gaining')
  }

  /** floaters on screen right now; the pool bounds retained nodes, not live ones */
  private activeFloaters = 0
  private static readonly FLOATER_CAP = 24

  spawnFloater(x: number, y: number, text: string, cls: string): void {
    // At 2x on a phone a swarm can ask for far more labels than the eye can
    // read. Ordinary damage numbers are the first to go; gold, shards and
    // crits keep their place so the reward and the big hit still register.
    if (this.activeFloaters >= HUD.FLOATER_CAP && cls === 'damage') return
    if (this.activeFloaters >= HUD.FLOATER_CAP + 12) return
    this.activeFloaters++
    let f = this.floaterPool.pop()
    if (!f) {
      f = el('div', 'floater', this.root)
    }
    const life = 1100 / this.game.speed
    f.innerHTML = text
    f.className = `floater ${cls}`
    f.style.left = `${x}px`
    f.style.top = `${y}px`
    f.style.setProperty('--float-life', `${(life - 50) / 1000}s`)
    f.style.display = 'block'
    void f.offsetWidth
    f.classList.add('float-up')
    window.setTimeout(() => {
      this.activeFloaters = Math.max(0, this.activeFloaters - 1)
      f!.style.display = 'none'
      f!.classList.remove('float-up')
      if (this.floaterPool.length < 40) this.floaterPool.push(f!)
    }, life)
  }

  /** show/hide the battle chrome (topbar, abilities, wave button) */
  setChrome(visible: boolean): void {
    this.chromeVisible = visible
    this.root.classList.toggle('chrome-hidden', !visible)
  }

  /** so a Siege Tape can hide the interface and put it back exactly as it was */
  chromeVisible = true

  /** hide everything level-specific (used when returning to menu) */
  reset(): void {
    this.closeBuildMenu()
    this.closeTowerPanel()
    this.hideEnemyTip()
    this.vignette.classList.remove('flash')
    this.bannerEl.classList.add('hidden')
    this.toastEl.classList.add('hidden')
    this.modeHint.classList.add('hidden')
    this.huntStatus?.classList.add('hidden')
    this.pauseOverlay.classList.add('hidden')
    this.waveBtn.classList.add('hidden')
    this.waveDetails.classList.add('hidden'); this.waveDetails.open = false; this.lastWavePreviewHtml = ''
    this.lastGold = this.lastShards = this.lastLives = this.lastXp = this.lastTowerLevel = -1
    this.root.querySelector('.sandbox-tools')?.remove()
    this.lastWaveText = this.lastWaveBtnText = ''
  }
}

interface StatMults { dmg: number, splash: number, soldierHp: number }

/** one stat an option would change: as it stands, as it would be, and whether that is a gain */
type Deltas = Record<string, { from: string, to: string, better: boolean }>
type StatPreview = { tier: number } | { perk: string } | null
interface StatCell { key: string, ico: string, value: string, lit?: boolean, title?: string }

/** icons for stats that only appear in the strip because an option changes them */
const STAT_ICONS: Record<string, string> = {
  Damage: 'sword', Rate: 'hourglass', Range: 'range', DPS: 'swords', Targets: 'target', Blast: 'blast', Air: 'feather',
  Reach: 'range', Speed: 'hourglass', Reveals: 'eye', Bounty: 'coin',
  Squad: 'soldiers', Health: 'heart', Armor: 'shield', Swing: 'hourglass', Respawn: 'respawn',
}

/** the targeting rule on a button a quarter of the panel wide */
const POLICY_SHORT: Record<TargetPolicy, string> = { first: 'First', last: 'Last', strong: 'Strong', weak: 'Weak' }

/** formatting shared by the strip and the deltas */
const fmtNum = (n: number, dp = 1) => Number.isInteger(n) ? `${n}` : n.toFixed(dp)
const fmtSecs = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}s`

/**
 * What a tier upgrade changes, keyed by the strip's own labels. Both sides
 * carry every bonus this plot grants, so a lit tower's upgrade is compared
 * lit-to-lit rather than against a number it never dealt.
 */
function upgradeDeltas(tower: Tower, to: TowerLevelDef, m: StatMults): Deltas {
  const from = tower.def
  const out: Deltas = {}
  const put = (key: string, a: string, b: string, better: boolean) => { out[key] = { from: a, to: b, better } }

  if (to.aura && from.aura) {
    const a = from.aura, b = to.aura
    const pct = (n: number) => `+${Math.round(n * 100)}%`
    put('Reach', fmtNum(tower.rangeFor(from)), fmtNum(tower.rangeFor(to)), to.range > from.range)
    put('Damage', pct(a.damage), pct(b.damage), b.damage > a.damage)
    put('Range', pct(a.range), pct(b.range), b.range > a.range)
    put('Speed', pct(a.rate), pct(b.rate), b.rate > a.rate)
    if (!!a.reveal !== !!b.reveal) put('Reveals', a.reveal ? 'Yes' : 'No', b.reveal ? 'Yes' : 'No', !!b.reveal)
    if ((a.bounty ?? 0) !== (b.bounty ?? 0)) put('Bounty', pct(a.bounty ?? 0), pct(b.bounty ?? 0), (b.bounty ?? 0) > (a.bounty ?? 0))
    return out
  }
  if (to.soldier && from.soldier) {
    const a = from.soldier, b = to.soldier
    const ahp = Math.round(a.hp * m.soldierHp), bhp = Math.round(b.hp * m.soldierHp)
    const acount = from.soldierCount ?? 3, bcount = to.soldierCount ?? 3
    put('Squad', `${acount}`, `${bcount}`, bcount > acount)
    put('Health', `${ahp}`, `${bhp}`, bhp > ahp)
    put('Damage', `${a.damage[0]}–${a.damage[1]}`, `${b.damage[0]}–${b.damage[1]}`, (b.damage[0] + b.damage[1]) > (a.damage[0] + a.damage[1]))
    put('Armor', `${Math.round(a.armor * 100)}%`, `${Math.round(b.armor * 100)}%`, b.armor > a.armor)
    if (a.attackInterval !== b.attackInterval) put('Swing', fmtSecs(a.attackInterval), fmtSecs(b.attackInterval), b.attackInterval < a.attackInterval)
    put('Respawn', `${from.respawnTime ?? 10}s`, `${to.respawnTime ?? 10}s`, (to.respawnTime ?? 10) < (from.respawnTime ?? 10))
    return out
  }
  if (to.damage && to.attackInterval) {
    const fe = tower.effectiveDamage(from) ?? [0, 0]
    const te = tower.effectiveDamage(to)!
    const fi = tower.effectiveInterval(from) ?? tower.effectiveInterval(to)!
    const ti = tower.effectiveInterval(to)!
    const alo = Math.round(fe[0] * m.dmg), ahi = Math.round(fe[1] * m.dmg)
    const blo = Math.round(te[0] * m.dmg), bhi = Math.round(te[1] * m.dmg)
    const adps = (alo + ahi) / 2 / fi, bdps = (blo + bhi) / 2 / ti
    put('Damage', `${alo}–${ahi}`, `${blo}–${bhi}`, (blo + bhi) > (alo + ahi))
    put('Rate', fmtSecs(fi), fmtSecs(ti), ti < fi)
    put('DPS', adps.toFixed(1), bdps.toFixed(1), bdps > adps)
    if (to.beamTargets) put('Targets', `${from.beamTargets ?? 1}`, `${to.beamTargets}`, to.beamTargets > (from.beamTargets ?? 1))
  }
  const ar = tower.rangeFor(from), br = tower.rangeFor(to)
  put('Range', fmtNum(ar), fmtNum(br), br > ar)
  if ((to.splash ?? 0) !== (from.splash ?? 0)) {
    put('Blast', fmtNum((from.splash ?? 0) * m.splash, 2), fmtNum((to.splash ?? 0) * m.splash, 2), (to.splash ?? 0) > (from.splash ?? 0))
  }
  if (!!to.flying !== !!from.flying) put('Air', from.flying ? 'Yes' : 'No', to.flying ? 'Yes' : 'No', !!to.flying)
  return out
}

/**
 * The same comparison for an ascension perk: the tower as it stands, with the
 * perk applied. The two perks that change a rule rather than a number say so
 * in their own description.
 */
function perkDeltas(tower: Tower, perkId: string, m: StatMults): Deltas {
  const def = tower.def
  const out: Deltas = {}
  const put = (key: string, a: string, b: string) => { out[key] = { from: a, to: b, better: true } }
  const pct = (n: number) => `+${Math.round(n * 100)}%`

  if (def.aura) {
    const reach = tower.auraReach
    put('Reach', reach.toFixed(1), (reach + (perkId === 'farsight' ? 0.6 * (tower.onHighGround ? 1 + RAMPART_RANGE_BONUS : 1) : 0)).toFixed(1))
    const dmg = def.aura.damage + (tower.perk?.id === 'zeal' ? 0.08 : 0)
    put('Damage', pct(dmg), pct(dmg + (perkId === 'zeal' ? 0.08 : 0)))
    return out
  }
  if (def.soldier) {
    const sd = def.soldier, mult = tower.soldierDamageMult
    const hp = Math.round(sd.hp * m.soldierHp)
    const hpMult = perkId === 'vanguard' ? 1.25 : 1
    const dmgMult = perkId === 'whetstone' ? 1.25 : 1
    const lo = Math.round(sd.damage[0] * mult), hi = Math.round(sd.damage[1] * mult)
    put('Health', `${hp}`, `${Math.round(hp * hpMult)}`)
    put('Damage', `${lo}–${hi}`, `${Math.round(lo * dmgMult)}–${Math.round(hi * dmgMult)}`)
    return out
  }
  if (def.damage && def.attackInterval) {
    const [lo, hi] = tower.effectiveDamage()!.map(v => Math.round(v * m.dmg)) as [number, number]
    const dmgMult = perkId === 'serrated' || perkId === 'heavybolts' ? 1.2 : 1
    const intMult = perkId === 'windlass' && tower.worldBalance <= 15 ? 0.85 : 1
    const rangeAdd = perkId === 'hawkeye' ? 0.8 : perkId === 'windlass' && tower.worldBalance >= 16 ? tower.range * .2 : 0
    const echo = perkId === 'echo' ? 1.18 : 1
    const blo = Math.round(lo * dmgMult), bhi = Math.round(hi * dmgMult)
    const ai = tower.effectiveInterval()!, bi = ai * intMult
    const adps = (lo + hi) / 2 / ai
    const bdps = (blo + bhi) / 2 / bi * echo
    put('Damage', `${lo}–${hi}`, `${blo}–${bhi}`)
    put('Rate', fmtSecs(ai), fmtSecs(bi))
    put('Range', fmtNum(tower.range), fmtNum(tower.range + rangeAdd))
    put('DPS', adps.toFixed(1), echo > 1 ? `${bdps.toFixed(1)} avg` : bdps.toFixed(1))
    if (def.splash && !tower.isSeraph) {
      const sp = def.splash * m.splash
      put('Blast', fmtNum(sp, 2), fmtNum(sp * (perkId === 'napalm' ? 1.3 : 1), 2))
    }
  }
  return out
}

/** a tower's numbers at a glance, for the build tooltip: figures and a couple of tags */
function keyStats(def: TowerLevelDef, m: StatMults): string {
  const stat = (ico: string, v: string, label: string) => `<span class="tip-stat" title="${label}">${icon(ico)}${v}</span>`
  const tag = (t: string) => `<span class="tip-tag">${t}</span>`
  if (def.aura) {
    const a = def.aura, pct = (n: number) => `+${Math.round(n * 100)}%`
    return [stat('range', fmtNum(def.range), 'Reach'),
      a.damage ? tag(`${pct(a.damage)} damage`) : '', a.range ? tag(`${pct(a.range)} range`) : '', a.rate ? tag(`${pct(a.rate)} speed`) : '',
      a.reveal ? tag('Reveals phasing') : '', a.bounty ? tag(`${pct(a.bounty)} bounty`) : '', tag('Does not attack')].join('')
  }
  if (def.soldier) {
    const s = def.soldier
    return stat('soldiers', `${def.soldierCount ?? 3}×`, 'Squad') + stat('heart', `${Math.round(s.hp * m.soldierHp)}`, 'Health')
      + stat('sword', `${s.damage[0]}–${s.damage[1]}`, 'Damage') + stat('respawn', `${def.respawnTime}s`, 'Respawn')
  }
  const lo = Math.round(def.damage![0] * m.dmg), hi = Math.round(def.damage![1] * m.dmg)
  return stat('swords', `${lo}–${hi}`, 'Damage') + stat('hourglass', fmtSecs(def.attackInterval!), 'Seconds between attacks') + stat('range', fmtNum(def.range), 'Range')
    + (def.damageType === 'magic' ? tag('Magic') : '')
    + (def.splash ? tag(`Splash r${Math.round(def.splash * m.splash * 100) / 100}`) : '')
    + (def.beamTargets ? tag(`${def.beamTargets} beams`) : '')
    + tag(def.flying ? 'Hits flyers' : 'Ground only')
}
