## 1. Verification table for the 10 fixes

| # | Fix description (short) | Verdict | Evidence |
|---|---|---|---|
| 1 | Clone/dispose glow materials | VERIFIED | [builder.ts:93](/Users/ajuppal/personal/3d-tower-defense/src/voxel/builder.ts:93), [builder.ts:99](/Users/ajuppal/personal/3d-tower-defense/src/voxel/builder.ts:99), [builder.ts:125](/Users/ajuppal/personal/3d-tower-defense/src/voxel/builder.ts:125); cloned lit/glow materials are disposed during entity teardown at [game.ts:301](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:301). |
| 2 | Gate projectile effects on damage | INCOMPLETE | Poison, shred, chain stun, and meteor stun use `dealt > 0` at [projectiles.ts:69](/Users/ajuppal/personal/3d-tower-defense/src/game/projectiles.ts:69), [projectiles.ts:99](/Users/ajuppal/personal/3d-tower-defense/src/game/projectiles.ts:99), [projectiles.ts:223](/Users/ajuppal/personal/3d-tower-defense/src/game/projectiles.ts:223), and [projectiles.ts:301](/Users/ajuppal/personal/3d-tower-defense/src/game/projectiles.ts:301). Cannon splash stun still ignores the damage return at [projectiles.ts:163](/Users/ajuppal/personal/3d-tower-defense/src/game/projectiles.ts:163). |
| 3 | Live barracks resonance | VERIFIED | [game.ts:780](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:780) refreshes every tower; ascend refreshes at [towers.ts:91](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:91). [towers.ts:166](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:166) preserves alive soldiers’ HP fraction. Respawning derives HP once from the base definition with identical multipliers at [towers.ts:229](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:229), so no multiplier is double-applied. |
| 4 | Dispose crown/charge ring | VERIFIED | `dismantle()` disposes both geometries and materials and clears references at [towers.ts:143](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:143). |
| 5 | Hero flash decay | INCOMPLETE | Ranged and moving paths tick at [hero.ts:119](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:119) and [hero.ts:175](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:175); melee ticks through [units.ts:533](/Users/ajuppal/personal/3d-tower-defense/src/game/units.ts:533). The dead path returns without ticking at [hero.ts:107](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:107), while a completed move falls through and ticks again through `super.update()` at [hero.ts:127](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:127) and [hero.ts:152](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:152). |
| 6 | Piercing Volley selection/blurb | VERIFIED | Blurb says “up to seven” at [hero.ts:23](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:23); targets sort by ascending `remaining` before `slice(0, 7)` at [hero.ts:206](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:206). |
| 7 | Dynamic hero portrait | VERIFIED | `lastHeroId`, icon, name, title, and ability tooltip are updated from `heroDef` at [hud.ts:207](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:207). |
| 8 | Trap click clears selection | VERIFIED | Trap branch calls `clearSelection()` before opening its panel at [game.ts:460](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:460). |
| 9 | Silent teardown and particles | VERIFIED | `disposeLevel()` uses `dismantle(this, true)` and clears particles at [game.ts:291](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:291); silent dismantling calls `removeQuietly()` at [towers.ts:143](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:143), implemented without effects at [units.ts:506](/Users/ajuppal/personal/3d-tower-defense/src/game/units.ts:506). |
| 10 | Opt-in balance report writing | VERIFIED | `writeFileSync` executes only inside the `WRITE_BALANCE_REPORT` condition at [balance-report.test.ts:371](/Users/ajuppal/personal/3d-tower-defense/tests/balance-report.test.ts:371). |

## 2. Command results

- `npm run typecheck` — **PASS** (exit 0). `tsc --noEmit`; 0 errors.
- `npx vitest run --pool=threads` — **PASS** (exit 0). 8/8 test files and 37/37 tests passed; 0 failures.
- `npm run build` — **FAIL** (exit 1). TypeScript passed and Vite transformed 31 modules, then one `EPERM` error occurred while removing read-only `dist/assets`. This is an audit-environment write restriction, not a compilation error.

## 3. New ship-blockers found in the section C sweep

None. No new Critical, High, or Medium ship-blockers were found.

## 4. Final ship/no-ship verdict

**NO-SHIP for this release gate.** The broader lifecycle sweep is clean and all tests pass, but fixes 2 and 5 remain incomplete, and a production build could not be successfully completed in this read-only environment. Fix those two localized paths and confirm `npm run build` in a writable workspace before releasing.

Codex session ID: 01a01cf7-f144-7ee3-b44a-732fcecd86bf
Resume in Codex: codex resume 01a01cf7-f144-7ee3-b44a-732fcecd86bf
