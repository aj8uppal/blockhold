# The long tail: a design brief for adversarial review

Written 2026-09-04 by Claude for review by Codex. Everything below is a
proposal, not a decision. The reviewer's job is to attack it against the code,
find where the numbers lie, and return a better plan with the same shape.

## What the owner asked for, in their words

- The game should be playable and players should feel they can grind, to an
  extent, to get better.
- The last few maps should not be completable, at least on the hardest
  difficulty, until you have the newest towers and your Armory done.
- Flesh out the Armory.
- A graphics push, particularly the barracks: if a barracks can hit air, show
  the throwing axes.
- Bigger, badder bosses.
- After every map you complete, you should be able to continue in freeplay,
  the way Bloons does, with more and better bosses. Something like the
  MOAB / BFB / ZOMG progression, but Blockhold's own. Keep the Juggernaut,
  the Veilqueen and the Veil Regent.

## What exists today (verified in code)

- Ten maps, 16 to 34 authored waves each, three difficulties. Veteran is a flat
  1.3x enemy health, 0.9x bounty, 15 lives (`src/game/types.ts` DIFFICULTIES).
- Campaign waves harden late via `campaignScale()` in `src/game/balanceModel.ts`.
- The Long Night (Endless) is a separate mode started from a beaten map's
  picker: 200 generated waves from `generateEndlessWaves()` in
  `src/game/levels.ts`, starting from an empty board. Health compounds by
  `endlessHpScale()` (+3.5%/wave past 6, a second +1.2%/wave past 30), armour
  and resist harden by `endlessToughness()` in bands past wave 20. A boss every
  tenth wave rotates Juggernaut, Veilqueen, Veil Regent. The enemy pool tops out
  at wave 17, so escalation after that is bodies and health.
- Bosses: Hollow King (1150 hp, map 1), Juggernaut (3800, armour 0.45),
  Veilqueen (2900, flying, summons gargoyles), Veil Regent (5600, phasing,
  summons Rift Heralds; reuses the Juggernaut model with a tint).
  `src/game/enemyDefs.ts`.
- Account XP and an unlock ladder shipped today: Liora at level 5, Zephyra at
  10, Ballista at 15, Beacon at 20; curve `14(L-1)^2 + 50(L-1)`; a normal
  campaign ends around level 15-16. `src/game/progress.ts`.
- The Royal Armory: eight tracks, 37 stars of cost, funded by 30 campaign stars
  (3 per map, regardless of difficulty). Free respec. `src/game/armory.ts`.
  Tracks: Full Salvage, Gate Ward, Second Wind, Comet Calling, Runesmith (3),
  Royal Coffers (3), Prospector (3), Drill Sergeants (3).
- Six tower families. The Stormhowl Warcamp (barracks capstone) "hurls axes at
  anything airborne" but the code fires an ordinary arrow projectile
  (`src/game/towers.ts`, `case 'barracks'` in `fire()`), so the axes are
  invisible.
- The static balance model (`src/game/balanceModel.ts`) judges every wave with
  `affordableDps(gold, plots)`, which takes the best tower tree available for
  the gold - it does not know about unlocks or the Armory, so it cannot
  currently express "this wave needs the Ballista".

## The proposal

### A. Freeplay: hold the line after victory

On a campaign victory, the end card offers **Hold the line**. The board is
kept - towers, traps, earthworks, gold, shards, hero level - and the wave
manager is extended with generated waves numbered from `totalWaves + 1`,
seeded from the level. The existing Long Night stays as "start fresh"; this is
"continue". Both write to the same `bestEndless` record and pay XP per wave.

Implementation sketch: `WaveManager` reads `this.level.waves`; give it an
`extend(waves)` method that appends and resets `phase` to countdown, and have
`Game.endGame(true)` become a two-step: show the card with the choice, and
only finalize on leaving. `campaignHpScale` hands over to `endlessHpScale` at
the boundary, indexed from the boundary rather than from wave 0 so the first
freeplay wave is not a cliff.

### B. A boss ladder, Blockhold's own

Every tenth freeplay wave is a boss, and the ladder climbs rather than
rotates:

| Rung | Wave | Boss | What it does |
|---|---|---|---|
| 1 | 10 | The Hollow King | as today |
| 2 | 20 | The Juggernaut | as today |
| 3 | 30 | The Veilqueen | as today |
| 4 | 40 | The Veil Regent | as today, with its own model instead of a tinted Juggernaut |
| 5 | 50 | **The Ossuary** (new) | a bone colossus; every enemy that dies within 3 units while it lives stands back up as a Husk once |
| 6 | 60 | **The Veil Empress** (new) | flying and phasing; two phases - at half health she lands, sheds her wings, and walks as a Regent-class ground boss |
| 7+ | 70, 80, ... | the ladder repeats from rung 3 with an **Ascendant** prefix: +35% health, one elite affix, and from wave 80 bosses arrive in pairs |

Boss health rides `endlessHpScale`. Each new boss gets its own voxel model,
its own entrance banner and camera move (both exist), and a bigger death
shatter (raise the debris cap for bosses).

### C. Gating the late maps on Veteran

Veteran becomes per-map rather than flat: maps 8 to 10 use 1.45 / 1.55 / 1.65
enemy health instead of 1.3, and their elite chance rises from 12% to 20%.
The balance model gains what it needs to express the gate: `affordableDps`
takes the set of unlocked families and the Armory loadout, and two new tests
assert that on Veteran, maps 8-10 have at least one wave above 1.0 with the
four original families and no Armory, and none above 1.0 with all six and
the full board. That makes "you need the Ballista for this" a checked
property rather than a hope.

### D. The Armory, fleshed out

Stars stay the currency, but Veteran clears award a fourth **crown star** per
map, so the ceiling rises from 30 to 40 and the grind has a target. New
tracks, all verbs rather than percentages where possible:

- **Siegecraft** (3 tiers, shown once the Ballista is unlocked): +6% Ballista
  range per tier.
- **Lamplighters** (3, shown once the Beacon is unlocked): beacons light +0.3
  further per tier.
- **Muster Roll** (1): every barracks fields one more soldier.
- **Bounty Hunter** (2): elites pay +25% per tier.
- **Long Night Rations** (2): in freeplay and Endless, +1 life every 10 waves,
  +2 at tier 2.
- **Veilward** (1): a boss reaching the gate costs 10 lives instead of 20.

Board cost rises to about 60 against 40 earnable, keeping the respec live.

### E. The graphics push

- A real **axe projectile**: a tumbling voxel axe with a `spin` part, thrown
  by the Warcamp's soldiers in turn (the nearest soldier visibly winds up), so
  the capstone's promise is visible.
- Boss presence: the Veil Regent gets its own model; the two new bosses get
  models; all bosses get a slow ground glow disc under them and a larger
  shatter.
- Beacon light on the ground: an emissive disc that pulses, so "lit" towers
  look lit at a glance without a point light.

## What the reviewer should do

1. Read the code, not the README. Verify every claim above.
2. Attack the numbers: the Veteran multipliers, the XP levels, the crown-star
   economy, the boss health at wave 50 and 60 under `endlessHpScale`.
3. Find what this plan breaks: determinism and replay, the checkpoint format,
   the balance-report test, the difficulty tests, the lane-share model with
   freeplay waves, the leaderboard's meaning if freeplay records mix with
   Endless records.
4. Return a plan with the same section shape, in implementation order, with
   file references and concrete numbers, marking each of A-E as keep, change
   or drop, and saying why. Under 1,800 words.
