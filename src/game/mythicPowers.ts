/** These are additions to a branch's tier-five weapon, not replacements for it. */
export const MYTHIC_POWERS = {
  deathmark: { name: 'Deathmark', cooldown: 12, duration: 6, radius: .6, color: 0xf6d98b,
    description: 'Every 12s, mark the strongest foe for 6s. It takes 25% more damage from the whole defense and cannot heal.' },
  venomBloom: { name: 'Venom Bloom', cooldown: 10, duration: 5, radius: 2.1, color: 0xa8dc8b,
    description: 'Every 10s, root a venom grove beneath the leading pack for 5s. It poisons every ground or airborne foe inside and slows them; victims burst on death, spreading venom to nearby foes.' },
  nullZone: { name: 'Null Zone', cooldown: 14, duration: 5, radius: 2.1, color: 0xb598d9,
    description: 'Every 14s, silence a 2.1-tile area for 5s. Enemies inside lose magic resistance and wards, cannot heal, and cannot summon or project healing and shield auras.' },
  vortex: { name: 'Storm Prison', cooldown: 12, duration: 4, radius: 2.4, color: 0x8cd5ef,
    description: 'Every 12s, a four-second vortex gathers ordinary foes along their road toward its center, setting up splash attacks. Reveals and slows bosses without pulling them.' },
  ignition: { name: 'Flashover', cooldown: 12, duration: 1, radius: 2.2, color: 0xffb65b,
    description: 'Every 12s, detonate this tower’s burning ground. Each patch deals 450 true damage plus twice its remaining burn damage, then goes out. Stagger salvos to fill the road before Flashover.' },
  faultline: { name: 'Continental Fault', cooldown: 14, duration: 5, radius: 2.3, color: 0xd1ac81,
    description: 'Every 14s, split the ground for 5s: shove ordinary troops back, slow the pack, and expose its armor to every physical weapon. Bosses resist the shove.' },
  dawnRelay: { name: 'Daybreak', cooldown: 24, duration: 5, radius: 1, color: 0xffe3a2,
    description: 'Every 24s during combat, overcharge attacking towers across the entire map for 5s and restore 35% health to all living allies. Multiple relays extend coverage rather than stack attack speed.' },
  warDividend: { name: 'Royal Reserves', cooldown: 20, duration: 1, radius: 1, color: 0xe8c982,
    description: 'Every 20 rewarded kills in its aura refill the hero, Meteor and Reinforcement cooldowns and pay 5 shards. At least 20s between payouts. Summoned enemies do not count.' },
  gravityNet: { name: 'Skylock', cooldown: 12, duration: 4, radius: 2.4, color: 0xa5e4ff,
    description: 'Every 12s, cast a four-second gravity net under a flying pack. Its pulses ground flyers so ground-only towers and soldiers can attack them. Bosses retain crowd-control recovery.' },
  breach: { name: 'Breach Corridor', cooldown: 12, duration: 5, radius: 3, color: 0xf1b783,
    description: 'Every 12s, open a six-tile corridor along the weapon’s aim for 5s. Foes in it lose armor protection and wards against the whole defense; ordinary troops are driven back on impact.' },
  bloodOath: { name: 'Blood Oath', cooldown: 24, duration: 4, radius: 2.4, color: 0xe98e72,
    description: 'Guards cleave nearby ground foes. Every 24s, swear a four-second oath at the rally: living allied soldiers and heroes inside cannot fall below 1 HP. Bosses can still throw them aside.' },
  worldtide: { name: 'Tsunami', cooldown: 14, duration: 4, radius: 1.8, color: 0x76d9c6,
    description: 'Every 14s, send a tidal front six tiles down the targeted road. It drives ordinary ground troops backward, reveals the pack and makes it take 25% more damage from the defense.' },
  absoluteZero: { name: 'Absolute Zero', cooldown: 14, duration: 4, radius: 2.2, color: 0xc0edf4,
    description: 'Every 14s, freeze a zone for 4s. Short pulses freeze ground troops and make their armor brittle: all physical attacks ignore it. Bosses retain crowd-control recovery.' },
} as const

export type MythicPowerId = keyof typeof MYTHIC_POWERS
export const MYTHIC_POWER_MODELS: Record<string, MythicPowerId> = {
  arrow6a: 'deathmark', arrow6b: 'venomBloom', mage6a: 'nullZone', mage6b: 'vortex',
  cannon6a: 'ignition', cannon6b: 'faultline', beacon6a: 'dawnRelay', beacon6b: 'warDividend',
  ballista6a: 'gravityNet', ballista6b: 'breach', barracks6b: 'bloodOath',
  tidecaller6a: 'worldtide', tidecaller6b: 'absoluteZero',
}
