import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSave, exportSave, importSave } from '../src/core/save.ts'

const getItem = vi.fn((_key: string): string | null => null)

beforeEach(() => {
  getItem.mockReset()
  vi.stubGlobal('localStorage', {
    getItem,
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('loadSave', () => {
  it('clamps out-of-range stars and rejects string values', () => {
    getItem.mockReturnValue(JSON.stringify({
      unlocked: 2,
      stars: { tooMany: 4, negative: -1, string: '2' },
    }))

    expect(loadSave().stars).toEqual({ tooMany: 3, negative: 0, string: 0 })
  })

  it('replaces non-finite star values without throwing', () => {
    getItem.mockReturnValue('{}')
    vi.spyOn(JSON, 'parse').mockReturnValueOnce({ stars: { infinite: Infinity } })

    expect(loadSave().stars).toEqual({ infinite: 0 })
  })

  it('clamps NaN, negative, and huge unlocked values', () => {
    getItem.mockReturnValue('{}')
    vi.spyOn(JSON, 'parse')
      .mockReturnValueOnce({ unlocked: NaN })
      .mockReturnValueOnce({ unlocked: -10 })
      .mockReturnValueOnce({ unlocked: 10_000 })

    expect(loadSave().unlocked).toBe(1)
    expect(loadSave().unlocked).toBe(1)
    expect(loadSave().unlocked).toBe(16)
  })

  it('returns defaults for non-object JSON', () => {
    for (const raw of ['null', '42', '"not an object"']) {
      getItem.mockReturnValue(raw)
      expect(loadSave()).toEqual({ unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {}, seenEnemies: [], taughtBasics: false, lastHero: 'aldric', sfxMuted: false, musicMuted: false, xp: 0 })
    }
  })

  it('returns defaults for invalid JSON without throwing', () => {
    getItem.mockReturnValue('{ definitely not json')

    expect(loadSave()).toEqual({ unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {}, seenEnemies: [], taughtBasics: false, lastHero: 'aldric', sfxMuted: false, musicMuted: false, xp: 0 })
  })
})

describe('save durability', () => {
  const sample: SaveData = {
    unlocked: 4, stars: { greenhollow: 3, frostmere: 2 }, armory: { coffers: 1 },
    bestEndless: { greenhollow: 41 }, bestScore: { 'greenhollow:normal': 9100 },
    medals: { greenhollow: ['noleak'] }, seenEnemies: ['juggernaut'], taughtBasics: true, lastHero: 'liora', sfxMuted: false, musicMuted: true, xp: 1234,
  }

  it('round-trips a save through an export code', () => {
    const restored = importSave(exportSave(sample))
    expect(restored).toEqual(sample)
  })

  it('survives whitespace around a pasted code', () => {
    expect(importSave(`\n  ${exportSave(sample)}  \n`)).toEqual(sample)
  })

  it('refuses anything that is not a Blockhold save', () => {
    expect(importSave('not base64 at all !!')).toBeNull()
    expect(importSave(btoa('{"nope":true}'))).toBeNull()
    expect(importSave('')).toBeNull()
  })

  it('validates imported data rather than trusting it', () => {
    // a hand-edited code claiming 999 unlocked levels and 99 stars is clamped
    const evil = btoa(JSON.stringify({ v: 1, d: { ...sample, unlocked: 999, stars: { greenhollow: 99 } } }))
    const restored = importSave(evil)!
    expect(restored.unlocked).toBeLessThanOrEqual(16)
    expect(restored.stars.greenhollow).toBeLessThanOrEqual(3)
  })
})
