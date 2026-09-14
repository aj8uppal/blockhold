# Faceted fire and the Crimson arrival

Three hand-shaped flame outlines now form closed volumes with bulging front
and back faces. Four nested, asymmetric contours are stitched into real heat
facets: orange edges, gold bodies, yellow interiors and pale cream cores. There
is no pixel-grid color mask. Flame orientations remain fixed in world space;
only foreground size responds to the camera. Five main tongues and three low
flickers preserve the compact heights and clear view of characters.

The bodies bend, narrow and stretch with independent sharp rhythms while their
bases stay planted. Core facets stay bright without sunlight or glow. Broader
smoke puffs drift behind the flames and fade more strongly across the foreground
and during cooling. Fine embers replace large orange coal spots; the charcoal
patch and warm perimeter spill connect the burning area without replacing the
underlying path.

- Four draws per patch: solid flames, a translucent irregular scorch/coal patch,
  nine low-poly smoke puffs (five rising, four lower around the flames), and one
  instanced draw for 13 sparks, eight body halos and one ground spill. These are local halos, not a full-screen bloom pass.
- Time/fade uniforms animate the fire on the GPU. No per-frame flame or spark
  matrix uploads, downloaded textures, or new postprocessing dependency.
- Two shadowless point lights serve the entire scene. Their stable count avoids
  recompiling world materials whenever a fire patch appears. Only nearby ground
  and lower objects receive amber spill; the exposure and sunlight stay unchanged.
- Older pooled smoke now fades in alpha rather than fading its color to black.
  The additive particles preserve the same effective fade. Burn sparks now use
  a fixed GPU count, replacing the previous per-tick emission.
- Expired burn zones stop dealing damage immediately, then cool cosmetically for
  up to 1.8 game seconds. Cooling is capped at 24 patches; sale/reset clears them.
  A fourth patch still retires the oldest patch's damage immediately, but its
  rendered flame shrinks for up to 0.45 seconds before leaving embers and smoke.
  Naturally expired patches and sold towers keep their existing cleanup behavior.

The previously implemented Seraph arrival remains unchanged: the merged model
rises from zero over 1.2 seconds during the render-only transfer/awakening. Recovery
skips the effect, and cleanup restores the model's original hierarchy.

## Review and capture

`index.html` contains the gameplay clip, supplied reference, raw WebGL views with
and without glow, normal zoom, another camera angle, a phone viewport, and cooling.
`portable-review.html` includes the images and video for offline use. The review
uses the game's own slate/gold/system-font design. Videos never autoplay.

Captures use isolated sandbox browser profiles, never production accounts or the
user's saved battles. Battlefield geometry, character models, camera controls and combat rules are preserved.

```sh
BLOCKHOLD_CAPTURE=fire node scripts/arrival-fire-review.mjs
BLOCKHOLD_CAPTURE=barrage node scripts/arrival-fire-review.mjs
node scripts/fire-quality-check.mjs
node scripts/build-arrival-fire-review.mjs
```

Set `BLOCKHOLD_CHECK_URL` to override the default dev frontend on port 5197.
The quality/stress script uses the dev module endpoint to place its isolated test
patches. Omit `BLOCKHOLD_CAPTURE` to regenerate the earlier merge clip too.

## Validation

- 443 unit tests pass: historical replay/combat hashes, expiry without extra
  damage, owner/reset cleanup, shared geometry, bounded lights and smoke opacity.
- Raw WebGL checks cover glow on/off, normal zoom, camera orbit, pause, a phone
  viewport in battery mode, sale cleanup and 12 simultaneous patches. Two lights
  remain allocated; patches reuse shaders. No browser or shader errors.
- Build, typecheck and lint pass. Measured gzip is approximately 185.2 KiB app / 338.8 KiB total.
  This pass adds about 1.7 KiB including ~0.4 KiB for Three's point-light support.
  This reconstruction adds about 0.3 KiB gzip; the app cap moves from 185 to
  186 KiB and the total cap stays 339 KiB. Each patch uses 1,904 flame triangles
  (previously 1,408), with no additional draws, lights or textures.
- The two-browser co-op check covers shared combat, rejoin and solo recovery.
- Browser emulation checks rendering, not physical mobile heat or battery drain.

The successive-shot regression covers three damaging patches at the cap, no
extra damage from retired flames, gradual visual retirement and final disposal.
The recorded barrage fires five twin-shell volleys at 650ms intervals: no lit
patch is abruptly removed, and all ten patches finish cooling and release their
resources. Draws per patch and the shared light count remain unchanged.

Approved for production together with the Cathedral Seraph sprites and Crimson
fusion/awakening. Both client and sync service must run ruleset 18.
