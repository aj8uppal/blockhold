# Per-day link previews

GitHub Pages serves one static `index.html` to everybody, so every shared
Blockhold link previews as the same key art and the same title. A Daily result
posted into a group chat therefore looks identical to the homepage, which wastes
the one moment a link has to earn a click.

This Worker sits in front of Pages and rewrites the preview tags per link. It
changes nothing a player sees: the HTML body, the bundle, and every asset are
proxied through untouched, and the game still reads `?hold=` exactly as before.

## What it does

- `?hold=<seed>` links get the Daily's own title and the map that seed actually
  rotates to: *"Blockhold Daily #34 — Frostmere Pass"*.
- `?hold=<seed>&m=<map>&e=1` links get that map's name and say it is a Long
  Night challenge.
- Everything else is served exactly as Pages sent it.

The map rotation is `seed % levels.length`, mirrored from `dailyLevel()` in
`src/game/levels.ts`. **If the level list changes, `LEVELS` here changes too**,
or the preview will name a different board than the link opens.

## What it deliberately does not do

It does not generate a per-day *image*. That needs a rendering pipeline in the
Worker, and the honest cost/benefit says the title carries most of the value:
the image can stay the key art while the text does the work. Serving one static
image per map is the cheap next step if you want it.

## Deploy

Needs a Cloudflare account. The Worker can run either on a `workers.dev`
subdomain or on a custom domain you have in Cloudflare.

```bash
npm i -g wrangler
wrangler login
cd worker
wrangler deploy
```

`wrangler deploy` prints the URL it published to. That URL becomes the game's
address: it proxies Pages, so both keep working, but only links to the Worker
get the better previews.

If you put it on a custom domain, add a `routes` entry to `wrangler.toml` and
update `og:url` in `index.html` plus `ALLOWED_ORIGINS` in `server/fly.toml` to
match, or cloud saves will fail CORS from the new origin.

## Checking it

Preview crawlers do not run JavaScript, so `curl` sees exactly what they see:

```bash
curl -s "https://<your-worker-url>/?hold=1d3mcl9" | grep 'og:title'
```
