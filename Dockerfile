FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
RUN npm ci --no-audit --no-fund
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.json ./
RUN npm run build && npm run site:build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN groupadd --system --gid 1001 kuruttina \
  && useradd --system --uid 1001 --gid kuruttina --home-dir /app --no-create-home --shell /usr/sbin/nologin kuruttina \
  && chown kuruttina:kuruttina /app
COPY --from=build --chown=kuruttina:kuruttina /app/package.json /app/package-lock.json ./
COPY --from=build --chown=kuruttina:kuruttina /app/node_modules ./node_modules
COPY --from=build --chown=kuruttina:kuruttina /app/packages ./packages
COPY --from=build --chown=kuruttina:kuruttina /app/dist ./dist
USER kuruttina

FROM runtime AS bot
CMD ["node", "dist/apps/bot/src/index.js"]

FROM runtime AS site
CMD ["node", "dist/apps/site/index.js"]

FROM runtime AS release
CMD ["node", "packages/database/cli.js"]
