# Node 24 runs TypeScript directly and ships SQLite in core, so this image
# needs no build step, no compiler and no dependencies at all.
FROM node:24-slim

WORKDIR /app
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY src/core/saveMerge.ts ./src/core/saveMerge.ts

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/blockhold.db
EXPOSE 8080

# unprivileged, and /data is the mounted volume
RUN mkdir -p /data && chown -R node:node /data /app
USER node

CMD ["node", "server/src/index.ts"]
