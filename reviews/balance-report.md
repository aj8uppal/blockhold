# Blockhold static balance report

Generated from `enemyDefs.ts`, `towerDefs.ts`, `levels.ts`, and `types.ts` on normal difficulty.

## Method

- Tower efficiency **X = 0.0719 DPS/gold**, the mean of 21 tier-1–3 entries: damage midpoint ÷ attack interval ÷ cumulative cost. Barracks count all deployed soldiers.
- Affordable DPS before a wave = (start gold + prior bounties + 20 early-call gold per prior wave) × 85.0% tower spend × X. Required DPS = authored wave HP ÷ 45s.
- Arrival pressure is the requested rough Σ(enemy HP × count ÷ group interval). HP shares use authored group HP.
- This deliberately static model excludes water-only placement restrictions, armor/MR from raw required DPS, lane coverage, travel time, splash, crowd control, healing, regen, phasing, surge empowerment, spawned/summoned adds, heroes, and armory bonuses.
- The 3 trap definitions (50–90 gold), 16 ascension perk choices, and overcharge combat bonus are excluded from tower capacity; shard costs are analyzed separately.
- Across 249 waves: **13 raw-DPS capacity flags**, **3 early-flying flags**, and **5 waves in sustained high-MR runs**.

## Greenhollow (`greenhollow`)

Start gold: 260. Waves: 16. Pressure-flagged waves: 1.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 496 | 40 | 11.0 / 15.9 (gold 260) | arrival 291.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 748 | 60 | 16.6 / 19.6 (gold 320) | arrival 534.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 679 | 64 | 15.1 / 24.4 (gold 400) | arrival 445.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 4 | 788 | 84 | 17.5 / 29.6 (gold 484) | arrival 574.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,112 | 95 | 24.7 / 35.9 (gold 588) | arrival 675.3 HP/s; fly 0.0%; armor≥0.4 51.4%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,166 | 130 | 25.9 / 43.0 (gold 703) | arrival 645.5 HP/s; fly 34.0%; armor≥0.4 33.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 2,004 | 168 | 44.5 / 52.1 (gold 853) | arrival 1,484.0 HP/s; fly 0.0%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 8 | 1,579 | 163 | 35.1 / 63.6 (gold 1,041) | arrival 1,022.8 HP/s; fly 37.4%; armor≥0.4 42.3%; MR≥0.5 0.0%; no pressure flag |
| 9 | 3,229 | 234 | 71.8 / 74.8 (gold 1,224) | arrival 2,801.5 HP/s; fly 0.0%; armor≥0.4 40.7%; MR≥0.5 0.0%; no pressure flag |
| 10 | 3,251 | 234 | 72.2 / 90.3 (gold 1,478) | arrival 3,106.7 HP/s; fly 15.5%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 11 | 2,489 | 176 | 55.3 / 105.9 (gold 1,732) | arrival 1,575.8 HP/s; fly 0.0%; armor≥0.4 73.8%; MR≥0.5 0.0%; no pressure flag |
| 12 | 3,696 | 228 | 82.1 / 117.8 (gold 1,928) | arrival 3,882.6 HP/s; fly 21.0%; armor≥0.4 28.5%; MR≥0.5 0.0%; no pressure flag |
| 13 | 3,067 | 184 | 68.2 / 133.0 (gold 2,176) | arrival 1,323.9 HP/s; fly 0.0%; armor≥0.4 20.0%; MR≥0.5 0.0%; no pressure flag |
| 14 | 4,421 | 256 | 98.2 / 145.5 (gold 2,380) | arrival 3,915.4 HP/s; fly 30.5%; armor≥0.4 36.8%; MR≥0.5 0.0%; no pressure flag |
| 15 | 4,882 | 283 | 108.5 / 162.3 (gold 2,656) | arrival 3,801.1 HP/s; fly 19.9%; armor≥0.4 55.0%; MR≥0.5 0.0%; no pressure flag |
| 16 | 10,508 | 482 | 233.5 / 180.8 (gold 2,959) | arrival 9,692.6 HP/s; fly 12.4%; armor≥0.4 18.0%; MR≥0.5 0.0%; **FLAG:** DPS 29.1% over capacity |

## Frostmere Pass (`frostmere`)

Start gold: 300. Waves: 18. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 744 | 60 | 16.5 / 18.3 (gold 300) | arrival 465.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 752 | 76 | 16.7 / 23.2 (gold 380) | arrival 550.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 835 | 97 | 18.6 / 29.1 (gold 476) | arrival 517.4 HP/s; fly 0.0%; armor≥0.4 64.1%; MR≥0.5 0.0%; no pressure flag |
| 4 | 973 | 98 | 21.6 / 36.2 (gold 593) | arrival 675.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 33.5%; no pressure flag |
| 5 | 941 | 109 | 20.9 / 43.5 (gold 711) | arrival 517.4 HP/s; fly 39.9%; armor≥0.4 60.1%; MR≥0.5 0.0%; no pressure flag |
| 6 | 496 | 57 | 11.0 / 51.3 (gold 840) | arrival 848.2 HP/s; fly 13.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 2,116 | 213 | 47.0 / 56.0 (gold 917) | arrival 1,127.1 HP/s; fly 0.0%; armor≥0.4 59.7%; MR≥0.5 21.7%; no pressure flag |
| 8 | 1,996 | 186 | 44.4 / 70.3 (gold 1,150) | arrival 1,405.4 HP/s; fly 21.6%; armor≥0.4 0.0%; MR≥0.5 32.3%; no pressure flag |
| 9 | 1,524 | 125 | 33.9 / 82.9 (gold 1,356) | arrival 1,300.4 HP/s; fly 0.0%; armor≥0.4 54.2%; MR≥0.5 0.0%; no pressure flag |
| 10 | 2,735 | 262 | 60.8 / 91.7 (gold 1,501) | arrival 1,534.5 HP/s; fly 0.0%; armor≥0.4 17.3%; MR≥0.5 57.0%; no pressure flag |
| 11 | 3,389 | 262 | 75.3 / 109.0 (gold 1,783) | arrival 1,595.1 HP/s; fly 25.4%; armor≥0.4 36.8%; MR≥0.5 0.0%; no pressure flag |
| 12 | 3,680 | 258 | 81.8 / 126.2 (gold 2,065) | arrival 1,335.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 22.5%; no pressure flag |
| 13 | 2,935 | 200 | 65.2 / 143.2 (gold 2,343) | arrival 1,524.4 HP/s; fly 0.0%; armor≥0.4 68.4%; MR≥0.5 31.6%; no pressure flag |
| 14 | 2,901 | 231 | 64.5 / 156.6 (gold 2,563) | arrival 2,136.7 HP/s; fly 32.8%; armor≥0.4 0.0%; MR≥0.5 40.8%; no pressure flag |
| 15 | 3,327 | 183 | 73.9 / 172.0 (gold 2,814) | arrival 2,155.7 HP/s; fly 0.0%; armor≥0.4 43.2%; MR≥0.5 0.0%; no pressure flag |
| 16 | 4,709 | 274 | 104.6 / 184.4 (gold 3,017) | arrival 1,988.2 HP/s; fly 25.8%; armor≥0.4 15.1%; MR≥0.5 20.8%; no pressure flag |
| 17 | 5,744 | 318 | 127.7 / 202.4 (gold 3,311) | arrival 4,901.3 HP/s; fly 0.0%; armor≥0.4 41.0%; MR≥0.5 30.5%; no pressure flag |
| 18 | 10,563 | 474 | 234.7 / 223.0 (gold 3,649) | arrival 5,899.1 HP/s; fly 0.0%; armor≥0.4 23.9%; MR≥0.5 14.8%; no pressure flag |

