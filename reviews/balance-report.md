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
| 2 | 744 | 60 | 16.5 / 23.0 (gold 320) | arrival 531.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 664 | 64 | 14.8 / 28.8 (gold 400) | arrival 435.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 4 | 750 | 84 | 16.7 / 34.9 (gold 484) | arrival 547.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,021 | 95 | 22.7 / 42.4 (gold 588) | arrival 620.2 HP/s; fly 0.0%; armor≥0.4 51.4%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,024 | 130 | 22.8 / 50.6 (gold 703) | arrival 566.8 HP/s; fly 34.0%; armor≥0.4 33.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,670 | 168 | 37.1 / 61.4 (gold 853) | arrival 1,236.7 HP/s; fly 0.0%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 8 | 1,241 | 163 | 27.6 / 75.0 (gold 1,041) | arrival 803.9 HP/s; fly 37.4%; armor≥0.4 42.3%; MR≥0.5 0.0%; no pressure flag |
| 9 | 2,382 | 234 | 52.9 / 88.2 (gold 1,224) | arrival 2,066.7 HP/s; fly 0.0%; armor≥0.4 40.7%; MR≥0.5 0.0%; no pressure flag |
| 10 | 2,068 | 216 | 46.0 / 106.5 (gold 1,478) | arrival 1,182.9 HP/s; fly 22.4%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 11 | 1,600 | 176 | 35.6 / 123.5 (gold 1,714) | arrival 1,013.0 HP/s; fly 0.0%; armor≥0.4 73.8%; MR≥0.5 0.0%; no pressure flag |
| 12 | 2,210 | 228 | 49.1 / 137.6 (gold 1,910) | arrival 2,321.8 HP/s; fly 21.0%; armor≥0.4 28.5%; MR≥0.5 0.0%; no pressure flag |
| 13 | 1,704 | 184 | 37.9 / 155.4 (gold 2,158) | arrival 735.5 HP/s; fly 0.0%; armor≥0.4 20.0%; MR≥0.5 0.0%; no pressure flag |
| 14 | 2,280 | 256 | 50.7 / 170.1 (gold 2,362) | arrival 2,019.4 HP/s; fly 30.5%; armor≥0.4 36.8%; MR≥0.5 0.0%; no pressure flag |
| 15 | 2,337 | 283 | 51.9 / 190.0 (gold 2,638) | arrival 1,819.7 HP/s; fly 19.9%; armor≥0.4 55.0%; MR≥0.5 0.0%; no pressure flag |
| 16 | 3,950 | 404 | 87.8 / 211.8 (gold 2,941) | arrival 3,219.3 HP/s; fly 14.7%; armor≥0.4 21.3%; MR≥0.5 0.0%; no pressure flag |

## Frostmere Pass (`frostmere`)

Start gold: 300. Waves: 18. Pressure-flagged waves: 0.

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
| 13 | 1,726 | 200 | 38.4 / 168.8 (gold 2,343) | arrival 896.3 HP/s; fly 0.0%; armor≥0.4 68.4%; MR≥0.5 31.6%; no pressure flag |
| 14 | 1,592 | 231 | 35.4 / 184.6 (gold 2,563) | arrival 1,172.5 HP/s; fly 32.8%; armor≥0.4 0.0%; MR≥0.5 40.8%; no pressure flag |
| 15 | 1,703 | 183 | 37.8 / 202.7 (gold 2,814) | arrival 1,103.4 HP/s; fly 0.0%; armor≥0.4 43.2%; MR≥0.5 0.0%; no pressure flag |
| 16 | 2,248 | 274 | 50.0 / 217.3 (gold 3,017) | arrival 949.1 HP/s; fly 25.8%; armor≥0.4 15.1%; MR≥0.5 20.8%; no pressure flag |
| 17 | 2,558 | 318 | 56.8 / 238.5 (gold 3,311) | arrival 2,182.5 HP/s; fly 0.0%; armor≥0.4 41.0%; MR≥0.5 30.5%; no pressure flag |
| 18 | 3,670 | 396 | 81.6 / 262.8 (gold 3,649) | arrival 1,363.0 HP/s; fly 0.0%; armor≥0.4 28.6%; MR≥0.5 17.7%; no pressure flag |

