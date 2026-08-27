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
import { EARTHWORK_DEFS, type EarthworkSpot } from '../game/earthworks.ts'
import { beatIndex, BEATS_PER_BAR } from '../game/beat.ts'
import { traitsOf, counterFor } from '../game/dossier.ts'
import type { EnemyDef } from '../game/types.ts'
import { icon, BOSS_ART } from './icons.ts'

function chip(label: string, value: string, cls = ''): string {
  return `<span class="chip${cls ? ' ' + cls : ''}"><span class="chip-label">${label}</span><span class="chip-value">${value}</span></span>`
}

const TOWER_ICONS: Record<TowerKind, string> = { arrow: 'bow', mage: 'orb', cannon: 'bomb', barracks: 'helm' }
const TOWER_NAMES: Record<TowerKind, string> = { arrow: 'Arrow', mage: 'Mage', cannon: 'Cannon', barracks: 'Barracks' }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

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
      btn.onclick = () => this.game.setTargetMode(this.game.targetMode === key ? null : key)
      this.abilityBtns[key] = btn
    }
    mk('meteor', 'meteor', 'Meteor Storm', '1', 'Rain three meteors on a target area (true damage + stun). Hotkey 1.')
    mk('reinforce', 'shield', 'Reinforcements', '2', 'Summon two militia anywhere on the road for 14s. Hotkey 2.')
    // the hero's signature used to fire itself; it is the player's to spend now
    this.signatureBtn = el('button', 'ability', bar) as HTMLButtonElement
    this.signatureBtn.innerHTML =
      `<span class="ability-icon">${icon('quake')}</span><span class="cd-sweep"></span><span class="hotkey">3</span>`
    this.signatureBtn.setAttribute('aria-label', 'Hero signature ability')
    this.signatureBtn.onclick = () => this.game.castHeroSignature()
  }

  private signatureBtn!: HTMLButtonElement
  private lastSignatureId = ''

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
    const kinds: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks']
    for (const kind of kinds) {
      const def = towerTrees[kind].levels[0]
      const btn = el('button', 'build-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `<span class="b-icon">${icon(TOWER_ICONS[kind])}</span><span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
      btn.onclick = this.menuGuard(() => this.commitBuild(kind, btn, () => {
        this.game.previewRange(kind)
        this.showBuildTooltip(def, kind)
      }, () => this.game.buildTower(kind)))
      btn.onmouseenter = () => {
        this.game.previewRange(kind)
        this.showBuildTooltip(def, kind)
      }
      btn.onmouseleave = () => {
        if (this.armedBuild) return   // keep an armed touch selection visible
        this.game.previewRange(null)
        this.hideBuildTooltip()
      }
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
    if (!isCoarsePointer()) { build(); return }
    if (this.armedBuild === key) {
      this.armedBuild = null
      build()
      return
    }
    this.armedBuild = key
    for (const b of this.buildMenu.querySelectorAll('.build-option')) b.classList.remove('armed')
    btn.classList.add('armed')
    inspect()
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
  openEarthworkMenu(spot: EarthworkSpot, x: number, y: number): void {
    this.armedBuild = null
    this.buildMenu.innerHTML = ''
    const def = EARTHWORK_DEFS[spot.kind]
    const btn = el('button', 'build-option trap-option', this.buildMenu) as HTMLButtonElement
    btn.dataset.cost = `${def.cost}`
    btn.innerHTML = `<span class="b-icon">${icon(def.icon)}</span><span class="b-name">${def.name}</span><span class="b-cost">${icon('coin')}${def.cost}</span>`
    const showTip = () => {
      const tip = document.getElementById('build-tip')
      if (tip) {
        tip.innerHTML = `<b>${def.name}</b><br>${def.description}`
        tip.classList.remove('hidden')
      }
    }
    btn.onclick = this.menuGuard(() => this.commitBuild(
      `earth:${spot.kind}`, btn, showTip, () => this.game.buildEarthwork(),
    ))
    btn.onmouseenter = showTip
    btn.onmouseleave = () => { if (!this.armedBuild) this.hideBuildTooltip() }
    btn.classList.toggle('poor', this.game.gold < def.cost)
    const tip = el('div', 'build-tooltip hidden', this.buildMenu)
    tip.id = 'build-tip'
    this.placeMenu(x, y)
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
      btn.onclick = this.menuGuard(() => this.commitBuild(
        `trap:${kind}`, btn, showTrapTip, () => this.game.buildTrap(kind),
      ))
      btn.onmouseenter = showTrapTip
      btn.onmouseleave = () => { if (!this.armedBuild) this.hideBuildTooltip() }
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
    close.onclick = () => this.game.clearSelection()
    el('div', 'tp-stats', p, trap.def.description)
    const actions = el('div', 'tp-actions', p)
    const row = el('div', 'tp-row', actions)
    const sell = el('button', 'btn small sell', row, `Dismantle ${icon('coin')}${Math.round(trap.def.cost * 0.6)}`) as HTMLButtonElement
    sell.onclick = this.menuGuard(() => this.game.sellTrap(trap))
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
    close.onclick = () => this.game.clearSelection()

    // labeled stat chips read faster than an inline icon run
    const m = this.mults(tower.kind)
    const def = tower.def
    if (def.soldier) {
      const s = def.soldier
      el('div', 'stat-chips', p,
        chip('Squad', `${icon('soldiers')} ${def.soldierCount ?? 3}× ${s.name}`, 'wide') +
        chip('Health', `${icon('heart')} ${Math.round(s.hp * m.soldierHp)}`) +
        chip('Damage', `${icon('sword')} ${s.damage[0]}–${s.damage[1]}`) +
        chip('Armor', `${icon('shield')} ${Math.round(s.armor * 100)}%`) +
        chip('Respawn', `${icon('respawn')} ${def.respawnTime}s`))
    } else {
      const lo = Math.round(def.damage![0] * m.dmg), hi = Math.round(def.damage![1] * m.dmg)
      const typeIco = def.damageType === 'magic' ? 'sparkle' : def.splash ? 'blast' : 'sword'
      el('div', 'stat-chips', p,
        chip('Damage', `${icon(typeIco)} ${lo}–${hi}`) +
        chip('Rate', `${icon('hourglass')} ${def.attackInterval}s`) +
        chip('Range', `${icon('range')} ${def.range}`) +
        chip('DPS', `${icon('swords')} ${((lo + hi) / 2 / def.attackInterval!).toFixed(1)}`))
      const traits: string[] = []
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
      btn.innerHTML = `<span class="u-name">${tower.level === 4 ? '✦ ' : tower.level === 3 ? '★ ' : '⬆ '}${opt.name}</span><span class="u-cost">${icon('coin')}${opt.cost}</span><span class="u-desc">${opt.description}</span>`
      btn.onclick = this.menuGuard(() => this.game.upgradeTower(tower, i))
      btn.disabled = this.game.gold < opt.cost
    })
    // ascension: tier-4+ towers pick one of two shard-bought perks
    if (tower.level >= 4 && !tower.perk) {
      PERKS[tower.kind].forEach((perk, i) => {
        const btn = el('button', 'btn upgrade ascend', actions) as HTMLButtonElement
        btn.innerHTML = `<span class="u-name">${icon(perk.icon)} Ascend: ${perk.name}</span><span class="u-cost">${icon('gem')}${ASCEND_SHARD_COST} ${icon('coin')}${ASCEND_GOLD_COST}</span><span class="u-desc">${perk.description}</span>`
        btn.onclick = this.menuGuard(() => this.game.ascendTower(tower, i as 0 | 1))
        btn.disabled = this.game.shards < ASCEND_SHARD_COST || this.game.gold < ASCEND_GOLD_COST
      })
    }
    const row = el('div', 'tp-row', actions)
    if (!tower.isBarracks) {
      const oc = el('button', 'btn small overcharge', row, `${icon('lightning')} Overcharge ${icon('gem')}${OVERCHARGE_SHARD_COST}`) as HTMLButtonElement
      oc.title = `+60% attack speed for ${OVERCHARGE_DURATION}s`
      oc.id = 'oc-btn'
      this.lastOcHtml = ''
      oc.onclick = this.menuGuard(() => this.game.overchargeTower(tower))
      oc.disabled = !tower.canOvercharge(this.game)
    }
    if (tower.isBarracks) {
      const rally = el('button', 'btn small', row, `${icon('flag')} Rally point`) as HTMLButtonElement
      rally.onclick = this.menuGuard(() => this.game.setTargetMode('rally'))
    } else {
      const tgt = el('button', 'btn small', row,
        `${icon('target')} ${TARGET_POLICY_LABEL[tower.targetPolicy]}`) as HTMLButtonElement
      tgt.title = 'Which enemy this tower shoots: closest to the gate, furthest from it, the toughest, or the weakest'
      tgt.onclick = this.menuGuard(() => {
        const next = tower.cycleTargetPolicy()
        tgt.innerHTML = `${icon('target')} ${TARGET_POLICY_LABEL[next]}`
      })
    }
    const sell = el('button', 'btn small sell', row, `Sell ${icon('coin')}${tower.sellValue}`) as HTMLButtonElement
    sell.onclick = this.menuGuard(() => this.game.sellTower(tower))

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
      `✦ <b>${hero.heroDef.ability.name}</b> — ${hero.heroDef.ability.blurb} <span class="ability-cd-num"></span>`)
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
    if (enemy.armor > 0.005) traits.push(`${icon('shield')} ${Math.round(enemy.armor * 100)}% armor`)
    if (d.magicResist > 0) traits.push(`${icon('sparkle')} ${Math.round(d.magicResist * 100)}% magic resist`)
    if (d.regen) traits.push('regenerates')
    if (d.healAura) traits.push('heals allies')
    if (d.spawnOnDeath) traits.push('spawns brood')
    if (d.ranged) traits.push('ranged caster')
    if (d.boss) traits.push(`${icon('crown')} BOSS`)
    this.tipArmorShown = Math.round(enemy.armor * 100)
    const portrait = BOSS_ART.has(d.id) ? `<img class="et-portrait" src="art/boss-${d.id}.webp" alt="">` : ''
    this.enemyTip.innerHTML = portrait +
      `<b>${d.name}</b> ${icon('heart')}<span class="et-hp"></span>` +
      (traits.length ? `<span class="et-traits">${traits.join(' · ')}</span>` : '') +
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

  spawnFloater(x: number, y: number, text: string, cls: string): void {
    let f = this.floaterPool.pop()
    if (!f) {
      f = el('div', 'floater', this.root)
    }
    f.innerHTML = text
    f.className = `floater ${cls}`
    f.style.left = `${x}px`
    f.style.top = `${y}px`
    f.style.display = 'block'
    void f.offsetWidth
    f.classList.add('float-up')
    window.setTimeout(() => {
      f!.style.display = 'none'
      f!.classList.remove('float-up')
      if (this.floaterPool.length < 40) this.floaterPool.push(f!)
    }, 1100)
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
function statLine(def: TowerLevelDef, m: StatMults): string {
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
