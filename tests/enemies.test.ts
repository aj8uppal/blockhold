import { describe, expect, it } from 'vitest'
import { enemyDefs } from '../src/game/enemyDefs.ts'

import { enemyModelFactories } from '../src/game/units.ts'

const enemyModelKeys = new Set(Object.keys(enemyModelFactories))

describe('enemy definitions', () => {
  it('references an existing enemy for every spawn-on-death effect', () => {
    for (const def of enemyDefs.values()) {
      if (def.spawnOnDeath) {
        expect(enemyDefs.has(def.spawnOnDeath.id), `${def.id} spawns ${def.spawnOnDeath.id}`).toBe(true)
      }
    }
  })

  it('keeps armor and magic resistance within the supported range', () => {
    for (const def of enemyDefs.values()) {
      expect(def.armor, `${def.id} armor`).toBeGreaterThanOrEqual(0)
      expect(def.armor, `${def.id} armor`).toBeLessThanOrEqual(0.8)
      expect(def.magicResist, `${def.id} magic resistance`).toBeGreaterThanOrEqual(0)
      expect(def.magicResist, `${def.id} magic resistance`).toBeLessThanOrEqual(0.8)
    }
  })

  it('awards a positive bounty for every enemy', () => {
    for (const def of enemyDefs.values()) {
      expect(def.bounty, def.id).toBeGreaterThan(0)
    }
  })

  it('uses only registered enemy model factory keys', () => {
    for (const def of enemyDefs.values()) {
      expect(enemyModelKeys.has(def.model), `${def.id} model ${def.model}`).toBe(true)
    }
  })
})
