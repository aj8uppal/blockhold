## 1. Endless Mode — The Long Night

1. **Medium — Derived enemies bypass endless HP scaling.** Direct wave spawns receive `hpScale` at [src/game/game.ts:271](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:271), but Broodmother offspring and Veilqueen summons call `spawnEnemyAt` without options at [src/game/game.ts:145](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:145) and [src/game/units.ts:272](/Users/ajuppal/personal/3d-tower-defense/src/game/units.ts:272). They therefore use the default `1` multiplier at [src/game/game.ts:168](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:168), making late-game children disproportionately weak.  
   **Fix:** store each enemy’s applied endless HP scale in `EnemySpawnOpts` and propagate it to spawn-on-death children and summons.

2. **Low — Tying an existing endless record is announced as a new record.** `endGame` updates `bestEndless` before constructing the stats at [src/game/game.ts:355](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:355); the screen then uses `wavesReached >= bestEndless` at [src/ui/screens.ts:159](/Users/ajuppal/personal/3d-tower-defense/src/ui/screens.ts:159). A tied run therefore displays “a new record.”  
   **Fix:** compare against the previous best before saving and pass an explicit `newRecord` boolean to `BattleStats`.

3. **Nit — A finite 200-wave run is presented as infinite.** Generation defaults to 200 waves at [src/game/levels.ts:227](/Users/ajuppal/personal/3d-tower-defense/src/game/levels.ts:227), and wave 200 is treated as final at [src/game/game.ts:274](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:274), but the HUD always renders `/∞` at [src/ui/hud.ts:173](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:173).  
   **Fix:** display `/200`, or extend the wave list lazily so the run is genuinely unbounded.

Audit notes: an in-memory probe of the current generator confirmed deterministic output, 200 waves, valid lane indices `0` on Greenhollow and `0–2` on Shattered Crown, alternating bosses on waves 10/20/etc., and a `0.4s` minimum interval. The synthetic copy preserves `id` at [src/game/game.ts:238](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:238). Endless outcomes enter the record branch—not the star/unlock branch—at [src/game/game.ts:352](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:352), on both defeat and 200-wave victory. `waveIndex + 1` is correct for waves reached at [src/game/game.ts:354](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:354). Mode selection is gated by campaign completion at [src/ui/screens.ts:98](/Users/ajuppal/personal/3d-tower-defense/src/ui/screens.ts:98), and “Descend again” preserves difficulty, hero, and endless mode through [src/ui/screens.ts:184](/Users/ajuppal/personal/3d-tower-defense/src/ui/screens.ts:184) and [src/main.ts:20](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:20).

## 2. Zephyra

4. **Medium — Frost runes overwrite Static Nova’s stronger, longer slow.** Nova writes `0.45` for 2.5 seconds at [src/game/hero.ts:246](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:246). Frost writes the weaker `0.55` and replaces its expiry with only 0.2 seconds at [src/game/traps.ts:117](/Users/ajuppal/personal/3d-tower-defense/src/game/traps.ts:117). Heroes update before traps at [src/game/game.ts:965](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:965), so this overwrite occurs during the same simulation step.  
   **Fix:** represent slows as independently expiring effects and calculate the minimum active factor, or centralize stacking in `Enemy.applySlow()`.

5. **Low — Zephyra’s bolt visually hits phased enemies after dealing zero damage.** `takeDamage` returns zero while phased at [src/game/units.ts:185](/Users/ajuppal/personal/3d-tower-defense/src/game/units.ts:185), but bolt particles and hit audio execute unconditionally at [src/game/projectiles.ts:99](/Users/ajuppal/personal/3d-tower-defense/src/game/projectiles.ts:99).  
   **Fix:** emit impact particles/audio only when `dealt > 0`, matching the arrow path.

6. **Low — Hero portrait states remain conflated.** The sweep correctly chooses respawn or ability cooldown at [src/ui/hud.ts:220](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:220), but `ready` means merely “alive,” even while the ability is cooling, at [src/ui/hud.ts:230](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:230). Dead portraits also remain clickable because `selectHero` lacks a dead guard at [src/game/game.ts:465](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:465).  
   **Fix:** use separate `alive` and `ability-ready` classes, disable the portrait while dead, and reject dead heroes in `selectHero()`.

## 3. HUD pointer events

