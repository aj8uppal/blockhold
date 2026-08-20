# Adversarial Review Report — Voxelgard

**Date:** 2026-08-19  
**Scope:** Correctness, lifecycle safety, persistence, controls, performance, accessibility, testability, and Kingdom Rush–style feature completeness.  
**Validation:** `npm run typecheck` passes. No automated test suite exists.

## Executive summary

Voxelgard is a polished, playable vertical slice with a sound core loop: four tower families, branching upgrades, barracks, a hero, global abilities, early wave calls, varied enemies, three maps, progression, and star scoring.

It is not production-ready for long sessions. GPU resources are systematically leaked, low-frame-rate devices run a materially slower simulation, persisted data can crash level selection, audio controls are incorrectly routed, pause does not consistently block gameplay input, and touch camera controls are incomplete.

Against Kingdom Rush, the battle-loop foundation is credible, but campaign breadth, meta-progression, hero depth, challenge modes, tower ability upgrades, and content volume remain incomplete.

---

# Major findings

## Major 1 — GPU resources leak throughout normal play

**Severity:** High  
**Locations:**

- `src/game/game.ts:199-214`
- `src/game/terrain.ts:167-221`
- `src/game/terrain.ts:327-331`
- `src/game/units.ts:102`
- `src/game/units.ts:367`
- `src/game/projectiles.ts:237-258`
- `src/game/projectiles.ts:319-367`
- `src/core/engine.ts:75-101`

### Explanation

`Game.disposeLevel()` removes objects from scene graphs but does not dispose their instance-owned geometries and materials. Three.js does not release GPU resources merely because an object is removed.

The most important leaks are:

- Each terrain creates unique merged ground and water geometry and materials.
- Clouds replace cached materials with newly allocated materials.
- Every enemy and soldier uses `cloneMaterials: true`, but those cloned materials are never disposed.
- Chain lightning creates five geometries and five materials per effect.
- Burn zones dispose geometry but not material.
- Replacing the sky disposes the old geometry but not its shader material.
- Tower upgrades replace models without disposing applicable instance-owned resources.

Cached voxel geometries and shared base materials should remain alive, but cloned and transient resources need explicit ownership.

### Impact

Long levels and repeated retries accumulate GPU resources. On mobile or integrated GPUs this can progressively reduce frame rate, corrupt rendering, or cause WebGL context loss.

### Suggested fix

- Introduce a scene-graph disposal helper that distinguishes shared resources from instance-owned ones.
- Add `Terrain.dispose()`.
- Dispose cloned unit materials when units are permanently removed.
- Give transient projectiles and effects a `dispose()` method.
- Dispose burn-zone materials and superseded sky materials.
- Track ownership explicitly; never dispose shared cached voxel geometries.
- Add a soak test that starts and disposes levels repeatedly while checking `renderer.info.memory`.

---

## Major 2 — Low frame rates change game speed and difficulty

**Severity:** High  
**Locations:**

- `src/main.ts:110-123`
- `src/game/game.ts:556-564`

### Explanation

The main loop caps elapsed time at `0.1` seconds, and the game then caps it again at `0.05` before applying the speed multiplier:

```ts
const dt = Math.min(dtRaw, 0.05) * this.speed
```

At 10 FPS, only 0.05 game seconds are processed per 0.1 real seconds, so normal speed runs at half speed. At 2× speed, the same device processes approximately normal real-time speed instead of double speed.

This affects enemies, waves, attacks, cooldowns, reinforcements, projectiles, poison, regeneration, and the hero.

### Impact

Players on slower devices receive an easier, slower game. Balance and ability timing vary by hardware, and 2× speed becomes inconsistent.

### Suggested fix

Use an accumulator with bounded fixed substeps:

1. Accumulate elapsed wall time.
2. Apply the selected speed multiplier.
3. Process multiple simulation steps, such as `1/60` or at most `0.05`.
4. Cap total catch-up time to avoid a spiral after long suspension.
5. Keep rendering and simulation timing separate.

