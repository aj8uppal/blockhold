import { LevelDef } from './types.ts'
import { WAVE_BREAK, EARLY_CALL_GOLD_PER_SEC } from './levels.ts'
import { enemyDef } from './enemyDefs.ts'

interface QueuedSpawn { time: number, enemy: string, lane: number }

export interface WavePreviewEntry {
  name: string
  count: number
  flying: boolean
  armored: boolean
  warded: boolean
  phasing: boolean
  healer: boolean
  summoner: boolean
  boss: boolean
}

export type WavePhase = 'countdown' | 'spawning' | 'finished'

/**
 * Wave flow: an initial grace countdown, then each wave spawns its groups.
 * Once a wave is fully spawned, the countdown to the next begins (waves can
 * overlap if the field isn't cleared). The player can call the next wave
 * early for bonus gold, Kingdom Rush style.
 */
export class WaveManager {
  waveIndex = -1                // index of last started wave
  phase: WavePhase = 'countdown'
  countdown = 14
  private queue: QueuedSpawn[] = []
  private elapsed = 0

  constructor(readonly level: LevelDef, private onSpawn: (enemy: string, lane: number) => void, private onWaveStart: (index: number) => void) {}

  get totalWaves(): number { return this.level.waves.length }
  get isLastWaveStarted(): boolean { return this.waveIndex >= this.totalWaves - 1 }
  get allSpawned(): boolean { return this.isLastWaveStarted && this.queue.length === 0 }

  /**
   * What's coming. Carries the traits that decide a build, not just names:
   * the player must be able to read "air plus armored" without hovering,
   * because hover does not exist on touch.
   */
  nextWavePreview(): WavePreviewEntry[] | null {
    const next = this.level.waves[this.waveIndex + 1]
    if (!next) return null
    const counts = new Map<string, number>()
    for (const g of next.groups) {
      counts.set(g.enemy, (counts.get(g.enemy) ?? 0) + g.count)
    }
    return [...counts.entries()].map(([id, count]) => {
      const d = enemyDef(id)
      return {
        name: d.name,
        count,
        flying: !!d.flying,
        armored: d.armor >= 0.3,
        warded: d.magicResist >= 0.3,
        phasing: !!d.phasing,
        healer: !!d.healAura,
        summoner: !!(d.summons || d.spawnOnDeath),
        boss: !!d.boss,
      }
    })
  }

  /** the two or three counters that actually decide this wave */
  nextWaveThreats(): string[] {
    const p = this.nextWavePreview()
    if (!p) return []
    const out: string[] = []
    if (p.some(e => e.boss)) out.push('Boss')
    if (p.some(e => e.flying)) out.push('Air')
    if (p.some(e => e.armored)) out.push('Armored')
    if (p.some(e => e.warded)) out.push('Warded')
    if (p.some(e => e.phasing)) out.push('Phasing')
    if (p.some(e => e.healer)) out.push('Healers')
    if (p.some(e => e.summoner)) out.push('Spawns')
    return out
  }

  nextWaveIsSurge(): boolean {
    return !!this.level.waves[this.waveIndex + 1]?.surge
  }

  /** bonus gold if the player calls now */
  earlyCallBonus(): number {
    if (this.phase !== 'countdown' || this.isLastWaveStarted) return 0
    return Math.round(this.countdown * EARLY_CALL_GOLD_PER_SEC)
  }

  callNext(): number {
    if (this.phase !== 'countdown' || this.isLastWaveStarted) return 0
    const bonus = this.earlyCallBonus()
    this.startWave(this.waveIndex + 1)
    return bonus
  }

  private startWave(index: number): void {
    this.waveIndex = index
    this.phase = 'spawning'
    this.elapsed = 0
    const wave = this.level.waves[index]
    this.queue = []
    for (const grp of wave.groups) {
      for (let i = 0; i < grp.count; i++) {
        this.queue.push({ time: grp.delay + i * grp.interval, enemy: grp.enemy, lane: grp.lane ?? 0 })
      }
    }
    this.queue.sort((a, b) => a.time - b.time)
    this.onWaveStart(index)
  }

  update(dt: number): void {
    if (this.phase === 'finished') return
    if (this.phase === 'countdown') {
      this.countdown -= dt
      if (this.countdown <= 0) {
        if (this.isLastWaveStarted) { this.phase = 'finished'; return }
        this.startWave(this.waveIndex + 1)
      }
      return
    }
    // spawning
    this.elapsed += dt
    while (this.queue.length > 0 && this.queue[0].time <= this.elapsed) {
      const s = this.queue.shift()!
      this.onSpawn(s.enemy, s.lane)
    }
    if (this.queue.length === 0) {
      if (this.isLastWaveStarted) {
        this.phase = 'finished'
      } else {
        this.phase = 'countdown'
        this.countdown = this.level.waves[this.waveIndex]?.breakAfter ?? WAVE_BREAK
      }
    }
  }
}
