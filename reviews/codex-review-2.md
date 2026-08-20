1. **Major — Casual mode permits victory after the boss breaches the gate.**  
   Files: [types.ts:102](/Users/ajuppal/personal/3d-tower-defense/src/game/types.ts:102), [enemyDefs.ts:52](/Users/ajuppal/personal/3d-tower-defense/src/game/enemyDefs.ts:52), [game.ts:131](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:131), [game.ts:702](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:702)  
   Casual starts with 25 lives, while the Juggernaut costs 20. If it is the final enemy, leaking leaves 5 lives; it is removed, then the victory check succeeds. This contradicts its description that reaching the gate ends the game.  
   Suggested fix: make any boss leak immediately defeat the player, or scale its `livesCost` to at least the selected difficulty’s starting lives. Add a regression test for the final boss leaking on every difficulty.

2. **Major — Defeat cleanup is not terminal within the current simulation step.**  
   Files: [game.ts:138](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:138), [game.ts:250](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:250), [game.ts:660](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:660)  
   A leak calls `endGame(false)` during the enemy loop. `endGame()` clears projectiles and burn zones, but `simStep()` then continues updating remaining enemies, soldiers, towers, and projectiles. Towers can create new effects after cleanup; those effects freeze behind the defeat screen, and post-defeat kills can still award gold and hero XP.  
   Suggested fix: return from `simStep()` immediately after any phase change, or defer the outcome until the step finishes and run cleanup once afterward.

3. **Major — Save validation can still create a persistently crashing Armory screen.**  
   Files: [save.ts:30](/Users/ajuppal/personal/3d-tower-defense/src/core/save.ts:30), [screens.ts:136](/Users/ajuppal/personal/3d-tower-defense/src/ui/screens.ts:136)  
   Armory values are globally clamped to `0..4`, but tracks have only one or two tiers. A saved value such as `"comet": 4` reaches `'○'.repeat(track.tierCosts.length - tier)`, which throws `RangeError`. Initial rendering throws before the respec button is constructed, so there is no UI recovery.  
   Suggested fix: validate each known track against its actual tier count, discard unknown tracks, and use `armoryTier()` in rendering. Add malformed-armory save tests.

4. **Major — Unit resource disposal both misses owned materials and disposes shared ones.**  
   Files: [builder.ts:122](/Users/ajuppal/personal/3d-tower-defense/src/voxel/builder.ts:122), [units.ts:34](/Users/ajuppal/personal/3d-tower-defense/src/game/units.ts:34), [towers.ts:78](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:78), [towers.ts:136](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:136)  
   `disposeClonedMaterials()` disposes every material except the voxel base materials. Unit groups also contain health bars whose four materials are shared globally, so every removed unit disposes resources still referenced by other units. Conversely, upgrading or selling barracks removes soldiers without calling the disposer, leaking their cloned voxel materials.  
   Suggested fix: explicitly tag or retain only instance-owned cloned materials and provide an idempotent `Soldier.dispose()`. Call it on barracks upgrades, sales, expiry, and level disposal.

5. **Major — The fixed timestep still loses game time and carries stale time into replays.**  
   Files: [game.ts:176](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:176), [game.ts:622](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:622), [main.ts:151](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:151)  
   The accumulator is capped at eight steps, or 0.133 seconds. At 10 FPS and 2× speed, each frame requests 0.2 simulated seconds but processes only 0.133, so “2×” runs at roughly 1.33×. The accumulator is also never reset by `startLevel()` or `disposeLevel()`; a phase change can leave up to seven stale steps that execute at the beginning of the next run.  
   Suggested fix: reset the accumulator at lifecycle boundaries and size the catch-up budget for the maximum accepted frame delta multiplied by game speed.

6. **Major — Hero move orders ignore terrain and collision.**  
   Files: [game.ts:71](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:71), [game.ts:382](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:382), [hero.ts:58](/Users/ajuppal/personal/3d-tower-defense/src/game/hero.ts:58)  
   Movement checks only the map’s rectangular bounds and intersects a flat `y=0` plane. The hero can walk through towers and scenery or stop in water, void cells, and inside raised hills.  
   Suggested fix: expose terrain walkability, reject invalid destinations, and either pathfind around blocked cells or constrain the hero to roads/walkable ground with the correct surface height.