Add deterministic tests comparing one second simulated at 60 FPS, 20 FPS, and 10 FPS.

---

## Major 3 — Malformed save data can persistently crash level selection

**Severity:** Medium  
**Locations:**

- `src/core/save.ts:10-23`
- `src/ui/screens.ts:55-74`

### Explanation

`loadSave()` trusts parsed values without checking their types, ranges, or finiteness. Star counts are subsequently passed directly to `String.prototype.repeat()`:

```ts
'★'.repeat(stars) + '★'.repeat(3 - stars)
```

A stored value such as `4`, `-1`, or `Infinity` can produce a negative repeat count and throw `RangeError`. A nonnumeric `unlocked` value can become `NaN`, making lock comparisons behave incorrectly.

The parse-time `try/catch` does not protect failures that happen later while rendering the screen.

### Impact

A malformed, manually changed, partially migrated, or future-version save can make level selection unusable until local storage is manually cleared.

### Suggested fix

- Parse saved JSON as `unknown`.
- Validate the top-level object and every field.
- Normalize `unlocked` to a finite integer within the level count.
- Normalize star values to integers in `[0, 3]`.
- Preserve independently valid fields when another field is invalid.
- Add a save schema version and migration tests.
- Provide a visible “reset damaged save” recovery path.

---

## Major 4 — The SFX control also mutes music

**Severity:** Medium  
**Locations:**

- `src/core/audio.ts:19-42`
- `src/game/game.ts:542-551`
- `src/ui/hud.ts:76-85`

### Explanation

`musicGain` is connected through `master`, while the setting labelled “Sound effects” controls `master.gain`.

Therefore:

- Muting SFX also silences music.
- Music cannot remain enabled while effects are disabled.
- The stored `sfxMuted` field does not describe what it actually controls.

### Impact

The two audio controls are not independent, contrary to their UI labels and saved settings.

### Suggested fix

Create separate buses:

```text
SFX sources   → sfxGain   ┐
                           ├→ master/output → destination
Music sources → musicGain ┘
```

Route ordinary `tone()` and `noise()` calls through `sfxGain`, and music through `musicGain`. Add a browser test for all four SFX/music mute combinations.

---

## Major 5 — Pause does not consistently prevent gameplay input

**Severity:** Medium  
**Locations:**

- `src/main.ts:87-121`
- `src/game/game.ts:523-540`
- `src/game/game.ts:561-564`

### Explanation

Keyboard routing checks only whether the phase is `playing`, not whether the game is paused.

While the pause overlay is displayed:

- Space can start a wave and award early-call gold.
- F changes game speed.
- Ability hotkeys alter targeting state.
- WASD and Q/E continue moving the camera.
- Escape may clear a hidden selection before it resumes the game.

Pointer interaction is blocked by the overlay, so keyboard and mouse behavior disagree.

### Impact

The paused state is not a reliable state boundary. Players can mutate gameplay unintentionally behind the overlay.

### Suggested fix

Define an explicit paused-input policy:

- While paused, accept only resume, abandon, audio settings, and permitted camera controls.
- Gate `callWave()`, speed changes, targeting, building, upgrading, selling, and hero orders.
- Route hotkeys through one state-aware command layer.
- Make Escape resume immediately when the pause overlay is open.
- Add tests covering every hotkey while paused.

---

## Major 6 — Touch camera controls are incomplete and pointer tracking is unsafe

**Severity:** Medium  
**Locations:**

- `src/main.ts:39-83`
- `src/style.css:22`
- `src/style.css:456-461`

### Explanation

The canvas disables native touch gestures with `touch-action: none`, but the application implements only mouse-style controls:

- One-finger pointer input pans.
- Orbit requires right-drag or Q/E.
- Zoom requires a wheel.
- There is no pinch-to-zoom or touch orbit gesture.
- All active pointers share one global `dragButton`, `dragStart`, and `lastPointer`.
- A second touch overwrites the first touch’s state.
- There is no `pointercancel` handler, so an interrupted gesture can leave dragging state stuck.

