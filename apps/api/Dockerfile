# =============================================================================
# CometLMS API — Multi-stage production Dockerfile
# Build context MUST be the repo root:  docker build -f apps/api/Dockerfile .
# =============================================================================

# --- Stage 1: Install all workspace dependencies ---
FROM node:20-alpine AS deps
WORKDIR /workspace

# Copy root workspace manifests
COPY package.json package-lock.json* ./

# Copy workspace package manifests (needed for npm workspace resolution)
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json

# Install all dependencies (workspace-aware)
RUN npm install --legacy-peer-deps

# --- Stage 2: Build shared packages + API ---
FROM node:20-alpine AS builder
WORKDIR /workspace

RUN apk add --no-cache openssl

# Copy installed deps from stage 1
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/package.json ./package.json

# Copy full source
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/

# Generate Prisma client (generates into node_modules/.prisma/client)
RUN cd apps/api && npx prisma generate

# Build the API with tsup
# External: native/binary packages that can't be bundled
RUN cd apps/api && npx tsup src/server.ts \
    --out-dir dist \
    --format cjs \
    --target node20 \
    --external @prisma/client \
    --external bcryptjs \
    --external ioredis \
    --external bullmq \
    --external socket.io \
    --external @sentry/node \
    --external @aws-sdk/client-s3 \
    --external openai \
    --external langchain \
    --external @langchain/community \
    --external nodemailer \
    --external @sendgrid/mail \
    --external winston

# --- Stage 3: Production runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache tini wget openssl

# Copy built output
COPY --from=builder /workspace/apps/api/dist ./dist
COPY --from=builder /workspace/apps/api/prisma ./prisma
COPY --from=builder /workspace/apps/api/package.json ./package.json

# Copy node_modules (includes @prisma/client, native deps, tsx for seeds)
COPY --from=builder /workspace/node_modules ./node_modules

# Copy the entrypoint script
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["tini", "--"]
CMD ["/docker-entrypoint.sh"]
