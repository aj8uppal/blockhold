# Crimson arrival and burning ground

Implements the user's next effects pass locally. The approved Cathedral and
Crimson models and all combat values remain unchanged; ruleset stays at 18.

- `seraphAwakening.ts`: 2.8-second render-only transfer, gathering rings,
  localized shadow, brief crimson emission, outward ground waves and sparks.
  It does not delay attacks, alter the camera, or enter simulation state. Owned
  resources are disposed and the tower's original materials are restored.
- `groundFire.ts`: real rounded flame geometry with hot inner cores, animated
  tips, small spherical smoke puffs and an ember-lit ground patch. Three draws
  per patch; animation runs in shaders with time/fade uniforms.
- Expired burn zones stop dealing damage and keep a cosmetic cooling patch for
  up to 1.8 game seconds. Cooling is capped at 24 patches; sale/reset clears it.
  The patch is placed at the terrain's ground height.

## Review

`index.html` has two actual sandbox gameplay clips, frame enlargements and short
notes. `portable-review.html` includes all artwork and video for offline use.
The HUD is hidden for capture; no production accounts or saved battles are used.
The fire clip uses one Emberthrone shot against a stationary test target.

Regenerate from the dev frontend (default port 5197):

```sh
node scripts/arrival-fire-review.mjs
node scripts/build-arrival-fire-review.mjs
```

Set `BLOCKHOLD_CHECK_URL` to override the capture URL.

## Validation

- 438 unit tests pass, including old combat-hash fixtures and new natural-expiry,
  sale/reset and bounded-cooling regressions.
- Real WebGL fire checked from multiple angles on desktop and a phone in battery
  mode. No shader or browser errors; tower sale removes its remaining effects.
- Three production-build sacrifice/reload viewport tests pass.
- Two real co-op seats pass competing sacrifices, combat, rejoin and solo recovery
  with identical state hashes.
- Build, typecheck, lint and unchanged bundle budgets pass: app 183.6 KiB gzip,
  all JS 336.8 KiB.
- Review checked at desktop, portrait phone and landscape phone widths, including
  keyboard focus return, paused-by-default video, offline artwork and video URLs.

Production is unchanged by this pass.