The responsive stylesheet adjusts panel width but does not provide a complete touch control scheme.

### Impact

Phone and tablet users cannot reliably orbit or zoom, and multi-touch gestures can produce erratic input.

### Suggested fix

- Track active pointers by `pointerId`.
- Implement two-finger pinch zoom and two-finger orbit, or provide visible touch controls.
- Handle `pointercancel` and lost pointer capture.
- Ignore unrelated pointer-up events.
- Test single-touch, multi-touch, orientation changes, and interrupted gestures.

---

# Minor findings

## Minor 1 — Level progression is duplicated in a hard-coded ID array

**Severity:** Low  
**Location:** `src/game/game.ts:233-242`

### Explanation

Victory determines the next unlock through a separate array of level IDs rather than the canonical `levels` catalog. Renaming, inserting, or reordering a level can silently unlock the wrong count or nothing at all.

### Suggested fix

Derive the index from the canonical level registry, or put an explicit `unlocks` relationship in each level definition. Add progression tests for every level ID.

---

## Minor 2 — Victory and defeat freeze active combat transients

**Severity:** Low–Medium  
**Locations:**

- `src/game/game.ts:582-604`
- `src/game/projectiles.ts:126-146`
- `src/game/projectiles.ts:330-354`

### Explanation

Victory waits for enemies and pending meteor casts, but not ordinary projectiles or burn zones. Once the phase changes, their updates stop.

A final cluster-bomb hit can kill the last enemy, create four bomblets, and immediately trigger victory. Those bomblets then remain suspended behind the end screen. Defeat has the same general problem.

### Suggested fix

Either:

- Drain visual combat effects for a short terminal presentation period, or
- Explicitly clear and dispose projectiles, pending effects, and burn zones during `endGame()`.

Keep the outcome state separate from whether visual cleanup is still updating.

---

## Minor 3 — Spawn-on-death enemies can be created beyond the gate

**Severity:** Low–Medium  
**Locations:**

- `src/game/game.ts:117-120`
- `src/game/units.ts:269-274`

### Explanation

Broodmother offspring are spawned at:

```ts
e.dist + randRange(-0.4, 0.4)
```

Only the lower bound is clamped. If the parent dies near the path endpoint, a child may be assigned a distance greater than the lane length and leak immediately on its first update.

### Impact

Killing a Broodmother before it crosses the gate can still cause several instantaneous leaks, which feels arbitrary rather than tactical.

### Suggested fix

Clamp offspring to a position strictly before the endpoint, or scatter them behind the parent:

```ts
Math.min(lane.length - epsilon, e.dist - randomOffset)
```

Add a test for killing a spawning enemy near the exit.

---

## Minor 4 — Health bars are not correctly billboarded in world space

**Severity:** Low  
**Locations:**

- `src/game/units.ts:57-64`
- `src/game/units.ts:284-285`
- `src/game/units.ts:495-496`

### Explanation

The camera’s world quaternion is copied directly into a health-bar group that is parented beneath a rotated unit. The parent’s rotation is then also applied, so the health bar’s final world orientation is not necessarily the camera orientation.

### Suggested fix

Use a `THREE.Sprite`, place bars in a world-space overlay group, or calculate the local quaternion as the inverse parent world quaternion multiplied by the camera world quaternion.

---

## Minor 5 — Stopping music does not stop already scheduled notes

**Severity:** Low  
**Locations:**

- `src/core/audio.ts:58-66`
- `src/core/audio.ts:70-87`
- `src/core/audio.ts:202-224`

### Explanation

`stopMusic()` clears only the next bar’s timeout. Oscillators and notes already scheduled for the current bar remain active for several seconds.

### Impact

Music can continue under victory or defeat audio and briefly overlap menu transitions.

### Suggested fix

Track active music sources or route them through a dedicated session gain. On stop, fade that gain quickly and cancel tracked sources before creating a fresh music session.

---

## Minor 6 — Selling a barracks can leave an ownerless rally mode active

**Severity:** Low  
**Locations:**

