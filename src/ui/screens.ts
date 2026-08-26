import { levels } from '../game/levels.ts'
import { Difficulty, DIFFICULTIES, HeroId } from '../game/types.ts'
import { HERO_DEFS } from '../game/hero.ts'
import { ARMORY_TRACKS, starsAvailable, starsEarned, buyTier, respec, armoryTier } from '../game/armory.ts'
import { writeSave } from '../core/save.ts'
import type { SaveData } from '../core/save.ts'
import { icon } from './icons.ts'
import { readCheckpoint } from '../game/checkpoint.ts'
import { dailyNumber } from '../game/ruleset.ts'
import { holdPieces, holdSummary } from '../game/hold.ts'
import { dailyShareText, challengeUrl, type DailyResult } from '../game/share.ts'

export type ScreenName = 'menu' | 'levels' | 'victory' | 'defeat' | 'none'

const THEME_ART: Record<string, string> = {
  forest: 'linear-gradient(160deg, #79c057 0%, #4e9a3d 55%, #2e7a52 100%)',
  winter: 'linear-gradient(160deg, #d8ecf6 0%, #9cc4dd 55%, #5b87b0 100%)',
  ember: 'linear-gradient(160deg, #e8935f 0%, #b05038 55%, #5f2d44 100%)',
  swamp: 'linear-gradient(160deg, #8fae72 0%, #5f7a4f 55%, #3a4f42 100%)',
  void: 'linear-gradient(160deg, #8f7ab8 0%, #5f4a8f 55%, #2a1d45 100%)',
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  e.className = cls
  if (html !== undefined) e.innerHTML = html
  parent?.appendChild(e)
  return e
}

export type GameMode = 'campaign' | 'endless'