## The Emberwastes (`emberwastes`)

Start gold: 340. Waves: 20. Pressure-flagged waves: 1.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 768 | 75 | 17.1 / 20.8 (gold 340) | arrival 522.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 865 | 103 | 19.2 / 26.6 (gold 435) | arrival 570.4 HP/s; fly 0.0%; armor≥0.4 61.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,154 | 120 | 25.6 / 34.1 (gold 558) | arrival 868.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 34.4%; no pressure flag |
| 4 | 530 | 75 | 11.8 / 42.7 (gold 698) | arrival 469.6 HP/s; fly 34.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,342 | 149 | 29.8 / 48.5 (gold 793) | arrival 635.2 HP/s; fly 0.0%; armor≥0.4 58.6%; MR≥0.5 41.4%; no pressure flag |
| 6 | 982 | 112 | 21.8 / 58.8 (gold 962) | arrival 1,158.4 HP/s; fly 32.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 7 | 2,102 | 234 | 46.7 / 66.9 (gold 1,094) | arrival 1,266.0 HP/s; fly 22.3%; armor≥0.4 52.0%; MR≥0.5 25.7%; no pressure flag |
| 8 | 2,854 | 284 | 63.4 / 82.4 (gold 1,348) | arrival 1,181.4 HP/s; fly 0.0%; armor≥0.4 14.4%; MR≥0.5 27.6%; no pressure flag |
| 9 | 2,368 | 188 | 52.6 / 101.0 (gold 1,652) | arrival 3,083.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 21.0%; no pressure flag |
| 10 | 3,730 | 333 | 82.9 / 113.7 (gold 1,860) | arrival 1,694.4 HP/s; fly 18.9%; armor≥0.4 50.3%; MR≥0.5 0.0%; no pressure flag |
| 11 | 3,920 | 354 | 87.1 / 135.3 (gold 2,213) | arrival 1,819.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 53.2%; no pressure flag |
| 12 | 3,468 | 280 | 77.1 / 158.1 (gold 2,587) | arrival 3,524.5 HP/s; fly 30.6%; armor≥0.4 55.4%; MR≥0.5 0.0%; no pressure flag |
| 13 | 6,074 | 384 | 135.0 / 176.4 (gold 2,887) | arrival 2,942.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 20.8%; no pressure flag |
| 14 | 10,119 | 524 | 224.9 / 201.1 (gold 3,291) | arrival 8,986.4 HP/s; fly 9.9%; armor≥0.4 79.4%; MR≥0.5 10.7%; no pressure flag |
| 15 | 3,327 | 180 | 73.9 / 234.4 (gold 3,835) | arrival 3,225.6 HP/s; fly 0.0%; armor≥0.4 18.9%; MR≥0.5 26.0%; no pressure flag |
| 16 | 3,423 | 252 | 76.1 / 246.6 (gold 4,035) | arrival 2,780.7 HP/s; fly 33.4%; armor≥0.4 0.0%; MR≥0.5 37.5%; no pressure flag |
| 17 | 4,458 | 253 | 99.1 / 263.2 (gold 4,307) | arrival 3,132.4 HP/s; fly 0.0%; armor≥0.4 44.7%; MR≥0.5 0.0%; no pressure flag |
| 18 | 6,203 | 328 | 137.9 / 279.9 (gold 4,580) | arrival 2,477.6 HP/s; fly 21.0%; armor≥0.4 12.3%; MR≥0.5 19.8%; no pressure flag |
| 19 | 6,988 | 363 | 155.3 / 301.2 (gold 4,928) | arrival 6,477.6 HP/s; fly 0.0%; armor≥0.4 39.7%; MR≥0.5 31.3%; no pressure flag |
| 20 | 24,713 | 774 | 549.2 / 324.6 (gold 5,311) | arrival 23,481.3 HP/s; fly 6.0%; armor≥0.4 87.5%; MR≥0.5 6.5%; **FLAG:** DPS 69.2% over capacity |

## Mistfen Crossing (`mistfen`)

