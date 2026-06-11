# Self-Hosted Deployment

Services:
- PostgreSQL 16
- Redis 7
- API (Node.js)

Container Images:
- apps/api/Dockerfile
- apps/web/Dockerfile

Current Status:
- Multi-stage container structure added
- Additional optimization still required for monorepo production builds

HTTP Deployment Requirements:
- Configure CLIENT_URL, WEB_URL, FRONTEND_URL and VITE_API_URL using http:// endpoints.
- Ensure API and web origins are explicitly included in CORS allowlists.
- Socket.IO traffic will use HTTP/WS rather than HTTPS/WSS.
- Generated notification and payment links inherit configured HTTP URLs.

Health endpoint:
- GET /api/health

Startup:
1. docker compose up -d postgres redis
2. Run Prisma migrations
3. Run seed workflow
4. Start API

Seed Workflow:
- npm run seed
- Executes:
	- prisma/seed.ts
	- prisma/seed-bots.ts

Legacy seed file:
- src/seed.ts (deprecated)

Migration path from Supabase:
1. Export Supabase PostgreSQL data.
2. Import into self-hosted PostgreSQL.
3. Update DATABASE_URL.
4. Run validation and smoke tests.

Backup:
- scripts/backup-postgres.sh

Restore:
- scripts/restore-postgres.sh <backup.sql>

Recommended:
- Daily automated PostgreSQL backups
- Offsite backup storage
- Periodic restore testing

Monitoring Roadmap:
- API metrics
- PostgreSQL metrics
- Redis metrics
- Queue health monitoring
- Error tracking (Sentry)

Production Hardening Remaining:
- Real Prisma migrations
- Multi-stage Docker builds
- Automated backups
- Metrics dashboards
- Alerting
- Secret management
