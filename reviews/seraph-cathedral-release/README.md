# Cathedral Sentinels and Crimson Sovereign

Approved Cathedral Sentinels now supply all nine production Seraph forms. The
Crimson Sovereign has a taller hooked crown, black stone, a narrow red eye and a
tracking upper assembly. Each actual volley articulates the stone wings and arms;
the base stays planted. Upgrade portraits use these same authored models.

The existing opposite-Mythic sacrifice now shows donor portraits and an optional
plot map, followed by a short, render-only transfer of light. Combat, prices and
ruleset 18 remain unchanged. The sacrificed plot is reusable and removed from
replay build summaries.

## Review

- `index.html`: responsive showcase with all nine forms, six fusion poses and video.
- `portable-review.html`: self-contained artwork, clips and both PNG downloads.
- `renders/sheet-cathedral.png`: all nine Cathedral forms.
- `renders/sheet-crimson.png`: six fusion views and firing poses.
- `renders/game-sacrifice.webm`: real Greenhollow sandbox sacrifice and combat;
  HUD hidden for capture. No production account or saved battle was used.
- `renders/cathedral-{5,8}.webm`: model pose studies with a preview beam, not a
  combat simulation. Actual firing is shown in the gameplay clip.

The 3D link opens the repository's current-build viewer and needs the local dev
server. The downloaded sheets and inline video work offline.

Regenerate with the dev frontend at port 5197 (or `BLOCKHOLD_CHECK_URL`):

```sh
node scripts/cathedral-release-review.mjs
node scripts/build-cathedral-release-review.mjs
```

## Validation

- 435 unit tests pass, including frozen pre-Cathedral ruleset-18 battle journals
  before and after fusion. Their exact combat hashes remain unchanged.
- Three production-build browser flows pass: desktop, portrait phone and landscape
  phone; choosing, cancelling, confirming and reloading the sacrifice.
- Two real co-op browsers pass competing sacrifices, combat, rejoin and solo
  journal recovery, with matching state hashes.
- Typecheck, lint, production build and bundle budgets pass. Gzip app: 183.0 KiB;
  all JS: 336.2 KiB, within existing limits.
- Showcase checked in all three viewports, including enlargement, Escape/focus
  return, offline artwork and embedded PNG downloads.

This review describes the local implementation. Production was not deployed as
part of this art-selection pass. Deploying the pending fusion release requires
matching ruleset-18 frontend and sync backend builds.
