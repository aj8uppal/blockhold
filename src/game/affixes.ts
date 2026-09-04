/**
 * Elite affixes: named, telegraphed, and different from each other.
 *
 * "Veteran adds elite-affix enemies" has been in the README for a long time and
 * was not true. What actually shipped was one anonymous buff - 1.9x health, a
 * slightly larger model, a purple tint - applied to every elite alike. That
 * produces reward variance, which is the least interesting thing an elite can
 * produce. It gives a player nothing to recognise, nothing to prepare for, and
 * nothing to do differently once it arrives.
 *
 * An affix has to earn its name on three counts:
 *
 *   It is legible before it matters. Each one has its own colour and its own
 *   line in the enemy tip, and the wave preview says which are coming.
 *
 *   It changes what beats it, not just how long it takes. Nullward walks
 *   through mage fire and dies to arrows; Bulwark is the reverse. A player who
 *   reads the affix and switches targets is rewarded for it.
 *
 *   It is bounded. Every affix here trades: the tough ones are slow, the fast
 *   one is fragile. None of them is simply "more". An elite is still worth its
 *   bounty premium and its shard, so the trade stays in the player's favour.
 *
 * Rolled from the seeded simulation stream, so a seed reproduces exactly which
 * enemy carried which affix - a daily or a challenge link would otherwise be a
 * different fight for every player who opened it.
 */

export type AffixId = 'swift' | 'bulwark' | 'nullward' | 'commander'

export interface AffixDef {
  id: AffixId
  name: string
  /** one line, in the player's language, describing what to do about it */
  blurb: string
  /** emissive tint, so each affix reads as itself at a glance */
  tint: number
  /** icon key from the hand-authored set */
  icon: string
  /** multiplies the elite health premium */
  hp: number
  speed: number
  /** added to the base armour, capped later */
  armor: number
  magicResist: number
}

/**
 * The health premium an elite carries before its affix adjusts it.
 * Kept at the value the anonymous elite used, so bounty and shard economics
 * are unchanged by this whole feature.
 */
export const ELITE_HP = 1.9

export const AFFIXES: Record<AffixId, AffixDef> = {
  swift: {
    id: 'swift',
    name: 'Swift',
    blurb: 'Moves far faster than its kind. Slow it or it will reach the gate before your towers finish it.',
    tint: 0x35e0c8,
    icon: 'feather',
    // fast and frail: the affix that punishes a defence with no crowd control
    hp: 0.62,
    speed: 1.42,
    armor: 0,
    magicResist: 0,
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    blurb: 'Plated against arrows and shot. Magic goes through it as if the plate were not there.',
    tint: 0xc8a24a,
    icon: 'shield',
    hp: 1.15,
    speed: 0.78,
    armor: 0.42,
    magicResist: -0.1,
  },
  nullward: {
    id: 'nullward',
    name: 'Nullward',
    blurb: 'Warded against magic. Arrows and cannon shot still bite.',
    tint: 0x7b6ff0,
    icon: 'sparkle',
    hp: 1.05,
    speed: 0.92,
    armor: -0.1,
    magicResist: 0.46,
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    blurb: 'Shields everything marching near it. Kill the commander and the shield goes with it.',
    tint: 0xff7a3a,
    icon: 'crown',
    hp: 1.25,
    speed: 0.9,
    armor: 0.1,
    magicResist: 0.1,
  },
}

export const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[]

/** how far a Commander's shield reaches, in lane units */
export const COMMANDER_RADIUS = 2.6
/** how long that shield lasts once out of range, so it fades rather than blinks */
export const COMMANDER_WARD = 0.5
