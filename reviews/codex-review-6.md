## A. Mobile/PWA pass

1. **Medium — Watchdog permanently degrades 30 Hz devices to potato quality.**  
   **Location:** `src/core/engine.ts:44-45,68-81`  
   A steady 30 Hz display produces ~33 ms samples, exceeding the 25 ms threshold every window. Coarse-pointer devices start at tier 1 and therefore disable shadows after roughly 180 frames. Desktop falls twice. Frames up to 500 ms also pollute the average. There is no oscillation because quality only increments and never upgrades, but transient or refresh-rate-driven degradation is irreversible.  
   **Fix:** require multiple consecutive slow windows, discard/reset on frames above ~100 ms and visibility changes, and use tier-specific thresholds—for example, tier 0→1 above 25 ms but tier 1→2 above 40 ms.

2. **Low — Entering tier 2 leaves the old shadow render target allocated.**  
   **Location:** `src/core/engine.ts:54-64`  
   Tier 0→1 disposes and clears `sun.shadow.map`; tier 1→2 merely disables shadows. Because quality never upgrades, that render target remains unused for the session.  
   **Fix:** call `this.sun.shadow.map?.dispose(); this.sun.shadow.map = null` before disabling the shadow map.

3. **Low — Portrait zoom bounds remain after resizing to landscape.**  
   **Location:** `src/core/engine.ts:168-173,213-223`  
   `maxZoomOut` is recalculated only by `resetView()`. Starting a level in a narrow desktop portrait window selects 34; widening to landscape updates the camera aspect but leaves the camera and zoom ceiling at 34 instead of 22.  
   **Fix:** store the active map dimensions and recalculate/clamp `maxZoomOut`, `dist`, and `distGoal` inside `resize()` when the aspect category changes.

4. **Medium — Two-finger pan and tilt use one contact’s movement, not centroid movement.**  
   **Location:** `src/main.ts:57-73,93-118`  
   Pinch and twist use both contacts, but pan and tilt consume the `dx/dy` of whichever pointer produced the current event. Symmetric pinches and twists therefore inject transient—and under uneven event delivery, residual—pan/tilt. A third contact also pans/tilts even though distance and angle use only the first two.  
   **Fix:** accept exactly two contacts and retain their previous centroid, distance, and angle. Apply pan/tilt from centroid delta and reinitialize all baselines whenever the pointer set changes. `dragOrbit` is correctly latched, and the ordinary `pointercancel` path resets final-pointer state at `src/main.ts:128-145`.

5. **Medium — The bottom sheet can cover the second and third ability buttons.**  
   **Location:** `src/style.css:140-146,677-688`; `src/ui/hud.ts:64-66,123-139`  
   The coarse layout’s three-button ability row occupies `3×54 + 2×8 = 178px`, starting at `10px + safe-area`. The panel reserves only 84px. At landscape viewports below roughly 656 CSS pixels, their horizontal and vertical rectangles overlap; the later-created panel paints above the ability bar.  
   **Fix:** either move the sheet above the ability row with `bottom: calc(76px + env(safe-area-inset-bottom))`, or reserve the complete row width—approximately `198px + safe-area-inset-left`.

6. **Low — A passive top-bar layout container still intercepts its gaps.**  
   **Location:** `src/style.css:28-44,54-63`; `src/ui/hud.ts:77-84`  
   The direct `.topbar` is now correctly passive, but both `.topbar-group` containers restore `pointer-events:auto`; empty flex gaps can still consume canvas input even though the actual buttons and stats are already explicitly re-enabled.  
   **Fix:** set `.topbar-group { pointer-events:none }` and retain `pointer-events:auto` only on the intended leaf controls.

   Direct-child audit: `topbar`, `wave-call-wrap`, and `abilities` are passive shells; `build-menu`, `tower-panel`, and `pause-overlay` are interactive; `enemy-tip`, `damage-vignette`, `banner`, `toast`, `mode-hint`, and pooled `floater`s are passive. Apart from the top-bar-group gap above, their classifications are correct. `wave-preview` is nested, not a direct child.

7. **Low — Several touch controls remain below the 44px target guideline.**  
   **Location:** `src/style.css:85-93,265-269,674-675,692-693`  
   Coarse-pointer top-bar buttons are 38×38px, close buttons are 26×26px, and the wave/general/small buttons have no 44px minimum height. The 54px ability buttons meet the guideline.  
   **Fix:** under the coarse-pointer query, add `min-width:44px; min-height:44px` to `.icon-btn`, `.wave-call`, `.tp-close`, `.btn`, and `.mode-option`.

8. **Low — Mobile build-menu clamping uses the desktop width and ignores safe areas.**  
   **Location:** `src/ui/hud.ts:308-312,361-363`; `src/style.css:671-695`  
   CSS widens the menu to 248px, but tower and trap placement still clamp using `mw = 232`. It can extend 16px past the viewport, and the hard-coded 10px edge permits placement beneath a landscape notch.  
   **Fix:** unhide the menu, measure `getBoundingClientRect()`, and clamp using measured dimensions plus safe-area values exposed through CSS custom properties.