Start gold: 360. Waves: 21. Pressure-flagged waves: 1.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 22.0 (gold 360) | arrival 413.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 667 | 64 | 14.8 / 26.3 (gold 430) | arrival 485.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 955 | 100 | 21.2 / 31.4 (gold 514) | arrival 375.6 HP/s; fly 0.0%; armor≥0.4 69.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 809 | 112 | 18.0 / 38.7 (gold 634) | arrival 532.9 HP/s; fly 29.7%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,120 | 133 | 24.9 / 46.8 (gold 766) | arrival 649.3 HP/s; fly 0.0%; armor≥0.4 40.0%; MR≥0.5 14.8%; no pressure flag |
| 6 | 1,380 | 139 | 30.7 / 56.2 (gold 919) | arrival 1,114.0 HP/s; fly 0.0%; armor≥0.4 27.2%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,822 | 182 | 40.5 / 65.9 (gold 1,078) | arrival 1,342.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 24.6%; no pressure flag |
| 8 | 1,481 | 165 | 32.9 / 78.2 (gold 1,280) | arrival 1,015.4 HP/s; fly 28.2%; armor≥0.4 25.5%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,507 | 179 | 33.5 / 89.5 (gold 1,465) | arrival 1,206.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 19.6%; no pressure flag |
| 10 | 2,068 | 199 | 45.9 / 101.7 (gold 1,664) | arrival 2,067.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 16.8%; no pressure flag |
| 11 | 3,434 | 259 | 76.3 / 115.1 (gold 1,883) | arrival 2,647.9 HP/s; fly 0.0%; armor≥0.4 35.5%; MR≥0.5 0.0%; no pressure flag |
| 12 | 2,750 | 240 | 61.1 / 132.1 (gold 2,162) | arrival 1,893.2 HP/s; fly 18.9%; armor≥0.4 18.5%; MR≥0.5 21.2%; no pressure flag |
| 13 | 3,097 | 243 | 68.8 / 148.0 (gold 2,422) | arrival 2,595.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 8.0%; no pressure flag |
| 14 | 3,491 | 250 | 77.6 / 164.1 (gold 2,685) | arrival 2,443.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 5,141 | 332 | 114.2 / 180.6 (gold 2,955) | arrival 2,696.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 16 | 2,865 | 192 | 63.7 / 202.1 (gold 3,307) | arrival 1,986.8 HP/s; fly 0.0%; armor≥0.4 22.8%; MR≥0.5 26.2%; no pressure flag |
| 17 | 3,770 | 261 | 83.8 / 215.1 (gold 3,519) | arrival 3,122.2 HP/s; fly 25.2%; armor≥0.4 0.0%; MR≥0.5 28.3%; no pressure flag |
| 18 | 3,951 | 194 | 87.8 / 232.2 (gold 3,800) | arrival 2,875.0 HP/s; fly 0.0%; armor≥0.4 46.5%; MR≥0.5 0.0%; no pressure flag |
| 19 | 5,876 | 301 | 130.6 / 245.3 (gold 4,014) | arrival 3,262.3 HP/s; fly 0.0%; armor≥0.4 13.5%; MR≥0.5 18.5%; no pressure flag |
| 20 | 6,370 | 364 | 141.6 / 264.9 (gold 4,335) | arrival 6,187.9 HP/s; fly 18.1%; armor≥0.4 0.0%; MR≥0.5 25.3%; no pressure flag |
| 21 | 16,834 | 549 | 374.1 / 288.4 (gold 4,719) | arrival 15,129.6 HP/s; fly 0.0%; armor≥0.4 74.4%; MR≥0.5 0.0%; **FLAG:** DPS 29.7% over capacity |

## The Shattered Crown (`shatteredcrown`)

Start gold: 400. Waves: 24. Pressure-flagged waves: 1.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 620 | 50 | 13.8 / 24.4 (gold 400) | arrival 387.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 506 | 72 | 11.2 / 28.7 (gold 470) | arrival 389.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 828 | 81 | 18.4 / 34.3 (gold 562) | arrival 435.5 HP/s; fly 0.0%; armor≥0.4 77.2%; MR≥0.5 0.0%; no pressure flag |
| 4 | 361 | 54 | 8.0 / 40.5 (gold 663) | arrival 163.1 HP/s; fly 33.1%; armor≥0.4 0.0%; MR≥0.5 66.9%; no pressure flag |
| 5 | 805 | 102 | 17.9 / 45.0 (gold 737) | arrival 1,100.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,335 | 154 | 29.7 / 52.5 (gold 859) | arrival 737.0 HP/s; fly 18.9%; armor≥0.4 27.7%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,509 | 153 | 33.5 / 63.1 (gold 1,033) | arrival 886.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 58.3%; no pressure flag |
| 8 | 1,884 | 174 | 41.9 / 73.7 (gold 1,206) | arrival 1,734.0 HP/s; fly 0.0%; armor≥0.4 58.9%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,850 | 183 | 41.1 / 85.6 (gold 1,400) | arrival 1,667.1 HP/s; fly 34.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 10 | 1,807 | 186 | 40.2 / 98.0 (gold 1,603) | arrival 1,279.2 HP/s; fly 0.0%; armor≥0.4 22.4%; MR≥0.5 16.7%; no pressure flag |
| 11 | 1,528 | 162 | 34.0 / 110.6 (gold 1,809) | arrival 802.8 HP/s; fly 30.9%; armor≥0.4 0.0%; MR≥0.5 69.1%; no pressure flag |
| 12 | 2,688 | 216 | 59.7 / 121.7 (gold 1,991) | arrival 3,625.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 13 | 3,767 | 256 | 83.7 / 136.1 (gold 2,227) | arrival 2,822.6 HP/s; fly 0.0%; armor≥0.4 38.9%; MR≥0.5 9.4%; no pressure flag |
| 14 | 2,648 | 228 | 58.8 / 153.0 (gold 2,503) | arrival 2,330.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 23.6%; no pressure flag |
| 15 | 3,484 | 241 | 77.4 / 168.1 (gold 2,751) | arrival 2,826.8 HP/s; fly 33.9%; armor≥0.4 16.5%; MR≥0.5 0.0%; no pressure flag |
| 16 | 4,161 | 273 | 92.5 / 184.1 (gold 3,012) | arrival 4,200.1 HP/s; fly 0.0%; armor≥0.4 13.6%; MR≥0.5 0.0%; no pressure flag |
| 17 | 9,220 | 382 | 204.9 / 202.0 (gold 3,305) | arrival 8,730.0 HP/s; fly 0.0%; armor≥0.4 87.3%; MR≥0.5 4.8%; no pressure flag |
| 18 | 8,579 | 507 | 190.6 / 226.6 (gold 3,707) | arrival 7,998.0 HP/s; fly 89.0%; armor≥0.4 0.0%; MR≥0.5 11.0%; no pressure flag |
| 19 | 3,180 | 184 | 70.7 / 258.8 (gold 4,234) | arrival 2,595.3 HP/s; fly 0.0%; armor≥0.4 23.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 3,365 | 216 | 74.8 / 271.2 (gold 4,438) | arrival 2,130.3 HP/s; fly 47.2%; armor≥0.4 0.0%; MR≥0.5 52.8%; no pressure flag |
| 21 | 6,310 | 302 | 140.2 / 285.7 (gold 4,674) | arrival 7,843.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 22 | 6,651 | 280 | 147.8 / 305.3 (gold 4,996) | arrival 5,954.1 HP/s; fly 0.0%; armor≥0.4 13.1%; MR≥0.5 0.0%; no pressure flag |
| 23 | 5,206 | 243 | 115.7 / 323.7 (gold 5,296) | arrival 4,127.6 HP/s; fly 0.0%; armor≥0.4 49.3%; MR≥0.5 24.4%; no pressure flag |
| 24 | 22,695 | 728 | 504.3 / 339.7 (gold 5,559) | arrival 22,564.4 HP/s; fly 44.1%; armor≥0.4 48.1%; MR≥0.5 3.0%; **FLAG:** DPS 48.4% over capacity |

