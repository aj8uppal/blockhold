import type { HeroId } from './types.ts'

export type HeroPathId = 'bulwark' | 'vanguard' | 'hawkeye' | 'gale' | 'tempest' | 'riftbinder'

export interface HeroPathDef {
  id: HeroPathId
  hero: HeroId
  name: string
  icon: string
  abilityName: string
  blurb: string
}

/** Path order is progression order: one distinct hunt, then both hunts. */
export const HERO_PATHS: Record<HeroId, readonly [HeroPathDef, HeroPathDef]> = {
  aldric: [
    { id: 'bulwark', hero: 'aldric', name: 'Bulwark', icon: 'helmPlume', abilityName: 'Guardian Standard', blurb: 'Slam nearby ground foes and plant a five-second standard that heals nearby allies each second.' },
    { id: 'vanguard', hero: 'aldric', name: 'Vanguard', icon: 'swords', abilityName: 'Breachmaker', blurb: 'Slam nearby ground foes; the strongest takes a double hit and loses 20% armor.' },
  ],
  liora: [
    { id: 'hawkeye', hero: 'liora', name: 'Hawkeye', icon: 'bow', abilityName: 'Deadeye Volley', blurb: 'Concentrate a powerful volley on the three strongest foes, piercing 65% of their armor.' },
    { id: 'gale', hero: 'liora', name: 'Gale Warden', icon: 'bow', abilityName: 'Wind Corridor', blurb: 'Aim a five-second wind corridor toward the leading foe. Its pulses damage and slow ground and airborne enemies.' },
  ],
  zephyra: [
    { id: 'tempest', hero: 'zephyra', name: 'Tempest', icon: 'lightning', abilityName: 'Rolling Thunder', blurb: 'Three expanding storm pulses damage and slow crowds around the casting point.' },
    { id: 'riftbinder', hero: 'zephyra', name: 'Riftbinder', icon: 'lightning', abilityName: 'Rift Anchor', blurb: 'Plant a five-second field that reveals phased foes to the entire defense and pulses magic damage.' },
  ],
}

export function heroPath(hero: HeroId, id: string | null | undefined): HeroPathDef | null {
  return HERO_PATHS[hero].find(p => p.id === id) ?? null
}
