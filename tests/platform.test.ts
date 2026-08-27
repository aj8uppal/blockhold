import { describe, expect, it } from 'vitest'
import { isPortalMode, acquisitionSource } from '../src/core/platform.ts'

describe('portal hosting', () => {
  it('can be forced on for testing outside a real frame', () => {
    expect(isPortalMode('?portal=1')).toBe(true)
  })

  it('reads an explicit source tag', () => {
    expect(acquisitionSource('?src=CrazyGames', '')).toBe('crazygames')
    expect(acquisitionSource('?src=poki', '')).toBe('poki')
  })

  it('falls back to the embedding host, not the full referrer', () => {
    expect(acquisitionSource('', 'https://www.crazygames.com/game/blockhold?utm=x'))
      .toBe('crazygames.com')
  })

  it('reports direct arrivals plainly', () => {
    expect(acquisitionSource('', '')).toBe('direct')
    expect(acquisitionSource('', 'not a url')).toBe('direct')
  })

  it('never records a path or query from the referrer', () => {
    const src = acquisitionSource('', 'https://example.test/secret/path?token=abc')
    expect(src).toBe('example.test')
    expect(src).not.toContain('token')
    expect(src).not.toContain('secret')
  })
})