## Cinderwake Caldera (`cinderwake`)

Start gold: 440. Waves: 26. Pressure-flagged waves: 1.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 868 | 70 | 19.3 / 26.9 (gold 440) | arrival 578.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 793 | 82 | 17.6 / 32.4 (gold 530) | arrival 628.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,164 | 121 | 25.9 / 38.6 (gold 632) | arrival 792.7 HP/s; fly 0.0%; armor≥0.4 45.7%; MR≥0.5 0.0%; no pressure flag |
| 4 | 758 | 74 | 16.8 / 47.2 (gold 773) | arrival 587.6 HP/s; fly 32.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,234 | 151 | 27.4 / 53.0 (gold 867) | arrival 809.5 HP/s; fly 0.0%; armor≥0.4 44.8%; MR≥0.5 26.6%; no pressure flag |
| 6 | 1,393 | 167 | 30.9 / 63.4 (gold 1,038) | arrival 702.7 HP/s; fly 73.6%; armor≥0.4 26.4%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,787 | 180 | 39.7 / 74.9 (gold 1,225) | arrival 1,540.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 32.5%; no pressure flag |
| 8 | 1,384 | 129 | 30.8 / 87.1 (gold 1,425) | arrival 1,369.9 HP/s; fly 0.0%; armor≥0.4 52.8%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,486 | 179 | 33.0 / 96.2 (gold 1,574) | arrival 882.2 HP/s; fly 68.3%; armor≥0.4 0.0%; MR≥0.5 31.7%; no pressure flag |
| 10 | 2,678 | 248 | 59.5 / 108.4 (gold 1,773) | arrival 1,681.4 HP/s; fly 0.0%; armor≥0.4 55.7%; MR≥0.5 24.5%; no pressure flag |
| 11 | 2,904 | 226 | 64.5 / 124.7 (gold 2,041) | arrival 2,092.4 HP/s; fly 21.2%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 12 | 2,125 | 228 | 47.2 / 139.8 (gold 2,287) | arrival 1,527.9 HP/s; fly 31.5%; armor≥0.4 0.0%; MR≥0.5 25.6%; no pressure flag |
| 13 | 7,421 | 399 | 164.9 / 154.9 (gold 2,535) | arrival 6,661.2 HP/s; fly 0.0%; armor≥0.4 89.7%; MR≥0.5 10.3%; no pressure flag |
| 14 | 2,243 | 174 | 49.9 / 180.5 (gold 2,954) | arrival 1,639.7 HP/s; fly 33.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 3,325 | 272 | 73.9 / 192.4 (gold 3,148) | arrival 2,909.1 HP/s; fly 25.7%; armor≥0.4 16.7%; MR≥0.5 0.0%; no pressure flag |
| 16 | 4,411 | 274 | 98.0 / 210.2 (gold 3,440) | arrival 2,359.3 HP/s; fly 0.0%; armor≥0.4 33.0%; MR≥0.5 18.4%; no pressure flag |
| 17 | 3,811 | 293 | 84.7 / 228.2 (gold 3,734) | arrival 2,674.7 HP/s; fly 75.0%; armor≥0.4 0.0%; MR≥0.5 25.0%; no pressure flag |
| 18 | 6,157 | 317 | 136.8 / 247.3 (gold 4,047) | arrival 6,179.6 HP/s; fly 0.0%; armor≥0.4 40.5%; MR≥0.5 20.5%; no pressure flag |
| 19 | 3,613 | 214 | 80.3 / 267.9 (gold 4,384) | arrival 3,377.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 8,354 | 440 | 185.6 / 282.2 (gold 4,618) | arrival 8,021.6 HP/s; fly 100.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 21 | 5,382 | 282 | 119.6 / 310.4 (gold 5,078) | arrival 2,657.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 23.3%; no pressure flag |
| 22 | 7,361 | 363 | 163.6 / 328.8 (gold 5,380) | arrival 5,398.2 HP/s; fly 0.0%; armor≥0.4 46.0%; MR≥0.5 25.8%; no pressure flag |
| 23 | 5,532 | 306 | 122.9 / 352.2 (gold 5,763) | arrival 3,317.3 HP/s; fly 60.5%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 24 | 5,950 | 254 | 132.2 / 372.1 (gold 6,089) | arrival 3,822.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 25.0%; no pressure flag |
| 25 | 9,974 | 443 | 221.7 / 388.9 (gold 6,363) | arrival 9,452.9 HP/s; fly 0.0%; armor≥0.4 33.3%; MR≥0.5 22.5%; no pressure flag |
| 26 | 28,033 | 747 | 623.0 / 417.2 (gold 6,826) | arrival 27,197.9 HP/s; fly 12.8%; armor≥0.4 82.2%; MR≥0.5 5.1%; **FLAG:** DPS 49.3% over capacity |

## Veilscar Confluence (`veilscar`)

