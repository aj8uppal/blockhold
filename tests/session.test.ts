import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSave } from '../src/core/save.ts'
import type { CoopCommand } from '../src/game/coopCommands.ts'
import { RULESET_VERSION } from '../src/game/ruleset.ts'
import {
  readSession, readSessionIssue, writeSession, clearSession,
  SESSION_MAX_COMMANDS, SESSION_MAX_TICKS, type BattleSession,
} from '../src/game/session.ts'

const KEY = 'blockhold.session.v1'
let store: Record<string, string>
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
  })
  readSession()
})

const sample = (extra: Partial<BattleSession> = {}): BattleSession => ({
  ruleset: RULESET_VERSION, levelId: 'greenhollow', difficulty: 'normal', heroId: 'aldric', mode: 'campaign',
  seed: 123, tick: 1800, commands: [{ tick: 0, cmd: { kind: 'build', plot: 1, tower: 'arrow' } }, { tick: 6, cmd: { kind: 'wave' } }],
  initialSave: parseSave({ xp: 14000, honors: ['hero:aldric:ossuary'], heroPaths: { aldric: 'bulwark' } })!,
  savedAt: 1789000000000, wave: 4,
  ...extra,
})

describe('deterministic session journal', () => {
  it('round-trips an exact mid-wave hunt with frozen permissions and ordered simultaneous inputs', () => {
    const session = sample({ hunt: 'ossuary', commands: [
      { tick: 0, cmd: { kind: 'build', plot: 1, tower: 'seraph' } },
      { tick: 0, cmd: { kind: 'upgrade', plot: 1, opt: 0 } },
      { tick: 1800, cmd: { kind: 'heroSig' } },
    ] })
    expect(writeSession(session)).toBe(true)
    expect(readSession()).toEqual(session)
    session.initialSave.heroPaths.aldric = 'vanguard'
    session.commands.pop()
    expect(readSession()?.initialSave.heroPaths.aldric).toBe('bulwark')
    expect(readSession()?.commands).toHaveLength(3)
    expect(readSessionIssue()).toBeNull()
  })

  it('accepts all existing command shapes and strips unknown command data', () => {
    const commands: CoopCommand[] = [
      { kind: 'build', plot: 0, tower: 'barracks' }, { kind: 'upgrade', plot: 1, opt: 1 },
      { kind: 'sell', plot: 2 }, { kind: 'ascend', plot: 3, perk: 0 },
      { kind: 'overcharge', plot: 1 }, { kind: 'mythic', plot: 1 }, { kind: 'policy', plot: 1 }, { kind: 'trackline', plot: 1 },
      { kind: 'holdline', plot: 1, x: -2.5, z: 1.25 }, { kind: 'rally', plot: 1, x: 2, z: -1 },
      { kind: 'trap', spot: 1, trap: 'frost' }, { kind: 'sellTrap', spot: 1 }, { kind: 'earthwork', spot: 1 },
      { kind: 'raise', plot: 1 }, { kind: 'wave' }, { kind: 'heroMove', x: 1, z: 2 },
      { kind: 'heroSig' }, { kind: 'heroRank' }, { kind: 'meteor', x: 1, z: 1 },
      { kind: 'reinforce', x: 2, z: 2 }, { kind: 'hold' },
    ]
    const session = sample({ commands: commands.map((cmd, tick) => ({ tick, cmd: { ...cmd, ignored: true } as CoopCommand })) })
    expect(writeSession(session)).toBe(true)
    expect(readSession()?.commands.map(e => e.cmd)).toEqual(commands)
  })

  it('rejects missing, unknown, nonfinite, fractional and out-of-bounds command fields', () => {
    const bad = [
      { kind: 'build', plot: 0, tower: 'foreign' }, { kind: 'trap', spot: 1, trap: 'foreign' },
      { kind: 'deleteEverything' }, { kind: 'upgrade', plot: 1, opt: 2 }, { kind: 'ascend', plot: 1, perk: -1 },
      { kind: 'sell', plot: -1 }, { kind: 'sell', plot: 0.5 }, { kind: 'sell', plot: 4096 },
      { kind: 'earthwork', spot: '1' }, { kind: 'heroMove', x: Infinity, z: 0 },
      { kind: 'rally', plot: 1, x: 0 }, { kind: 'holdline', plot: 1, x: NaN, z: 1 },
      { kind: 'meteor', x: 4097, z: 1 }, { kind: 'reinforce', x: null, z: 1 },
    ]
    for (const cmd of bad) {
      expect(writeSession(sample({ commands: [{ tick: 0, cmd: cmd as CoopCommand }] }))).toBe(false)
    }
  })

  it('rejects reordered or future commands and enforces duration/count bounds without truncation', () => {
    expect(writeSession(sample({ commands: [{ tick: 8, cmd: { kind: 'wave' } }, { tick: 7, cmd: { kind: 'heroSig' } }] }))).toBe(false)
    expect(writeSession(sample({ commands: [{ tick: 1801, cmd: { kind: 'wave' } }] }))).toBe(false)
    expect(writeSession(sample({ commands: [{ tick: -1, cmd: { kind: 'wave' } }] }))).toBe(false)
    expect(writeSession(sample({ tick: SESSION_MAX_TICKS + 1 }))).toBe(false)
    expect(writeSession(sample({ tick: SESSION_MAX_TICKS }))).toBe(true)
    expect(writeSession(sample({ commands: Array.from({ length: SESSION_MAX_COMMANDS + 1 }, () => ({ tick: 0, cmd: { kind: 'wave' } })) }))).toBe(false)
  })

  it('keeps incompatible journal bytes and reports the saved/current rulesets', () => {
    const raw = JSON.stringify(sample({ ruleset: RULESET_VERSION - 1 }))
    store[KEY] = raw
    expect(readSession()).toBeNull()
    expect(readSessionIssue()).toEqual({ kind: 'incompatible', savedRuleset: RULESET_VERSION - 1, currentRuleset: RULESET_VERSION })
    expect(store[KEY]).toBe(raw)
    expect(clearSession()).toBe(true)
    expect(readSessionIssue()).toBeNull()
    expect(readSession()).toBeNull()
  })

  it('fails closed for corrupt headers, invalid saves and invalid hunt modes', () => {
    const bad: unknown[] = [
      null, [], 'foreign', { ...sample(), levelId: '../escape' },
      { ...sample(), seed: -1 }, { ...sample(), tick: 1.5 }, { ...sample(), heroId: 'unknown' },
      { ...sample(), difficulty: 'unknown' }, { ...sample(), hunt: 'unknown' },
      { ...sample(), hunt: 'empress', mode: 'endless' }, { ...sample(), initialSave: [] },
      { ...sample(), initialSave: { stars: {} } }, { ...sample(), commands: {} },
      { ...sample(), savedAt: -1 }, { ...sample(), wave: -1 },
    ]
    for (const value of bad) {
      store[KEY] = JSON.stringify(value)
      expect(readSession()).toBeNull()
      expect(readSessionIssue()?.kind).toBe('invalid')
    }
    store[KEY] = '{not-json'
    expect(readSession()).toBeNull()
    expect(readSessionIssue()?.kind).toBe('invalid')
  })

  it('preserves the previous good journal after invalid or quota-failed writes', () => {
    expect(writeSession(sample())).toBe(true)
    const previous = store[KEY]
    expect(writeSession(sample({ tick: -1 }))).toBe(false)
    expect(store[KEY]).toBe(previous)
    localStorage.setItem = () => { throw new Error('QuotaExceeded') }
    expect(writeSession(sample({ tick: 2000 }))).toBe(false)
    expect(store[KEY]).toBe(previous)
  })

  it('reports denied storage access without throwing', () => {
    localStorage.getItem = () => { throw new Error('SecurityError') }
    expect(readSession()).toBeNull()
    expect(readSessionIssue()).toEqual({ kind: 'storage' })
    localStorage.removeItem = () => { throw new Error('SecurityError') }
    expect(clearSession()).toBe(false)
  })
})
