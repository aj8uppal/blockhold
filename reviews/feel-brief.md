# Visuals and combat feel: what Kingdom Rush and Bloons do that Blockhold does not

A focused brief for GPT-6 Astra, 2026-09-05. A companion to `addiction-brief.md`,
which covers systems. This one covers only what the player sees and hears in
the second-to-second: the "juice".

Read the code, not the README. Verify every claim in `src/`.

## What exists (verify)

- Voxel models authored in code: `src/voxel/models_units.ts`, `models_towers.ts`,
  `models_env.ts`, built by `builder.ts` into one geometry per named part;
  parts named `turret`, `crystal`, `flag`, limbs, wings are animated.
- Combat feel work already done: tiered hitstop (`Game.impact`), screen shake,
  damage numbers batched per enemy, death by disassembly (`src/game/debris.ts`),
  a priority audio budget (`src/core/audio.ts`), a fixed four-note motif with
  pressure-driven music layers, projectiles that land even when their target
  dies, boss entrance cinematics, tier glow and capstone halos on towers, a
  thrown axe with a wind-up, elite affix tints.
- Particles are pooled: `src/game/particles.ts` (explosion, hitSpark,
  magicImpact, deathPuff, buildDust, coinBurst, bloodHit, poisonDrip,
  healSparkle, healRing, trail, smokeTrail, burnEmber, stunStars, leakFlash).
- The camera rig and quality watchdog: `src/core/engine.ts`. Phones are the
  primary target: 932x430 landscape, units drawn 28% larger on touch.

## What to analyse

- KR's tower upgrade moment (the build-up, the reveal, the sound), its
  enemy death variety, its hero portrait bark and level-up, its wave-start
  and boss-entrance staging, its idle animations that make a board feel alive.
- BTD6's pop feedback (the sound cascade, the numbers), MOAB layer-peeling
  and the bloon-inside-bloon reveal, tower attack readability at 100 towers,
  the Paragon/5th-tier transformation, the sky-and-ground layering, its use of
  colour to encode threat.
- Where Blockhold's current feel breaks: which events have the least feedback
  relative to their frequency or importance, what looks the same when it
  should look different, what the eye cannot track at 2x speed on a phone.

## Deliver, under 1,800 words

1. The five feel defects that matter most, each verified against a specific
   file and line, with what the player experiences.
2. A ranked plan of eight to ten changes, each with: what the player sees or
   hears, how KR or BTD does it, exactly what to change (functions, parts,
   particle emitters, audio names), a phone-performance note, and effort
   (S/M/L). Prefer changes that reuse the existing emitters, parts and audio
   synth rather than new subsystems.
3. Two things that would look impressive and should not be built here.
