# The addiction round: what was built overnight

Written 2026-09-05 by Claude after executing the two GPT-6 Astra plans
(`feel-plan-astra.md`, xhigh; `addiction-plan-astra.md`, max) on branch
`addiction`. The owner's words: "figure out what makes kingdom rush and btd so
addictive and fold those mechanics into our game ... For visuals, new towers,
better gameplay, etc."

## The three levers, and what now delivers them

| Lever (Astra) | What KR / BTD does | What Blockhold does now |
|---|---|---|
| Victory creates a specific next intention (goal gradient, endowed progress) | KR: a missing star buys and opens something. BTD: victory callouts, Monkey Knowledge | Every result card ends in **one named objective** chosen by one rule, with the button that does it; the XP card says the exact XP to the next unlock; the Daily pays XP visibly; a visible **three-star line** beside lives, and a debrief that names the lives short and the enemy that first took the line |
| A defense whose success feels authored (competence, identity) | KR specials you can anticipate; BTD pop counters as identity | **Special-attack readouts** on capstones (Crown Volley, Convergence Rune, Great Bolt, Crownfire, Last Muster) with a flash and cue when they fire; **placement previews** of reactions, Beacon light and high ground before the gold is spent; **damage records** per building, and a deadliest-building award by damage |
| Fresh tests of learned skill (mastery ladder, bounded novelty) | KR encyclopedia and Heroic/Iron; BTD boss milestones | A **field guide** of everything met, with counters; the objective rule sends a finished account past the next freeplay boss. Trials (KR Heroic/Iron) are the next thing to build, see below |

## Feel plan: done

1. Material ownership (`ownMaterial`) - tints, tier glow, phasing and debris fades work again.
2. Truthful contact: cluster bomblets deal damage; orphan bolts break where the target was last seen.
3. Attention budget: floater cap 24, fodder shake throttle, elite tint through flashes, resisted-hit sparks.
4. **Upgrade reveal**: the old model crouches 140 ms, the new silhouette rises with an overshoot; dust and the upgrade sound land at the reveal, capstones get a horn under it.
5. **Death by method**: physical tumbles on down the road (direction from the lane), magic lifts and lingers, fire crumbles, shock snaps; per-flavour puffs and three new kill sounds.
6. Flyers keyed on `def.flying`; simple ground shadows for flyers.
7. The Empress sheds her wings as debris when she lands.
8. **Hero barks**: captions by the portrait on orders, signatures and levels, with a nod and two sounds.
9. **Gate-local waves**: only the gates a wave uses flash; the coming wave's gates breathe during the countdown; a first boss's camera waits for its dossier.
10. Idle business: turret scans (presentation-only offset, sim untouched), soldier glances, hero idle on dt.

Left out on purpose, as advised: per-voxel physics, a post-fx stack, affix icons on health bars (the restored tints do that job), boss damage-threshold poses and the brood spill.

## Second session (2026-09-05, daytime): the rest of the ranked plan

Everything Astra left for later sessions, built in ranked order on the same branch:

- **6. Ballista hold-line.** A second mode for the engine: one click lays it on a bearing, it fires only when something enters a corridor the bolt's own width, and the bolt flies down the bearing rather than at the body. Corridor drawn while selected; bearing in checkpoints and the replay log; `onHoldLine()` tested.
- **8. Trials.** Every map has a Relief Siege (the last waves from an empty board, four families) and a Silent Guns (the whole map back to back, arrows/mages/barracks, no early calls). One life, six shards, Aldric at level one, tier-four ceiling, Armory off. Banks derive from the campaign's economy; the tide is thinned by the Armory's share; late maps open every family. Twenty trial stars close the 60-against-40 Armory gap. `tests/trials.test.ts` holds every trial to the model's verdict on the campaign finale.
- **7b. Capstone cards.** Twelve, stamped on a campaign win with the crown standing; a Cards view; a pennant over the Hold per family with both crowns stamped.
- **9. Freeplay banks itself.** Freeplay boards checkpoint at clear-field boundaries and resume in freeplay; the pause card says 'Bank and leave' and where; the menu offers 'Hold the line on <map> · +N'.
- The siege-tape/postcard recorder is a lazy chunk; bundle budgets rose once, 130/250 to 136/262 KB, with the reason dated in the script.

Not built: pre-wave queuing of first-encounter dossiers (item 5's second half), and telemetry on objective impressions. The sync server shares `saveMerge.ts` and needs a redeploy for `trials` and `capstones` to survive a cloud merge.

## Systems plan: items 1 to 5 and 7 (in part)

Built: 1 (objective), 2 (star line), 3 (readouts), 4 (previews, early-call bargain spelled out), 5 (field guide, without pre-wave queuing), 7 (damage records, without capstone cards or Hold pennants).

Items 6, 7b, 8 and 9 were built in the second session, above.

## The seventh family (2026-09-05, evening)

The owner asked for a Super-Monkey-class tower. **The Seraph** (src/game/towerDefs.ts, models in models_towers.ts `seraph()`): a winged idol that fires hitscan rays of light six to ten a second at anything in reach, air included. 1050 gold for the idol, 15,750 to a crown; unlocked at account level 25; three tiers, Solar (2.5x flares) or Void (magic, strips armor), and two crowns - the Dawnbringer (Dawnfall: a 600 true-damage column of light on the toughest foe every 8s, leaving a burn zone) and the Eventide (Eclipse: everything in reach stunned 1.5s and stripped of a fifth of its defenses every 10s). Left out of the balance model's baseline and out of the trials on purpose. Merged to main and deployed with the addiction branch.

## Waiting on the owner

- ~~A seventh tower family~~ built as the Seraph, see above. Astra's original advice was: not now. The account ladder already gates two families behind levels 15 and 20, twelve capstones exist, and a new family multiplies models, menus and balance before those choices are legible. If you want one regardless, the Ballista hold-line (item 6) or a support family that does not add damage (a bell tower that marks the beat, or a watchtower that reveals and slows) would be my pick.
- ~~Deploying this branch~~ done 2026-09-05: `addiction` fast-forwarded into `main`, Pages deployed, Fly sync server redeployed.

## Verification

Typecheck, lint, 228 unit tests (new: star thresholds, the objective rule, the hold-line corridor, every map's two trials against the model, the Hold's pennants), the sync server's 30 tests, Playwright smoke (7), bundle budget, and scripted browser round trips of the reveal, hero caption, end card, capstone panel, placement tooltip, field guide, hold-line firing, a trial from picker to star, capstone stamping, and a freeplay bank-and-resume.
