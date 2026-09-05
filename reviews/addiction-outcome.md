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

## Systems plan: items 1 to 5 and 7 (in part)

Built: 1 (objective), 2 (star line), 3 (readouts), 4 (previews, early-call bargain spelled out), 5 (field guide, without pre-wave queuing), 7 (damage records, without capstone cards or Hold pennants).

Not built, in Astra's ranked order, each a session of its own:

- **6. Ballista firing-line control** (Track / Hold line). The closest thing to a new tower feel without a seventh family; needs the direction in checkpoints and the build log.
- **7b. Capstone cards** stamped on a first win, family pennants in the Hold.
- **8. Two trials per map** (Relief Siege, Silent Guns) funding the last 20 Armory stars. The Armory costs 60 against 40 earnable today; only trials close that gap.
- **9. Freeplay bank-and-suspend** (L).

## Waiting on the owner

- **A seventh tower family.** Astra's advice, which I followed: not now. The account ladder already gates two families behind levels 15 and 20, twelve capstones exist, and a new family multiplies models, menus and balance before those choices are legible. If you want one regardless, the Ballista hold-line (item 6) or a support family that does not add damage (a bell tower that marks the beat, or a watchtower that reveals and slows) would be my pick.
- Deploying this branch. Everything is on `addiction`, pushed; nothing is on `main` yet.

## Verification

Typecheck, lint, 192 unit tests (7 new: star thresholds and the objective rule), Playwright smoke (7), and scripted screenshots of the reveal, hero caption, end card, capstone panel, placement tooltip and the field guide.
