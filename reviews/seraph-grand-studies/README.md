# Grand stone Seraph review

Three new complete suites derived from the preferred Stone Seraphs direction:

- **Crowned Guardians:** broad ceremonial wings; additional pairs and an elevated sun distinguish the last tiers.
- **Thrones of Light:** seated stone sovereigns, wide throne wings and a clear change in posture.
- **Cathedral Sentinels:** standing guardians with upright architectural wings, open arches and outer buttresses.

Each includes T1–T3, Solar T4–T6, Void T4–T6, actual model sockets, and subtle firing articulation. A shared Crimson Sovereign has its own six-view/pose sheet. The three base suites are review candidates, not replacements for the live art. These files are actual voxel geometry rendered with the game engine; they are not generated image mockups.

Open `index.html` through Vite for the review, or use `portable-review.html` directly. The portable copy includes images, video, sheet downloads and the bundled interactive viewer. Review controls never instantiate Game or access account/battle data. Feedback selections remain local until explicit submission.

## Crimson Sovereign mechanic

Implemented in the local game under ruleset 18. Two opposite, non-ghost tier-six Seraphs can fuse. Either plot may remain. The confirmation requires an explicit donor selection. No extra gold or account currency is required beyond building the two Mythics (66,500 gold at current base prices).

The donor disappears without a sale refund. Its plot and terrain stay available. The survivor retains its ascension, target policy, earned combat statistics and its original sell value. Each additional fusion needs a fresh pair; there is no map-wide cap or recursive feeding.

Baseline: 1,400–1,600 true damage every 0.5 seconds, 5.8 range, and 40% splash within 1.5 tiles. The primary is never hit twice. Ground and flying enemies are eligible; distant and untargetable enemies are excluded. Solar Strike, the Event Horizon field and their pending tower-owned markers are removed. Concentrated boss damage and a freed plot are balanced against losing separate coverage, Solar's eight beams and both former special powers. These are initial values for continued playtesting, not a claim that every endless scenario is solved.

Fusion is one ordered co-op command. Missing donors, duplicate or competing requests, same-branch pairs, ghosts, non-Mythics and fused towers cannot be consumed. The form participates in state hashes, journals and boundary checkpoints. Old battles retain their original balance and can acquire a new fusion after restoration.

## Reproduce

```sh
node scripts/grand-seraph-review.mjs
node scripts/build-grand-seraph-review.mjs
npx -y lavish-axi .lavish/seraph-grand-studies/index.html
npx -y lavish-axi export .lavish/seraph-grand-studies/index.html --out reviews/seraph-grand-studies/portable-review.html
```

After exporting, inline the four `renders/sheet-*.png` download links as PNG data URLs; the exporter inlines image/video sources but not download anchors.

For the game portrait, with Vite serving:

```sh
BLOCKHOLD_CHECK_URL=http://127.0.0.1:5197 TOWER_PREVIEW_ONLY=seraphCrimson node scripts/render-upgrade-previews.mjs
```

## Verification

- 433 unit tests passed, including paid sacrifice behavior, opposite branches, no shared cap, replay/future equivalence, old ruleset-17 recovery, malformed commands and full primary/reduced splash damage.
- 56 server/API tests passed; client and server typechecks, lint and production build passed.
- Seven production-browser checks passed: fusion selection/cancel/confirm/page reload at desktop, portrait phone and landscape phone sizes, plus existing endgame flows.
- Two real browsers against a ruleset-18 local server passed competing sacrifices, combat hash equality, room rejoin and solo save recovery. Reproduce with `BLOCKHOLD_CHECK_URL=http://127.0.0.1:5197 node scripts/coop-seraph-fusion-check.mjs`.
- Review checked at 1440×1000, 390×844 and 844×390: full model images fit, all-tier 3D firing works, Escape closes the embedded viewer, selections queue only on submission, and offline images/downloads/3D work.
- The native model and lazy confirmation bring total JS to about 336.1 KiB gzip. Total budget increases by 1 KiB to 337; the initial app cap stays 184 KiB (actual about 183.5 KiB).

Local preview only. A release must update frontend and co-op backend together to ruleset 18; do not deploy only one side. Existing base Seraph art remains unchanged pending selection.
