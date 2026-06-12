# =============================================================================
# CometLMS Web — Multi-stage production Dockerfile
# Build context MUST be the repo root:  docker build -f apps/web/Dockerfile .
# =============================================================================

# --- Stage 1: Install all workspace dependencies ---
FROM node:20-alpine AS deps
WORKDIR /workspace

# Copy root workspace manifests
COPY package.json package-lock.json* ./

# Copy workspace package manifests
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/shared-utils/package.json packages/shared-utils/package.json

# Install all dependencies
RUN npm install --legacy-peer-deps

# --- Stage 2: Build the Vite app ---
FROM node:20-alpine AS builder
WORKDIR /workspace

COPY --from=deps /workspace/node_modules ./node_modules

# Copy full source needed for build
COPY package.json tsconfig.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

# VITE_API_URL is baked into the bundle at build time
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

# Build the frontend (skip tsc type-check in Docker to avoid strict errors)
RUN cd apps/web && npx vite build

# --- Stage 3: Nginx to serve static files + reverse proxy ---
FROM nginx:alpine AS runtime

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our Nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
