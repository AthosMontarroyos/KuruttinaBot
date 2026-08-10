# Stage 1: Build & Typecheck Validation via Turborepo Monorepo
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace manifests
COPY package*.json turbo.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/bot/package*.json ./apps/bot/
COPY apps/website/package*.json ./apps/website/

# Install dependencies
RUN npm ci

# Copy full monorepo source code & assets (including Pictures/emojis)
COPY . .

# Typecheck validation
RUN npx tsc --noEmit

# Stage 2: Production AWS Runner (ECS / Fargate / EC2)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace assets and monorepo source
COPY --from=builder /app ./

# Run bot via Turborepo monorepo scope from root
CMD ["npx", "turbo", "run", "dev", "--filter=@kuruttina/bot"]
