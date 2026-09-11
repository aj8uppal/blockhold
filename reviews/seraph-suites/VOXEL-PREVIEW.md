# Seraph suites in the game renderer

September 10 revision: Celestial Machines now use squared reactor frames, suspended cores and condenser banks. Crystal Wings use articulated spars and swept, solid crystal blades. The radial petal shapes are gone; early forms and the Sacred Stone suite remain available for comparison. All 27 captures have been refreshed.

Selected game lineup: Crystal Wings at tiers 1–3, Sacred Stone for Solar/Helios at tiers 4–6, and Crystal Wings for Void at tiers 4–6. The tier-one crystal is taller and fuller; Void uses deep amethyst and obsidian with a restrained violet rim. Higher Void tiers gain modest wing span, core height and crown height. The preview opens on this selected combination.

All three concept suites have nine voxel models. Their geometry lives in `src/voxel/models_seraph_suites.ts`, shared with the selected game models. The preview loads Blockhold in a local sandbox, hides its HUD, and places the candidate on Greenhollow beside the existing Arrow, Mage and Beacon. It uses the production `buildModel`, shared lit/glow materials, camera, lighting, shadows and tier scale. Choose Selected combination to see the actual local game lineup.

The translations are geometric interpretations of the generated illustrations. Curves become joined boxes and the crystal surfaces use opaque facets. Detailed glass, bloom, painted gradients and polished metal from the concept images are not reproduced by the existing two-material voxel renderer. The art study uses a simple pose animation; actual gameplay uses the tower's animated wings, eased heart pulse and crown rotation.

Ruleset 13 also gives the Void branch an uncapped area attack: one dark laser pulse and an impact ring, with splash radii 1.15 / 1.45 / 1.65 tiles at tiers 4 / 5 / 6. Each eligible enemy in the area receives full magic damage through resistance; flyers are included. Earlier saved battles retain capped beam volleys, verified with an actual ruleset-12 fixture. These changes are local and have not been deployed.

From the repository root:

```sh
npx vite --host 127.0.0.1 --port 5184 --strictPort
```

Open <http://127.0.0.1:5184/reviews/seraph-suites/voxel-preview.html> for the interactive renderer. The independent saved comparison is `voxel-compare.html`; it compares the three original art directions. `voxel-renders/` contains 36 close-ups and eight desktop/mobile context images, including the selected combination as `current-*`. Context images show Event Horizon.

To recapture:

```sh
node scripts/seraph-voxel-capture.mjs
```

Validation: every model loaded in the real renderer, with finite positive box dimensions and no browser errors. The review modules pass strict TypeScript and ESLint checks. Captures use a fixed camera and explicit high visual quality to avoid adaptive quality changes during comparison. `voxel-renders/render-metrics.json` records scene dimensions and rendering counts; these are prototype counts, not a production performance qualification.
