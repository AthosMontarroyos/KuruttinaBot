# Stage 1: Build & Typecheck Validation
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/bot/package*.json ./apps/bot/

# Install dependencies
RUN npm ci

# Copy full source code & assets (including Pictures/emojis)
COPY . .

# Typecheck validation
RUN npx tsc --noEmit

# Stage 2: Production AWS Runner (ECS / Fargate / EC2)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace assets and source
COPY --from=builder /app ./

WORKDIR /app/apps/bot

CMD ["npx", "ts-node", "src/index.ts"]
