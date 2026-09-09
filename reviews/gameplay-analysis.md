# Gameplay review · ruleset 6

[Open the interactive report](gameplay-review.html) for before/after map screenshots, individual build outcomes, additional hero checks and approximate wave curves. It uses the game's parchment, wood and gold styling and works offline.

The late maps now ask different positioning questions: one switchback around a mesa, two flanks around a lava basin, and three crossings with alternating tides. Total entrances fall from 14 to 6 and large landmarks from 27 to 9. Existing enemy counts, wave rewards and boss waves remain. Columns sharing an entrance are separated so simplifying the roads does not accidentally merge several simultaneous spawns into one burst.

## Findings and changes

- **Support interactions:** Beacon damage and attack speed were not reaching Barracks soldiers. Existing squads, replacements, upgrades, and removal now use live bonuses. Beacon selection compares damage and speed together; it never stacks multiple sources. Rally range also follows the tower's current range.
- **Enemy sustain:** Acolytes previously stacked their healing without a limit. Each enemy now receives at most the strongest aura pulse per 0.6-second window, including staggered healers.
- **Recovery:** A leak removed both the enemy bounty and the entire wave-clear payment. Resolved waves now pay their base reward even with leaks. Bounties and the flawless streak still reward clean defense; flawless-wave income is unchanged.
- **Readable tides:** Actual spawns and gate previews share the same routing, including resumed games. Flood overlays no longer cover road segments that remain open for another lane.
- **Distinct scenery:** The last three themes had fallen back to forest decorations. They now have sparse highland, burnt and coastal scenery, with fewer large objects obscuring roads.

## Actual combat comparisons

560 runs: 180 before (production commit `83cbf15`), 360 revised (two seeds), and 20 additional Liora runs on the last two maps. All ten maps, three difficulties and six build profiles are represented. These are bot outcomes, **not player win rates**.

Below: number of profiles clearing the map out of six, before → revised, using the matched seed 71. The interactive report also includes revised seed 193 and Liora results.

| Map | Casual | Normal | Veteran |
| --- | --- | --- | --- |
| Greenhollow | 6 → 6 | 6 → 6 | 1 → 2 |
| Frostmere Pass | 6 → 6 | 6 → 6 | 1 → 1 |
| The Emberwastes | 6 → 6 | 5 → 5 | 1 → 0 |
| Mistfen Crossing | 6 → 6 | 5 → 5 | 1 → 2 |
| The Shattered Crown | 3 → 3 | 0 → 1 | 0 → 0 |
| Cinderwake Caldera | 6 → 6 | 4 → 3 | 0 → 0 |
| Veilscar Confluence | 5 → 4 | 2 → 2 | 0 → 0 |
| Sunderfall Terraces | 3 → 6 | 1 → 5 | 0 → 4 |
| Emberwind Reach | 1 → 6 | 0 → 3 | 0 → 0 |
| Tidereach Causeway | 0 → 4 | 0 → 3 | 0 → 0 |

The last three maps now have Normal clears with several profiles that do not use Seraph. Sunderfall's stronger shared coverage opens splash, blocking and support strategies. Emberwind and Tidereach still punish builds that cannot handle their mixed late columns. The second seed reproduces the three successful Normal profiles on both of those maps.

The Seraph profile is not consistently the strongest. Its base single-target output is about 56 DPS, rising to 169 only when three targets are available, before defenses. This supports its crowd-damage role after the previous chain buff, but does not establish an optimal price. A basic Beacon costs 150 for +10% damage: it needs roughly 1,500 gold of comparable attackers in range to repay that cost through damage alone. Range, troop blocking and upgraded attack speed make its actual value placement-dependent. Buying it too early is still a poor trade.

Casual and Normal have broad early-map coverage; Veteran produces substantially fewer clears. The previous post-clear HP multipliers remain 1.02 / 1.04 / 1.075 per wave (doubling in approximately 35 / 18 / 10 waves). That is the extra HP multiplier, not a measurement of total wave difficulty; composition and counts still matter.

## Remaining balance questions

1. **Shattered Crown is an abrupt jump.** Only one revised Normal profile clears across these two seeds. Investigate the map hazard, first purchases and mixed defenses before increasing global late-wave HP.
2. **Late Veteran is not proven achievable by this audit.** No tested profile clears Emberwind or Tidereach on Veteran, including the Liora check. The harness has limited Armory investment and does not exercise a complete endgame account or deliberate micro. Test those options and recorded player strategies before treating the difficulty as settled.
3. **Veilscar and wave 23 on the last two maps deserve focused attention.** Several profiles repeatedly fail there. The first follow-up should compare counters and tower positions around those waves, rather than assume every loss means insufficient raw damage.
4. **Do not tune to the greedy bot alone.** Some earlier-map outcomes worsen even though the fixes primarily improve available support and recovery: live bonuses affect combat rolls and the planner changes its spending. Larger paired samples and human replays are needed to separate robust regressions from strategy sensitivity.

## Method and verification

The harness drives the actual `Game.simStep` at 60 Hz, using real terrain, sightlines, paths, towers, soldiers, enemy abilities, hazards, bounties, prices and upgrade branches. Only presentation work and end-of-game account persistence are suppressed. Purchases are legal. The active bot allocates at most three Armory stars per prior map and uses meteor, reinforcements and the hero signature. Accounts are fresh browser contexts; no server save is changed.

The six profiles permit different tower families, branch directions and unlock levels. The planner adapts to upcoming armor, resistance and air, so a profile is not one fixed layout. It does not use selling, early calls, traps, overcharge, ascensions, manual Ballista firing lines, hero movement or hero rank purchases. Two seeds do not exhaust placement and combat variation. Static pressure remains a regression alarm, not a substitute for actual combat. Static tests now allow short recovery troughs and check Veteran's increase over Normal without requiring that every starter-family strategy must fail.

Validation: 264 game unit tests (262 in the full run plus two added routing checks), 32 server tests, 11 browser smoke tests, frontend/server type checks, lint, production build and the existing bundle budget. The exported report renders at desktop and phone widths with no overflow, missing results or JavaScript errors.

To repeat a candidate pass:

```sh
node scripts/gameplay-audit.mjs --active --seeds 71,193 --out /tmp/blockhold-active-after.json
node scripts/gameplay-audit.mjs --active --hero liora --maps emberwind,tidereach --builds combined,storm,precision,support,seraph --difficulties normal,veteran --out /tmp/blockhold-liora-after.json
```

For a matched baseline, run the same harness in an isolated checkout of `83cbf15` with `--active --seeds 71`. Save it as `/tmp/blockhold-active-before.json`. Then regenerate:

```sh
node scripts/gameplay-review.mjs /tmp/blockhold-active-before.json /tmp/blockhold-active-after.json /tmp/blockhold-liora-after.json
npx -y lavish-axi export .lavish/gameplay-review.html --out reviews/gameplay-review.html
```

Running `node scripts/gameplay-review.mjs` without arguments regenerates the review from the committed compact evidence in `gameplay-analysis.json`.

## Inspiration

The design inference is to give each map a clear spatial premise and preserve complementary tower roles. [Ninja Kiwi's official BTD6 v51 notes](https://www.reddit.com/r/btd6/comments/1o6v2jc/bloons_td_6_v510_update_notes/) distinguish cleanup, support and single-target roles. [Kingdom Rush Frontiers](https://play.kingdomrush.com/kingdom-rush-frontiers) emphasises specialised upgrades and varied environments. Blockhold's own code and combat runs supply the numbers here.