7. **Major — Touch support still has no orbit control or enemy inspection.**  
   Files: [main.ts:72](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:72), [main.ts:82](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:82), [game.ts:369](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:369)  
   Pointer tracking, pinch zoom, panning, and cancellation are now correctly present. However, orbit remains restricted to `dragButton === 2`, which touch cannot produce. Enemy tooltips are invoked only for untracked hover movement; tracked touch movement pans, and taps never inspect enemies.  
   Suggested fix: add a defined two-finger rotation gesture or visible orbit controls, plus tap-to-inspect enemy behavior.

8. **Minor — Replay can display 2× while actually running at 1×.**  
   Files: [game.ts:190](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:190), [hud.ts:380](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:380), [hud.ts:416](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:416)  
   `startLevel()` resets `speed` to 1, but `HUD.reset()` does not reset the button text or `fast` class. Replaying after finishing or abandoning at 2× leaves a misleading 2× indicator.  
   Suggested fix: call `hud.setSpeed(1)` during level startup/reset, or derive the displayed state during every refresh.

9. **Minor — Abandoning a live mission leaves battle music playing on menus.**  
   Files: [game.ts:224](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:224), [game.ts:261](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:261), [main.ts:19](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:19)  
   Music stops only through `endGame()`. Home and “Abandon mission” use `disposeLevel()`, which never calls `audio.stopMusic()`.  
   Suggested fix: stop music in `disposeLevel()` or in every transition out of active gameplay.

10. **Minor — Enemy tooltips become stale while combat continues.**  
    Files: [hud.ts:183](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:183), [hud.ts:319](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:319), [main.ts:72](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:72)  
    Tooltips update only on pointer movement. A stationary cursor leaves the tooltip visible after the enemy walks away, and HP stops updating. Armor traits are rebuilt only when the hovered enemy identity changes, so armor shredding never updates for that enemy.  
    Suggested fix: retain the pointer position, repick/update during HUD refresh, and rebuild mutable values such as HP and armor independently.

11. **Minor — Keyboard camera controls still operate while paused.**  
    File: [main.ts:122](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:122), [main.ts:155](/Users/ajuppal/personal/3d-tower-defense/src/main.ts:155)  
    Keys are added to the movement set before the paused-state return, while per-frame camera movement checks only `phase === 'playing'`. Pressing or holding WASD/Q/E/arrow keys moves the camera behind the pause overlay despite the stated “only resume is allowed” policy. Gameplay economy and abilities are otherwise correctly gated.  
    Suggested fix: require `!game.paused` in the camera-key block and clear movement keys when pausing.

12. **Minor — Armory-modified tower statistics are not reflected in the HUD.**  
    Files: [game.ts:156](/Users/ajuppal/personal/3d-tower-defense/src/game/game.ts:156), [towers.ts:239](/Users/ajuppal/personal/3d-tower-defense/src/game/towers.ts:239), [hud.ts:431](/Users/ajuppal/personal/3d-tower-defense/src/ui/hud.ts:431)  
    Damage, splash radius, and soldier-health upgrades are applied during combat or spawning, but build and tower panels render raw definitions. Purchased improvements therefore leave displayed DPS, radius, and HP incorrect.  
    Suggested fix: calculate UI statistics through the same effective multiplier functions used by combat.

Validation: `npm run typecheck` passed. The literal `npx vitest run` could not start in the enforced read-only sandbox because Vitest’s default fork pool attempted to create a temporary transform directory. Running the same suites with `npx vitest run --pool=threads` passed all 6 files and 27 tests.

Verdict: Voxelgard is a strong playable beta, but it is not complete and correct enough to ship as a polished browser game. The casual boss victory exploit, nonterminal defeat processing, invalid hero navigation, incomplete touch controls, and incorrect GPU ownership are release-blocking; the current tests also do not cover those new systems.
