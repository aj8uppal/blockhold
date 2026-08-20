# Blockhold static balance report

Generated from `enemyDefs.ts`, `towerDefs.ts`, `levels.ts`, and `types.ts` on normal difficulty.

## Method

- Tower efficiency **X = 0.0847 DPS/gold**, the mean of 12 tier-1–3 entries: damage midpoint ÷ attack interval ÷ cumulative cost. Barracks count all deployed soldiers.
- Affordable DPS before a wave = (start gold + prior bounties + 20 early-call gold per prior wave) × 85.0% tower spend × X. Required DPS = authored wave HP ÷ 45s.
- Arrival pressure is the requested rough Σ(enemy HP × count ÷ group interval). HP shares use authored group HP.
- This deliberately static model excludes armor/MR from raw required DPS, lane coverage, travel time, splash, crowd control, healing, regen, phasing, surge empowerment, spawned/summoned adds, heroes, and armory bonuses.
- The 3 trap definitions (50–90 gold), 8 ascension perk choices, and overcharge combat bonus are excluded from tower capacity; shard costs are analyzed separately.
- Across 69 waves: **0 raw-DPS capacity flags**, **0 early-flying flags**, and **0 waves in sustained high-MR runs**.

## Greenhollow (`greenhollow`)

Start gold: 260. Waves: 10. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 496 | 40 | 11.0 / 18.7 (gold 260) | arrival 291.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 744 | 60 | 16.5 / 23.0 (gold 320) | arrival 531.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 664 | 64 | 14.8 / 28.8 (gold 400) | arrival 435.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 4 | 750 | 84 | 16.7 / 34.9 (gold 484) | arrival 547.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,021 | 95 | 22.7 / 42.4 (gold 588) | arrival 620.2 HP/s; fly 0.0%; armor≥0.4 51.4%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,024 | 130 | 22.8 / 50.6 (gold 703) | arrival 566.8 HP/s; fly 34.0%; armor≥0.4 33.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,670 | 168 | 37.1 / 61.4 (gold 853) | arrival 1,236.7 HP/s; fly 0.0%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 8 | 1,241 | 163 | 27.6 / 75.0 (gold 1,041) | arrival 803.9 HP/s; fly 37.4%; armor≥0.4 42.3%; MR≥0.5 0.0%; no pressure flag |
| 9 | 2,382 | 234 | 52.9 / 88.2 (gold 1,224) | arrival 2,066.7 HP/s; fly 0.0%; armor≥0.4 40.7%; MR≥0.5 0.0%; no pressure flag |
| 10 | 2,068 | 216 | 46.0 / 106.5 (gold 1,478) | arrival 1,182.9 HP/s; fly 22.4%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |

## Frostmere Pass (`frostmere`)

Start gold: 300. Waves: 12. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 744 | 60 | 16.5 / 21.6 (gold 300) | arrival 465.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 748 | 76 | 16.6 / 27.4 (gold 380) | arrival 548.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 819 | 97 | 18.2 / 34.3 (gold 476) | arrival 507.5 HP/s; fly 0.0%; armor≥0.4 64.1%; MR≥0.5 0.0%; no pressure flag |
| 4 | 932 | 98 | 20.7 / 42.7 (gold 593) | arrival 646.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 33.5%; no pressure flag |
| 5 | 873 | 109 | 19.4 / 51.2 (gold 711) | arrival 480.0 HP/s; fly 39.9%; armor≥0.4 60.1%; MR≥0.5 0.0%; no pressure flag |
| 6 | 442 | 57 | 9.8 / 60.5 (gold 840) | arrival 756.2 HP/s; fly 13.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,801 | 213 | 40.0 / 66.0 (gold 917) | arrival 959.1 HP/s; fly 0.0%; armor≥0.4 59.7%; MR≥0.5 21.7%; no pressure flag |
| 8 | 1,612 | 186 | 35.8 / 82.8 (gold 1,150) | arrival 1,134.8 HP/s; fly 21.6%; armor≥0.4 0.0%; MR≥0.5 32.3%; no pressure flag |
| 9 | 1,162 | 125 | 25.8 / 97.7 (gold 1,356) | arrival 991.6 HP/s; fly 0.0%; armor≥0.4 54.2%; MR≥0.5 0.0%; no pressure flag |
| 10 | 1,962 | 262 | 43.6 / 108.1 (gold 1,501) | arrival 1,100.7 HP/s; fly 0.0%; armor≥0.4 17.3%; MR≥0.5 57.0%; no pressure flag |
| 11 | 2,280 | 262 | 50.7 / 128.4 (gold 1,783) | arrival 1,073.0 HP/s; fly 25.4%; armor≥0.4 36.8%; MR≥0.5 0.0%; no pressure flag |
| 12 | 2,316 | 258 | 51.5 / 148.7 (gold 2,065) | arrival 840.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 22.5%; no pressure flag |

