# Seraph and fire: September 13 art review

Review candidates; none of these models or effects replaces live game art.

Open `portable-review.html` directly for the full review with embedded images, fire motion loops, downloadable sheets and the interactive 3D viewer. It does not need Vite or the Lavish server. `index.html` is the smaller version using the adjacent `renders/` directory.

Three Seraph directions, each with all nine forms (shared T1–T3, Solar T4–T6, Void T4–T6): Stone Seraphs, Sanctum Spires, and Crowned Relics. The fire directions are Hearthfire, Forked Torchfire and Cinderfield. Current live art is included as a reference. Close-ups frame each tower for detail; battlefield comparisons keep the same camera and actual tier scale.

The models reuse the game's `VoxModel`, builder, materials, lighting and renderer. The fire candidates are solid cuboids with a lit body and small glowing core. The standalone viewer does not instantiate Game or access an account/battle save. Seraph attack previews illustrate emission points and beam/pulse motion, not balance or real targeting rules.

## Reproduce

From the repository root:

```sh
node scripts/block-art-review.mjs
node scripts/build-block-art-review.mjs
npx -y lavish-axi .lavish/seraph-block-studies/index.html
npx -y lavish-axi export .lavish/seraph-block-studies/index.html --out reviews/seraph-block-studies/portable-review.html
```

The export command inlines media but leaves the three sheet-download anchor URLs relative. The delivered portable copy additionally embeds those PNGs in its download links.

## Checks completed

- All 27 proposed Seraph models and 9 live references built with finite, positive voxel geometry.
- Four fire loops (three candidates and the live reference), close-ups, battlefield comparisons, and three full sheets rendered in Chromium.
- Viewer selection, tier changes, attack preview, pause, orbit, close, and mobile controls checked.
- Review choices persist locally; feedback is queued only by explicit submission. Copy feedback works outside Lavish.
- Typecheck and lint pass for the review source and scripts.
- Standalone exported file opens away from its source directory, with images, videos and both 3D modes working without external scripts or a development server.
- Desktop, 390 × 844 portrait, and 844 × 390 landscape layouts checked for horizontal overflow. These are browser checks, not physical-device or Safari certification.

Your Hold's separate production release remains at `0fe335b`; its complete CI run passed before this review work began.
