# blockhold.app: the game, built from source and served by Caddy.
#
# Building inside the image means everything that reaches the site was built
# the same way, with the production sync address, whether the deploy started
# in CI or on a laptop. It can never pick up a local dist/ left over from an
# iOS build, which is built without any server address on purpose.
#
# Deploy from the repository root:  fly deploy --config web/fly.toml

FROM node:24.19.0-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY public ./public
# cloud saves, the leaderboard and co-op are compiled out unless this is set
ARG VITE_SYNC_URL
RUN test -n "$VITE_SYNC_URL" || (echo "VITE_SYNC_URL is required" && exit 1)
ENV VITE_SYNC_URL=$VITE_SYNC_URL
# typechecking, lint and tests are CI's job; this stage only builds
RUN npx vite build
COPY web/404.html dist/404.html
COPY web/precompress.mjs ./
RUN node precompress.mjs dist

FROM caddy:2.11.6-alpine
COPY web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 8080
