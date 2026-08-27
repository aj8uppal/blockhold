# Blockhold static balance report

Generated from `enemyDefs.ts`, `towerDefs.ts`, `levels.ts`, and `types.ts` on normal difficulty.

## Method

- Tower efficiency **X = 0.0847 DPS/gold**, the mean of 12 tier-1–3 entries: damage midpoint ÷ attack interval ÷ cumulative cost. Barracks count all deployed soldiers.
- Affordable DPS before a wave = (start gold + prior bounties + 20 early-call gold per prior wave) × 85.0% tower spend × X. Required DPS = authored wave HP ÷ 45s.
- Arrival pressure is the requested rough Σ(enemy HP × count ÷ group interval). HP shares use authored group HP.
- This deliberately static model excludes armor/MR from raw required DPS, lane coverage, travel time, splash, crowd control, healing, regen, phasing, surge empowerment, spawned/summoned adds, heroes, and armory bonuses.
- The 3 trap definitions (50–90 gold), 8 ascension perk choices, and overcharge combat bonus are excluded from tower capacity; shard costs are analyzed separately.
- Across 153 waves: **0 raw-DPS capacity flags**, **0 early-flying flags**, and **0 waves in sustained high-MR runs**.

## Greenhollow (`greenhollow`)

Start gold: 260. Waves: 16. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 496 | 40 | 11.0 / 18.7 (gold 260) | arrival 291.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 747 | 60 | 16.6 / 23.0 (gold 320) | arrival 533.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 675 | 64 | 15.0 / 28.8 (gold 400) | arrival 442.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 4 | 777 | 84 | 17.3 / 34.9 (gold 484) | arrival 567.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,086 | 95 | 24.1 / 42.4 (gold 588) | arrival 659.9 HP/s; fly 0.0%; armor≥0.4 51.4%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,126 | 130 | 25.0 / 50.6 (gold 703) | arrival 623.5 HP/s; fly 34.0%; armor≥0.4 33.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,910 | 168 | 42.5 / 61.4 (gold 853) | arrival 1,414.7 HP/s; fly 0.0%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 8 | 1,484 | 163 | 33.0 / 75.0 (gold 1,041) | arrival 961.5 HP/s; fly 37.4%; armor≥0.4 42.3%; MR≥0.5 0.0%; no pressure flag |
| 9 | 2,992 | 234 | 66.5 / 88.2 (gold 1,224) | arrival 2,595.7 HP/s; fly 0.0%; armor≥0.4 40.7%; MR≥0.5 0.0%; no pressure flag |
| 10 | 2,968 | 234 | 66.0 / 106.5 (gold 1,478) | arrival 2,836.8 HP/s; fly 15.5%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 11 | 2,240 | 176 | 49.8 / 124.7 (gold 1,732) | arrival 1,418.2 HP/s; fly 0.0%; armor≥0.4 73.8%; MR≥0.5 0.0%; no pressure flag |
| 12 | 3,280 | 228 | 72.9 / 138.9 (gold 1,928) | arrival 3,445.5 HP/s; fly 21.0%; armor≥0.4 28.5%; MR≥0.5 0.0%; no pressure flag |
| 13 | 2,686 | 184 | 59.7 / 156.7 (gold 2,176) | arrival 1,159.1 HP/s; fly 0.0%; armor≥0.4 20.0%; MR≥0.5 0.0%; no pressure flag |
| 14 | 3,821 | 256 | 84.9 / 171.4 (gold 2,380) | arrival 3,384.5 HP/s; fly 30.5%; armor≥0.4 36.8%; MR≥0.5 0.0%; no pressure flag |
| 15 | 4,169 | 283 | 92.6 / 191.3 (gold 2,656) | arrival 3,246.3 HP/s; fly 19.9%; armor≥0.4 55.0%; MR≥0.5 0.0%; no pressure flag |
| 16 | 8,873 | 482 | 197.2 / 213.1 (gold 2,959) | arrival 8,184.9 HP/s; fly 12.4%; armor≥0.4 18.0%; MR≥0.5 0.0%; no pressure flag |

