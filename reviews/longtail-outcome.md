# The long tail: what shipped against the review

Written 2026-09-04 after acting on `longtail-review-codex.md` (Codex,
gpt-5.6-sol, high reasoning). Each of the review's sections, and what was done.

## Critical findings

- **`firstClear` was always false.** Confirmed and fixed: the prior star
  record is read before the win writes it. A scripted win now pays the bonus
  (verified live: +412 XP on a first clear, +312 on a repeat).
- **`endlessHpScale` is two linear ramps, not compounding.** Confirmed. The
  freeplay handover uses the review's normalisation so wave one past the end is
  no harder than the last authored wave.
- **A boss at the gate set lives to zero rather than charging 20.** Confirmed.
  Rewritten so the cost is explicit; the Veilward makes it ten.
- **The axe was already done.** Yes; it shipped the same morning, before the
  review ran.

## C. Veteran gating - changed as recommended

Per-map `difficultyMods()` in `src/game/difficulty.ts`, read by spawning,
bounty, lives, the elite roll, the picker and both balance reports. Late maps
on Veteran: 1.30 / 1.35 / 1.40 health and 12 / 14 / 16% elites, campaign only.

The review's full `BuildProfile` (per-lane placement capacity, pierce,
blockers, star budgets) was **not** built. What shipped is a smaller
`BuildProfile` - unlocked families, Coffers gold, a beacon's damage bonus, and
both tier-4 branches - and `tests/gate.test.ts` treats it as the review says
it must be treated: a regression alarm, not proof. It asserts the three gate
maps stay above the holdable line with the starter kit, fall by more than 20%
with the full kit, and that Normal stays finishable with the starter kit.
Scripted playtests on fixed seeds remain the real proof and are not yet
written.

## D. Armory - as recommended

Crown stars come from the `veteran` medal, so old clears count and nothing
migrates. Six tracks at the review's costs: Muster Roll [3], Bounty Hunter
[1,2], Long Night Rations [1,2], Veilward [4], Siegecraft [1,2,2],
Lamplighters [1,2,2]. Board cost 60 against 40 earnable. Siegecraft and
Lamplighters are hidden until their tower is unlocked and cannot be bought
before then. Rations pays one life per ten waves held, two at tier two.

## A. Freeplay - mostly as recommended

`isFreeplay` is its own flag, not `isEndless`. `WaveManager` owns a mutable
source; `level.waves` is never appended to. Chunks of twenty are seeded from
`(runSeed, levelId, depth)` and tested for determinism. Records are keyed
`levelId:difficulty` in a new monotonic `bestFreeplay` field, synced and
merged like the others. The end card offers "Hold the line" only on a
campaign win.

**Not done:** checkpoint v2. Freeplay does not checkpoint at all rather than
checkpoint wrongly; the RNG stream is still reset on resume in the campaign,
as the review noted. The victory card also runs through the existing
`endGame` rather than a separate paused `cleared` phase, so the hazard is
disposed and recreated on continue and in-flight projectiles are cleared.
Freeplay sharing is result-only, as recommended.

## B. Boss ladder - numbers as recommended

Ossuary 6,500 base, Empress 4,000 winged + 3,500 grounded, rung multipliers
3.2 / 1.1 / 1.55 / 1.0, Ascendants at +60% with a named affix, second boss at
55% from wave 80. Raised Husks carry `raised` and `noReward`; the Empress
phases by spawning her grounded definition rather than mutating hers; ladder
affixes reach bosses through an explicit path the elite roll never uses.
`RULESET_VERSION` is 3. Pinned tests cover the ladder, chunk determinism and
the new definitions.

## E. Graphics - partly

The Veil Regent, the Ossuary and both Empress phases have their own models.
Not done: the beacon's ground disc and the boss-specific debris allowance.
