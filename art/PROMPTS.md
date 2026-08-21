# Blockhold — Midjourney prompt kit

Twelve images turn the game's blank surfaces into painted ones: three hero portraits, seven level-select cards, one title key art, one app icon.
Three optional boss portraits at the end if you're enjoying yourself.

## Workflow

1. Generate the **anchor image** first (the Greenhollow card below) and rerun until one feels right — it defines the look of the whole set.
2. Copy that image's URL and append `--sref <url>` to every other prompt so the set stays in one style.
3. Upscale your pick from each 4-grid before downloading.
4. Drop the finished files into this `art/` folder using the exact filenames below — I'll handle matting, palette-nudging, compression, and wiring them into the game.

Notes that save re-rolls:

- Keep `--style raw`; without it MJ over-beautifies into generic fantasy gloss.
- Don't ask for "no text" in the prompt body — negations belong in the `--no` parameter, which every prompt below already carries.
- If a portrait comes back too photoreal, add `game art, illustration` right after the opening phrase.
- Faces: we want stylized-painterly, not portrait-photography; if MJ drifts realistic, add `--stylize 250`.

## Global style (already baked into every prompt)

```
stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --style raw --no text, watermark, letters, logo, border, frame
```

## 1. Anchor + level-select cards — `--ar 5:3`

Save as `art/card-<id>.png`.

**card-greenhollow.png** (generate this one FIRST — it's the style anchor)

```
a sunlit meadow road winding between voxel-hewn hills toward a small stone keep, golden hour, wildflowers, distant purple storm on the horizon, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

**card-frostmere.png**

```
two frozen mountain roads converging on a single gate tower in a snowy pass, pale blue dusk, snow drifting, faint violet glow between the pines, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

**card-emberwastes.png**

```
scorched ash wasteland with twin war-roads, rivers of lava, the colossal silhouette of an armored juggernaut striding through smoke in the distance, ember sparks rising, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

**card-mistfen.png**

```
a drowned fen at twilight, two half-sunken causeways through black water, glowing green ghost-lights, translucent hooded figures fading between the reeds, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

**card-shatteredcrown.png**

```
a shattered obsidian throne at the center of three converging roads, cracked violet sky, a winged queen silhouette hovering above the ruin, floating crystal shards, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

**card-cinderwake.png**

```
a volcanic caldera of black glass with three glowing roads crossing lava fields, crystal rain falling from a violet sky, glass-winged creatures circling, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

**card-veilscar.png**

```
a luminous violet wound torn in reality above a dark battlefield, three roads pouring toward the rift, a colossal crowned figure half-phased into light at its mouth, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 5:3 --style raw --no text, watermark, letters, logo, border, frame
```

## 2. Hero portraits — `--ar 1:1`

Save as `art/hero-<id>.png`.
Bust framing (head and shoulders), subject centered, simple dark background — I'll frame them in-game.

**hero-aldric.png** — Sir Aldric the Bulwark, melee anchor

```
bust portrait of a stalwart human knight commander, blued steel plate with gold trim, red plume, weathered resolute face, tower shield edge visible at shoulder, dark smoky background, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 1:1 --style raw --no text, watermark, letters, logo, border, frame
```

**hero-liora.png** — Liora the Gale Warden, ranger who shoots flyers

```
bust portrait of a keen-eyed elven ranger woman, hooded forest-green cloak, pale wind-swept hair, longbow stave over her shoulder, a feather charm at her collar, dark misty background, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 1:1 --style raw --no text, watermark, letters, logo, border, frame
```

**hero-zephyra.png** — Zephyra the Stormcaller, armor-ignoring tempest mage

```
bust portrait of a fierce storm sorceress, crackling pale-blue lightning woven through dark hair, silver circlet, charged air and floating sparks around her raised hand, dark thunderhead background, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 1:1 --style raw --no text, watermark, letters, logo, border, frame
```

## 3. Title key art — `--ar 16:9`

Save as `art/title-keyart.png`.
This backs the main menu and becomes the og-image for link sharing, so leave the center-left third calm enough for the title card to sit on.

```
epic wide shot of a lone voxel-stone castle on a floating island holding back a tide of violet mist and glowing enemy silhouettes, last golden light breaking through storm clouds, banners streaming, composition weighted to the right with calm sky on the left, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 16:9 --style raw --no text, watermark, letters, logo, border, frame
```

## 4. App icon — `--ar 1:1`

Save as `art/icon-app.png`.
This one intentionally breaks the painterly style — icons need to read at 48px.

```
flat emblem game app icon of a gold voxel castle keep on a deep indigo rounded shield, bold simple geometry, three crenellations, subtle violet glow behind the towers, centered, minimal detail, crisp vector style --ar 1:1 --style raw --no text, watermark, letters, photo, realistic
```

## 5. Optional — boss portraits for enemy tooltips, `--ar 1:1`

Save as `art/boss-<id>.png`.

**boss-juggernaut.png**

```
bust portrait of a colossal siege golem of black iron and ember-cracked stone, tiny burning eyes, chains and broken weapons embedded in its shoulders, dark ashen background, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 1:1 --style raw --no text, watermark, letters, logo, border, frame
```

**boss-veilqueen.png**

```
bust portrait of a regal winged horror queen, crown of violet crystal, tattered gossamer wings, pale luminous eyes, court of tiny gargoyle silhouettes behind her, dark violet background, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 1:1 --style raw --no text, watermark, letters, logo, border, frame
```

**boss-veilregent.png**

```
bust portrait of a crowned colossus half-dissolved into violet light, body of cracked obsidian leaking radiance, solemn and inevitable, faint heralds singing in the glow behind it, dark rift background, stylized painterly fantasy game art, chunky confident shapes, warm parchment-gold palette with deep violet-teal shadows, soft rim light, dark vignette edges --ar 1:1 --style raw --no text, watermark, letters, logo, border, frame
```

## Handoff checklist

- [ ] `card-greenhollow.png` (anchor — generate first)
- [ ] `card-frostmere.png`
- [ ] `card-emberwastes.png`
- [ ] `card-mistfen.png`
- [ ] `card-shatteredcrown.png`
- [ ] `card-cinderwake.png`
- [ ] `card-veilscar.png`
- [ ] `hero-aldric.png`
- [ ] `hero-liora.png`
- [ ] `hero-zephyra.png`
- [ ] `title-keyart.png`
- [ ] `icon-app.png`
- [ ] optional: `boss-juggernaut.png`, `boss-veilqueen.png`, `boss-veilregent.png`

Any resolution MJ gives you is fine — I downscale and compress everything to webp during integration.
Don't worry about stray artifacts near the edges; the vignette crop eats them.
