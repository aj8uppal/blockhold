# Your Hold — product and implementation contract

Status: core implemented and verified locally, September 13, 2026; production release in progress. Weapon origins, squad throws, fine voxel fire, and upgrade previews shipped independently in e559176.

## Product outcome

Your Hold becomes a persistent, personal voxel stronghold: earn visible trophies by playing, arrange what you own, inspect the story behind each reward, invite a friend to visit, and depart together for a battle. It must be immediately understandable on a phone and remain useful after campaign completion.

The current feature is a procedurally assembled menu backdrop. Campaign progress adds architecture, but placement is automatic, the new button only reveals the backdrop, and there is no dedicated collection/editor/visitor experience. Existing saves already hold most achievement evidence. The implementation preserves that evidence and gives it a playable interface.

## Approach and scope

Build one connected feature, delivered in dependency order: persistent collection → dedicated Hold view → customization → visits/sharing → co-op gathering place → integrated verification and deployment. These are implementation milestones, not separate unfinished previews.

Use the approved Blockhold dark/gold interface and actual lit voxel structures. Keep the battle button easy to find. Earned decorations are permanent cosmetics, with no new currency, maintenance timer, random loot box or battle-stat multiplier. Armory and Mythics continue to own combat progression.

Alignment: Fable 5.1 reviewed the implementation against the repository; see `your-hold-fable-review.md`. New rewards auto-fill free courtyard cells unless explicitly stored; customization never stops future growth. Layout geometry is cached by finite piece/style keys, never by layout. Use `visit` links (the existing `hold` parameter belongs to battle challenges). Daily-win evidence persists independently of the replaceable daily record.

The optional castle-siege extension has a separate design below. The user has been asked whether to include it in this build; the four core features can proceed independently while that choice is pending.

## Player experience

### First visit

“Your Hold” opens a dedicated screen, available even on a new account. A starter keep and a small set of freely placeable landscape pieces make the space useful immediately. A short, dismissible introduction explains: win battles to earn pieces; select a piece to inspect it; use Customize to move or place it. Show one achievable next reward with an action that opens the correct battle or hunt selection.

The scene occupies the center. A compact header offers Home, the Hold's name, and To battle. Primary controls are Collection, Customize, Share, and Co-op. Secondary theme/settings controls sit inside Customize. Desktop uses a narrow side inspector; phones use a compact bottom sheet. Nothing requires hovering or dragging an object precisely.

### Collection and objectives

Use stable reward IDs tied to actual saved accomplishments:

- Each campaign clear earns that battlefield's watchtower; each three-star clear earns its banner; each flawless clear earns its statue.
- Veteran accomplishments unlock gilded architecture and later prestige themes.
- Both tier-five branches won with a family earn its pennant, preserving the existing capstone collection semantics.
- The two boss hunts earn distinct boss trophies. Earned family mastery and hero paths receive distinct displays.
- Endless milestones earn escalating monuments based on saved records. Do not award from sandbox, temporary visitors or uncommitted in-battle state.
- Existing daily-win evidence earns a crystal display; do not claim historical daily streaks that the save never recorded.

Collection filters: All, Buildings, Trophies, Banners, Landscape. Cards show Owned/Placed/Locked and a short exact requirement. Inspection shows the name, what it commemorates, source/progress, and Place/Move/Remove where relevant. Locked items show progress and a relevant next action instead of a dead button. Earned counts are independent of displayed counts; removing a decoration never removes ownership.

New rewards appear in a bounded “New in your Hold” shelf on return from battle. Seen reward IDs merge by union across devices. A player with old progress receives all earned pieces on migration without replaying achievements.

### Customization

Use a finite courtyard grid around an immovable central keep. Buildings and trophy footprints occupy whole cells; the central approach remains clear. The island edge, keep footprint and occupied cells are invalid. A placement preview clearly shows legal/illegal positions and explains why placement is unavailable.

Interaction: choose a piece, tap a cell to preview, then Place. Tap an installed piece to select; tap it again or tap empty space to deselect. Move uses the same preview and confirmation flow. Rotate in quarter turns. Cancel restores the unchanged layout. Camera drag never places a piece. Pointer cancellation and a second finger cancel a pending tap. Keyboard users can select a cell with arrows, rotate, confirm, and cancel; all commands also have visible buttons.

Allow a small curated landscape inventory. Buildings and unique trophies are owned once; duplicates cannot be created by import, edit or merge. Unplaced rewards stay in storage. Provide Undo for edits, Restore arrangement with confirmation, and Discard/Save when leaving an edited layout. Preview theme/palette changes before saving. Name input is bounded plain text. Decorative choices never alter campaign eligibility or stats.

