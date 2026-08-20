import { describe, expect, it } from 'vitest'
import { investedGold, SELL_REFUND, towerTrees } from '../src/game/towerDefs.ts'
import { Tower } from '../src/game/towers.ts'
import type { TowerKind } from '../src/game/types.ts'
import { muzzleHeights } from '../src/voxel/models_towers.ts'

const towerKinds = Object.keys(towerTrees) as TowerKind[]

describe('tower economy', () => {
  it('sums invested gold for levels 1-4 on both branches', () => {
    for (const kind of towerKinds) {
      const tree = towerTrees[kind]
      let baseInvestment = 0

      for (let level = 1; level <= 3; level++) {
        baseInvestment += tree.levels[level - 1].cost
        expect(investedGold(kind, level, null), `${kind} level ${level}`).toBe(baseInvestment)
      }

      for (const branch of [0, 1] as const) {
        expect(investedGold(kind, 4, branch), `${kind} branch ${branch}`).toBe(
          baseInvestment + tree.branches[branch].cost,
        )
      }
    }
  })

  it('rounds each tower sell refund from its total investment', () => {
    for (const kind of towerKinds) {
      for (const [level, branch] of [
        [1, null], [2, null], [3, null], [4, 0], [4, 1],
      ] as const) {
        const tower = Object.assign(Object.create(Tower.prototype) as Tower, { kind, level, branch })
        const expected = Math.round(investedGold(kind, level, branch) * SELL_REFUND)
        expect(tower.sellValue, `${kind} level ${level} branch ${branch}`).toBe(expected)
      }
    }
  })

  it('defines a muzzle height for every tower model', () => {
    for (const tree of Object.values(towerTrees)) {
      for (const def of [...tree.levels, ...tree.branches]) {
        expect(def.model in muzzleHeights, def.model).toBe(true)
        expect(Number.isFinite(muzzleHeights[def.model]), def.model).toBe(true)
      }
    }
  })
})
