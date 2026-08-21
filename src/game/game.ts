import * as THREE from 'three'
import { Engine } from '../core/engine.ts'
import { audio, SfxName } from '../core/audio.ts'
import { loadSave, writeSave, SaveData } from '../core/save.ts'
import {
  LevelDef, TowerKind, Difficulty, DIFFICULTIES, HeroId, TrapKind, TRAP_DEFS,
  OVERCHARGE_SHARD_COST, ASCEND_SHARD_COST, ASCEND_GOLD_COST,
} from './types.ts'
import { Trap, TrapSpotInfo } from './traps.ts'
import { Hazard, createHazard } from './hazards.ts'
import { enemyDef } from './enemyDefs.ts'
import { towerTrees } from './towerDefs.ts'
import { buildPaths, LanePath } from './path.ts'
import { disposeClonedMaterials } from '../voxel/builder.ts'
import { levels, generateEndlessWaves } from './levels.ts'
import { Terrain, PlotInfo, THEMES } from './terrain.ts'
import { Particles } from './particles.ts'
import { Enemy, Soldier } from './units.ts'
import { Hero, HERO_DEFS } from './hero.ts'
import { Tower } from './towers.ts'
import { WaveManager } from './waves.ts'
import { World, ProjectileSpec } from './world.ts'
import { Projectile, createProjectile, updateBurnZones, clearBurnZones, updateMines, clearMines, updateRunes, clearRunes, clearOwnedEffects } from './projectiles.ts'
import { armoryTier } from './armory.ts'
import type { HUD } from '../ui/hud.ts'
import { icon } from '../ui/icons.ts'
import { randRange } from '../core/utils.ts'

export type GamePhase = 'idle' | 'playing' | 'victory' | 'defeat'
export type TargetMode = 'meteor' | 'reinforce' | 'rally' | null

export interface AbilityState { cooldown: number, max: number }

const METEOR_CD = 45
const REINFORCE_CD = 14
const METEOR_COUNT = 3
const METEOR_DAMAGE: [number, number] = [70, 100]

export class Game implements World {
  engine: Engine
  hud!: HUD
  save: SaveData

  // world state
  dynamic = new THREE.Group()
  lanes: LanePath[] = []
  particles = new Particles()
  enemies: Enemy[] = []
  soldiers: Soldier[] = []
  towers: Tower[] = []
  projectiles: Projectile[] = []
  cameraQuat = new THREE.Quaternion()
  time = 0

  phase: GamePhase = 'idle'
  level: LevelDef | null = null
  difficulty: Difficulty = 'normal'
  terrain: Terrain | null = null
  waves: WaveManager | null = null
  gold = 0
  lives = 0
  shards = 0
  traps: Trap[] = []
  speed: 1 | 2 = 1
  paused = false
  isEndless = false
  goldEarned = 0
  shardsEarned = 0
  defenseStreak = 0
  bestStreak = 0
  perfectWaves = 0
  private earlyCallSeconds = 0
  private lastLeak: { name: string, wave: number } | null = null
  private waveTracks = new Map<number, { spawned: number, gone: number, leaked: boolean }>()
  private surgeBlend = 0
  private hazard: Hazard | null = null
  /** enemy mechanics already explained this battle (first-encounter toasts) */
  private mechanicsSeen = new Set<string>()

  // interaction
  selectedTower: Tower | null = null
  selectedPlot: PlotInfo | null = null
  selectedTrapSpot: TrapSpotInfo | null = null
  hero: Hero | null = null
  heroSelected = false
  targetMode: TargetMode = null
  abilities: Record<'meteor' | 'reinforce', AbilityState> = {
    meteor: { cooldown: 0, max: METEOR_CD },
    reinforce: { cooldown: 0, max: REINFORCE_CD },
  }
  private pendingCasts: { at: number, spec: ProjectileSpec }[] = []
  private raycaster = new THREE.Raycaster()
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private rangeRing: THREE.Mesh
  private selectRing: THREE.Mesh
  private targetRing: THREE.Mesh
  private heroRing: THREE.Mesh
  private heroGuardRing: THREE.Mesh
  private lanePreview: THREE.Group | null = null
  private lanePreviewMats: THREE.MeshBasicMaterial[] = []
  private lanePreviewGeos: THREE.BufferGeometry[] = []
  private laneRunners: { mesh: THREE.Mesh, lane: number, phase: number }[] = []
  private hoverPlot: PlotInfo | null = null
  private killCount = 0

