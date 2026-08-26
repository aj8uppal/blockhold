// Synthesized audio: no assets, everything generated with WebAudio.
// Public API is frozen — game code depends on exactly these exports.

export type SfxName =
  | 'arrow' | 'cannon' | 'magic' | 'lightning' | 'hit' | 'explosion'
  | 'coin' | 'build' | 'sell' | 'upgrade' | 'die' | 'leak' | 'horn'
  | 'victory' | 'defeat' | 'meteor' | 'reinforce' | 'heal' | 'click'
  | 'error' | 'crit' | 'poison'

export class AudioSystem {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null   // SFX bus
  private musicGain: GainNode | null = null // independent music bus
  private musicTimer: number | null = null
  private musicPlaying = false
  private muted = false
  private musicMuted = false
  private lastPlay = new Map<string, number>()

  init(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.5
    this.master.connect(this.ctx.destination)
    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0
    this.musicGain.connect(this.ctx.destination)
  }

  resume(): void {
    this.ctx?.resume()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02)
  }

  private applyMusicGain(): void {
    if (!this.musicGain || !this.ctx) return
    const target = this.musicMuted || !this.musicPlaying ? 0 : 0.16
    this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12)
  }

  setMusicMuted(m: boolean): void {
    this.musicMuted = m
    this.applyMusicGain()
  }

  isMuted(): boolean { return this.muted }
  isMusicMuted(): boolean { return this.musicMuted }

  /** Fire-and-forget SFX. Rate-limited per name so swarms don't clip. */
  play(name: SfxName, volume = 1): void {
    if (!this.ctx || !this.master || this.muted) return
    const now = performance.now()
    const last = this.lastPlay.get(name) ?? 0
    const minGap = name === 'hit' || name === 'arrow' ? 45 : 25
    if (now - last < minGap) return
    this.lastPlay.set(name, now)
    try { this.synth(name, volume) } catch { /* audio must never crash the game */ }
  }

  /**
   * What the score should be reacting to. Updated cheaply from the game each
   * second; changes are only committed on a bar boundary so the music never
   * lurches mid-phrase.
   */
  setMusicState(st: Partial<MusicState>): void {
    Object.assign(this.musicState, st)
  }

  private musicState: MusicState = { pressure: 0, surge: false, boss: false, livesRatio: 1, phase: 'idle' }

  startMusic(): void {
    this.musicPlaying = true
    this.applyMusicGain()
    if (!this.ctx || this.musicTimer !== null) return
    // Bars were driven by setTimeout, which drifts and can be throttled by a
    // background tab. They are scheduled against the audio clock now, one bar
    // ahead, so the pulse stays locked to the music rather than the event loop.
    this.nextBarAt = this.ctx.currentTime + 0.05
    const pump = () => {
      if (!this.ctx || !this.musicPlaying) return
      while (this.nextBarAt < this.ctx.currentTime + BAR_LOOKAHEAD) {
        this.playMusicBar(this.nextBarAt)
        this.nextBarAt += BAR_SECONDS
      }
      this.musicTimer = window.setTimeout(pump, 240)
    }
    pump()
  }

  private nextBarAt = 0

  stopMusic(): void {
    this.musicPlaying = false
    this.applyMusicGain()  // fade out anything already scheduled
    if (this.musicTimer !== null) { clearTimeout(this.musicTimer); this.musicTimer = null }
  }

  // ---- internals ----

  private tone(freq: number, dur: number, opts: {
    type?: OscillatorType, vol?: number, attack?: number, decay?: number,
    slide?: number, delay?: number, dest?: AudioNode,
  } = {}): void {
    const ctx = this.ctx!
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = opts.type ?? 'sine'
    osc.frequency.setValueAtTime(freq, t0)
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + opts.slide), t0 + dur)
    const vol = opts.vol ?? 0.2
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(vol, t0 + (opts.attack ?? 0.005))
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain).connect(opts.dest ?? this.master!)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  private noise(dur: number, opts: {
    vol?: number, filterFreq?: number, filterQ?: number, type?: BiquadFilterType,
    slide?: number, delay?: number,
  } = {}): void {
    const ctx = this.ctx!
    const t0 = ctx.currentTime + (opts.delay ?? 0)
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = opts.type ?? 'lowpass'
    filt.frequency.setValueAtTime(opts.filterFreq ?? 1200, t0)
    if (opts.slide) filt.frequency.exponentialRampToValueAtTime(Math.max(30, (opts.filterFreq ?? 1200) + opts.slide), t0 + dur)
    filt.Q.value = opts.filterQ ?? 0.8
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(opts.vol ?? 0.2, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filt).connect(gain).connect(this.master!)
    src.start(t0)
  }

  private synth(name: SfxName, v: number): void {
    switch (name) {
      case 'arrow':
        this.noise(0.08, { vol: 0.1 * v, filterFreq: 3000, type: 'highpass' })
        break
      case 'cannon':
        this.noise(0.35, { vol: 0.3 * v, filterFreq: 400, slide: -320 })
        this.tone(90, 0.3, { type: 'sine', vol: 0.3 * v, slide: -55 })
        break
      case 'magic':
        this.tone(880, 0.18, { type: 'sine', vol: 0.12 * v, slide: 660 })
        this.tone(1320, 0.14, { type: 'triangle', vol: 0.07 * v, slide: 880, delay: 0.02 })
        break
      case 'lightning':
        this.noise(0.14, { vol: 0.2 * v, filterFreq: 5000, type: 'highpass' })
        this.tone(220, 0.12, { type: 'sawtooth', vol: 0.1 * v, slide: -160 })
        break
      case 'hit':
        this.noise(0.05, { vol: 0.1 * v, filterFreq: 900 })
        break
      case 'explosion':
        this.noise(0.5, { vol: 0.35 * v, filterFreq: 600, slide: -520 })
        this.tone(70, 0.4, { type: 'sine', vol: 0.25 * v, slide: -40 })
        break
      case 'coin':
        this.tone(1100, 0.07, { type: 'square', vol: 0.05 * v })
        this.tone(1560, 0.12, { type: 'square', vol: 0.05 * v, delay: 0.06 })
        break
      case 'build':
        this.noise(0.06, { vol: 0.18 * v, filterFreq: 1600 })
        this.noise(0.06, { vol: 0.16 * v, filterFreq: 1900, delay: 0.11 })
        this.tone(520, 0.1, { type: 'triangle', vol: 0.1 * v, delay: 0.2 })
        break
      case 'sell':
        this.tone(760, 0.09, { type: 'square', vol: 0.07 * v, slide: -300 })
        this.tone(500, 0.12, { type: 'square', vol: 0.06 * v, delay: 0.08, slide: -200 })
        break
      case 'upgrade':
        this.tone(420, 0.1, { type: 'triangle', vol: 0.12 * v })
        this.tone(630, 0.1, { type: 'triangle', vol: 0.12 * v, delay: 0.08 })
        this.tone(840, 0.18, { type: 'triangle', vol: 0.12 * v, delay: 0.16 })
        break
      case 'die':
        this.noise(0.18, { vol: 0.12 * v, filterFreq: 700, slide: -500 })
        break
      case 'leak':
        this.tone(660, 0.15, { type: 'square', vol: 0.14 * v, slide: -220 })
        this.tone(440, 0.2, { type: 'square', vol: 0.14 * v, delay: 0.13, slide: -180 })
        break
      case 'horn':
        // the wave horn quotes the motif, so the theme is stated dozens of
        // times a battle without ever being the melody
        this.tone(196, 0.5, { type: 'sawtooth', vol: 0.12 * v, attack: 0.08 })
        this.tone(294, 0.5, { type: 'sawtooth', vol: 0.1 * v, attack: 0.08, delay: 0.05 })
        MOTIF.forEach((step, i) =>
          this.tone(392 * SEMITONE ** step, 0.34, {
            type: 'sawtooth', vol: 0.085 * v, attack: 0.02, delay: 0.3 + i * 0.15,
          }))
        break
      case 'victory':
        // the motif again, opened out and in the major
        MOTIF.forEach((step, i) =>
          this.tone(523 * SEMITONE ** step, 0.4, { type: 'triangle', vol: 0.14 * v, delay: i * 0.16 }))
        this.tone(1047, 0.7, { type: 'triangle', vol: 0.11 * v, delay: 0.66 })
        break
      case 'defeat':
        [330, 262, 220, 165].forEach((f, i) =>
          this.tone(f, 0.5, { type: 'sawtooth', vol: 0.1 * v, delay: i * 0.24, attack: 0.05 }))
        break
      case 'meteor':
        this.noise(0.7, { vol: 0.25 * v, filterFreq: 2500, slide: -2200 })
        break
      case 'reinforce':
        this.tone(392, 0.12, { type: 'triangle', vol: 0.12 * v })
        this.tone(523, 0.16, { type: 'triangle', vol: 0.12 * v, delay: 0.09 })
        break
      case 'heal':
        this.tone(700, 0.2, { type: 'sine', vol: 0.08 * v, slide: 300 })
        break
      case 'click':
        this.noise(0.03, { vol: 0.08 * v, filterFreq: 2400 })
        break
      case 'error':
        this.tone(180, 0.14, { type: 'square', vol: 0.09 * v })
        break
      case 'crit':
        this.noise(0.1, { vol: 0.2 * v, filterFreq: 2000, type: 'bandpass', filterQ: 2 })
        this.tone(1400, 0.1, { type: 'square', vol: 0.06 * v, slide: -700 })
        break
      case 'poison':
        this.tone(300, 0.2, { type: 'sine', vol: 0.06 * v, slide: -120 })
        break
    }
  }

  /**
   * The score.
   *
   * It used to be one 4.8s loop of four chords with one to three randomly
   * chosen pentatonic notes on top, and a 40% chance of skipping each. That
   * is unauthored rather than adaptive: no phrase, no motif, nothing to
   * remember, and nothing in the game ever reached it.
   *
   * Synthesis was never the weakness. There is a fixed four-note Blockhold
   * motif now, and the arrangement around it answers the battle: a pulse once
   * enemies are on the road, percussion and bass as they close on the gate,
   * Veil detuning during a surge, and a boss ostinato that takes the whole
   * harmony down a tone.
   */
  private musicStep = 0

  private playMusicBar(at: number): void {
    if (!this.ctx || !this.musicGain || this.musicMuted || !this.musicPlaying) return
    const st = this.musicState
    const bar = this.musicStep++
    const g = this.musicGain
    const now = this.ctx.currentTime
    const when = (offset = 0) => at - now + offset

    // a boss drags the whole key down a tone; a surge sharpens it
    const key = st.boss ? 0.891 : 1
    const detune = st.surge ? 1.012 : 1

    const chords = [
      [110, 164.8, 220, 261.6],  // Am add9
      [87.3, 130.8, 174.6, 220], // F
      [98, 146.8, 196, 246.9],   // G
      [110, 164.8, 220, 329.6],  // Am
    ]
    const chord = chords[bar % chords.length].map(f => f * key)

    // base drone: always there, the floor of the piece
    for (const f of chord) {
      this.tone(f, BAR_SECONDS * 0.95, { type: 'sine', vol: 0.05, attack: 1.2, delay: when(), dest: g })
      this.tone(f * 2.001 * detune, BAR_SECONDS * 0.9, { type: 'triangle', vol: 0.013, attack: 1.6, delay: when(), dest: g })
    }

    // THE MOTIF: four fixed notes, stated on the first bar of every phrase.
    // A theme needs a landmark that does not move.
    if (bar % 4 === 0) {
      const root = chord[0] * 4
      MOTIF.forEach((step, i) => {
        this.tone(root * SEMITONE ** step, 0.55, {
          type: 'triangle', vol: 0.05, attack: 0.01,
          delay: when(i * 0.42), dest: g,
        })
      })
    }

    // motion: a pulse once anything is walking the road
    if (st.pressure > 0.02) {
      const beats = 4
      for (let b = 0; b < beats; b++) {
        this.tone(chord[0] * 0.5, 0.16, {
          type: 'sine', vol: 0.05 + st.pressure * 0.05, attack: 0.005,
          delay: when(b * (BAR_SECONDS / beats)), dest: g,
        })
      }
    }

    // pressure: as the field fills and the gate gets close, the bar fills in
    if (st.pressure > 0.35) {
      for (let b = 0; b < 8; b++) {
        if (b % 2 === 0) continue
        this.tone(1800, 0.05, {
          type: 'square', vol: 0.012 * st.pressure, attack: 0.002,
          delay: when(b * (BAR_SECONDS / 8)), dest: g,
        })
      }
    }

    // boss: a flat, insistent ostinato underneath everything
    if (st.boss) {
      for (let b = 0; b < 4; b++) {
        this.tone(chord[0] * 0.5, 0.5, {
          type: 'sawtooth', vol: 0.035, attack: 0.01,
          delay: when(b * (BAR_SECONDS / 4)), dest: g,
        })
      }
    }

    // the gate in danger: a low toll on the downbeat
    if (st.livesRatio < 0.34) {
      this.tone(chord[0] * 0.25, 1.6, {
        type: 'sine', vol: 0.06, attack: 0.02,
        delay: when(), dest: g,
      })
    }
  }
}

/** what the arrangement reacts to */
export interface MusicState {
  /** 0..1 - how much is on the road and how close it is to the gate */
  pressure: number
  surge: boolean
  boss: boolean
  /** 0..1 - lives remaining */
  livesRatio: number
  phase: string
}

/** one bar, and how far ahead of the audio clock bars are scheduled */
const BAR_SECONDS = 4.8
const BAR_LOOKAHEAD = 0.6
const SEMITONE = 2 ** (1 / 12)

/**
 * The Blockhold motif: four notes, fixed forever. The title, the wave horn,
 * a boss arriving, victory and defeat are all meant to quote it, so that the
 * game has one thing a player could actually hum back.
 */
export const MOTIF = [0, 7, 5, 3]

export const audio = new AudioSystem()