Start gold: 460. Waves: 28. Pressure-flagged waves: 0.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 992 | 80 | 22.0 / 28.1 (gold 460) | arrival 661.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 631 | 90 | 14.0 / 34.2 (gold 560) | arrival 526.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 3 | 1,308 | 136 | 29.1 / 40.9 (gold 670) | arrival 940.8 HP/s; fly 0.0%; armor≥0.4 32.4%; MR≥0.5 0.0%; no pressure flag |
| 4 | 1,009 | 120 | 22.4 / 50.5 (gold 826) | arrival 569.0 HP/s; fly 17.6%; armor≥0.4 34.4%; MR≥0.5 0.0%; no pressure flag |
| 5 | 1,422 | 144 | 31.6 / 59.0 (gold 966) | arrival 1,259.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 54.8%; no pressure flag |
| 6 | 1,528 | 182 | 33.9 / 69.1 (gold 1,130) | arrival 1,087.8 HP/s; fly 33.2%; armor≥0.4 43.6%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,386 | 174 | 30.8 / 81.4 (gold 1,332) | arrival 1,184.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 40.6%; no pressure flag |
| 8 | 1,364 | 146 | 30.3 / 93.3 (gold 1,526) | arrival 1,274.6 HP/s; fly 28.3%; armor≥0.4 0.0%; MR≥0.5 71.7%; no pressure flag |
| 9 | 1,876 | 168 | 41.7 / 103.4 (gold 1,692) | arrival 1,597.4 HP/s; fly 0.0%; armor≥0.4 65.6%; MR≥0.5 0.0%; no pressure flag |
| 10 | 5,630 | 388 | 125.1 / 114.9 (gold 1,880) | arrival 5,363.7 HP/s; fly 0.0%; armor≥0.4 79.8%; MR≥0.5 8.2%; no pressure flag |
| 11 | 2,047 | 235 | 45.5 / 139.8 (gold 2,288) | arrival 1,529.2 HP/s; fly 35.9%; armor≥0.4 0.0%; MR≥0.5 38.9%; no pressure flag |
| 12 | 3,295 | 250 | 73.2 / 155.4 (gold 2,543) | arrival 2,285.1 HP/s; fly 0.0%; armor≥0.4 32.5%; MR≥0.5 34.0%; no pressure flag |
| 13 | 3,196 | 306 | 71.0 / 171.9 (gold 2,813) | arrival 2,477.6 HP/s; fly 19.2%; armor≥0.4 14.1%; MR≥0.5 19.4%; no pressure flag |
| 14 | 2,370 | 201 | 52.7 / 191.8 (gold 3,139) | arrival 1,571.9 HP/s; fly 35.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 15 | 3,663 | 314 | 81.4 / 205.4 (gold 3,360) | arrival 1,572.7 HP/s; fly 0.0%; armor≥0.4 33.1%; MR≥0.5 60.2%; no pressure flag |
| 16 | 2,931 | 246 | 65.1 / 225.8 (gold 3,694) | arrival 2,270.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 17 | 3,559 | 304 | 79.1 / 242.0 (gold 3,960) | arrival 2,094.1 HP/s; fly 31.9%; armor≥0.4 15.1%; MR≥0.5 53.0%; no pressure flag |
| 18 | 3,390 | 238 | 75.3 / 261.8 (gold 4,284) | arrival 2,816.4 HP/s; fly 22.6%; armor≥0.4 0.0%; MR≥0.5 21.4%; no pressure flag |
| 19 | 7,167 | 472 | 159.3 / 277.6 (gold 4,542) | arrival 7,121.2 HP/s; fly 81.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 20 | 5,005 | 330 | 111.2 / 307.7 (gold 5,034) | arrival 3,958.3 HP/s; fly 0.0%; armor≥0.4 50.4%; MR≥0.5 28.3%; no pressure flag |
| 21 | 4,007 | 246 | 89.0 / 329.1 (gold 5,384) | arrival 1,041.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 67.7%; no pressure flag |
| 22 | 4,938 | 319 | 109.7 / 345.3 (gold 5,650) | arrival 4,837.3 HP/s; fly 23.4%; armor≥0.4 38.2%; MR≥0.5 0.0%; no pressure flag |
| 23 | 5,105 | 323 | 113.4 / 366.0 (gold 5,989) | arrival 3,376.1 HP/s; fly 54.1%; armor≥0.4 13.9%; MR≥0.5 32.0%; no pressure flag |
| 24 | 7,200 | 322 | 160.0 / 387.0 (gold 6,332) | arrival 2,817.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 26.8%; no pressure flag |
| 25 | 12,359 | 476 | 274.6 / 407.9 (gold 6,674) | arrival 12,266.1 HP/s; fly 0.0%; armor≥0.4 70.7%; MR≥0.5 11.6%; no pressure flag |
| 26 | 8,296 | 439 | 184.4 / 438.2 (gold 7,170) | arrival 7,628.2 HP/s; fly 17.4%; armor≥0.4 36.6%; MR≥0.5 26.4%; no pressure flag |
| 27 | 8,485 | 369 | 188.6 / 466.3 (gold 7,629) | arrival 3,920.7 HP/s; fly 0.0%; armor≥0.4 15.2%; MR≥0.5 26.2%; no pressure flag |
| 28 | 20,874 | 783 | 463.9 / 490.0 (gold 8,018) | arrival 20,552.0 HP/s; fly 13.5%; armor≥0.4 0.0%; MR≥0.5 5.9%; no pressure flag |

## Sunderfall Terraces (`sunderfall`)

