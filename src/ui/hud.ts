import type { Game, TargetMode } from '../game/game.ts'
import type { Hero } from '../game/hero.ts'
import type { Tower } from '../game/towers.ts'
import type { PlotInfo } from '../game/terrain.ts'
import type { Enemy } from '../game/units.ts'
import type { Trap, TrapSpotInfo } from '../game/traps.ts'
import {
  TowerKind, TowerLevelDef, TrapKind, TRAP_DEFS, PERKS,
  OVERCHARGE_SHARD_COST, OVERCHARGE_DURATION, ASCEND_SHARD_COST, ASCEND_GOLD_COST,
} from '../game/types.ts'
import { towerTrees } from '../game/towerDefs.ts'
import { TARGET_POLICY_LABEL, REACTIONS } from '../game/towers.ts'
import { isCoarsePointer } from '../core/utils.ts'
import { isPortalMode } from '../core/platform.ts'
import { EARTHWORK_DEFS, type EarthworkSpot, type Earthwork } from '../game/earthworks.ts'
import { beatIndex, BEATS_PER_BAR } from '../game/beat.ts'
import { traitsOf, counterFor } from '../game/dossier.ts'
import { HERO_RANK_MAX, heroRankCost } from '../game/hero.ts'
import type { EnemyDef, TowerAura } from '../game/types.ts'
import { icon, BOSS_ART } from './icons.ts'
import { isUnlocked, unlockLevel } from '../game/progress.ts'

function chip(label: string, value: string, cls = ''): string {
  return `<span class="chip${cls ? ' ' + cls : ''}"><span class="chip-label">${label}</span><span class="chip-value">${value}</span></span>`
}