## Frostmere Pass (`frostmere`)

Start gold: 300. Waves: 18. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 744 | 60 | 16.5 / 21.6 (gold 300) | arrival 465.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 751 | 76 | 16.7 / 27.4 (gold 380) | arrival 550.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 830 | 97 | 18.5 / 34.3 (gold 476) | arrival 514.6 HP/s; fly 0.0%; armor≥0.4 64.1%; MR≥0.5 0.0%; no pressure flag |
| 4 | 961 | 98 | 21.4 / 42.7 (gold 593) | arrival 667.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 33.5%; no pressure flag |
| 5 | 922 | 109 | 20.5 / 51.2 (gold 711) | arrival 506.9 HP/s; fly 39.9%; armor≥0.4 60.1%; MR≥0.5 0.0%; no pressure flag |
| 6 | 481 | 57 | 10.7 / 60.5 (gold 840) | arrival 822.4 HP/s; fly 13.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 2,028 | 213 | 45.1 / 66.0 (gold 917) | arrival 1,080.0 HP/s; fly 0.0%; armor≥0.4 59.7%; MR≥0.5 21.7%; no pressure flag |
| 8 | 1,889 | 186 | 42.0 / 82.8 (gold 1,150) | arrival 1,329.6 HP/s; fly 21.6%; armor≥0.4 0.0%; MR≥0.5 32.3%; no pressure flag |
| 9 | 1,423 | 125 | 31.6 / 97.7 (gold 1,356) | arrival 1,213.9 HP/s; fly 0.0%; armor≥0.4 54.2%; MR≥0.5 0.0%; no pressure flag |
| 10 | 2,519 | 262 | 56.0 / 108.1 (gold 1,501) | arrival 1,413.0 HP/s; fly 0.0%; armor≥0.4 17.3%; MR≥0.5 57.0%; no pressure flag |
| 11 | 3,079 | 262 | 68.4 / 128.4 (gold 1,783) | arrival 1,448.9 HP/s; fly 25.4%; armor≥0.4 36.8%; MR≥0.5 0.0%; no pressure flag |
| 12 | 3,298 | 258 | 73.3 / 148.7 (gold 2,065) | arrival 1,196.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 22.5%; no pressure flag |
| 13 | 2,597 | 200 | 57.7 / 168.8 (gold 2,343) | arrival 1,348.5 HP/s; fly 0.0%; armor≥0.4 68.4%; MR≥0.5 31.6%; no pressure flag |
| 14 | 2,535 | 231 | 56.3 / 184.6 (gold 2,563) | arrival 1,866.7 HP/s; fly 32.8%; armor≥0.4 0.0%; MR≥0.5 40.8%; no pressure flag |
| 15 | 2,872 | 183 | 63.8 / 202.7 (gold 2,814) | arrival 1,861.0 HP/s; fly 0.0%; armor≥0.4 43.2%; MR≥0.5 0.0%; no pressure flag |
| 16 | 4,020 | 274 | 89.3 / 217.3 (gold 3,017) | arrival 1,697.2 HP/s; fly 25.8%; armor≥0.4 15.1%; MR≥0.5 20.8%; no pressure flag |
| 17 | 4,852 | 318 | 107.8 / 238.5 (gold 3,311) | arrival 4,140.0 HP/s; fly 0.0%; armor≥0.4 41.0%; MR≥0.5 30.5%; no pressure flag |
| 18 | 8,835 | 474 | 196.3 / 262.8 (gold 3,649) | arrival 4,933.8 HP/s; fly 0.0%; armor≥0.4 23.9%; MR≥0.5 14.8%; no pressure flag |

## The Emberwastes (`emberwastes`)

