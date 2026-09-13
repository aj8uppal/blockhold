# Fable 5.1 architecture review

Read-only review completed September 13, 2026 using `claude-fable-5-1`.

Reading is done. I have what I need from the save, merge, cloud, co-op server, lobby, engine, voxel builder, capture, input, and budget code, so I'm writing the review now.

**Verification note.** Everything marked "observed" below was read directly from the repo at the paths given. Items marked "assumption" were not verified in code.

**1. Recommended end-to-end player loop and scope**

The loop should be: play a battle, return to the menu, see a short "new in your Hold" strip, open the Hold, find the new piece already standing, optionally rearrange it, share a picture or link, and start the next battle from the same screen. The critical property is that a player who never opens Customize still watches their Hold grow. The roadmap currently reads as though unplaced rewards wait in storage, which would make the Hold static for most players. Auto-placement must be the default and storage the explicit opt-out.

Scope for this build, in order: catalog and save record, dedicated Hold screen with collection and inspector, editor, share image plus stateless visit link, co-op lobby over the host's Hold. The siege extension should not be started until the user answers. It changes the grid contract, because road cells and defense plots would have to be reserved from day one. If the answer is yes later, reserving a fixed approach column now is cheap insurance. I recommend reserving the gate approach column regardless, since the roadmap already wants the central approach clear.

Observed: the current Hold is a single merged voxel model keyed by six counts in `src/game/hold.ts`, placed by `Game.showMenuBackdrop`, and the menu button only toggles a CSS class. Observed: reward evidence for every proposed trophy already exists in the save. Stars, medals, capstones, honors for hunts, hero paths and mastery, endless and freeplay records, and the daily result are all sanitized today in `src/core/saveMerge.ts`. No new monotonic achievement field is needed. The only new monotonic set is seen reward IDs.

**2. Critical corrections to the proposed plan, ranked**

1. **The visit link parameter collides with challenge links.** Observed: challenge links already use a `hold` query parameter, parsed by a regex in `src/game/share.ts`, and the boot path in `src/main.ts` routes any challenge before showing the menu. A visit link must use a different parameter, such as `visit`, and be routed before the challenge check. Otherwise a shared Hold link starts a Daily battle.

2. **Rebuilding the whole layout as one model will leak geometry.** Observed: the voxel geometry cache in `src/voxel/builder.ts` is keyed by string and never evicts. An editor that rebuilds a merged Hold model with a layout-derived key on every edit fills the cache without bound. Build one cached model per piece type and rotation, instance a group per placement, and position groups per cell. This also gives per-piece picking for free.

3. **Auto-fill semantics must be explicit in the record.** Store explicit placements, an explicit stored list, and treat every owned piece in neither list as auto-placed into free cells by a deterministic rule. Removal writes to the stored list. Editing never freezes future rewards out. The roadmap's "deterministic default arrangement derived from rewards" should be this rule, computed on read, never persisted as if the player had authored it.

4. **The catalog is too large for a courtyard grid if every star is a cell piece.** Sixteen maps times three campaign rewards plus veteran, families, hunts, hero paths, mastery and endless tiers is well over one hundred items. Make banners, gilding, pennants and the gate crystal keep attachments with fixed slots, as they are today, and make only towers, statues, monuments, hunt trophies and landscape grid pieces. Cap the grid at roughly ten by eight cells minus the keep footprint and approach column. Observed: the current model already caps towers at seven corner slots.

5. **Readiness needs a new room message.** Observed: the `ready` message in `server/src/coop.ts` removes a seat from the paced preparation set, and the client sends it after its scene compiles at game.ts:1462. Add a per-seat readiness flag on the server, a new send type for it, reset every seat's flag when a setup message arrives, and include it in hello and presence payloads so it survives reconnect. Leave the existing message alone.

6. **The bundle budget has no headroom, and save parsing lands in the app chunk.** Observed in `scripts/bundle-budget.mjs` and the stated measurements:

| Budget | Limit | Current |
|---|---|---|
| App chunk gzip | 180 KiB | 179.5 KiB |
| Total JS gzip | 320 KiB | 318.4 KiB |

Lazy chunks still count toward total. The record parser, merge additions and menu strip will land in the app chunk. Plan to raise both limits deliberately with a measured comment, and keep the catalog, scene controller, editor and sheets in one lazily loaded chunk. Observed precedent: modes, lobby, account and field guide already load on demand from `src/ui/screens.ts`.

