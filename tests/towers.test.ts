import { targetScore, TARGET_POLICY_ORDER, TARGET_POLICY_LABEL, REACTION_RADIUS, reactionFor, type TargetPolicy } from '../src/game/towers.ts'
import { levels } from '../src/game/levels.ts'
import { gridToWorld } from '../src/game/path.ts'
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
        const tower = Object.assign(Object.create(Tower.prototype) as Tower,
          { kind, level, branch, world: { sellRefund: SELL_REFUND } })
        const expected = Math.round(investedGold(kind, level, branch) * SELL_REFUND)
        expect(tower.sellValue, `${kind} level ${level} branch ${branch}`).toBe(expected)

        // Full Salvage returns the whole investment
        const salvaged = Object.assign(Object.create(Tower.prototype) as Tower,
          { kind, level, branch, world: { sellRefund: 1 } })
        expect(salvaged.sellValue).toBe(investedGold(kind, level, branch))
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

describe('targeting policies', () => {
  // remaining = distance still to walk, so a *low* remaining is near the gate
  const near = { remaining: 2, hp: 50 }    // closest to the gate, mid health
  const far = { remaining: 9, hp: 30 }     // furthest from the gate, weakest
  const tank = { remaining: 5, hp: 400 }   // mid lane, toughest
  const pool = [near, far, tank]

  const pickBy = (policy: TargetPolicy) =>
    pool.reduce((best, e) => (targetScore(policy, e) < targetScore(policy, best) ? e : best))

  it('first shoots whatever is closest to the gate', () => {
    expect(pickBy('first')).toBe(near)
  })

  it('last shoots whatever is furthest from the gate', () => {
    expect(pickBy('last')).toBe(far)
  })

  it('strongest shoots the highest health', () => {
    expect(pickBy('strong')).toBe(tank)
  })

  it('weakest shoots the lowest health', () => {
    expect(pickBy('weak')).toBe(far)
  })

  it('cycles through every policy and wraps', () => {
    expect(TARGET_POLICY_ORDER).toEqual(['first', 'last', 'strong', 'weak'])
    expect(new Set(TARGET_POLICY_ORDER).size).toBe(TARGET_POLICY_ORDER.length)
    for (const p of TARGET_POLICY_ORDER) expect(TARGET_POLICY_LABEL[p]).toBeTruthy()
  })
})

describe('reaction reach', () => {
  // The predecessor of this mechanic used a 2.3 radius while Greenhollow and
  // Emberwastes space their plots 3.0 apart, so adjacency was unreachable on
  // the tutorial map. A placement mechanic nobody can trigger is dead content.
  it('is reachable on every map in the campaign', () => {
    for (const lvl of levels) {
      const pts = lvl.plots.map(([c, r]) => gridToWorld(c, r, lvl.width, lvl.height))
      let pairs = 0
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) <= REACTION_RADIUS) pairs++
        }
      }
      expect(pairs, `${lvl.id} has no plots close enough to react`).toBeGreaterThan(0)
    }
  })

  it('stays selective rather than linking the whole board', () => {
    for (const lvl of levels) {
      const pts = lvl.plots.map(([c, r]) => gridToWorld(c, r, lvl.width, lvl.height))
      let pairs = 0
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) <= REACTION_RADIUS) pairs++
        }
      }
      const allPairs = (pts.length * (pts.length - 1)) / 2
      expect(pairs / allPairs, `${lvl.id} links too much of the board`).toBeLessThan(0.35)
    }
  })

  it('never pairs a family with itself', () => {
    expect(reactionFor('arrow', 'arrow')).toBeNull()
    expect(reactionFor('arrow', 'mage')?.id).toBe('enchanted')
    expect(reactionFor('mage', 'arrow')?.id).toBe('enchanted')
    expect(reactionFor('cannon', 'mage')?.id).toBe('runic')
    expect(reactionFor('arrow', 'cannon')?.id).toBe('ranging')
  })
})
