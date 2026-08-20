import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadSave } from '../src/core/save.ts'

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
      expect(loadSave()).toEqual({ unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {}, lastHero: 'aldric', sfxMuted: false, musicMuted: false })
    }
  })

  it('returns defaults for invalid JSON without throwing', () => {
    getItem.mockReturnValue('{ definitely not json')

    expect(loadSave()).toEqual({ unlocked: 1, stars: {}, armory: {}, bestEndless: {}, bestScore: {}, medals: {}, lastHero: 'aldric', sfxMuted: false, musicMuted: false })
  })
})
