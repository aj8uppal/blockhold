The proposal has the right product shape, but its balance proof is invalid, its continuation mode needs a distinct identity, and one graphics item has already shipped.

Critical findings:

- `endlessHpScale()` is not compounding; it multiplies two linear ramps. Wave 50 is `3.07614×`, wave 60 `3.84854×`. Toughness first increases on wave 31, not immediately after 20. See [game.ts](/Users/ajuppal/personal/blockhold/src/game/game.ts:277).
- The 249-wave Normal campaign currently awards 4,188 XP, ending at level 16. The intended first-clear bonuses would make it 5,188 XP, level 18—but `firstClear` is calculated after stars are written, so it is always false on a win. See [game.ts](/Users/ajuppal/personal/blockhold/src/game/game.ts:1135) and [progress.ts](/Users/ajuppal/personal/blockhold/src/game/progress.ts:94).
- The current model already gives late-map Veteran peaks of 2.172, 2.187, and 1.973 while already considering all tower families. Raising HP as proposed makes them approximately 2.423, 2.608, and 2.504 before the extra elites.
- `affordableDps()` cannot prove Ballista gating. It ignores barracks and beacons, only considers branch A, treats the board as copies of one rung, and gives Ballista no value for piercing or anti-air. Filtering its tower set will not repair it. See [balanceModel.ts](/Users/ajuppal/personal/blockhold/src/game/balanceModel.ts:116).
- The axe projectile, nearest-soldier origin, wind-up, and tumble already exist in [towers.ts](/Users/ajuppal/personal/blockhold/src/game/towers.ts:832), [projectiles.ts](/Users/ajuppal/personal/blockhold/src/game/projectiles.ts:127), and [models_env.ts](/Users/ajuppal/personal/blockhold/src/voxel/models_env.ts:330).

Recommended implementation order: C → D → A → B → E.

## C. Veteran gating — CHANGE, phase 1

Do not ship 1.45/1.55/1.65. Increasing elite chance from 12% to 20% also raises average non-boss HP by roughly 6.7%, before affix resistance, speed, and Commander shielding.

First:

- Fix `firstClear` by reading the old star record before mutation. Add an integration test around `Game.endGame`, not merely `battleXp`.
- Introduce `difficultyMods(levelId, mode, difficulty)` and use it consistently in spawning, bounty calculation, previews, UI, and both balance reports. Per-map numbers hidden behind the global `DIFFICULTIES` display would otherwise lie.
- Start maps 8–10 at absolute Veteran HP multipliers `1.30 / 1.35 / 1.40` and elite chances `12% / 14% / 16%`, campaign-only. Tune upward only after play evidence.

Replace `affordableDps` with a legal `BuildProfile`: unlocked families, star budget, exact Armory tiers, per-lane placement capacity, physical/magic/air output, splash, pierce, blockers, beacon coverage, and both branches. “Full Armory” is not a valid test state when the board costs more than the available currency.

Acceptance tests should compare:

- A progression-valid pre-grind profile, which loses at least 15 modeled lives on each intended gate map.
- A progression-valid level-20, 28/32/36-star loadout for maps 8/9/10, which survives.
- Deterministic scripted playtests on fixed seeds; the static model remains a regression alarm, not proof of completion.

Update [difficulty.test.ts](/Users/ajuppal/personal/blockhold/tests/difficulty.test.ts:1) and make [balance-report.test.ts](/Users/ajuppal/personal/blockhold/tests/balance-report.test.ts:1) consume the same model rather than maintaining a second DPS formula.

## D. Armory — KEEP ECONOMY, CHANGE STORAGE AND COSTS, phase 2

Use the existing `veteran` medal as the crown-star source. Count `sum(stars) + veteranMedalCount`; this retroactively credits existing clears and already merges monotonically across devices. Do not raise `stars[level]` above three: parsing currently clamps it to three and the victory card renders three stars. See [save.ts](/Users/ajuppal/personal/blockhold/src/core/save.ts:62).

Add the proposed tracks with concrete costs:

- Siegecraft `[1,2,2]`
- Lamplighters `[1,2,2]`
- Muster Roll `[3]`
- Bounty Hunter `[1,2]`
- Long Night Rations `[1,2]`
- Veilward `[4]`

