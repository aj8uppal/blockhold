# Co-op pacing — 2026-09-09

The room previously started time while both browsers were still building their
opening scenes. Clients accumulated a simulation backlog, then switched directly
between normal, 1.25× and 2× catch-up speed. Commands also waited for 200ms turns.

Fresh capable clients now prepare their scenes before releasing the room clock,
use 100ms turns, and ease catch-up toward a maximum of 1.5× the selected speed.
The simulation remains 60Hz and commands remain server ordered. Legacy clients
negotiate the original cadence; no simulation ruleset changes in this patch.
Manual pauses and adopted solo saves stay paused; disconnected loading seats
cannot hold the readiness gate closed.

## Measurement

Two isolated Chromium/SwiftShader browsers, low quality, 960×600, Frostmere,
80ms CDP network latency, 20 hero orders split across 1× and 2× speed. Same
scenario against a detached copy of production commit `98cc937` and this patch.
Actions begin after both clients finish recovery and are unpaused.

| Observation | Production baseline | Patch |
| --- | ---: | ---: |
| Host order-to-application median | 332ms | 175ms |
| Host order-to-application p95 | 1,882ms | 578ms |
| Largest opening queued tick count, either seat | 162 | 61 |
| Largest later queued tick count, either seat | 114 | 22 |
| End-of-run state agreement | Exact | Exact |
| Browser exceptions | 0 | 0 |

These are diagnostic samples, not physical-phone FPS measurements or a guarantee
for every network. Software rendering makes the cold start unusually expensive.
The reduced queue and order delay are the useful comparisons; shader/GPU stalls
and a complete network outage can still interrupt play.

The reusable `scripts/coop-performance-check.mjs` enters through the actual lobby
and records order delay, queued ticks, frame work, and final state agreement to
`/tmp/blockhold-coop-performance.json`. Set `BLOCKHOLD_CHECK_URL` to a frontend
connected to a sync service. It creates a temporary room and uses no accounts.

Validation also includes synthetic ordered jitter/outage pacing, readiness over
real HTTP/SSE, the existing two-browser solo adoption / late join / disconnect /
reload / chat / return-to-solo check, and the full application and service suites.

A subsequent actual-lobby run also converged without errors, but under concurrent
machine load its median/p95 were 523/2,701ms. This underscores that the controlled
sample above does not establish a universal latency improvement: a CPU/GPU-bound
browser can still fall behind. Do not use these figures as a phone-performance
claim. The protocol regression checks establish cadence, readiness and exact
state agreement independently of software-rendering throughput.
