# Blockhold cloud saves

A tiny sync service so a player's campaign survives a cleared cache, a private window, or a new phone.
It also carries anonymous telemetry and the daily leaderboard, because both need somewhere to write and this is the only server the game has.

No dependencies, no build step, no personal data.
Node 24 runs the TypeScript directly and ships SQLite in core, so the whole service is a handful of files and a volume.

## What an account is

A random token the device holds, and a short link code the player can type on another device.

There is no sign-up, no email and no password.
Nothing here identifies a person, which is the point: there is no personal data to leak, and nothing to ask consent for.

- **Token** — 32 random bytes, kept in the device's `localStorage`. It is the credential.
- **Link code** — eight readable characters (`7JV5-3JM6`), from an alphabet with no vowels and no look-alikes, because it gets read aloud and typed by hand. It can be rotated if it is shared too widely.

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /health` | none | liveness, and nothing else |
| `POST /v1/account` | none | create an account, carrying the device's existing progress |
| `POST /v1/link` | none | exchange a link code for that account's token |
| `GET /v1/save` | bearer | current progress and link code |
| `PUT /v1/save` | bearer | merge progress and return the result |
| `POST /v1/link/rotate` | bearer | issue a fresh link code |
| `POST /v1/events` | none | anonymous telemetry, up to 64 events a request |
| `GET /v1/stats` | `STATS_TOKEN` | aggregate counts for the last 7 days |
| `POST /v1/daily/:day/score` | bearer | submit a daily result, best-of per account |
| `GET /v1/daily/:day` | optional bearer | the top 50, plus your own placing if you send a token |

`GET /health` used to return the account count.
It does not any more: that is a business metric sitting on an unauthenticated endpoint, readable by anyone who thinks to curl it, and it tells a player nothing.

### Rate limits

Every request passes a coarse in-memory ceiling of **60 a minute per IP**, which exists to stop a client that is spinning.
On top of that, the calls that cost something to absorb have their own budgets, counted **in SQLite rather than in memory**:

| Bucket | Limit | Why |
|---|---|---|
| `POST /v1/account` | 5 / hour | an account is a row that lives for 180 days |
| `POST /v1/events` | 20 / hour | unauthenticated, so it gets the least trust; 64 events a request is still 1,280 events an hour |
| `POST /v1/daily/:day/score` | 30 / hour | cheap, but it writes a name to a public list, and a run takes minutes to play |

The persistence is the point.
`auto_stop_machines = "suspend"` parks this process whenever nobody is playing, so an in-memory budget would hand a scripted client a fresh allowance every time Fly put it to sleep - and that interval is easy to learn.
Counters live in a `rate_limits` table keyed by a salted hash of the address, and the sweep drops rows whose window closed over a day ago.

## Telemetry

`POST /v1/events` takes `{ "events": [ { "type": "run_end", "wave": 12 }, ... ] }`, at most 64 an request inside the usual 64 KB body cap.
Each event is a type and a flat bag of scalars; nested objects and arrays are dropped rather than stored, because an unauthenticated endpoint that accepts arbitrary structure is free unbounded storage for whoever finds it.

A malformed event is dropped, not answered with a 400.
A telemetry client that gets an error retries, and a retry loop over one permanently bad event is a worse outage than a missing datapoint.
The response says what happened: `{ "accepted": 3, "rejected": 1 }`.

**No IP address is ever written to disk.** Events store a salted SHA-256 of the address truncated to 128 bits.
The salt is 32 random bytes generated on first run and kept in the database's own `meta` table, so it is stable across restarts (an unstable salt would reset the rate limits and inflate the session counts) and a leaked copy of the `events` table alone reveals nothing.
Truncation matters as much as salting: the IPv4 space is small enough to enumerate, so an unsalted hash would be trivially reversible.

`GET /v1/stats` is the dashboard: events by type, sessions a day, and a histogram of `run_end` wave values, all for the last 7 days.
It returns **counts only** - never a payload, never a hash, never a single event - so a leaked stats token cannot become a leak of what any one player did.
It requires `Authorization: Bearer $STATS_TOKEN`, and **with `STATS_TOKEN` unset it answers 404**, exactly like a route that does not exist.
A forgotten deploy therefore cannot quietly publish the dashboard, and cannot advertise that there is one.

## The daily leaderboard

`POST /v1/daily/:day/score` keeps one row per account per day - the player's **best** result, where best means the higher score and a higher wave breaks a tie.
A worse run is discarded rather than stored, so playing again can never cost a player their placing.
Submissions carry a `ruleset` that must match the server's `RULESET_VERSION` (currently `2`); a mismatch is a **409**, because a stale client's numbers are not comparable with today's and quietly mixing them in would make the board mean nothing.

`GET /v1/daily/:day` returns the top 50 ordered by score, then wave, then submission time.
Sorting by time last means two identical results keep distinct ranks and the earlier one places higher, so the list and the rank a player is told can never disagree.
Send a token and the response also carries `you`, so a player outside the top 50 can still see where they stand.

### The contract

```
POST /v1/daily/:day/score      Authorization: Bearer <account token>
  { seed, ruleset, wave, lives, won, score, nickname?, replay? }
  -> 200 { rank, total,
           best: { day, nickname, seed, ruleset, wave, lives, won, score } }
  -> 400 bad day / bad ruleset / bad score      409 { error, expected, got }
  -> 401 unknown account                        413 replay too large
  -> 429 slow down