7. **Keep the record out of frozen journals.** Observed: journal validation in `src/game/session.ts` runs the initial save through the shared parser, so once the parser accepts the record, every journal carries a copy. It is harmless for replay but bloats every autosave and co-op start payload. Delete the record when freezing the initial save. Assumption: the freeze is a JSON deep copy in game.ts, so this is one line.

8. **Do not build server-stored snapshots.** Encode the snapshot in the link itself. It works without sign-in, is maximally stable, needs no new table, retention or abuse handling, and the room already carries a setup payload for the co-op case. The cost is that a hand-made link can display trophies the sender never earned. With no directory, ranking or reward attached to visiting, that is acceptable for this release and should be stated in the design.

9. **Reuse existing themes rather than new palettes.** Observed: `src/game/terrain.ts` already exports eight theme color sets and the engine applies them with `applyTheme`. Map Meadow, Winter, Ember and Eclipse to forest, winter, ember and void. Unlock a theme by clearing any battlefield of that theme. That is one rule a player can predict.

10. **Simplify editor persistence.** A single-level undo, Done and Cancel, and one confirmation when leaving mid-edit is enough. Skip draft export.

**3. Architecture and save, cloud, visit and lobby choices**

Save record. Add an optional record to `SaveData` in `src/core/save.ts` with a version, its own change timestamp, a bounded name, a theme ID, placements, a stored list and a seen list. Bounds I recommend:

| Field | Bound |
|---|---|
| Placements | 64 entries of piece ID, column, row, quarter turn |
| Stored and seen IDs | 128 each, IDs matching a strict pattern |
| Name | 24 characters, letters, digits, space, hyphen, apostrophe |
| Serialized record | under 4 KiB |

Observed: the cloud save body limit is 64 KiB in `server/src/app.ts`, so this fits comfortably.

Merge. Observed: `mergeSaves` picks the newer copy for mutable fields by the whole-save timestamp, and `writeSave` stamps that timestamp on every progress write, including XP. A layout riding on that clock would lose to an XP-only write elsewhere, exactly as the roadmap fears. Merge the record as a unit by its own timestamp, union the seen list, and break ties by comparing the serialized strings. Treat a missing record as absent, not empty, so an old client or old server response never erases it. In `applyCloud`, keep the local record when the cloud copy lacks one.

Shared module. Put the record types, sanitizer and merge in one renderer-free file under `src/core`, import it from saveMerge, and add the file to the copy list in `server/Dockerfile`. Observed: the Dockerfile copies individual source files by path, so a new module that is not listed will crash the container at import time. Ownership is validated against merged progress at read time in the catalog module, never on the server, because the server has no catalog.

Catalog module. A pure file under `src/game` that maps a save to owned piece IDs with names, requirements and progress text, defines the grid and slots, and computes the effective layout. Unit test it heavily. It must not import Three.js so tests stay fast and the lobby can compute a preview without the scene.

Scene and screen. A Hold controller owns a group of per-placement instances, a selection ring, a ghost preview, camera framing and a dispose method. Observed: `Screens.show` clears the root without any teardown hook, and `disposeLevel` in game.ts already removes the current Hold group. Add a single teardown callback to the screens class, invoked at the top of every show, and register the controller's dispose there. Do not add editor state to the Game class.

Input. Observed: canvas clicks route to `handleClick`, which returns unless a battle is playing, and gameplay hotkeys are gated the same way. Add one delegate slot in `src/main.ts` for click, hover and keydown that the Hold controller installs and removes. Orbit, pan and pinch already flow through the engine and need no change. Observed: the shared sheet helper in `src/ui/dialog.ts` stops key propagation, traps focus and restores the opener, so every Hold sheet should go through it.

Visit links. Base64url of a compact byte array: version, day number, theme, name, placements. Route it in main.ts before the challenge check, never touch the saved session, render in visitor mode with editing disabled, and escape or drop any name that fails the pattern. Observed: the postcard capture and share sheet fallback already exist in `src/core/capture.ts` and can be reused for Share image.

Lobby. Put the host's snapshot on the setup payload. Observed: only seat zero may send setup or start, and the setup is broadcast and included in join and hello responses, so guests receive it and cannot replace it. Bound the snapshot on the server in the setup validator using the shared module. Render the lobby card over the Hold view in visitor mode. Assumption: starting a co-op battle from the lobby calls `startLevel`, which clears the solo journal. That is existing behavior, but the Hold's Co-op button should warn when a saved solo battle exists.

