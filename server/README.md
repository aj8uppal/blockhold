# Blockhold cloud saves

A tiny sync service so a player's campaign survives a cleared cache, a private window, or a new phone.

No dependencies, no build step, no personal data.
Node 24 runs the TypeScript directly and ships SQLite in core, so the whole service is three files and a volume.

## What an account is

A random token the device holds, and a short link code the player can type on another device.

There is no sign-up, no email and no password.
Nothing here identifies a person, which is the point: there is no personal data to leak, and nothing to ask consent for.

- **Token** — 32 random bytes, kept in the device's `localStorage`. It is the credential.
- **Link code** — eight readable characters (`7JV5-3JM6`), from an alphabet with no vowels and no look-alikes, because it gets read aloud and typed by hand. It can be rotated if it is shared too widely.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | none | liveness, plus account count |
| `POST /v1/account` | none | create an account, carrying the device's existing progress |
| `POST /v1/link` | none | exchange a link code for that account's token |
| `GET /v1/save` | bearer | current progress and link code |
| `PUT /v1/save` | bearer | merge progress and return the result |
| `POST /v1/link/rotate` | bearer | issue a fresh link code |

## Merging, not overwriting

Cloud sync cannot be last-write-wins.
A player who clears Frostmere on their phone and then opens a laptop holding an older save would watch the clear disappear.

It also cannot be "take the maximum of everything", because some progress is allowed to go *down*: respeccing the Armory refunds tiers deliberately, and resurrecting them would silently overspend the player's stars.

So the save is split by how each field may move (`src/core/saveMerge.ts`):

- **monotonic** — stars, medals, records, unlocks. Higher value or set union always wins.
- **mutable** — the Armory loadout and last hero. The more recent write wins.
- **not synced** — sound and music settings describe the device, not the player.

The server runs the same validation the client does, so a hand-edited save cannot inject 99 stars, unlock every map, or store unbounded junk under an account.

## Running it locally

```bash
cd server
PORT=8099 DB_PATH=/tmp/blockhold.db node src/index.ts
curl localhost:8099/health
```

Point the game at it with a `.env.local` in the repo root:

```
VITE_SYNC_URL=http://localhost:8099
```

With `VITE_SYNC_URL` unset, cloud saves are disabled entirely and the game behaves exactly as it does today - local storage only.

## Deploying to Fly

The Dockerfile takes the repo root as its build context, because the merge rules are shared with the game.
Run these from the **repo root**, not from `server/`:

```bash
fly apps create blockhold-sync
fly volumes create blockhold_data --region iad --size 1 --app blockhold-sync
fly deploy --config server/fly.toml --dockerfile server/Dockerfile
```

Then point the deployed game at it by setting `VITE_SYNC_URL` in the Pages build,
and add the game's origin to `ALLOWED_ORIGINS` in `fly.toml` if it is served from anywhere else.

### One machine only

SQLite lives on a single volume, and a volume attaches to one machine at a time.
Do not scale this past one machine: two writers against one database file will corrupt it.
`auto_stop_machines = "suspend"` keeps it near zero cost while nobody is playing.

## What this deliberately does not do

- **No leaderboards.** Scores are client-reported, so a table would need replay validation to mean anything.
- **No accounts you can recover without the code.** Losing the device and the link code loses the save. That is the honest trade for collecting nothing; the export/import code in the game is the manual backup.
- **No blocking.** Every client call is best-effort. A player with no network, a blocked request or a service that is down gets exactly the game they had before, immediately.