9. **Medium — The service worker can serve an old deployment indefinitely and does not make the first visit fully offline-capable.**  
   **Location:** `public/sw.js:4-8,20-37`; `src/main.ts:48-52`  
   Navigations are cache-first. If a deployment changes only hashed JS/CSS while `sw.js` stays byte-identical, no new worker installs and cached `index.html` continues referencing the old bundle. Also, registration occurs after the initial load and installation precaches only `./` and the manifest, so the first offline reload can lack the JS/CSS fetched before the worker controlled the page.  
   **Fix:** generate a build-versioned precache containing `index.html` and all hashed assets; use network-first navigation with cached fallback, while retaining cache-first for immutable hashed assets.

10. **Low — The declared maskable icon is not mask-safe.**  
    **Location:** `public/manifest.webmanifest:14`; `public/icon-512.png`  
    The same edge-filling castle artwork is declared as both ordinary and maskable. Its battlements extend outside the central maskable safe region and will be cropped by circular or aggressively rounded masks.  
    **Fix:** create a dedicated opaque `icon-maskable-512.png` with the castle scaled into the central safe circle, and reference it only with `"purpose":"maskable"`.

The portrait overlay itself is correctly limited to portrait, coarse-pointer viewports at or below 940px (`src/style.css:648-666`); it cannot block landscape or ordinary fine-pointer desktop layouts. DPR caps, coarse-pointer tier selection, `applyTheme()`/`buildSky()` interaction, and production-only registration are otherwise correct.

## B. Kill attribution

11. **Medium — A last Broodmother can resolve the same wave twice.**  
    **Location:** `src/game/game.ts:129-153,192-216`  
    `onEnemyKilled()` resolves the parent before spawning its same-`waveTag` brood. If the parent was the final tracked enemy after spawning ended, the tracker is deleted and the perfect-wave reward is granted. The children then create a fresh tracker for the same wave and can grant the reward, streak, and gold again.  
    **Fix:** spawn and register all `spawnOnDeath` children before calling `resolveWaveEnemy()` for the parent, or defer wave completion until the end of the simulation step.

12. **Low — Trap kill counts do not update while their panel is open.**  
    **Location:** `src/ui/hud.ts:244-250,366-374`  
    Opening a trap explicitly clears `currentTower`, while refresh updates `.tp-kills` only from `currentTower`. The displayed trap total remains frozen until the panel is reopened.  
    **Fix:** track a common `currentKillCredit: Tower | Trap | null` and refresh from it, setting it in both panel-opening methods.

13. **Low — “Deadliest building” forgets sold sources and silently breaks ties.**  
    **Location:** `src/game/game.ts:479-488,842-852,943-951`; `src/ui/screens.ts:208-209`  
    `topKiller()` scans only currently placed towers and traps. Selling the battle leader removes all its earlier kills from consideration; an in-flight projectile may safely increment the removed tower object, but that total is still invisible. Equal leaders are resolved by array order because comparisons use `>`. The zero-kill case correctly returns `null`.  
    **Fix:** register every built tower/trap in a battle-scoped kill-source ledger that survives sales. Compute the maximum from that ledger and return all sources tied at the maximum for end-screen rendering.

All requested damage paths otherwise carry credit exactly once: direct arrows/bolts, cannon splash, cluster bomblets, burn zones, poison, chain lightning, barracks melee, all hero attacks and abilities, and trap bursts. `Enemy.takeDamage()` guards dead targets before incrementing, while poison performs one explicit strongest-source increment. Reinforcements retain `credit = null`, and meteors pass no credit, so neither is incorrectly attributed. Sold-tower projectile references remain safe because the projectile keeps the object alive. Brood and boss summons both propagate `waveTag`; finding 11 is the ordering defect around that propagation.

## C. Verification

No verification failures:

- `npm run typecheck` — **PASS**, exit 0.
- `npx vitest run --pool=threads` — **PASS**, 8 files / 37 tests.
- Existing `dist/` — contains non-empty `manifest.webmanifest`, `sw.js`, 180/192/512 icons, hashed JS, and hashed CSS. PWA files are byte-identical to `public/`, and `dist/` is newer than the audited sources.
- `npm run build` — not run because it deletes/rewrites `dist/`, contrary to the explicit read-only constraint.

Verdict: mobile-readiness — **not ready for release despite no Critical or High defects**. The highest-severity blockers are the permanently over-aggressive quality watchdog, drifting multi-touch decomposition, bottom-sheet/ability overlap on small landscape devices, stale/incomplete PWA caching, and double wave resolution after a final Broodmother. Kill-credit propagation itself is otherwise comprehensive and non-duplicating.

Codex session ID: 01a01feb-3118-7343-ba30-e6bef15f6615
Resume in Codex: codex resume 01a01feb-3118-7343-ba30-e6bef15f6615
