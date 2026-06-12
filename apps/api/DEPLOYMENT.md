# API Deployment Notes

> **For full deployment instructions, see the root [`DEPLOYMENT.md`](../../DEPLOYMENT.md).**

This API is deployed as part of the Docker Compose stack. The container:

1. Runs Prisma migrations automatically on startup
2. Seeds the database (users, courses, chat rooms, AI bots)
3. Starts the Node.js server on port 3000

## Container Details

- **Dockerfile:** `apps/api/Dockerfile` (build context = repo root)
- **Entrypoint:** `apps/api/docker-entrypoint.sh`
- **Exposed port:** 3000 (internal network only — Nginx proxies from port 80)
- **Health check:** `GET /api/health`

## Environment Variables

See root `.env.example` for the complete list. Key API variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (auto-constructed in compose) |
| `REDIS_URL` | Redis connection string (auto-constructed in compose) |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `GROQ_API_KEY` | Groq API key for AI agents |
| `GROQ_MODEL` | LLM model name (default: `llama-3.3-70b-versatile`) |
| `CLIENT_URL` | Frontend origin for CORS |

## Seed Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | `student@learnloop.test` | `Password123` |
| Instructor | `instructor@learnloop.test` | `Password123` |
| Admin | `admin@learnloop.test` | `Password123` |
