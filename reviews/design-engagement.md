## 1. Diagnosis

Voxelgard has a strong battle loop and a weak return loop. During a run, it repeatedly creates useful tension, visible power growth, and tactical correction. Between runs, too little of that play becomes a named accomplishment or a clear next goal. The current build is engaging while open, but it gives the player few reasons to think about the next attempt after closing it.

| Framework | Score | Diagnosis |
|---|---:|---|
| Appetitive trigger -> action -> variable reward -> investment | 7/10 | The incoming-wave preview and Veiltide warning create anticipation. Calling early converts nerve into gold. Gold becomes towers, branches, traps, and abilities. Shardbacks, elites, and bosses create irregular shard payouts, which become Overcharge or Ascension choices (`src/game/waves.ts`, `src/ui/hud.ts`, `src/game/game.ts`, `src/game/types.ts`). The loop closes well inside a battle. It leaks at the result screen because unused gold and shards disappear, tower choices are not recorded, and the save has no run history (`src/core/save.ts`, `src/ui/screens.ts`). |
| Competence | 8/10 | The game teaches readable counters: armor versus magic, magic resistance versus physical damage, flying enemies versus arrows and mages, brood versus splash, phasing versus timing, and blocking versus fast ground units (`src/game/enemyDefs.ts`, `src/game/towerDefs.ts`). Maps escalate from one road and 10 waves to three roads and 18 waves (`src/game/levels.ts`). The loss screen does not explain what breached, which threat caused the collapse, or how close the player was, so failure teaches less than the simulation knows (`src/game/game.ts`, `src/ui/screens.ts`). |
| Autonomy | 9/10 | Four tower families, eight tier-4 branches, two Ascension perks per family, three traps, three heroes, rally points, abilities, Overcharge, and resonance create real authorship (`src/game/towerDefs.ts`, `src/game/types.ts`, `src/game/hero.ts`, `src/game/towers.ts`). The Royal Armory has eight tracks and free respec, so experimentation is not punished (`src/game/armory.ts`). Most Armory effects are scalar bonuses, however, and no persistent goal asks the player to explore the large build space. |
| Relatedness and attachment | 3/10 | This is not a social game, which is fine. It still needs attachment to its world and roster. Current character identity is mostly three hero blurbs, map intros, and enemy descriptions (`src/game/hero.ts`, `src/game/levels.ts`, `src/game/enemyDefs.ts`). The save remembers only `lastHero`, not hero deeds, mastery, favorite builds, or campaign history (`src/core/save.ts`). |
| Flow-channel pacing | 7/10 | Three difficulty curves, 1x/2x speed, increasingly complex authored waves, 22-second build breaks, and 30-second boss breaks give players control over cognitive load (`src/game/types.ts`, `src/game/levels.ts`, `src/game/waves.ts`). Early calls deliberately allow overlap because the next countdown begins after spawning, not after the field is clear (`src/game/waves.ts`). Endless has a good five-wave surge and ten-wave boss rhythm, but after its enemy pool tops out the escalation becomes mostly more bodies and 5% extra HP per wave after wave 7 (`src/game/levels.ts`, `src/game/game.ts`). Tactical novelty will flatten before 200 waves. |
| Near-miss and loss aversion | 4/10 | Lives, gate breaches, boss instant-loss rules, red vignette feedback, and a 70% tower refund make stakes legible without making correction punitive (`src/game/game.ts`, `src/ui/hud.ts`, `src/game/towerDefs.ts`). Defeat is framed only as "The gate has fallen" plus aggregate stats. There is no last-threat HP, record delta, lives lost by wave, or "one decision away" evidence (`src/ui/screens.ts`). |
| Session-boundary hooks | 4/10 | Victory can unlock the next map, stars fund the Armory, cleared maps unlock Endless, and each map stores a deepest-wave record (`src/game/game.ts`, `src/ui/screens.ts`, `src/core/save.ts`). The schema stores only map stars, Armory tiers, one Endless number per map, and the last hero. Difficulty completions, no-leak clears, campaign scores, challenge medals, hero mastery, and suspended Endless runs do not exist (`src/core/save.ts`). |
| Reward salience | 6/10 | Kills emit coins, floaters, particles, and sound. Hero levels heal, sparkle, announce themselves, and strengthen the hero. Ascension adds a permanent in-run crown and victory sound. Stars animate on the result card (`src/game/game.ts`, `src/game/hero.ts`, `src/game/towers.ts`, `src/ui/screens.ts`). The result card does not distinguish a new star from a repeated result, show newly affordable Armory choices, or preserve any tower-level story. It reports "shards earned" even though shards are battle-local and absent from `SaveData` (`src/ui/screens.ts`, `src/core/save.ts`). |