Start gold: 540. Waves: 30. Pressure-flagged waves: 3.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 624 | 66 | 13.9 / 33.0 (gold 540) | arrival 1,560.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 884 | 102 | 19.6 / 38.3 (gold 626) | arrival 982.0 HP/s; fly 0.0%; armor≥0.4 71.4%; MR≥0.5 0.0%; no pressure flag |
| 3 | 986 | 120 | 21.9 / 45.7 (gold 748) | arrival 438.2 HP/s; fly 35.6%; armor≥0.4 64.4%; MR≥0.5 0.0%; no pressure flag |
| 4 | 733 | 84 | 16.3 / 54.3 (gold 888) | arrival 229.1 HP/s; fly 48.3%; armor≥0.4 0.0%; MR≥0.5 0.0%; **FLAG:** early flying 48.3% |
| 5 | 1,395 | 143 | 31.0 / 60.6 (gold 992) | arrival 3,488.5 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,698 | 187 | 37.7 / 70.6 (gold 1,155) | arrival 4,245.3 HP/s; fly 0.0%; armor≥0.4 71.4%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,573 | 180 | 35.0 / 83.2 (gold 1,362) | arrival 3,932.4 HP/s; fly 35.6%; armor≥0.4 64.4%; MR≥0.5 0.0%; no pressure flag |
| 8 | 892 | 126 | 19.8 / 95.5 (gold 1,562) | arrival 2,229.6 HP/s; fly 100.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 9 | 970 | 120 | 21.6 / 104.4 (gold 1,708) | arrival 303.3 HP/s; fly 55.8%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 10 | 2,558 | 236 | 56.8 / 112.9 (gold 1,848) | arrival 799.2 HP/s; fly 21.8%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 11 | 3,962 | 264 | 88.0 / 128.6 (gold 2,104) | arrival 9,905.4 HP/s; fly 0.0%; armor≥0.4 30.9%; MR≥0.5 0.0%; no pressure flag |
| 12 | 5,023 | 480 | 111.6 / 145.9 (gold 2,388) | arrival 10,414.6 HP/s; fly 35.6%; armor≥0.4 31.2%; MR≥0.5 0.0%; no pressure flag |
| 13 | 7,457 | 507 | 165.7 / 176.5 (gold 2,888) | arrival 18,641.3 HP/s; fly 0.0%; armor≥0.4 100.0%; MR≥0.5 0.0%; no pressure flag |
| 14 | 2,443 | 276 | 54.3 / 208.7 (gold 3,415) | arrival 6,106.3 HP/s; fly 38.2%; armor≥0.4 0.0%; MR≥0.5 51.3%; no pressure flag |
| 15 | 2,675 | 246 | 59.4 / 226.8 (gold 3,711) | arrival 6,687.8 HP/s; fly 37.5%; armor≥0.4 32.8%; MR≥0.5 0.0%; no pressure flag |
| 16 | 5,469 | 426 | 121.5 / 243.1 (gold 3,977) | arrival 3,439.7 HP/s; fly 19.1%; armor≥0.4 0.0%; MR≥0.5 12.4%; no pressure flag |
| 17 | 9,763 | 570 | 217.0 / 270.3 (gold 4,423) | arrival 24,408.0 HP/s; fly 0.0%; armor≥0.4 26.4%; MR≥0.5 0.0%; no pressure flag |
| 18 | 4,188 | 330 | 93.1 / 306.4 (gold 5,013) | arrival 10,470.7 HP/s; fly 49.8%; armor≥0.4 43.6%; MR≥0.5 0.0%; no pressure flag |
| 19 | 4,818 | 308 | 107.1 / 327.8 (gold 5,363) | arrival 1,505.7 HP/s; fly 16.4%; armor≥0.4 23.3%; MR≥0.5 60.3%; no pressure flag |
| 20 | 28,290 | 1,856 | 628.7 / 347.8 (gold 5,691) | arrival 60,895.8 HP/s; fly 7.8%; armor≥0.4 23.2%; MR≥0.5 0.0%; **FLAG:** DPS 80.7% over capacity |
| 21 | 12,871 | 720 | 286.0 / 462.5 (gold 7,567) | arrival 32,176.7 HP/s; fly 20.2%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 22 | 26,586 | 1,664 | 590.8 / 507.7 (gold 8,307) | arrival 66,465.7 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 52.5%; no pressure flag |
| 23 | 12,064 | 738 | 268.1 / 610.6 (gold 9,991) | arrival 30,158.8 HP/s; fly 17.6%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 24 | 14,100 | 756 | 313.3 / 656.9 (gold 10,749) | arrival 35,251.0 HP/s; fly 0.0%; armor≥0.4 13.8%; MR≥0.5 17.1%; no pressure flag |
| 25 | 22,420 | 1,027 | 498.2 / 704.4 (gold 11,525) | arrival 56,049.9 HP/s; fly 15.0%; armor≥0.4 21.3%; MR≥0.5 16.3%; no pressure flag |
| 26 | 30,160 | 1,440 | 670.2 / 768.4 (gold 12,572) | arrival 65,593.9 HP/s; fly 35.0%; armor≥0.4 0.0%; MR≥0.5 32.9%; no pressure flag |
| 27 | 35,877 | 1,665 | 797.3 / 857.6 (gold 14,032) | arrival 89,691.3 HP/s; fly 11.8%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 28 | 36,437 | 1,441 | 809.7 / 960.6 (gold 15,717) | arrival 91,091.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 32.7%; no pressure flag |
| 29 | 34,621 | 1,508 | 769.4 / 1,049.9 (gold 17,178) | arrival 86,553.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 55.1%; no pressure flag |
| 30 | 62,941 | 3,222 | 1,398.7 / 1,143.3 (gold 18,706) | arrival 134,778.1 HP/s; fly 22.5%; armor≥0.4 19.7%; MR≥0.5 0.0%; **FLAG:** DPS 22.3% over capacity |

## Emberwind Reach (`emberwind`)

Start gold: 640. Waves: 32. Pressure-flagged waves: 5.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 728 | 77 | 16.2 / 39.1 (gold 640) | arrival 1,820.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 884 | 102 | 19.6 / 45.0 (gold 737) | arrival 2,209.1 HP/s; fly 0.0%; armor≥0.4 71.4%; MR≥0.5 0.0%; no pressure flag |
| 3 | 985 | 120 | 21.9 / 52.5 (gold 859) | arrival 544.4 HP/s; fly 35.6%; armor≥0.4 64.4%; MR≥0.5 0.0%; no pressure flag |
| 4 | 732 | 84 | 16.3 / 61.1 (gold 999) | arrival 228.8 HP/s; fly 48.3%; armor≥0.4 0.0%; MR≥0.5 0.0%; **FLAG:** early flying 48.3% |
| 5 | 1,500 | 154 | 33.3 / 67.4 (gold 1,103) | arrival 3,749.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,693 | 187 | 37.6 / 78.0 (gold 1,277) | arrival 4,231.8 HP/s; fly 0.0%; armor≥0.4 71.4%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,566 | 180 | 34.8 / 90.7 (gold 1,484) | arrival 3,914.8 HP/s; fly 35.6%; armor≥0.4 64.4%; MR≥0.5 0.0%; no pressure flag |
| 8 | 786 | 84 | 17.5 / 102.9 (gold 1,684) | arrival 1,965.2 HP/s; fly 48.3%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,512 | 186 | 33.6 / 109.3 (gold 1,788) | arrival 1,162.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 57.8%; no pressure flag |
| 10 | 1,304 | 204 | 29.0 / 121.9 (gold 1,994) | arrival 407.4 HP/s; fly 42.4%; armor≥0.4 0.0%; MR≥0.5 27.6%; no pressure flag |
| 11 | 2,743 | 264 | 60.9 / 135.6 (gold 2,218) | arrival 2,109.7 HP/s; fly 31.2%; armor≥0.4 44.2%; MR≥0.5 0.0%; no pressure flag |
| 12 | 1,747 | 200 | 38.8 / 152.9 (gold 2,502) | arrival 4,366.8 HP/s; fly 67.4%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 13 | 10,697 | 795 | 237.7 / 166.4 (gold 2,722) | arrival 24,553.2 HP/s; fly 0.0%; armor≥0.4 81.6%; MR≥0.5 0.0%; **FLAG:** DPS 42.9% over capacity |
| 14 | 2,465 | 228 | 54.8 / 216.2 (gold 3,537) | arrival 6,161.4 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 50.0%; no pressure flag |
| 15 | 4,963 | 462 | 110.3 / 231.3 (gold 3,785) | arrival 12,406.6 HP/s; fly 0.0%; armor≥0.4 31.8%; MR≥0.5 39.4%; no pressure flag |
| 16 | 2,414 | 306 | 53.6 / 260.8 (gold 4,267) | arrival 1,290.7 HP/s; fly 42.4%; armor≥0.4 0.0%; MR≥0.5 27.6%; no pressure flag |
| 17 | 4,557 | 352 | 101.3 / 280.7 (gold 4,593) | arrival 11,392.2 HP/s; fly 31.2%; armor≥0.4 44.2%; MR≥0.5 0.0%; no pressure flag |
| 18 | 6,437 | 468 | 143.0 / 303.4 (gold 4,965) | arrival 16,091.3 HP/s; fly 34.5%; armor≥0.4 48.9%; MR≥0.5 0.0%; no pressure flag |
| 19 | 7,400 | 435 | 164.4 / 333.3 (gold 5,453) | arrival 18,499.1 HP/s; fly 0.0%; armor≥0.4 89.6%; MR≥0.5 0.0%; no pressure flag |
| 20 | 12,833 | 792 | 285.2 / 361.1 (gold 5,908) | arrival 32,081.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 21 | 26,754 | 1,427 | 594.5 / 410.7 (gold 6,720) | arrival 56,915.2 HP/s; fly 0.0%; armor≥0.4 24.8%; MR≥0.5 41.0%; **FLAG:** DPS 44.8% over capacity |
| 22 | 18,918 | 1,512 | 420.4 / 499.1 (gold 8,167) | arrival 47,293.8 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 77.0%; no pressure flag |
| 23 | 6,406 | 552 | 142.4 / 592.8 (gold 9,699) | arrival 16,015.1 HP/s; fly 57.1%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 24 | 11,101 | 632 | 246.7 / 627.7 (gold 10,271) | arrival 27,752.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 18.7%; no pressure flag |
| 25 | 14,772 | 737 | 328.3 / 667.6 (gold 10,923) | arrival 36,931.2 HP/s; fly 18.6%; armor≥0.4 0.0%; MR≥0.5 20.1%; no pressure flag |
| 26 | 27,975 | 1,260 | 621.7 / 713.8 (gold 11,680) | arrival 69,938.5 HP/s; fly 8.4%; armor≥0.4 0.0%; MR≥0.5 30.7%; no pressure flag |
| 27 | 26,560 | 1,264 | 590.2 / 792.1 (gold 12,960) | arrival 66,399.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 38.9%; no pressure flag |
| 28 | 50,491 | 2,561 | 1,122.0 / 870.5 (gold 14,244) | arrival 115,936.7 HP/s; fly 13.6%; armor≥0.4 0.0%; MR≥0.5 35.0%; **FLAG:** DPS 28.9% over capacity |
| 29 | 25,771 | 1,392 | 572.7 / 1,028.3 (gold 16,825) | arrival 64,427.1 HP/s; fly 13.8%; armor≥0.4 0.0%; MR≥0.5 65.5%; no pressure flag |
| 30 | 13,371 | 836 | 297.1 / 1,114.6 (gold 18,237) | arrival 33,426.5 HP/s; fly 25.4%; armor≥0.4 0.0%; MR≥0.5 27.5%; no pressure flag |
| 31 | 25,493 | 1,104 | 566.5 / 1,166.9 (gold 19,093) | arrival 63,732.7 HP/s; fly 15.2%; armor≥0.4 0.0%; MR≥0.5 16.4%; no pressure flag |
| 32 | 69,087 | 2,354 | 1,535.3 / 1,235.6 (gold 20,217) | arrival 149,198.0 HP/s; fly 8.3%; armor≥0.4 0.0%; MR≥0.5 9.0%; **FLAG:** DPS 24.3% over capacity |