## The Emberwastes (`emberwastes`)

Start gold: 340. Waves: 14. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 768 | 75 | 17.1 / 24.5 (gold 340) | arrival 522.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 861 | 103 | 19.1 / 31.3 (gold 435) | arrival 568.0 HP/s; fly 0.0%; armor≥0.4 61.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,134 | 120 | 25.2 / 40.2 (gold 558) | arrival 853.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 34.4%; no pressure flag |
| 4 | 510 | 75 | 11.3 / 50.3 (gold 698) | arrival 452.0 HP/s; fly 34.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,255 | 149 | 27.9 / 57.1 (gold 793) | arrival 594.0 HP/s; fly 0.0%; armor≥0.4 58.6%; MR≥0.5 41.4%; no pressure flag |
| 6 | 886 | 112 | 19.7 / 69.3 (gold 962) | arrival 1,045.3 HP/s; fly 32.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,819 | 234 | 40.4 / 78.8 (gold 1,094) | arrival 1,095.3 HP/s; fly 22.3%; armor≥0.4 52.0%; MR≥0.5 25.7%; no pressure flag |
| 8 | 2,270 | 262 | 50.4 / 97.1 (gold 1,348) | arrival 889.7 HP/s; fly 0.0%; armor≥0.4 15.0%; MR≥0.5 28.6%; no pressure flag |
| 9 | 1,854 | 188 | 41.2 / 117.4 (gold 1,630) | arrival 2,414.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 21.0%; no pressure flag |
| 10 | 2,592 | 289 | 57.6 / 132.4 (gold 1,838) | arrival 1,226.2 HP/s; fly 20.1%; armor≥0.4 53.6%; MR≥0.5 0.0%; no pressure flag |
| 11 | 2,736 | 354 | 60.8 / 154.6 (gold 2,147) | arrival 1,269.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 53.2%; no pressure flag |
| 12 | 2,276 | 280 | 50.6 / 181.6 (gold 2,521) | arrival 2,313.1 HP/s; fly 30.6%; armor≥0.4 55.4%; MR≥0.5 0.0%; no pressure flag |
| 13 | 3,742 | 384 | 83.2 / 203.2 (gold 2,821) | arrival 1,812.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 20.8%; no pressure flag |
| 14 | 5,844 | 524 | 129.9 / 232.3 (gold 3,225) | arrival 5,190.0 HP/s; fly 9.9%; armor≥0.4 79.4%; MR≥0.5 10.7%; no pressure flag |

## Mistfen Crossing (`mistfen`)

Start gold: 360. Waves: 15. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 25.9 (gold 360) | arrival 413.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 664 | 64 | 14.8 / 31.0 (gold 430) | arrival 483.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 940 | 100 | 20.9 / 37.0 (gold 514) | arrival 369.5 HP/s; fly 0.0%; armor≥0.4 69.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 780 | 112 | 17.3 / 45.7 (gold 634) | arrival 514.0 HP/s; fly 29.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,051 | 133 | 23.4 / 55.2 (gold 766) | arrival 609.3 HP/s; fly 0.0%; armor≥0.4 40.0%; MR≥0.5 14.8%; no pressure flag |
| 6 | 1,252 | 139 | 27.8 / 66.2 (gold 919) | arrival 1,010.4 HP/s; fly 0.0%; armor≥0.4 27.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,208 | 152 | 26.8 / 77.6 (gold 1,078) | arrival 789.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 32.3%; no pressure flag |
| 8 | 1,233 | 165 | 27.4 / 90.0 (gold 1,250) | arrival 845.5 HP/s; fly 28.2%; armor≥0.4 25.5%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,109 | 157 | 24.6 / 103.4 (gold 1,435) | arrival 870.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 21.1%; no pressure flag |
| 10 | 1,552 | 199 | 34.5 / 116.1 (gold 1,612) | arrival 1,551.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 16.8%; no pressure flag |
| 11 | 2,055 | 229 | 45.7 / 131.9 (gold 1,831) | arrival 1,497.7 HP/s; fly 0.0%; armor≥0.4 42.1%; MR≥0.5 0.0%; no pressure flag |
| 12 | 1,838 | 240 | 40.8 / 149.8 (gold 2,080) | arrival 1,265.3 HP/s; fly 18.9%; armor≥0.4 18.5%; MR≥0.5 21.2%; no pressure flag |
| 13 | 1,947 | 243 | 43.3 / 168.5 (gold 2,340) | arrival 1,631.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 8.0%; no pressure flag |
| 14 | 2,062 | 250 | 45.8 / 187.5 (gold 2,603) | arrival 1,443.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 2,300 | 258 | 51.1 / 206.9 (gold 2,873) | arrival 1,086.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |

