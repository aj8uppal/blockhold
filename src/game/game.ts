import * as THREE from 'three'
import { Engine } from '../core/engine.ts'
import { audio, SfxName } from '../core/audio.ts'
import { loadSave, writeSave, SaveData } from '../core/save.ts'
import {
  LevelDef, TowerKind, Difficulty, DIFFICULTIES, HeroId, TrapKind, TRAP_DEFS,
  OVERCHARGE_SHARD_COST, ASCEND_SHARD_COST, ASCEND_GOLD_COST, PERKS,
} from './types.ts'
import { Trap, TrapSpotInfo } from './traps.ts'
import { Earthwork, EARTHWORK_DEFS, RAMPART_REACH, type EarthworkSpot } from './earthworks.ts'
import { Hazard, createHazard } from './hazards.ts'
import { enemyDef } from './enemyDefs.ts'
import { towerTrees, SELL_REFUND } from './towerDefs.ts'
import { tallestLandmark } from '../voxel/models_env.ts'
import { reactionFor, REACTION_RADIUS } from './towers.ts'
import { buildPaths, LanePath } from './path.ts'
import { disposeClonedMaterials, buildModel } from '../voxel/builder.ts'
import { holdModel, holdPieces, holdCacheKey, holdSummary } from './hold.ts'
import { isNotable } from './dossier.ts'
import { AFFIX_IDS } from './affixes.ts'
import { difficultyMods } from './difficulty.ts'
import { battleXp, isUnlocked, levelForXp, unlocksBetween, type UnlockDef } from './progress.ts'
import { campaignScale } from './balanceModel.ts'
import { OnboardingDirector } from './onboarding.ts'
import { HERO_RANK_MAX, heroRankCost } from './hero.ts'
import { levels, generateEndlessWaves, generateFreeplayChunk, ladderRung } from './levels.ts'
import { Terrain, PlotInfo, THEMES } from './terrain.ts'
import { Particles } from './particles.ts'
import { Enemy, Soldier } from './units.ts'
import { Hero, HERO_DEFS } from './hero.ts'
import { Tower } from './towers.ts'
import { WaveManager } from './waves.ts'
import { World, ProjectileSpec } from './world.ts'
import { Projectile, createProjectile, updateBurnZones, clearBurnZones, updateMines, clearMines, updateRunes, clearRunes, clearOwnedEffects } from './projectiles.ts'
import { armoryTier, hasArmory } from './armory.ts'
import type { HUD } from '../ui/hud.ts'
import { icon } from '../ui/icons.ts'
import { randRange, simChance, setSimSeed, pick } from '../core/utils.ts'
import { newRunSeed, runStamp, RULESET_VERSION, type RunStamp } from './ruleset.ts'
import { writeCheckpoint, clearCheckpoint, readCheckpoint, type Checkpoint } from './checkpoint.ts'
import { ReplayLog } from './replay.ts'
import { canRecordTape, capturePostcard, recordVerticalTape } from '../core/capture.ts'
import { attachDebris, shatter, updateDebris, clearDebris, type DeathFlavor } from './debris.ts'
import { telemetry } from '../core/telemetry.ts'
import type { DailyResult } from './share.ts'

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
  /** the seed this run was simulated from; reproduces the battle exactly */
  runSeed = 0
  shards = 0
  traps: Trap[] = []
  earthworks: Earthwork[] = []
  replay = new ReplayLog()
  /**
   * The Three Watches: one short siege, fought three times over. Each watch
   * your previous defense returns as translucent echoes that still fight, so
   * by the third you are standing behind two earlier versions of your own
   * plan. Replay becomes a single-player mechanic rather than a spectator one.
   */
  /** the Bellfoundry: shots that land on the beat ring out and hit harder */
  isBellfoundry = false
  isWatches = false
  /**
   * Holding the line past a map's last authored wave. Not the Long Night:
   * that starts from an empty board, this keeps the one the player built.
   * Its own flag because `isEndless` decides health scaling, XP, score keys,
   * checkpoints and the result card, and freeplay wants different answers to
   * most of those.
   */
  isFreeplay = false
  watchIndex = 0
  private ghostLayers: { plot: number, kind: TowerKind, level: number, branch: 0 | 1 | null }[][] = []
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
  selectedEarthSpot: EarthworkSpot | null = null
  selectedEarthwork: Earthwork | null = null
  private rampartRing!: THREE.Mesh

  /** the towers a rampart standing at this point lifts onto the high ground */
  private liftedBy(x: number, z: number): Tower[] {
    return this.towers.filter(t => Math.hypot(t.pos.x - x, t.pos.z - z) <= RAMPART_REACH)
  }

  private clearLiftMarkers(): void {
    for (const t of this.towers) t.showLift(false)
    this.rampartRing.visible = false
  }
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
  private upgradeRing: THREE.Mesh
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
    this.upgradeRing = makeRing(1, 0x8fff9f, 0.42)
    // the reach a rampart would have, drawn at its site before any gold is spent
    this.rampartRing = makeRing(1, 0xe8c24a, 0.5)
    this.rampartRing.scale.setScalar(RAMPART_REACH)
    this.rampartRing.visible = false
    this.selectRing = makeRing(1, 0xffe89f, 0.5)
    this.selectRing.scale.setScalar(0.62)
    this.targetRing = makeRing(1.15, 0xff8c42, 0.5)
    this.heroRing = makeRing(0.42, 0x7fd4ff, 0.7)
    this.heroGuardRing = makeRing(1, 0x7fd4ff, 0.2)
    this.rangeRing.visible = this.upgradeRing.visible = this.selectRing.visible = this.targetRing.visible = this.heroRing.visible = this.heroGuardRing.visible = false
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
      // the live bar climbs with every kill; freeplay only counts past the end
      if (e.waveTag >= 0 && (!this.isFreeplay || e.waveTag >= (this.waves?.authoredWaves ?? 0))) {
        const gain = this.killXp(e.waveTag)
        this.liveXp += gain
        this.hud.xpTick(gain)
      }
      const premium = this.tithePremium(e.pos.x, e.pos.z)
      const eliteMult = e.elite ? 1.6 * (1 + 0.25 * armoryTier(this.save, 'bountyhunter')) : 1
      const bounty = Math.max(1, Math.round(e.def.bounty * this.mods().bounty * eliteMult * premium))
      this.addGold(bounty, e.pos.x, e.pos.y + e.barY, e.pos.z)
      let shardGain = (e.def.shardDrop ?? 0) + (e.elite ? 1 : 0) + (e.def.boss ? 4 : 0)
      // the Exchequer: a shard for every twelfth kill made in its light
      if (premium > 1 && this.towers.some(b => b.def.signature === 'tithe'
        && Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) <= b.auraReach)) {
        if (++this.titheKills >= 12) { this.titheKills = 0; shardGain += 1 }
      }
      if (shardGain > 0) {
        this.shards += shardGain
        this.shardsEarned += shardGain
        this.floater(e.pos.x, e.pos.y + e.barY + 0.25, e.pos.z, `+${shardGain}${icon('gem')}`, 'shard')
        this.particles.magicImpact(e.pos.x, e.pos.y + 0.4, e.pos.z, 0x8fdfff)
      }
      if (this.hero && this.hero.alive && this.hero.group.position.distanceTo(e.pos) < (this.hero.ranged ? 2.5 : 1.7)) {
        this.hero.gainXp(e.def.bounty, this)
      }
      // the payment lands a beat after the kill, so the death reads first
      const cx = e.pos.x, cy = e.pos.y + 0.4, cz = e.pos.z
      this.deferFx(0.12, () => {
        this.particles.coinBurst(cx, cy, cz)
        this.sfx('coin', 0.5)
      })
    }
    this.particles.deathPuff(e.pos.x, e.pos.y + 0.2, e.pos.z, 0x777788)
    this.sfx('die', 0.6)
    // The Ossuary: what dies in its shadow stands back up, once, as a Husk that
    // pays nothing. `raised` stops a raised thing rising twice, `noReward`
    // stops the boss being a gold farm, and bosses themselves never rise.
    if (!e.def.boss && !e.raised) {
      const bone = this.enemies.find(b => b.alive && b.def.raises
        && Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) <= b.def.raises.radius)
      if (bone) {
        const rx = e.pos.x, rz = e.pos.z, lane = e.laneIndex, dist = e.dist, tag = e.waveTag
        this.deferFx(0.7, () => {
          if (!bone.alive) return
          this.particles.magicImpact(rx, 0.4, rz, 0x8fe08a)
          this.spawnEnemyAt(bone.def.raises!.id, lane, Math.max(0, dist), { waveTag: tag, noReward: true, raised: true })
        })
      }
    }
    // weight the moment: a fodder kill must not feel like a boss falling
    this.impact(e.def.boss ? 'boss' : e.elite ? 'elite' : 'light')
    if (!e.def.boss) this.engine.addShake(e.elite ? 0.09 : 0.035)
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
    // Gate Ward absorbs the first leak of a battle outright (never a boss)
    if (!e.def.boss && !this.gateWardSpent && hasArmory(this.save, 'bulwark')) {
      this.gateWardSpent = true
      this.hud.showToast('Gate Ward holds — that one cost you nothing', 2.6)
      this.sfx('lightning', 0.7)
      this.defenseStreak = 0
      this.resolveWaveEnemy(e, true)
      return
    }
    // A boss at the gate ends the defense outright - unless the Veilward holds,
    // in which case it costs ten lives and the battle goes on. The old code set
    // lives straight to zero for a boss rather than charging its nominal cost,
    // so "how many lives does a boss take" has to be answered here explicitly.
    const warded = e.def.boss && hasArmory(this.save, 'veilward')
    const cost = e.def.boss ? (warded ? 10 : this.lives) : e.def.livesCost
    const fatal = this.lives - cost <= 0
    if (fatal) this.engine.cinematic(e.pos.x, e.pos.z, 9, 2.4, 0.7)
    else if (warded) this.hud.showToast('The Veilward holds - the gate stands, at a price', 3)
    this.lives = Math.max(0, this.lives - cost)
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
  /**
   * The Long Night's escalation.
   *
   * The enemy pool caps at wave 16 and group counts cap at 18, so past wave 20
   * the only things still moving were counts and HP - quantity inflation with
   * no new tactical problem. HP still climbs, but every tenth wave now also
   * hardens the horde: armor and resistance creep up in bands, so a defense
   * that never changes its damage types stops working even though it is
   * killing the same creatures.
   */
  private endlessHpScale(): number {
    if (!this.isEndless || !this.waves) return 1
    const w = this.waves.waveIndex
    // compounding rather than linear, so wave 80 is genuinely a wall
    return (1 + Math.max(0, w - 6) * 0.035) * (1 + Math.max(0, w - 30) * 0.012)
  }

  /**
   * Campaign escalation. Measured across all seven maps, every one front-loaded
   * its tension and then decayed to roughly a third of it - the finale of the
   * 28-wave map was easier than its opening, because affordable damage grows
   * far faster than the authored waves do. Enemies harden as a map goes on so
   * the curve stays a curve.
   */
  private campaignHpScale(): number {
    if (this.isEndless || this.isDaily || !this.waves || !this.level) return 1
    // past the authored end the campaign ramp is frozen at its final value;
    // freeplayHpScale carries on from there
    const n = this.level.waves.length
    return campaignScale(Math.min(n - 1, Math.max(0, this.waves.waveIndex)), n)
  }

  /**
   * Freeplay's escalation, normalised so the first wave past the authored end
   * is no harder than the last authored one, and every wave after climbs on
   * the Long Night's curve from that point:
   *
   *   endlessScale(authored + depth) / endlessScale(authored - 1)
   *
   * Without the division the handover would be a cliff on long maps, where
   * the Long Night's curve is already steep by wave 30.
   */
  private freeplayHpScale(): number {
    if (!this.isFreeplay || !this.waves) return 1
    const authored = this.waves.authoredWaves
    const at = (w: number) => (1 + Math.max(0, w - 6) * 0.035) * (1 + Math.max(0, w - 30) * 0.012)
    return at(this.waves.waveIndex) / at(Math.max(0, authored - 1))
  }

  /** the mode a difficulty is resolved for; freeplay keeps the campaign's per-map bite */
  private modeKey(): 'campaign' | 'endless' | 'freeplay' {
    return this.isEndless ? 'endless' : this.isFreeplay ? 'freeplay' : 'campaign'
  }

  /** deep-endless hardening: 0 until wave 20, then bands of armor/resist */
  private endlessToughness(): number {
    if (!this.isEndless || !this.waves) return 0
    return Math.min(0.35, Math.max(0, Math.floor((this.waves.waveIndex - 20) / 10)) * 0.07)
  }

  /**
   * How often a spawn is a named elite. One definition, read both by the roll
   * below and by the wave preview that warns about it - they used to be able to
   * disagree, and a preview that lies is worse than no preview.
   */
  eliteChance(): number {
    return this.mods().eliteChance
  }

  /** what this difficulty means on this map; the one source every consumer reads */
  mods() {
    return difficultyMods(this.level?.id ?? null, this.difficulty, this.modeKey())
  }

  spawnEnemyAt(id: string, laneIndex: number, dist: number, opts: { surged?: boolean, eliteRoll?: boolean, hpScale?: number, waveTag?: number, noReward?: boolean, hpMult?: number, affix?: string, raised?: boolean } = {}): void {
    const def = enemyDef(id)
    // interaction enemies teach themselves the first time they appear
    // First meeting with anything notable: stop, explain it, and never
    // interrupt for that enemy again. A boss camera move is arresting once and
    // irritating by the fourth Juggernaut.
    const firstMeeting = isNotable(def) && !this.save.seenEnemies.includes(id)
    if (firstMeeting) {
      this.save.seenEnemies.push(id)
      writeSave(this.save)
      this.mechanicsSeen.add(id)
      if (!this.paused) {
        this.paused = true
        this.hud.showDossier(def, () => { this.paused = false })
      }
    }
    const surged = opts.surged ?? false
    const elite = (opts.eliteRoll ?? false) && !def.boss && simChance(this.eliteChance())
    // Which elite this is, drawn from the same seeded stream as the roll that
    // made it one. A daily and a challenge link are only the same fight if the
    // affixes match, so this must never reach for Math.random. An Ascendant
    // boss arrives with its affix named by the ladder rather than rolled.
    const ladderAffix = opts.affix && AFFIX_IDS.includes(opts.affix as never) ? opts.affix as typeof AFFIX_IDS[number] : null
    const affix = ladderAffix ?? (elite ? pick(AFFIX_IDS) : null)
    const hpScale = opts.hpScale ?? (this.endlessHpScale() * this.freeplayHpScale())
    const e = new Enemy(def, this.lanes[laneIndex], laneIndex, dist, {
      hpMult: this.mods().enemyHp * (surged ? 1.3 : 1)
        * hpScale * this.campaignHpScale() * (opts.hpMult ?? 1),
      toughness: this.endlessToughness(),
      speedMult: surged ? 1.12 : 1,
      elite: elite || !!ladderAffix,
      affix,
      surged,
      waveTag: opts.waveTag ?? -1,
      noReward: opts.noReward ?? false,
      raised: opts.raised ?? false,
    })
    e.phaseHpScale = hpScale
    this.enemies.push(e)
    this.dynamic.add(e.group)
    // stage a boss's arrival the first time the player ever sees it; after
    // that they know what it is and the camera should stay out of the way
    if (def.boss && this.phase === 'playing' && firstMeeting) {
      this.engine.cinematic(e.pos.x, e.pos.z, 8.5, 2.0, 0.72)
      this.engine.addShake(0.16)
      this.impact('heavy')
    } else if (def.boss && this.phase === 'playing') {
      this.hud.showBanner(`${def.name.toUpperCase()}`, 'final')
      this.engine.addShake(0.12)
    }
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
    if (leaked) { track.leaked = true; this.waveOutcomes[e.waveTag] = 'leaked' }
    const waveDoneSpawning = this.waves.waveIndex > e.waveTag || this.waves.phase !== 'spawning'
    if (waveDoneSpawning && track.gone >= track.spawned) {
      this.waveTracks.delete(e.waveTag)
      if (!track.leaked) {
        this.defenseStreak++
        this.bestStreak = Math.max(this.bestStreak, this.defenseStreak)
        this.perfectWaves++
        // streak pay scales harder now that campaigns run longer and capstones cost real gold
        // A wave held is the game's most frequent reward, and it paid so
        // little that players did not notice it. It scales with how deep the
        // battle is now, so late waves pay something a tower could be built
        // from, on top of the streak.
        const waveNo = e.waveTag + 1
        const bonus = 10 + waveNo * 3 + Math.min(24, this.defenseStreak * 4)
        this.addGold(bonus)
        const end = e.lane.sample(e.lane.length - 0.5)
        this.floater(end.x, 0.9, end.z, this.defenseStreak >= 2
          ? `Wave held! ${icon('flame')}×${this.defenseStreak} +${bonus}${icon('coin')}`
          : `Wave held! +${bonus}${icon('coin')}`, 'gold')
        this.waveOutcomes[e.waveTag] = 'held'
        // the wave's full worth, whatever the per-kill trickle rounded away
        if (!this.isFreeplay || e.waveTag >= this.waves.authoredWaves) {
          const wave = this.waves.waveAt(e.waveTag)
          const planned = wave ? wave.groups.reduce((n, g) => n + g.count, 0) : 0
          const paid = planned > 0 ? track.spawned * this.killXp(e.waveTag) : 0
          const topUp = Math.max(0, this.waveXpValue() - paid)
          if (topUp > 0.01) { this.liveXp += topUp; this.hud.xpTick(topUp) }
        }
        telemetry.track({ type: 'wave_cleared', level: this.level.id, wave: e.waveTag + 1, lives: this.lives, leaked: false })
        if (this.defenseStreak > 0 && this.defenseStreak % 5 === 0) {
          // this is the unbroken streak, not the wave number: saying "15 WAVES
          // HELD" on wave 19 reads as a miscount rather than a streak
          this.hud.showBanner(`${this.defenseStreak} WAVES IN A ROW!`, '')
        }
      }
    }
  }

  /**
   * Snapshot only when the board is genuinely quiet - no live enemies, no
   * projectiles, not mid-spawn. There is nothing transient to serialise at
   * that moment, so a resumed battle is exactly the one the player left.
   *
   * Waves in this game deliberately overlap, so quiet moments are not
   * guaranteed every wave - the long breaks after bosses are the reliable
   * ones. A resume therefore returns to the last clean boundary rather than
   * the exact moment of interruption, which is still far better than losing
   * a twenty-minute run to a closed tab.
   */
  private checkpointT = 0
  private firstBuildAt = -1
  /** true once the player has issued a hero move order, for onboarding */
  heroHasMoved = false
  private onboarding: OnboardingDirector | null = null
  /** per-wave result, in order, for the shareable daily block */
  waveOutcomes: ('held' | 'leaked')[] = []
  isDaily = false
  dailyDay = 0
  private maybeCheckpoint(): void {
    if (this.phase !== 'playing' || !this.level || !this.waves) return
    // Only campaign and endless boards can be resumed. The Daily, the Watches
    // and the Bellfoundry all run on `dailyLevel()`, whose id is `daily` and is
    // not in `levels` - checkpointing one put a "Resume battle" button on the
    // menu that threw out of `levelById` the moment it was pressed. They are
    // also short, seeded and repeatable, so there is nothing worth saving.
    if (this.isDaily || this.isWatches || this.isBellfoundry || this.isFreeplay) return
    if (this.enemies.some(e => e.alive) || this.projectiles.length) return
    if (this.waves.phase === 'spawning') return
    const waveIndex = this.waves.waveIndex + 1
    if (waveIndex < 1 || waveIndex >= this.waves.totalWaves) return
    writeCheckpoint({
      ruleset: RULESET_VERSION,
      levelId: this.level.id,
      difficulty: this.difficulty,
      heroId: (this.hero?.heroDef.id ?? this.save.lastHero) as HeroId,
      endless: this.isEndless,
      seed: this.runSeed,
      waveIndex,
      gold: this.gold,
      lives: this.lives,
      shards: this.shards,
      time: this.time,
      goldEarned: this.goldEarned,
      shardsEarned: this.shardsEarned,
      killCount: this.killCount,
      perfectWaves: this.perfectWaves,
      defenseStreak: this.defenseStreak,
      bestStreak: this.bestStreak,
      earlyCallSeconds: this.earlyCallSeconds,
      heroLevel: this.hero?.level ?? 1,
      heroXp: this.hero?.xp ?? 0,
      towers: this.towers.map(t => ({
        plot: t.plot.index,
        kind: t.kind,
        level: t.level,
        branch: t.branch,
        perk: t.perk?.id ?? null,
        policy: t.targetPolicy,
      })),
      traps: this.traps.map(t => ({ spot: t.spot.index, kind: t.kind })),
      savedAt: this.time,
    })
  }

  /**
   * Tell the score what the battle feels like. Pressure is how much is on the
   * road weighted by how close it has got to the gate, so the arrangement
   * tightens as a wave closes rather than merely as it spawns.
   */
  private updateMusicState(): void {
    let pressure = 0
    let boss = false
    for (const e of this.enemies) {
      if (!e.alive) continue
      const progress = 1 - Math.max(0, e.remaining) / Math.max(1, e.lane.length)
      pressure += 0.06 + progress * 0.12
      if (e.def.boss) boss = true
    }
    const maxLives = this.mods().lives
    audio.setMusicState({
      pressure: Math.min(1, pressure),
      surge: this.surgeActive,
      boss,
      livesRatio: maxLives > 0 ? this.lives / maxLives : 1,
      phase: this.phase,
    })
  }

  private updateOnboarding(dt: number): void {
    const o = this.onboarding
    if (!o) return
    if (o.finished) {
      this.onboarding = null
      this.save.taughtBasics = true
      writeSave(this.save)
      this.hud.setCoachMark(null)
      this.terrain?.pulsePlots(false)
      return
    }
    const prompt = o.update(this, dt)
    this.hud.setCoachMark(prompt)
    this.terrain?.pulsePlots(!!prompt && !!o.current?.pulsePlots)
  }

  /** the player gave up on being taught */
  skipOnboarding(): void {
    this.onboarding?.skip()
    this.updateOnboarding(0)
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

  /**
   * Record a Siege Tape: the player's own defense assembling itself, every
   * tower reappearing in the order it went up, over a slow orbit.
   *
   * It replays the build history rather than the battle, so it needs no
   * simulation rewind - and the board is already standing, so the towers are
   * simply hidden and revealed on their original cue.
   */
  async recordSiegeTape(): Promise<Blob | null> {
    if (!canRecordTape() || !this.level) return null
    const builds = this.replay.finalBuilds()
    if (!builds.length) return null

    const byPlot = new Map(this.towers.map(t => [t.plot.index, t]))
    const ordered = builds.map(b => byPlot.get(b.plot)).filter((t): t is Tower => !!t)
    if (!ordered.length) return null

    const wasChrome = this.hud.chromeVisible
    this.hud.setChrome(false)
    const paused = this.paused
    this.paused = true
    for (const t of ordered) t.group.visible = false

    const startYaw = this.engine.yaw
    const startDist = this.engine.dist
    const startPitch = this.engine.pitch
    this.engine.camTargetGoal.set(0, 0, 0)
    this.engine.camTarget.set(0, 0, 0)

    const st = this.battleStats()
    const headline = this.isEndless
      ? `Wave ${st.wavesReached} of the Long Night`
      : st.wavesCleared >= st.totalWaves && st.totalWaves > 0
        ? `Held all ${st.totalWaves} waves`
        : `Wave ${st.wavesReached} of ${st.totalWaves}`
    const onFrame = (k: number): void => {
      // hold the finished board for the last fifth of the tape
      const build = Math.min(1, k / 0.8)
      const shown = Math.round(build * ordered.length)
      for (let i = 0; i < ordered.length; i++) ordered[i].group.visible = i < shown
      this.engine.yaw = this.engine.yawGoal = startYaw + k * Math.PI * 0.55
      this.engine.pitch = this.engine.pitchGoal = 0.78 - k * 0.12
      this.engine.dist = this.engine.distGoal = startDist * (1.06 - k * 0.16)
      this.engine.render()
    }

    try {
      return await recordVerticalTape(this.engine.canvas, {
        // long enough to watch, short enough to loop in a feed
        seconds: 15,
        title: this.level.name,
        headline,
        footer: 'aj8uppal.github.io/blockhold',
        onFrame,
      })
    } finally {
      for (const t of ordered) t.group.visible = true
      this.engine.yaw = this.engine.yawGoal = startYaw
      this.engine.pitch = this.engine.pitchGoal = startPitch
      this.engine.dist = this.engine.distGoal = startDist
      this.paused = paused
      this.hud.setChrome(wasChrome)
    }
  }

  /**
   * A shareable picture of the player's Hold, posed and captioned.
   *
   * Rendered from the live menu backdrop, so what is captured is the keep the
   * player is looking at. The interface is hidden for the shot and put back
   * exactly as it was, the same way a Siege Tape does it.
   */
  async captureHoldPostcard(): Promise<Blob | null> {
    if (!this.holdGroup) return null
    const wasChrome = this.hud.chromeVisible
    this.hud.setChrome(false)
    const startYaw = this.engine.yaw
    const startTarget = this.engine.camTarget.clone()
    const startDist = this.engine.dist
    try {
      // centre the keep for its portrait; the menu framing deliberately pushes
      // it off to one side so the card can sit over the empty half
      this.engine.camTarget.set(0, 0.6, 0)
      this.engine.camTargetGoal.copy(this.engine.camTarget)
      this.engine.yaw = this.engine.yawGoal = startYaw + 0.25
      this.engine.dist = this.engine.distGoal = 12.5
      return await capturePostcard(this.engine.canvas, {
        summary: holdSummary(holdPieces(this.save)),
        footer: 'aj8uppal.github.io/blockhold',
        onFrame: () => this.engine.render(),
      })
    } finally {
      this.engine.camTarget.copy(startTarget)
      this.engine.camTargetGoal.copy(startTarget)
      this.engine.yaw = this.engine.yawGoal = startYaw
      this.engine.dist = this.engine.distGoal = startDist
      this.hud.setChrome(wasChrome)
    }
  }

  /** invest shards in the hero's signature */
  upgradeHeroSignature(): void {
    const h = this.hero
    if (this.paused || !h) return
    if (h.signatureRank >= HERO_RANK_MAX) { this.sfx('error'); return }
    const cost = heroRankCost(h.signatureRank)
    if (this.shards < cost) { this.sfx('error'); this.hud.showToast(`Needs ${cost} shards`, 2); return }
    this.shards -= cost
    h.signatureRank++
    this.sfx('upgrade')
    this.particles.healSparkle(h.group.position.x, h.group.position.y + 1, h.group.position.z)
    this.hud.showToast(`${h.heroDef.ability.name} sharpened to rank ${h.signatureRank}`, 3)
    this.hud.openHeroPanel(h)
  }

  /** spend the hero's signature; a press with nothing in reach costs nothing */
  castHeroSignature(): void {
    if (this.paused || this.phase !== 'playing') return
    const h = this.hero
    if (!h || !h.signatureReady) { this.sfx('error'); return }
    if (!h.castSignature(this)) {
      this.sfx('error')
      this.hud.showToast(`${h.heroDef.ability.name}: nothing in reach`, 1.6)
    }
  }

  shatterUnit(group: THREE.Group, opts: { force?: number, flavor?: DeathFlavor, scale?: number }): void {
    // deliberately Math.random, not the sim stream: debris is presentation, and
    // a quality tier that drew fewer chunks would otherwise desync the run
    // a player who asked for less movement gets a settle, not a shower
    shatter(group, this.engine.reducedMotion ? { ...opts, force: (opts.force ?? 1) * 0.35 } : opts)
  }

  towerDamageMult(_kind: string): number {
    // the Armory no longer sells flat damage; it sells verbs
    return 1
  }

  splashMult(): number {
    return 1
  }

  /** Second Wind: the hero returns in half the time */
  get heroReviveMult(): number {
    return hasArmory(this.save, 'secondwind') ? 0.5 : 1
  }

  /** Full Salvage: sell for everything invested rather than 70% */
  get sellRefund(): number {
    return hasArmory(this.save, 'salvage') ? 1 : SELL_REFUND
  }

  /** Gate Ward: eat the first leak of the battle */
  private gateWardSpent = false

  soldierHpMult(): number {
    return 1 + 0.15 * armoryTier(this.save, 'drill')
  }

  armoryTier(id: string): number {
    return armoryTier(this.save, id)
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
  /**
   * The menu used to show whichever battlefield you had unlocked last, which
   * looked the same on your first night as after clearing the campaign. It
   * shows your own Hold now: the keep you have actually earned.
   */
  showMenuBackdrop(): void {
    this.disposeLevel()
    const level = levels[Math.min(this.save.unlocked, levels.length) - 1]
    this.level = level
    this.engine.scene.add(this.particles.group)
    attachDebris(this.engine.scene)
    // always the meadow light: the Hold is the thing being shown, and the
    // late-campaign void theme lit it too darkly to read behind the menu
    this.engine.applyTheme(THEMES.forest, 16, 12)

    const pieces = holdPieces(this.save)
    this.holdGroup = buildModel(holdModel(pieces), holdCacheKey(pieces), { receiveShadow: true })
    this.holdGroup.scale.setScalar(3.2)
    this.engine.scene.add(this.holdGroup)
    this.engine.resetView(16, 12)
    // frame the keep itself, not the empty sky around it
    // the menu card sits centred, so the keep is framed off to one side and
    // low, where it can actually be seen rather than hidden behind the panel
    this.engine.distGoal = this.engine.dist = 15
    this.engine.camTargetGoal.set(3.4, 0, -2.2)
    this.engine.camTarget.copy(this.engine.camTargetGoal)
    this.engine.pitchGoal = this.engine.pitch = 0.46
    this.engine.yawGoal = this.engine.yaw = -0.6
  }

  private holdGroup: THREE.Group | null = null

  /** dev-only: pose a diorama in an empty scene, for capturing art */
  showDiorama(spec: {
    build: () => THREE.Group
    camera: { dist: number, yaw: number, pitch: number, target: [number, number, number] }
    mood: { sky: number, ambient: number, key: number, keyIntensity: number, keyDir?: [number, number, number], fill?: number }
  }): void {
    this.disposeLevel()
    this.hud.setChrome(false)
    document.getElementById('screens')?.classList.add('hidden')
    const g = spec.build()
    this.dioramaGroup = g
    this.engine.scene.add(g)
    this.engine.setDioramaMood(spec.mood)
    const [tx, ty, tz] = spec.camera.target
    this.engine.camTargetGoal.set(tx, ty, tz)
    this.engine.camTarget.set(tx, ty, tz)
    this.engine.distGoal = this.engine.dist = spec.camera.dist
    this.engine.yawGoal = this.engine.yaw = spec.camera.yaw
    this.engine.pitchGoal = this.engine.pitch = spec.camera.pitch
  }

  private dioramaGroup: THREE.Group | null = null

  startLevel(
    level: LevelDef,
    difficulty: Difficulty = 'normal',
    heroId: HeroId = 'aldric',
    mode: 'campaign' | 'endless' = 'campaign',
    opts: { seed?: number, resume?: Checkpoint, daily?: number, watches?: boolean, bellfoundry?: boolean } = {},
  ): void {
    this.disposeLevel()
    const resume = opts.resume ?? null
    // Seed before anything draws: endless wave generation itself is a
    // consumer, so the run is only reproducible if this comes first.
    this.runSeed = resume?.seed ?? opts.seed ?? newRunSeed()
    setSimSeed(this.runSeed)
    this.isBellfoundry = opts.bellfoundry ?? false
    this.isWatches = opts.watches ?? this.isWatches
    this.isDaily = opts.daily !== undefined
    this.dailyDay = opts.daily ?? 0
    this.isFreeplay = false
    this.liveXp = 0
    this.isEndless = mode === 'endless'
    this.level = this.isEndless ? { ...level, waves: generateEndlessWaves(level, undefined, this.runSeed) } : level
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
    this.waveOutcomes = []
    this.replay.reset()
    this.titheKills = 0
    this.mechanicsSeen.clear()
    this.retiredKillers = []
    const paths = buildPaths(level)
    this.lanes = paths.lanes
    this.terrain = new Terrain(level, paths)
    this.engine.scene.add(this.terrain.group)
    this.engine.scene.add(this.dynamic)
    this.engine.scene.add(this.particles.group)
    this.engine.scene.add(this.rangeRing, this.upgradeRing, this.selectRing, this.targetRing, this.heroRing, this.heroGuardRing, this.rampartRing)
    this.engine.applyTheme(THEMES[level.theme], level.width, level.height)
    this.engine.resetView(level.width, level.height,
      tallestLandmark((level.landmarks ?? []).map(([, , k]) => k)))

    this.gold = level.startGold + 40 * armoryTier(this.save, 'coffers')
    this.shards = (level.startShards ?? 2) + 3 * armoryTier(this.save, 'prospector')
    this.lives = difficultyMods(level.id, difficulty, this.isEndless ? 'endless' : 'campaign').lives
    this.speed = 1
    this.paused = false
    this.time = 0
    this.simAccumulator = 0
    this.killCount = 0
    this.gateWardSpent = false
    this.abilities.meteor.cooldown = 0
    this.abilities.reinforce.cooldown = 0
    this.waves = new WaveManager(
      level,
      (id, lane, extra) => this.spawnEnemyAt(id, this.liveLane(lane), 0, {
        surged: this.waves!.waveAt(this.waves!.waveIndex)?.surge ?? false,
        eliteRoll: true,
        waveTag: this.waves!.waveIndex,
        hpMult: extra?.hpMult,
        affix: extra?.affix,
      }),
      (i) => {
        const authored = this.waves!.authoredWaves
        const isFinal = i === authored - 1 && !this.isFreeplay
        const isSurge = this.waves!.waveAt(i)?.surge ?? false
        const depth = i + 1 - authored
        const boss = depth > 0 ? ladderRung(depth) : null
        this.hud.showBanner(
          isFinal ? 'FINAL WAVE!'
            : boss ? (boss.ascendant ? 'AN ASCENDANT WALKS' : `${enemyDef(boss.boss).name.toUpperCase()}`)
            : isSurge ? 'VEILTIDE SURGE!'
            : depth > 0 ? `Held ${depth}` : `Wave ${i + 1}`,
          isFinal || boss ? 'final' : isSurge ? 'surge' : '',
        )
        // Long Night Rations: a life back every ten waves held past the end
        if (depth > 0 && depth % 10 === 0 && (this.isFreeplay || this.isEndless)) {
          const back = armoryTier(this.save, 'rations') >= 2 ? 2 : armoryTier(this.save, 'rations') >= 1 ? 1 : 0
          if (back > 0) {
            this.lives += back
            this.hud.spawnFloater(window.innerWidth / 2, 156, `+${back} ${back === 1 ? 'life' : 'lives'} - rations`, 'gold')
            this.hud.pulseLives()
          }
        }
        // the next chunk is generated before the current one runs out
        if (this.isFreeplay && this.waves!.totalWaves - (i + 1) < 3) this.extendFreeplay()
        this.sfx('horn', 0.9)
        for (const m of this.terrain!.spawnMarkers) {
          this.particles.magicImpact(m.position.x, 0.8, m.position.z, isSurge ? 0xdd6bff : 0x9f5aff)
        }
      },
    )
    // the preview reads this to warn that named elites walk this board
    this.waves.eliteChance = this.eliteChance()
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
    telemetry.track({
      type: 'battle_start',
      level: level.id, difficulty, hero: heroId,
      mode: this.isEndless ? 'endless' : 'campaign',
      seed: this.runSeed, resumed: !!resume,
    })
    this.firstBuildAt = -1
    this.heroHasMoved = false
    // the guided opening runs once, on a player's very first battle
    this.onboarding = (!this.save.taughtBasics && !this.isDaily && !this.isWatches)
      ? new OnboardingDirector() : null
    if (this.isWatches) this.raiseGhosts()
    if (resume) this.applyCheckpoint(resume)
    else if (level.intro) this.hud.showToast(level.intro, 5)
  }

  /**
   * Hold the line: keep playing on the board the player built.
   *
   * Called from the victory card after a campaign clear has been recorded.
   * The stars, medals and experience for the clear are already written and
   * will not be written twice; everything the player earns from here is
   * freeplay depth, its own record, and experience per wave. Bosses come from
   * the ladder in levels.ts, and the board's health scaling carries on from
   * where the campaign left it rather than restarting.
   */
  holdTheLine(): void {
    if (this.phase !== 'victory' || !this.level || !this.waves || this.isEndless || this.isDaily || this.isWatches || this.isBellfoundry) return
    this.isFreeplay = true
    this.liveXp = 0
    this.phase = 'playing'
    this.paused = false
    this.hazard = this.level.hazard ? createHazard(this.level.hazard, this.level.id) : null
    this.extendFreeplay()
    this.hud.setChrome(true)
    this.hud.showBanner('HOLD THE LINE', 'final')
    this.sfx('horn', 0.9)
    audio.startMusic()
    this.onPhaseChange('playing')
    telemetry.track({ type: 'battle_start', level: this.level.id, difficulty: this.difficulty, hero: this.hero?.heroDef.id ?? '', mode: 'freeplay', seed: this.runSeed, resumed: false })
  }

  private extendFreeplay(): void {
    if (!this.level || !this.waves) return
    const depthStart = this.waves.totalWaves - this.waves.authoredWaves
    this.waves.extend(generateFreeplayChunk(this.level, this.runSeed, depthStart))
  }

  /** stand up every previous watch's defense as echoes */
  private raiseGhosts(): void {
    if (!this.terrain) return
    for (const layer of this.ghostLayers) {
      for (const snap of layer) {
        const plot = this.terrain.plots[snap.plot]
        if (!plot || plot.occupied) continue   // a live tower always wins the plot
        plot.occupied = true
        const t = new Tower(snap.kind, plot, this)
        t.isGhost = true
        for (let lvl = 1; lvl < snap.level; lvl++) t.upgrade(lvl === 3 ? (snap.branch ?? 0) : 0, this)
        this.towers.push(t)
        this.dynamic.add(t.group)
      }
    }
    if (this.ghostLayers.length) {
      this.hud.showBanner(`WATCH ${this.watchIndex + 1} OF 3`, '')
      this.hud.showToast(
        `${this.ghostLayers.length} earlier watch${this.ghostLayers.length === 1 ? '' : 'es'} stand with you, faint but fighting`, 4)
    }
  }

  /** keep this watch's defense, and set up the next one */
  advanceWatch(): boolean {
    if (!this.isWatches || this.watchIndex >= 2) return false
    this.ghostLayers.push(
      this.towers
        .filter(t => !t.isGhost)
        .map(t => ({ plot: t.plot.index, kind: t.kind, level: t.level, branch: t.branch })),
    )
    this.watchIndex++
    return true
  }

  resetWatches(): void {
    this.watchIndex = 0
    this.ghostLayers = []
  }

  /** rebuild the board a checkpoint describes */
  private applyCheckpoint(c: Checkpoint): void {
    if (!this.terrain || !this.waves) return
    this.gold = c.gold
    this.lives = c.lives
    this.shards = c.shards
    this.time = c.time
    this.goldEarned = c.goldEarned
    this.shardsEarned = c.shardsEarned
    this.killCount = c.killCount
    this.perfectWaves = c.perfectWaves
    this.defenseStreak = c.defenseStreak
    this.bestStreak = c.bestStreak
    this.earlyCallSeconds = c.earlyCallSeconds
    for (const snap of c.towers) {
      const plot = this.terrain.plots[snap.plot]
      if (!plot || plot.occupied) continue
      plot.occupied = true
      const tower = new Tower(snap.kind, plot, this)
      // walk the tree back up to the recorded tier, taking the same branch
      for (let lvl = 1; lvl < snap.level; lvl++) {
        tower.upgrade(lvl === 3 ? (snap.branch ?? 0) : 0, this)
      }
      if (snap.perk) {
        const idx = PERKS[snap.kind].findIndex(p => p.id === snap.perk)
        if (idx >= 0) tower.ascend(idx as 0 | 1, this)
      }
      tower.targetPolicy = snap.policy
      this.towers.push(tower)
      this.dynamic.add(tower.group)
    }
    for (const snap of c.traps) {
      const spot = this.terrain.trapSpots[snap.spot]
      if (!spot || spot.occupied) continue
      spot.occupied = true
      spot.mesh.visible = false
      const trap = new Trap(snap.kind, spot, this)
      this.traps.push(trap)
      this.dynamic.add(trap.group)
    }
    this.recomputeResonance()
    if (this.hero) {
      this.hero.level = c.heroLevel
      this.hero.xp = c.heroXp
    }
    this.waves.resumeAt(c.waveIndex)
    this.removeLanePreview()
    this.hud.showToast(`Resumed at wave ${c.waveIndex + 1}`, 3)
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
    this.engine.clearDioramaRim()
    audio.stopMusic()
    audio.setMusicState({ pressure: 0, surge: false, boss: false, livesRatio: 1, phase: 'idle' })
    this.hazard?.dispose(this)
    this.hazard = null
    this.removeLanePreview()
    if (this.dioramaGroup) {
      this.engine.scene.remove(this.dioramaGroup)
      disposeClonedMaterials(this.dioramaGroup)
      this.dioramaGroup = null
    }
    if (this.holdGroup) {
      this.engine.scene.remove(this.holdGroup)
      disposeClonedMaterials(this.holdGroup)
      this.holdGroup = null
    }
    clearDebris()
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
    this.earthworks = []
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
    // the run is over either way: there is nothing left to resume
    clearCheckpoint()
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
    // the star record is written a few lines down; the first-clear bonus has to
    // be decided from what it was before that, or it is never true on a win
    const hadStars = this.level ? (this.save.stars[this.level.id] ?? 0) > 0 : true
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
      const scoreKey = `${this.level.id}:${this.isEndless ? 'endless' : this.isFreeplay ? `freeplay:${this.difficulty}` : this.difficulty}`
      this.lastPrevBestScore = this.save.bestScore[scoreKey] ?? 0
      this.lastNewBestScore = this.lastScore > this.lastPrevBestScore
      if (this.lastNewBestScore) this.save.bestScore[scoreKey] = this.lastScore

      if (this.isWatches) {
        // the watches are their own thing; they must not move the campaign
      } else if (this.isFreeplay) {
        // the clear was already paid for; freeplay records only how far past
        // it the line held, keyed by difficulty so a Veteran hold is its own number
        const depth = this.waves ? this.waves.freeplayDepth - (won ? 0 : 1) : 0
        const key = `${this.level.id}:${this.difficulty}`
        this.lastNewWaveRecord = depth > (this.save.bestFreeplay[key] ?? 0)
        if (this.lastNewWaveRecord) this.save.bestFreeplay[key] = depth
      } else if (this.isDaily) {
        // the daily is its own ladder: it must never move campaign progress,
        // or a lucky day would unlock maps the player has not earned
        const prev = this.save.dailyBest?.day === this.dailyDay ? this.save.dailyBest : null
        const reachedNow = won ? this.waves?.totalWaves ?? reached : reached
        if (!prev || reachedNow > prev.wave || (reachedNow === prev.wave && this.lastScore > prev.score)) {
          this.save.dailyBest = { day: this.dailyDay, wave: reachedNow, won, score: this.lastScore }
        }
        telemetry.track({ type: 'daily_completed', day: this.dailyDay, wave: reachedNow, won })
      } else if (this.isEndless) {
        // endless: the wave record is the headline; ties are not new records
        const prevBestWave = this.save.bestEndless[this.level.id] ?? 0
        this.lastNewWaveRecord = reached > prevBestWave
        if (this.lastNewWaveRecord) this.save.bestEndless[this.level.id] = reached
      } else if (won) {
        const maxLives = this.mods().lives
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
      // experience: every wave held counts, win or lose, and the account
      // levels on it. Ghost watches are the one thing that pays nothing extra
      // over the first watch, so replaying a siege three times is not a farm.
      const firstClear = won && !this.isEndless && !this.isDaily && !this.isWatches && !this.isBellfoundry && !hadStars
      this.lastXpBefore = this.save.xp
      this.lastXpEarned = battleXp({
        mode: this.isDaily ? 'daily' : this.isWatches ? 'watches' : this.isBellfoundry ? 'bellfoundry' : this.isEndless || this.isFreeplay ? 'endless' : 'campaign',
        difficulty: this.difficulty,
        // freeplay pays only for the waves past the clear, which was paid for already
        wavesHeld: this.isFreeplay ? Math.max(0, this.wavesCleared() - (this.waves?.authoredWaves ?? 0)) : this.wavesCleared(),
        won,
        firstClear,
      })
      this.save.xp += this.lastXpEarned
      if (!writeSave(this.save)) {
        telemetry.track({ type: 'save_write_failed' })
        this.hud.showToast('Could not save progress - your browser is blocking storage', 6)
      }
    }
    telemetry.track({
      type: 'battle_end',
      level: this.level?.id ?? '', difficulty: this.difficulty, won,
      wave: (this.waves?.waveIndex ?? 0) + 1,
      totalWaves: this.waves?.totalWaves ?? 0,
      lives: this.lives, score: this.lastScore, seconds: Math.round(this.time),
    })
    telemetry.flush()
    this.onPhaseChange(this.phase, stars)
  }

  private lastXpBefore = 0
  private lastXpEarned = 0
  /**
   * Experience earned so far this battle, as it happens.
   *
   * The account is paid once, at the end, by `battleXp()` - that total is what
   * the tests pin and what the save records. But a bar that only moves when a
   * battle ends teaches nothing during one, so the same total is previewed
   * live: each wave's worth is handed out per kill as its enemies fall, and
   * topped up to the wave's full value when the wave is held. The preview and
   * the payment agree at the end by construction.
   */
  private liveXp = 0
  /** what the account will read once this battle is paid: the bar's value */
  xpPreview(): number { return this.save.xp + Math.round(this.liveXp) }
  /** experience previewed so far this battle */
  get liveXpEarned(): number { return Math.round(this.liveXp) }

  /** one wave's experience in this mode, before win bonuses */
  private waveXpValue(): number {
    const mult = { casual: 0.75, normal: 1, veteran: 1.4 }[this.difficulty]
    if (this.isDaily) return 10
    if (this.isWatches || this.isBellfoundry) return 8
    return 12 * mult
  }

  /** how much of a wave each of its enemies is worth, for the live bar */
  private killXp(tag: number): number {
    const wave = this.waves?.waveAt(tag)
    if (!wave) return 0
    const planned = wave.groups.reduce((n, g) => n + g.count, 0)
    return planned > 0 ? this.waveXpValue() / planned : 0
  }
  private lastScore = 0
  private lastPrevBestScore = 0
  private lastNewBestScore = false
  private lastNewWaveRecord = false

  /** end-of-battle summary for the result screens */
  /**
   * Waves the player actually survived.
   *
   * The end screen used to report `waveIndex + 1` as waves *held*, which
   * counts the wave you died on - so falling on wave 19 was reported as
   * holding 19. Reaching a wave and holding it are different numbers and the
   * screen now says both.
   */
  private wavesCleared(): number {
    if (!this.waves) return 0
    return this.phase === 'victory' ? this.waves.totalWaves : this.waves.waveIndex
  }

  /**
   * This run's decisions, for submission alongside a score.
   *
   * The server stores it so a result can be verified later against a
   * simulation that does not need a renderer. Until that exists, it is
   * evidence being kept, not a check being performed.
   */
  replayLog(): { seed: number, ruleset: number, events: unknown[] } {
    return { seed: this.runSeed, ruleset: RULESET_VERSION, events: this.replay.all() }
  }

  battleStats(): {
    kills: number, gold: number, shards: number, wavesReached: number, totalWaves: number,
    /** waves actually survived; the wave you die on is reached, not held */
    wavesCleared: number,
    timeSec: number, heroLevel: number, endless: boolean, bestEndless: number,
    score: number, prevBestScore: number, newBestScore: boolean, newWaveRecord: boolean,
    perfectWaves: number, bestStreak: number, noleak: boolean,
    /** lives still standing when the run ended, for the shareable result */
    livesLeft: number,
    lastLeak: { name: string, wave: number } | null,
    topKiller: { name: string, kills: number } | null,
    heroKills: number,
    stamp: RunStamp,
    daily?: DailyResult,
    freeplay: boolean, freeplayDepth: number,
    xpEarned: number, levelBefore: number, levelAfter: number, newUnlocks: UnlockDef[],
  } {
    return {
      daily: this.isDaily ? {
        day: this.dailyDay,
        outcomes: this.waveOutcomes,
        totalWaves: this.waves?.totalWaves ?? 0,
        wavesReached: this.waves ? this.waves.waveIndex + 1 : 0,
        lives: this.lives,
        won: this.phase === 'victory',
      } : undefined,
      stamp: runStamp(
        this.level?.id ?? '',
        this.difficulty,
        this.isEndless ? 'endless' : 'campaign',
        this.runSeed,
      ),
      kills: this.killCount,
      gold: this.goldEarned,
      shards: this.shardsEarned,
      wavesReached: this.waves ? this.waves.waveIndex + 1 : 0,
      wavesCleared: this.wavesCleared(),
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
      noleak: this.lives === this.mods().lives,
      livesLeft: Math.max(0, this.lives),
      lastLeak: this.lastLeak,
      topKiller: this.topKiller(),
      heroKills: this.hero?.kills ?? 0,
      freeplay: this.isFreeplay,
      freeplayDepth: this.waves ? this.waves.freeplayDepth : 0,
      xpEarned: this.lastXpEarned,
      levelBefore: levelForXp(this.lastXpBefore),
      levelAfter: levelForXp(this.save.xp),
      newUnlocks: unlocksBetween(this.lastXpBefore, this.save.xp),
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
    // echoes of an earlier watch are memories: they fight, but they cannot be
    // selected, upgraded or sold
    const live = this.towers.filter(t => !t.isGhost)
    const hits = this.raycaster.intersectObjects(live.map(t => t.group), true)
    if (hits.length === 0) return null
    let obj: THREE.Object3D | null = hits[0].object
    while (obj) {
      const found = live.find(t => t.group === obj)
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

  /**
   * Select the hero so the next tap on the ground is a move order.
   *
   * The hero button used to drag the camera to wherever the hero was standing,
   * which is backwards: the usual reason to select the hero is to bring them
   * to what you are already looking at. The camera stays put, and a double tap
   * on the button goes to them if that is genuinely what you wanted.
   */
  selectHero(fromButton = false): void {
    if (!this.hero || this.hero.dead) { if (this.hero?.dead) this.sfx('error'); return }
    const wasSelected = this.heroSelected
    this.clearSelection()
    this.heroSelected = true
    this.heroRing.visible = true
    this.hud.openHeroPanel(this.hero)
    // second press of the button: now go and look at them
    if (fromButton && wasSelected) {
      this.engine.cancelCinematic()
      this.engine.focusOn(this.hero.group.position.x, this.hero.group.position.z)
      this.hud.showToast('Camera moved to your hero', 1.6)
    } else if (fromButton) {
      this.hud.showToast('Tap the ground to send your hero there', 2.2)
    }
    this.sfx('click')
  }

  /**
   * Primary click routing.
   *
   * A tap that lands on nothing closes whatever is open. On a desktop Escape
   * does this; on a phone there was no way out of a tower panel except
   * finding the small ✕, which is why dismissing felt awkward on touch.
   */
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
    const earthSpot = this.pickEarthworkSpot(sx, sy)
    if (earthSpot) { this.selectEarthworkSpot(earthSpot, sx, sy); return }
    const built = this.pickEarthwork(sx, sy)
    if (built) { this.selectBuiltEarthwork(built); return }
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
        this.heroHasMoved = true
      } else {
        this.hud.showEnemyTip(enemy, sx, sy)           // tap-to-inspect (touch has no hover)
      }
      return
    }
    if (this.heroSelected && this.hero && !this.hero.dead) {
      const g = this.groundPoint(sx, sy)
      if (g) {
        if (!this.hero.orderMove(g, this)) this.sfx('error')
        else this.heroHasMoved = true
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
    if (this.pickTrapSpot(sx, sy) || this.pickTrap(sx, sy) || this.pickEarthworkSpot(sx, sy)) { this.hud.hideEnemyTip(); return 'pointer' }
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
    this.rangeRing.position.set(tower.pos.x, tower.pos.y - 0.06, tower.pos.z)
    this.rangeRing.scale.setScalar(tower.range)
    this.selectRing.visible = true
    this.selectRing.position.set(tower.pos.x, tower.pos.y - 0.05, tower.pos.z)
    this.sfx('click')
  }

  selectPlot(plot: PlotInfo, sx: number, sy: number): void {
    this.selectedTower = null
    this.hud.closeTowerPanel()
    this.selectedPlot = plot
    const screen = this.projectToScreen(plot.pos.x, plot.pos.y + 0.2, plot.pos.z)
    this.hud.openBuildMenu(plot, screen?.x ?? sx, screen?.y ?? sy)
    this.selectRing.visible = true
    this.selectRing.position.set(plot.pos.x, plot.pos.y + 0.02, plot.pos.z)
    this.rangeRing.visible = false
    this.sfx('click')
  }

  clearSelection(): void {
    this.selectedTower = null
    this.selectedPlot = null
    this.selectedTrapSpot = null
    this.selectedEarthSpot = null
    if (this.selectedEarthwork) { this.selectedEarthwork.showReach(false); this.selectedEarthwork = null }
    this.clearLiftMarkers()
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
    this.upgradeRing.visible = false
    this.selectRing.visible = false
    this.heroRing.visible = false
    this.heroGuardRing.visible = false
  }

  /**
   * Show the range an upgrade would give, as a second ring beside the one the
   * tower has now - so the player can see what they are buying rather than
   * inferring it from a description.
   */
  previewUpgradeRange(tower: Tower, opt: { range: number } | null): void {
    if (!opt) {
      this.rangeRing.visible = !!this.selectedTower
      if (this.selectedTower) {
        this.rangeRing.position.set(this.selectedTower.pos.x, this.selectedTower.pos.y - 0.06, this.selectedTower.pos.z)
        this.rangeRing.scale.setScalar(this.selectedTower.range)
      }
      this.upgradeRing.visible = false
      return
    }
    // the upgrade's own multipliers ride along, so the ring is the real number
    const scale = opt.range / tower.def.range
    this.upgradeRing.visible = true
    this.upgradeRing.position.set(tower.pos.x, tower.pos.y - 0.05, tower.pos.z)
    this.upgradeRing.scale.setScalar(tower.range * scale)
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
    this.rangeRing.position.set(this.selectedPlot.pos.x, this.selectedPlot.pos.y - 0.06, this.selectedPlot.pos.z)
    this.rangeRing.scale.setScalar(def.range)
  }

  buildTower(kind: TowerKind): void {
    if (this.paused) return
    const plot = this.selectedPlot
    if (!plot || plot.occupied) return
    // the ladder is enforced here, not only in the menu, so a stale button or a
    // scripted call cannot build what the account has not earned
    if (!isUnlocked(this.save, 'tower', kind)) { this.sfx('error'); return }
    const cost = towerTrees[kind].levels[0].cost
    if (this.gold < cost) { this.sfx('error'); this.hud.flashGold(); return }
    this.gold -= cost
    plot.occupied = true
    const tower = new Tower(kind, plot, this)
    this.towers.push(tower)
    this.dynamic.add(tower.group)
    this.recomputeResonance()
    this.recomputeHighGround()
    this.replay.record({ t: this.time, kind: 'build', tower: kind, plot: plot.index })
    telemetry.track({ type: 'tower_built', kind, level: this.level?.id ?? '', wave: (this.waves?.waveIndex ?? -1) + 1 })
    if (this.firstBuildAt < 0) {
      this.firstBuildAt = this.time
      telemetry.track({ type: 'first_build_delay', seconds: Math.round(this.time) })
    }
    this.teachSightline(tower)
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

  pickEarthworkSpot(sx: number, sy: number): EarthworkSpot | null {
    if (!this.terrain) return null
    const g = this.groundPoint(sx, sy)
    if (!g) return null
    for (const e of this.terrain.earthworkSpots) {
      if (!e.occupied && Math.hypot(g.x - e.pos.x, g.z - e.pos.z) < 0.52) return e
    }
    return null
  }

  selectEarthworkSpot(spot: EarthworkSpot, sx: number, sy: number): void {
    this.clearSelection()
    this.selectedEarthSpot = spot
    const screen = this.projectToScreen(spot.pos.x, spot.pos.y + 0.15, spot.pos.z)
    // What would this rampart do? Answered on the board before the purchase:
    // its reach as a ring, and a mark on every tower that reach covers.
    let lifts: string[] = []
    if (spot.kind === 'rampart') {
      const towers = this.liftedBy(spot.pos.x, spot.pos.z)
      for (const t of towers) t.showLift(true)
      lifts = towers.map(t => t.def.name)
      this.rampartRing.visible = true
      this.rampartRing.position.set(spot.pos.x, 0.08, spot.pos.z)
    }
    this.hud.openEarthworkMenu(spot, screen?.x ?? sx, screen?.y ?? sy, lifts)
    this.selectRing.visible = true
    this.selectRing.position.set(spot.pos.x, 0.1, spot.pos.z)
    this.sfx('click')
  }

  buildEarthwork(): void {
    if (this.paused) return
    const spot = this.selectedEarthSpot
    if (!spot || spot.occupied) return
    const def = EARTHWORK_DEFS[spot.kind]
    if (this.gold < def.cost) { this.sfx('error'); this.hud.flashGold(); return }
    this.gold -= def.cost
    spot.occupied = true
    spot.mesh.visible = false
    const work = new Earthwork(spot.kind, spot)
    this.earthworks.push(work)
    this.dynamic.add(work.group)
    this.particles.buildDust(spot.pos.x, spot.pos.y + 0.1, spot.pos.z)
    this.sfx('build')
    this.engine.addShake(0.06)
    this.replay.record({ t: this.time, kind: 'earthwork', spot: spot.index, work: spot.kind })
    this.recomputeHighGround()
    this.clearSelection()
  }

  /**
   * Which towers are shooting from height: next to a rampart the player
   * raised, or standing on the map's own high ground. A plot sitting on a
   * visibly raised shelf that behaved exactly like flat ground was reading as
   * a bug rather than scenery.
   */
  recomputeHighGround(): void {
    for (const t of this.towers) {
      const nearRampart = this.earthworks.some(
        w => w.kind === 'rampart' && w.group.position.distanceTo(t.pos) <= RAMPART_REACH,
      )
      t.onHighGround = nearRampart || this.terrain?.isOnHill(t.plot.cell[0], t.plot.cell[1]) === true
      // what it shoots from, so it can see over anything shorter than its footing
      t.footing = this.terrain?.cellTop(t.plot.cell[0], t.plot.cell[1]) ?? 0
    }
  }

  /**
   * Roads the tide has taken. A wave still says which road it wants; if that
   * road is shut, its traffic comes up the nearest one that is open, so a
   * closed road never silently swallows a wave.
   */
  closedLanes = new Set<number>()

  liveLane(lane: number): number {
    if (!this.closedLanes.has(lane) || !this.lanes.length) return lane
    let best = lane, bestD = Infinity
    for (let i = 0; i < this.lanes.length; i++) {
      if (this.closedLanes.has(i)) continue
      const d = Math.abs(i - lane)
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }

  private taughtSightline = false

  /**
   * Terrain that blocks a shot is the one mechanic a player cannot see the
   * rules of by looking - a tower simply does nothing and reads as broken. So
   * it is taught the first time it actually costs the player something: on the
   * build that lands behind a ridge, naming the fix rather than the rule.
   */
  private teachSightline(tower: Tower): void {
    if (this.taughtSightline || !this.terrain) return
    if (!(this.level?.plateaus ?? []).length) return
    let blocked = 0, total = 0
    for (const lane of this.lanes) {
      for (let d = 0; d < lane.length; d += 1.2) {
        const s = lane.sample(d)
        if (Math.hypot(s.x - tower.pos.x, s.z - tower.pos.z) > tower.range) continue
        total++
        if (this.terrain.sightBlocked(tower.pos.x, tower.pos.z, tower.footing, s.x, s.z)) blocked++
      }
    }
    if (total === 0 || blocked / total < 0.25) return
    this.taughtSightline = true
    this.hud.showToast('That ridge blocks the shot — this tower cannot see past it. Build on the high ground to shoot over the terraces.', 7)
  }

  /** is raised ground standing between a tower and its target? */
  sightBlocked(fromX: number, fromZ: number, fromY: number, toX: number, toZ: number): boolean {
    return this.terrain?.sightBlocked(fromX, fromZ, fromY, toX, toZ) ?? false
  }

  /** ground height under a world point, so a unit rests on raised ground */
  groundY(x: number, z: number): number {
    return this.terrain?.groundTopAt(x, z) ?? 0
  }

  /** a cutting slows and exposes whatever is down in it */
  cuttingAt(x: number, z: number): boolean {
    for (const w of this.earthworks) {
      if (w.kind !== 'cutting') continue
      if (Math.hypot(w.group.position.x - x, w.group.position.z - z) < 0.55) return true
    }
    return false
  }

  /** an earthwork already standing, so its effect can be inspected */
  pickEarthwork(sx: number, sy: number): Earthwork | null {
    const g = this.groundPoint(sx, sy)
    if (!g) return null
    for (const w of this.earthworks) {
      if (Math.hypot(g.x - w.group.position.x, g.z - w.group.position.z) < 0.55) return w
    }
    return null
  }

  selectBuiltEarthwork(work: Earthwork): void {
    this.clearSelection()
    this.selectedEarthwork = work
    work.showReach(true)
    // mark the towers it is actually helping, which is the whole question, and
    // keep them marked for as long as it is selected
    let lifted: Tower[] = []
    if (work.kind === 'rampart') {
      lifted = this.liftedBy(work.group.position.x, work.group.position.z)
      for (const t of lifted) t.showLift(true)
    }
    this.selectRing.visible = true
    this.selectRing.position.set(work.group.position.x, 0.1, work.group.position.z)
    this.hud.openEarthworkPanel(work, lifted.map(t => t.def.name))
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
    this.replay.record({ t: this.time, kind: 'trap', spot: spot.index, trap: kind })
    this.clearSelection()
  }

  sellTrap(trap: Trap): void {
    if (this.paused) return
    if (trap.kills > 0) this.retiredKillers.push({ name: trap.def.name, kills: trap.kills })
    const refund = Math.round(trap.def.cost * (hasArmory(this.save, 'salvage') ? 1 : 0.6))
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
  /**
   * Cross-family reactions. The old rule paid +6% damage per adjacent tower of
   * the *same* family, which was invisible at those numbers and rewarded
   * clumping four of one thing. Mixing families is the decision now.
   */
  recomputeResonance(): void {
    for (const t of this.towers) {
      const neighbours = this.towers.filter(o => o !== t && o.pos.distanceTo(t.pos) <= REACTION_RADIUS)
      t.reactions.clear()
      for (const o of neighbours) {
        const r = reactionFor(t.kind, o.kind)
        if (r) t.reactions.add(r.id)
      }
      // a barracks braced by any neighbouring tower raises tougher soldiers
      if (t.isBarracks && neighbours.length > 0) t.reactions.add('shieldwall')
      t.resonance = t.reactions.size
      t.refreshSoldierStats(this)  // live soldiers pick up the change immediately
    }
    this.recomputeAuras()
  }

  /**
   * Which beacon lights each tower.
   *
   * The strongest single beacon in reach applies; they do not stack. Stacking
   * would make a ring of beacons around one Kingsreach the dominant build on
   * every map, which is exactly the "one solved build" problem more families
   * were meant to break. One beacon per tower keeps the question spatial.
   */
  recomputeAuras(): void {
    const beacons = this.towers.filter(t => t.isBeacon && t.def.aura)
    for (const t of this.towers) {
      t.auraDamage = t.auraRange = t.auraRate = 0
      if (t.isBeacon) continue
      let best = -1
      for (const b of beacons) {
        if (Math.hypot(b.pos.x - t.pos.x, b.pos.z - t.pos.z) > b.auraReach) continue
        const a = b.def.aura!
        const dmg = a.damage + (b.perk?.id === 'zeal' ? 0.08 : 0)
        if (dmg > best) {
          best = dmg
          t.auraDamage = dmg
          t.auraRange = a.range
          t.auraRate = a.rate
        }
      }
    }
  }

  /**
   * Watchfire: phasing enemies inside a revealing beacon's light can be shot.
   * Recomputed every tick, since both the enemies and the flag are transient.
   */
  private revealPhasing(): void {
    const eyes = this.towers.filter(t => t.isBeacon && t.def.aura?.reveal && !t.isGhost)
    for (const e of this.enemies) {
      if (!e.def.phasing) continue
      e.revealed = eyes.some(b => Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) <= b.auraReach + e.radius)
    }
  }

  /** the bounty multiplier a kill at this point earns from any Tithe Hall lighting it */
  private tithePremium(x: number, z: number): number {
    let best = 0
    for (const b of this.towers) {
      const bonus = b.isBeacon ? (b.def.aura?.bounty ?? 0) : 0
      if (bonus > best && Math.hypot(b.pos.x - x, b.pos.z - z) <= b.auraReach) best = bonus
    }
    return 1 + best
  }
  /** the Exchequer's count toward its next shard */
  private titheKills = 0

  upgradeTower(tower: Tower, optionIndex: number): void {
    if (this.paused) return
    const opt = tower.upgradeOptions[optionIndex]
    if (!opt) return
    if (this.gold < opt.cost) { this.sfx('error'); this.hud.flashGold(); return }
    this.gold -= opt.cost
    tower.upgrade(tower.level === 3 ? optionIndex : 0, this)
    this.replay.record({ t: this.time, kind: 'upgrade', plot: tower.plot.index, level: tower.level, branch: tower.branch })
    // a beacon's light grows with its tier, and the towers it lights only learn
    // that here: reactions were already recomputed on build and sell, never on
    // upgrade, so an upgraded beacon lit nothing new until something else changed
    this.recomputeResonance()
    this.selectTower(tower)
  }

  sellTower(tower: Tower): void {
    if (this.paused) return
    if (tower.kills > 0) this.retiredKillers.push({ name: tower.def.name, kills: tower.kills })
    this.addGold(tower.sellValue, tower.pos.x, tower.pos.y + 0.6, tower.pos.z)
    this.goldEarned -= tower.sellValue  // refunds are not earnings
    tower.plot.occupied = false
    this.replay.record({ t: this.time, kind: 'sell', plot: tower.plot.index })
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
    this.recomputeResonance()   // Far Sight and Zeal change what a beacon lights
    this.selectTower(tower)
  }

  callWave(): void {
    if (!this.waves || this.phase !== 'playing' || this.paused) return
    const secondsLeft = this.waves.countdown
    const surgeNext = this.waves.nextWaveIsSurge()
    const bonus = this.waves.callNext()
    // when a wave was called is a player decision like any other, and a replay
    // that cannot reproduce the timing cannot reproduce the run
    this.replay.record({ t: this.time, kind: 'wave', index: this.waves.waveIndex })
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
  /**
   * Impact hold. Scales wall-clock time into the fixed-step accumulator, so
   * the simulation runs *fewer* 1/60 ticks per real second while it is active
   * but the tick sequence is identical - the run stays reproducible.
   *
   * Deliberately tiered rather than global: a swarm TD where every one of 45
   * deaths freezes the frame would stutter, not punch.
   */
  private hitstopT = 0
  private hitstopScale = 1
  private lastLightStopAt = -99
  /** reward feedback runs a beat after the kill, so the death reads before the payment */
  private pendingFx: { at: number, run: () => void }[] = []

  /** hold the frame on a hit worth feeling; `weight` picks the tier */
  impact(weight: 'light' | 'heavy' | 'elite' | 'boss'): void {
    const now = performance.now() / 1000
    if (weight === 'light') {
      // light hits share one budget so a swarm cannot chain-freeze the frame
      if (now - this.lastLightStopAt < 0.5) return
      this.lastLightStopAt = now
    }
    const [dur, scale] =
      weight === 'boss' ? [0.20, 0.06] :
      weight === 'elite' ? [0.10, 0.18] :
      weight === 'heavy' ? [0.055, 0.16] :
      [0.03, 0.34]
    // never shorten a bigger hold that is already running
    if (this.hitstopT > dur) return
    this.hitstopT = dur
    this.hitstopScale = scale
  }

  /** run something a beat later, on the render clock */
  private deferFx(delaySec: number, run: () => void): void {
    this.pendingFx.push({ at: performance.now() / 1000 + delaySec, run })
  }

  update(dtRaw: number): void {
    if (this.pendingFx.length) {
      const now = performance.now() / 1000
      for (let i = this.pendingFx.length - 1; i >= 0; i--) {
        if (this.pendingFx[i].at <= now) { this.pendingFx[i].run(); this.pendingFx.splice(i, 1) }
      }
    }
    this.engine.updateCamera(dtRaw)
    this.cameraQuat.copy(this.engine.camera.quaternion)
    this.terrain?.update(dtRaw)
    // debris is presentation only, so it runs on the render clock and never
    // draws from the simulation RNG stream
    if (!this.paused) updateDebris(Math.min(dtRaw, 0.05))
    // look for a quiet board roughly once a second
    if (this.phase === 'playing' && !this.paused) {
      this.checkpointT += dtRaw
      if (this.checkpointT >= 1) {
        this.checkpointT = 0
        this.maybeCheckpoint()
        this.updateMusicState()
        this.updateOnboarding(1)
      }
    }

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
      let dtSim = dtRaw
      if (this.hitstopT > 0) {
        this.hitstopT = Math.max(0, this.hitstopT - dtRaw)
        dtSim *= this.hitstopScale
      }
      this.simAccumulator = Math.min(this.simAccumulator + dtSim * this.speed, H * 14)
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
    this.revealPhasing()
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