- `src/game/game.ts:419-434`
- `src/game/game.ts:462-470`
- `src/game/game.ts:511-520`

### Explanation

Rally targeting deliberately retains the selected tower. Selling that tower calls `clearSelection()`, but `clearSelection()` does not clear `targetMode`.

The next world click is consumed by a rally mode with no selected tower before the mode finally clears.

### Suggested fix

Clear targeting whenever its owning selection is removed. Alternatively, make rally mode store a validated tower reference and cancel automatically when that tower is sold or dismantled.

---

## Minor 7 — Save-write failures are silently ignored

**Severity:** Low  
**Location:** `src/core/save.ts:26-27`

### Explanation

Storage quota, privacy mode, or browser policy failures are swallowed without informing the player. The session appears to save stars, unlocks, and settings even when nothing persisted.

### Suggested fix

Return a success result from `writeSave()`, retain a session-only fallback, and show a nonintrusive warning when persistent storage is unavailable.

---

## Minor 8 — Keyboard and assistive accessibility are incomplete

**Severity:** Low–Medium  
**Locations:**

- `src/main.ts:45-85`
- `src/ui/hud.ts:96-103`
- `src/ui/hud.ts:205-240`
- `src/style.css:29`
- `src/style.css:76`
- `src/style.css:147`
- `src/style.css:190`

### Explanation

Core world interaction requires pointer picking on the canvas. Tower plots, towers, enemies, and hero destinations have no keyboard-accessible representation.

Additional issues include:

- Build and wave details are exposed through hover handlers only.
- No `:focus-visible` treatment is defined.
- Icon-only controls rely mainly on emoji and `title`.
- Pause and help overlays do not manage focus or act as keyboard-modal dialogs.
- Continuous animations do not honor `prefers-reduced-motion`.

### Suggested fix

Add visible focus styles, descriptive accessible names, focus trapping/restoration for overlays, non-hover access to tooltips, reduced-motion styles, and a keyboard navigation model for selectable plots and towers.

---

## Minor 9 — There is no automated regression suite

**Severity:** Medium process risk  
**Location:** `package.json:6-10`

### Explanation

The project defines development, build, preview, and type-check commands, but no test command or test files. TypeScript cannot detect timing drift, lifecycle leaks, malformed saves, pause-state violations, or progression errors.

### Suggested fix

Prioritize tests for:

1. `WaveManager` timing and early calls.
2. Save parsing and migration.
3. Damage, resistance, poison, and armor shred.
4. Tower upgrade and refund calculations.
5. Level unlocking and star retention.
6. Pause-state command gating.
7. Audio mute routing.
8. Spawn-on-death endpoint behavior.
9. Repeated-level WebGL resource stability.

---

# Kingdom Rush completeness assessment

## Overall verdict

Voxelgard is a **mechanically convincing vertical slice**, not yet a Kingdom Rush–complete game.

It captures much of the moment-to-moment battle grammar, but it lacks the campaign systems and depth that make Kingdom Rush more than an isolated tower-defense match. Roughly speaking, the core battle loop is substantially present; the broader campaign and progression layer is less than half complete.

## Feature comparison