GET /v1/daily/:day             Authorization optional
  -> 200 { day, total,
           top: [ { rank, nickname, wave, score, won } ],     // at most 50
           you?: { rank, wave, score, nickname } }            // only with a token

POST /v1/events                no auth
  { events: [ { type, session?, ...scalars } ] }              // at most 64
  -> 202 { accepted, rejected }
  -> 400 events must be an array / at most 64 events per request
  -> 429 slow down

GET /v1/stats                  Authorization: Bearer $STATS_TOKEN
  -> 200 { ok, days, totalEvents,
           byType: [ { type, count } ],
           sessionsPerDay: [ { day, sessions } ],             // day is YYYY-MM-DD
           runEndWaves: [ { wave, count } ] }
  -> 404 when the token is wrong or STATS_TOKEN is unset
```

`nickname` is sanitized rather than rejected: everything outside `[A-Za-z0-9 _-]` is stripped, the result is trimmed to 16 characters, and an empty result becomes `Anonymous`.
A player who types an emoji should still get on the board, just without it.

`replay` is any JSON value, stored as text and capped at 32 KB.
Nothing reads it yet.

### What the leaderboard actually guarantees

**Scores are plausibility-checked, not verified.**
The server bounds every number (wave 0-999, lives 0-99, score 0-99,999,999), requires a matching ruleset, sanitizes the nickname, and stores the submitted replay verbatim.
It does **not** re-simulate the run, so a determined client can still report a score it did not earn.
This is a filter against casual tampering and a record for later - not an anti-cheat guarantee, and the board should be read that way.

The real check is re-simulation: replay the stored inputs against the day's seed and confirm the reported wave and score fall out.
That needs the simulation to run headless, without the renderer, which it currently cannot.
Keeping the replay now is what makes it possible to go back and verify - or quietly drop - every score already on the board once it can.

## Retention

Nothing here is kept for its own sake.
A sweep runs at startup and every six hours (a daily timer on a process that is usually suspended would simply never fire) and deletes:

- **events older than 90 days** - nothing the dashboard asks is answered by older data
- **accounts with no save write in 180 days** - a wiped device or a player who moved on; keeping them forever turns a service that stores almost nothing into one that stores everything, slowly
- **leaderboard rows belonging to a collected account** - a name on a public board with no account behind it can never be corrected or removed on request
- **rate limit counters whose window closed over a day ago**

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

Set `STATS_TOKEN` too if you want the dashboard; without it `/v1/stats` is a 404.

The tests need no dependencies either - Node's own runner, against a throwaway database on an ephemeral port:

```bash
cd server
npm test
npm run typecheck
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