That adds 23 to the current 37, producing exactly 60 cost against 40 earnable.

Define tier-two Rations as two lives total every ten survival waves, not `+1 +2`. Veilward must explicitly override the hardcoded boss instant-kill: without it, a boss remains fatal; with it, subtract ten lives and continue. The current code does not actually charge a boss’s nominal 20 lives—it sets lives directly to zero. See [game.ts](/Users/ajuppal/personal/blockhold/src/game/game.ts:235).

Gate track visibility through `isUnlocked`, but preserve purchased hidden tiers if cloud or imported progress later falls out of sync.

## A. Victory continuation — CHANGE, phase 3

Create an explicit `RunMode = campaign | longNight | freeplay`. Do not reuse `isEndless`; it controls HP, campaign scaling, XP, score keys, result copy, checkpoints, and sharing.

At campaign clearance:

1. Snapshot `firstClear`, award campaign stars/crown/XP exactly once, and persist.
2. Enter a paused `cleared` phase without disposing the hazard, projectiles, or board.
3. “Hold the line” switches to freeplay; leaving performs final cleanup.

Do not append to `level.waves`: `campaignScale()` uses its length, so extension changes campaign balance. Let `WaveManager` own a mutable/generated wave source and track both authored index and freeplay depth.

Generate freeplay in deterministic 20-wave chunks using a hash of `(runSeed, levelId, freeplayDepth)`, so chunk order and resume do not change waves. Normalize continuation scaling as:

`campaignFinalScale × endlessScale(authoredWaves + depth) / endlessScale(authoredWaves - 1)`

This avoids both a drop and a boundary cliff while retaining map-specific starting pressure.

Checkpoint v2 must store mode, campaign-rewarded state, freeplay depth, RNG state, earthworks, and hero position. The current checkpoint stores only towers and traps, and resetting the seed on resume restarts the random stream rather than restoring it. See [checkpoint.ts](/Users/ajuppal/personal/blockhold/src/game/checkpoint.ts:36).

Keep separate records keyed by `mode:map:difficulty`. `bestEndless` already mixes Casual, Normal, and Veteran; mixing a retained maxed board into it makes the number less meaningful. There is no Endless leaderboard today—[leaderboard.ts](/Users/ajuppal/personal/blockhold/src/core/leaderboard.ts:1) is Daily-only.

Freeplay sharing should initially be result-only. A seed cannot recreate the inherited board.

## B. Boss ladder — KEEP, CHANGE NUMBERS AND MECHANICS, phase 4

The proposal omits base HP, so its wave-50/60 health cannot currently be calculated. Set:

- Ossuary: 6,500 base HP → 19,995 Normal / 25,993 Veteran at wave 50.
- Veil Empress: 7,500 total HP → 28,864 Normal / 37,523 Veteran at wave 60.

For a genuinely ascending early ladder, apply freeplay-only boss multipliers:

- Hollow King `3.2×`: 4,066 at wave 10
- Juggernaut `1.1×`: 6,082 at wave 20
- Veilqueen `1.55×`: 8,113 at wave 30
- Regent `1×`: 13,371 at wave 40

A flat `+35%` Ascendant Veilqueen at wave 70 would fall below the Empress. Use `+60%`; from wave 80, spawn the second boss at 55% HP rather than two full copies.

Ossuary-raised Husks need `raised=true` and `noReward=true` to prevent resurrection loops and bounty farming. The Empress needs explicit phase state and a model/targetability swap; mutating `EnemyDef.flying` would corrupt the shared definition. Boss affixes also need a separate path because spawning currently forbids elites on bosses.

Bump `RULESET_VERSION` and add pinned ladder, resurrection, phase-transition, checkpoint, and generation tests.

## E. Graphics — CHANGE, phase 5

Drop the axe task: it is done.

Keep the Regent, Ossuary, and Empress models plus beacon aura disc. Do not merely raise the global 160-chunk debris cap: each authored model currently shatters into named model parts, so a larger cap does not create a richer boss death. Split boss adornments into additional named parts, increase boss force/lifetime, and reserve a bounded boss debris allowance. Reuse one glow geometry, dispose per-instance pulsing materials, and respect reduced-motion settings.

No files were changed. Direct module calculations were run; the standard Vitest launcher could not create its temporary cache under the read-only workspace.
