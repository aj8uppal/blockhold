import { describe, it, expect } from 'vitest'
import { blankHold, HOLD_IDS, HOLD_MAPS, HOLD_PATHS, HOLD_FAMILIES, sanitizeHold, sanitizeHoldSnapshot, mergeHold, placementError } from '../src/core/holdData.ts'
import { parseSave, exportSave, importSave } from '../src/core/save.ts'
import { sanitizeCloudSave, mergeSaves } from '../src/core/saveMerge.ts'
import { toCloud, applyCloud } from '../src/core/cloud.ts'
import { holdCatalog, effectivePieces, holdSnapshot, ownedHold } from '../src/hold/catalog.ts'
import { encodeVisit, decodeVisit } from '../src/hold/visit.ts'
import { levels } from '../src/game/levels.ts'
const fresh = () => parseSave({})!
const completed = () => parseSave({ xp: 50000, stars: Object.fromEntries(HOLD_MAPS.map(id => [id, 3])), medals: Object.fromEntries(HOLD_MAPS.map(id => [id, ['veteran', 'noleak']])), capstones: HOLD_FAMILIES.flatMap(id => [`${id}:0`, `${id}:1`]), honors: [...HOLD_FAMILIES.flatMap(id => [`mastery:${id}:ossuary`, `mastery:${id}:empress`]), ...['aldric', 'liora', 'zephyra'].flatMap(id => [`hero:${id}:ossuary`, `hero:${id}:empress`]), 'hunt:ossuary:normal', 'hunt:empress:normal'], dailyBest: { day: 1, won: true, wave: 16, score: 100 }, bestFreeplay: { 'greenhollow:normal': 100 } })!
describe('Your Hold progression and layout', () => {
  it('covers every authored map and reward exactly once', () => {
    expect(new Set(HOLD_MAPS)).toEqual(new Set(levels.map(l => l.id)))
    expect(new Set(HOLD_IDS).size).toBe(HOLD_IDS.length)
    expect(holdCatalog(completed()).filter(r => r.owned).length).toBe(HOLD_IDS.length)
    expect(holdCatalog(fresh()).filter(r => r.owned).every(r => r.category === 'Landscape')).toBe(true)
  })
  it('fills every owned piece without collisions, including late accounts', () => {
    const save = completed(), layout = effectivePieces(save)
    expect(layout.length).toBe(HOLD_IDS.length)
    for (const p of layout) expect(placementError(p, layout)).toBeNull()
    expect(effectivePieces(save)).toEqual(layout)
  })
  it('keeps removed pieces in storage but auto-adds new rewards', () => {
    const save = fresh(); save.hold = { ...blankHold(), stored: ['tree:0'] }
    const before = effectivePieces(save)
    save.stars.greenhollow = 1
    expect(effectivePieces(save).some(p => p.id === 'watch:greenhollow')).toBe(true)
    expect(effectivePieces(save).some(p => p.id === 'tree:0')).toBe(false)
    expect(effectivePieces(save).length).toBe(before.length + 1)
  })
  it('honors exact hero-path, mastery, stars and flawless gates', () => {
    const s = fresh(); s.stars.greenhollow = 2; s.honors = ['hero:aldric:empress', 'mastery:seraph:ossuary', 'mastery:seraph:empress']; s.xp = 13223
    const has = (id: string) => holdCatalog(s).find(r => r.id === id)!.owned
    expect(has('watch:greenhollow')).toBe(true); expect(has('banner:greenhollow')).toBe(false); expect(has('statue:greenhollow')).toBe(false)
    expect(has('hero:bulwark')).toBe(true); expect(has('hero:vanguard')).toBe(false); expect(has('mastery:seraph')).toBe(false)
    s.xp++; expect(has('mastery:seraph')).toBe(true)
    expect(HOLD_PATHS.length).toBe(6)
  })
  it('does not infer ownership from a placed piece or a chosen locked style', () => {
    const s = fresh(); s.hold = { ...blankHold(), theme: 'void', keep: 'gilded', placements: [{ id: 'mastery:seraph', x: 0, z: 0, r: 0 }] }
    expect(ownedHold(s)).toMatchObject({ theme: 'forest', keep: 'stone', placements: [] })
    expect(holdCatalog(s).find(r => r.id === 'mastery:seraph')!.owned).toBe(false)
  })
  it('rejects duplicate, overlapping, out-of-bounds, reserved and unknown placements', () => {
    const bad = { ...blankHold(), placements: [{ id: 'tree:0', x: 0, z: 0, r: 0 }, { id: 'tree:0', x: 1, z: 1, r: 0 }, { id: 'tree:1', x: 0, z: 0, r: 0 }, { id: 'rock:0', x: 6, z: 8, r: 0 }, { id: 'rock:1', x: -1, z: 4, r: 0 }, { id: 'hack', x: 3, z: 3, r: 0 }] }
    expect(sanitizeHold(bad)!.placements).toEqual([{ id: 'tree:0', x: 0, z: 0, r: 0 }])
    expect(sanitizeHold({ version: 99 })).toBeUndefined()
  })
  it('bounds names, timestamps and IDs', () => {
    const r = sanitizeHold({ ...blankHold(), name: '<script>\u0000' + 'a'.repeat(100), updatedAt: Number.MAX_SAFE_INTEGER, seen: ['unknown', ...HOLD_IDS, ...HOLD_IDS] }, 1000)!
    expect(r.name.length).toBe(24); expect(r.name).not.toContain('<'); expect(r.updatedAt).toBe(301000); expect(r.seen.length).toBe(HOLD_IDS.length)
  })
})
describe('Hold saving, merging and private visits', () => {
  it('merges layouts atomically by their own timestamp, including deterministic ties', () => {
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
    expect(holdCatalog(applyCloud(fresh(), merged)).find(r => r.id === 'daily:relic')!.owned).toBe(true)
  })
  it('survives old cloud responses and backup round trips', () => {
    const s = completed(); s.hold = { ...blankHold(), name: 'Quiet Watch', placements: effectivePieces(s), stored: ['tree:2'], updatedAt: Date.now() }
    const round = importSave(exportSave(s))!
    expect(round.hold?.name).toBe('Quiet Watch')
    expect(applyCloud(round, toCloud(fresh())).hold).toEqual(round.hold)
    expect(mergeSaves(toCloud(round), toCloud(fresh())).hold).toEqual(round.hold)
  })
  it('public snapshots round trip without any private save fields', () => {
    const s = completed(); s.hold = { ...blankHold(), name: '月の城' }
    const snap = holdSnapshot(s, s.hold, 100), encoded = encodeVisit(snap), copy = decodeVisit(encoded)
    expect(copy).toEqual(sanitizeHoldSnapshot(snap)); expect(encoded.length).toBeLessThan(8000)
    expect(Object.keys(copy!).sort()).toEqual(['version', 'name', 'theme', 'color', 'keep', 'pieces', 'date'].sort())
    expect(s.hold!.placements).toEqual([])
    expect(decodeVisit('!invalid')).toBeNull(); expect(decodeVisit('a'.repeat(8001))).toBeNull()
    expect(sanitizeHoldSnapshot({ ...snap, version: 2 })).toBeNull()
    expect(sanitizeHoldSnapshot({ ...snap, pieces: [...snap.pieces, snap.pieces[0]] })).toBeNull()
  })
})