## Tidereach Causeway (`tidereach`)

Start gold: 700. Waves: 34. Pressure-flagged waves: 7.

| Wave | HP | Income | Required vs affordable DPS | Flags |
| ---: | ---: | ---: | ---: | --- |
| 1 | 624 | 66 | 13.9 / 42.8 (gold 700) | arrival 878.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 2 | 884 | 102 | 19.6 / 48.0 (gold 786) | arrival 276.1 HP/s; fly 0.0%; armor≥0.4 71.4%; MR≥0.5 0.0%; no pressure flag |
| 3 | 657 | 80 | 14.6 / 55.5 (gold 908) | arrival 205.2 HP/s; fly 35.6%; armor≥0.4 64.4%; MR≥0.5 0.0%; no pressure flag |
| 4 | 731 | 84 | 16.3 / 61.6 (gold 1,008) | arrival 1,001.9 HP/s; fly 48.3%; armor≥0.4 0.0%; MR≥0.5 0.0%; **FLAG:** early flying 48.3% |
| 5 | 1,069 | 110 | 23.8 / 68.0 (gold 1,112) | arrival 2,673.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 6 | 1,074 | 119 | 23.9 / 75.9 (gold 1,242) | arrival 2,685.4 HP/s; fly 0.0%; armor≥0.4 71.4%; MR≥0.5 0.0%; no pressure flag |
| 7 | 1,040 | 120 | 23.1 / 84.4 (gold 1,381) | arrival 799.9 HP/s; fly 35.6%; armor≥0.4 64.4%; MR≥0.5 0.0%; no pressure flag |
| 8 | 1,303 | 140 | 29.0 / 93.0 (gold 1,521) | arrival 3,258.2 HP/s; fly 48.3%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 9 | 1,117 | 102 | 24.8 / 102.7 (gold 1,681) | arrival 349.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 87.6%; no pressure flag |
| 10 | 1,940 | 306 | 43.1 / 110.2 (gold 1,803) | arrival 695.2 HP/s; fly 42.4%; armor≥0.4 0.0%; MR≥0.5 27.6%; no pressure flag |
| 11 | 4,085 | 345 | 90.8 / 130.1 (gold 2,129) | arrival 1,276.6 HP/s; fly 0.0%; armor≥0.4 24.5%; MR≥0.5 0.0%; no pressure flag |
| 12 | 2,241 | 256 | 49.8 / 152.4 (gold 2,494) | arrival 5,601.8 HP/s; fly 51.9%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 13 | 2,969 | 252 | 66.0 / 169.3 (gold 2,770) | arrival 1,099.8 HP/s; fly 30.4%; armor≥0.4 69.6%; MR≥0.5 0.0%; no pressure flag |
| 14 | 8,183 | 900 | 181.8 / 185.9 (gold 3,042) | arrival 18,220.0 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 74.2%; **FLAG:** high MR 74.2% (2-wave run) |
| 15 | 4,301 | 350 | 95.6 / 242.1 (gold 3,962) | arrival 1,344.2 HP/s; fly 0.0%; armor≥0.4 16.4%; MR≥0.5 68.8%; **FLAG:** high MR 68.8% (2-wave run) |
| 16 | 2,764 | 357 | 61.4 / 264.8 (gold 4,332) | arrival 6,909.5 HP/s; fly 42.4%; armor≥0.4 0.0%; MR≥0.5 27.6%; no pressure flag |
| 17 | 6,045 | 414 | 134.3 / 287.8 (gold 4,709) | arrival 15,111.9 HP/s; fly 0.0%; armor≥0.4 24.5%; MR≥0.5 0.0%; no pressure flag |
| 18 | 4,179 | 384 | 92.9 / 314.3 (gold 5,143) | arrival 10,447.3 HP/s; fly 51.9%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 19 | 3,869 | 264 | 86.0 / 339.0 (gold 5,547) | arrival 1,454.6 HP/s; fly 29.2%; armor≥0.4 66.9%; MR≥0.5 0.0%; no pressure flag |
| 20 | 12,221 | 999 | 271.6 / 356.4 (gold 5,831) | arrival 30,551.5 HP/s; fly 0.0%; armor≥0.4 37.9%; MR≥0.5 56.3%; **FLAG:** high MR 56.3% (3-wave run) |
| 21 | 13,841 | 810 | 307.6 / 418.7 (gold 6,850) | arrival 34,602.9 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 64.9%; **FLAG:** high MR 64.9% (3-wave run) |
| 22 | 34,319 | 2,518 | 762.6 / 469.4 (gold 7,680) | arrival 75,681.7 HP/s; fly 0.0%; armor≥0.4 19.6%; MR≥0.5 61.9%; **FLAG:** DPS 62.5% over capacity; high MR 61.9% (3-wave run) |
| 23 | 16,206 | 1,128 | 360.1 / 624.5 (gold 10,218) | arrival 40,515.0 HP/s; fly 16.4%; armor≥0.4 0.0%; MR≥0.5 0.0%; no pressure flag |
| 24 | 18,808 | 1,118 | 418.0 / 694.7 (gold 11,366) | arrival 47,020.1 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 17.3%; no pressure flag |
| 25 | 16,595 | 902 | 368.8 / 764.2 (gold 12,504) | arrival 41,488.6 HP/s; fly 32.0%; armor≥0.4 0.0%; MR≥0.5 17.3%; no pressure flag |
| 26 | 35,844 | 1,872 | 796.5 / 820.6 (gold 13,426) | arrival 89,610.5 HP/s; fly 11.2%; armor≥0.4 0.0%; MR≥0.5 48.5%; no pressure flag |
| 27 | 32,119 | 1,540 | 713.8 / 936.2 (gold 15,318) | arrival 80,297.2 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 33.0%; no pressure flag |
| 28 | 49,482 | 2,660 | 1,099.6 / 1,031.5 (gold 16,878) | arrival 123,704.6 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 40.6%; no pressure flag |
| 29 | 79,815 | 3,966 | 1,773.7 / 1,195.3 (gold 19,558) | arrival 189,198.0 HP/s; fly 8.6%; armor≥0.4 0.0%; MR≥0.5 44.1%; **FLAG:** DPS 48.4% over capacity |
| 30 | 33,811 | 2,158 | 751.3 / 1,438.9 (gold 23,544) | arrival 84,526.4 HP/s; fly 22.9%; armor≥0.4 0.0%; MR≥0.5 24.8%; no pressure flag |
| 31 | 30,025 | 1,391 | 667.2 / 1,572.0 (gold 25,722) | arrival 75,062.6 HP/s; fly 26.8%; armor≥0.4 0.0%; MR≥0.5 14.5%; no pressure flag |
| 32 | 36,703 | 1,428 | 815.6 / 1,658.3 (gold 27,133) | arrival 91,758.3 HP/s; fly 10.5%; armor≥0.4 0.0%; MR≥0.5 18.3%; no pressure flag |
| 33 | 60,780 | 2,172 | 1,350.7 / 1,746.8 (gold 28,581) | arrival 151,950.2 HP/s; fly 6.6%; armor≥0.4 0.0%; MR≥0.5 48.6%; no pressure flag |
| 34 | 74,211 | 2,718 | 1,649.1 / 1,880.8 (gold 30,773) | arrival 161,061.3 HP/s; fly 0.0%; armor≥0.4 0.0%; MR≥0.5 24.2%; no pressure flag |

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
| 8. sunderfall | 30 | 20 | 0 | 47 / 60 | 2 / 4 | 103 / 137 | **PASS** | 45 | 22 |
| 9. emberwind | 32 | 22 | 0 | 67 / 67 | 2 / 4 | 143 / 151 | **PASS** | 50 | 25 |
| 10. tidereach | 34 | 23 | 0 | 24 / 24 | 2 / 4 | 57 / 65 | **PASS** | 21 | 10 |