| Area | Current implementation | Assessment |
|---|---|---|
| Core tower-defense loop | Build, upgrade, sell, waves, lives, gold, victory, defeat | Strong |
| Tower archetypes | Arrow, mage, cannon, barracks | Complete genre foundation |
| Upgrade structure | Three base tiers and two final branches | Strong structural match |
| Advanced tower abilities | One baked-in passive/special per final branch | Partial; lacks separately purchased ability ranks |
| Barracks | Three soldiers, rally point, blocking, respawn | Strong |
| Global abilities | Meteor and reinforcements with cooldowns | Good baseline |
| Heroes | One movable hero with XP, levels, death, and respawn | Partial |
| Hero depth | No selection roster, skill tree, active hero abilities, or campaign persistence | Missing |
| Enemy roles | Basic, fast, armored, magic-resistant, flying, healer, spawner, ranged, regenerating, boss | Good prototype variety |
| Enemy information | Descriptions exist in definitions, but no practical in-battle encyclopedia or inspection UI | Partial |
| Waves | Authored groups, lanes, previews, countdowns, early calls | Strong |
| Maps | Three themed maps with one or two lanes | Prototype-scale |
| Campaign progression | Linear unlocking and best-star retention | Basic |
| Star economy | Stars are scores only | Missing as a meta-progression currency |
| Upgrade meta-tree | None | Missing |
| Difficulty modes | None | Missing |
| Heroic/Iron challenges | None | Missing |
| Achievements | None | Missing |
| Encyclopedia/lore | None | Missing |
| Boss content | One boss | Prototype-scale |
| Audio/visual identity | Cohesive voxel presentation and synthesized audio | Strong identity |
| Mobile support | Responsive layout, but incomplete touch controls | Partial |
| Accessibility | Minimal native button support; canvas gameplay remains pointer-dependent | Incomplete |
| Long-session stability | GPU leaks and timing drift remain | Not production-ready |

## What is already convincingly Kingdom Rush–like

- Four complementary tower families.
- Armor and magic-resistance counterplay.
- Flying enemies that bypass barracks and cannons.
- Barracks soldiers that physically stall enemies.
- Rally-point control.
- Early wave calls for bonus gold.
- Two global battlefield abilities.
- Tiered towers with final specializations.
- Multiple lanes and themed maps.
- Hero movement, levelling, death, and respawn.
- Healers, summoners, ranged enemies, and a boss.
- Star-based level results and linear unlocking.

## What is required for feature completeness

### 1. Campaign meta-progression

Stars need a purpose beyond display. A Kingdom Rush–style campaign normally uses earned stars to unlock permanent improvements across tower families, abilities, and economy.

A minimum implementation would include:

- A persistent upgrade tree.
- Refund/reset support.
- Clear unlock prerequisites.
- Save migration and validation.
- Balance tests with and without upgrades.

### 2. Final-tier tower ability purchases

The current final branches include one automatic special each. A fuller implementation would let specialized towers purchase several abilities, often with multiple ranks, creating meaningful late-game gold decisions.

### 3. Deeper heroes

The current hero is a strong foundation but needs:

- Multiple selectable heroes.
- Distinct stats and roles.
- Active and passive skills.
- Skill levelling or persistent progression.
- Hero selection before a level.
- Better hero status and respawn UI.

### 4. Challenge and difficulty modes

The current maps have one standard configuration. Feature completeness needs:

- Multiple difficulty settings.
- Heroic-style challenge variants.
- Iron-style tower restrictions.
- Separate completion medals or stars.
- Rebalanced wave definitions per mode.

### 5. More campaign content

Three maps and one boss demonstrate the systems but do not provide campaign-scale breadth. A fuller release needs more environments, lane structures, enemies, bosses, and difficulty progression.

### 6. Better combat information

Players need clearer access to:

- Enemy health, armor, resistance, speed, and abilities.
- Tower damage type and effective DPS.
- Ability radii and exact cooldowns.
- Incoming-wave lane and composition.
- Hero level, XP, health, and respawn time.
- Status effects such as poison, stun, healing, and armor shred.

### 7. Production hardening

Before expanding content, the project needs:

- Correct GPU-resource ownership.
- Stable fixed-step simulation.
- Save schema validation and migration.
- Independent audio buses.
- Complete pause semantics.
- Touch and accessibility support.
- Automated gameplay and lifecycle tests.

## Final recommendation

Treat the current project as a successful **three-level playable prototype**. Fix the six major issues before substantially increasing content, because additional maps, units, projectiles, and tower abilities will amplify the existing lifecycle and regression risks.

After stabilization, the highest-value completeness work is:

1. Star-funded meta upgrades.
2. Final-tier purchasable tower abilities.
3. Deeper hero systems.
4. Difficulty and challenge modes.
5. Additional campaign content and bosses.
6. Enemy and tower information UI.
