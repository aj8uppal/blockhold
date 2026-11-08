import { describe, expect, it, vi, afterEach } from 'vitest'
import { isPortalMode, acquisitionSource, shareBase, sitePage } from '../src/core/platform.ts'
import { challengeUrl } from '../src/game/share.ts'

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

describe('links that leave the device', () => {
  const at = (href: string) => {
    const u = new URL(href)
    vi.stubGlobal('location', { href: u.href, protocol: u.protocol, search: u.search })
    vi.stubGlobal('window', {})
  }
  afterEach(() => vi.unstubAllGlobals())

  it('point a link shared from the iOS app at the public site, never at capacitor://', () => {
    at('capacitor://localhost/?portal=0')
    expect(shareBase()).toBe('https://blockhold.app/')
    expect(challengeUrl(42)).toMatch(/^https:\/\/blockhold\.app\/\?hold=/)
    expect(sitePage('privacy.html')).toBe('https://blockhold.app/privacy.html')
  })

  it('keep a browser on the page it is on', () => {
    at('http://localhost:4173/sub/?hold=abc#x')
    expect(shareBase()).toBe('http://localhost:4173/sub/')
    expect(sitePage('support.html')).toBe('http://localhost:4173/sub/support.html')
  })
})
