FROM node:22.14.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/config ./packages/config
RUN npm ci
COPY tsconfig.json ./
COPY apps ./apps
COPY scripts/build ./scripts/build
RUN npm run build:bot && npm prune --omit=dev

FROM node:22.14.0-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/config ./packages/config
COPY --from=build --chown=node:node /app/dist ./dist
USER node
CMD ["node", "dist/apps/bot/src/index.js"]
