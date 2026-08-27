import { describe, expect, it } from 'vitest'
import { dailyBlocks, dailyShareText, challengeUrl, readChallengeSeed, type DailyResult } from '../src/game/share.ts'
import { dailySeed, dailyNumber } from '../src/game/ruleset.ts'
import { dailyLevel, DAILY_WAVES } from '../src/game/levels.ts'

const result = (over: Partial<DailyResult> = {}): DailyResult => ({
  day: 26,
  outcomes: ['held', 'held', 'leaked', 'held'],
  totalWaves: 8,
  wavesReached: 4,
  lives: 11,
  won: false,
  ...over,
})

describe('the daily result block', () => {
  it('draws held, leaked and unreached waves distinctly', () => {
    expect(dailyBlocks(result())).toBe('██▒█░░░░')
  })

  it('fills the bar on a win', () => {
    expect(dailyBlocks(result({ wavesReached: 8, won: true, outcomes: Array(8).fill('held') })))
      .toBe('████████')
  })

  // the point of a share block is that it says how you did, not what you faced
  it('never names an enemy, a map or a tower', () => {
    const text = dailyShareText(result(), 'https://example.test/')
    expect(text).toContain('Blockhold Daily 26')
    expect(text).toContain('Wave 4/8')
    expect(text).not.toMatch(/husk|juggernaut|greenhollow|arrow|cannon/i)
  })

  it('uses no emoji, matching the rest of the interface', () => {
    const text = dailyShareText(result(), 'https://example.test/')
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('challenge links', () => {
  it('round-trips a seed through a link', () => {
    const url = challengeUrl(3735928559, 'https://example.test/')
    expect(readChallengeSeed(new URL(url).search)).toBe(3735928559)
  })

  it('ignores a url with no challenge in it', () => {
    expect(readChallengeSeed('')).toBeNull()
    expect(readChallengeSeed('?other=1')).toBeNull()
    expect(readChallengeSeed('?hold=')).toBeNull()
  })
})

describe('the daily board', () => {
  it('is identical for everyone on the same UTC day, with no server', () => {
    const morning = dailySeed(new Date(Date.UTC(2026, 7, 26, 1)))
    const evening = dailySeed(new Date(Date.UTC(2026, 7, 26, 23)))
    expect(morning).toBe(evening)
    expect(JSON.stringify(dailyLevel(morning).waves)).toBe(JSON.stringify(dailyLevel(evening).waves))
  })

  it('changes board from day to day', () => {
    const a = dailyLevel(dailySeed(new Date(Date.UTC(2026, 7, 26))))
    const b = dailyLevel(dailySeed(new Date(Date.UTC(2026, 7, 27))))
    expect(JSON.stringify(a.waves)).not.toBe(JSON.stringify(b.waves))
  })

  it('is short enough to finish in one sitting', () => {
    const lvl = dailyLevel(dailySeed(new Date(Date.UTC(2026, 7, 26))))
    expect(lvl.waves).toHaveLength(DAILY_WAVES)
    expect(lvl.id).toBe('daily')
  })

  it('counts days forward from launch', () => {
    expect(dailyNumber(new Date(Date.UTC(2026, 7, 26)))).toBe(26)
  })
})
