import { describe, expect, it } from 'vitest'
import { OLD_ORIGIN, mergeCarried, progressChanged, readCarry } from '../src/core/carry.ts'
import { exportSave, parseSave, type SaveData } from '../src/core/save.ts'

const save = (over: Partial<SaveData> = {}): SaveData => ({ ...parseSave({ xp: 0 })!, ...over })

/** what web/legacy/index.html puts in the fragment */
function stubHash(raw: unknown, nick?: string): string {
  const code = btoa(unescape(encodeURIComponent(JSON.stringify({ v: 1, d: raw }))))
  return '#carry=' + encodeURIComponent(code) + (nick ? '&nick=' + encodeURIComponent(nick) : '')
}

describe('readCarry', () => {
  const old = save({ unlocked: 4, stars: { greenhollow: 3, frostmere: 2 }, xp: 900, taughtBasics: true })

  it('takes a save forwarded by the old address', () => {
    const got = readCarry(stubHash(old, 'Ser Brick'), `${OLD_ORIGIN}/`)
    expect(got?.save.unlocked).toBe(4)
    expect(got?.save.stars).toEqual({ greenhollow: 3, frostmere: 2 })
    expect(got?.save.taughtBasics).toBe(true)
    expect(got?.nickname).toBe('Ser Brick')
  })

  it('reads the code the game itself exports', () => {
    expect(readCarry('#carry=' + encodeURIComponent(exportSave(old)), `${OLD_ORIGIN}/blockhold/`)?.save.xp).toBe(900)
  })

  it('survives base64 that holds + and /', () => {
    // enough varied bytes that the code is certain to contain both
    const busy = save({ stars: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`m${i}?>~`, i % 4])) })
    const hash = stubHash(busy)
    expect(decodeURIComponent(hash.slice(7))).toMatch(/[+/]/)
    expect(Object.keys(readCarry(hash, OLD_ORIGIN + '/')!.save.stars)).toHaveLength(40)
  })

  it('ignores the same link arriving from anywhere else', () => {
    const hash = stubHash(old)
    expect(readCarry(hash, '')).toBeNull()
    expect(readCarry(hash, 'https://someone.github.io/')).toBeNull()
    expect(readCarry(hash, 'https://aj8uppal.github.io.example.com/')).toBeNull()
    expect(readCarry(hash, 'http://aj8uppal.github.io/')).toBeNull()
    expect(readCarry(hash, 'https://blockhold.app/')).toBeNull()
  })

  it('ignores anything that is not a save', () => {
    expect(readCarry('#carry=bm90IGEgc2F2ZQ', OLD_ORIGIN + '/')).toBeNull()
    expect(readCarry('#carry=%%%', OLD_ORIGIN + '/')).toBeNull()
    expect(readCarry('#blockhold_auth=x', OLD_ORIGIN + '/')).toBeNull()
    expect(readCarry('', OLD_ORIGIN + '/')).toBeNull()
  })

  it('keeps a nickname to the characters the leaderboard allows', () => {
    expect(readCarry(stubHash(old, '<b>Robert</b>"; drop'), OLD_ORIGIN + '/')?.nickname).toBe('bRobertb drop')
  })

  it('still clamps whatever the carried save claims', () => {
    expect(readCarry(stubHash({ unlocked: 99, stars: { greenhollow: 9 } }), OLD_ORIGIN + '/')?.save)
      .toMatchObject({ unlocked: 16, stars: { greenhollow: 3 } })
  })
})

describe('mergeCarried', () => {
  it('takes the carried save whole when nothing is stored here yet', () => {
    const carried = save({ unlocked: 5, sfxMuted: true, changedAt: 1000 })
    expect(mergeCarried(save(), false, carried)).toEqual(carried)
  })

  it('keeps everything earned on either side once the player has started again here', () => {
    const here = save({
      unlocked: 2, stars: { greenhollow: 1, ashfall: 2 }, xp: 120, seenEnemies: ['husk'],
      armory: { arrow: 1 }, musicMuted: true, changedAt: 5000,
    })
    const carried = save({
      unlocked: 6, stars: { greenhollow: 3, frostmere: 2 }, xp: 4000, taughtBasics: true,
      seenEnemies: ['husk', 'brute'], armory: { arrow: 3, mage: 2 }, changedAt: 2000,
    })
    const merged = mergeCarried(here, true, carried)
    expect(merged.unlocked).toBe(6)
    expect(merged.stars).toEqual({ greenhollow: 3, ashfall: 2, frostmere: 2 })
    expect(merged.xp).toBe(4000)
    expect(merged.taughtBasics).toBe(true)
    expect(merged.seenEnemies.sort()).toEqual(['brute', 'husk'])
    // the Armory is a choice, and the copy here is the newer one
    expect(merged.armory).toEqual({ arrow: 1 })
    // sound belongs to this page as it is now
    expect(merged.musicMuted).toBe(true)
    // a merge is not a new choice, so it keeps the newest real stamp
    expect(merged.changedAt).toBe(5000)
  })

  it('lets the carried copy decide the choices when it is the newer one', () => {
    const merged = mergeCarried(save({ armory: { arrow: 1 }, lastHero: 'aldric', changedAt: 100 }), true,
      save({ armory: { mage: 2 }, lastHero: 'liora', changedAt: 900 }))
    expect(merged.armory).toEqual({ mage: 2 })
    expect(merged.lastHero).toBe('liora')
  })
})

describe('progressChanged', () => {
  const base = save({ stars: { greenhollow: 2 }, seenEnemies: ['husk', 'brute'] })

  it('is quiet when the carried copy adds nothing', () => {
    expect(progressChanged(base, mergeCarried(base, true, save({ stars: { greenhollow: 1 } })))).toBe(false)
    expect(progressChanged(base, { ...base, seenEnemies: ['brute', 'husk'], changedAt: 99 })).toBe(false)
  })

  it('notices a star', () => {
    expect(progressChanged(base, mergeCarried(base, true, save({ stars: { frostmere: 1 } })))).toBe(true)
  })
})