The strongest closed loop is wave preview -> risk an early call -> earn gold -> hit an upgrade breakpoint -> survive a harder overlap. `WaveManager.earlyCallBonus()` and the HUD's incoming roster make the bargain explicit (`src/game/waves.ts`, `src/ui/hud.ts`). The shard loop is also strong: identifiable carriers and bosses drop a scarce tactical currency, and the choice between a 12-second attack-speed spike and a permanent tower perk has real timing tension (`src/game/enemyDefs.ts`, `src/game/types.ts`, `src/game/game.ts`).

The campaign loop is less coherent. The game offers three difficulties, but `SaveData.stars` stores one 0-3 maximum per map. A Casual three-star clear and a Veteran three-star clear are indistinguishable, so difficulty mastery produces no durable recognition (`src/game/types.ts`, `src/core/save.ts`, `src/game/game.ts`). Hero XP is also run-local: `Hero` starts at level 1 and the save retains only the selected hero (`src/game/hero.ts`, `src/core/save.ts`). Both systems feel larger during selection than they become after play.

Two presentation details actively weaken trust. First, three stars are awarded at 88% of starting lives, while the result screen calls that "A flawless defense!" A player can leak enemies and still receive the flawless label (`src/game/game.ts`, `src/ui/screens.ts`). Second, Endless updates `bestEndless` before building the stats object, then labels any run with `wavesReached >= bestEndless` a new record. A tie is therefore announced as a new record (`src/game/game.ts`, `src/ui/screens.ts`). Records must be exact if they are meant to drive repetition.

The advertised elite-affix system is not yet an affix system in the runtime. Veteran rolls a 12% elite chance and Endless rolls 8%. Every elite gets the same 1.9x HP, larger purple model, 1.6x bounty, and one shard. There is no affix identity or alternate behavior (`src/game/game.ts`, `src/game/units.ts`). This adds reward variance, but not the anticipation, recognition, or adaptation that named affixes can create.

## 2. What makes tower defense specifically addictive

**Mastery of a spatial puzzle - 8/10.** The five maps materially change the problem. Greenhollow teaches a single winding lane. Frostmere and Emberwastes split pressure across two approaches. Mistfen adds phasing enemies on two roads. The Shattered Crown converges three roads into a final kill zone (`src/game/levels.ts`). Fixed tower plots, lane-bound trap spots, rally points, range circles, and same-family resonance make placement more than a DPS spreadsheet (`src/game/levels.ts`, `src/game/game.ts`, `src/game/towers.ts`). What is missing is a persistent record of how the player solved each board. The game remembers the outcome, not the solution (`src/core/save.ts`).

**Escalating power fantasy - 8/10.** Towers visibly grow through three base tiers, split into dramatic tier-4 identities, then gain Ascension crowns. Overcharge adds a timed visual ring and 60% attack-speed burst. Meteor Storm, chain lightning, poison, burn zones, cluster shells, armor shred, and soldier formations produce the genre's essential shift from fragile setup to controlled spectacle (`src/game/towerDefs.ts`, `src/game/types.ts`, `src/game/towers.ts`, `src/game/game.ts`). Bosses punctuate that growth with the Juggernaut and the flying, summoning Veilqueen (`src/game/enemyDefs.ts`, `src/game/levels.ts`). The missing piece is attribution. A player cannot see that one Storm Spire chained through 41 targets or that a Frost Rune created the winning kill zone, so power is felt but not owned (`src/ui/screens.ts`).

**Perfect-clear chase - 5/10.** Lives and three stars establish the right basic loss-aversion structure. Stars also feed the Royal Armory, so preserving the gate has a meta payoff (`src/game/game.ts`, `src/game/armory.ts`). The chase is blurred by the 88% "flawless" threshold, map-level rather than difficulty-level records, and the absence of a true no-leak medal (`src/game/game.ts`, `src/core/save.ts`, `src/ui/screens.ts`). Once a map has three stars, the campaign offers no finer proof of mastery besides Endless depth.

**Build variety and experimentation - 8/10.** Voxelgard has unusually good raw ingredients: physical and magic counters, air targeting, blocking, three trap roles, eight final tower branches, eight family perks, three hero roles, temporary Overcharge, resonance clusters, and a 70% sell refund (`src/game/towerDefs.ts`, `src/game/types.ts`, `src/game/hero.ts`, `src/game/towers.ts`). The free Armory respec is especially player-respecting (`src/game/armory.ts`). The weak point is incentive. No challenge, commendation, score category, or usage record rewards trying an unfamiliar branch or hero. A solved build can become the only build the player sees.

**Rhythm of greed and relief - 8/10.** The genre thrives on alternating planning calm with self-authored panic. Voxelgard already has a good version: countdowns show the next roster, early calls turn remaining seconds into gold, waves may overlap, surge warnings raise the stakes, and bosses receive longer post-wave breaks (`src/game/waves.ts`, `src/ui/hud.ts`, `src/game/levels.ts`). Veiltide itself raises enemy HP by 30% and speed by 12%, but gives no surge-specific payout. Its risk is vivid while its reward is only the ordinary early-call gold (`src/game/game.ts`). That is the best underused lever in the current build.

