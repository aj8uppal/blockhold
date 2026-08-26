# What Blockhold is missing

An adversarial design review by Claude (Opus 5) and Codex (GPT-5.6-sol), three rounds, 2026-08-25.
Each side wrote an independent first pass without seeing the other's, then attacked it.
Every claim below was verified against the code or measured in a running build.

## The verdict

Blockhold is an excellent 2011 game.

Feature-for-feature it is at rough Kingdom Rush parity - 153 authored waves, seven maps, four tower families with tiers, branches and capstones, heroes, traps, a shard economy, surges, hazards, endless, a meta shop, medals, scores - built by one person.
That is the achievement and it is also the problem.
Nothing in it answers "why this, why now, why would I send it to someone."

Its three distinguishing facts - voxel art, browser-native, everything authored in code - are production facts, not player-facing hooks.
The menu says so out loud: "A voxel tower defense - Built for the browser" is a spec sheet, not a promise.

The single sharpest finding, which both reviewers reached independently:

> **The game is called Blockhold, is made of blocks, and blocks are not a mechanic.**
> Re-skin every model as low-poly fantasy and not one line of game logic changes.
> Nothing breaks, stacks, falls, or gets rearranged. The one asset the game uniquely owns is the one it never spends.

What is missing sorts into three layers, and they are in dependency order.
A reason to look at it, a reason to keep playing, a reason to pass it on.
Most of the temptation is to build the third one first. That would be a mistake.

## Layer 1 - a reason to look at it

### The game is unreadable on the device it targets

Measured, not guessed. At 932x430 (iPhone Pro Max landscape) and again at 800x450:

- enemies render 8-14 px tall; a Husk, a Sprinter and a Shieldbearer are indistinguishable
- 45 enemies read as a single gray smudge
- towers are ~25-30 px, so the tier-2/3 model flourishes that were built are invisible
- `resetView()` deliberately frames the whole island, with a comment saying so (`engine.ts:321`)

### The mobile information blackout

The most actionable defect found. On touch, the player cannot see incoming-wave composition or any tower's stats and range before spending gold.

- `nextWavePreview()` has exactly one caller: `hud.ts:147`, inside `waveBtn.onmouseenter`
- `showBuildTooltip()` has exactly one caller: `hud.ts:340`, inside `btn.onmouseenter`
- `hud.ts` contains zero `pointerdown` / `pointerenter` / `touchstart` handlers
- the same buttons carry `onclick` handlers that commit the action (`hud.ts:144`, `hud.ts:337`)

This is unreachable, not merely awkward: hover-without-commit does not exist on touch.
A tap on the wave button calls the wave; a tap on a build button buys the tower.
On the platform the game forces into landscape and ships as a PWA, you buy blind and call blind.
Those are the two core information affordances of the genre.

### Combat does not feel good at the millisecond level

The vocabulary is rich - 13 particle emitters, screen shake, damage flash.
The application at the moment of impact is not.

- **A real animation bug.** Melee damage lands, then `strikeT = 1` (`units.ts:467`). The visible pose is `sin(strikeT * PI)`, which is **zero** at that instant. Decaying at 4.5/s (`units.ts:316`), the swing visibly peaks **111 ms after** the health already dropped. The player sees damage, then the weapon. Same defect in `Soldier` (`units.ts:812`, `units.ts:851`).
- **The most frequent event has the least feedback.** Shake fires for splash, meteors, traps, hazards and leaks, but a plain arrow killing a plain Husk produces no camera response at all.
- **Damage numbers exist only on crits** (`units.ts:229`), so the player's main readout of their own effectiveness is an 8 px HP bar.
- **Orphaned projectiles vanish.** Impact paths require `target.alive`, so an arrow whose target dies first disappears mid-flight with no contact (`projectiles.ts:66-75`).
- **Hit sounds are suppressed by name within 45 ms** (`audio.ts:54-62`), so at swarm density impacts are erased by wall-clock coincidence rather than importance.
- **Feedback decoheres at 2x.** Death animations and particles run inside the accelerated sim; CSS floaters stay 1.05 s and WebAudio stays real-time.

### Every enemy dies the same way, and nothing shatters

`units.ts:353-360`: rotate back 81 degrees, small hop, scale to zero over 0.7 s.
Identical for a Husk, a Juggernaut and the Veil Regent.

A game built entirely out of blocks has enemies that **evaporate**.
Voxel games are culturally known for exactly one thing at the moment of destruction, and Blockhold does not do it.

### There is performance headroom the design is not spending

Measured: a full tower board plus 220 simultaneous enemies at hpScale 40 held **119 avg FPS with a 13 ms worst frame**.
(Fast Mac, headless Chrome - an upper bound, not a low-end Android number.)

The austere look is design restraint, not a performance budget.
Every spectacle recommendation in this document is affordable today.
Bundle size is likewise a non-issue: 186 KB gzip, 155 KB brotli.

## Layer 2 - a reason to keep playing

