# What makes Kingdom Rush and Bloons TD addictive, and what Blockhold should steal

A research brief for GPT-6 Astra, 2026-09-05. The owner's words:

> figure out what makes kingdom rush and btd so addictive and fold those
> mechanics into our game. For visuals, new towers, better gameplay, etc.
> Take your time, find the best approach and then execute.

You are the design half of that. An engineer-agent will execute your plan
overnight, unattended, in one session, against this repository. So the plan
has to be concrete enough to build from and honest about cost.

## Ground rules

- Read the code, not the README. The README overclaims in places and lags in
  others. Everything you claim about what Blockhold does today must be
  verified in `src/`.
- Think in mechanics and the psychology under them, not in features. "Add
  achievements" is a feature. "The player never finishes a session without a
  named goal for the next one" is a mechanic; name the lever (goal gradient,
  variable reward, competence, endowed progress, near-miss, collection,
  mastery ladders, identity, social proof, loss aversion) and say which of
  KR's or BTD's systems delivers it and how.
- Be opinionated. Rank. Say what NOT to do and why. A plan with twenty items
  of equal weight is not a plan.
- Every recommendation must carry: the lever, how KR or BTD does it, what
  Blockhold does now (with file references), exactly what to build, numbers
  where numbers matter, an acceptance test, and an effort estimate (S under a
  day for one agent, M one to three days, L more).
- Respect what already works. Blockhold is not a KR clone and should not
  become one: its voxel identity, earthworks, the Beacon and Ballista, the
  Daily, freeplay's boss ladder and the account ladder are its own. Fold
  mechanics in; do not paste systems on.

## What Blockhold has today (verify each)

- Ten authored maps, 16 to 34 waves, three difficulties, per-map Veteran bite
  on the last three (`src/game/difficulty.ts`).
- Six tower families, each 3 tiers, 2 tier-4 branches, 2 branch-locked tier-5
  capstones with signatures; ascension perks bought with shards; Overcharge;
  targeting policies; cross-family reactions (`src/game/towerDefs.ts`,
  `src/game/towers.ts`).
- Three heroes with an active signature and in-run leveling only
  (`src/game/hero.ts`).
- Road traps, earthworks (raise a foundation, cut the road), terrain
  line-of-sight, hazards per map (`src/game/earthworks.ts`, `hazards.ts`).
- Account XP and an unlock ladder: heroes at 5 and 10, Ballista at 15, Beacon
  at 20 (`src/game/progress.ts`). A live XP bar in battle.
- The Royal Armory: fourteen tracks, 60 stars of cost, funded by 3 stars per
  map plus a crown star per Veteran clear (`src/game/armory.ts`).
- Medals: veteran and noleak per map. Stars 1 to 3 by lives kept.
- The Long Night (endless from empty), freeplay "Hold the line" after a
  campaign win with a climbing boss ladder including two bosses the campaign
  never shows (`src/game/levels.ts` `ladderRung`), the Daily with a result
  block and a leaderboard, the Bellfoundry and the Three Watches.
- Elite affixes, Veiltide surges, a Chronicle Hold that grows with progress,
  Siege Tapes, a Hold postcard, cloud saves.
- Enemies: nineteen definitions including six bosses (`src/game/enemyDefs.ts`).
- Voxel models authored in code (`src/voxel/`), synthesized audio, a
  hand-drawn SVG icon set.

## What to analyse

1. **Kingdom Rush.** The star economy and its upgrade tree; heroic and iron
   challenges as replay variants; tower "specials" and their timing; enemy
   introduction cadence and the encyclopedia; hero identity and portrait
   presence; the sell-and-rebuild rhythm; the call-early bargain; the
   audio-visual "juice" of upgrades and kills; the difficulty ramp inside a
   map; how it makes three stars feel like a pursuit rather than a grade.
2. **Bloons TD 6.** Three-path upgrades and cross-pathing; Monkey Knowledge;
   Paragons; MOAB-class bosses and boss events; freeplay and the "one more
   round" loop; instas and powers; races, odysseys, contested territory,
   co-op; the pop counter and per-tower stats as identity; monkey money and
   trophies; daily challenges and the community challenge browser; the
   sheer roster breadth and how it avoids paralysis.
3. **Both.** What each does at the *session boundary* to bring the player back.
   What each shows the player at the moment of victory. How each turns a
   single decision (placement, upgrade path) into a story the player tells
   themselves. Where each one's addiction curve breaks and why.

## What to deliver

Under 2,500 words, in this shape:

1. **The three levers Blockhold is missing most**, each in one paragraph.
2. **The plan**: eight to twelve items, ranked, in implementation order, each
   with the fields listed under Ground rules. Cover at least: one thing about
   visuals and feel, one new tower family or a new layer on the existing ones
   (if you think a seventh family is wrong, say so and say what instead),
   one replay-variant system, one session-boundary hook, one identity or
   collection system.
3. **Do not build**: three things that look tempting and would be a mistake
   here, with reasons.
4. **Sequencing for one overnight session**: what the agent should build
   first so that if it runs out of time the game is still better, and what
   can only be started if everything before it lands.