## 3. Prioritized recommendations

1. **Build a visible campaign mastery ladder.**
   - **Psychological lever:** Goal gradient, competence, endowed progress, session-to-session investment.
   - **Implementation:** Expand `SaveData` in `src/core/save.ts` with per-map, per-difficulty results and medals. Keep the existing 15 campaign stars as the Armory power budget so Veteran does not become mandatory. Add non-power crowns for Normal, Veteran, true no-leak, and boss-kill clears. In `src/ui/screens.ts`, show one "Next goal" on every map card and result screen. Short horizon: next star threshold. Medium horizon: map mastery. Long horizon: all-map campaign crown. Migrate existing `stars` forward without taking anything away.
   - **Effort:** M
   - **Expected impact:** high

2. **Turn every wave into a scored promise.**
   - **Psychological lever:** One-more-wave momentum, streak preservation, near-loss tension, immediate competence feedback.
   - **Implementation:** Tag each spawn with its source wave in `src/game/waves.ts`, `src/game/game.ts`, and `src/game/units.ts`. Mark that wave broken when one of its enemies leaks. When all enemies from that source wave are gone, show "Wave held" or "Perfect wave" and advance a visible defense streak in `src/ui/hud.ts`. Reward score and a small breakpoint bonus, not a large economy snowball. Reset the streak on a leak. This still works when early-called waves overlap.
   - **Effort:** M
   - **Expected impact:** high

3. **Add honest campaign scores and personal-best deltas.**
   - **Psychological lever:** Self-competition, measurable mastery, near-miss motivation, replayability.
   - **Implementation:** Score remaining lives, difficulty, early-call seconds, perfect waves, and completion. Do not reward raw elapsed speed, which would punish thoughtful play beyond the existing early-call choice. Store best score per map and difficulty in `src/core/save.ts`. Capture the previous best before `Game.endGame()` writes the new value. Show `NEW BEST +1,240` or `340 short` in `src/ui/screens.ts`; use wave depth as the primary Endless record and score as its tiebreak. Fix the current Endless tie case by comparing against the pre-run best, not the updated best.
   - **Effort:** M
   - **Expected impact:** high

4. **Make defeat a useful near-miss, not a dead stop.**
   - **Psychological lever:** Counterfactual thinking, competence restoration, reduced rage quit, immediate retry intent.
   - **Implementation:** Extend `battleStats()` in `src/game/game.ts` with previous best, last leaked enemy, its remaining HP, lives lost by wave, and the strongest unresolved threat. In `src/ui/screens.ts`, replace generic defeat copy with one truthful line such as "Wave 11/14 - two Ashhounds broke through" or "The Juggernaut reached the gate at 8% HP." Keep the existing same-loadout retry, and add "Change plan" back to the difficulty, hero, and mode picker. Never fabricate a recommendation from aggregate stats.
   - **Effort:** M
   - **Expected impact:** high

5. **Make Veiltide a real, explicit wager.**
   - **Psychological lever:** Voluntary risk, loss aversion, anticipation, agency under pressure.
   - **Implementation:** Use `WaveManager.nextWaveIsSurge()` and `earlyCallBonus()` in `src/game/waves.ts` to offer a named surge wager during the countdown: call with at least a set number of seconds left for one bonus shard and a score multiplier, or wait with no penalty. Surface the bargain directly on the wave button in `src/ui/hud.ts`. Keep the current 30% HP, 12% speed, violet lighting, and banner in `src/game/game.ts`. The player should know exactly what is risked and won.
   - **Effort:** S
   - **Expected impact:** high

6. **Show which towers authored the win.**
   - **Psychological lever:** Causal clarity, ownership, optimization, attachment to a build.
   - **Implementation:** Give each `Tower` in `src/game/towers.ts` run counters for damage dealt, kills, control time, and shard actions. Thread the source through projectile specs in `src/game/world.ts` and `src/game/projectiles.ts`; count soldier damage under its barracks. Show live stats in the tower panel and the top three contributors on the result card in `src/ui/screens.ts`. Include branch, perk, and resonance so players can compare actual solutions.
   - **Effort:** M
   - **Expected impact:** high

7. **Stage the reward reveal around what changed.**
   - **Psychological lever:** Reward salience, peak-end rule, investment confirmation.
   - **Implementation:** Before a run, snapshot the prior stars, Armory availability, and records in `src/game/game.ts`. On victory, reveal in order: gate held, new or matched star result, personal-best delta, total stars available, then any newly affordable Armory tier. Update `src/ui/screens.ts` copy from "shards earned" to "shards found this battle" and show spent versus unspent, since shards are not persistent in `src/core/save.ts`. Reserve the biggest sound and animation for genuinely new milestones.
   - **Effort:** S
   - **Expected impact:** high

