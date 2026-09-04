# 🏰 Blockhold

*Hold the line, block by block.*

A 3D voxel tower defense for the browser. Built with Three.js + TypeScript + Vite — no game engine: every 3D model is authored in code as colored voxel boxes, every sound is synthesized with WebAudio, and every UI symbol is a hand-written SVG. The 2D art (map cards, hero and boss portraits, key art) is generated with Midjourney and shipped as compressed webp.

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

Ten maps, each with its own theme, roster, and shape of pressure:

1. **Greenhollow** — the meadow road. Learn the trade.
2. **Frostmere Pass** — two frozen roads, one gate.
3. **The Emberwastes** — twin warpaths and the Juggernaut.
4. **Mistfen Crossing** — a drowned fen where Mistwalkers phase in and out of reach.
5. **The Shattered Crown** — three converging warpaths and the flying Veilqueen.
6. **Cinderwake Caldera** — three roads through the glassfire, hunted by phasing Riftwings.
7. **Veilscar Confluence** — three roads into the last wound, where Rift Heralds sing reinforcements into being and the Veil Regent walks.
8. **Sunderfall Terraces** — four roads at four heights. A tower shoots from its own footing, so a ridge taller than the ground you stand on blocks the shot: the mesa sees everything, the hollow behind it sees one road.
9. **Emberwind Reach** — a firestorm that *follows your hero*. Lead it into the horde; it burns him too, and towers caught inside it fire slower.
10. **Tidereach Causeway** — the widest board in the game, where the tide closes causeways and opens others mid-battle. Traffic reroutes to whatever is still standing, so the defense you paid for is not the one you keep.

Three difficulties per map, three stars per victory, and progress that is kept locally, backed up as a code you own, and optionally synced across devices. The last three are post-finale: their median wave pressure runs roughly twice the first seven's.

## What makes it Blockhold

- **Road traps.** Rune circles on the road itself hold a second build system: Spike Snares (burst + pin), Frost Runes (permanent slow zone), and Blast Charges (huge, slow to re-arm).
- **The shard economy.** Shardbacks, elites, and bosses drop Veilshards 💎. Spend them to **Overcharge** a tower (+60% attack speed) or **Ascend** a tier-4 tower with one of two permanent perks per family — an entire extra upgrade layer above the branch choice.
- **Veiltide surges.** Marked waves arrive empowered under a violet sky. The early-call bonus is still on the table — if you dare.
- **Resonance.** Same-family towers standing adjacent buff each other (+6% damage; barracks raise tougher soldiers). Placement geometry is a real decision.
- **A hero roster.** Sir Aldric the Bulwark (melee anchor, Valor Slam), Liora the Gale Warden (ranged, hits flyers, Piercing Volley), or Zephyra the Stormcaller (armor-ignoring bolts, Static Nova slow-burst). Heroes take move orders with real A* pathfinding, level from nearby kills, and respawn where they fell.
- **The Long Night.** Beat any map to unlock its Endless mode: 200 procedurally escalating waves, a surge every fifth, a boss every tenth, HP that keeps climbing — and a per-map deepest-wave record to chase.
- **Enemies that bend the rules.** Mistwalkers phase untargetable; Shardbacks are armored piñatas; the Veilqueen flies over everything you built on the ground and births gargoyles as she comes — and her Regent phases mid-march while singing heralds into being.
- **Six tower families.** Arrow, Mage, Cannon and Barracks, and two that change the question rather than the numbers: the **Beacon** never attacks but makes every tower in its light stronger, faster and longer-reaching, and its branches either reveal phasing enemies or tax the kills made in its glow; the **Ballista** shoots in a line and strikes everything along it, so the same foundation that was mediocre for archers is the best on the board when a road runs away from it.
- **Named elites.** Veteran and the Long Night roll affixes: Swift outruns a defense with no slow, Bulwark shrugs off arrows and dies to magic, Nullward is the reverse, and a Commander shields everything marching near it until you kill it. Each has its own colour, its own line in the enemy tip, and its own answer.
- **The Daily Hold.** One twelve-wave board a day, the same one for everyone in the world, built from the date itself. It ends in a spoiler-free result bar you can paste anywhere, a leaderboard placing, and a link that drops a friend onto the identical board.
- **Two other ways to fight.** The Bellfoundry puts every tower on a shared musical grid, where shots landing on the beat hit harder. The Three Watches fights one siege three times, your earlier defenses replaying beside you as translucent echoes.
- **Siege Tapes.** A finished run records itself as a vertical clip: the board assembling tower by tower under a slow orbit, captioned with the map and how far you held.
- **The Chronicle Hold.** Your save is a keep, rendered behind the menu and built out of what you have actually done.
- **Earthworks.** Raise a rampart to give a tower the high ground, or cut a trench to slow and expose whatever walks through it.
- **Branching capstones.** Each family's two tier-4 specializations lead to *different* tier-5 crowns, so the branch you pick decides the ending: Kingsreach or the Crownwing Aerie's five-target Crown Volley; The Unmaking or the Convergence Monolith's pulsing lightning runes; Emberthrone or the Faultline Arsenal's buried Seismic Charges; the Oathgate Citadel's Last Muster of retainers or the Stormhowl Warcamp, whose soldiers strike air.

Plus the genre backbone: 6 tower families × 3 levels × 2 elite specializations × 2 branch-locked capstones, armor/magic-resist counterplay, soldier blocking with rally points, early wave calls, Meteor Storm and Reinforcements, and the star-funded **Royal Armory** meta-upgrade board (8 tracks, free respec).

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
- `server/` — the optional sync service: cloud saves, the daily leaderboard, and the telemetry sink. The game is fully playable with it switched off.
- `tests/` — vitest suite covering level-data validity, wave timing, save parsing, economy math, and path math.
- `tests/smoke/` — Playwright tests that drive the built bundle in a real browser: the menu, a battle, a tower built by touch, and the daily's share link.

## Privacy

No analytics, no cookies, no advertising, and nothing that identifies a player.
Anonymous play data is **off** until it is switched on from the menu, and even
then it is a wave number and a tower name sent to this project's own service,
which stores a salted hash of the IP address and never the address itself. The
two typefaces are served from this origin, so no request leaves it uninvited.