## The Emberwastes (`emberwastes`)

Start gold: 340. Waves: 20. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 768 | 75 | 17.1 / 24.5 (gold 340) | arrival 522.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 861 | 103 | 19.1 / 31.3 (gold 435) | arrival 568.0 HP/s; fly 0.0%; armor≥0.4 61.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,134 | 120 | 25.2 / 40.2 (gold 558) | arrival 853.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 34.4%; no pressure flag |
| 4 | 510 | 75 | 11.3 / 50.3 (gold 698) | arrival 452.0 HP/s; fly 34.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,255 | 149 | 27.9 / 57.1 (gold 793) | arrival 594.0 HP/s; fly 0.0%; armor≥0.4 58.6%; MR≥0.5 41.4%; no pressure flag |
| 6 | 886 | 112 | 19.7 / 69.3 (gold 962) | arrival 1,045.3 HP/s; fly 32.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,819 | 234 | 40.4 / 78.8 (gold 1,094) | arrival 1,095.3 HP/s; fly 22.3%; armor≥0.4 52.0%; MR≥0.5 25.7%; no pressure flag |
| 8 | 2,355 | 284 | 52.3 / 97.1 (gold 1,348) | arrival 974.7 HP/s; fly 0.0%; armor≥0.4 14.4%; MR≥0.5 27.6%; no pressure flag |
| 9 | 1,854 | 188 | 41.2 / 119.0 (gold 1,652) | arrival 2,414.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 21.0%; no pressure flag |
| 10 | 2,762 | 333 | 61.4 / 134.0 (gold 1,860) | arrival 1,254.5 HP/s; fly 18.9%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 11 | 2,736 | 354 | 60.8 / 159.4 (gold 2,213) | arrival 1,269.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 53.2%; no pressure flag |
| 12 | 2,276 | 280 | 50.6 / 186.3 (gold 2,587) | arrival 2,313.1 HP/s; fly 30.6%; armor≥0.4 55.4%; MR≥0.5 0.0%; no pressure flag |
| 13 | 3,742 | 384 | 83.2 / 207.9 (gold 2,887) | arrival 1,812.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 20.8%; no pressure flag |
| 14 | 5,844 | 524 | 129.9 / 237.0 (gold 3,291) | arrival 5,190.0 HP/s; fly 9.9%; armor≥0.4 79.4%; MR≥0.5 10.7%; no pressure flag |
| 15 | 1,800 | 180 | 40.0 / 276.2 (gold 3,835) | arrival 1,745.1 HP/s; fly 0.0%; armor≥0.4 18.9%; MR≥0.5 26.0%; no pressure flag |
| 16 | 1,734 | 252 | 38.5 / 290.6 (gold 4,035) | arrival 1,408.8 HP/s; fly 33.4%; armor≥0.4 0.0%; MR≥0.5 37.5%; no pressure flag |
| 17 | 2,115 | 253 | 47.0 / 310.2 (gold 4,307) | arrival 1,486.0 HP/s; fly 0.0%; armor≥0.4 44.7%; MR≥0.5 0.0%; no pressure flag |
| 18 | 2,756 | 328 | 61.2 / 329.9 (gold 4,580) | arrival 1,100.7 HP/s; fly 21.0%; armor≥0.4 12.3%; MR≥0.5 19.8%; no pressure flag |
| 19 | 2,909 | 363 | 64.6 / 354.9 (gold 4,928) | arrival 2,696.4 HP/s; fly 0.0%; armor≥0.4 39.7%; MR≥0.5 31.3%; no pressure flag |
| 20 | 9,644 | 774 | 214.3 / 382.5 (gold 5,311) | arrival 9,163.4 HP/s; fly 6.0%; armor≥0.4 87.5%; MR≥0.5 6.5%; no pressure flag |

