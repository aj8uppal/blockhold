import type { EnemyDef } from './types.ts'

/**
 * Enemy dossiers.
 *
 * A new threat used to arrive with, at most, a toast that scrolled past while
 * the player was busy. Bosses got a camera move every single time they
 * spawned, which is arresting once and irritating by the fourth Juggernaut.
 *
 * A player meets each notable enemy exactly once: the battle pauses, the card
 * says what the thing is and what beats it, and it never interrupts again.
 * Everything after that is knowledge the player already has.
 */

/** worth stopping the game for; ordinary fodder is not */
export function isNotable(def: EnemyDef): boolean {
  return !!(
    def.boss || def.flying || def.phasing || def.hexer || def.wardAura
    || def.healAura || def.summons || def.spawnOnDeath
    || def.armor >= 0.4 || def.magicResist >= 0.5
  )
}

export interface DossierTrait {
  label: string
  detail: string
}

/** the traits worth naming, in the order they matter */
export function traitsOf(def: EnemyDef): DossierTrait[] {
  const out: DossierTrait[] = []
  if (def.boss) out.push({ label: 'Boss', detail: 'Reaching the gate ends the battle outright.' })
  if (def.flying) out.push({ label: 'Flying', detail: 'Walks over everything you built on the ground.' })
  if (def.phasing) out.push({ label: 'Phasing', detail: 'Slips out of reach on a timer. Damage is wasted while it is faded.' })
  if (def.hexer) out.push({ label: 'Hexer', detail: 'Leaps onto a tower and silences it until you shoot it off.' })
  if (def.wardAura) out.push({ label: 'Warding', detail: 'Halves damage to everything ahead of it.' })
  if (def.healAura) out.push({ label: 'Healer', detail: 'Mends the enemies around it faster than chip damage lands.' })
  if (def.summons) out.push({ label: 'Summoner', detail: 'Calls in reinforcements for as long as it is alive.' })
  if (def.spawnOnDeath) out.push({ label: 'Brood', detail: 'Bursts into smaller foes when it dies.' })
  if (def.armor >= 0.4) out.push({ label: `${Math.round(def.armor * 100)}% armor`, detail: 'Shrugs off arrows and cannon shells.' })
  if (def.magicResist >= 0.5) out.push({ label: `${Math.round(def.magicResist * 100)}% resist`, detail: 'Shrugs off magic.' })
  if (def.regen) out.push({ label: 'Regenerating', detail: 'Heals itself between hits.' })
  return out
}

/**
 * What actually beats it. Deliberately concrete - "use magic" is advice a
 * player can act on, "be careful" is not.
 */
export function counterFor(def: EnemyDef): string {
  if (def.hexer) return 'Kill it fast, before it perches. Anything with splash will knock it loose.'
  if (def.wardAura) return 'Drop the bearer first, then the horde behind it stops being shielded.'
  if (def.healAura) return 'Burst it down rather than chipping at it, or its healing outpaces you.'
  if (def.summons) return 'Focus the summoner. The reinforcements stop the moment it falls.'
  if (def.spawnOnDeath) return 'Have splash ready for the moment it bursts, not just for the parent.'
  if (def.phasing) return 'Stack damage where it will reappear. Slows and traps still catch it on the road.'
  if (def.flying && def.armor >= 0.3) return 'Arrows and mages reach the air, and magic ignores that armor.'
  if (def.flying) return 'Only arrow towers, mage towers and one barracks capstone can touch the air.'
  if (def.armor >= 0.4 && def.magicResist >= 0.4) return 'It resists everything, so bring raw numbers and blocking.'
  if (def.armor >= 0.4) return 'Magic ignores armor entirely. Mage towers cut straight through it.'
  if (def.magicResist >= 0.5) return 'Magic slides off. Answer it with arrows, cannons and steel.'
  if (def.boss) return 'Block it, slow it, and concentrate everything you have on the road it walks.'
  return 'Nothing special required. Hold the line.'
}