**4. Mobile selection and editor behavior**

- **Idle state.** Tap a piece to select it. A ring appears and a bottom sheet shows name, story, and Move, Rotate, Store buttons. Tap the same piece, or empty ground, or the sheet's close button to deselect. Tap another piece to switch.
- **Move and place.** Tap a cell to show a ghost tinted green or red with one line explaining a red cell. Tap another cell to move the ghost. Place commits, Cancel restores. The sheet collapses to a slim bar during this so the courtyard stays visible.
- **Drag never places.** Observed: main.ts already treats a touch that moves more than twelve pixels as a drag and a second finger as a cancel. Reuse that logic through the delegate.
- **Rotation** is a quarter turn button on the sheet, applied to the ghost before commit.
- **Sheet size** stays under forty percent of viewport height in portrait and becomes a side panel in landscape. Controls keep the existing minimum height from `src/ui/theme.css`.
- **Collection** opens as a full sheet with filter chips. Choosing an owned piece closes the sheet and enters placement. Locked cards show progress and a button that opens the right battlefield or hunt.
- **Keyboard** gets arrows for cell focus, R to rotate, Enter to confirm, Escape to cancel innermost, all mirrored by visible buttons.
- **Reduced motion** disables idle orbit. Observed: the engine exposes a reduced-motion flag.

**5. Launch acceptance tests and failure cases**

Unit, in vitest: every catalog ID is owned only by its rule across boundary saves; auto-fill is deterministic and never overlaps; placements of unowned or duplicate IDs are dropped; oversized, malformed and wrong-version records sanitize to a safe default; a record with the newer timestamp wins whole, ties resolve deterministically, seen lists union; a cloud copy without a record keeps the local one; backup export and import round-trip the record; a frozen journal contains no record; a visit payload encodes and decodes at the size cap and rejects anything larger.

Server, in the existing API suite: a save PUT from a client without a record preserves the stored one; a setup with an oversized snapshot is rejected; a guest sending setup gets the host-only refusal; a readiness flag resets on setup and reappears in hello after reconnect; the existing pacing ready message still finishes preparation.

Browser smoke, using the existing fixtures: the Hold opens on a fresh save with the starter keep; a save with all rewards renders every piece with no console errors; place, move, rotate, store and reload reproduce the arrangement; Cancel changes nothing; a failed local write shows an error and keeps the draft; a visit link on a fresh profile shows the visitor banner, and Home returns with the saved battle's Continue button intact; repeated open, edit and close cycles keep scene child count and geometry count flat; narrow portrait and landscape layouts keep the battle button visible.

Failure cases to state in copy: the room ended because the server restarted; the link is not a Blockhold Hold; storage is full so the arrangement was not saved; the ally is reconnecting so the battle cannot start yet.

**6. Implementation order**

1. Shared record module, save and cloud integration, Dockerfile copy, server and unit tests. Deploy the server first.
2. Catalog and layout module with tests. Keep the menu summary reading from a small function so the heavy catalog stays lazy.
3. Hold screen chunk: controller, per-piece instancing, teardown hook, input delegate, collection and inspector sheets, new-reward strip on the menu.
4. Editor: ghost, placement, move, rotate, store, undo, theme and name, Done and Cancel.
5. Share image reuse and visit links with visitor mode and boot routing.
6. Co-op: server readiness flag and bounded setup snapshot, lobby over the host's Hold, start gating.
7. Release: measured budget raise, smoke suites at three viewports, cloud round trip on production, rollback note that the record is optional so an older client build remains safe.

This review is the deliverable for the alignment step. The implementation request remains open, and nothing above has been built.

## Implementation decisions

Adopt auto-fill with explicit storage, stable per-piece geometry, independent layout timestamps, stateless `visit` links, and server-owned lobby readiness. Corrections: there are ten authored campaign maps (sixteen is a save-validation ceiling); dailyBest is replaceable, so persist daily-win reward evidence separately. Use a 13 × 11 courtyard with bounded footprints, enough for the actual catalog. Four co-op seats are supported. Preserve an export path for a failed local write. Cosmetic visit links are not verified achievement credentials. Keep cosmetics out of battle journals. Siege gameplay awaits the scope response.