## Mistfen Crossing (`mistfen`)

Start gold: 360. Waves: 21. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 25.9 (gold 360) | arrival 413.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 664 | 64 | 14.8 / 31.0 (gold 430) | arrival 483.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 940 | 100 | 20.9 / 37.0 (gold 514) | arrival 369.5 HP/s; fly 0.0%; armor≥0.4 69.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 780 | 112 | 17.3 / 45.7 (gold 634) | arrival 514.0 HP/s; fly 29.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,051 | 133 | 23.4 / 55.2 (gold 766) | arrival 609.3 HP/s; fly 0.0%; armor≥0.4 40.0%; MR≥0.5 14.8%; no pressure flag |
| 6 | 1,252 | 139 | 27.8 / 66.2 (gold 919) | arrival 1,010.4 HP/s; fly 0.0%; armor≥0.4 27.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,588 | 182 | 35.3 / 77.6 (gold 1,078) | arrival 1,169.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 24.6%; no pressure flag |
| 8 | 1,233 | 165 | 27.4 / 92.2 (gold 1,280) | arrival 845.5 HP/s; fly 28.2%; armor≥0.4 25.5%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,194 | 179 | 26.5 / 105.5 (gold 1,465) | arrival 955.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 19.6%; no pressure flag |
| 10 | 1,552 | 199 | 34.5 / 119.8 (gold 1,664) | arrival 1,551.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 16.8%; no pressure flag |
| 11 | 2,435 | 259 | 54.1 / 135.6 (gold 1,883) | arrival 1,877.7 HP/s; fly 0.0%; armor≥0.4 35.5%; MR≥0.5 0.0%; no pressure flag |
| 12 | 1,838 | 240 | 40.8 / 155.7 (gold 2,162) | arrival 1,265.3 HP/s; fly 18.9%; armor≥0.4 18.5%; MR≥0.5 21.2%; no pressure flag |
| 13 | 1,947 | 243 | 43.3 / 174.4 (gold 2,422) | arrival 1,631.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 8.0%; no pressure flag |
| 14 | 2,062 | 250 | 45.8 / 193.4 (gold 2,685) | arrival 1,443.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 2,850 | 332 | 63.3 / 212.8 (gold 2,955) | arrival 1,495.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 16 | 1,490 | 192 | 33.1 / 238.2 (gold 3,307) | arrival 1,033.3 HP/s; fly 0.0%; armor≥0.4 22.8%; MR≥0.5 26.2%; no pressure flag |
| 17 | 1,839 | 261 | 40.9 / 253.5 (gold 3,519) | arrival 1,523.0 HP/s; fly 25.2%; armor≥0.4 0.0%; MR≥0.5 28.3%; no pressure flag |
| 18 | 1,808 | 194 | 40.2 / 273.7 (gold 3,800) | arrival 1,315.6 HP/s; fly 0.0%; armor≥0.4 46.5%; MR≥0.5 0.0%; no pressure flag |
| 19 | 2,523 | 301 | 56.1 / 289.1 (gold 4,014) | arrival 1,400.8 HP/s; fly 0.0%; armor≥0.4 13.5%; MR≥0.5 18.5%; no pressure flag |
| 20 | 2,568 | 364 | 57.1 / 312.2 (gold 4,335) | arrival 2,494.5 HP/s; fly 18.1%; armor≥0.4 0.0%; MR≥0.5 25.3%; no pressure flag |
| 21 | 6,375 | 549 | 141.7 / 339.9 (gold 4,719) | arrival 5,729.6 HP/s; fly 0.0%; armor≥0.4 74.4%; MR≥0.5 0.0%; no pressure flag |

## The Shattered Crown (`shatteredcrown`)