Start gold: 340. Waves: 20. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 768 | 75 | 17.1 / 24.5 (gold 340) | arrival 522.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 864 | 103 | 19.2 / 31.3 (gold 435) | arrival 569.7 HP/s; fly 0.0%; armor≥0.4 61.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,148 | 120 | 25.5 / 40.2 (gold 558) | arrival 864.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 34.4%; no pressure flag |
| 4 | 524 | 75 | 11.7 / 50.3 (gold 698) | arrival 464.7 HP/s; fly 34.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,318 | 149 | 29.3 / 57.1 (gold 793) | arrival 623.7 HP/s; fly 0.0%; armor≥0.4 58.6%; MR≥0.5 41.4%; no pressure flag |
| 6 | 955 | 112 | 21.2 / 69.3 (gold 962) | arrival 1,126.8 HP/s; fly 32.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 2,023 | 234 | 45.0 / 78.8 (gold 1,094) | arrival 1,218.2 HP/s; fly 22.3%; armor≥0.4 52.0%; MR≥0.5 25.7%; no pressure flag |
| 8 | 2,715 | 284 | 60.3 / 97.1 (gold 1,348) | arrival 1,123.6 HP/s; fly 0.0%; armor≥0.4 14.4%; MR≥0.5 27.6%; no pressure flag |
| 9 | 2,224 | 188 | 49.4 / 119.0 (gold 1,652) | arrival 2,896.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 21.0%; no pressure flag |
| 10 | 3,459 | 333 | 76.9 / 134.0 (gold 1,860) | arrival 1,571.2 HP/s; fly 18.9%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 11 | 3,589 | 354 | 79.7 / 159.4 (gold 2,213) | arrival 1,665.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 53.2%; no pressure flag |
| 12 | 3,134 | 280 | 69.6 / 186.3 (gold 2,587) | arrival 3,185.3 HP/s; fly 30.6%; armor≥0.4 55.4%; MR≥0.5 0.0%; no pressure flag |
| 13 | 5,421 | 384 | 120.5 / 207.9 (gold 2,887) | arrival 2,625.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 20.8%; no pressure flag |
| 14 | 8,922 | 524 | 198.3 / 237.0 (gold 3,291) | arrival 7,923.4 HP/s; fly 9.9%; armor≥0.4 79.4%; MR≥0.5 10.7%; no pressure flag |
| 15 | 2,899 | 180 | 64.4 / 276.2 (gold 3,835) | arrival 2,811.1 HP/s; fly 0.0%; armor≥0.4 18.9%; MR≥0.5 26.0%; no pressure flag |
| 16 | 2,950 | 252 | 65.6 / 290.6 (gold 4,035) | arrival 2,396.6 HP/s; fly 33.4%; armor≥0.4 0.0%; MR≥0.5 37.5%; no pressure flag |
| 17 | 3,802 | 253 | 84.5 / 310.2 (gold 4,307) | arrival 2,671.4 HP/s; fly 0.0%; armor≥0.4 44.7%; MR≥0.5 0.0%; no pressure flag |
| 18 | 5,238 | 328 | 116.4 / 329.9 (gold 4,580) | arrival 2,092.1 HP/s; fly 21.0%; armor≥0.4 12.3%; MR≥0.5 19.8%; no pressure flag |
| 19 | 5,846 | 363 | 129.9 / 354.9 (gold 4,928) | arrival 5,418.8 HP/s; fly 0.0%; armor≥0.4 39.7%; MR≥0.5 31.3%; no pressure flag |
| 20 | 20,494 | 774 | 455.4 / 382.5 (gold 5,311) | arrival 19,472.3 HP/s; fly 6.0%; armor≥0.4 87.5%; MR≥0.5 6.5%; no pressure flag |

## Mistfen Crossing (`mistfen`)

