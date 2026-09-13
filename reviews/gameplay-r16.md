# Gameplay and co-op pass — ruleset 16

The late-game change strengthens the affordable tower families at tiers five
and six without changing the first four tiers or increasing enemy health.
The Unmaking casts every 1.2 seconds instead of 1.9. Archers gain armor
penetration, while infantry receives stronger damage, durability and a real
Mythic stat increase. Farshot replaces the Ballista's reload ascension with
20% extra range. Existing battle journals retain their historical combat.

## Combat measurements

These are 30-second measurements using the actual simulation, projectiles,
resistance and signatures. Each tower uses the same Greenhollow foundation,
seed 61, no hero, no ascension or beacon, and no Armory damage bonuses.
Targets are stationary with enough health to survive the measurement. The
armored target has 75% physical resistance; the flying target has 70% magic
resistance. This measures sustained damage, not map completion, coverage,
survivability or the benefit of manually activated Mythic abilities.

| Tier-six tower | Armored target DPS, before → after | Resistant flyer DPS, before → after |
|---|---:|---:|
| Worldpiercer | 145 → 570 | 580 → 913 |
| Thousandwing | 109 → 307 | 435 → 598 |
| Null Cathedral | 512 → 1,083 | 479 → 1,037 |
| Tempest Nexus | 186 → 310 | 56 → 93 |
| Last Legion | 18 → 198 | Cannot attack flyers |
| Ragnarok Hall | 119 → 458 | 205 → 205 |
| Siegebreaker, unchanged reference | 288 | 371 |
| Helios Engine, unchanged reference | 325 | 818 |
| Event Horizon, unchanged reference | 1,362 | 1,362 |

The Unmaking's tier-five output increases from 114 to 188 DPS against the
armored target. Its faster resistance stripping also helps nearby physical
and magical attackers. Event Horizon retains the strongest isolated-target
output of these samples, but is substantially more expensive to build from
scratch. The new Null Cathedral and Worldpiercer give other families a
credible role against bosses. Cannons and Seraph remain strong in crowds;
the goal is useful complementary choices rather than identical damage.

The regression covers 144 scenarios: six families, both branches, tiers five
and six, three target profiles, and both combat versions. Campaign and trial
balance checks still pass. Reproduce the complete measurements with:

```sh
BLOCKHOLD_BALANCE_REPORT=/tmp/blockhold-late-balance.json npm test -- tests/sessionGame.test.ts -t 'late archers'
```

## Co-op and interaction verification

- Actual desktop and touch clients with different visual quality settings
  and 120 ms of added guest network latency agreed through combat at 1–4×,
  pause, reload and resync. This was tested in Frostmere sandbox; it does not
  establish that every map, device and network condition is desync-free.
- The reported desync's original cause has not been reproduced. Checks now
  compare fuller state, detect divergence regardless of which seat finishes
  first, retain the mismatch turn, and clear after the boards agree again.
- Resync pauses the room and replays its recorded orders, preserving the
  existing board if the initial network request fails. It leaves the restored
  battle paused. Intentionally corrupting one client's gold was detected and
  repaired through the actual pause-menu action.
- Phone chat uses a compact composer below the inspector, leaving the
  inspector scrollable and tappable. Desktop, 667×375 landscape, and portrait
  lobby layouts were reviewed; combat continues to require landscape.
- Sandbox tools remain open after Send enemies. Wave flow is beside speed,
  with visible Auto/Wait labels. Browser follow-up clicks after a canvas touch
  cannot activate controls that move beneath that same touch.
- Mortar fire uses flickering orange flames with bright inner cores; its
  instanced geometry updates once per frame. Phased enemies use 10% opacity.

The new combat/speed contract requires matching frontend and sync-service
deployments. The server image includes the shared speed parser. The app
download grows by approximately 2 KiB compressed; budget ceilings are
explicitly adjusted to 166 KiB for the app and 305 KiB for all JavaScript.
