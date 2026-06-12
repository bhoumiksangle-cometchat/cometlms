#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "[entrypoint] Running database seed..."
npx tsx prisma/seed.ts || echo "[entrypoint] Seed skipped (may already exist)"
npx tsx prisma/seed-bots.ts || echo "[entrypoint] Bot seed skipped (may already exist)"

echo "[entrypoint] Starting API server..."
exec node dist/server.js
