import type { Game, TargetMode } from '../game/game.ts'
import type { Tower } from '../game/towers.ts'
import type { PlotInfo } from '../game/terrain.ts'
import type { Enemy } from '../game/units.ts'
import type { Trap, TrapSpotInfo } from '../game/traps.ts'
import {
  TowerKind, TowerLevelDef, TrapKind, TRAP_DEFS, PERKS,
  OVERCHARGE_SHARD_COST, OVERCHARGE_DURATION, ASCEND_SHARD_COST, ASCEND_GOLD_COST,
} from '../game/types.ts'
import { towerTrees } from '../game/towerDefs.ts'

const TOWER_ICONS: Record<TowerKind, string> = { arrow: '🏹', mage: '🔮', cannon: '💣', barracks: '⚔️' }
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
    this.buildPauseOverlay()
    game.hud = this
  }

  private buildTopBar(): void {
    const bar = el('div', 'topbar', this.root)
    const left = el('div', 'topbar-group', bar)
    this.livesEl = el('div', 'stat lives', left, '❤️ <b>20</b>')
    this.goldEl = el('div', 'stat gold', left, '🪙 <b>0</b>')
    this.shardsEl = el('div', 'stat shards', left, '💎 <b>0</b>')
    this.shardsEl.title = 'Veilshards — dropped by Shardbacks, elites, and bosses. Spend on tower Overcharge and Ascension.'
    this.waveEl = el('div', 'stat wave', left, '🌊 <b>0/10</b>')
    const right = el('div', 'topbar-group', bar)
    this.speedBtn = el('button', 'icon-btn', right, '1×') as HTMLButtonElement
    this.speedBtn.title = 'Game speed (F)'
    this.speedBtn.onclick = () => this.game.toggleSpeed()
    this.pauseBtn = el('button', 'icon-btn', right, '⏸') as HTMLButtonElement
    this.pauseBtn.title = 'Pause (P)'
    this.pauseBtn.onclick = () => this.game.togglePause()
    this.sfxBtn = el('button', 'icon-btn', right, this.game.save.sfxMuted ? '🔇' : '🔊') as HTMLButtonElement
    this.sfxBtn.title = 'Sound effects'
    this.sfxBtn.onclick = () => { this.game.toggleSfx(); this.sfxBtn.innerHTML = this.game.save.sfxMuted ? '🔇' : '🔊' }
    this.musicBtn = el('button', 'icon-btn', right, this.game.save.musicMuted ? '🎵̸' : '🎵') as HTMLButtonElement
    this.musicBtn.title = 'Music'
    this.musicBtn.classList.toggle('muted', this.game.save.musicMuted)
    this.musicBtn.onclick = () => {
      this.game.toggleMusic()
      this.musicBtn.classList.toggle('muted', this.game.save.musicMuted)
    }
    const doc = document as Document & { webkitFullscreenEnabled?: boolean }
    if (doc.fullscreenEnabled || doc.webkitFullscreenEnabled) {
      const fs = el('button', 'icon-btn', right, '⛶') as HTMLButtonElement
      fs.title = 'Fullscreen'
      fs.onclick = () => this.onFullscreen()
      document.addEventListener('fullscreenchange', () => {
        fs.classList.toggle('fast', !!document.fullscreenElement)
      })
    }
    const home = el('button', 'icon-btn', right, '🏰') as HTMLButtonElement
    home.title = 'Back to castle (menu)'
    home.onclick = () => this.onHome()
  }

  private buildWaveButton(): void {
    const wrap = el('div', 'wave-call-wrap', this.root)
    this.waveBtn = el('button', 'wave-call hidden', wrap) as HTMLButtonElement
    this.waveBtn.onclick = () => this.game.callWave()
    this.wavePreviewEl = el('div', 'wave-preview hidden', wrap)
    this.waveBtn.onmouseenter = () => {
      const preview = this.game.waves?.nextWavePreview()
      if (preview) {
        this.wavePreviewEl.innerHTML = '<b>Incoming:</b> ' + preview.map(p => `${p.count}× ${p.name}`).join(', ')
        this.wavePreviewEl.classList.remove('hidden')
      }
    }
    this.waveBtn.onmouseleave = () => this.wavePreviewEl.classList.add('hidden')
  }

  private heroBtn!: HTMLButtonElement

  private buildAbilities(): void {
    const bar = el('div', 'abilities', this.root)
    this.heroBtn = el('button', 'ability hero-btn', bar) as HTMLButtonElement
    this.heroBtn.innerHTML =
      '<span class="ability-icon">🤴</span><span class="cd-sweep"></span>' +
      '<span class="hero-level">1</span><span class="hero-hp"><span class="hero-hp-fill"></span></span>'
    this.heroBtn.title = 'Sir Aldric — select the hero, click the ground to move him. Hotkey H.'
    this.heroBtn.onclick = () => this.game.selectHero(true)
    const mk = (key: 'meteor' | 'reinforce', icon: string, name: string, hotkey: string, desc: string) => {
      const btn = el('button', 'ability', bar) as HTMLButtonElement
      btn.innerHTML = `<span class="ability-icon">${icon}</span><span class="cd-sweep"></span><span class="hotkey">${hotkey}</span>`
      btn.title = `${name} — ${desc}`
      btn.onclick = () => this.game.setTargetMode(this.game.targetMode === key ? null : key)
      this.abilityBtns[key] = btn
    }
    mk('meteor', '☄️', 'Meteor Storm', '1', 'Rain three meteors on a target area (true damage + stun). Hotkey 1.')
    mk('reinforce', '🛡️', 'Reinforcements', '2', 'Summon two militia anywhere on the road for 14s. Hotkey 2.')
  }

  private buildPauseOverlay(): void {
    this.pauseOverlay = el('div', 'pause-overlay hidden', this.root)
    const card = el('div', 'pause-card', this.pauseOverlay)
    el('h2', '', card, 'Paused')
    const resume = el('button', 'btn primary', card, 'Resume') as HTMLButtonElement
    resume.onclick = () => this.game.togglePause()
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
        const surgeWarn = w.nextWaveIsSurge() ? ' · 🌑 Veiltide!' : ''
        btnText = w.waveIndex < 0
          ? `⚔️ Begin the assault <span class="call-sub">${secs}s · +${bonus}🪙 if called now${surgeWarn}</span>`
          : `⚔️ Call wave ${w.waveIndex + 2} <span class="call-sub">${secs}s · +${bonus}🪙 early bonus${surgeWarn}</span>`
      }
      if (btnText !== this.lastWaveBtnText) {
        this.lastWaveBtnText = btnText
        if (btnText) {
          this.waveBtn.innerHTML = btnText
          this.waveBtn.classList.remove('hidden')
        } else {
          this.waveBtn.classList.add('hidden')
          this.wavePreviewEl.classList.add('hidden')
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
        const icon = this.heroBtn.querySelector('.ability-icon') as HTMLElement
        if (icon) icon.textContent = hero.heroDef.icon
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
    // live kill tally on the open tower/trap panel
    const killSource = this.currentTower ?? this.currentTrap
    if (killSource && !this.towerPanel.classList.contains('hidden')) {
      const killsEl = this.towerPanel.querySelector('.tp-kills')
      if (killsEl) {
        const text = ` · ☠ ${killSource.kills}`
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
        oc.textContent = t.isOvercharged(game)
          ? `⚡ Overcharged! ${Math.ceil(t.overchargeUntil - game.time)}s`
          : cdLeft > 0 ? `⚡ Recharging ${Math.ceil(cdLeft)}s` : `⚡ Overcharge 💎${OVERCHARGE_SHARD_COST}`
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
    this.buildMenu.innerHTML = ''
    const kinds: TowerKind[] = ['arrow', 'mage', 'cannon', 'barracks']
    for (const kind of kinds) {
      const def = towerTrees[kind].levels[0]
      const btn = el('button', 'build-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `<span class="b-icon">${TOWER_ICONS[kind]}</span><span class="b-name">${TOWER_NAMES[kind]}</span><span class="b-cost">🪙${def.cost}</span>`
      btn.onclick = this.menuGuard(() => this.game.buildTower(kind))
      btn.onmouseenter = () => {
        this.game.previewRange(kind)
        this.showBuildTooltip(def, kind)
      }
      btn.onmouseleave = () => { this.game.previewRange(null); this.hideBuildTooltip() }
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
    this.buildMenu.classList.add('hidden')
  }

  // ---------------- trap menu & panel ----------------

  openTrapMenu(spot: TrapSpotInfo, x: number, y: number): void {
    this.buildMenu.innerHTML = ''
    for (const kind of ['spike', 'frost', 'blast'] as TrapKind[]) {
      const def = TRAP_DEFS[kind]
      const btn = el('button', 'build-option trap-option', this.buildMenu) as HTMLButtonElement
      btn.dataset.cost = `${def.cost}`
      btn.innerHTML = `<span class="b-icon">${def.icon}</span><span class="b-name">${def.name}</span><span class="b-cost">🪙${def.cost}</span>`
      btn.onclick = this.menuGuard(() => this.game.buildTrap(kind))
      btn.onmouseenter = () => {
        const tip = document.getElementById('build-tip')
        if (tip) {
          tip.innerHTML = `<b>${def.name}</b><br>${def.description}`
          tip.classList.remove('hidden')
        }
      }
      btn.onmouseleave = () => this.hideBuildTooltip()
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
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, trap.def.icon)
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, trap.def.name)
    el('div', 'tp-level', title, `Road trap<span class="tp-kills" title="Enemies slain by this trap"> · ☠ ${trap.kills}</span>`)
    const close = el('button', 'tp-close', head, '✕') as HTMLButtonElement
    close.onclick = () => this.game.clearSelection()
    el('div', 'tp-stats', p, trap.def.description)
    const actions = el('div', 'tp-actions', p)
    const row = el('div', 'tp-row', actions)
    const sell = el('button', 'btn small sell', row, `Dismantle 🪙${Math.round(trap.def.cost * 0.6)}`) as HTMLButtonElement
    sell.onclick = this.menuGuard(() => this.game.sellTrap(trap))
    p.classList.remove('hidden')
  }

  // ---------------- tower panel ----------------

  openTowerPanel(tower: Tower): void {
    this.currentTower = tower
    this.menuOpenedAt = performance.now()
    const p = this.towerPanel
    p.innerHTML = ''
    const head = el('div', 'tp-head', p)
    el('div', 'tp-icon', head, TOWER_ICONS[tower.kind])
    const title = el('div', 'tp-title', head)
    el('div', 'tp-name', title, tower.def.name)
    el('div', 'tp-level', title, (tower.level === 5
      ? '✦ Capstone'
      : tower.level === 4
      ? '★ Specialized'
      : 'Level ' + '●'.repeat(tower.level) + '○'.repeat(3 - tower.level))
      + `<span class="tp-kills" title="Enemies slain by this building"> · ☠ ${tower.kills}</span>`)
    const close = el('button', 'tp-close', head, '✕') as HTMLButtonElement
    close.onclick = () => this.game.clearSelection()

    const extras: string[] = []
    if (tower.resonance > 0) {
      extras.push(`🔗 Resonance ×${tower.resonance}: +${tower.resonance * (tower.isBarracks ? 8 : 6)}% ${tower.isBarracks ? 'soldier health' : 'damage'}`)
    }
    if (tower.perk) extras.push(`${tower.perk.icon} ${tower.perk.name} — ${tower.perk.description}`)
    el('div', 'tp-stats', p, statLine(tower.def, this.mults(tower.kind))
      + (extras.length ? `<span class="tp-extras">${extras.join('<br>')}</span>` : ''))

    const actions = el('div', 'tp-actions', p)
    tower.upgradeOptions.forEach((opt, i) => {
      const btn = el('button', `btn upgrade${tower.level === 4 ? ' capstone' : ''}`, actions) as HTMLButtonElement
      btn.dataset.cost = `${opt.cost}`
      btn.innerHTML = `<span class="u-name">${tower.level === 4 ? '✦ ' : tower.level === 3 ? '★ ' : '⬆ '}${opt.name}</span><span class="u-cost">🪙${opt.cost}</span><span class="u-desc">${opt.description}</span>`
      btn.onclick = this.menuGuard(() => this.game.upgradeTower(tower, i))
      btn.disabled = this.game.gold < opt.cost
    })
    // ascension: tier-4+ towers pick one of two shard-bought perks
    if (tower.level >= 4 && !tower.perk) {
      PERKS[tower.kind].forEach((perk, i) => {
        const btn = el('button', 'btn upgrade ascend', actions) as HTMLButtonElement
        btn.innerHTML = `<span class="u-name">${perk.icon} Ascend: ${perk.name}</span><span class="u-cost">💎${ASCEND_SHARD_COST} 🪙${ASCEND_GOLD_COST}</span><span class="u-desc">${perk.description}</span>`
        btn.onclick = this.menuGuard(() => this.game.ascendTower(tower, i as 0 | 1))
        btn.disabled = this.game.shards < ASCEND_SHARD_COST || this.game.gold < ASCEND_GOLD_COST
      })
    }
    const row = el('div', 'tp-row', actions)
    if (!tower.isBarracks) {
      const oc = el('button', 'btn small overcharge', row, `⚡ Overcharge 💎${OVERCHARGE_SHARD_COST}`) as HTMLButtonElement
      oc.title = `+60% attack speed for ${OVERCHARGE_DURATION}s`
      oc.id = 'oc-btn'
      oc.onclick = this.menuGuard(() => this.game.overchargeTower(tower))
      oc.disabled = !tower.canOvercharge(this.game)
    }
    if (tower.isBarracks) {
      const rally = el('button', 'btn small', row, '🚩 Rally point') as HTMLButtonElement
      rally.onclick = this.menuGuard(() => this.game.setTargetMode('rally'))
    }
    const sell = el('button', 'btn small sell', row, `Sell 🪙${tower.sellValue}`) as HTMLButtonElement
    sell.onclick = this.menuGuard(() => this.game.sellTower(tower))

    p.classList.remove('hidden')
  }

  closeTowerPanel(): void {
    this.currentTower = null
    this.currentTrap = null
    this.towerPanel.classList.add('hidden')
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
    if (d.flying) traits.push('✈ flying')
    if (enemy.armor > 0.005) traits.push(`🛡 ${Math.round(enemy.armor * 100)}% armor`)
    if (d.magicResist > 0) traits.push(`✨ ${Math.round(d.magicResist * 100)}% magic resist`)
    if (d.regen) traits.push('regenerates')
    if (d.healAura) traits.push('heals allies')
    if (d.spawnOnDeath) traits.push('spawns brood')
    if (d.ranged) traits.push('ranged caster')
    if (d.boss) traits.push('👑 BOSS')
    this.tipArmorShown = Math.round(enemy.armor * 100)
    this.enemyTip.innerHTML =
      `<b>${d.name}</b><span class="et-hp"></span>` +
      (traits.length ? `<span class="et-traits">${traits.join(' · ')}</span>` : '') +
      `<span class="et-desc">${d.description}</span>`
  }

  private updateEnemyTip(enemy: Enemy): void {
    if (Math.round(enemy.armor * 100) !== this.tipArmorShown) this.rebuildEnemyTip(enemy)  // armor shred
    const hpEl = this.enemyTip.querySelector('.et-hp') as HTMLElement
    if (hpEl) hpEl.textContent = ` ❤️ ${Math.max(0, Math.ceil(enemy.hp))}/${enemy.maxHp}`
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
    if (mode === 'meteor') this.modeHint.textContent = '☄️ Click to call the Meteor Storm — Esc to cancel'
    else if (mode === 'reinforce') this.modeHint.textContent = '🛡️ Click on the road to deploy reinforcements — Esc to cancel'
    else if (mode === 'rally') this.modeHint.textContent = '🚩 Click near the road to move the rally point — Esc to cancel'
    this.modeHint.classList.toggle('hidden', mode === null)
  }

  setPaused(paused: boolean): void {
    this.pauseBtn.innerHTML = paused ? '▶️' : '⏸'
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
    f.textContent = text
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
    this.root.classList.toggle('chrome-hidden', !visible)
  }

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
    return `👥 ${def.soldierCount ?? 3}× ${s.name} · ❤️ ${hp} · ⚔️ ${s.damage[0]}–${s.damage[1]}` +
      `${s.armor ? ` · 🛡 ${Math.round(s.armor * 100)}%` : ''} · ⟳ ${def.respawnTime}s respawn`
  }
  const lo = Math.round(def.damage![0] * m.dmg), hi = Math.round(def.damage![1] * m.dmg)
  const dps = ((lo + hi) / 2 / def.attackInterval!).toFixed(1)
  const type = def.damageType === 'magic' ? '✨ magic' : def.splash ? '💥 splash' : '🗡 physical'
  const splash = def.splash ? Math.round(def.splash * m.splash * 100) / 100 : 0
  return `⚔️ ${lo}–${hi} (${type}) · ⏱ ${def.attackInterval}s · 📏 ${def.range} · DPS ${dps}` +
    (splash ? ` · 💥 r${splash}` : '') + (def.flying ? ' · ✈ hits flyers' : ' · ✖ no flyers')
}
