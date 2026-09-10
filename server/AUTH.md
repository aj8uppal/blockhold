# Google sign-in

The primary account screen uses **Sign in with Google**. Existing local progress and legacy cloud accounts are preserved. File backups and old-code recovery live under “Backups & older saves.” The backend advertises availability at `GET /v1/auth/providers`; without both credentials, the button is disabled with an explanation. Deploying this code alone does not activate Google sign-in.

## Production setup

1. In [Google Cloud Console](https://console.cloud.google.com/auth/clients), create an OAuth 2.0 **Web application** client. Configure the consent screen for Blockhold with its homepage `https://aj8uppal.github.io/blockhold/`. The only requested scope is `openid`; no email/profile scope or Google API access is needed.
2. Add this exact **authorized redirect URI**: `https://blockhold-sync.fly.dev/v1/auth/google/callback`. If the Console requests an authorized JavaScript origin, use `https://aj8uppal.github.io`. The actual OAuth exchange runs on the server.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Fly secrets on `blockhold-sync`, using the values issued for this client. Keep them out of commits, browser bundles, shell history, screenshots and logs. Fly's dashboard secrets UI or `fly secrets import -a blockhold-sync` with securely supplied stdin can set them.
4. These optional backend environment variables have production defaults:
   - `GOOGLE_CALLBACK_URL=https://blockhold-sync.fly.dev/v1/auth/google/callback`
   - `AUTH_RETURN_URLS=https://aj8uppal.github.io/blockhold/` (comma-separated **exact full page URLs**, no query or fragment)
   - `ALLOWED_ORIGINS` must include `https://aj8uppal.github.io` (already in `fly.toml`).
5. If Google consent is in Testing mode, explicitly add test users. Publish the OAuth app for other players when the Google project is ready.
6. Verify `GET https://blockhold-sync.fly.dev/v1/auth/providers` returns `{"google":true}`. In a real browser, sign in, complete a level, then use a second browser/device and the same Google account. Confirm the union of progress. Sign out and back in, and check an existing legacy save links without changing its stars or XP.

The frontend still needs its existing `VITE_SYNC_URL=https://blockhold-sync.fly.dev` build setting. No provider secret belongs in a `VITE_` variable.

For local OAuth testing, register a separate client redirect `http://localhost:8080/v1/auth/google/callback`, set `GOOGLE_CALLBACK_URL` to it, add the exact frontend URL (for example `http://localhost:5173/blockhold/`) to `AUTH_RETURN_URLS`, and include its origin in `ALLOWED_ORIGINS`. Use the URL the local Vite app actually serves.

## Security and migration

- The server exchanges Google's authorization code using the client secret plus PKCE, then obtains the subject directly from Google's fixed HTTPS userinfo endpoint. Client-supplied claims and emails never determine ownership. See [Google's OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect).
- Random state is single-use and expires in ten minutes. The Google redirect carries only a single-use completion code in a URL fragment, expiring after sixty seconds. It is exchanged by POST using a random verifier held only in the initiating tab's `sessionStorage`. Linking and session creation occur only after that browser proof succeeds. Bearer tokens never appear in redirects.
- OAuth POST routes enforce the configured origin, and return destinations must match exact configured URLs and the initiating origin. Auth responses disable caching and referrers.
- Device sessions expire after thirty days, are stored as SHA-256 hashes, and are revoked server-side by sign-out when online. Local sign-out clears device authentication without deleting local progress. Legacy tokens/codes stay valid for existing devices and recovery; they are not retroactively rotated during linking.
- Google-linked accounts survive the legacy 180-day retention sweep. Only the provider name and stable subject are stored; no email, name, avatar, provider access token or refresh token is retained. Back up the SQLite volume as before.
- A Google identity cannot silently take over another account, and an already linked account cannot be relinked to a different Google subject. The conflict message explains how to choose the intended Google account while retaining local progress.

Automated tests exercise the real HTTP routes with an isolated SQLite database and a mock Google transport: repeat login, per-device logout, legacy migration, ownership conflicts, state/completion replay, missing/incorrect proof, untrusted origin/redirect, expired state, provider errors, and retention. Client tests cover progress preservation, tab proof, logout and late sync responses. Real provider/browser testing remains required after credentials are configured.
