import { describe, it, expect } from 'vitest'
import { blankHold, HOLD_IDS, HOLD_MAPS, HOLD_PATHS, sanitizeHold, sanitizeHoldSnapshot, mergeHold } from '../src/core/holdData.ts'
import { parseSave, exportSave, importSave } from '../src/core/save.ts'
import { sanitizeCloudSave, mergeSaves } from '../src/core/saveMerge.ts'
import { toCloud, applyCloud } from '../src/core/cloud.ts'
import { trophyCatalog, newTrophies, markTrophiesSeen, nextTrophy } from '../src/game/trophies.ts'
import { levels } from '../src/game/levels.ts'
const fresh = () => parseSave({})!
const FAMILIES = ['arrow', 'mage', 'cannon', 'barracks', 'ballista', 'beacon', 'seraph', 'tidecaller']
const completed = () => parseSave({ xp: 50000, stars: Object.fromEntries(HOLD_MAPS.map(id => [id, 3])), medals: Object.fromEntries(HOLD_MAPS.map(id => [id, ['veteran', 'noleak']])), capstones: FAMILIES.flatMap(id => [`${id}:0`, `${id}:1`]), honors: [...FAMILIES.flatMap(id => [`mastery:${id}:ossuary`, `mastery:${id}:empress`]), ...['aldric', 'liora', 'zephyra'].flatMap(id => [`hero:${id}:ossuary`, `hero:${id}:empress`]), 'hunt:ossuary:normal', 'hunt:empress:normal'], dailyBest: { day: 1, won: true, wave: 16, score: 100 }, bestFreeplay: { 'greenhollow:normal': 100 } })!

describe('trophies', () => {
  it('covers every authored map, and every earnable trophy exactly once', () => {
    expect(new Set(HOLD_MAPS)).toEqual(new Set(levels.map(l => l.id)))
    expect(new Set(HOLD_IDS).size).toBe(HOLD_IDS.length)
    const all = trophyCatalog(completed())
    expect(all.length).toBe(59)
    expect(all.every(t => t.owned && t.name && t.requirement)).toBe(true)
    expect(trophyCatalog(fresh()).some(t => t.owned)).toBe(false)
  })
  it('honors exact hero-path, mastery, stars and flawless gates', () => {
    const s = fresh(); s.stars.greenhollow = 2; s.honors = ['hero:aldric:empress', 'mastery:seraph:ossuary', 'mastery:seraph:empress']; s.xp = 13223
    const has = (id: string) => trophyCatalog(s).find(t => t.id === id)!.owned
    expect(has('watch:greenhollow')).toBe(true); expect(has('banner:greenhollow')).toBe(false); expect(has('statue:greenhollow')).toBe(false)
    expect(has('hero:bulwark')).toBe(true); expect(has('hero:vanguard')).toBe(false); expect(has('mastery:seraph')).toBe(false)
    s.xp++; expect(has('mastery:seraph')).toBe(true)
    expect(HOLD_PATHS.length).toBe(6)
  })
  it('a courtyard layout from an older save grants nothing', () => {
    const s = fresh(); s.hold = { ...blankHold(), placements: [{ id: 'mastery:seraph', x: 0, z: 0, r: 0 }] }
    expect(trophyCatalog(s).find(t => t.id === 'mastery:seraph')!.owned).toBe(false)
  })
  it('counts a trophy as new until the sheet has been opened, and never forgets it was seen', () => {
    const s = fresh(); s.hold = { ...blankHold(), seen: ['tree:0'] }
    expect(newTrophies(s)).toEqual([])
    s.stars.greenhollow = 3
    expect(newTrophies(s).map(t => t.id)).toEqual(['watch:greenhollow', 'banner:greenhollow'])
    expect(markTrophiesSeen(s)).toBe(true)
    expect(newTrophies(s)).toEqual([])
    expect(s.hold.seen).toContain('tree:0')
    expect(markTrophiesSeen(s)).toBe(false)
  })
  it('points at the next map to win before anything harder', () => {
    const s = fresh()
    expect(nextTrophy(trophyCatalog(s))?.id).toBe('watch:greenhollow')
    s.stars.greenhollow = 1
    expect(nextTrophy(trophyCatalog(s))?.id).toBe('watch:frostmere')
    for (const id of HOLD_MAPS) s.stars[id] = 1
    expect(nextTrophy(trophyCatalog(s))?.kind).toBe('banner')
    expect(nextTrophy(trophyCatalog(completed()))).toBeUndefined()
  })
})