### 34 waves before the first boss

`greenhollow` (16 waves) and `frostmere` (18 waves) contain no boss at all.
The first is the Juggernaut in `emberwastes`.
A new player spends their entire first two maps without seeing the game's strongest authored moment.

### The cold start spends attention on paperwork

Menu, then To Battle, then a level select showing **six padlocks**, then a modal asking for one of three heroes with stat blocks and one of three difficulties, then battle.
Four screens and two committing decisions before a single enemy appears.
Choice before experience is homework, and a link-shared web game has about ten seconds.

### The meta is a closed arithmetic loop

The Armory costs exactly 21 stars. The campaign yields exactly 21 stars.
Once complete there is nothing left to want, and the free respec becomes meaningless.
Its eight tracks are almost all scalar (`+8% damage per tier`). Nobody has ever told a friend about +8% damage.

### The hero has no active input

Hero signature abilities auto-cast - `hero.ts:177` is literally commented "auto-cast shockwave when engaged", and `game.ts` has no ability-cast path at all.
The HUD's "1" and "2" are Meteor Storm and Reinforcements, which are global spells.
The game's identity anchor - a named, portrait-illustrated champion - is a unit you relocate.

### No run-to-run variance

Every Greenhollow run is the same 16 waves in the same order.
Endless is quantity inflation: the enemy pool tops out around wave 17 and escalation becomes larger counts plus a few percent HP.

### Two README overclaims

- "200 procedurally escalating waves" vs `generateEndlessWaves(level, count = 999)` (`levels.ts:375`)
- "elite-affix enemies" vs a runtime elite that is only 1.9x HP, 1.15x scale and a tint (`units.ts:147-163`). There are no affix behaviors.

### Progress is one cache-clear from gone

`writeSave()` silently swallows quota failure (`save.ts:75`).
There is no cloud save, no export/import, no persistent-storage request, and no mid-battle persistence - closing the tab at wave 24 of 28 destroys the run.
No telemetry of any kind exists, so there is no way to learn which wave players actually quit on.

## Layer 3 - a reason to pass it on

### Nothing about a run is transmissible

Both reviewers independently made this their number one gap.
A finished run dies in `localStorage`. There is no seed, replay, ghost, challenge link, daily, leaderboard, or result card.
For a browser game this is the distribution model, and it is absent.

### And it is blocked by non-determinism

`src/game/` contains 43 `Math.random()` calls, several gameplay-affecting: elite roll (`game.ts:208`), crit (`towers.ts:444`), poison (`towers.ts:448`), Echo Casting (`towers.ts:502`), stun rolls (`projectiles.ts:170`, `projectiles.ts:230`), hero damage variance (`hero.ts:185`).

Fixed-timestep is necessary but not sufficient.
Two players running the same seed today get different outcomes, so a daily is meaningless and a replay cannot be verified.
Routing gameplay rolls through one seeded PRNG - leaving particles on `Math.random` - is the least glamorous item in this document and the one that unlocks the most.
It also needs a ruleset/content version, or a balance patch will silently change old results.

## The plan, in dependency order

Both reviewers initially ranked the shareable object near the top.
Both, independently, reordered after arguing the opposite case.
The reason: **a share button on a game nobody wants to share is worthless.**
A Daily shipped onto a weak first five minutes does not create retention; it measures churn faster and burns the one-time attention of everyone who clicks.

1. **Fix the mobile information blackout and the clipped level grid.** Smallest change, largest ratio. The game is currently unplayable-as-designed on its target platform.
2. **Seed all gameplay randomness; add ruleset versioning and replay checksum tests.** Pure enabler. Unblocks dailies, replays, async modes, and reproducible balance simulation.
3. **Rebuild the first five minutes.** Cold-open straight into a battle on Aldric/Normal. Teach at the moment of need. Move a real boss into the first map. Reveal heroes, difficulty and the Armory afterwards.
4. **Spend the performance headroom on contact.** Fix the 111 ms melee phase bug. Tiered impact budget rather than global hitstop: light hits get a pose hold and directional spark; heavy hits get 35-60 ms presentational slowdown; boss kills get real time dilation. Delay reward feedback ~120 ms so the kill reads before the payment. Priority-based audio budget so bosses and crits survive a swarm.
5. **Death by disassembly.** Enemies come apart into their constituent blocks, tinted by the damage type that killed them, with heavier hits scattering harder. This is the missing kill feedback, the missing spectacle ceiling and the missing board-transformation in one change - and it is the moment "voxel" would finally do work. The geometry is already authored as named parts of colored boxes.
6. **Replace free orbit with a directed battle camera.** Keep 3D; depth is what makes destruction and elevation legible. But authored framing, close enough to read, with discipline: reserve direction for first entry, bosses, phase changes and defeat. Never steal control during placement.
7. **Deepen expression without adding breadth.** Targeting policies (First/Last/Strongest/Weakest) are nearly free - targeting is a single comparator over `e.remaining` (`towers.ts:322-327`). Make hero signatures active. Replace same-family resonance with cross-family reactions. Convert Armory tracks from numbers to verbs.
8. **Protect the session.** Wave-boundary resume, lifecycle auto-pause, verified writes, persistent-storage request, export/import.
9. **Instrument.** Minimal funnel and run telemetry. Without it every further redesign is opinion.
10. **Then ship the transmissible object** - a short deterministic Daily with a result block and a challenge link - onto a game that has become worth sharing.
11. **Run one portal pilot.** CrazyGames lists 800x450 as an important mobile iframe size and prohibits custom in-game fullscreen buttons in its Basic requirements; Blockhold ships a custom fullscreen control (`main.ts:13`). Immediate-gameplay is a Full Implementation requirement, not Basic.

