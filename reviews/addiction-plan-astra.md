Blockhold should make its existing decisions pay off more visibly, then add compact replay challenges. The psychological explanations below are design inferences, not measured retention results.

**1. The three levers Blockhold is missing most**

**Victory creating a specific next intention — goal gradient and endowed progress.** Original Kingdom Rush displays stars at victory; keeping 18–20 lives earns three, which fund freely resettable upgrades and unlock Heroic/Iron challenges. A missing star therefore buys and opens something. BTD6 couples victory rewards and statistical callouts with Freeplay; Monkey Knowledge and Monkey Money provide persistent purchases beyond that victory. Blockhold has these ingredients, but its results inconsistently connect accomplishment → useful reward → named next attempt. ([KR progression](https://kingdomrushtd.fandom.com/wiki/Kingdom_Rush), [BTD victory callouts](https://store.steampowered.com/news/posts/?appids=960090&enddate=1595393969&feed=steam_community_announcements), [Monkey Knowledge](https://help.netflix.com/en/node/533317542769252))

**A defense whose success feels authored — competence and identity.** KR’s basic families expand into specializations with separately purchased specials: choosing when to buy an ability changes which threat the defense can answer. Hero portraits, voices and emphatic effects make that answer memorable. BTD6 constrains its three paths: one can reach tier five, another tier two, while the third closes. This creates expressive combinations without presenting every possibility simultaneously. Per-tower counters turn placement into ownership. Blockhold’s strongest story is already distinctive: “My raised foundation, Beacon and Ballista made this road lethal.” It needs clearer evidence of that causality. ([KR specials](https://www.kingdomrush.com/kingdom-rush), [crosspathing](https://bloons.fandom.com/wiki/Crosspathing))

**Fresh tests of learned skills — mastery ladders and bounded novelty.** KR’s six-wave Heroic and continuous Iron challenges change constraints on familiar ground. BTD’s MOAB milestones, freeplay and Paragons extend an invested defense; Paragons absorb prior tower investment, while rotating boss events impose new economic deadlines. Daily challenges and the event calendar supply another bounded task at the session boundary. My inferred breaking points: KR loses appeal when star pursuit repeats a solved script; BTD loses it when hidden interactions, farming routines, event chores or late-game slowdown replace decisions. ([Heroic rules](https://kingdomrushtd.fandom.com/wiki/Heroic_Challenge), [Ninja Kiwi’s boss/Paragon/event design](https://store.steampowered.com/news/posts/?appids=960090&enddate=1634162592&feed=steam_community_announcements))

**2. The plan**

The supplied inventory largely survives source inspection: [maps and modes](/Users/ajuppal/personal/blockhold/src/game/levels.ts), [tower trees](/Users/ajuppal/personal/blockhold/src/game/towerDefs.ts), [heroes](/Users/ajuppal/personal/blockhold/src/game/hero.ts), [account ladder](/Users/ajuppal/personal/blockhold/src/game/progress.ts), [combat/terrain integration](/Users/ajuppal/personal/blockhold/src/game/game.ts), and [mode/share wiring](/Users/ajuppal/personal/blockhold/src/main.ts).

Three corrections matter. [Enemy definitions](/Users/ajuppal/personal/blockhold/src/game/enemyDefs.ts) number **22**, including seven boss entries representing six identities—the Empress has two phases. The [Armory](/Users/ajuppal/personal/blockhold/src/game/armory.ts:78) costs **60 against 40 currently earnable stars**. The Long Night generates 200 waves; freeplay extends in chunks. Cloud and leaderboard availability depend on a [configured service](/Users/ajuppal/personal/blockhold/src/core/leaderboard.ts:24).

Estimates include validation: **S** under one day; **M** one–three days; **L** longer. Gameplay changes below have initial tuning values, not claims of proven balance.

1. **Give every result one next objective.**

   **Lever/precedent:** Goal gradient; KR rewards open challenges, while BTD connects victory to persistent progression.  
   **Now:** [renderEnd](/Users/ajuppal/personal/blockhold/src/ui/screens.ts:545) shows stars, MVP, XP and Freeplay; its Daily early return skips XP/unlock rendering. Map cards already name goals.

   **Build:** Share an XP/objective footer across results. Loss → retry the named failure; first campaign clear → next unbeaten map if available; repeat clear below three stars → improve that map; otherwise → missing Veteran crown, then next freeplay boss. Show exact XP remaining to `nextUnlock`. Keep Hold the line available. Use the same objective helper on the menu and instrument impressions/selections through existing telemetry. Derive the earning ceiling from shipped content: 40 stars today.

   **Acceptance:** A Daily victory crossing level 20 shows **+270 XP and Beacon unlocked**; first-clear, replay, defeat and completed-account fixtures each expose one valid primary action.  
   **Effort:** S, 2–3 hours.

2. **Make three stars a solvable pursuit.**

   **Lever/precedent:** Goal gradient and competence; KR encourages refinement while allowing small mistakes.  
   **Now:** [endGame](/Users/ajuppal/personal/blockhold/src/game/game.ts:1307) grades lives at 88%/50%; `noleak` checks remaining lives, allowing Gate Ward to absorb a leak yet award “flawless.”

   **Build:** One shared threshold helper for HUD/results. Three-star targets: **22/25 Casual, 18/20 Normal, 14/15 Veteran**. Show the target beside lives; record the enemy/wave that first crosses below it. Debrief with exact lives short and `counterFor` advice. Track actual leaks—including absorbed ones—for future noleak awards, and persist that history in checkpoints. Preserve historical medals.

   **Acceptance:** Normal 18 lives earns three stars, 17 two, nine one; an absorbed leak retains appropriate stars but earns no new noleak medal.  
   **Effort:** S, 2–3 hours.

3. **Let players anticipate the special attack.**

   **Lever/precedent:** Competence and anticipation; KR specials and BTD ability tells make an upgrade’s payoff recognizable.  
   **Now:** [Tower effects](/Users/ajuppal/personal/blockhold/src/game/towers.ts:134) already include growth, glow and halos; signature counters remain invisible. [Audio](/Users/ajuppal/personal/blockhold/src/core/audio.ts:60) already budgets voices.

   **Build:** Selected-tower readouts for Crown Volley (**fifth attack**), Convergence Rune (**fifth cast**), Great Bolt (**fourth shot**) and Crownfire (**20 seconds**). Read actual counters; label “next shot” when appropriate. Add a **180-ms local flash** and distinct synthesized purchase/signature cues, below leak priority and within the existing voice budget. Use static indicators under reduced motion.

   **Acceptance:** Readouts match triggers at 1×/2×; feedback leaves seeded combat outcomes unchanged; simultaneous specials never obscure a leak.  
   **Effort:** S, 3–4 hours.

4. **Preview what ground and neighbors will buy.**

   **Lever/precedent:** Competence; BTD exposes placement/buff information, while KR’s selling economy reduces the regret of adapting a defense.  
   **Now:** [HUD previews](/Users/ajuppal/personal/blockhold/src/ui/hud.ts:520) show range and upgrade deltas. Reactions appear after building. Refunds already reach 70%, or full with Salvage. [Early calling](/Users/ajuppal/personal/blockhold/src/game/game.ts:2251) pays gold and sometimes a shard.

   **Build:** Extend hover/press-hold inspection with reaction links at **3.1**, Beacon recipients using the actual strongest-aura rule, and visible/blocked ground-road samples every **0.5 world unit**. Raising previews **+15% range/+10% damage** and changed sightlines. Show the existing early-call bargain: rounded countdown×1.6 gold, **+1 surge shard at ≥8 seconds**, and enemies still on the field. KR also advances spell recharge; Blockhold’s shard bargain already supplies its own timing incentive.

   **Acceptance:** Previews match completed builds, including elevation and overlapping Beacons; 7.9/8.0-second calls display the correct reward; touch inspection spends nothing.  
   **Effort:** M, one day.

5. **Turn encounters into reusable knowledge.**

   **Lever/precedent:** Competence/mastery; KR’s encyclopedia supports introduce → practice → combine pacing.  
   **Now:** [Dossiers](/Users/ajuppal/personal/blockhold/src/game/dossier.ts) provide counters, but there is no browsable guide. [Help](/Users/ajuppal/personal/blockhold/src/ui/screens.ts:916) still describes obsolete same-family resonance.

   **Build:** A field guide using existing definitions and visuals, accessible from wave previews and pause/menu. Record all encountered types; group the Empress’s phases. Queue first-encounter explanations before their wave, with a spawn-time fallback for unexpected summons. Preserve Greenhollow’s armor introduction at wave five, air at six, Hollow King at ten, and authored boss recovery breaks. Correct resonance and context-sensitive boss-leak advice.

   **Acceptance:** One explanation per new type, including two introductions sharing a wave; later inspection causes no repeat interruption. Seen entries survive save/import/cloud union.  
   **Effort:** M, one day.

6. **Add firing-line control to the Ballista.**

   **Lever/precedent:** Competence/identity; BTD6’s [Dartling locked rotation](https://store.steampowered.com/news/posts/?appids=960090&enddate=1612233696&feed=steam_community_announcements) makes direction a deliberate decision.  
   **Now:** [Targeting](/Users/ajuppal/personal/blockhold/src/game/towers.ts:573) follows enemies; [bolts](/Users/ajuppal/personal/blockhold/src/game/projectiles.ts:402) already travel straight with 0.55 successive-hit falloff.

   **Build:** **Track** default / **Hold line**. One ground click stores direction; show its corridor while selected. Fire only when an eligible enemy intersects it within effective reach. Reuse the projectile’s **0.42 radius plus enemy radius**, visibility rules, reload and damage. Switching is free and preserves reload progress. Serialize direction in checkpoints and record it in the build log.

   **Acceptance:** An ordinary bolt hits three aligned, unarmored targets for 100%, 55%, 30.25%; off-axis enemies cannot redirect it; eligibility and restored direction remain correct.  
   **Effort:** M, 1–2 days.

7. **Give every family a service record.**

   **Lever/precedent:** Identity/collection; BTD’s counters, profiles and collection pages make favorite towers personal.  
   **Now:** [Live kills](/Users/ajuppal/personal/blockhold/src/ui/hud.ts:462) and [sold-building MVP records](/Users/ajuppal/personal/blockhold/src/game/game.ts:1475) exist. [The Hold](/Users/ajuppal/personal/blockhold/src/game/hold.ts:39) already translates achievements into architecture.

   **Build:** Track actual HP removed, capped by pre-hit HP, including damage-over-time. Retain kills. Add barracks enemy-seconds blocked and Beacon tower-seconds illuminated/bonus gold, credited to the actual aura provider. Include sold buildings. Add **twelve capstone cards**, stamped on the first campaign win with that capstone; both branches earn a family pennant in the Hold courtyard. Store bounded ID sets and cloud-merge by union. Rewards are cosmetic.

   **Acceptance:** Overkill/poison count correctly; selling preserves records; zero-kill Beacons receive support recognition; repeat wins and device merges cannot duplicate stamps.  
   **Effort:** M, 2–3 days.

8. **Build two short trials, then fund the remaining Armory.**

   **Lever/precedent:** Mastery/goal gradient; original KR’s Heroic/Iron variants each award another star.  
   **Now:** [Campaign generation](/Users/ajuppal/personal/blockhold/src/game/levels.ts:8) lacks per-map trials; the 60-star Armory cannot currently be completed.

   **Build:** New `trials.ts`, initially three-star Greenhollow. Both trials: Normal enemy rules, Aldric level one, **six shards, one life, tier-four ceiling, Armory disabled**. **Relief Siege:** campaign waves 11–16, 1,100 starting gold, four starter families. **Silent Guns:** concatenate those spawn schedules with five-second gaps, 1,800 gold, arrows/mages/barracks only, no early calls. Keep traps/earthworks. Apply original source-wave HP scaling explicitly. Override battle rules directly: [initialization](/Users/ajuppal/personal/blockhold/src/game/game.ts:906) currently ignores `LevelDef.startLives`. Use Watches XP rates; award one unique medal/star per variant, without campaign unlocks or freeplay.

   **Acceptance:** Both have demonstrated winning builds without meta upgrades; commands enforce restrictions; repeated clears/cloud merges award once; campaign data remains unchanged.  
   **Effort:** M, 2–3 days for the pilot. Remaining eighteen tested trials: L, another 5–8 days. Only the complete set raises the ceiling to **60**.

9. **Make freeplay safe to leave.**

   **Lever/precedent:** Endowed progress and goal gradient; BTD Freeplay preserves the defense already invested in.  
   **Now:** [Checkpointing excludes freeplay](/Users/ajuppal/personal/blockhold/src/game/game.ts:522), and the [snapshot schema](/Users/ajuppal/personal/blockhold/src/game/checkpoint.ts:32) omits state needed for faithful continuation.

   **Build:** At a cleared-field boundary, offer **Bank and suspend** before another countdown advances. Snapshot depth/chunk, RNG position, earthworks, hero/soldier state, cooldowns, signatures, hazards and persistent effects; commit XP idempotently with the snapshot. Resume the same board. Show the next ten-wave boss milestone, including Ossuary at **+50** and Empress at **+60**, initially as silhouettes if undiscovered.

   **Acceptance:** Scripted uninterrupted/resumed runs agree through a boss phase transition; crash/reload cannot duplicate XP; failed storage leaves play active.  
   **Effort:** L, 4–6 days.

**3. Do not build**

- **A seventh family, wholesale three-path conversion, or Paragons now.** BTD’s breadth benefits from staged exposure and years of counter development. Blockhold already gates Ballista/Beacon at 15/20 and has twelve capstones plus independent perks. Another family multiplies models, menus and balancing before those choices have become legible.
- **Another currency or consumable economy.** BTD uses Monkey Money for access, trophies for cosmetic identity, and instas for collection, variable rewards and rescue. Blockhold already has gold, shards, stars and XP. Service records supply ownership without turning failed mastery into a consumable bill. ([BTD systems](https://store.steampowered.com/app/960090/Bloons_TD_6/))
- **A live-service mode suite.** Races reward speed; Odysseys test restricted crews; Contested Territory/co-op supply teamwork; popular community challenges add social proof and novelty. Their population, moderation and synchronization costs are L. Blockhold’s Daily, Bellfoundry and Three Watches already provide variety; its leaderboard currently bounds-checks evidence rather than re-simulating runs. ([BTD modes](https://store.steampowered.com/app/960090/Bloons_TD_6/), [current verification limit](/Users/ajuppal/personal/blockhold/src/core/leaderboard.ts:18))

**4. Sequencing for one overnight session**

Target **items 1–3**, in order: approximately **7–10 implementation hours plus verification**. Each must leave a working game independently. Start item 4 only after all three pass and sufficient time remains to finish it. Items 5–9 belong to subsequent sessions, in ranked order.

Reserve the final **90 minutes** for typecheck, unit tests, build and desktop/touch smoke checks: fresh save, Daily unlock and completed account. Add focused tests for new reward/state rules. Bump [ruleset.ts](/Users/ajuppal/personal/blockhold/src/game/ruleset.ts) when combat or waves change. Use objective selections and subsequent battle starts as early measurements; retention improvement requires player evidence.
