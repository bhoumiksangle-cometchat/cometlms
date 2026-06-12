# CometLMS — Docker Deployment Guide

Deploy the full CometLMS stack (API + Web + PostgreSQL + Redis) on a single machine
using **only Docker**. No Node.js, PM2, or host Nginx required.

---

## Prerequisites

- Ubuntu 22.04+ (or any Linux with Docker)
- Docker Engine 24+ with Docker Compose v2
- At least 2 GB RAM, 20 GB disk
- Port 80 open (HTTP) and port 22 (SSH)

### Install Docker (Ubuntu)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

---

## Deployment Steps

### 1. Clone the repository

```bash
git clone <your-repo-url> cometlms
cd cometlms
```

### 2. Create the environment file

```bash
cp .env.example .env
```

Edit `.env` and set:

| Variable | What to set |
|----------|-------------|
| `POSTGRES_PASSWORD` | A strong random password |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` |
| `GROQ_API_KEY` | Your Groq API key |
| `CLIENT_URL` / `WEB_URL` / `FRONTEND_URL` | `http://<EC2_PUBLIC_IP>` |
| `VITE_API_URL` | Leave empty (Nginx proxies `/api` internally) |

### 3. Build and start

```bash
docker compose up -d --build
```

First build takes 2–4 minutes. Subsequent starts are instant.

### 4. Verify

```bash
# API health check
curl http://localhost/api/health
# Should return: {"status":"ok","timestamp":"...","queues":{...}}

# Web app
curl -s http://localhost/ | head -5
# Should return HTML
```

Open `http://<EC2_PUBLIC_IP>/` in a browser. You should see the CometLMS login page.

---

## What Happens Automatically

1. **PostgreSQL** starts and waits for healthy connection
2. **Redis** starts with AOF persistence
3. **API** container:
   - Runs `prisma migrate deploy` (applies all migrations)
   - Runs seed scripts (creates test users, courses, chat rooms, AI bots)
   - Starts the Node.js server on port 3000 (internal only)
4. **Web** container:
   - Serves the pre-built React app via Nginx on port 80
   - Reverse-proxies `/api/*` → API container
   - Reverse-proxies `/socket.io/*` → API container (with WebSocket upgrade)

---

## Test Accounts (Seeded)

| Role | Email | Password |
|------|-------|----------|
| Student | `student@learnloop.test` | `Password123` |
| Instructor | `instructor@learnloop.test` | `Password123` |
| Admin | `admin@learnloop.test` | `Password123` |

---

## Architecture

```
Internet → :80
              │
       ┌──────▼──────┐
       │   Nginx      │  (web container)
       │   /          │  → static React bundle
       │   /api/*     │  → proxy to api:3000
       │   /socket.io │  → proxy + WS upgrade to api:3000
       └──────┬───────┘
              │ internal Docker network
       ┌──────▼──────┐
       │   API        │  Express + Socket.IO + BullMQ
       │   :3000      │
       └──┬───────┬───┘
          │       │
   ┌──────▼─┐  ┌─▼──────┐
   │Postgres │  │ Redis  │
   │  :5432  │  │ :6379  │
   └─────────┘  └────────┘
```

Only port 80 is exposed to the host. Postgres, Redis, and the API are on an internal
Docker network with no external access.

---

## Common Operations

### View logs

```bash
docker compose logs -f api       # API logs
docker compose logs -f web       # Nginx access logs
docker compose logs -f postgres  # Database logs
```

### Restart a single service

```bash
docker compose restart api
```

### Rebuild after code changes

```bash
docker compose up -d --build
```

### Reset the database

```bash
docker compose down -v           # Removes volumes (data loss!)
docker compose up -d --build     # Fresh start with migrations + seed
```

### Run a one-off Prisma command

```bash
docker compose exec api npx prisma studio
```

---

## Adding TLS / Custom Domain (Next Step)

When you're ready for HTTPS:

1. Point your domain DNS A record to the EC2 IP
2. Add a Certbot/Let's Encrypt sidecar container or use Traefik
3. Update `CLIENT_URL` / `WEB_URL` / `FRONTEND_URL` to `https://yourdomain.com`
4. Rebuild the web container with `VITE_API_URL=https://yourdomain.com/api` if needed

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `api` container restarting | Check `docker compose logs api` — likely missing env vars or Postgres not ready |
| CORS errors in browser | Ensure `CLIENT_URL` in `.env` matches the URL you access in the browser |
| WebSocket connection fails | Verify `/socket.io/` proxy block in nginx.conf — check `docker compose logs web` |
| Database migration fails | Run `docker compose exec api npx prisma migrate status` to diagnose |
| Seed fails with duplicate | Safe to ignore — seeds use `upsert` and skip existing records |