Start gold: 360. Waves: 21. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 25.9 (gold 360) | arrival 413.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 666 | 64 | 14.8 / 31.0 (gold 430) | arrival 484.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 951 | 100 | 21.1 / 37.0 (gold 514) | arrival 373.9 HP/s; fly 0.0%; armor≥0.4 69.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 801 | 112 | 17.8 / 45.7 (gold 634) | arrival 527.6 HP/s; fly 29.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,101 | 133 | 24.5 / 55.2 (gold 766) | arrival 638.1 HP/s; fly 0.0%; armor≥0.4 40.0%; MR≥0.5 14.8%; no pressure flag |
| 6 | 1,344 | 139 | 29.9 / 66.2 (gold 919) | arrival 1,085.0 HP/s; fly 0.0%; armor≥0.4 27.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,757 | 182 | 39.0 / 77.6 (gold 1,078) | arrival 1,293.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 24.6%; no pressure flag |
| 8 | 1,411 | 165 | 31.4 / 92.2 (gold 1,280) | arrival 967.8 HP/s; fly 28.2%; armor≥0.4 25.5%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,420 | 179 | 31.5 / 105.5 (gold 1,465) | arrival 1,136.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 19.6%; no pressure flag |
| 10 | 1,923 | 199 | 42.7 / 119.8 (gold 1,664) | arrival 1,923.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 16.8%; no pressure flag |
| 11 | 3,154 | 259 | 70.1 / 135.6 (gold 1,883) | arrival 2,432.3 HP/s; fly 0.0%; armor≥0.4 35.5%; MR≥0.5 0.0%; no pressure flag |
| 12 | 2,495 | 240 | 55.4 / 155.7 (gold 2,162) | arrival 1,717.4 HP/s; fly 18.9%; armor≥0.4 18.5%; MR≥0.5 21.2%; no pressure flag |
| 13 | 2,775 | 243 | 61.7 / 174.4 (gold 2,422) | arrival 2,325.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 8.0%; no pressure flag |
| 14 | 3,091 | 250 | 68.7 / 193.4 (gold 2,685) | arrival 2,163.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 4,500 | 332 | 100.0 / 212.8 (gold 2,955) | arrival 2,360.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 16 | 2,480 | 192 | 55.1 / 238.2 (gold 3,307) | arrival 1,719.8 HP/s; fly 0.0%; armor≥0.4 22.8%; MR≥0.5 26.2%; no pressure flag |
| 17 | 3,229 | 261 | 71.8 / 253.5 (gold 3,519) | arrival 2,674.4 HP/s; fly 25.2%; armor≥0.4 0.0%; MR≥0.5 28.3%; no pressure flag |
| 18 | 3,351 | 194 | 74.5 / 273.7 (gold 3,800) | arrival 2,438.3 HP/s; fly 0.0%; armor≥0.4 46.5%; MR≥0.5 0.0%; no pressure flag |
| 19 | 4,937 | 301 | 109.7 / 289.1 (gold 4,014) | arrival 2,741.1 HP/s; fly 0.0%; armor≥0.4 13.5%; MR≥0.5 18.5%; no pressure flag |
| 20 | 5,306 | 364 | 117.9 / 312.2 (gold 4,335) | arrival 5,153.8 HP/s; fly 18.1%; armor≥0.4 0.0%; MR≥0.5 25.3%; no pressure flag |
| 21 | 13,905 | 549 | 309.0 / 339.9 (gold 4,719) | arrival 12,497.6 HP/s; fly 0.0%; armor≥0.4 74.4%; MR≥0.5 0.0%; no pressure flag |

## The Shattered Crown (`shatteredcrown`)

