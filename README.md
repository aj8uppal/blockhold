# 🏰 Blockhold

*Hold the line, block by block.*

A 3D voxel tower defense for the browser. Built with Three.js + TypeScript + Vite — no game engine, no art assets: every model is authored in code as colored voxel boxes, and every sound is synthesized with WebAudio.

It starts from the classic tower-defense grammar and grows its own mechanics: road traps, a shard economy with tower ascension, Veiltide surge waves, resonance placement bonuses, phasing enemies, and a flying final boss.

## Play

```bash
npm install
npm run dev      # then open http://localhost:5173
```

Other commands:

```bash
npm run build      # typecheck + production bundle (deploy dist/ to any static host)
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
npm test           # vitest unit/regression suite
```

## The campaign

Five maps, each with its own theme, roster, and shape of pressure:

1. **Greenhollow** — the meadow road. Learn the trade.
2. **Frostmere Pass** — two frozen roads, one gate.
3. **The Emberwastes** — twin warpaths and the Juggernaut.
4. **Mistfen Crossing** — a drowned fen where Mistwalkers phase in and out of reach.
5. **The Shattered Crown** — three converging warpaths and the flying Veilqueen.

Three difficulties per map (Veteran adds elite-affix enemies), three stars per victory, all progress saved locally.

## What makes it Blockhold

- **Road traps.** Rune circles on the road itself hold a second build system: Spike Snares (burst + pin), Frost Runes (permanent slow zone), and Blast Charges (huge, slow to re-arm).
- **The shard economy.** Shardbacks, elites, and bosses drop Veilshards 💎. Spend them to **Overcharge** a tower (+60% attack speed) or **Ascend** a tier-4 tower with one of two permanent perks per family — an entire extra upgrade layer above the branch choice.
- **Veiltide surges.** Marked waves arrive empowered under a violet sky. The early-call bonus is still on the table — if you dare.
- **Resonance.** Same-family towers standing adjacent buff each other (+6% damage; barracks raise tougher soldiers). Placement geometry is a real decision.
- **A hero roster.** Sir Aldric the Bulwark (melee anchor, Valor Slam), Liora the Gale Warden (ranged, hits flyers, Piercing Volley), or Zephyra the Stormcaller (armor-ignoring bolts, Static Nova slow-burst). Heroes take move orders with real A* pathfinding, level from nearby kills, and respawn where they fell.
- **The Long Night.** Beat any map to unlock its Endless mode: 200 procedurally escalating waves, a surge every fifth, a boss every tenth, HP that keeps climbing — and a per-map deepest-wave record to chase.
- **Enemies that bend the rules.** Mistwalkers phase untargetable; Shardbacks are armored piñatas; the Veilqueen flies over everything you built on the ground and births gargoyles as she comes.

Plus the genre backbone: 4 tower families × 3 levels × 2 elite specializations, armor/magic-resist counterplay, soldier blocking with rally points, early wave calls, Meteor Storm and Reinforcements, and the star-funded **Royal Armory** meta-upgrade board (8 tracks, free respec).

### Controls

| Input | Action |
|---|---|
| Left click | Select / build / command |
| Left drag | Pan camera |
| Right / middle / Shift+drag | Orbit + tilt camera |
| Scroll / pinch | Zoom |
| Two-finger twist / vertical drag | Rotate / tilt (touch) |
| `WASD` / arrows | Pan |
| `Q` / `E` | Rotate |
| `T` / `G` | Tilt |
| `C` | Reset camera |
| `Space` | Call next wave |
| `H` | Select hero |
| `1` / `2` | Abilities |
| `F` | 1× / 2× speed |
| `P` / `Esc` | Pause |

## Architecture notes

- `src/voxel/` — voxel model system: models are named parts of colored boxes merged into single-draw-call geometries, with per-part rotation pivots for limb/turret animation.
- `src/game/` — fixed-timestep (60 Hz) simulation: lane paths with chamfered corners, A* hero pathfinding, enemy/soldier blocking, towers, traps, projectiles, particles, waves, surge lighting, levels.
- `src/ui/` — DOM-based HUD and screens.
- `src/core/` — renderer/camera rig, synthesized audio, validated save data.
- `reviews/` — adversarial code review and balance reports (GPT-5.x Codex) used throughout development.
- `tests/` — vitest suite covering level-data validity, wave timing, save parsing, economy math, and path math.
