# Hunt combat audit

Both Normal hunts are achievable with four different scripted defenses, base Aldric, account level 25, and no Armory, hero paths, or Mythics. This is evidence for a starting balance, not a human win-rate estimate. The Empress rewards explicit boss targeting: the mixed and Barracks plans lose all four Normal comparisons on First targeting and win all four when switching to Strongest while a boss is present.

## Changes supported by simulation

- Kept 6,400 starting gold. Added 900 gold for clearing each of waves 1–9, including a recovered wave with leaks; no final-wave or freeplay grant. The real wave resolver pays it once. Original hunt income left a Seraph plan at tier four with approximately 11,300–11,900 total gold. The revised plan earns its tier-five Seraph on wave nine, around 577–582 seconds, with a supporting defense already built.
- Increased authored health by 20% on waves 4–6 and 50% on waves 7–10. Normal final health is 33,150 for the Ossuary and 19,200 airborne plus 16,800 grounded for the Empress.
- Fixed phase health inheritance through the shared Game/Enemy path. The original authored 3.2× Empress incorrectly fell from 12,800 airborne health to an unscaled 3,500 grounded health. The successor now inherits the complete multiplier exactly once.
- Ordinary preparation intervals are 40 seconds; waves six and nine allow 48. Runs without early calls take approximately 11–13 minutes. Players can shorten the intervals with the existing early-call control.
- Added Strongest targeting to the Empress briefing. Aiming at the boss opens the ground phase earlier; it also leaves more escorts for the rest of the defense to handle.

## Final matrix

Two deterministic seeds, four purchase plans, three difficulties, two hunts: 48 production combat runs. Raw purchases, tower damage, wave snapshots, boss phase health, and outcomes are in [hunt-balance.json](hunt-balance.json).

| Hunt | Casual | Normal | Veteran |
| --- | ---: | ---: | ---: |
| Ossuary | 8/8 wins | 8/8 wins | 8/8 wins |
| Empress | 8/8 wins | 8/8 wins | 3/8 wins |

The plans are mixed artillery/magic/archers, precision archers/ballistae, two Barracks with ranged support, and a funded Solar Seraph with modest support. The Empress Veteran wins are the precision plan on seed 71 and both Seraph runs. The other Veteran attempts lose on the final wave. Ossuary is the more forgiving first hunt; these results do not support describing its Veteran difficulty as equally demanding.

Both Normal Seraph runs on each hunt qualify for Seraph mastery. The Normal mixed defense on seed 71 qualifies for Barracks mastery on both hunts. Other Barracks contributions depend on placement and how quickly nearby towers remove targets. The audit reports mastery only for successful Normal/Veteran runs with a standing tier-five family and at least 4,000 damage; Casual does not grant mastery.

The 16-run First-target comparison is in [hunt-balance-first-target.json](hunt-balance-first-target.json). Ossuary remains 8/8; Empress is 4/8. All four lost Empress mixed/Barracks attempts become wins through the targeting change, without lowering enemy health or adding gold.

## Reproduce

```sh
node scripts/hunt-audit.mjs --focus-boss --out reviews/hunt-balance.json
node scripts/hunt-audit.mjs --difficulties normal --out reviews/hunt-balance-first-target.json
node scripts/hunt-audit.mjs --hunts empress --difficulties normal --builds mixed --seeds 71,71 --focus-boss --out /tmp/hunt-repeat.json
```

The repeated seed-71 Empress Normal mixed run produced identical complete result objects, including purchases, tower damage, and boss events. The audit uses the production `Game.simStep` at 60 Hz in an isolated browser. It removes rendering/audio work and account-result persistence; purchasing, enemy movement, damage, rewards, boss abilities, and victory/defeat remain real. It aims meteor/reinforcements and checks the base hero signature every two seconds. It does not move the hero, buy ability ranks, use traps, ascend towers, equip specializations, buy Mythics, or call waves early. HMR is disabled so concurrent development cannot reload the audit midway.

## Limits

Efficient purchases and frequent ability use overstate an unfamiliar player's execution. Placement seeds are two samples, not broad map coverage. Co-op, touch readability, and human boss telegraph comprehension need separate verification.

The hunt budget unlocks and funds tier-five Seraph mastery. It does **not** fund a tier-six Seraph: the full upgrade chain costs at least 30,750 gold, above these encounters' roughly 19,400–20,000 total income. Those Mythics need an extended battle's economy; Last Legion can fit a hunt budget. Prices were not reduced to make a short hunt pay for every Mythic.