Start gold: 400. Waves: 24. Pressure-flagged waves: 0.

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
| 19 | 1,480 | 184 | 32.9 / 305.0 (gold 4,234) | arrival 1,208.0 HP/s; fly 0.0%; armor≥0.4 23.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 1,476 | 216 | 32.8 / 319.6 (gold 4,438) | arrival 934.5 HP/s; fly 47.2%; armor≥0.4 0.0%; MR≥0.5 52.8%; no pressure flag |
| 21 | 2,036 | 242 | 45.2 / 336.6 (gold 4,674) | arrival 2,740.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 22 | 2,595 | 280 | 57.7 / 355.5 (gold 4,936) | arrival 2,323.0 HP/s; fly 0.0%; armor≥0.4 13.1%; MR≥0.5 0.0%; no pressure flag |
| 23 | 1,917 | 243 | 42.6 / 377.1 (gold 5,236) | arrival 1,520.0 HP/s; fly 0.0%; armor≥0.4 49.3%; MR≥0.5 24.4%; no pressure flag |
| 24 | 7,894 | 728 | 175.4 / 396.1 (gold 5,499) | arrival 7,848.5 HP/s; fly 44.1%; armor≥0.4 48.1%; MR≥0.5 3.0%; no pressure flag |

## Cinderwake Caldera (`cinderwake`)

Start gold: 440. Waves: 26. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 868 | 70 | 19.3 / 31.7 (gold 440) | arrival 578.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 790 | 82 | 17.6 / 38.2 (gold 530) | arrival 626.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,149 | 121 | 25.5 / 45.5 (gold 632) | arrival 782.5 HP/s; fly 0.0%; armor≥0.4 45.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 736 | 74 | 16.4 / 55.7 (gold 773) | arrival 570.9 HP/s; fly 32.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,173 | 151 | 26.1 / 62.4 (gold 867) | arrival 769.5 HP/s; fly 0.0%; armor≥0.4 44.8%; MR≥0.5 26.6%; no pressure flag |
| 6 | 1,288 | 167 | 28.6 / 74.8 (gold 1,038) | arrival 649.9 HP/s; fly 73.6%; armor≥0.4 26.4%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,600 | 180 | 35.6 / 88.2 (gold 1,225) | arrival 1,379.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 32.5%; no pressure flag |
| 8 | 1,194 | 129 | 26.5 / 102.6 (gold 1,425) | arrival 1,181.8 HP/s; fly 0.0%; armor≥0.4 52.8%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,230 | 179 | 27.3 / 113.4 (gold 1,574) | arrival 730.3 HP/s; fly 68.3%; armor≥0.4 0.0%; MR≥0.5 31.7%; no pressure flag |
| 10 | 2,120 | 248 | 47.1 / 127.7 (gold 1,773) | arrival 1,331.0 HP/s; fly 0.0%; armor≥0.4 55.7%; MR≥0.5 24.5%; no pressure flag |
| 11 | 2,192 | 226 | 48.7 / 147.0 (gold 2,041) | arrival 1,579.2 HP/s; fly 21.2%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 12 | 1,525 | 228 | 33.9 / 164.7 (gold 2,287) | arrival 1,096.7 HP/s; fly 31.5%; armor≥0.4 0.0%; MR≥0.5 25.6%; no pressure flag |
| 13 | 5,055 | 399 | 112.3 / 182.6 (gold 2,535) | arrival 4,537.6 HP/s; fly 0.0%; armor≥0.4 89.7%; MR≥0.5 10.3%; no pressure flag |
| 14 | 1,448 | 174 | 32.2 / 212.8 (gold 2,954) | arrival 1,058.4 HP/s; fly 33.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 2,031 | 272 | 45.1 / 226.7 (gold 3,148) | arrival 1,777.1 HP/s; fly 25.7%; armor≥0.4 16.7%; MR≥0.5 0.0%; no pressure flag |
| 16 | 2,548 | 274 | 56.6 / 247.8 (gold 3,440) | arrival 1,362.8 HP/s; fly 0.0%; armor≥0.4 33.0%; MR≥0.5 18.4%; no pressure flag |
| 17 | 2,080 | 293 | 46.2 / 268.9 (gold 3,734) | arrival 1,460.0 HP/s; fly 75.0%; armor≥0.4 0.0%; MR≥0.5 25.0%; no pressure flag |
| 18 | 3,175 | 317 | 70.6 / 291.5 (gold 4,047) | arrival 3,186.6 HP/s; fly 0.0%; armor≥0.4 40.5%; MR≥0.5 20.5%; no pressure flag |
| 19 | 1,760 | 214 | 39.1 / 315.8 (gold 4,384) | arrival 1,645.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 3,844 | 440 | 85.4 / 332.6 (gold 4,618) | arrival 3,691.0 HP/s; fly 100.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 21 | 2,340 | 282 | 52.0 / 365.7 (gold 5,078) | arrival 1,155.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 23.3%; no pressure flag |
| 22 | 3,025 | 363 | 67.2 / 387.5 (gold 5,380) | arrival 2,218.5 HP/s; fly 0.0%; armor≥0.4 46.0%; MR≥0.5 25.8%; no pressure flag |
| 23 | 2,150 | 306 | 47.8 / 415.1 (gold 5,763) | arrival 1,289.3 HP/s; fly 60.5%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 24 | 2,188 | 254 | 48.6 / 438.6 (gold 6,089) | arrival 1,405.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 25.0%; no pressure flag |
| 25 | 3,473 | 443 | 77.2 / 458.3 (gold 6,363) | arrival 3,291.4 HP/s; fly 0.0%; armor≥0.4 33.3%; MR≥0.5 22.5%; no pressure flag |
| 26 | 9,248 | 747 | 205.5 / 491.6 (gold 6,826) | arrival 8,972.5 HP/s; fly 12.8%; armor≥0.4 82.2%; MR≥0.5 5.1%; no pressure flag |