describe('Hold records in saves', () => {
  it('rejects malformed records and bounds names, timestamps and IDs', () => {
    expect(sanitizeHold({ version: 99 })).toBeUndefined()
    const r = sanitizeHold({ ...blankHold(), name: '<script>\u0000' + 'a'.repeat(100), updatedAt: Number.MAX_SAFE_INTEGER, seen: ['unknown', ...HOLD_IDS, ...HOLD_IDS] }, 1000)!
    expect(r.name.length).toBe(24); expect(r.name).not.toContain('<'); expect(r.updatedAt).toBe(301000); expect(r.seen.length).toBe(HOLD_IDS.length)
  })
  it('merges seen trophies by union across devices', () => {
    const a = { ...blankHold(), name: 'East', updatedAt: 10, seen: ['tree:0'], dailyWon: true }, b = { ...blankHold(), name: 'West', updatedAt: 20, seen: ['tree:1'] }
    expect(mergeHold(a, b)).toMatchObject({ name: 'West', seen: ['tree:0', 'tree:1'], dailyWon: true })
    a.updatedAt = 20; expect(mergeHold(a, b)).toEqual(mergeHold(b, a))
    const old = sanitizeCloudSave({ ...fresh(), hold: a, updatedAt: 1000 }), next = sanitizeCloudSave({ ...fresh(), hold: { ...b, updatedAt: 21 }, updatedAt: 100 })
    expect(mergeSaves(old, next).hold!.name).toBe('West')
  })
  it('retains a won daily trophy when a later daily result replaces it', () => {
    const a = toCloud({ ...fresh(), dailyBest: { day: 1, wave: 16, won: true, score: 200 } }), b = toCloud({ ...fresh(), dailyBest: { day: 2, wave: 3, won: false, score: 100 } })
    const merged = mergeSaves(a, b)
    expect(merged.dailyBest!.day).toBe(2); expect(merged.hold!.dailyWon).toBe(true)
    expect(trophyCatalog(applyCloud(fresh(), merged)).find(t => t.id === 'daily:relic')!.owned).toBe(true)
  })
  it('survives old cloud responses and backup round trips', () => {
    const s = completed(); s.hold = { ...blankHold(), name: 'Quiet Watch', placements: [{ id: 'tree:0', x: 0, z: 0, r: 0 }], stored: ['tree:2'], updatedAt: Date.now() }
    const round = importSave(exportSave(s))!
    expect(round.hold?.name).toBe('Quiet Watch')
    expect(applyCloud(round, toCloud(fresh())).hold).toEqual(round.hold)
    expect(mergeSaves(toCloud(round), toCloud(fresh())).hold).toEqual(round.hold)
  })
  it('still validates the courtyard snapshots older co-op clients send', () => {
    const snap = { version: 1, name: 'Old Room', theme: 'forest', color: 'ruby', keep: 'stone', pieces: [{ id: 'tree:0', x: 0, z: 0, r: 0 }], date: 100 }
    expect(sanitizeHoldSnapshot(snap)).toEqual(snap)
    expect(sanitizeHoldSnapshot({ ...snap, version: 2 })).toBeNull()
    expect(sanitizeHoldSnapshot({ ...snap, pieces: [...snap.pieces, snap.pieces[0]] })).toBeNull()
  })
})