The stats token is a credential, so it goes in secrets rather than in `fly.toml`:

```bash
fly secrets set STATS_TOKEN="$(openssl rand -base64 32)" --app blockhold-sync
```

Leave it unset and `/v1/stats` stays a 404.

### One machine only

SQLite lives on a single volume, and a volume attaches to one machine at a time.
Do not scale this past one machine: two writers against one database file will corrupt it.
`auto_stop_machines = "suspend"` keeps it near zero cost while nobody is playing.

This constraint is what makes the backup story matter.
There is no replica to fail over to, so a lost or corrupted volume is a lost dataset unless something copied it somewhere else first.

### Backups

Two layers, because they fail differently.

**Volume snapshots** are the floor, and they are already on.
Fly snapshots the volume daily; `snapshot_retention = 14` in `fly.toml` keeps them for two weeks rather than the five-day default, because the failure being guarded against is a corruption nobody notices until they next look, and five days can easily roll past the last good copy.

```bash
fly volumes list --app blockhold-sync
fly volumes snapshots list vol_xxxxxxxx            # confirm they exist, don't assume
fly volumes snapshots create vol_xxxxxxxx          # before a risky migration
fly volumes fork vol_xxxxxxxx --snapshot-id vs_yyy --app blockhold-sync
```

Restoring forks the snapshot into a *new* volume, so the recovery is: fork, stop the machine, attach the fork, start.
Snapshots are crash-consistent copies of a live WAL database.
SQLite is designed to recover from exactly that, but a snapshot is still a whole-day granularity and it lives on the same provider as the thing it is backing up.

**Litestream** is the layer that fixes both of those.
It streams the WAL to object storage continuously, giving point-in-time recovery to within seconds and putting the copy somewhere Fly is not.
It runs as a second process in the same container, wrapping the server:

`server/litestream.yml`

```yaml
dbs:
  - path: /data/blockhold.db
    replicas:
      - type: s3
        bucket: blockhold-backups
        path: blockhold.db
        region: us-east-1
        retention: 720h              # 30 days
        snapshot-interval: 24h
        validation-interval: 12h
```

Add to the `Dockerfile`:

```dockerfile
COPY --from=litestream/litestream:0.3 /usr/local/bin/litestream /usr/local/bin/litestream
COPY server/litestream.yml /etc/litestream.yml
CMD ["litestream", "replicate", "-config", "/etc/litestream.yml", "-exec", "node server/src/index.ts"]
```

and set the credentials as secrets:

```bash
fly secrets set LITESTREAM_ACCESS_KEY_ID=... LITESTREAM_SECRET_ACCESS_KEY=... --app blockhold-sync
```

Restore with `litestream restore -o /data/blockhold.db s3://blockhold-backups/blockhold.db`.

Two caveats worth writing down rather than rediscovering:

- **Litestream also assumes one writer.** It is not a substitute for the single-machine rule; it makes that rule survivable, not optional.
- **A backup nobody has restored is a hypothesis.** Fork a snapshot into a scratch volume once, run the server against it, and confirm a save comes back. Until that has been done, the honest description of this section is "intended", not "working".

## What this deliberately does not do

- **No verified leaderboard.** There is a board, but see above: scores are bounded and stored with their replay, not re-simulated. The claim it makes is deliberately small.
- **No accounts you can recover without the code.** Losing the device and the link code loses the save. That is the honest trade for collecting nothing; the export/import code in the game is the manual backup.
- **No blocking.** Every client call is best-effort. A player with no network, a blocked request or a service that is down gets exactly the game they had before, immediately.