## The swings

The best of the ideas from both sides, after mutual attack.

**Death by disassembly.** Above. Highest ratio of impact to effort in this document.

**The Chronicle Hold.** The save file becomes a physical fortress shown on every boot.
Victories award blocks, banners, statues and captured relics; the highest-kill towers of finished runs retire into its walls carrying their names and kill counts.
The menu currently shows the latest unlocked battlefield (`game.ts:297-305`) - replace it with the player's own Hold.
A late save should differ from a fresh one in silhouette, height, scars and lighting.
This is the screenshot swing, and it makes the save file a place rather than a number.

**Block-edited battlefields, the version that survives contact.**
True mazing is not cheap here and the first draft of this review was wrong to claim it was.
Enemies never pathfind: they ride a distance-parameterized rail (`this.dist += speed * dt`, `units.ts:501`), and `remaining = lane.length - dist` is the sort key for all targeting, leak detection and previews.
Replacing that cascades everywhere and invalidates the balance of all 153 authored waves.
The version that works keeps the rail and lets block edits change what it **costs**: raise a block for an elevated tower foundation, dig a trench for a slow segment, collapse a span so the lane diverts to a pre-authored alternate branch.
Prototype on one purpose-built short map, not the campaign.

**The Three Watches.** A short siege repeats three times, and on each repetition the player's prior defense replays as translucent temporal echoes while they build a new layer.
By the third watch, three versions of your own plan fight together.
Turns replay into a single-player mechanic. Needs the deterministic command log anyway.

**The Bellfoundry.** Towers fire on a shared musical grid - arrows on eighths, cannons on downbeats, mages on offbeats - against enemies whose warding opens on particular beats.
The battle composes its own score. Strategic, not reflex-based. Separate mode.

**Siege Tapes.** After a run, generate an 8-12 second vertical time-lapse of the board growing from empty plots to final defense, ending on the decisive leak or kill.
Export a local WebM via a 9:16 canvas and `MediaRecorder`.
No ranking service, no backend - the video is the artifact, and it is the thing that actually travels.

**Adaptive audio as a signature rather than a liability.**
The score today is one 4.8-second four-chord loop with randomly chosen pentatonic notes and a 40% chance of skipping each (`audio.ts:213-235`), scheduled with `setTimeout` rather than an audio-clock transport.
Synthesized-only is not the weakness; unauthored procedural is.
One fixed four-note Blockhold motif shared by title, wave horn, boss entrance, victory and defeat, plus layered stems driven by wave pressure, surge and boss state - the architecture is unusually well suited to it, since combat already runs on a fixed simulation with explicit wave phases.

## Where we did not fully agree

**The art.** Codex would stop using the Midjourney paintings as the product face and render voxel dioramas for cards, portraits and key art, arguing the paintings sell monumental painterly fantasy while the game delivers tiny code-built toys, and that "raise the 3D to meet it" is not a bounded fix.
I argued the paintings are the best-looking asset the game owns and the 3D should rise instead.
The synthesis both positions actually support: the directed camera in item 6 is what makes close-up voxel detail visible in the first place, so author voxel dioramas for the product face, keep the paintings as secondary lore art, and let the two stop contradicting each other.

**Withdrawn during review.** Codex proposed a boss that climbs out of the canvas and attacks the HTML interface, dragging HUD buttons around. It withdrew the idea itself: it breaks on touch, fights the PWA work, and removes the player's tools exactly when they need them. Fun, not annoying, is the standing bar.

## What this review cannot tell you

Both reviewers agreed the ground a code-and-design review can cover is now covered, and agreed on where the boundary is.

Still unknown, and not knowable from the repository:

- whether strangers actually enjoy the first five minutes - needs observed sessions on real phones
- real funnel, retention, and which wave people quit on - needs shipped telemetry
- low-end Android GPU, memory, battery and portal-iframe behavior - the 119 FPS figure is a fast-machine upper bound
- full economy and difficulty validation - reachable in principle, but currently blocked by the determinism defect this review identified

Another static review would mostly rearrange priorities.
The next thing that produces new evidence is an instrumented, polished vertical slice put in front of real players on real devices.
