# CometLMS — Deployment Guide

## Production URLs

| Service | URL |
|---------|-----|
| Web app | `https://lms.cometchat-staging.com` |
| API (direct — used by mobile) | `https://cometlms-a.cometchat-staging.com` |

---

## Architecture

```
Mobile App  ──────────────────────────────────► cometlms-a.cometchat-staging.com
                                                        │
                                                   [ EC2 host :3000 ]
                                                        │
Browser  ──► lms.cometchat-staging.com                  │
                    │                                   │
             [ EC2 host :80 ]                           │
                    │                                   │
             ┌──────▼──────┐                     ┌──────▼──────┐
             │  web (Nginx) │                     │     api     │
             │  :80         │──── /api/* ────────►│   :3000     │
             │  React SPA   │──── /socket.io/ ───►│  Express    │
             └─────────────┘                     └──────┬───────┘
                                                        │
                                               ┌────────┴────────┐
                                          ┌────▼────┐       ┌────▼────┐
                                          │postgres │       │  redis  │
                                          │ :5432   │       │  :6379  │
                                          └─────────┘       └─────────┘
```

Only ports **80** (web) and **3000** (API) are exposed to the host.
Postgres and Redis are internal to the Docker network only.

---

## EC2 Prerequisites

- Docker Engine 24+ with Docker Compose v2
- Port **80** open for web app
- Port **3000** open for mobile app API access
- Port **22** open for SSH

---

## Deploy Steps

### 1. Clone

```bash
git clone <repo-url> /opt/cometlms
cd /opt/cometlms
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env   # fill in every CHANGE_ME value
```

Key values for this deployment:

```env
CLIENT_URL=https://lms.cometchat-staging.com
WEB_URL=https://lms.cometchat-staging.com
FRONTEND_URL=https://lms.cometchat-staging.com
WEB_PORT=80          # change to 8080 if port 80 is already taken
VITE_API_URL=        # leave empty — Nginx proxies /api internally
```

### 3. Build and start

```bash
docker compose up -d --build
```

First build: ~3–5 min. Subsequent starts: instant.

### 4. Verify

```bash
# API health
curl https://cometlms-a.cometchat-staging.com/api/health
# → {"status":"ok","queues":{"healthy":true,...}}

# Web app
curl -s https://lms.cometchat-staging.com/ | grep '<title>'
# → <title>LearnLoop LMS</title>
```

---

## Seeded Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | `student@learnloop.test` | `Password123` |
| Instructor | `instructor@learnloop.test` | `Password123` |
| Admin | `admin@learnloop.test` | `Password123` |

Migrations and seed run automatically on first start.

---

## Mobile App

The Flutter app points directly at the API:

```
API_BASE_URL = https://cometlms-a.cometchat-staging.com
```

This is baked in as the default in `apps/mobile/lib/core/network/api_client.dart`.

To build:
```bash
cd apps/mobile
flutter build apk   # Android
flutter build ios   # iOS
```

No `--dart-define` needed — the default is already correct for production.

---

## Port Conflict on Port 80

If something else is already using port 80 on the EC2:

```bash
# Find what's using it
sudo lsof -i :80

# If it's system Nginx/Apache, stop it
sudo systemctl stop nginx && sudo systemctl disable nginx

# OR change the web container port in .env
WEB_PORT=8080
docker compose up -d web
```

---

## Common Operations

```bash
# View logs
docker compose logs -f api
docker compose logs -f web

# Restart API after code change
docker compose up -d --build api

# Rebuild web after config change (VITE_ vars require rebuild)
docker compose up -d --build web

# Full redeploy
docker compose down
docker compose up -d --build

# Reset database (DESTRUCTIVE — deletes all data)
docker compose down -v
docker compose up -d --build
```

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `JWT_SECRET` | ✅ | Access token signing key (`openssl rand -base64 48`) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing key |
| `GROQ_API_KEY` | ✅ | Groq API key for AI agents |
| `CLIENT_URL` | ✅ | Web app public URL (for CORS) |
| `WEB_URL` | ✅ | Same as CLIENT_URL |
| `FRONTEND_URL` | ✅ | Same as CLIENT_URL |
| `VITE_API_URL` | — | Leave empty (Nginx proxy handles it) |
| `WEB_PORT` | — | Host port for web container (default: 80) |
| `FIREBASE_PROJECT_ID` | — | Push notifications (optional) |
| `FIREBASE_CLIENT_EMAIL` | — | Push notifications (optional) |
| `FIREBASE_PRIVATE_KEY` | — | Push notifications (optional) |
| `SENTRY_DSN` | — | Error tracking (optional) |