  onPhaseChange: (phase: GamePhase, stars?: number) => void = () => {}

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas)
    this.save = loadSave()
    // retroactive unlocks: stars on a map always open the next one, so saves
    // from before the campaign grew see the new maps without replaying
    const starIdx = levels.reduce((m, l, i) => (this.save.stars[l.id] ?? 0) > 0 ? Math.max(m, i) : m, -1)
    this.save.unlocked = Math.max(this.save.unlocked, Math.min(starIdx + 2, levels.length))
    audio.setMuted(this.save.sfxMuted)
    audio.setMusicMuted(this.save.musicMuted)

    this.rangeRing = makeRing(1, 0x7fd4ff, 0.24)
    this.selectRing = makeRing(1, 0xffe89f, 0.5)
    this.selectRing.scale.setScalar(0.62)
    this.targetRing = makeRing(1.15, 0xff8c42, 0.5)
    this.heroRing = makeRing(0.42, 0x7fd4ff, 0.7)
    this.heroGuardRing = makeRing(1, 0x7fd4ff, 0.2)
    this.rangeRing.visible = this.selectRing.visible = this.targetRing.visible = this.heroRing.visible = this.heroGuardRing.visible = false
  }

  // ---------------- World impl ----------------

  sfx(name: SfxName, volume = 1): void { audio.play(name, volume) }

  addGold(amount: number, x?: number, y?: number, z?: number): void {
    this.gold += amount
    if (amount > 0) this.goldEarned += amount
    if (x !== undefined && amount > 0) {
      this.floater(x, y ?? 0.5, z ?? 0, `+${amount}`, 'gold')
    }
  }

  floater(x: number, y: number, z: number, text: string, cls: string): void {
    const p = this.projectToScreen(x, y, z)
    if (p) this.hud.spawnFloater(p.x, p.y, text, cls)
  }

  onEnemyKilled(e: Enemy): void {
    this.killCount++
    // summoned-while-alive enemies pay nothing: stalling a summoner must not be a gold farm
    if (!e.noReward) {
      const bounty = Math.max(1, Math.round(e.def.bounty * DIFFICULTIES[this.difficulty].bounty * (e.elite ? 1.6 : 1)))
      this.addGold(bounty, e.pos.x, e.pos.y + e.barY, e.pos.z)
      const shardGain = (e.def.shardDrop ?? 0) + (e.elite ? 1 : 0) + (e.def.boss ? 4 : 0)
      if (shardGain > 0) {
        this.shards += shardGain
        this.shardsEarned += shardGain
        this.floater(e.pos.x, e.pos.y + e.barY + 0.25, e.pos.z, `+${shardGain}${icon('gem')}`, 'shard')
        this.particles.magicImpact(e.pos.x, e.pos.y + 0.4, e.pos.z, 0x8fdfff)
      }
      if (this.hero && this.hero.alive && this.hero.group.position.distanceTo(e.pos) < (this.hero.ranged ? 2.5 : 1.7)) {
        this.hero.gainXp(e.def.bounty, this)
      }
      this.particles.coinBurst(e.pos.x, e.pos.y + 0.4, e.pos.z)
      this.sfx('coin', 0.5)
    }
    this.particles.deathPuff(e.pos.x, e.pos.y + 0.2, e.pos.z, 0x777788)
    this.sfx('die', 0.6)
    if (e.def.spawnOnDeath) {
      for (let i = 0; i < e.def.spawnOnDeath.count; i++) {
        // spill the brood behind the parent, never past the gate
        const d = Math.min(e.lane.length - 0.6, Math.max(0, e.dist + randRange(-0.5, 0.1)))
        this.spawnEnemyAt(e.def.spawnOnDeath.id, e.laneIndex, d, { waveTag: e.waveTag })
      }
    }
    // resolve AFTER the brood spawns so a wave can't complete twice
    this.resolveWaveEnemy(e, false)
    if (e.def.boss) this.engine.addShake(0.3)
  }

  onEnemyLeaked(e: Enemy): void {
    // a boss reaching the gate ends the defense outright
    this.lives = e.def.boss ? 0 : Math.max(0, this.lives - e.def.livesCost)
    this.defenseStreak = 0
    this.lastLeak = { name: e.def.name, wave: e.waveTag >= 0 ? e.waveTag + 1 : (this.waves?.waveIndex ?? 0) + 1 }
    this.resolveWaveEnemy(e, true)
    const end = e.lane.sample(e.lane.length - 0.1)
    this.particles.leakFlash(end.x, 0.6, end.z)
    this.sfx('leak', 0.9)
    this.engine.addShake(0.12)
    this.hud.pulseLives()
    if (this.lives <= 0 && this.phase === 'playing') this.endGame(false)
  }

  /** endless difficulty ramp; applies to every spawn, including brood/summons */
  private endlessHpScale(): number {
    if (!this.isEndless || !this.waves) return 1
    return 1 + Math.max(0, this.waves.waveIndex - 6) * 0.035
  }

  spawnEnemyAt(id: string, laneIndex: number, dist: number, opts: { surged?: boolean, eliteRoll?: boolean, hpScale?: number, waveTag?: number, noReward?: boolean } = {}): void {
    const def = enemyDef(id)
    // interaction enemies teach themselves the first time they appear
    if ((def.hexer || def.wardAura) && !this.mechanicsSeen.has(id)) {
      this.mechanicsSeen.add(id)
      this.hud.showToast(def.hexer
        ? 'A Hexling! It leaps onto a tower and silences it — shoot it off for a fat bounty.'
        : 'A Wardbearer! Its banner half-shields every foe ahead of it. Bring the bearer down first.', 7)
    }
    const surged = opts.surged ?? false
    const eliteChance = this.difficulty === 'veteran' ? 0.12 : this.isEndless ? 0.08 : 0
    const elite = (opts.eliteRoll ?? false) && !def.boss && Math.random() < eliteChance
    const e = new Enemy(def, this.lanes[laneIndex], laneIndex, dist, {
      hpMult: DIFFICULTIES[this.difficulty].enemyHp * (surged ? 1.3 : 1) * (opts.hpScale ?? this.endlessHpScale()),
      speedMult: surged ? 1.12 : 1,
      elite,
      surged,
      waveTag: opts.waveTag ?? -1,
      noReward: opts.noReward ?? false,
    })
    this.enemies.push(e)
    this.dynamic.add(e.group)
    if (e.waveTag >= 0) {
      const track = this.waveTracks.get(e.waveTag) ?? { spawned: 0, gone: 0, leaked: false }
      track.spawned++
      this.waveTracks.set(e.waveTag, track)
    }
  }

  /** wave promises: when every enemy of a wave is resolved, celebrate or mourn */
  private resolveWaveEnemy(e: Enemy, leaked: boolean): void {
    if (e.waveTag < 0 || !this.waves || !this.level) return
    const track = this.waveTracks.get(e.waveTag)
    if (!track) return
    track.gone++
    if (leaked) track.leaked = true
    const waveDoneSpawning = this.waves.waveIndex > e.waveTag || this.waves.phase !== 'spawning'
    if (waveDoneSpawning && track.gone >= track.spawned) {
      this.waveTracks.delete(e.waveTag)
      if (!track.leaked) {
        this.defenseStreak++
        this.bestStreak = Math.max(this.bestStreak, this.defenseStreak)
        this.perfectWaves++
        // streak pay scales harder now that campaigns run longer and capstones cost real gold
        const bonus = 4 + Math.min(12, this.defenseStreak * 2)
        this.addGold(bonus)
        const end = e.lane.sample(e.lane.length - 0.5)
        this.floater(end.x, 0.9, end.z, this.defenseStreak >= 2
          ? `Wave held! ${icon('flame')}×${this.defenseStreak} +${bonus}${icon('coin')}`
          : `Wave held! +${bonus}${icon('coin')}`, 'gold')
        if (this.defenseStreak > 0 && this.defenseStreak % 5 === 0) {
          this.hud.showBanner(`${this.defenseStreak} WAVES HELD!`, '')
        }
      }
    }
  }

  get surgeActive(): boolean {
    if (!this.waves || !this.level) return false
    const wave = this.level.waves[this.waves.waveIndex]
    if (wave?.surge && this.waves.phase === 'spawning') return true
    return this.enemies.some(e => e.surged && e.alive)
  }

  fireProjectile(spec: ProjectileSpec): void {
    const p = createProjectile(spec)
    this.projectiles.push(p)
    this.dynamic.add(p.mesh)
  }

  shake(strength: number): void { this.engine.addShake(strength) }

  towerDamageMult(kind: string): number {
    if (kind === 'arrow') return 1 + 0.08 * armoryTier(this.save, 'fletching')
    if (kind === 'mage') return 1 + 0.08 * armoryTier(this.save, 'arcane')
    return 1
  }

  splashMult(): number {
    return 1 + 0.12 * armoryTier(this.save, 'powder')
  }

  soldierHpMult(): number {
    return 1 + 0.15 * armoryTier(this.save, 'drill')
  }

  trapCooldownMult(): number {
    return 1 - 0.2 * armoryTier(this.save, 'runesmith')
  }

  findPath(fromX: number, fromZ: number, toX: number, toZ: number): THREE.Vector3[] | null {
    return this.terrain?.findPath(fromX, fromZ, toX, toZ) ?? null
  }

  meteorCooldown(): number {
    return METEOR_CD * (armoryTier(this.save, 'comet') > 0 ? 0.8 : 1)
  }

  // ---------------- level lifecycle ----------------

  /** slowly-orbiting diorama of the latest unlocked map, shown behind menus */
  showMenuBackdrop(): void {
    this.disposeLevel()
    const level = levels[Math.min(this.save.unlocked, levels.length) - 1]
    const paths = buildPaths(level)
    this.lanes = paths.lanes
    this.terrain = new Terrain(level, paths)
    this.level = level
    this.engine.scene.add(this.terrain.group)
    this.engine.scene.add(this.particles.group)
    this.engine.applyTheme(THEMES[level.theme], level.width, level.height)
    this.engine.resetView(level.width, level.height)
    this.engine.pitchGoal = 0.72
  }

  startLevel(level: LevelDef, difficulty: Difficulty = 'normal', heroId: HeroId = 'aldric', mode: 'campaign' | 'endless' = 'campaign'): void {
    this.disposeLevel()
    this.isEndless = mode === 'endless'
    this.level = this.isEndless ? { ...level, waves: generateEndlessWaves(level) } : level
    level = this.level
    this.difficulty = difficulty
    this.save.lastHero = heroId
    writeSave(this.save)
    this.goldEarned = 0
    this.shardsEarned = 0
    this.defenseStreak = 0
    this.bestStreak = 0
    this.perfectWaves = 0
    this.earlyCallSeconds = 0
    this.lastLeak = null
    this.waveTracks.clear()
    this.mechanicsSeen.clear()
    this.retiredKillers = []
    const paths = buildPaths(level)
    this.lanes = paths.lanes
    this.terrain = new Terrain(level, paths)
    this.engine.scene.add(this.terrain.group)
    this.engine.scene.add(this.dynamic)
    this.engine.scene.add(this.particles.group)
    this.engine.scene.add(this.rangeRing, this.selectRing, this.targetRing, this.heroRing, this.heroGuardRing)
    this.engine.applyTheme(THEMES[level.theme], level.width, level.height)
    this.engine.resetView(level.width, level.height)

    this.gold = level.startGold + 40 * armoryTier(this.save, 'coffers')
    this.shards = (level.startShards ?? 2) + 3 * armoryTier(this.save, 'prospector')
    this.lives = DIFFICULTIES[difficulty].lives
    this.speed = 1
    this.paused = false
    this.time = 0
    this.simAccumulator = 0
    this.killCount = 0
    this.abilities.meteor.cooldown = 0
    this.abilities.reinforce.cooldown = 0
    this.waves = new WaveManager(
      level,
      (id, lane) => this.spawnEnemyAt(id, lane, 0, {
        surged: level.waves[this.waves!.waveIndex]?.surge ?? false,
        eliteRoll: true,
        waveTag: this.waves!.waveIndex,
      }),
      (i) => {
        const isFinal = i === level.waves.length - 1
        const isSurge = level.waves[i]?.surge ?? false
        this.hud.showBanner(
          isFinal ? 'FINAL WAVE!' : isSurge ? 'VEILTIDE SURGE!' : `Wave ${i + 1}`,
          isFinal ? 'final' : isSurge ? 'surge' : '',
        )
        this.sfx('horn', 0.9)
        for (const m of this.terrain!.spawnMarkers) {
          this.particles.magicImpact(m.position.x, 0.8, m.position.z, isSurge ? 0xdd6bff : 0x9f5aff)
        }
      },
    )
    // the hero starts on the road, two thirds of the way to the gate
    const lane0 = this.lanes[0]
    const hs = lane0.sample(lane0.length * 0.62, 0.7)
    const heroDef = HERO_DEFS[heroId] ?? HERO_DEFS.aldric
    this.hero = new Hero(heroDef, new THREE.Vector3(hs.x, 0, hs.z))
    this.soldiers.push(this.hero)
    this.dynamic.add(this.hero.group)

    this.hazard = level.hazard ? createHazard(level.hazard, level.id) : null
    this.buildLanePreview()
    this.phase = 'playing'
    this.onPhaseChange('playing')
    this.hud.setSpeed(1)
    audio.init()
    audio.resume()
    audio.startMusic()
    if (level.intro) this.hud.showToast(level.intro, 5)
  }

  /** pre-battle route preview: colored dashes trace each road from its gate,
   *  with a runner gliding gate→keep, so multi-entry maps read at a glance */
  private buildLanePreview(): void {
    this.removeLanePreview()
    const colors = [0xffd23c, 0x7fd4ff, 0xdd6bff]
    const dashGeo = new THREE.PlaneGeometry(0.3, 0.3)
    dashGeo.rotateZ(Math.PI / 4)
    dashGeo.rotateX(-Math.PI / 2)
    const runnerGeo = new THREE.PlaneGeometry(0.55, 0.55)
    runnerGeo.rotateZ(Math.PI / 4)
    runnerGeo.rotateX(-Math.PI / 2)
    this.lanePreviewGeos.push(dashGeo, runnerGeo)
    const group = new THREE.Group()
    this.lanes.forEach((lane, li) => {
      const color = colors[li % colors.length]
      const dashMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, toneMapped: false, depthWrite: false })
      const runnerMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false })
      this.lanePreviewMats.push(dashMat, runnerMat)
      for (let d = 0.6; d < lane.length - 0.5; d += 0.85) {
        const p = lane.sample(d)
        const m = new THREE.Mesh(dashGeo, dashMat)
        m.position.set(p.x, 0.06, p.z)
        m.renderOrder = 2
        group.add(m)
      }
      const runner = new THREE.Mesh(runnerGeo, runnerMat)
      runner.renderOrder = 2
      group.add(runner)
      this.laneRunners.push({ mesh: runner, lane: li, phase: li * 1.3 })
    })
    this.lanePreview = group
    this.engine.scene.add(group)
  }

  private removeLanePreview(): void {
    if (this.lanePreview) this.engine.scene.remove(this.lanePreview)
    for (const g of this.lanePreviewGeos) g.dispose()
    for (const m of this.lanePreviewMats) m.dispose()
    this.lanePreview = null
    this.lanePreviewGeos = []
    this.lanePreviewMats = []
    this.laneRunners = []
  }

  private updateLanePreview(dt: number): void {
    if (!this.lanePreview || !this.waves) return
    if (this.waves.waveIndex < 0) {
      // grace period: runners glide the roads, gates pulse
      for (const r of this.laneRunners) {
        r.phase += dt * 2.4
        const lane = this.lanes[r.lane]
        const p = lane.sample(r.phase % lane.length)
        r.mesh.position.set(p.x, 0.08, p.z)
      }
      if (this.terrain) {
        this.terrain.spawnMarkers.forEach((m, i) => {
          m.scale.setScalar(1.35 * (1 + Math.sin(this.time * 3.2 + i * 1.7) * 0.07))
        })
      }
      return
    }
    // battle begun: the preview fades away
    let alive = false
    for (const m of this.lanePreviewMats) {
      m.opacity -= dt * 0.8
      if (m.opacity > 0.02) alive = true
    }
    if (!alive) {
      this.removeLanePreview()
      this.terrain?.spawnMarkers.forEach(m => m.scale.setScalar(1.35))
    }
  }

  disposeLevel(): void {
    audio.stopMusic()
    this.hazard?.dispose(this)
    this.hazard = null
    this.removeLanePreview()
    this.simAccumulator = 0
    this.level = null
    if (this.terrain) {
      this.engine.scene.remove(this.terrain.group)
      this.terrain.dispose()
      this.terrain = null
    }
    clearBurnZones(this)
    clearMines(this)
    clearRunes(this)
    for (const e of this.enemies) { this.dynamic.remove(e.group); disposeClonedMaterials(e.group) }
    for (const s of this.soldiers) { this.dynamic.remove(s.group); disposeClonedMaterials(s.group) }
    for (const p of this.projectiles) { this.dynamic.remove(p.mesh); p.dispose?.() }
    for (const t of this.towers) { t.dismantle(this, true); this.dynamic.remove(t.group) }
    for (const tr of this.traps) { this.dynamic.remove(tr.group); tr.dispose() }
    this.traps = []
    this.particles.clear()
    this.enemies = []
    this.soldiers = []
    this.towers = []
    this.projectiles = []
    this.pendingCasts = []
    this.engine.scene.remove(this.dynamic, this.particles.group)
    this.selectedTower = null
    this.selectedPlot = null
    this.selectedTrapSpot = null
    this.hero = null
    this.heroSelected = false
    this.targetMode = null
    this.surgeBlend = 0
    this.engine.setSurgeBlend(0)
    this.rangeRing.visible = this.selectRing.visible = this.targetRing.visible = this.heroRing.visible = this.heroGuardRing.visible = false
    this.phase = 'idle'
  }

  private endGame(won: boolean): void {
    if (this.phase !== 'playing') return
    this.phase = won ? 'victory' : 'defeat'
    this.targetMode = null
    this.hud.closeBuildMenu()
    this.hud.closeTowerPanel()
    // clear in-flight combat transients so nothing hangs frozen behind the end screen
    for (const p of this.projectiles) { this.dynamic.remove(p.mesh); p.dispose?.() }
    this.projectiles = []
    this.pendingCasts = []
    clearBurnZones(this)
    clearMines(this)
    clearRunes(this)
    this.hazard?.dispose(this)
    this.hazard = null
    audio.play(won ? 'victory' : 'defeat')
    audio.stopMusic()
    let stars = 0
    if (this.level) {
      // honest scoring: lives held, perfect waves, nerve (early calls), weighted by difficulty
      const diffMult = { casual: 0.8, normal: 1, veteran: 1.3 }[this.difficulty]
      const reached = this.waves ? this.waves.waveIndex + 1 : 0
      this.lastScore = Math.round((
        this.lives * 50 +
        this.perfectWaves * 120 +
        Math.round(this.earlyCallSeconds) * 2 +
        (this.isEndless ? reached * 60 : won ? 1000 : 0)
      ) * diffMult)
      const scoreKey = `${this.level.id}:${this.isEndless ? 'endless' : this.difficulty}`
      this.lastPrevBestScore = this.save.bestScore[scoreKey] ?? 0
      this.lastNewBestScore = this.lastScore > this.lastPrevBestScore
      if (this.lastNewBestScore) this.save.bestScore[scoreKey] = this.lastScore

      if (this.isEndless) {
        // endless: the wave record is the headline; ties are not new records
        const prevBestWave = this.save.bestEndless[this.level.id] ?? 0
        this.lastNewWaveRecord = reached > prevBestWave
        if (this.lastNewWaveRecord) this.save.bestEndless[this.level.id] = reached
      } else if (won) {
        const maxLives = DIFFICULTIES[this.difficulty].lives
        stars = this.lives >= maxLives * 0.88 ? 3 : this.lives >= maxLives * 0.5 ? 2 : 1
        const idx = levels.findIndex(l => l.id === this.level!.id)
        if (idx >= 0) this.save.unlocked = Math.max(this.save.unlocked, Math.min(idx + 2, levels.length))
        this.save.stars[this.level.id] = Math.max(this.save.stars[this.level.id] ?? 0, stars)
        // mastery medals
        const medals = new Set(this.save.medals[this.level.id] ?? [])
        if (this.difficulty === 'veteran') medals.add('veteran')
        if (this.lives === maxLives) medals.add('noleak')
        this.save.medals[this.level.id] = [...medals]
      }
      writeSave(this.save)
    }
    this.onPhaseChange(this.phase, stars)
  }

  private lastScore = 0
  private lastPrevBestScore = 0
  private lastNewBestScore = false
  private lastNewWaveRecord = false

  /** end-of-battle summary for the result screens */
  battleStats(): {
    kills: number, gold: number, shards: number, wavesReached: number, totalWaves: number,
    timeSec: number, heroLevel: number, endless: boolean, bestEndless: number,
    score: number, prevBestScore: number, newBestScore: boolean, newWaveRecord: boolean,
    perfectWaves: number, bestStreak: number, noleak: boolean,
    lastLeak: { name: string, wave: number } | null,
    topKiller: { name: string, kills: number } | null,
    heroKills: number,
  } {
    return {
      kills: this.killCount,
      gold: this.goldEarned,
      shards: this.shardsEarned,
      wavesReached: this.waves ? this.waves.waveIndex + 1 : 0,
      totalWaves: this.waves?.totalWaves ?? 0,
      timeSec: Math.round(this.time),
      heroLevel: this.hero?.level ?? 1,
      endless: this.isEndless,
      bestEndless: this.level ? (this.save.bestEndless[this.level.id] ?? 0) : 0,
      score: this.lastScore,
      prevBestScore: this.lastPrevBestScore,
      newBestScore: this.lastNewBestScore,
      newWaveRecord: this.lastNewWaveRecord,
      perfectWaves: this.perfectWaves,
      bestStreak: this.bestStreak,
      noleak: this.lives === DIFFICULTIES[this.difficulty].lives,
      lastLeak: this.lastLeak,
      topKiller: this.topKiller(),
      heroKills: this.hero?.kills ?? 0,
    }
  }

  /** sold buildings keep their place in history */
  private retiredKillers: { name: string, kills: number }[] = []

  /** the building with the most kills this battle (sold ones included) */
  private topKiller(): { name: string, kills: number } | null {
    let best: { name: string, kills: number } | null = null
    const consider = (name: string, kills: number) => {
      if (kills > (best?.kills ?? 0)) best = { name, kills }
    }
    for (const t of this.towers) consider(t.def.name, t.kills)
    for (const tr of this.traps) consider(tr.def.name, tr.kills)
    for (const r of this.retiredKillers) consider(r.name, r.kills)
    return best
  }

  // ---------------- interaction ----------------

  projectToScreen(x: number, y: number, z: number): { x: number, y: number } | null {
    const v = new THREE.Vector3(x, y, z).project(this.engine.camera)
    if (v.z > 1) return null
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    }
  }

  private rayFromScreen(sx: number, sy: number): void {
    this.raycaster.setFromCamera(
      new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1),
      this.engine.camera,
    )
  }

  groundPoint(sx: number, sy: number): THREE.Vector3 | null {
    this.rayFromScreen(sx, sy)
    const out = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(this.groundPlane, out) ? out : null
  }

  pickPlot(sx: number, sy: number): PlotInfo | null {
    if (!this.terrain) return null
    this.rayFromScreen(sx, sy)
    const meshes: THREE.Object3D[] = []
    for (const p of this.terrain.plots) if (!p.occupied) meshes.push(p.mesh)
    const hits = this.raycaster.intersectObjects(meshes, true)
    if (hits.length === 0) {
      // also allow clicking near the plot on the ground
      const g = this.groundPoint(sx, sy)
      if (g) {
        for (const p of this.terrain.plots) {
          if (!p.occupied && Math.hypot(g.x - p.pos.x, g.z - p.pos.z) < 0.55) return p
        }
      }
      return null
    }
    let obj: THREE.Object3D | null = hits[0].object
    while (obj) {
      const found = this.terrain.plots.find(p => p.mesh === obj)
      if (found) return found
      obj = obj.parent
    }
    return null
  }

  pickEnemy(sx: number, sy: number): Enemy | null {
    this.rayFromScreen(sx, sy)
    const groups = []
    for (const e of this.enemies) if (e.alive) groups.push(e.group)
    const hits = this.raycaster.intersectObjects(groups, true)
    if (hits.length === 0) return null
    let obj: THREE.Object3D | null = hits[0].object
    while (obj) {
      const found = this.enemies.find(e => e.group === obj)
      if (found) return found
      obj = obj.parent
    }
    return null
  }

  pickTower(sx: number, sy: number): Tower | null {
    this.rayFromScreen(sx, sy)
    const hits = this.raycaster.intersectObjects(this.towers.map(t => t.group), true)
    if (hits.length === 0) return null
    let obj: THREE.Object3D | null = hits[0].object
    while (obj) {
      const found = this.towers.find(t => t.group === obj)
      if (found) return found
      obj = obj.parent
    }
    return null
  }

  pickHero(sx: number, sy: number): boolean {
    if (!this.hero || this.hero.dead) return false
    this.rayFromScreen(sx, sy)
    return this.raycaster.intersectObject(this.hero.group, true).length > 0
  }

  selectHero(center = false): void {
    if (!this.hero || this.hero.dead) { if (this.hero?.dead) this.sfx('error'); return }
    this.clearSelection()
    this.heroSelected = true
    this.heroRing.visible = true
    this.hud.openHeroPanel(this.hero)
    if (center) {
      this.engine.focusOn(this.hero.group.position.x, this.hero.group.position.z)
    }
    this.sfx('click')
  }

  /** primary click routing */
  handleClick(sx: number, sy: number): void {
    if (this.phase !== 'playing' || this.paused) return
    if (this.targetMode) {
      const g = this.groundPoint(sx, sy)
      if (g) this.confirmTarget(g)
      return
    }
    if (this.pickHero(sx, sy)) { this.selectHero(); return }
    const tower = this.pickTower(sx, sy)
    if (tower) { this.selectTower(tower); return }
    const plot = this.pickPlot(sx, sy)
    if (plot) { this.selectPlot(plot, sx, sy); return }
    const trapSpot = this.pickTrapSpot(sx, sy)
    if (trapSpot) { this.selectTrapSpot(trapSpot, sx, sy); return }
    const trap = this.pickTrap(sx, sy)
    if (trap) {
      this.clearSelection()
      this.hud.openTrapPanel(trap)
      this.selectRing.visible = true
      this.selectRing.position.set(trap.group.position.x, 0.1, trap.group.position.z)
      this.sfx('click')
      return
    }
    const enemy = this.pickEnemy(sx, sy)
    if (enemy) {
      if (this.heroSelected && this.hero && !this.hero.dead) {
        this.hero.orderMove(enemy.pos.clone(), this)   // attack-move onto the target
      } else {
        this.hud.showEnemyTip(enemy, sx, sy)           // tap-to-inspect (touch has no hover)
      }
      return
    }
    if (this.heroSelected && this.hero && !this.hero.dead) {
      const g = this.groundPoint(sx, sy)
      if (g) {
        if (!this.hero.orderMove(g, this)) this.sfx('error')
        return
      }
    }
    this.clearSelection()
  }

  handleHover(sx: number, sy: number): string {
    if (this.phase !== 'playing') return 'default'
    if (this.targetMode) {
      const g = this.groundPoint(sx, sy)
      if (g) {
        this.targetRing.position.set(g.x, 0.03, g.z)
        this.targetRing.visible = true
        const valid = this.targetValid(g)
        ;(this.targetRing.material as THREE.MeshBasicMaterial).color.set(valid ? 0x7fff9f : 0xff5a5a)
      }
      return 'crosshair'
    }
    this.targetRing.visible = false
    if (this.pickHero(sx, sy)) { this.hud.hideEnemyTip(); return 'pointer' }
    const tower = this.pickTower(sx, sy)
    if (tower) { this.hud.hideEnemyTip(); return 'pointer' }
    const plot = this.pickPlot(sx, sy)
    this.hoverPlot = plot
    if (plot) { this.hud.hideEnemyTip(); return 'pointer' }
    if (this.pickTrapSpot(sx, sy) || this.pickTrap(sx, sy)) { this.hud.hideEnemyTip(); return 'pointer' }
    const enemy = this.pickEnemy(sx, sy)
    if (enemy) {
      this.hud.showEnemyTip(enemy, sx, sy)
      return 'help'
    }
    this.hud.hideEnemyTip()
    if (this.heroSelected) return 'crosshair'
    return 'default'
  }

  private targetValid(g: THREE.Vector3): boolean {
    if (this.targetMode === 'reinforce') {
      return this.lanes.some(l => l.distanceToPath(g.x, g.z) < 1.0)
    }
    if (this.targetMode === 'rally' && this.selectedTower) {
      return this.selectedTower.isValidRally(g.x, g.z, this)
    }
    return true
  }

  private confirmTarget(g: THREE.Vector3): void {
    const mode = this.targetMode
    if (!mode) return
    if (!this.targetValid(g)) { this.sfx('error'); return }
    switch (mode) {
      case 'meteor': {
        this.abilities.meteor.max = this.meteorCooldown()
        this.abilities.meteor.cooldown = this.abilities.meteor.max
        this.sfx('meteor')
        const count = METEOR_COUNT + (armoryTier(this.save, 'comet') > 0 ? 1 : 0)
        for (let i = 0; i < count; i++) {
          const at = g.clone().add(new THREE.Vector3(randRange(-0.8, 0.8), 0, randRange(-0.8, 0.8)))
          at.y = 0
          this.pendingCasts.push({
            at: this.time + i * 0.45,
            spec: { kind: 'meteor', at, damage: randRange(...METEOR_DAMAGE), world: this },
          })
        }
        break
      }
      case 'reinforce': {
        this.abilities.reinforce.cooldown = REINFORCE_CD
        this.sfx('reinforce')
        const def = towerTrees.barracks.levels[0].soldier!
        for (let i = 0; i < 2; i++) {
          const pos = g.clone().add(new THREE.Vector3(randRange(-0.25, 0.25), 0, randRange(-0.25, 0.25)))
          pos.y = 0
          const s = new Soldier(
            { ...def, name: 'Reinforcement', hp: Math.round(70 * this.soldierHpMult()), damage: [3, 6], model: 'reinforcement' },
            pos, pos,
          )
          s.expiresAt = this.time + 14
          this.soldiers.push(s)
          this.dynamic.add(s.group)
          this.particles.healSparkle(pos.x, 0.4, pos.z)
        }
        break
      }
      case 'rally': {
        this.selectedTower?.setRally(g.x, g.z, this)
        break
      }
    }
    this.targetMode = null
    this.targetRing.visible = false
    this.hud.setTargetMode(null)
  }

  setTargetMode(mode: TargetMode): void {
    if (this.paused && mode !== null) return
    if (mode === 'meteor' && this.abilities.meteor.cooldown > 0) { this.sfx('error'); return }
    if (mode === 'reinforce' && this.abilities.reinforce.cooldown > 0) { this.sfx('error'); return }
    this.targetMode = mode
    this.hud.setTargetMode(mode)
    if (mode) {
      this.hud.closeBuildMenu()
      if (mode !== 'rally') this.clearSelection()
    } else {
      this.targetRing.visible = false
    }
  }

  selectTower(tower: Tower): void {
    this.selectedPlot = null
    this.selectedTower = tower
    this.hud.closeBuildMenu()
    this.hud.openTowerPanel(tower)
    this.rangeRing.visible = true
    this.rangeRing.position.set(tower.pos.x, 0.04, tower.pos.z)
    this.rangeRing.scale.setScalar(tower.range)
    this.selectRing.visible = true
    this.selectRing.position.set(tower.pos.x, 0.05, tower.pos.z)
    this.sfx('click')
  }

  selectPlot(plot: PlotInfo, sx: number, sy: number): void {
    this.selectedTower = null
    this.hud.closeTowerPanel()
    this.selectedPlot = plot
    const screen = this.projectToScreen(plot.pos.x, plot.pos.y + 0.2, plot.pos.z)
    this.hud.openBuildMenu(plot, screen?.x ?? sx, screen?.y ?? sy)
    this.selectRing.visible = true
    this.selectRing.position.set(plot.pos.x, 0.12, plot.pos.z)
    this.rangeRing.visible = false
    this.sfx('click')
  }

  clearSelection(): void {
    this.selectedTower = null
    this.selectedPlot = null
    this.selectedTrapSpot = null
    this.heroSelected = false
    if (this.targetMode === 'rally') {
      // rally mode has no owner once its tower is deselected
      this.targetMode = null
      this.targetRing.visible = false
      this.hud.setTargetMode(null)
    }
    this.hud.closeBuildMenu()
    this.hud.closeTowerPanel()
    this.rangeRing.visible = false
    this.selectRing.visible = false
    this.heroRing.visible = false
    this.heroGuardRing.visible = false
  }

  /** preview range for a build option (hover in build menu) */
  previewRange(kind: TowerKind | null): void {
    if (!this.selectedPlot) return
    if (!kind) {
      if (!this.selectedTower) this.rangeRing.visible = false
      return
    }
    const def = towerTrees[kind].levels[0]
    this.rangeRing.visible = true
    this.rangeRing.position.set(this.selectedPlot.pos.x, 0.04, this.selectedPlot.pos.z)
    this.rangeRing.scale.setScalar(def.range)
  }

  buildTower(kind: TowerKind): void {
    if (this.paused) return
    const plot = this.selectedPlot
    if (!plot || plot.occupied) return
    const cost = towerTrees[kind].levels[0].cost
    if (this.gold < cost) { this.sfx('error'); this.hud.flashGold(); return }
    this.gold -= cost
    plot.occupied = true
    const tower = new Tower(kind, plot, this)
    this.towers.push(tower)
    this.dynamic.add(tower.group)
    this.recomputeResonance()
    this.particles.buildDust(plot.pos.x, plot.pos.y + 0.1, plot.pos.z)
    this.sfx('build')
    this.clearSelection()
    this.selectTower(tower)
  }

  // ---------------- traps ----------------

  pickTrapSpot(sx: number, sy: number): TrapSpotInfo | null {
    if (!this.terrain) return null
    const g = this.groundPoint(sx, sy)
    if (!g) return null
    for (const s of this.terrain.trapSpots) {
      if (!s.occupied && Math.hypot(g.x - s.pos.x, g.z - s.pos.z) < 0.52) return s
    }
    return null
  }

  selectTrapSpot(spot: TrapSpotInfo, sx: number, sy: number): void {
    this.clearSelection()
    this.selectedTrapSpot = spot
    const screen = this.projectToScreen(spot.pos.x, spot.pos.y + 0.15, spot.pos.z)
    this.hud.openTrapMenu(spot, screen?.x ?? sx, screen?.y ?? sy)
    this.selectRing.visible = true
    this.selectRing.position.set(spot.pos.x, 0.1, spot.pos.z)
    this.sfx('click')
  }

  buildTrap(kind: TrapKind): void {
    if (this.paused) return
    const spot = this.selectedTrapSpot
    if (!spot || spot.occupied) return
    const cost = TRAP_DEFS[kind].cost
    if (this.gold < cost) { this.sfx('error'); this.hud.flashGold(); return }
    this.gold -= cost
    spot.occupied = true
    spot.mesh.visible = false
    const trap = new Trap(kind, spot, this)
    this.traps.push(trap)
    this.dynamic.add(trap.group)
    this.sfx('build')
    this.clearSelection()
  }

  sellTrap(trap: Trap): void {
    if (this.paused) return
    if (trap.kills > 0) this.retiredKillers.push({ name: trap.def.name, kills: trap.kills })
    const refund = Math.round(trap.def.cost * 0.6)
    this.addGold(refund, trap.group.position.x, 0.4, trap.group.position.z)
    this.goldEarned -= refund  // refunds are not earnings
    trap.spot.occupied = false
    trap.spot.mesh.visible = true
    this.dynamic.remove(trap.group)
    trap.dispose()
    const i = this.traps.indexOf(trap)
    if (i >= 0) this.traps.splice(i, 1)
    this.sfx('sell')
    this.clearSelection()
  }

  pickTrap(sx: number, sy: number): Trap | null {
    const g = this.groundPoint(sx, sy)
    if (!g) return null
    for (const t of this.traps) {
      if (Math.hypot(g.x - t.group.position.x, g.z - t.group.position.z) < 0.5) return t
    }
    return null
  }

  /** per-theme atmosphere: snowfall, embers, fireflies, void motes */
  private ambientWeather(dt: number): void {
    if (!this.level) return
    const w = this.level.width, h = this.level.height
    const rx = () => (Math.random() - 0.5) * w * 0.9
    const rz = () => (Math.random() - 0.5) * h * 0.9
    switch (this.level.theme) {
      case 'winter':
        if (Math.random() < dt * 26) {
          this.particles.normal.emit({
            x: rx(), y: 3.2 + Math.random() * 2, z: rz(), count: 1,
            color: 0xffffff, speed: 0.06, gravity: 0.55, drag: 0.2,
            life: 5.5, lifeVar: 0.2, size: 0.14, sizeEnd: 0.12, dirY: 0.1, spread: 0.3,
          })
        }
        break
      case 'ember':
        if (Math.random() < dt * 10) {
          this.particles.add.emit({
            x: rx(), y: 0.1, z: rz(), count: 1,
            color: [0xff8c42, 0xffd23c], speed: 0.12, gravity: -0.5, drag: 0.3,
            life: 3.2, size: 0.12, sizeEnd: 0.05, dirY: 0.9, spread: 0.3,
          })
        }
        break
      case 'swamp':
        if (Math.random() < dt * 8) {
          this.particles.add.emit({
            x: rx(), y: 0.3 + Math.random() * 0.5, z: rz(), count: 1,
            color: [0xc9ff8f, 0x8fdf6f], speed: 0.08, gravity: -0.06, drag: 0.1,
            life: 4.5, size: 0.1, sizeEnd: 0.02, dirY: 0.5, spread: 0.25,
          })
        }
        break
      case 'void':
        if (Math.random() < dt * 12) {
          this.particles.add.emit({
            x: rx(), y: 0.1, z: rz(), count: 1,
            color: [0xb37aff, 0x8fdfff], speed: 0.1, gravity: -0.35, drag: 0.15,
            life: 4, size: 0.11, sizeEnd: 0.03, dirY: 0.85, spread: 0.3,
          })
        }
        break
      default:
        // forest: drifting pollen/petals in the sun
        if (Math.random() < dt * 5) {
          this.particles.normal.emit({
            x: rx(), y: 1.2 + Math.random() * 1.5, z: rz(), count: 1,
            color: [0xfff2c8, 0xe8a8c9], speed: 0.1, gravity: 0.12, drag: 0.1,
            life: 5, size: 0.09, sizeEnd: 0.07, dirY: 0.3, spread: 0.3,
          })
        }
    }
  }

  /** resonance: same-family neighbors buff each other (recomputed on build/sell) */
  recomputeResonance(): void {
    for (const t of this.towers) {
      let n = 0
      for (const o of this.towers) {
        if (o !== t && o.kind === t.kind && o.pos.distanceTo(t.pos) < 2.3) n++
      }
      t.resonance = Math.min(2, n)
      t.refreshSoldierStats(this)  // live soldiers pick up the change immediately
    }
  }

  upgradeTower(tower: Tower, optionIndex: number): void {
    if (this.paused) return
    const opt = tower.upgradeOptions[optionIndex]
    if (!opt) return
    if (this.gold < opt.cost) { this.sfx('error'); this.hud.flashGold(); return }
    this.gold -= opt.cost
    tower.upgrade(tower.level === 3 ? optionIndex : 0, this)
    this.selectTower(tower)
  }

  sellTower(tower: Tower): void {
    if (this.paused) return
    if (tower.kills > 0) this.retiredKillers.push({ name: tower.def.name, kills: tower.kills })
    this.addGold(tower.sellValue, tower.pos.x, tower.pos.y + 0.6, tower.pos.z)
    this.goldEarned -= tower.sellValue  // refunds are not earnings
    tower.plot.occupied = false
    clearOwnedEffects(this, tower)
    tower.dismantle(this)
    this.dynamic.remove(tower.group)
    const i = this.towers.indexOf(tower)
    if (i >= 0) this.towers.splice(i, 1)
    this.recomputeResonance()
    this.particles.buildDust(tower.pos.x, tower.pos.y + 0.1, tower.pos.z)
    this.sfx('sell')
    this.clearSelection()
  }

  overchargeTower(tower: Tower): void {
    if (this.paused) return
    if (!tower.canOvercharge(this)) { this.sfx('error'); return }
    this.shards -= OVERCHARGE_SHARD_COST
    tower.overcharge(this)
    this.selectTower(tower)
  }

  ascendTower(tower: Tower, perkIndex: 0 | 1): void {
    if (this.paused) return
    if (tower.level < 4 || tower.perk !== null) return
    if (this.shards < ASCEND_SHARD_COST || this.gold < ASCEND_GOLD_COST) {
      this.sfx('error'); this.hud.flashGold(); return
    }
    this.shards -= ASCEND_SHARD_COST
    this.gold -= ASCEND_GOLD_COST
    tower.ascend(perkIndex, this)
    this.selectTower(tower)
  }

  callWave(): void {
    if (!this.waves || this.phase !== 'playing' || this.paused) return
    const secondsLeft = this.waves.countdown
    const surgeNext = this.waves.nextWaveIsSurge()
    const bonus = this.waves.callNext()
    if (bonus > 0) {
      this.addGold(bonus)
      this.earlyCallSeconds += Math.max(0, secondsLeft)
      this.hud.spawnFloater(window.innerWidth / 2, 120, `+${bonus} early call!`, 'gold')
      // the Veiltide wager: defy a surge with nerve to spare, earn a shard
      if (surgeNext && secondsLeft >= 8) {
        this.shards += 1
        this.shardsEarned += 1
        this.hud.spawnFloater(window.innerWidth / 2, 156, `Veiltide defied! +1${icon('gem')}`, 'shard')
        this.sfx('crit', 0.8)
      }
    }
  }

  togglePause(): void {
    this.paused = !this.paused
    this.hud.setPaused(this.paused)
  }

  toggleSpeed(): void {
    if (this.paused) return
    this.speed = this.speed === 1 ? 2 : 1
    this.hud.setSpeed(this.speed)
  }

  toggleSfx(): void {
    this.save.sfxMuted = !this.save.sfxMuted
    audio.setMuted(this.save.sfxMuted)
    writeSave(this.save)
  }

  toggleMusic(): void {
    this.save.musicMuted = !this.save.musicMuted
    audio.setMusicMuted(this.save.musicMuted)
    writeSave(this.save)
  }

  // ---------------- main update ----------------

  private simAccumulator = 0

  update(dtRaw: number): void {
    this.engine.updateCamera(dtRaw)
    this.cameraQuat.copy(this.engine.camera.quaternion)
    this.terrain?.update(dtRaw)

    // Veiltide lighting: ease toward violet while a surge is on the field
    const surgeTarget = this.phase === 'playing' && this.surgeActive ? 1 : 0
    if (Math.abs(this.surgeBlend - surgeTarget) > 0.002) {
      this.surgeBlend += (surgeTarget - this.surgeBlend) * Math.min(1, dtRaw * 1.6)
      this.engine.setSurgeBlend(this.surgeBlend)
    }

    if (this.phase === 'playing' && !this.paused) {
      // fixed-timestep simulation so game speed is frame-rate independent;
      // budget covers a 0.1s frame at 2x speed (12 steps) before slowing down
      const H = 1 / 60
      this.simAccumulator = Math.min(this.simAccumulator + dtRaw * this.speed, H * 14)
      while (this.simAccumulator >= H && this.phase === 'playing') {
        this.simAccumulator -= H
        this.simStep(H)
      }
      // selection ring pulse
      if (this.selectRing.visible) {
        const s = 0.62 + Math.sin(this.time * 5) * 0.04
        this.selectRing.scale.setScalar(this.selectedTower ? s : s * 0.9)
      }
      if (this.heroSelected && this.hero) {
        if (this.hero.dead) {
          this.heroRing.visible = false
          this.heroGuardRing.visible = false
        } else {
          this.heroRing.visible = true
          this.heroRing.position.set(this.hero.group.position.x, 0.04, this.hero.group.position.z)
          this.heroRing.scale.setScalar(1.15 + Math.sin(this.time * 5) * 0.08)
          // guard radius: where the hero will engage (his post for melee, himself for ranged)
          const anchor = this.hero.ranged ? this.hero.group.position : this.hero.home
          this.heroGuardRing.visible = true
          this.heroGuardRing.position.set(anchor.x, 0.03, anchor.z)
          this.heroGuardRing.scale.setScalar(this.hero.guardRange)
        }
      }
      this.updateLanePreview(dtRaw)
    } else if (this.phase !== 'playing') {
      // menu/end-screen ambience; backdrop dioramas drift slowly with weather
      if (this.phase === 'idle' && this.terrain) {
        this.engine.yawGoal += dtRaw * 0.045
        if (this.level) this.ambientWeather(Math.min(dtRaw, 0.05))
      }
      this.particles.update(Math.min(dtRaw, 0.05))
    }

    this.hud?.refresh(this)
    this.engine.render()
  }

  private simStep(dt: number): void {
    this.time += dt
    this.waves!.update(dt)

    for (const e of this.enemies) {
      e.update(dt, this)
      if (this.phase !== 'playing') return  // a leak ended the game mid-step
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].state === 'gone') {
        this.dynamic.remove(this.enemies[i].group)
        disposeClonedMaterials(this.enemies[i].group)
        this.enemies.splice(i, 1)
      }
    }
    for (const s of this.soldiers) s.update(dt, this)
    for (let i = this.soldiers.length - 1; i >= 0; i--) {
      const s = this.soldiers[i]
      if (s.dead && s.expiresAt !== null) {
        this.dynamic.remove(s.group)
        disposeClonedMaterials(s.group)
        this.soldiers.splice(i, 1)
      }
    }
    for (const t of this.towers) t.update(dt, this)
    for (const tr of this.traps) tr.update(dt, this)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]
      p.update(dt)
      if (p.done) {
        this.dynamic.remove(p.mesh)
        p.dispose?.()
        this.projectiles.splice(i, 1)
      }
    }
    updateBurnZones(dt, this)
    updateMines(dt, this)
    updateRunes(dt, this)
    this.hazard?.update(dt, this)
    for (let i = this.pendingCasts.length - 1; i >= 0; i--) {
      if (this.pendingCasts[i].at <= this.time) {
        this.fireProjectile(this.pendingCasts[i].spec)
        this.pendingCasts.splice(i, 1)
      }
    }
    this.abilities.meteor.cooldown = Math.max(0, this.abilities.meteor.cooldown - dt)
    this.abilities.reinforce.cooldown = Math.max(0, this.abilities.reinforce.cooldown - dt)
    this.ambientWeather(dt)
    this.particles.update(dt)

    // victory check (a same-frame leak may already have ended the game)
    if (this.phase === 'playing' && this.waves!.allSpawned && this.enemies.length === 0 && this.pendingCasts.length === 0) {
      this.endGame(true)
    }
  }
}

function makeRing(radius: number, color: number, opacity: number): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.93, radius, 48)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 3
  return mesh
}