## The Shattered Crown (`shatteredcrown`)

Start gold: 400. Waves: 18. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 28.8 (gold 400) | arrival 387.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 504 | 72 | 11.2 / 33.9 (gold 470) | arrival 387.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 816 | 81 | 18.1 / 40.5 (gold 562) | arrival 429.4 HP/s; fly 0.0%; armor≥0.4 77.2%; MR≥0.5 0.0%; no pressure flag |
| 4 | 350 | 54 | 7.8 / 47.8 (gold 663) | arrival 158.0 HP/s; fly 33.1%; armor≥0.4 0.0%; MR≥0.5 66.9%; no pressure flag |
| 5 | 762 | 102 | 16.9 / 53.1 (gold 737) | arrival 1,041.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,226 | 154 | 27.2 / 61.9 (gold 859) | arrival 677.0 HP/s; fly 18.9%; armor≥0.4 27.7%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,338 | 153 | 29.7 / 74.4 (gold 1,033) | arrival 785.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 58.3%; no pressure flag |
| 8 | 1,605 | 174 | 35.7 / 86.9 (gold 1,206) | arrival 1,477.4 HP/s; fly 0.0%; armor≥0.4 58.9%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,508 | 183 | 33.5 / 100.8 (gold 1,400) | arrival 1,358.9 HP/s; fly 34.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 10 | 1,404 | 186 | 31.2 / 115.5 (gold 1,603) | arrival 993.9 HP/s; fly 0.0%; armor≥0.4 22.4%; MR≥0.5 16.7%; no pressure flag |
| 11 | 1,128 | 162 | 25.1 / 130.3 (gold 1,809) | arrival 592.7 HP/s; fly 30.9%; armor≥0.4 0.0%; MR≥0.5 69.1%; no pressure flag |
| 12 | 1,881 | 216 | 41.8 / 143.4 (gold 1,991) | arrival 2,537.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 13 | 2,494 | 256 | 55.4 / 160.4 (gold 2,227) | arrival 1,868.8 HP/s; fly 0.0%; armor≥0.4 38.9%; MR≥0.5 9.4%; no pressure flag |
| 14 | 1,656 | 228 | 36.8 / 180.3 (gold 2,503) | arrival 1,457.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 23.6%; no pressure flag |
| 15 | 2,056 | 241 | 45.7 / 198.1 (gold 2,751) | arrival 1,668.0 HP/s; fly 33.9%; armor≥0.4 16.5%; MR≥0.5 0.0%; no pressure flag |
| 16 | 2,315 | 273 | 51.4 / 216.9 (gold 3,012) | arrival 2,336.7 HP/s; fly 0.0%; armor≥0.4 13.6%; MR≥0.5 0.0%; no pressure flag |
| 17 | 4,834 | 382 | 107.4 / 238.0 (gold 3,305) | arrival 4,577.0 HP/s; fly 0.0%; armor≥0.4 87.3%; MR≥0.5 4.8%; no pressure flag |
| 18 | 4,238 | 507 | 94.2 / 267.0 (gold 3,707) | arrival 3,950.9 HP/s; fly 89.0%; armor≥0.4 0.0%; MR≥0.5 11.0%; no pressure flag |

## Shard economy summary

Costs imported from the game: overcharge 3 shards; ascension 6 shards plus 150 gold. The pass/fail check is shard-only, as requested. Normal difficulty contributes zero estimated elite shards. Bosses add 4 shards each; Shardbacks use their defined 2-shard drop.

An absent optional `startShards` field is counted as 0 in this definition-only analysis.

| Map | Waves | ⅔ cutoff | Start shards | Shardbacks by cutoff / total | Bosses by cutoff / total | Shards by cutoff / total | Ascension by cutoff (maps 3–5) | Max total overcharges | Max total ascensions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1. greenhollow | 10 | 7 | 0 | 2 / 4 | 0 / 0 | 4 / 8 | n/a | 2 | 1 |
| 2. frostmere | 12 | 8 | 0 | 2 / 4 | 0 / 0 | 4 / 8 | n/a | 2 | 1 |
| 3. emberwastes | 14 | 10 | 0 | 4 / 4 | 0 / 1 | 8 / 12 | **PASS** | 4 | 2 |
| 4. mistfen | 15 | 10 | 3 | 4 / 8 | 0 / 0 | 11 / 19 | **PASS** | 6 | 3 |
| 5. shatteredcrown | 18 | 12 | 4 | 2 / 6 | 0 / 2 | 8 / 24 | **PASS** | 8 | 4 |

## Recommended tuning changes

