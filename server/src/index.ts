import { Store } from './db.ts'
import { configFromEnv, createApp } from './app.ts'

/**
 * Process entry point: read the environment, open the database, listen.
 *
 * Everything the service actually does lives in app.ts, so the tests can run
 * the same routing against a temporary database without starting this file.
 */

const PORT = Number(process.env.PORT ?? 8080)
const DB_PATH = process.env.DB_PATH ?? './blockhold.db'

/**
 * How often the retention sweep runs.
 *
 * Six hours rather than a daily timer, because this machine suspends whenever
 * nobody is playing: a once-a-day timer on a process that is rarely awake for
 * a full day would simply never fire. The sweep also runs once at startup for
 * the same reason.
 */
const SWEEP_INTERVAL = 6 * 3_600_000

const store = new Store(DB_PATH)
const server = createApp(store, configFromEnv())

function sweep(): void {
  try {
    const n = store.sweep()
    if (n.events || n.accounts || n.limits) {
      console.log(`[blockhold-sync] swept ${n.events} events, ${n.accounts} accounts, ${n.limits} limits`)
    }
  } catch (e) {
    // a failed sweep is not a reason to stop serving players
    console.error('[blockhold-sync] sweep failed', e)
  }
}

server.listen(PORT, () => {
  console.log(`[blockhold-sync] listening on ${PORT}`)
  sweep()
})

// unref so the timer cannot hold the process open through a shutdown
setInterval(sweep, SWEEP_INTERVAL).unref()

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => { store.close(); process.exit(0) })
  })
}