Start gold: 400. Waves: 24. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 28.8 (gold 400) | arrival 387.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 505 | 72 | 11.2 / 33.9 (gold 470) | arrival 388.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 824 | 81 | 18.3 / 40.5 (gold 562) | arrival 433.8 HP/s; fly 0.0%; armor≥0.4 77.2%; MR≥0.5 0.0%; no pressure flag |
| 4 | 358 | 54 | 8.0 / 47.8 (gold 663) | arrival 161.7 HP/s; fly 33.1%; armor≥0.4 0.0%; MR≥0.5 66.9%; no pressure flag |
| 5 | 793 | 102 | 17.6 / 53.1 (gold 737) | arrival 1,084.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,304 | 154 | 29.0 / 61.9 (gold 859) | arrival 720.2 HP/s; fly 18.9%; armor≥0.4 27.7%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,461 | 153 | 32.5 / 74.4 (gold 1,033) | arrival 858.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 58.3%; no pressure flag |
| 8 | 1,806 | 174 | 40.1 / 86.9 (gold 1,206) | arrival 1,662.1 HP/s; fly 0.0%; armor≥0.4 58.9%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,754 | 183 | 39.0 / 100.8 (gold 1,400) | arrival 1,580.8 HP/s; fly 34.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 10 | 1,694 | 186 | 37.6 / 115.5 (gold 1,603) | arrival 1,199.3 HP/s; fly 0.0%; armor≥0.4 22.4%; MR≥0.5 16.7%; no pressure flag |
| 11 | 1,416 | 162 | 31.5 / 130.3 (gold 1,809) | arrival 743.9 HP/s; fly 30.9%; armor≥0.4 0.0%; MR≥0.5 69.1%; no pressure flag |
| 12 | 2,462 | 216 | 54.7 / 143.4 (gold 1,991) | arrival 3,321.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 13 | 3,411 | 256 | 75.8 / 160.4 (gold 2,227) | arrival 2,555.5 HP/s; fly 0.0%; armor≥0.4 38.9%; MR≥0.5 9.4%; no pressure flag |
| 14 | 2,370 | 228 | 52.7 / 180.3 (gold 2,503) | arrival 2,085.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 23.6%; no pressure flag |
| 15 | 3,084 | 241 | 68.5 / 198.1 (gold 2,751) | arrival 2,502.3 HP/s; fly 33.9%; armor≥0.4 16.5%; MR≥0.5 0.0%; no pressure flag |
| 16 | 3,644 | 273 | 81.0 / 216.9 (gold 3,012) | arrival 3,678.4 HP/s; fly 0.0%; armor≥0.4 13.6%; MR≥0.5 0.0%; no pressure flag |
| 17 | 7,992 | 382 | 177.6 / 238.0 (gold 3,305) | arrival 7,567.2 HP/s; fly 0.0%; armor≥0.4 87.3%; MR≥0.5 4.8%; no pressure flag |
| 18 | 7,364 | 507 | 163.6 / 267.0 (gold 3,707) | arrival 6,864.8 HP/s; fly 89.0%; armor≥0.4 0.0%; MR≥0.5 11.0%; no pressure flag |
| 19 | 2,704 | 184 | 60.1 / 305.0 (gold 4,234) | arrival 2,206.8 HP/s; fly 0.0%; armor≥0.4 23.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 2,836 | 216 | 63.0 / 319.6 (gold 4,438) | arrival 1,795.5 HP/s; fly 47.2%; armor≥0.4 0.0%; MR≥0.5 52.8%; no pressure flag |
| 21 | 4,114 | 242 | 91.4 / 336.6 (gold 4,674) | arrival 5,537.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 22 | 5,515 | 280 | 122.6 / 355.5 (gold 4,936) | arrival 4,937.4 HP/s; fly 0.0%; armor≥0.4 13.1%; MR≥0.5 0.0%; no pressure flag |
| 23 | 4,285 | 243 | 95.2 / 377.1 (gold 5,236) | arrival 3,397.4 HP/s; fly 0.0%; armor≥0.4 49.3%; MR≥0.5 24.4%; no pressure flag |
| 24 | 18,551 | 728 | 412.2 / 396.1 (gold 5,499) | arrival 18,443.9 HP/s; fly 44.1%; armor≥0.4 48.1%; MR≥0.5 3.0%; no pressure flag |

## Cinderwake Caldera (`cinderwake`)

