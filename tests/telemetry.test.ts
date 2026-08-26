import { describe, expect, it, beforeEach } from 'vitest'
import { telemetry, type TelemetryRecord } from '../src/core/telemetry.ts'

beforeEach(() => {
  telemetry.setSink(null)
  telemetry.setEnabled(false)
  telemetry.setEnabled(true)
})

describe('telemetry', () => {
  it('buffers events until a sink is installed', () => {
    telemetry.track({ type: 'session_start', firstRun: true })
    expect(telemetry.peek()).toHaveLength(1)

    let got: TelemetryRecord[] = []
    telemetry.setSink(b => { got = got.concat(b) })
    expect(got).toHaveLength(1)
    expect(got[0].event.type).toBe('session_start')
  })

  // nothing should leave the device just because a refactor added an event
  it('sends nothing anywhere until the owner chooses a destination', () => {
    telemetry.track({ type: 'save_write_failed' })
    telemetry.track({ type: 'share_copied', kind: 'daily' })
    telemetry.flush()
    expect(telemetry.peek()).toHaveLength(2)
  })

  it('drops everything when the player opts out', () => {
    telemetry.setEnabled(false)
    telemetry.track({ type: 'session_start', firstRun: false })
    expect(telemetry.peek()).toHaveLength(0)
    expect(telemetry.isEnabled).toBe(false)
  })

  it('never grows without bound on a long session with no sink', () => {
    for (let i = 0; i < 900; i++) telemetry.track({ type: 'save_write_failed' })
    expect(telemetry.peek().length).toBeLessThanOrEqual(500)
  })

  it('survives a sink that throws rather than breaking a battle', () => {
    telemetry.setSink(() => { throw new Error('sink is down') })
    expect(() => telemetry.track({ type: 'save_write_failed' })).not.toThrow()
    expect(() => telemetry.flush()).not.toThrow()
  })
})