Themes start with Meadow and expand through existing progression into Winter, Ember and Eclipse. Each has a readable terrain/sky/light palette. Keep styles and banner colors use fixed palettes, preserving voxel readability. No downloaded assets are needed.

### Sharing and visits

Provide Share image and Copy visit link, with native sharing where available and an explicit copy/download fallback. Links describe a bounded public snapshot of the Hold; no account token, restore code, private account ID, full save, chat history or battle journal is included. The recipient sees “Visiting a shared Hold” and the snapshot date. Snapshot links remain stable and work without sign-in.

Visitors can orbit, inspect trophies and take a picture. They cannot edit, import rewards or overwrite their own Hold. “My Hold” and Home return safely to the recipient's state. Invalid/oversized/unsupported links show a useful error and a route home. Visiting never discards a continued battle.

The first version deliberately uses snapshots, not a searchable public directory, unsolicited invitations, comments, likes or rankings. Those would require account discovery and moderation infrastructure the game does not currently have.

### Co-op gathering place

Opening a room from the Hold displays the host's actual shared Hold behind a compact lobby. A friend arriving through its invitation sees that same snapshot and can inspect it while waiting. Show all four seats, connection state and the selected battle. The host controls map, mode, difficulty and shared hero; changes reset readiness. Each player explicitly readies up, then the host starts. No automatic launch while someone is inspecting or reconnecting.

Reuse the existing authenticated room seats and ordered transport. Cosmetic room data is bounded and separate from the adopted battle journal. Guests cannot replace the host's Hold. Preserve the existing paused adoption/rejoin flow for battles already in progress. Lobby membership and readiness must survive reconnect within a live room, and pending UI must show failures and re-enable controls. Leaving closes or exits only the appropriate seat/room. Room creation must not overwrite the user's saved solo battle.

The launch copy must remain honest about current room lifetime: an in-memory room is not persistent across a server restart. Durable live-room storage is a broader operational task, not something to imply through a new lobby design.

## Save and architecture contract

- Add a versioned optional Hold customization record to local and cloud save schemas. Saves lacking it receive a deterministic default arrangement derived from their existing rewards.
- Separate mutable layout/style choices from monotonic reward evidence and viewed-reward IDs. Layout has its own change timestamp so earning XP on an old device cannot overwrite a newer layout on another device.
- Merge the whole valid layout atomically; never union individual placements into collisions. Resolve timestamp ties deterministically. Bound timestamps, names, identifiers, placements, rotations, cells and public payload size.
- Server sanitization and frontend parsing share a renderer-free module. Validate ownership again against merged progress before rendering/editing. Unknown or malformed fields fall back safely.
- Explicit Save commits a validated draft and reports local storage failure without falsely claiming success. Keep the draft available for retry/export. Offline saves work; cloud sync uses the existing account connection with clear local/synced status.
- Import/export backups include Hold preferences. Older clients/server responses missing Hold fields must not erase them. Existing battle journals retain their balance and deserialize as before.
- Lazy-load Hold UI and its editor/scene assets. Reuse Three.js geometry/material caching and dispose all instance-owned resources/listeners on exit. Do not start a second animation loop or simulate a battle in the menu.
- Prefer a dedicated preview controller and pure catalog/layout modules over expanding the main Game class with editor concerns. Screen transitions own cleanup and camera restoration.
- The Hold cannot consume gameplay input; gameplay hotkeys cannot fire under Hold dialogs. Focus returns to the initiating control after closing a sheet. Escape cancels the innermost operation first.

## Implementation milestones and acceptance

1. **Data and ownership:** catalog, unlock progress, deterministic defaults, bounded layout validator, migration, independent layout merge and backup support. Old saves retain every earned reward; forged placements cannot grant ownership; concurrent cloud writes cannot combine invalid layouts.
2. **Hold scene and collection:** dedicated responsive view, authored trophy families, inspector, collection filters, next objectives and new-reward shelf. Every reward has a visible source and every supported account state renders without missing assets.
3. **Editor:** placement, rotation, movement, removal, undo, palettes/themes, naming, save/discard, reset, keyboard and touch controls. Invalid cells never commit; cancel changes nothing; reload reproduces the saved arrangement.
4. **Visits and sharing:** share image, bounded snapshot links, read-only visitor view and safe exit. Malformed content cannot inject markup or overwrite local progress; links work on a fresh device and under the production base path.
5. **Co-op:** shared host scene, readiness, host-only settings, clear connection/failure state and normal start/rejoin. Two real clients see the same Hold and settings; settings reset readiness; only a ready party starts; active saved battles remain recoverable.
6. **Release:** complete code review, targeted automated coverage, built-browser checks, cloud/API tests, production smoke verification and rollback notes. Deploy server changes before the matching UI, avoiding destructive schema migrations. Confirm no current battle ruleset bump is needed for purely cosmetic changes.