const TOWER_ICONS: Record<TowerKind, string> = { arrow: 'bow', mage: 'orb', cannon: 'bomb', barracks: 'helm', beacon: 'flame', ballista: 'target' }
const TOWER_NAMES: Record<TowerKind, string> = { arrow: 'Arrow', mage: 'Mage', cannon: 'Cannon', barracks: 'Barracks', beacon: 'Beacon', ballista: 'Ballista' }

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

  private goldEl!: HTMLElement
  private shardsEl!: HTMLElement
  private livesEl!: HTMLElement
  private waveEl!: HTMLElement
  private speedBtn!: HTMLButtonElement
  private pauseBtn!: HTMLButtonElement
  private sfxBtn!: HTMLButtonElement
  private musicBtn!: HTMLButtonElement
  private waveBtn!: HTMLButtonElement
  private wavePreviewEl!: HTMLElement
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

  constructor(private game: Game) {
    this.root = document.getElementById('hud')!
    // Safari (iPad) exits HTML5 fullscreen when anything keeps keyboard focus
    // ("typing isn't allowed in full screen") — starve that heuristic: no HUD
    // control needs focus, so drop it the instant a tap grants it
    this.root.addEventListener('focusin', (e) => {
      if (document.fullscreenElement && e.target instanceof HTMLElement) e.target.blur()
    })
    this.buildTopBar()
    this.buildWaveButton()
    this.buildAbilities()
    this.buildMenu = el('div', 'build-menu hidden', this.root)
    this.towerPanel = el('div', 'tower-panel hidden', this.root)
    this.enemyTip = el('div', 'enemy-tip hidden', this.root)
    this.vignette = el('div', 'damage-vignette', this.root)
    this.bannerEl = el('div', 'banner hidden', this.root)
    this.toastEl = el('div', 'toast hidden', this.root)
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
    const left = el('div', 'topbar-group', bar)
    this.livesEl = el('div', 'stat lives', left, `${icon('heart')} <b>20</b>`)
    this.goldEl = el('div', 'stat gold', left, `${icon('coin')} <b>0</b>`)
    this.shardsEl = el('div', 'stat shards', left, `${icon('gem')} <b>0</b>`)
    this.shardsEl.title = 'Veilshards — dropped by Shardbacks, elites, and bosses. Spend on tower Overcharge and Ascension.'
    this.waveEl = el('div', 'stat wave', left, `${icon('wave')} <b>0/10</b>`)
    const right = el('div', 'topbar-group', bar)
    this.speedBtn = el('button', 'icon-btn', right, '1×') as HTMLButtonElement
    this.speedBtn.title = 'Game speed (F)'
    this.speedBtn.setAttribute('aria-label', 'Game speed')
    this.speedBtn.onclick = () => this.game.toggleSpeed()
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
    const wrap = el('div', 'wave-call-wrap', this.root)
    this.waveBtn = el('button', 'wave-call hidden', wrap) as HTMLButtonElement
    this.waveBtn.onclick = () => this.game.callWave()
    // The roster used to be hover-only, which made it unreachable on touch:
    // a tap on this button calls the wave, so there is no hover to gate on.
    // It is now always on screen while a wave is pending, for every pointer.
    this.wavePreviewEl = el('div', 'wave-preview hidden', wrap)
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

  private buildAbilities(): void {
    const bar = el('div', 'abilities', this.root)
    this.heroBtn = el('button', 'ability hero-btn', bar) as HTMLButtonElement
    this.heroBtn.innerHTML =
      `<span class="ability-icon"><img class="hero-face" src="art/hero-aldric.webp" alt=""></span><span class="cd-sweep"></span>` +
      '<span class="hero-level">1</span><span class="hero-hp"><span class="hero-hp-fill"></span></span>'
    this.heroBtn.title = 'Sir Aldric — select the hero, click the ground to move him. Hotkey H.'
    this.heroBtn.setAttribute('aria-label', 'Select your hero')
    this.heroBtn.onclick = () => this.game.selectHero(true)
    const mk = (key: 'meteor' | 'reinforce', ico: string, name: string, hotkey: string, desc: string) => {
      const btn = el('button', 'ability', bar) as HTMLButtonElement
      btn.innerHTML = `<span class="ability-icon">${icon(ico)}</span><span class="cd-sweep"></span><span class="hotkey">${hotkey}</span>`
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
        if (on) this.hideAbilityTip(); else this.showAbilityTip(name, desc)
      }
      this.abilityBtns[key] = btn
    }
    mk('meteor', 'meteor', 'Meteor Storm', '1', 'Rain three meteors on a target area (true damage + stun). Hotkey 1.')
    mk('reinforce', 'shield', 'Reinforcements', '2', 'Summon two militia anywhere on the road for 14s. Hotkey 2.')
    // the hero's signature used to fire itself; it is the player's to spend now
    this.signatureBtn = el('button', 'ability', bar) as HTMLButtonElement
    this.signatureBtn.innerHTML =
      `<span class="ability-icon">${icon('quake')}</span><span class="cd-sweep"></span><span class="hotkey">3</span>`
    this.signatureBtn.setAttribute('aria-label', 'Hero signature ability')
    // the signature lands on the hero, so there is nowhere to aim and nothing
    // to confirm: one tap casts it
    this.tapOrHold('ability:signature', this.signatureBtn, () => {
      const h = this.game.hero
      if (h) this.showAbilityTip(h.heroDef.ability.name, h.heroDef.ability.blurb)
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
    const card = el('div', 'pause-card', this.pauseOverlay)
    el('h2', '', card, 'Paused')
    const resume = el('button', 'btn primary', card, 'Resume') as HTMLButtonElement
    resume.onclick = () => this.game.togglePause()

    const settings = el('div', 'pause-settings', card)
    const sfxIcon = () => icon(this.game.save.sfxMuted ? 'soundOff' : 'soundOn', 'plain')
    this.sfxBtn = el('button', 'icon-btn', settings, sfxIcon()) as HTMLButtonElement
    this.sfxBtn.title = 'Sound effects'
    this.sfxBtn.setAttribute('aria-label', 'Toggle sound effects')
    this.sfxBtn.onclick = () => { this.game.toggleSfx(); this.sfxBtn.innerHTML = sfxIcon() }
    this.musicBtn = el('button', 'icon-btn', settings, icon(this.game.save.musicMuted ? 'musicOff' : 'music', 'plain')) as HTMLButtonElement
    this.musicBtn.title = 'Music'
    this.musicBtn.setAttribute('aria-label', 'Toggle music')
    this.musicBtn.classList.toggle('muted', this.game.save.musicMuted)
    this.musicBtn.onclick = () => {
      this.game.toggleMusic()
      this.musicBtn.innerHTML = icon(this.game.save.musicMuted ? 'musicOff' : 'music', 'plain')
      this.musicBtn.classList.toggle('muted', this.game.save.musicMuted)
    }
    const doc = document as Document & { webkitFullscreenEnabled?: boolean }
    if ((doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && !isPortalMode()) {
      const fs = el('button', 'icon-btn', settings, icon('fullscreen', 'plain')) as HTMLButtonElement
      fs.title = 'Fullscreen'
      fs.setAttribute('aria-label', 'Toggle fullscreen')
      fs.onclick = () => this.onFullscreen()
    }

    const quit = el('button', 'btn', card, 'Abandon mission') as HTMLButtonElement
    quit.onclick = () => { this.game.togglePause(); this.onHome() }
  }

  // ---------------- per-frame refresh ----------------

  refresh(game: Game): void {
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.lastRefreshAt) / 1000)
    this.lastRefreshAt = now
    if (game.phase === 'idle') return
    if (game.gold !== this.lastGold) {
      this.lastGold = game.gold
      this.goldEl.querySelector('b')!.textContent = `${game.gold}`
    }
    if (game.shards !== this.lastShards) {
      this.lastShards = game.shards
      this.shardsEl.querySelector('b')!.textContent = `${game.shards}`
    }
    if (game.lives !== this.lastLives) {
      this.lastLives = game.lives
      this.livesEl.querySelector('b')!.textContent = `${game.lives}`
    }
    const w = game.waves
    if (w) {
      const waveText = game.isEndless
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
      if (game.phase === 'playing' && w.phase === 'countdown' && !w.isLastWaveStarted) {
        const bonus = w.earlyCallBonus()
        const secs = Math.ceil(w.countdown)
        const surgeWarn = w.nextWaveIsSurge() ? ` · ${icon('moon')} Veiltide!` : ''
        btnText = w.waveIndex < 0
          ? `${icon('swords')} Begin the assault <span class="call-sub">${secs}s · +${bonus}${icon('coin')} if called now${surgeWarn}</span>`
          : `${icon('swords')} Call wave ${w.waveIndex + 2} <span class="call-sub">${secs}s · +${bonus}${icon('coin')} early bonus${surgeWarn}</span>`
      }
      if (btnText !== this.lastWaveBtnText) {
        this.lastWaveBtnText = btnText
        if (btnText) {
          this.waveBtn.innerHTML = btnText
          this.waveBtn.classList.remove('hidden')
        } else {
          this.waveBtn.classList.add('hidden')
          this.wavePreviewEl.classList.add('hidden')
          this.lastWavePreviewHtml = ''
        }
      }
      // the roster rides with the button, so it is never hover-gated
      if (btnText) {
        const html = this.wavePreviewHtml()
        if (html !== this.lastWavePreviewHtml) {
          this.lastWavePreviewHtml = html
          this.wavePreviewEl.innerHTML = html
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
        if (heroIco) heroIco.innerHTML = `<img class="hero-face" src="art/hero-${hero.heroDef.id}.webp" alt="">`
        this.heroBtn.title = `${hero.heroDef.name} ${hero.heroDef.title} — select, then click the ground to move. ${hero.heroDef.ability.name}: ${hero.heroDef.ability.blurb} Hotkey H.`
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
        this.signatureBtn.title = `${h.heroDef.ability.name} — ${h.heroDef.ability.blurb} Hotkey 3.`
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
    }
    // tower panel gold/shard-dependent button states
    if (this.currentTower && !this.towerPanel.classList.contains('hidden')) {
      this.towerPanel.querySelectorAll<HTMLButtonElement>('button[data-cost]').forEach(b => {
        b.disabled = game.gold < Number(b.dataset.cost)
      })
      this.towerPanel.querySelectorAll<HTMLButtonElement>('button.ascend').forEach(b => {
        b.disabled = game.shards < ASCEND_SHARD_COST || game.gold < ASCEND_GOLD_COST
      })
      const oc = document.getElementById('oc-btn') as HTMLButtonElement | null
      if (oc) {
        const t = this.currentTower
        oc.disabled = !t.canOvercharge(game)
        const cdLeft = Math.max(0, t.overchargeCdUntil - game.time)
        const html = icon('lightning') + (t.isOvercharged(game)
          ? ` Overcharged! ${Math.ceil(t.overchargeUntil - game.time)}s`
          : cdLeft > 0 ? ` Recharging ${Math.ceil(cdLeft)}s` : ` Overcharge ${icon('gem')}${OVERCHARGE_SHARD_COST}`)
        if (html !== this.lastOcHtml) {
          this.lastOcHtml = html
          oc.innerHTML = html
        }
      }
    }
    if (!this.buildMenu.classList.contains('hidden')) {
      this.buildMenu.querySelectorAll<HTMLButtonElement>('button[data-cost]').forEach(b => {
        b.classList.toggle('poor', game.gold < Number(b.dataset.cost))
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

  openBuildMenu(plot: PlotInfo, x: number, y: number): void {
    this.armedBuild = null
    this.buildMenu.innerHTML = ''
    const kinds: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon']
    for (const kind of kinds) {
      const def = towerTrees[kind].levels[0]
      // a tower the account has not reached stays on the menu, greyed and
      // labelled with its level, so the player knows the roster is bigger
      // than what they can build today and what it takes to grow it
      if (!isUnlocked(this.game.save, 'tower', kind)) {
        const lockBtn = el('button', 'build-option locked', this.buildMenu) as HTMLButtonElement
        lockBtn.innerHTML = `<span class="b-icon">${icon('lock')}</span><span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">Lv ${unlockLevel('tower', kind)}</span>`
        lockBtn.disabled = true
        lockBtn.title = `${TOWER_NAMES[kind]} unlocks at account level ${unlockLevel('tower', kind)}`
        continue
      }
      const btn = el('button', 'build-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `<span class="b-icon">${icon(TOWER_ICONS[kind])}</span><span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
      this.bindSpend(kind, btn, () => {
        this.game.previewRange(kind)
        this.showBuildTooltip(def, kind)
      }, () => {
        if (this.armedBuild) return   // keep an armed touch selection visible
        this.game.previewRange(null)
        this.hideBuildTooltip()
      }, () => this.game.buildTower(kind))
      btn.classList.toggle('poor', this.game.gold < def.cost)
    }
    const tip = el('div', 'build-tooltip hidden', this.buildMenu)
    tip.id = 'build-tip'
    this.placeMenu(x, y)
  }

  /** clamp the popup menu to the viewport using its real rendered size */
  private placeMenu(x: number, y: number): void {
    this.menuOpenedAt = performance.now()
    this.buildMenu.classList.remove('hidden')
    const rect = this.buildMenu.getBoundingClientRect()
    const mw = rect.width || 232, mh = rect.height || 150
    const pad = 12
    const px = Math.max(pad, Math.min(window.innerWidth - mw - pad, x - mw / 2))
    const py = Math.max(56, Math.min(window.innerHeight - mh - pad, y - mh - 24))
    this.buildMenu.style.left = `${px}px`
    this.buildMenu.style.top = `${py}px`
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
    btn.onclick = this.menuGuard(() => this.commitBuild(key, btn, inspect, build))
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
      if (this.heldFor === key) window.setTimeout(() => release?.(), 900)
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
  private confirmOnTouch(btn: HTMLButtonElement, label: string, act: () => void): void {
    if (!isCoarsePointer()) { btn.onclick = this.menuGuard(act); return }
    const original = btn.innerHTML
    let armed = false
    const disarm = () => { armed = false; btn.innerHTML = original; btn.classList.remove('confirming') }
    btn.onclick = this.menuGuard(() => {
      if (armed) { disarm(); act(); return }
      armed = true
      btn.innerHTML = `<span class="u-name">${label}</span>`
      btn.classList.add('confirming')
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
    tip.innerHTML = `<b>${def.name}</b><br>${def.description}<br><span class="tip-stats">${statLine(def, this.mults(kind))}</span>`
    tip.classList.remove('hidden')
  }

  private hideBuildTooltip(): void {
    document.getElementById('build-tip')?.classList.add('hidden')
  }

  closeBuildMenu(): void {
    this.clearArmedBuild()
    this.buildMenu.classList.add('hidden')
  }

  /** one option: this ground can take exactly one kind of work */
  openEarthworkMenu(spot: EarthworkSpot, x: number, y: number, lifts: string[] = []): void {
    this.armedBuild = null
    this.buildMenu.innerHTML = ''
    const def = EARTHWORK_DEFS[spot.kind]
    const btn = el('button', 'build-option trap-option', this.buildMenu) as HTMLButtonElement
    btn.dataset.cost = `${def.cost}`
    btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">${def.name}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
    // the concrete answer, not the general rule: which towers, by name, this
    // particular bank of earth would lift - or a plain warning that it lifts
    // none yet, so nobody pays 70 gold for a hill that helps nothing
    const effect = spot.kind !== 'rampart' ? ''
      : lifts.length
        ? `<br><span class="tip-stats">${icon('range')} Would lift: <b>${lifts.join(', ')}</b></span>`
        : `<br><span class="tip-stats tip-warn">${icon('range')} Lifts nothing yet. Build a tower inside the ring first, or pick a site nearer your towers.</span>`
    const showTip = () => {
      const tip = document.getElementById('build-tip')
      if (tip) {
        tip.innerHTML = `<b>${def.name}</b><br>${def.description}${effect}`
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

  /** what an existing earthwork is doing, and what it is doing it to */
  openEarthworkPanel(work: Earthwork, lifted: string[]): void {
    const towersHelped = lifted.length
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
    const close = el('button', 'tp-close', head, '✕') as HTMLButtonElement
    close.setAttribute('aria-label', 'Close')
    close.onclick = () => this.game.clearSelection()

    el('div', 'tp-traits', p, work.def.description)
    if (work.kind === 'rampart') {
      el('div', 'tp-traits', p, towersHelped > 0
        ? `${icon('range')} Lifting <b>${towersHelped}</b> tower${towersHelped === 1 ? '' : 's'}: <b>${lifted.join(', ')}</b>. Each gains +15% range and +10% damage; they are ringed in gold on the board.`
        : `${icon('range')} No tower is close enough to use it yet — build inside the ring.`)
    }
  }

  // ---------------- trap menu & panel ----------------

  openTrapMenu(spot: TrapSpotInfo, x: number, y: number): void {
    this.armedBuild = null
    this.buildMenu.innerHTML = ''
    for (const kind of ['spike', 'frost', 'blast'] as TrapKind[]) {
      const def = TRAP_DEFS[kind]
      const btn = el('button', 'build-option trap-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">${def.name}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
      const showTrapTip = () => {
        const tip = document.getElementById('build-tip')
        if (tip) {
          tip.innerHTML = `<b>${def.name}</b><br>${def.description}`
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
    el('div', 'tp-level', title, `Road trap<span class="tp-kills" title="Enemies slain by this trap"> · ${icon('skull')} <span class="tp-kill-n">${trap.kills}</span></span>`)
    const close = el('button', 'tp-close', head, '✕') as HTMLButtonElement
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

  openTowerPanel(tower: Tower): void {
    this.currentTower = tower
    this.currentTrap = null
    this.currentHero = null
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, icon(TOWER_ICONS[tower.kind]))
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, tower.def.name)
    el('div', 'tp-level', title, (tower.level === 5 ? '✦ ' : tower.level === 4 ? '★ ' : '')
      + `Tier ${tower.level}/5`
      + `<span class="tp-kills" title="Enemies slain by this building"> · ${icon('skull')} <span class="tp-kill-n">${tower.kills}</span></span>`)
    const close = el('button', 'tp-close', head, '✕') as HTMLButtonElement
    close.setAttribute('aria-label', 'Close')
    close.onclick = () => this.game.clearSelection()

    // labeled stat chips read faster than an inline icon run
    const m = this.mults(tower.kind)
    const def = tower.def
    if (def.aura) {
      const a = def.aura
      el('div', 'stat-chips', p,
        chip('Reach', `${icon('range')} ${tower.auraReach.toFixed(1)}`) +
        chip('Damage', `${icon('sword')} +${Math.round((a.damage + (tower.perk?.id === 'zeal' ? 0.08 : 0)) * 100)}%`) +
        chip('Range', `${icon('range')} +${Math.round(a.range * 100)}%`) +
        chip('Speed', `${icon('hourglass')} +${Math.round(a.rate * 100)}%`))
      const lit = this.game.towers.filter(t => t !== tower && !t.isBeacon
        && Math.hypot(t.pos.x - tower.pos.x, t.pos.z - tower.pos.z) <= tower.auraReach)
      const traits = [
        lit.length ? `${icon('flame')} lighting <b>${lit.length}</b>: ${lit.map(t => t.def.name).join(', ')}` : `${icon('flame')} lighting nothing yet — build inside the ring`,
      ]
      if (a.reveal) traits.push(`${icon('eye')} phasing enemies in the light can be shot`)
      if (a.bounty) traits.push(`${icon('coin')} kills in the light pay +${Math.round(a.bounty * 100)}%`)
      el('div', 'tp-traits', p, traits.join('<br>'))
    } else if (def.soldier) {
      const s = def.soldier
      el('div', 'stat-chips', p,
        chip('Squad', `${icon('soldiers')} ${def.soldierCount ?? 3}× ${s.name}`, 'wide') +
        chip('Health', `${icon('heart')} ${Math.round(s.hp * m.soldierHp)}`) +
        chip('Damage', `${icon('sword')} ${s.damage[0]}–${s.damage[1]}`) +
        chip('Armor', `${icon('shield')} ${Math.round(s.armor * 100)}%`) +
        chip('Respawn', `${icon('respawn')} ${def.respawnTime}s`))
    } else {
      // the numbers this tower fights with, not the ones in its definition
      const [lo, hi] = tower.effectiveDamage()!.map(v => Math.round(v * m.dmg)) as [number, number]
      const interval = tower.effectiveInterval()!
      const typeIco = def.damageType === 'magic' ? 'sparkle' : def.splash ? 'blast' : 'sword'
      const boosted = tower.damageMult !== 1 || tower.rateMult !== 1 || tower.range !== def.range
      el('div', 'stat-chips', p,
        chip('Damage', `${icon(typeIco)} ${lo}–${hi}`, tower.damageMult > 1 ? 'lit' : '') +
        chip('Rate', `${icon('hourglass')} ${fmtSecs(interval)}`, tower.rateMult > 1 ? 'lit' : '') +
        chip('Range', `${icon('range')} ${fmtNum(tower.range)}`, tower.range > def.range ? 'lit' : '') +
        chip('DPS', `${icon('swords')} ${((lo + hi) / 2 / interval).toFixed(1)}`, boosted ? 'lit' : ''))
      const traits: string[] = []
      for (const note of tower.modifierNotes()) traits.push(`${icon('flame')} ${note}`)
      if (def.splash) traits.push(`${icon('blast')} blast r${Math.round(def.splash * m.splash * 100) / 100}`)
      if (def.damageType === 'magic') traits.push(`${icon('sparkle')} ignores armor`)
      traits.push(def.flying ? `${icon('feather')} hits flyers` : 'no flyers')
      el('div', 'tp-traits', p, traits.join(' · '))
    }

    // the road this tower has taken: tiers, branch, perk, capstone
    if (tower.level >= 2 || tower.perk) {
      const tree = towerTrees[tower.kind]
      const steps: string[] = tree.levels.slice(0, Math.min(tower.level, 3)).map(l => l.name)
      if (tower.level >= 4 && tower.branch !== null) steps.push(`★ ${tree.branches[tower.branch].name}`)
      if (tower.level >= 5 && tower.branch !== null) steps.push(`✦ ${tree.capstones[tower.branch].name}`)
      if (tower.perk) steps.push(`${icon(tower.perk.icon)} ${tower.perk.name}`)
      el('div', 'tp-lineage', p, steps.join(' <span class="dim">→</span> '))
    }

    const extras: string[] = []
    for (const r of REACTIONS) {
      if (tower.has(r.id)) extras.push(`${icon(r.icon)} <b>${r.name}</b> — ${r.description}`)
    }
    if (tower.perk) extras.push(`${icon(tower.perk.icon)} ${tower.perk.name} — ${tower.perk.description}`)
    if (extras.length) el('div', 'tp-traits', p, extras.join('<br>'))

    const actions = el('div', 'tp-actions', p)
    tower.upgradeOptions.forEach((opt, i) => {
      const btn = el('button', `btn upgrade${tower.level === 4 ? ' capstone' : ''}`, actions) as HTMLButtonElement
      btn.dataset.cost = `${opt.cost}`
      btn.innerHTML = `<span class="u-name">${tower.level === 4 ? '✦ ' : tower.level === 3 ? '★ ' : '⬆ '}${opt.name}</span><span class="u-cost">${icon('coin')}${opt.cost}</span><span class="u-desc">${opt.description}</span>` +
        `<span class="u-delta">${deltaLines(tower, opt, m)}</span>`
      // show what the upgrade actually buys in range terms, on both pointers:
      // hover for a mouse, and the first tap for touch (which arms before it
      // commits, so the preview is visible before any gold is spent)
      const preview = () => this.game.previewUpgradeRange(tower, opt)
      const clearPreview = () => { if (!this.armedBuild) this.game.previewUpgradeRange(tower, null) }
      this.bindSpend(
        `upgrade:${tower.plot.index}:${i}`, btn, preview, clearPreview,
        () => { this.game.previewUpgradeRange(tower, null); this.game.upgradeTower(tower, i) },
      )
      btn.disabled = this.game.gold < opt.cost
    })
    // ascension: tier-4+ towers pick one of two shard-bought perks
    if (tower.level >= 4 && !tower.perk) {
      PERKS[tower.kind].forEach((perk, i) => {
        const btn = el('button', 'btn upgrade ascend', actions) as HTMLButtonElement
        btn.innerHTML = `<span class="u-name">${icon(perk.icon)} Ascend: ${perk.name}</span><span class="u-cost">${icon('gem')}${ASCEND_SHARD_COST} ${icon('coin')}${ASCEND_GOLD_COST}</span><span class="u-desc">${perk.description}</span>` +
          `<span class="u-delta">${perkDeltaLines(tower, perk.id, m)}</span>`
        // a perk that reaches further draws the reach it would buy, the same
        // way a tier upgrade does; the others have nothing spatial to show
        if (perk.id === 'hawkeye') {
          btn.onmouseenter = () => this.game.previewUpgradeRange(tower, { range: tower.def.range + 0.8 })
          btn.onmouseleave = () => this.game.previewUpgradeRange(tower, null)
        }
        this.confirmOnTouch(btn, `Ascend to ${perk.name}? Tap again`, () => this.game.ascendTower(tower, i as 0 | 1))
        btn.disabled = this.game.shards < ASCEND_SHARD_COST || this.game.gold < ASCEND_GOLD_COST
      })
    }
    const row = el('div', 'tp-row', actions)
    if (!tower.isBarracks && !tower.isBeacon) {
      const oc = el('button', 'btn small overcharge', row, `${icon('lightning')} Overcharge ${icon('gem')}${OVERCHARGE_SHARD_COST}`) as HTMLButtonElement
      oc.title = `+60% attack speed for ${OVERCHARGE_DURATION}s`
      oc.id = 'oc-btn'
      this.lastOcHtml = ''
      this.confirmOnTouch(oc, 'Spend a shard? Tap again', () => this.game.overchargeTower(tower))
      oc.disabled = !tower.canOvercharge(this.game)
    }
    if (tower.isBarracks) {
      const rally = el('button', 'btn small', row, `${icon('flag')} Rally point`) as HTMLButtonElement
      rally.onclick = this.menuGuard(() => this.game.setTargetMode('rally'))
    } else if (!tower.isBeacon) {
      // a beacon aims at nothing, so it has no targeting rule to cycle
      const tgt = el('button', 'btn small', row,
        `${icon('target')} ${TARGET_POLICY_LABEL[tower.targetPolicy]}`) as HTMLButtonElement
      tgt.title = 'Which enemy this tower shoots: closest to the gate, furthest from it, the toughest, or the weakest'
      tgt.onclick = this.menuGuard(() => {
        const next = tower.cycleTargetPolicy()
        tgt.innerHTML = `${icon('target')} ${TARGET_POLICY_LABEL[next]}`
      })
    }
    const sell = el('button', 'btn small sell', row, `Sell ${icon('coin')}${tower.sellValue}`) as HTMLButtonElement
    this.confirmOnTouch(sell, `Sell for ${tower.sellValue}? Tap again`, () => this.game.sellTower(tower))

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
  private heroPanelEls: { hpFill: HTMLElement, hpNum: HTMLElement, xpFill: HTMLElement, xpNum: HTMLElement, cd: HTMLElement } | null = null
  private heroPanelCache = { hp: '', xp: '', hpW: -1, xpW: -1 }

  openHeroPanel(hero: Hero): void {
    this.currentTower = null
    this.currentTrap = null
    this.currentHero = hero
    this.heroPanelLevel = hero.level
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, `<img class="tp-portrait" src="art/hero-${hero.heroDef.id}.webp" alt="">`)
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, hero.heroDef.name)
    el('div', 'tp-level', title, `${hero.heroDef.title} · Level <span class="hp-lvl">${hero.level}</span>`
      + `<span class="tp-kills" title="Foes slain by the hero"> · ${icon('skull')} <span class="tp-kill-n">${hero.kills}</span></span>`)
    const close = el('button', 'tp-close', head, '✕') as HTMLButtonElement
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
        ? chip('Range', `${icon('range')} ${hero.heroDef.attackRange}`)
        : chip('Guards', `${icon('range')} r ${hero.guardRange}`)))

    el('div', 'tp-traits', p,
      `✦ <b>${hero.heroDef.ability.name}</b>${hero.signatureRank > 0 ? ` <span class="hero-rank">rank ${hero.signatureRank}</span>` : ''}`
      + ` — ${hero.heroDef.ability.blurb} <span class="ability-cd-num"></span>`)
    if (hero.signatureRank < HERO_RANK_MAX) {
      const cost = heroRankCost(hero.signatureRank)
      const up = el('button', 'btn upgrade', p,
        `<span class="u-name">✦ Sharpen ${hero.heroDef.ability.name}</span>`
        + `<span class="u-cost">${icon('gem')}${cost}</span>`
        + `<span class="u-desc">Rank ${hero.signatureRank + 1}: +28% effect, +18% reach, 12% faster recharge.</span>`) as HTMLButtonElement
      up.onclick = this.menuGuard(() => this.game.upgradeHeroSignature())
      up.classList.toggle('poor', this.game.shards < cost)
    }
    el('div', 'tp-lineage', p, hero.ranged
      ? 'Holds her ground where she stands. Click the ground to reposition her.'
      : 'Fights whatever enters the ring around his post. Click the ground to move the post.')
    this.heroPanelEls = {
      hpFill: p.querySelector('.sb-fill.hp') as HTMLElement,
      hpNum: p.querySelector('.hp-num') as HTMLElement,
      xpFill: p.querySelector('.sb-fill.xp') as HTMLElement,
      xpNum: p.querySelector('.xp-num') as HTMLElement,
      cd: p.querySelector('.ability-cd-num') as HTMLElement,
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
    const c = this.heroPanelCache
    const hpW = hero.dead ? 0 : Math.round(Math.max(0, hero.hp / hero.maxHp) * 100)
    const hpText = hero.dead ? `back in ${Math.ceil(hero.respawnCountdown)}s` : `${Math.max(0, Math.ceil(hero.hp))}/${hero.maxHp}`
    if (hpW !== c.hpW) { c.hpW = hpW; els.hpFill.style.width = `${hpW}%` }
    if (hpText !== c.hp) { c.hp = hpText; els.hpNum.textContent = hpText }
    const next = hero.xpToNext
    const xpW = next === Infinity ? 100 : Math.round(Math.min(100, hero.xp / next * 100))
    const xpText = next === Infinity ? 'MAX' : `${hero.xp}/${next}`
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
    const portrait = BOSS_ART.has(d.id) ? `<img class="et-portrait" src="art/boss-${d.id}.webp" alt="">` : ''
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
    if (BOSS_ART.has(def.id)) {
      const art = el('div', 'dossier-art', head)
      art.style.backgroundImage = `url(art/boss-${def.id}.webp)`
    }
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
    go.onclick = () => { overlay.remove(); onClose() }
    // a stray tap on the backdrop should not skip the one explanation there is
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

  setTargetMode(mode: TargetMode): void {
    if (mode === 'meteor') this.modeHint.innerHTML = `${icon('meteor')} Click to call the Meteor Storm — Esc to cancel`
    else if (mode === 'reinforce') this.modeHint.innerHTML = `${icon('shield')} Click on the road to deploy reinforcements — Esc to cancel`
    else if (mode === 'rally') this.modeHint.innerHTML = `${icon('flag')} Click near the road to move the rally point — Esc to cancel`
    this.modeHint.classList.toggle('hidden', mode === null)
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.innerHTML = icon(paused ? 'play' : 'pause', 'plain')
    this.pauseOverlay.classList.toggle('hidden', !paused)
  }

  setSpeed(speed: number): void {
    this.speedBtn.textContent = `${speed}×`
    this.speedBtn.classList.toggle('fast', speed === 2)
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
  spawnFloater(x: number, y: number, text: string, cls: string): void {
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
    this.pauseOverlay.classList.add('hidden')
    this.waveBtn.classList.add('hidden')
    this.lastGold = this.lastLives = -1
    this.lastWaveText = this.lastWaveBtnText = ''
  }
}

interface StatMults { dmg: number, splash: number, soldierHp: number }

/** stats shown in menus include armory bonuses, matching real combat numbers */
/**
 * What an upgrade changes, as numbers the player can compare.
 *
 * An upgrade button used to show its flavour text and its price and nothing
 * else: the only way to learn that the Marksman Tower shoots faster was to
 * buy it and read the chips afterwards. Each line here is "now -> after", with
 * the after in green when it is better, so the decision can be made on the
 * numbers rather than on faith.
 */
/** formatting shared by the chips and the deltas */
const fmtNum = (n: number, dp = 1) => Number.isInteger(n) ? `${n}` : n.toFixed(dp)
const fmtSecs = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}s`

function deltaLines(tower: Tower, to: TowerLevelDef, m: StatMults): string {
  const from = tower.def
  const rows: string[] = []
  const up = (label: string, a: string, b: string, better: boolean) =>
    rows.push(`<span class="d-row"><span class="d-label">${label}</span>${a} <span class="d-arrow">\u2192</span> <span class="${better ? 'd-up' : 'd-same'}">${b}</span></span>`)
  const fmt = (n: number, dp = 1) => Number.isInteger(n) ? `${n}` : n.toFixed(dp)

  if (to.aura && from.aura) {
    const a = from.aura, b = to.aura
    const pct = (n: number) => `+${Math.round(n * 100)}%`
    up('Reach', fmt(tower.rangeFor(from)), fmt(tower.rangeFor(to)), to.range > from.range)
    up('Damage', pct(a.damage), pct(b.damage), b.damage > a.damage)
    if (a.range !== b.range) up('Range', pct(a.range), pct(b.range), b.range > a.range)
    if (a.rate !== b.rate) up('Speed', pct(a.rate), pct(b.rate), b.rate > a.rate)
    if (!!a.reveal !== !!b.reveal) up('Reveals', a.reveal ? 'yes' : 'no', b.reveal ? 'yes' : 'no', !!b.reveal)
    if ((a.bounty ?? 0) !== (b.bounty ?? 0)) up('Bounty', pct(a.bounty ?? 0), pct(b.bounty ?? 0), (b.bounty ?? 0) > (a.bounty ?? 0))
    return rows.join('')
  }
  if (to.soldier && from.soldier) {
    const a = from.soldier, b = to.soldier
    const ahp = Math.round(a.hp * m.soldierHp), bhp = Math.round(b.hp * m.soldierHp)
    const acount = from.soldierCount ?? 3, bcount = to.soldierCount ?? 3
    if (acount !== bcount) up('Squad', `${acount}`, `${bcount}`, bcount > acount)
    up('Health', `${ahp}`, `${bhp}`, bhp > ahp)
    up('Damage', `${a.damage[0]}\u2013${a.damage[1]}`, `${b.damage[0]}\u2013${b.damage[1]}`, (b.damage[0] + b.damage[1]) > (a.damage[0] + a.damage[1]))
    if (a.armor !== b.armor) up('Armor', `${Math.round(a.armor * 100)}%`, `${Math.round(b.armor * 100)}%`, b.armor > a.armor)
    if (a.attackInterval !== b.attackInterval) up('Swing', `${a.attackInterval}s`, `${b.attackInterval}s`, b.attackInterval < a.attackInterval)
    if ((from.respawnTime ?? 10) !== (to.respawnTime ?? 10)) up('Respawn', `${from.respawnTime}s`, `${to.respawnTime}s`, (to.respawnTime ?? 10) < (from.respawnTime ?? 10))
    return rows.join('')
  }
  if (to.damage && to.attackInterval) {
    // both sides carry every bonus this plot grants, so a lit tower's upgrade
    // is compared lit-to-lit rather than against a number it never dealt
    const fe = tower.effectiveDamage(from) ?? [0, 0]
    const te = tower.effectiveDamage(to)!
    const fi = tower.effectiveInterval(from) ?? tower.effectiveInterval(to)!
    const ti = tower.effectiveInterval(to)!
    const alo = Math.round(fe[0] * m.dmg), ahi = Math.round(fe[1] * m.dmg)
    const blo = Math.round(te[0] * m.dmg), bhi = Math.round(te[1] * m.dmg)
    const adps = (alo + ahi) / 2 / fi, bdps = (blo + bhi) / 2 / ti
    up('Damage', `${alo}\u2013${ahi}`, `${blo}\u2013${bhi}`, (blo + bhi) > (alo + ahi))
    up('Rate', fmtSecs(fi), fmtSecs(ti), ti < fi)
    up('DPS', fmt(adps), fmt(bdps), bdps > adps)
  }
  const ar = tower.rangeFor(from), br = tower.rangeFor(to)
  if (Math.abs(ar - br) > 1e-6) up('Range', fmt(ar), fmt(br), br > ar)
  if ((to.splash ?? 0) !== (from.splash ?? 0)) {
    up('Blast', fmt((from.splash ?? 0) * m.splash, 2), fmt((to.splash ?? 0) * m.splash, 2), (to.splash ?? 0) > (from.splash ?? 0))
  }
  if (!!to.flying !== !!from.flying) up('Air', from.flying ? 'yes' : 'no', to.flying ? 'yes' : 'no', !!to.flying)
  return rows.join('')
}

/**
 * The same comparison for an ascension perk.
 *
 * A perk is a modifier on the tower as it stands, so "after" is the current
 * tier with the perk applied. The whole stat block is shown, not only the line
 * the perk touches: a player weighing Serrated Arrows against Hawkeye wants to
 * see both towers side by side, and a single "+0.8 range" line does not let
 * them. Changed values are highlighted; unchanged ones are shown as they are.
 */
function perkDeltaLines(tower: Tower, perkId: string, m: StatMults): string {
  const def = tower.def
  const rows: string[] = []
  const row = (label: string, a: string, b: string) =>
    rows.push(`<span class="d-row"><span class="d-label">${label}</span>${a} <span class="d-arrow">\u2192</span> <span class="${a === b ? 'd-same' : 'd-up'}">${b}</span></span>`)
  const fmt = (n: number, dp = 1) => Number.isInteger(n) ? `${n}` : n.toFixed(dp)
  const pct = (n: number) => `+${Math.round(n * 100)}%`

  if (def.aura) {
    const a = def.aura
    const reach = tower.auraReach
    row('Reach', fmt(reach), fmt(reach + (perkId === 'farsight' ? 0.6 : 0)))
    row('Damage', pct(a.damage), pct(a.damage + (perkId === 'zeal' ? 0.08 : 0)))
    if (a.range) row('Range', pct(a.range), pct(a.range))
    if (a.rate) row('Speed', pct(a.rate), pct(a.rate))
    return rows.join('')
  }

  if (def.soldier) {
    const sd = def.soldier
    const hp = Math.round(sd.hp * m.soldierHp)
    const hpMult = perkId === 'vanguard' ? 1.25 : 1
    const dmgMult = perkId === 'whetstone' ? 1.25 : 1
    row('Squad', `${def.soldierCount ?? 3}`, `${def.soldierCount ?? 3}`)
    row('Health', `${hp}`, `${Math.round(hp * hpMult)}`)
    row('Damage', `${sd.damage[0]}\u2013${sd.damage[1]}`, `${Math.round(sd.damage[0] * dmgMult)}\u2013${Math.round(sd.damage[1] * dmgMult)}`)
    row('Armor', `${Math.round(sd.armor * 100)}%`, `${Math.round(sd.armor * 100)}%`)
    // the Warcamp also throws; its own numbers ride below the soldiers'
    if (!def.damage || !def.attackInterval) return rows.join('')
  }

  if (def.damage && def.attackInterval) {
    const [lo, hi] = tower.effectiveDamage()!.map(v => Math.round(v * m.dmg)) as [number, number]
    const dmgMult = perkId === 'serrated' || perkId === 'heavybolts' ? 1.2 : 1
    const intMult = perkId === 'windlass' ? 0.85 : 1
    const rangeAdd = perkId === 'hawkeye' ? 0.8 : 0
    const echo = perkId === 'echo' ? 1.18 : 1
    const blo = Math.round(lo * dmgMult), bhi = Math.round(hi * dmgMult)
    const ai = tower.effectiveInterval()!, bi = ai * intMult
    const adps = (lo + hi) / 2 / ai
    const bdps = (blo + bhi) / 2 / bi * echo
    row('Damage', `${lo}\u2013${hi}`, `${blo}\u2013${bhi}`)
    row('Rate', fmtSecs(ai), fmtSecs(bi))
    row('Range', fmt(tower.range), fmt(tower.range + rangeAdd))
    row('DPS', fmt(adps), echo > 1 ? `${fmt(bdps)} avg` : fmt(bdps))
    if (def.splash) {
      const sp = def.splash * m.splash
      row('Blast', fmt(sp, 2), fmt(sp * (perkId === 'napalm' ? 1.3 : 1), 2))
    }
  }
  // the two perks that change a rule rather than a number
  if (perkId === 'tremor') row('Stun', 'none', '30% for 0.5s')
  if (perkId === 'deepveil') row('Magic resist', 'full', 'half')
  return rows.join('')
}

/** an aura in the player's words: what it adds, and to what */
function auraLine(a: TowerAura, reach: number): string {
  const parts = [`${icon('range')} lights ${reach.toFixed(1)}`]
  if (a.damage) parts.push(`${icon('sword')} +${Math.round(a.damage * 100)}% damage`)
  if (a.range) parts.push(`${icon('range')} +${Math.round(a.range * 100)}% range`)
  if (a.rate) parts.push(`${icon('hourglass')} +${Math.round(a.rate * 100)}% attack speed`)
  if (a.reveal) parts.push(`${icon('eye')} reveals phasing`)
  if (a.bounty) parts.push(`${icon('coin')} +${Math.round(a.bounty * 100)}% bounty`)
  return parts.join(' \u00b7 ')
}

function statLine(def: TowerLevelDef, m: StatMults): string {
  if (def.aura) return auraLine(def.aura, def.range) + ' \u00b7 does not attack'
  if (def.soldier) {
    const s = def.soldier
    const hp = Math.round(s.hp * m.soldierHp)
    return `${icon('soldiers')} ${def.soldierCount ?? 3}× ${s.name} · ${icon('heart')} ${hp} · ${icon('sword')} ${s.damage[0]}–${s.damage[1]}` +
      `${s.armor ? ` · ${icon('shield')} ${Math.round(s.armor * 100)}%` : ''} · ${icon('respawn')} ${def.respawnTime}s respawn`
  }
  const lo = Math.round(def.damage![0] * m.dmg), hi = Math.round(def.damage![1] * m.dmg)
  const dps = ((lo + hi) / 2 / def.attackInterval!).toFixed(1)
  const type = def.damageType === 'magic' ? `${icon('sparkle')} magic` : def.splash ? `${icon('blast')} splash` : `${icon('sword')} physical`
  const splash = def.splash ? Math.round(def.splash * m.splash * 100) / 100 : 0
  return `${icon('swords')} ${lo}–${hi} (${type}) · ${icon('hourglass')} ${def.attackInterval}s · ${icon('range')} ${def.range} · DPS ${dps}` +
    (splash ? ` · ${icon('blast')} r${splash}` : '') + (def.flying ? ` · ${icon('feather')} hits flyers` : ' · no flyers')
}