export interface BattleStats {
  kills: number, gold: number, shards: number, wavesReached: number, totalWaves: number,
  timeSec: number, heroLevel: number, endless: boolean, bestEndless: number,
  score: number, prevBestScore: number, newBestScore: boolean, newWaveRecord: boolean,
  perfectWaves: number, bestStreak: number, noleak: boolean,
  lastLeak: { name: string, wave: number } | null,
  topKiller: { name: string, kills: number } | null,
  heroKills: number,
  daily?: DailyResult,
}

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
  onResume: () => void = () => {}
  onPlayDaily: () => void = () => {}

  constructor(private save: () => SaveData) {
    this.root = document.getElementById('screens')!
  }

  show(name: ScreenName, opts: { stars?: number, levelId?: string, stats?: BattleStats } = {}): void {
    this.root.innerHTML = ''
    this.root.classList.toggle('hidden', name === 'none')
    this.root.classList.toggle('transparent-bg', name === 'victory' || name === 'defeat')
    switch (name) {
      case 'menu': this.renderMenu(); break
      case 'levels': this.renderLevels(); break
      case 'victory': this.renderEnd(true, opts.stars ?? 1, opts.levelId!, opts.stats); break
      case 'defeat': this.renderEnd(false, 0, opts.levelId!, opts.stats); break
    }
  }

  private renderMenu(): void {
    const save = this.save()
    const wrap = el('div', 'screen menu-screen', this.root)
    const card = el('div', 'menu-hero', wrap)
    // painted key art under a dark scrim; inline so the URL resolves at runtime
    card.style.background =
      'linear-gradient(180deg, rgba(28, 19, 12, 0.82), rgba(22, 15, 10, 0.9) 62%, rgba(20, 14, 9, 0.96)), ' +
      'url(art/title.webp) center / cover'
    el('div', 'menu-crest', card, icon('castle', 'gilded'))
    el('h1', 'game-title', card, 'BLOCKHOLD')
    el('div', 'game-tagline', card, 'Hold the line, block by block.')
    // A newcomer has nothing to choose between yet, and a link-shared game has
    // about ten seconds. Drop them straight into the first battle; the level
    // select, heroes and difficulty appear once they have played one.
    const fresh = isFirstRun(save)
    const play = el('button', 'btn primary big', card,
      `${icon('swords')} &nbsp;${fresh ? 'Play' : 'To Battle'}`) as HTMLButtonElement
    play.onclick = () => {
      if (fresh) this.onPlayLevel(levels[0].id, 'normal', 'aldric', 'campaign')
      else this.show('levels')
    }
    // a battle interrupted mid-campaign is worth more than a fresh one
    const cp = readCheckpoint()
    if (cp) {
      const lvl = levels.find(l => l.id === cp.levelId)
      const resume = el('button', 'btn primary', card,
        `${icon('respawn')} Resume ${lvl?.name ?? 'battle'} · wave ${cp.waveIndex + 1}`) as HTMLButtonElement
      resume.onclick = () => this.onResume()
    }
    // one battle, the same one for everyone in the world today
    const day = dailyNumber()
    const done = save.dailyBest?.day === day
    const daily = el('button', 'btn ghost', card,
      `${icon('moon')} Daily Hold #${day}${done ? ` · wave ${save.dailyBest!.wave}` : ''}`) as HTMLButtonElement
    daily.onclick = () => this.onPlayDaily()
    const how = el('button', 'btn ghost', card, 'How to play') as HTMLButtonElement
    how.onclick = () => this.renderHelp()
    if (needsInstallGuide()) {
      const install = el('button', 'btn ghost', card, `${icon('fullscreen')} Play fullscreen`) as HTMLButtonElement
      install.onclick = () => this.renderInstallGuide()
    }
    el('div', 'menu-footer', wrap, holdSummary(holdPieces(save)))
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
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  }

  private renderLevels(): void {
    const save = this.save()
    const wrap = el('div', 'screen levels-screen', this.root)
    const head = el('div', 'levels-head', wrap)
    const back = el('button', 'btn ghost small', head, '← Back') as HTMLButtonElement
    back.onclick = () => this.show('menu')
    el('h2', 'levels-title', head, 'Choose your battlefield')
    const armoryBtn = el('button', 'btn ghost small', head, `${icon('swords')} Armory · ${starsAvailable(save)}★`) as HTMLButtonElement
    armoryBtn.onclick = () => this.renderArmory()
    const grid = el('div', 'levels-grid', wrap)
    levels.forEach((lvl, i) => {
      const locked = i >= save.unlocked
      const stars = save.stars[lvl.id] ?? 0
      const card = el('button', `level-card${locked ? ' locked' : ''}`, grid) as HTMLButtonElement
      const art = el('div', 'level-art', card, locked ? icon('lock', 'plain') : '')
      // painted card over the theme gradient (which shows until the image lands)
      art.style.background = `url(art/card-${lvl.id}.webp) center / cover, ${THEME_ART[lvl.theme]}`
      el('div', 'level-name', card, `${i + 1}. ${lvl.name}`)
      el('div', 'level-sub', card, lvl.subtitle)
      el('div', 'level-meta', card, `${lvl.waves.length} waves · ${lvl.lanes.length === 1 ? 'single road' : `${lvl.lanes.length} roads`}`)
      const best = save.bestEndless[lvl.id] ?? 0
      const medals = save.medals[lvl.id] ?? []
      el('div', 'level-stars', card, '★'.repeat(stars) + '<span class="dim">' + '★'.repeat(3 - stars) + '</span>' +
        (medals.includes('noleak') ? `<span class="level-medal" title="Flawless: won without a single leak"> ${icon('medal')}</span>` : '') +
        (medals.includes('veteran') ? `<span class="level-medal" title="Conquered on Veteran"> ${icon('medal', 'vet')}</span>` : '') +
        (best > 0 ? `<span class="level-endless"> ${icon('moon')}${best}</span>` : ''))
      // the goal ladder: always show the next rung
      if (!locked) {
        const goal = stars === 0 ? 'Clear the map'
          : stars < 3 ? 'Earn three stars'
          : !medals.includes('noleak') ? 'Win without a single leak'
          : !medals.includes('veteran') ? 'Conquer it on Veteran'
          : best === 0 ? 'Enter the Long Night'
          : `Survive past wave ${best} in the Long Night`
        el('div', 'level-goal', card, `➤ ${goal}`)
      }
      if (!locked) card.onclick = () => this.showDifficultyPicker(lvl.id, lvl.name)
    })
  }

  /**
   * The daily's whole job is to become an object somebody can hand to a
   * friend, so the result is a spoiler-free block they can copy and a link
   * that drops that friend onto the exact same board.
   */
  private renderDailyResult(card: HTMLElement, r: DailyResult, won: boolean): void {
    el('div', 'end-emoji', card, icon('moon'))
    el('h2', 'end-title', card, `Daily Hold #${r.day}`)
    el('div', 'end-sub', card, won
      ? `Held all ${r.totalWaves} waves — ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} left`
      : `Wave ${r.wavesReached} of ${r.totalWaves}`)

    const url = challengeUrl(this.dailySeedForShare)
    const text = dailyShareText(r, url)
    el('pre', 'daily-blocks', card, text.split('\n').slice(2, 3).join(''))

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
  }

  /** the seed the daily just played, so the share link points at that board */
  dailySeedForShare = 0
  onShared: (kind: string) => void = () => {}

  private showDifficultyPicker(levelId: string, levelName: string): void {
    const save = this.save()
    let hero: HeroId = (save.lastHero in HERO_DEFS ? save.lastHero : 'aldric') as HeroId
    let mode: GameMode = 'campaign'
    const beaten = (save.stars[levelId] ?? 0) > 0
    const best = save.bestEndless[levelId] ?? 0
    const overlay = el('div', 'help-overlay', this.root)
    const card = el('div', 'help-card difficulty-card', overlay)
    el('h2', '', card, levelName)

    if (beaten) {
      const modeRow = el('div', 'mode-row', card)
      const mkMode = (m: GameMode, label: string) => {
        const btn = el('button', `mode-option${m === mode ? ' picked' : ''}`, modeRow, label) as HTMLButtonElement
        btn.onclick = () => {
          mode = m
          modeRow.querySelectorAll('.mode-option').forEach((b, i) => b.classList.toggle('picked', (i === 0) === (m === 'campaign')))
        }
        return btn
      }
      mkMode('campaign', `${icon('swords')} Campaign`)
      mkMode('endless', `${icon('moon')} The Long Night${best > 0 ? ` · best ${best}` : ''}`)
    }

    el('div', 'diff-sub', card, 'Choose your champion')
    const heroRow = el('div', 'hero-row', card)
    const heroBtns = new Map<HeroId, HTMLButtonElement>()
    for (const def of Object.values(HERO_DEFS)) {
      const btn = el('button', 'hero-option', heroRow) as HTMLButtonElement
      btn.innerHTML = `<img class="hero-portrait" src="art/hero-${def.id}.webp" alt="">` +
        `<span class="hero-name">${def.name}</span><span class="hero-title">${def.title}</span>` +
        `<span class="hero-blurb">${def.blurb}</span>` +
        `<span class="hero-stats">${icon('heart')} ${def.hp} · ${icon('sword')} ${def.damage[0]}–${def.damage[1]}${def.attackRange ? ` · ${icon('range')} ${def.attackRange}` : ' · melee'}</span>` +
        `<span class="hero-ability">✦ ${def.ability.name}: ${def.ability.blurb}</span>`
      btn.onclick = () => {
        hero = def.id
        heroBtns.forEach((b, id) => b.classList.toggle('picked', id === hero))
      }
      heroBtns.set(def.id, btn)
    }
    heroBtns.get(hero)?.classList.add('picked')

    el('div', 'diff-sub', card, 'Choose your challenge')
    const row = el('div', 'diff-row', card)
    for (const key of ['casual', 'normal', 'veteran'] as Difficulty[]) {
      const d = DIFFICULTIES[key]
      const btn = el('button', `diff-option ${key}`, row) as HTMLButtonElement
      btn.innerHTML = `<span class="diff-name">${d.name}</span><span class="diff-blurb">${d.blurb}</span>` +
        `<span class="diff-stats">${icon('heart')} ${d.lives} · foes ${Math.round(d.enemyHp * 100)}% · gold ${Math.round(d.bounty * 100)}%</span>`
      btn.onclick = () => this.onPlayLevel(levelId, key, hero, mode)
    }
    const cancel = el('button', 'btn ghost small', card, 'Cancel') as HTMLButtonElement
    cancel.onclick = () => overlay.remove()
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  }

  private renderEnd(won: boolean, stars: number, levelId: string, stats?: BattleStats): void {
    const idx = levels.findIndex(l => l.id === levelId)
    const endless = stats?.endless ?? false
    const hasNext = won && !endless && idx >= 0 && idx < levels.length - 1
    const daily = stats?.daily
    const wrap = el('div', 'screen end-screen', this.root)
    const card = el('div', `end-card ${won ? 'won' : 'lost'}`, wrap)
    if (daily) { this.renderDailyResult(card, daily, won); return }
    el('div', 'end-emoji', card, icon(endless ? 'moon' : won ? 'trophy' : 'skull'))
    el('h2', 'end-title', card, endless ? 'The Long Night ends' : won ? 'Victory!' : 'The gate has fallen')
    if (endless && stats) {
      el('div', 'end-sub', card,
        `You held for <b>${stats.wavesReached}</b> wave${stats.wavesReached === 1 ? '' : 's'}` +
        (stats.newWaveRecord ? ` — a new record! ${icon('medal')}` : ` · best: ${stats.bestEndless}`))
    } else if (won) {
      const starRow = el('div', 'end-stars', card)
      for (let i = 0; i < 3; i++) {
        const s = el('span', `end-star${i < stars ? ' earned' : ''}`, starRow, '★')
        s.style.animationDelay = `${0.3 + i * 0.35}s`
      }
      // "flawless" is only ever said when it is true
      el('div', 'end-sub', card, stats?.noleak ? `A flawless defense — not one got through! ${icon('medal')}`
        : stars === 3 ? 'The kingdom stands tall.' : stars === 2 ? 'The kingdom endures.' : 'A costly victory…')
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
      if (stats.topKiller && stats.topKiller.kills > 0) {
        el('div', 'end-topkiller', card, `${icon('trophy')} Deadliest building: <b>${stats.topKiller.name}</b> — ${stats.topKiller.kills} slain`)
      }
    }
    const row = el('div', 'end-actions', card)
    if (hasNext) {
      const next = el('button', 'btn primary', row, 'Next battle →') as HTMLButtonElement
      next.onclick = () => this.onPlayLevel(levels[idx + 1].id)
    }
    const retry = el('button', `btn ${won && !endless ? '' : 'primary'}`, row, endless ? 'Descend again' : won ? 'Replay' : 'Try again') as HTMLButtonElement
    retry.onclick = () => this.onPlayLevel(levelId, undefined, undefined, endless ? 'endless' : 'campaign')
    const menu = el('button', 'btn ghost', row, 'Level select') as HTMLButtonElement
    menu.onclick = () => { this.onMenu(); this.show('levels') }

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

  /** wired by main so screens never import the capture layer directly */
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
      starsLine.innerHTML = `<b>${starsAvailable(save)}★</b> to spend · ${starsEarned(save)}★ earned in battle`
      grid.innerHTML = ''
      for (const track of ARMORY_TRACKS) {
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
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); this.show('levels') } }
  }

  private renderHelp(): void {
    const overlay = el('div', 'help-overlay', this.root)
    const card = el('div', 'help-card', overlay)
    el('h2', '', card, 'How to play')
    card.insertAdjacentHTML('beforeend', `
      <div class="help-grid">
        <div><b>${icon('castle')} Build.</b> Click a stone plot and pick a tower. Arrows are cheap and quick, mages pierce armor, cannons splash groups, barracks block the road.</div>
        <div><b>⬆ Upgrade.</b> Towers level up three times, choose one of two elite specializations — then, for a small fortune, crown the tree with a capstone: Crown Volleys, Convergence Runes, Seismic Charges, or the Last Muster.</div>
        <div><b>${icon('shield')} Block.</b> Barracks soldiers hold enemies in place while your towers work. Move them with the rally flag.</div>
        <div><b>${icon('helmPlume')} Command your hero.</b> Sir Aldric levels up from nearby kills and slams groups of foes. Select him (or press H) to see his stats and guard ring, then click the ground to move his post.</div>
        <div><b>${icon('swords')} Call waves.</b> Call the next wave early for bonus gold — if you dare.</div>
        <div><b>${icon('meteor')} Abilities.</b> Meteor Storm (1) devastates an area. Reinforcements (2) plug a leak for a few seconds.</div>
        <div><b>${icon('spike')} Trap the road.</b> Rune circles on the road hold traps: spike snares, frost runes, and blast charges that fire on whatever crosses them.</div>
        <div><b>${icon('gem')} Harvest shards.</b> Shardbacks, elites, and bosses drop Veilshards. Spend them to Overcharge a tower's attack speed or Ascend a tier-4 tower with a permanent perk.</div>
        <div><b>${icon('moon')} Respect the Veiltide.</b> Marked waves surge with empowered enemies under a violet sky. Calling one early is a gamble.</div>
        <div><b>${icon('link')} Build in choirs.</b> Same-family towers standing adjacent resonate: +6% damage each (barracks: tougher soldiers).</div>
        <div><b>${icon('eye')} Know your enemy.</b> Hover any foe to inspect it. Armor shrugs off arrows; mystics resist magic; flyers sail over soldiers and cannons — and Mistwalkers phase out of reach entirely.</div>
        <div><b><span class="gold-star">★</span> Spend your stars.</b> Victory stars buy permanent upgrades in the Royal Armory, found on the level-select screen.</div>
        <div><b>${icon('moon')} Survive the Long Night.</b> Beat a map to unlock its Endless mode: ever-escalating waves, a boss every tenth, and a personal record to chase.</div>
        <div><b>${icon('range')} Camera.</b> Drag to pan; right-drag, middle-drag, or Shift+drag to orbit and tilt; scroll to zoom. Touch: pinch to zoom, twist to rotate, two-finger drag to tilt.</div>
        <div><b>${icon('rune')} Hotkeys.</b> Space = call wave · F = speed · P = pause · H = hero · Q/E rotate · T/G tilt · C = reset view · Esc = cancel/close.</div>
      </div>
    `)
    const close = el('button', 'btn primary', card, 'Got it') as HTMLButtonElement
    close.onclick = () => overlay.remove()
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  }
}
