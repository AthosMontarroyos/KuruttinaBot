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
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/dist ./dist
RUN chmod -R a+rX,go-w /app
USER node

FROM runtime AS bot
CMD ["node", "dist/apps/bot/src/index.js"]

FROM runtime AS site
CMD ["node", "dist/apps/site/index.js"]

FROM runtime AS release
CMD ["node", "packages/database/cli.js"]
