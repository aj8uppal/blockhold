import { describe, expect, it } from 'vitest'
import { investedGold, resolveCapstone, SELL_REFUND, towerTrees } from '../src/game/towerDefs.ts'
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
        expect(investedGold(kind, 5, branch), `${kind} capstone via branch ${branch}`).toBe(
          baseInvestment + tree.branches[branch].cost + tree.capstone.cost,
        )
      }
    }
  })

  it('resolves the capstone def per branch, keeping the branch identity', () => {
    for (const kind of towerKinds) {
      const tree = towerTrees[kind]
      for (const branch of [0, 1] as const) {
        const def = resolveCapstone(kind, branch)
        expect(def.name).toBe(tree.capstone.name)
        expect(def.model, `${kind} branch ${branch} model`).toBe(tree.capstone.models[branch])
        if (tree.capstone.specials) {
          expect(def.special, `${kind} branch ${branch} special`).toEqual(tree.capstone.specials[branch])
        }
        if (tree.capstone.soldiers) {
          expect(def.soldier, `${kind} branch ${branch} soldier`).toEqual(tree.capstone.soldiers[branch])
          expect(def.soldierCount).toBe(tree.capstone.soldierCount)
        }
        // a capstone must never be a stat downgrade over its branch
        const branchDef = tree.branches[branch]
        if (def.damage && branchDef.damage && def.attackInterval && branchDef.attackInterval) {
          const dps = (d: [number, number], t: number) => (d[0] + d[1]) / 2 / t
          expect(dps(def.damage, def.attackInterval), `${kind} branch ${branch} dps`)
            .toBeGreaterThanOrEqual(dps(branchDef.damage, branchDef.attackInterval))
        }
        if (def.soldier && branchDef.soldier) {
          expect(def.soldier.hp).toBeGreaterThanOrEqual(branchDef.soldier.hp)
        }
      }
    }
  })

  it('rounds each tower sell refund from its total investment', () => {
    for (const kind of towerKinds) {
      for (const [level, branch] of [
        [1, null], [2, null], [3, null], [4, 0], [4, 1], [5, 0], [5, 1],
      ] as const) {
        const tower = Object.assign(Object.create(Tower.prototype) as Tower, { kind, level, branch })
        const expected = Math.round(investedGold(kind, level, branch) * SELL_REFUND)
        expect(tower.sellValue, `${kind} level ${level} branch ${branch}`).toBe(expected)
      }
    }
  })

  it('defines a muzzle height for every tower model', () => {
    for (const tree of Object.values(towerTrees)) {
      const models = [...tree.levels, ...tree.branches].map(def => def.model)
      models.push(...tree.capstone.models)
      for (const model of models) {
        expect(model in muzzleHeights, model).toBe(true)
        expect(Number.isFinite(muzzleHeights[model]), model).toBe(true)
      }
    }
  })
})