Start gold: 440. Waves: 26. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 868 | 70 | 19.3 / 31.7 (gold 440) | arrival 578.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 792 | 82 | 17.6 / 38.2 (gold 530) | arrival 628.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,160 | 121 | 25.8 / 45.5 (gold 632) | arrival 789.8 HP/s; fly 0.0%; armor≥0.4 45.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 752 | 74 | 16.7 / 55.7 (gold 773) | arrival 582.9 HP/s; fly 32.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,217 | 151 | 27.0 / 62.4 (gold 867) | arrival 798.3 HP/s; fly 0.0%; armor≥0.4 44.8%; MR≥0.5 26.6%; no pressure flag |
| 6 | 1,363 | 167 | 30.3 / 74.8 (gold 1,038) | arrival 687.9 HP/s; fly 73.6%; armor≥0.4 26.4%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,735 | 180 | 38.6 / 88.2 (gold 1,225) | arrival 1,495.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 32.5%; no pressure flag |
| 8 | 1,331 | 129 | 29.6 / 102.6 (gold 1,425) | arrival 1,317.2 HP/s; fly 0.0%; armor≥0.4 52.8%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,414 | 179 | 31.4 / 113.4 (gold 1,574) | arrival 839.6 HP/s; fly 68.3%; armor≥0.4 0.0%; MR≥0.5 31.7%; no pressure flag |
| 10 | 2,522 | 248 | 56.0 / 127.7 (gold 1,773) | arrival 1,583.3 HP/s; fly 0.0%; armor≥0.4 55.7%; MR≥0.5 24.5%; no pressure flag |
| 11 | 2,705 | 226 | 60.1 / 147.0 (gold 2,041) | arrival 1,948.7 HP/s; fly 21.2%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 12 | 1,957 | 228 | 43.5 / 164.7 (gold 2,287) | arrival 1,407.2 HP/s; fly 31.5%; armor≥0.4 0.0%; MR≥0.5 25.6%; no pressure flag |
| 13 | 6,758 | 399 | 150.2 / 182.6 (gold 2,535) | arrival 6,066.6 HP/s; fly 0.0%; armor≥0.4 89.7%; MR≥0.5 10.3%; no pressure flag |
| 14 | 2,021 | 174 | 44.9 / 212.8 (gold 2,954) | arrival 1,477.0 HP/s; fly 33.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 2,962 | 272 | 65.8 / 226.7 (gold 3,148) | arrival 2,592.1 HP/s; fly 25.7%; armor≥0.4 16.7%; MR≥0.5 0.0%; no pressure flag |
| 16 | 3,890 | 274 | 86.4 / 247.8 (gold 3,440) | arrival 2,080.3 HP/s; fly 0.0%; armor≥0.4 33.0%; MR≥0.5 18.4%; no pressure flag |
| 17 | 3,326 | 293 | 73.9 / 268.9 (gold 3,734) | arrival 2,334.6 HP/s; fly 75.0%; armor≥0.4 0.0%; MR≥0.5 25.0%; no pressure flag |
| 18 | 5,322 | 317 | 118.3 / 291.5 (gold 4,047) | arrival 5,341.6 HP/s; fly 0.0%; armor≥0.4 40.5%; MR≥0.5 20.5%; no pressure flag |
| 19 | 3,094 | 214 | 68.8 / 315.8 (gold 4,384) | arrival 2,892.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 7,091 | 440 | 157.6 / 332.6 (gold 4,618) | arrival 6,809.0 HP/s; fly 100.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 21 | 4,530 | 282 | 100.7 / 365.7 (gold 5,078) | arrival 2,237.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 23.3%; no pressure flag |
| 22 | 6,147 | 363 | 136.6 / 387.5 (gold 5,380) | arrival 4,507.9 HP/s; fly 0.0%; armor≥0.4 46.0%; MR≥0.5 25.8%; no pressure flag |
| 23 | 4,585 | 306 | 101.9 / 415.1 (gold 5,763) | arrival 2,749.5 HP/s; fly 60.5%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 24 | 4,896 | 254 | 108.8 / 438.6 (gold 6,089) | arrival 3,145.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 25.0%; no pressure flag |
| 25 | 8,154 | 443 | 181.2 / 458.3 (gold 6,363) | arrival 7,727.7 HP/s; fly 0.0%; armor≥0.4 33.3%; MR≥0.5 22.5%; no pressure flag |
| 26 | 22,773 | 747 | 506.1 / 491.6 (gold 6,826) | arrival 22,094.8 HP/s; fly 12.8%; armor≥0.4 82.2%; MR≥0.5 5.1%; no pressure flag |

