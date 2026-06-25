# CometchaT — Docker Deployment Guide (Parallel with CometLMS)

Deploy the CometchaT stack on the same server as CometLMS **without interfering** with the existing deployment.

---

## Prerequisites

- Both CometLMS and CometchaT stacks will run simultaneously
- Existing CometLMS infrastructure remains untouched
- CometchaT uses different ports and container names

---

## Current Server State (Existing CometLMS)

```
CONTAINER ID   IMAGE                COMMAND                  STATUS    PORTS
4b6027a68c41   cometlms-web         "/docker-entrypoint.…"  Healthy   0.0.0.0:8080->80/tcp
73ee4d225120   cometlms-api         "tini -- /docker-ent…"  Healthy   127.0.0.1:3000->3000/tcp
b3a32b440540   postgres:16-alpine   "docker-entrypoint.s…"  Healthy   5432/tcp (internal)
d0d839409a58   redis:7-alpine       "docker-entrypoint.s…"  Healthy   6379/tcp (internal)
```

---

## New CometchaT Stack Configuration

| Component | Current (CometLMS) | CometchaT | Container Name |
|-----------|-------------------|-----------|-----------------|
| **Web Port** | `8080` | `8081` | `cometchat-web` |
| **API Port** | `3000` (internal) | `3001` (internal) | `cometchat-api` |
| **PostgreSQL** | `cometlms-postgres` | `cometchat-postgres` | Separate DB |
| **Redis** | `cometlms-redis` | `cometchat-redis` | Separate cache |
| **Volumes** | `postgres_data` | `postgres_data_cometchat` | Isolated data |

---

## Deployment Steps

### 1. Create Environment File

```bash
cd /path/to/cometlms

# Copy the example env file
cp .env.cometchat.example .env.cometchat
```

### 2. Edit `.env.cometchat`

Set the following values:

```bash
# Strong password (generate: openssl rand -base64 32)
POSTGRES_PASSWORD=<your_strong_password>

# JWT Secrets (generate both with: openssl rand -base64 48)
JWT_SECRET=<your_jwt_secret>
JWT_REFRESH_SECRET=<your_jwt_refresh_secret>

# Groq API Key
GROQ_API_KEY=<your_groq_api_key>

# Server IP or Domain (with port 8081)
CLIENT_URL=http://<your_server_ip>:8081
WEB_URL=http://<your_server_ip>:8081
FRONTEND_URL=http://<your_server_ip>:8081
```

### 3. Build and Deploy

```bash
# Build and start all CometchaT services
docker compose -f docker-compose.cometchat.yml --env-file .env.cometchat up -d --build

# Wait for all services to be healthy (2-4 minutes for first build)
docker compose -f docker-compose.cometchat.yml ps
```

### 4. Verify Deployment

```bash
# Check all containers are running
docker ps | grep cometchat
```

Expected output:
```
CONTAINER ID   IMAGE           COMMAND                STATUS    PORTS
xxxxx          cometchat-web   "/docker-entrypoint"  Healthy   0.0.0.0:8081->80/tcp
xxxxx          cometchat-api   "tini -- /docker..."  Healthy   127.0.0.1:3001->3001/tcp
xxxxx          postgres        "docker-entrypoint"   Healthy   (internal)
xxxxx          redis           "docker-entrypoint"   Healthy   (internal)
```

### 5. Test the Deployment

```bash
# API health check
curl http://localhost:3001/api/health
# Should return: {"status":"ok","timestamp":"...","queues":{...}}

# Web app (from browser or curl)
curl -s http://localhost:8081/ | head -10
# Should return HTML
```

### 6. Access in Browser

Open: **`http://<your_server_ip>:8081`**

You should see the CometchaT login page.

---

## Test Accounts (Auto-Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@learnloop.test` | `Password123` |
| Instructor | `instructor@learnloop.test` | `Password123` |
| Student | `student@learnloop.test` | `Password123` |

---

## Common Operations

### View CometchaT Logs

```bash
# All services
docker compose -f docker-compose.cometchat.yml logs -f

# Specific service
docker compose -f docker-compose.cometchat.yml logs -f api
docker compose -f docker-compose.cometchat.yml logs -f web
docker compose -f docker-compose.cometchat.yml logs -f postgres
```

### Restart a Service

```bash
docker compose -f docker-compose.cometchat.yml restart api
```

### Rebuild After Code Changes

```bash
docker compose -f docker-compose.cometchat.yml up -d --build
```

### Stop CometchaT Stack (Keep CometLMS Running)

```bash
docker compose -f docker-compose.cometchat.yml down
```

### Reset CometchaT Database

```bash
docker compose -f docker-compose.cometchat.yml down -v

# Then deploy again
docker compose -f docker-compose.cometchat.yml --env-file .env.cometchat up -d --build
```

---

## Managing Both Stacks

### View All Containers

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### View Both Logs (Side by Side)

Terminal 1:
```bash
docker compose logs -f                    # CometLMS
```

Terminal 2:
```bash
docker compose -f docker-compose.cometchat.yml logs -f  # CometchaT
```

### Manage Disk Space

Both stacks use Docker volumes. View usage:

```bash
docker system df
```

### Backup CometchaT Database

```bash
docker exec cometchat-postgres pg_dump -U cometchat cometchat > cometchat_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore CometchaT Database

```bash
docker exec -i cometchat-postgres psql -U cometchat cometchat < cometchat_backup.sql
```

---

## Troubleshooting

### Service Fails to Start

```bash
# View detailed logs
docker compose -f docker-compose.cometchat.yml logs api

# Check if ports are already in use
lsof -i :3001  # API port
lsof -i :8081  # Web port
```

### Database Connection Error

```bash
# Verify database is healthy
docker compose -f docker-compose.cometchat.yml ps postgres

# Check database logs
docker compose -f docker-compose.cometchat.yml logs postgres
```

### Health Check Failing

```bash
# Wait longer and check again
docker compose -f docker-compose.cometchat.yml ps

# If still failing, rebuild
docker compose -f docker-compose.cometchat.yml up -d --build
```

---

## Architecture (CometchaT Stack)

```
Internet → :8081
              │
       ┌──────▼──────┐
       │   Nginx      │  (cometchat-web)
       │   /          │  → static React bundle
       │   /api/*     │  → proxy to api:3001
       │   /socket.io │  → proxy + WS upgrade to api:3001
       └──────┬───────┘
              │ internal Docker network
       ┌──────▼──────┐
       │   API        │  Express + Socket.IO + BullMQ
       │   :3001      │
       └──┬───────┬───┘
          │       │
   ┌──────▼─┐  ┌─▼──────┐
   │Postgres │  │ Redis  │
   │  :5432  │  │ :6379  │
   │(cometchat)│(cometchat)
   └─────────┘  └────────┘
```

Only port 8081 is exposed to the host. Postgres, Redis, and the API are on an internal
Docker network with no external access.

---

## Next Steps

1. ✅ Created `docker-compose.cometchat.yml` with separate ports
2. ✅ Created `.env.cometchat.example` template
3. 📋 **Next:** Copy and edit `.env.cometchat` with your values
4. 📋 **Then:** Run `docker compose -f docker-compose.cometchat.yml --env-file .env.cometchat up -d --build`
5. 📋 **Finally:** Access CometchaT at `http://<your_server_ip>:8081`