## Optional extension: defend your Hold

If included now, make this a contained PvE siege mode rather than an unrestricted map editor. A designed set of approaches leads to the central keep; cosmetics furnish the safe courtyard while defense plots and road cells remain validated. Select a siege contract, build using normal battle gold, and earn a permanent cosmetic crest for completion and harder records. Difficulty must not depend on how many cosmetic trophies are placed.

The extension must include authored wave sets/counters, previewable approaches, solo/co-op parity, retry/Hold-the-Line semantics, versioned battle save/reload, honest account rewards, and distinct siege records. The custom Hold is embedded as a cosmetic snapshot in its battle journal. It must never be reconstructed from mutable account preferences during replay. Existing campaign saves and map unlock counts stay unchanged.

Acceptance requires at least two evidenced Normal strategies on the siege approaches, equivalent deterministic co-op state, successful mid-wave save/recovery, and clear win/loss/retry transitions. This is additional gameplay scope, not a cosmetic checkbox or a renamed campaign map.

## Verification and practical limits

Automated checks cover unlock boundaries, migrations, duplicate/collision rejection, corrupt and oversized input, whole-layout merges, cloud round trips, storage failures, share-link isolation, render cleanup, mobile placement/deselection and two-client room flows. Browser checks use the production build at desktop, narrow portrait and landscape phone sizes, including rotation and reduced-motion preferences.

Record scene draw calls and geometry/memory before and after repeated open/edit/close cycles. Keep visible objects and public payloads strictly bounded. Test low-quality rendering and avoid continuous DOM work or unbounded effects. Run existing recovery/co-op regression tests, typechecking, lint, unit/API suites and bundle budgets before deploy.

Browser emulation does not establish physical iPhone thermals or Safari reliability. Report what was actually exercised. This feature's release criteria do not imply that all deferred public-launch infrastructure work—staging, backup restoration, durable rooms, identity activation or broad device coverage—has been completed.

## Implemented release and evidence

The core collection, automatic growth, 13 × 11 courtyard, editor, theme/roof/banner customization, read-only snapshot visits, postcard sharing and four-seat co-op gathering are implemented. The catalog contains 71 bounded pieces, including 59 earned displays. New account pieces grow automatically; explicit storage and placement remain separate from ownership. The editor has a persistent mobile Save/Cancel toolbar and preserves failed-write drafts for retry/export.

Fable 5.1's initial architecture review completed successfully. A requested follow-up code review was unavailable due to Claude's session limit; it is not counted as a completed review. Local code review and the tests below cover the implemented result.

Validation: 428 unit tests, 56 server/API tests, and 53 production-build browser tests passed. Four isolated browser contexts saw the same host Hold, changed readiness with settings, rejoined an authenticated seat after reload, and started the same battle with preview resources removed. Actual mobile touches select/deselect; dragging during placement leaves the pending cell unchanged. Real saved-battle data survives visits. Failed storage preserves the old save and leaves the draft open. Repeated scene visits maintain stable geometry counts. A fully unlocked Hold rendered with 104 draw calls; no extra renderer or animation loop was added. Portrait postcard export was rendered and visually checked.

Measured bundle: about 181.7 KiB application gzip and 333.1 KiB total JS. Limits are deliberately 184 / 336 KiB. Shared save/input integration contributes about 2.2 KiB; the editor and scene load on demand. Browser emulation is not a physical iPhone/Safari thermal certification.

Release order: build the sync-service image from the repository root using `server/Dockerfile`; deploy `registry.fly.io/blockhold-sync:your-hold-r17`; verify health, readiness, bounded snapshots and cloud round trips; then push the frontend and verify the production URL. There is no database migration or combat-ruleset change. Live co-op rooms reside in memory and are disconnected by the service restart.

Rollback: revert the frontend commit if necessary while retaining the Hold-aware save sanitizer on the backend. Do not roll the server back to an image that strips Hold fields: a subsequent save write could remove customization. Optional fields remain compatible with older frontend clients because the new server retains them atomically. Battle journals omit cosmetic Hold data.

The optional authored siege extension remains separately scoped and has not been implemented. No approval for that extra game mode has been inferred from silence. Durable rooms and the wider public-launch operational roadmap remain separate work.