7. **Medium — The generic direct-child rule re-enables two intentionally passive containers.** `#hud > *` sets `pointer-events:auto` at [src/style.css:36](/Users/ajuppal/personal/3d-tower-defense/src/style.css:36). Its ID specificity overrides `.topbar { pointer-events:none }` and `.wave-call-wrap { pointer-events:none }` at [src/style.css:50](/Users/ajuppal/personal/3d-tower-defense/src/style.css:50) and [src/style.css:97](/Users/ajuppal/personal/3d-tower-defense/src/style.css:97). Consequently, the full-width top bar and wave-wrapper/preview area can intercept canvas clicks outside their buttons.  
   **Fix:** replace the blanket rule with an explicit interactive whitelist, or add `#hud > .topbar, #hud > .wave-call-wrap { pointer-events:none }`.

Direct-child enumeration: `topbar`, `wave-call-wrap`, `abilities`, `build-menu`, `tower-panel`, `enemy-tip`, `damage-vignette`, `banner`, `toast`, `mode-hint`, `pause-overlay`, and dynamically created `floater`s at [src/ui/hud.ts:65](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:65), [src/ui/hud.ts:77](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:77), [src/ui/hud.ts:107](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:107), [src/ui/hud.ts:124](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:124), [src/ui/hud.ts:143](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:143), and [src/ui/hud.ts:544](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:544). All passive leaf overlays are otherwise covered. The hidden pause overlay uses `display:none !important` at [src/style.css:42](/Users/ajuppal/personal/3d-tower-defense/src/style.css:42). The full-screen screens layer is intentionally interactive only while visible.

## 4. Camera additions

8. **Low — Shift orbit mode is not latched for the gesture.** The code reads `e.shiftKey` on every movement at [src/main.ts:114](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:114), so pressing or releasing Shift mid-drag switches between pan and orbit within one gesture.  
   **Fix:** capture an `orbitDrag` boolean on `pointerdown` from the button/modifier state and use it until pointer termination.

Shift+click without movement still selects correctly because only movement beyond six pixels marks a drag at [src/main.ts:111](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:111), and left-button clicks route to `handleClick` at [src/main.ts:131](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:131). Middle-button `preventDefault()` is present at [src/main.ts:68](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:68).

## 5. Battle stats

9. **Low — “Gold earned” includes tower and trap sale refunds.** Every positive `addGold` increments `goldEarned` at [src/game/game.ts:110](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:110), including trap sales at [src/game/game.ts:735](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:735) and tower sales at [src/game/game.ts:834](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:834). Repeated building and selling can inflate the end statistic despite losing money.  
   **Fix:** add a `countAsEarned` argument or credit refunds directly without changing `goldEarned`.

10. **Low — The duration is accelerated game time and heavily rounded.** The accumulator multiplies time by game speed at [src/game/game.ts:918](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:918), while `this.time` advances per simulation step at [src/game/game.ts:951](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:951). Stats then round and clamp to at least one minute at [src/game/game.ts:375](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:375). Thus one real second can display “1 min,” and 2× speed advances the displayed duration twice as fast as wall time.  
   **Fix:** track separate unpaused wall-clock seconds and render `m:ss`; alternatively label this explicitly as simulation time.

`wavesReached` safely returns zero when `waves` is null at [src/game/game.ts:374](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:374). `killCount` includes spawn-on-death children and summons because every normally killed `Enemy` enters [src/game/game.ts:123](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:123).

## 6. Damage vignette

11. **Low — A rapid retry can carry the damage flash into the next battle.** The flash animation lasts 0.7 seconds at [src/style.css:384](/Users/ajuppal/personal/3d-tower-defense/src/style.css:384), but `HUD.reset()` does not remove its `flash` class at [src/ui/hud.ts:566](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:566). Since retry calls `reset()` immediately before starting the next level at [src/main.ts:14](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:14), the remaining animation can bleed into the new run. It does not remain permanently visible because the base opacity is zero.  
   **Fix:** remove `flash` in `HUD.reset()` and optionally remove it on `animationend`.

## 7. Verification

`npm run typecheck` — **PASS** (exit 0)

```text
> voxelgard@0.1.0 typecheck
> tsc --noEmit
```

`npx vitest run --pool=threads` — **PASS** (exit 0)

```text
RUN  v4.1.10 /Users/ajuppal/personal/3d-tower-defense

Test Files  8 passed (8)
     Tests  37 passed (37)
  Start at  23:04:03
  Duration  212ms (transform 444ms, setup 0ms, import 687ms, tests 54ms, environment 0ms)
```

Overall verdict: no Critical or High defects were found, and both checks pass. Static Nova stacking, endless derived-enemy scaling, and the HUD pointer-event regression are the most important correctness fixes before release.

Codex session ID: 01a01dc1-ffab-74f3-8d04-465e4d29c02b
Resume in Codex: codex resume 01a01dc1-ffab-74f3-8d04-465e4d29c02b