## Veilscar Confluence (`veilscar`)

Start gold: 460. Waves: 28. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 992 | 80 | 22.0 / 33.1 (gold 460) | arrival 661.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 630 | 90 | 14.0 / 40.3 (gold 560) | arrival 525.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,296 | 136 | 28.8 / 48.3 (gold 670) | arrival 932.3 HP/s; fly 0.0%; armor≥0.4 32.4%; MR≥0.5 0.0%; no pressure flag |
| 4 | 1,105 | 138 | 24.6 / 59.5 (gold 826) | arrival 640.5 HP/s; fly 26.2%; armor≥0.4 30.8%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,372 | 144 | 30.5 / 70.9 (gold 984) | arrival 1,216.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 54.8%; no pressure flag |
| 6 | 1,446 | 182 | 32.1 / 82.7 (gold 1,148) | arrival 1,029.8 HP/s; fly 33.2%; armor≥0.4 43.6%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,282 | 174 | 28.5 / 97.2 (gold 1,350) | arrival 1,095.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 40.6%; no pressure flag |
| 8 | 1,228 | 146 | 27.3 / 111.2 (gold 1,544) | arrival 1,147.7 HP/s; fly 28.3%; armor≥0.4 0.0%; MR≥0.5 71.7%; no pressure flag |
| 9 | 1,639 | 168 | 36.4 / 123.2 (gold 1,710) | arrival 1,395.8 HP/s; fly 0.0%; armor≥0.4 65.6%; MR≥0.5 0.0%; no pressure flag |
| 10 | 4,760 | 388 | 105.8 / 136.7 (gold 1,898) | arrival 4,534.8 HP/s; fly 0.0%; armor≥0.4 79.8%; MR≥0.5 8.2%; no pressure flag |
| 11 | 1,670 | 235 | 37.1 / 166.1 (gold 2,306) | arrival 1,247.7 HP/s; fly 35.9%; armor≥0.4 0.0%; MR≥0.5 38.9%; no pressure flag |
| 12 | 2,588 | 250 | 57.5 / 184.5 (gold 2,561) | arrival 1,795.0 HP/s; fly 0.0%; armor≥0.4 32.5%; MR≥0.5 34.0%; no pressure flag |
| 13 | 2,412 | 306 | 53.6 / 203.9 (gold 2,831) | arrival 1,870.0 HP/s; fly 19.2%; armor≥0.4 14.1%; MR≥0.5 19.4%; no pressure flag |
| 14 | 1,716 | 201 | 38.1 / 227.4 (gold 3,157) | arrival 1,137.9 HP/s; fly 35.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 2,540 | 314 | 56.4 / 243.3 (gold 3,378) | arrival 1,090.4 HP/s; fly 0.0%; armor≥0.4 33.1%; MR≥0.5 60.2%; no pressure flag |
| 16 | 1,944 | 246 | 43.2 / 267.4 (gold 3,712) | arrival 1,505.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 17 | 2,256 | 304 | 50.1 / 286.5 (gold 3,978) | arrival 1,327.4 HP/s; fly 31.9%; armor≥0.4 15.1%; MR≥0.5 53.0%; no pressure flag |
| 18 | 2,052 | 238 | 45.6 / 309.9 (gold 4,302) | arrival 1,704.7 HP/s; fly 22.6%; armor≥0.4 0.0%; MR≥0.5 21.4%; no pressure flag |
| 19 | 4,140 | 472 | 92.0 / 328.4 (gold 4,560) | arrival 4,113.7 HP/s; fly 81.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 2,758 | 330 | 61.3 / 363.9 (gold 5,052) | arrival 2,181.3 HP/s; fly 0.0%; armor≥0.4 50.4%; MR≥0.5 28.3%; no pressure flag |
| 21 | 2,106 | 246 | 46.8 / 389.1 (gold 5,402) | arrival 547.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 67.7%; no pressure flag |
| 22 | 2,475 | 319 | 55.0 / 408.2 (gold 5,668) | arrival 2,424.6 HP/s; fly 23.4%; armor≥0.4 38.2%; MR≥0.5 0.0%; no pressure flag |
| 23 | 2,440 | 323 | 54.2 / 432.7 (gold 6,007) | arrival 1,613.7 HP/s; fly 54.1%; armor≥0.4 13.9%; MR≥0.5 32.0%; no pressure flag |
| 24 | 3,282 | 322 | 72.9 / 457.4 (gold 6,350) | arrival 1,284.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 26.8%; no pressure flag |
| 25 | 5,374 | 476 | 119.4 / 482.0 (gold 6,692) | arrival 5,333.6 HP/s; fly 0.0%; armor≥0.4 70.7%; MR≥0.5 11.6%; no pressure flag |
| 26 | 3,442 | 439 | 76.5 / 517.7 (gold 7,188) | arrival 3,164.8 HP/s; fly 17.4%; armor≥0.4 36.6%; MR≥0.5 26.4%; no pressure flag |
| 27 | 3,360 | 369 | 74.7 / 550.8 (gold 7,647) | arrival 1,552.5 HP/s; fly 0.0%; armor≥0.4 15.2%; MR≥0.5 26.2%; no pressure flag |
| 28 | 7,892 | 783 | 175.4 / 578.8 (gold 8,036) | arrival 7,770.1 HP/s; fly 13.5%; armor≥0.4 0.0%; MR≥0.5 5.9%; no pressure flag |

## Shard economy summary

Costs imported from the game: overcharge 3 shards; ascension 6 shards plus 150 gold. The pass/fail check is shard-only, as requested. Normal difficulty contributes zero estimated elite shards. Bosses add 4 shards each; Shardbacks use their defined 2-shard drop.

An absent optional `startShards` field is counted as 0 in this definition-only analysis.

| Map | Waves | ⅔ cutoff | Start shards | Shardbacks by cutoff / total | Bosses by cutoff / total | Shards by cutoff / total | Ascension by cutoff (maps 3–5) | Max total overcharges | Max total ascensions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| 1. greenhollow | 16 | 11 | 0 | 6 / 10 | 0 / 0 | 12 / 20 | n/a | 6 | 3 |
| 2. frostmere | 18 | 12 | 0 | 4 / 8 | 0 / 0 | 8 / 16 | n/a | 5 | 2 |
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
