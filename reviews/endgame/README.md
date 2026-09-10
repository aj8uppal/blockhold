# Endgame renderer review

These are staged views from the actual Three.js renderer and game interface. The review injects account level 30, completion honors, gold, and enemy positions to expose each state. These frames are presentation evidence, not balance evidence; see `../hunt-balance.md` for legal-economy combat runs.

Reproduce with `node scripts/endgame-review.mjs --motion`.

- `helios-engine.png` and `event-horizon.png`: distinct Mythic crowns with seven separate beams, captured at camera distances 10.5 and 12.
- `last-legion.png`: command arch, split banner, four restored soldiers, and the active formation boundary.
- `ossuary-radius.png`: three-tile resurrection ring and final-boss instruction/health bar.
- `empress-air.png` and `empress-ground.png`: airborne and grounded silhouettes with phase-specific HUD text and health bars.
- `hub-desktop.png`: actual endgame hub at 1440×1100.
- `hub-small-landscape.png`: hunt cards at 844×390; vertically scrolled into view through the real scroll container.
- `helios-engine-motion.webm` and `event-horizon-motion.webm`: optional approximately four-second clips showing crown motion, independent beams, and a staged signature trigger. The renderer canvas capture excludes HTML HUD/captions.

`captures.json` records models, tiers, draw calls, boss health, viewport dimensions, overflow checks, and browser errors.

Final inspection: all three Mythic silhouettes fit their frames; both Seraphs retain separate beam endpoints. Boss instructions/health bars and the green resurrection boundary are legible. The hub's initial transparent backing caused poor text contrast; the corrected dark backing is present in both final captures. At 1440×1100 and 844×390, the real hub scroll container and all cards have no horizontal overflow. The small landscape image shows both hunt cards and all six difficulty buttons without clipping.

Motion was checked by browser playback plus frames sampled at 0.2, 1.6, and 3 seconds. The crown rings rotate continuously, the solar warning circle appears, and the bounded violet rift is visible. Clips use a lower recording pixel ratio than the stills; software-rendered recording/playback is variable-rate and is not a device frame-rate benchmark. `motion-check.json` records decoded dimensions, duration, and playback counters.