## Veilscar Confluence (`veilscar`)

Start gold: 460. Waves: 28. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 992 | 80 | 22.0 / 33.1 (gold 460) | arrival 661.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 631 | 90 | 14.0 / 40.3 (gold 560) | arrival 526.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,307 | 136 | 29.0 / 48.3 (gold 670) | arrival 940.4 HP/s; fly 0.0%; armor≥0.4 32.4%; MR≥0.5 0.0%; no pressure flag |
| 4 | 1,008 | 120 | 22.4 / 59.5 (gold 826) | arrival 568.5 HP/s; fly 17.6%; armor≥0.4 34.4%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,419 | 144 | 31.5 / 69.6 (gold 966) | arrival 1,258.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 54.8%; no pressure flag |
| 6 | 1,524 | 182 | 33.9 / 81.4 (gold 1,130) | arrival 1,085.4 HP/s; fly 33.2%; armor≥0.4 43.6%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,382 | 174 | 30.7 / 95.9 (gold 1,332) | arrival 1,180.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 40.6%; no pressure flag |
| 8 | 1,358 | 146 | 30.2 / 109.9 (gold 1,526) | arrival 1,269.2 HP/s; fly 28.3%; armor≥0.4 0.0%; MR≥0.5 71.7%; no pressure flag |
| 9 | 1,866 | 168 | 41.5 / 121.9 (gold 1,692) | arrival 1,588.8 HP/s; fly 0.0%; armor≥0.4 65.6%; MR≥0.5 0.0%; no pressure flag |
| 10 | 5,593 | 388 | 124.3 / 135.4 (gold 1,880) | arrival 5,328.4 HP/s; fly 0.0%; armor≥0.4 79.8%; MR≥0.5 8.2%; no pressure flag |
| 11 | 2,031 | 235 | 45.1 / 164.8 (gold 2,288) | arrival 1,517.3 HP/s; fly 35.9%; armor≥0.4 0.0%; MR≥0.5 38.9%; no pressure flag |
| 12 | 3,265 | 250 | 72.5 / 183.2 (gold 2,543) | arrival 2,264.2 HP/s; fly 0.0%; armor≥0.4 32.5%; MR≥0.5 34.0%; no pressure flag |
| 13 | 3,162 | 306 | 70.3 / 202.6 (gold 2,813) | arrival 2,451.7 HP/s; fly 19.2%; armor≥0.4 14.1%; MR≥0.5 19.4%; no pressure flag |
| 14 | 2,343 | 201 | 52.1 / 226.1 (gold 3,139) | arrival 1,553.4 HP/s; fly 35.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 3,616 | 314 | 80.3 / 242.0 (gold 3,360) | arrival 1,552.2 HP/s; fly 0.0%; armor≥0.4 33.1%; MR≥0.5 60.2%; no pressure flag |
| 16 | 2,889 | 246 | 64.2 / 266.1 (gold 3,694) | arrival 2,237.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 17 | 3,504 | 304 | 77.9 / 285.2 (gold 3,960) | arrival 2,061.5 HP/s; fly 31.9%; armor≥0.4 15.1%; MR≥0.5 53.0%; no pressure flag |
| 18 | 3,333 | 238 | 74.1 / 308.6 (gold 4,284) | arrival 2,769.0 HP/s; fly 22.6%; armor≥0.4 0.0%; MR≥0.5 21.4%; no pressure flag |
| 19 | 7,038 | 472 | 156.4 / 327.1 (gold 4,542) | arrival 6,993.2 HP/s; fly 81.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 4,909 | 330 | 109.1 / 362.6 (gold 5,034) | arrival 3,882.6 HP/s; fly 0.0%; armor≥0.4 50.4%; MR≥0.5 28.3%; no pressure flag |
| 21 | 3,926 | 246 | 87.2 / 387.8 (gold 5,384) | arrival 1,020.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 67.7%; no pressure flag |
| 22 | 4,833 | 319 | 107.4 / 406.9 (gold 5,650) | arrival 4,734.6 HP/s; fly 23.4%; armor≥0.4 38.2%; MR≥0.5 0.0%; no pressure flag |
| 23 | 4,991 | 323 | 110.9 / 431.4 (gold 5,989) | arrival 3,301.1 HP/s; fly 54.1%; armor≥0.4 13.9%; MR≥0.5 32.0%; no pressure flag |
| 24 | 7,033 | 322 | 156.3 / 456.1 (gold 6,332) | arrival 2,752.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 26.8%; no pressure flag |
| 25 | 12,062 | 476 | 268.0 / 480.7 (gold 6,674) | arrival 11,971.1 HP/s; fly 0.0%; armor≥0.4 70.7%; MR≥0.5 11.6%; no pressure flag |
| 26 | 8,090 | 439 | 179.8 / 516.4 (gold 7,170) | arrival 7,438.2 HP/s; fly 17.4%; armor≥0.4 36.6%; MR≥0.5 26.4%; no pressure flag |
| 27 | 8,267 | 369 | 183.7 / 549.5 (gold 7,629) | arrival 3,819.9 HP/s; fly 0.0%; armor≥0.4 15.2%; MR≥0.5 26.2%; no pressure flag |
| 28 | 20,322 | 783 | 451.6 / 577.5 (gold 8,018) | arrival 20,008.1 HP/s; fly 13.5%; armor≥0.4 0.0%; MR≥0.5 5.9%; no pressure flag |

