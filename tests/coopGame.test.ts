import { describe, expect, it, vi } from 'vitest'
import { Game } from '../src/game/game.ts'
import { CoopClock } from '../src/core/coopClock.ts'
import type { CoopEvent } from '../src/core/coop.ts'

/** Use the actual turn dispatcher with a tiny simulation whose entire state is observable. */
function client(speed = 1) {
  const trace: string[] = []
  let ticks = 0
  const game = Object.assign(Object.create(Game.prototype), {
    phase: 'playing', paused: false, speed, hitstopT: 0,
    coop: { ticksPerTurn: 12 }, coopBudget: 0, coopClock: new CoopClock(),
    coopMarkers: [], coopCmds: new Map(), coopWaitingT: 0,
    hud: { setCoopWaiting: vi.fn(), setPaused: vi.fn(), showToast: vi.fn() },
    simStep: () => { ticks++; trace.push(`tick:${ticks}`) },
    applyCoopCommand: (cmd: { kind: string }, seat: number) => trace.push(`${cmd.kind}:${seat}@${ticks}`),
    sendCoopHash: (turn: number) => trace.push(`hash:${turn}@${ticks}`),
  }) as { coopAdvance(dt: number, h: number): void, onCoopEvent(e: CoopEvent): void }
  return { game, trace, ticks: () => ticks }
}

describe('co-op turn dispatch', () => {
  it('applies commands at identical ticks despite bursty delivery and different frame rates', () => {
    const a = client(), b = client()
    for (let n = 1; n <= 30; n++) {
      const command = { type: 'cmd', turn: n, seat: n % 2, cmd: { kind: 'wave' } } as const
      const marker = { type: 'turn', n, ticks: 12 } as const
      a.game.onCoopEvent(command); a.game.onCoopEvent(marker)
      for (let i = 0; i < 12; i++) a.game.coopAdvance(1 / 60, 1 / 60)
      b.game.onCoopEvent(command); b.game.onCoopEvent(marker)
      if (n % 3 === 0) for (let i = 0; i < 24; i++) b.game.coopAdvance(1 / 40, 1 / 60)
    }
    for (let i = 0; i < 120; i++) {
      a.game.coopAdvance(1 / 60, 1 / 60)
      b.game.coopAdvance(1 / 40, 1 / 60)
    }
    expect(a.ticks()).toBe(360)
    expect(b.trace).toEqual(a.trace)
    expect(a.trace).toContain('wave:1@0')
    expect(a.trace).toContain('wave:0@12')
  })

  it('drains zero-tick paused turns without advancing the simulation', () => {
    const c = client(2)
    c.game.onCoopEvent({ type: 'pause', on: true, seat: 0 })
    for (let n = 1; n <= 10; n++) c.game.onCoopEvent({ type: 'turn', n, ticks: 0 })
    c.game.coopAdvance(1 / 60, 1 / 60)
    expect(c.ticks()).toBe(0)
    c.game.onCoopEvent({ type: 'pause', on: false, seat: 0 })
    c.game.onCoopEvent({ type: 'cmd', seat: 0, turn: 11, cmd: { kind: 'wave' } })
    c.game.onCoopEvent({ type: 'turn', n: 11, ticks: 24 })
    c.game.onCoopEvent({ type: 'turn', n: 12, ticks: 24 })
    c.game.coopAdvance(1 / 60, 1 / 60)
    expect(c.ticks()).toBe(2)
    expect(c.trace[0]).toBe('wave:0@0')
  })
})