8. **Finish the elite-affix promise with named, telegraphed behaviors.**
   - **Psychological lever:** Variable challenge, pattern recognition, surprise without unfairness.
   - **Implementation:** Add an `EliteAffix` union in `src/game/types.ts`, such as Swift, Bulwark, Nullward, and Commander. Apply one readable behavior in `src/game/units.ts`, with a unique icon/tint and tooltip trait in `src/ui/hud.ts`. Roll affixes deterministically from level seed, wave, and spawn index in `src/game/waves.ts` rather than opaque `Math.random()` in `Game.spawnEnemyAt()`. Preview affix presence before the wave. Preserve the existing elite shard and bounty premium.
   - **Effort:** M
   - **Expected impact:** high

9. **Add permanent challenge contracts, not timed rotations.**
   - **Psychological lever:** Build variety, self-set goals, long-horizon completion, autonomy.
   - **Implementation:** Define a small authored contract list beside each map in `src/game/levels.ts`: win without a family, win with every family built, win using a named hero, earn a trap-kill target, or clear with limited plots. Track medals in `src/core/save.ts` and select them from `src/ui/screens.ts`. Keep every contract permanently available, replayable, and free to abandon. Award cosmetics, profile marks, or score categories rather than more mandatory combat power.
   - **Effort:** L
   - **Expected impact:** high

10. **Give heroes persistent mastery without vertical grind.**
   - **Psychological lever:** Attachment, identity, collection, long-term competence.
   - **Implementation:** Record hero wins, highest in-run level, kills assisted, and signature-ability casts in `src/core/save.ts`. Show a compact mastery strip in the hero picker in `src/ui/screens.ts`. Add hero-specific commendations or lateral ability variants only after the tracking loop proves fun. Do not carry the 14% HP and 13% damage level gains across runs; `src/game/hero.ts` currently resets cleanly and preserves map balance.
   - **Effort:** M
   - **Expected impact:** med

11. **Put the free Armory respec where the decision matters.**
   - **Psychological lever:** Autonomy, experimentation safety, pre-run planning.
   - **Implementation:** Expose the Royal Armory from the level and difficulty picker in `src/ui/screens.ts`, not only the level-select header. Add two or three named local presets backed by `SaveData.armory` loadouts in `src/core/save.ts`. Show the selected preset before launch. Keep `respec()` free in `src/game/armory.ts`; the point is to make adapting to Frostmere's split lanes or Shattered Crown's flyers feel intentional, not administrative.
   - **Effort:** M
   - **Expected impact:** med

12. **Give Endless respectful stopping points and tactical renewals.**
   - **Psychological lever:** Session-boundary control, one-more-set pacing, sunk-investment protection.
   - **Implementation:** At every tenth-wave boss in `generateEndlessWaves()` (`src/game/levels.ts`), open a campfire beat after the field clears. Offer Continue, Retire and bank the record, or Suspend. Continue can grant one of three temporary sidegrades to refresh build decisions. Retire must call the same record-writing path as defeat. Suspend requires a versioned Endless snapshot in `src/core/save.ts` containing wave, economy, lives, hero, towers, traps, and temporary perks. Never require a death to validate a long session.
   - **Effort:** L
   - **Expected impact:** med

13. **Upgrade previews from roster lists to tactical briefs.**
   - **Psychological lever:** Anticipation, planning competence, reduced surprise frustration.
   - **Implementation:** Extend `WaveManager.nextWavePreview()` in `src/game/waves.ts` to include lane, flying, armor, magic resistance, phasing, healing, boss, surged, and elite-affix flags. In `src/ui/hud.ts`, summarize only the decisive counters: "Lane 2: armored ground" or "Air plus healers." Add missing live tooltip traits for `enemy.elite`, `enemy.surged`, `def.phasing`, and `def.summons`. Keep exact counts available on hover for expert planning.
   - **Effort:** S
   - **Expected impact:** med

## 4. The top 3

1. **Campaign mastery ladder.** It gives every existing map, difficulty, hero, and perfect-clear rule a durable purpose. It creates short, medium, and long goals without needing more combat content or more power creep.

2. **Wave promises and defense streaks.** The wave is the natural emotional unit of tower defense. Making each one a clear promise creates the cleanest possible "one more wave" loop and compounds the value of early calls, Veiltide, lives, and overlapping pressure.

3. **Honest scores and personal-best deltas.** The simulation already produces rich decisions, but the result screen currently compresses them into totals. A trustworthy score, previous-best comparison, and near-miss delta turn a finished run into an immediate plan for the next one.
