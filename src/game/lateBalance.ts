import type { TowerLevelDef } from './types.ts'

// Retain the original definitions for journals recorded before ruleset 16.
const originals = new Map<string, TowerLevelDef>()
export const originalTowerDef = (def: TowerLevelDef): TowerLevelDef => originals.get(def.model) ?? def

const changes: Record<string, Partial<TowerLevelDef>> = {
    mage5a: { attackInterval: 1.2 },
    mage6a: { damage: [620, 920], attackInterval: .9,
      description: 'Rapid bolts strip 15% armor and magic resistance, helping the whole defense. Bolts deal 30% more damage to fully stripped enemies.' },
    mage5b: { damage: [115, 180], attackInterval: 1.35 },
    mage6b: { damage: [240, 350], attackInterval: 1.05 },
    arrow5a: { damage: [110, 175], attackInterval: 1.15, armorPierce: .35,
      description: 'Long-range precision. Ignores 35% of armor. 28% chance to deal triple damage and pierce a second foe.' },
    arrow5b: { damage: [35, 55], armorPierce: .25 },
    arrow6a: { damage: [420, 620], armorPierce: .5,
      description: 'Long-range executioner. Ignores half of armor. 40% chance to deal triple damage and pierce a second foe. Built for elites and bosses.' },
    arrow6b: { damage: [90, 130], armorPierce: .35 },
}

export function retuneTower(def: TowerLevelDef): TowerLevelDef {
  let change = changes[def.model]
  if (def.model === 'barracks5a' || def.model === 'barracks6a') {
    const mythic = def.model === 'barracks6a'
    change = { soldier: { ...def.soldier!, hp: mythic ? 1500 : 700,
      damage: mythic ? [90, 140] : [28, 44], regen: mythic ? 20 : 10, armorPierce: .35 },
      respawnTime: mythic ? 7 : 8 }
  }
  if (def.model === 'barracks5b' || def.model === 'barracks6b') {
    const mythic = def.model === 'barracks6b'
    change = { soldier: { ...def.soldier!, hp: mythic ? 1050 : 460,
      damage: mythic ? [110, 170] : [40, 62], armorPierce: .4 } }
  }
  if (!change) return def
  if (!originals.has(def.model)) originals.set(def.model, def)
  return { ...def, ...change }
}
