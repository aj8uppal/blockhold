# Mobile UI pass — September 9, 2026

Claude Opus 5 reviewed the actual renderer captures and input/UI source in two read-only Claude Code runs. Both runs reported `claude-opus-5` as the reviewing model. The requested reference was Apple's clarity and mobile interaction quality, while retaining Blockhold's wood, parchment, gold and blue identity.

The implemented pass adds forgiving touch selection, exclusive selection state, repeat-tap dismissal, explicit target cancellation, muted-phone invalid-target feedback, stable build choices, primary upgrades first, bounded inspectors, scroll guidance and compact pause controls. Menus work in portrait; a covered battlefield pauses and offers the appropriate save, leave or explicitly confirmed abandon action. Rally confirmation and cancellation both restore the inspector.

Single-tap purchasing and the always-visible XP remaining readout are retained to preserve fast play and the user's existing preferences. Game rules and combat timing are unchanged. Co-op continues using ruleset 9, so existing rooms remain compatible.

The second Opus review identified rally-confirm restoration, invalid aim feedback and unsavable portrait exits as correctness gates. Each was fixed and verified with a specific browser regression. The final capture resolves the overlapping targeting message and clipped scroll hint noted during the visual review.

Validation: 347 game tests, 28 Chromium browser checks, TypeScript, ESLint and bundle budget pass. Browser coverage includes small finger movement versus pan, cancelled touches, repeated selection, switching away from hero, hold-to-inspect without buying, stale preview cleanup, valid/invalid rally points, portrait auto-pause and safe/unsavable exits. Captures cover 667×375, 844×390 and 390×844; these are browser emulations, not physical-device testing. The initial app adds about 1.2 KiB gzip; total JavaScript remains within 290 KiB.

The portable visual report is `reviews/ui-polish.html`. Screenshots stage account access and a generous planning countdown solely for UI inspection.

Reference: [Apple Game Controls](https://developer.apple.com/design/human-interface-guidelines/game-controls), including 44×44 pt frequent touch controls. This web implementation uses 44 CSS pixels for the corresponding button minimum.