## Recommended tuning changes

- **sunderfall wave 4:** defer 2 of 6 Gargoyles to wave 6; the current 48.3% flying-HP opener falls to 38.6%, below the 40.0% anti-air pressure threshold without removing map HP.
- **emberwind wave 4:** defer 2 of 6 Gargoyles to wave 6; the current 48.3% flying-HP opener falls to 38.6%, below the 40.0% anti-air pressure threshold without removing map HP.
- **tidereach wave 4:** defer 2 of 6 Gargoyles to wave 6; the current 48.3% flying-HP opener falls to 38.6%, below the 40.0% anti-air pressure threshold without removing map HP.
- **emberwastes shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 10 to wave 15; shards available at the wave-14 two-thirds mark drop from 12 to 8, still funding one 6-shard ascension but no longer front-loading 2 ascensions.
- **mistfen shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 12 to wave 15; shards available at the wave-14 two-thirds mark drop from 19 to 15, still funding one 6-shard ascension but no longer front-loading 3 ascensions.
- **shatteredcrown shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 15 to wave 17; shards available at the wave-16 two-thirds mark drop from 16 to 12, still funding one 6-shard ascension but no longer front-loading 2 ascensions.
- **cinderwake shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 18 to wave 19; shards available at the wave-18 two-thirds mark drop from 24 to 20, still funding one 6-shard ascension but no longer front-loading 4 ascensions.
- **veilscar shard timing:** move the 2-Shardback group (2 Shardbacks) from wave 17 to wave 20; shards available at the wave-19 two-thirds mark drop from 29 to 25, still funding one 6-shard ascension but no longer front-loading 4 ascensions.
- **sunderfall shard timing:** move the 4-Shardback group (4 Shardbacks) from wave 19 to wave 21; shards available at the wave-20 two-thirds mark drop from 103 to 95, still funding one 6-shard ascension but no longer front-loading 17 ascensions.
- **emberwind shard timing:** move the 15-Shardback group (15 Shardbacks) from wave 19 to wave 23; shards available at the wave-22 two-thirds mark drop from 143 to 113, still funding one 6-shard ascension but no longer front-loading 23 ascensions.
- **tidereach shard timing:** move the 6-Shardback group (6 Shardbacks) from wave 19 to wave 24; shards available at the wave-23 two-thirds mark drop from 57 to 45, still funding one 6-shard ascension but no longer front-loading 9 ascensions.
