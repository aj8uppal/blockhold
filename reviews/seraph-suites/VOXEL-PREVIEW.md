# Seraph suites in the game renderer

September 10 revision: Celestial Machines now use squared reactor frames, suspended cores and condenser banks. Crystal Wings use articulated spars and swept, solid crystal blades. The radial petal shapes are gone; early forms and the Sacred Stone suite remain available for comparison. All 27 captures have been refreshed.

All three concept suites have nine review-only voxel models. The preview loads the actual Blockhold game in a local sandbox, hides its HUD, and places the candidate on Greenhollow beside the existing Arrow, Mage and Beacon. It uses the production `buildModel`, shared lit/glow materials, camera, lighting, shadows and tier scale. The original production model is also selectable.

The translations are geometric prototypes, not exact reproductions of the generated illustrations. Curves become joined boxes and the crystal surfaces use opaque facets. Detailed glass, bloom, painted gradients and polished metal from the concept images are not reproduced by the existing two-material voxel renderer. Animation is a simple preview of wing motion, core breathing and crown rotation, rather than a new combat implementation. Production model code and combat definitions are untouched.

From the repository root:

```sh
npx vite --host 127.0.0.1 --port 5184 --strictPort
```

Open <http://127.0.0.1:5184/reviews/seraph-suites/voxel-preview.html> for the interactive renderer. The independent saved comparison is `voxel-compare.html`; it links 27 close-ups and six desktop/mobile context images in `voxel-renders/`. Context images show Event Horizon. Its dropdown compares each form across the three suites.

To recapture:

```sh
node scripts/seraph-voxel-capture.mjs
```

Validation: every model loaded in the real renderer, with finite positive box dimensions and no browser errors. The review modules pass strict TypeScript and ESLint checks. Captures use a fixed camera and explicit high visual quality to avoid adaptive quality changes during comparison. `voxel-renders/render-metrics.json` records scene dimensions and rendering counts; these are prototype counts, not a production performance qualification.