## Shard economy summary

Costs imported from the game: overcharge 3 shards; ascension 6 shards plus 150 gold. The pass/fail check is shard-only, as requested. Normal difficulty contributes zero estimated elite shards. Bosses add 4 shards each; Shardbacks use their defined 2-shard drop.

An absent optional `startShards` field is counted as 0 in this definition-only analysis.

| Map | Waves | ⅔ cutoff | Start shards | Shardbacks by cutoff / total | Bosses by cutoff / total | Shards by cutoff / total | Ascension by cutoff (maps 3–5) | Max total overcharges | Max total ascensions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1. greenhollow | 16 | 11 | 0 | 7 / 12 | 1 / 2 | 19 / 34 | n/a | 11 | 5 |
| 2. frostmere | 18 | 12 | 0 | 4 / 9 | 0 / 1 | 8 / 23 | n/a | 7 | 3 |
| 3. emberwastes | 20 | 14 | 0 | 4 / 8 | 1 / 3 | 12 / 28 | **PASS** | 9 | 4 |
| 4. mistfen | 21 | 14 | 3 | 8 / 12 | 0 / 1 | 19 / 31 | **PASS** | 10 | 5 |
| 5. shatteredcrown | 24 | 16 | 4 | 6 / 10 | 0 / 4 | 16 / 40 | **PASS** | 13 | 6 |
| 6. cinderwake | 26 | 18 | 4 | 8 / 10 | 1 / 4 | 24 / 40 | **PASS** | 13 | 6 |
| 7. veilscar | 28 | 19 | 5 | 8 / 15 | 2 / 4 | 29 / 51 | **PASS** | 17 | 8 |

## Recommended tuning changes

- **emberwastes shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 10 to wave 15; shards available at the wave-14 two-thirds mark drop from 12 to 8, still funding one 6-shard ascension but no longer front-loading 2 ascensions.
- **mistfen shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 12 to wave 15; shards available at the wave-14 two-thirds mark drop from 19 to 15, still funding one 6-shard ascension but no longer front-loading 3 ascensions.
- **shatteredcrown shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 15 to wave 17; shards available at the wave-16 two-thirds mark drop from 16 to 12, still funding one 6-shard ascension but no longer front-loading 2 ascensions.
- **cinderwake shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 18 to wave 19; shards available at the wave-18 two-thirds mark drop from 24 to 20, still funding one 6-shard ascension but no longer front-loading 4 ascensions.
- **veilscar shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 17 to wave 20; shards available at the wave-19 two-thirds mark drop from 29 to 25, still funding one 6-shard ascension but no longer front-loading 4 ascensions.
