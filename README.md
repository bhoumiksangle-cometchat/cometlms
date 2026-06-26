# CometLMS

A production-grade Learning Management System (LMS) built with React, TypeScript, Express, PostgreSQL, Redis, and a Flutter mobile app. Real-time chat, group discussions, and voice/video calling are powered by **CometChat** (Phase 2); the platform also ships FCM push notifications and AI assistants.

> **Two-phase project.** Phase 1 (branch `main`) is the standalone production LMS — auth, RBAC, courses, quizzes, FCM push, admin dashboard. Phase 2 (branch `cometchat`) integrates CometChat for messaging, calling, moderation, AI agents, and webhooks **without breaking the existing Phase-1 workflows**. See [docs/DECISION_LOG.md](docs/DECISION_LOG.md) for what changed and why.

## Overview

Deployment Assumption:
- Production and staging environments are currently configured to use HTTP endpoints (`http://`) rather than HTTPS.
- Public URL environment variables should remain protocol-consistent across API, web, mobile, notifications, and payment redirects.

CometLMS is a full-stack education platform designed around engagement, collaboration, and intelligent assistance. Unlike traditional LMS platforms that treat communication as a secondary feature, CometLMS makes real-time interaction a core part of the learning experience.

The platform combines:

- Course management
- Student enrollment and progress tracking
- Real-time course discussions
- Direct messaging
- Voice and video office hours
- AI-powered tutoring assistants
- AI moderation and content safety
- Instructor productivity tools
- Advanced administration and analytics

---

## Documentation

All project documentation lives in [`docs/`](docs/):

| Document | Purpose |
|----------|---------|
| [SCOPE_OF_WORK.md](docs/SCOPE_OF_WORK.md) | Requirements / scope of work |
| [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | REST API reference |
| [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) | Schema, entities, migrations |
| [NOTIFICATION_FLOW.md](docs/NOTIFICATION_FLOW.md) | App FCM push + CometChat push |
| [COMETCHAT_INTEGRATION.md](docs/COMETCHAT_INTEGRATION.md) | CometChat architecture & sync |
| [COMETCHAT_SKILLS_USAGE.md](docs/COMETCHAT_SKILLS_USAGE.md) | How CometChat Skills were used |
| [COMETCHAT_WEBHOOKS.md](docs/COMETCHAT_WEBHOOKS.md) | Webhook endpoint & engagement analytics |
| [DECISION_LOG.md](docs/DECISION_LOG.md) | Decisions, alternates, trade-offs |
| [TESTING_NOTES.md](docs/TESTING_NOTES.md) | Test suite, results, known issues |
| [DEMO_GUIDE.md](docs/DEMO_GUIDE.md) | Reproducible 20-step demo script |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Docker / EC2 deployment |
| [PROJECT_REPORT.md](PROJECT_REPORT.md) | Deliverables & acceptance-criteria status |

---

## CometChat Integration (Phase 2)

Real-time messaging, calling, moderation, and AI agents are delivered by CometChat:

- **Web** — CometChat React UI Kit v6 (`@cometchat/chat-uikit-react`) for 1-1 chat, per-course group discussions, and office-hours video calls.
- **Mobile** — CometChat Flutter UI Kit v6 (`cometchat_chat_uikit`) with the same surfaces + CometChat push.
- **Server** — an idempotent REST sync service (`apps/api/src/services/cometchat.service.ts`) provisions a CometChat user (UID = `User.id`) and mints an auth token on register/login/refresh, and creates one group per course (`course-{id}`).
- **Webhook** — `POST /api/webhooks/cometchat/events` (HMAC-verified) feeds per-course engagement analytics visible on the Admin Engagement dashboard.
- **Skills** — built with CometChat's AI-agent "Skills" (committed under `apps/mobile/.agents/skills/` + `skills-lock.json`). See [COMETCHAT_SKILLS_USAGE.md](docs/COMETCHAT_SKILLS_USAGE.md).

The existing Phase-1 FCM push pipeline continues to run **alongside** CometChat push — see [NOTIFICATION_FLOW.md](docs/NOTIFICATION_FLOW.md).

---

## Key Features

### Learning Platform

- Course catalogue and discovery
- Course enrollment workflows
- Structured lessons and curriculum
- Quizzes and assessments
- Course completion tracking
- Reviews and ratings

### Real-Time Communication

- Course discussion channels
- Direct messaging between students and instructors
- Real-time presence indicators
- Typing indicators
- Read receipts
- Message reactions
- Threaded discussions
- File sharing
- Rich media support
- Mentions and notifications

### Live Learning

- Instructor office hours
- Group video sessions
- One-on-one calls
- Screen sharing
- Session recordings
- Live session notifications

### Artificial Intelligence

#### AI Study Assistant

- Course-aware tutoring
- Contextual question answering
- Real-time streaming responses
- Course-specific knowledge retrieval

#### FAQ Bot

- Course-specific FAQs
- Public course page assistant
- Discussion room integration

#### Instructor Copilot

- AI-generated smart replies
- Conversation summaries
- Question trend analysis
- Suggested responses

### AI Moderation

- Profanity filtering
- Spam detection
- NSFW image moderation
- Automated flagging workflows
- Admin moderation queue

### Administration

- User management
- Course management
- Instructor approval workflows
- Moderation dashboard
- AI agent management
- Activity event logging
- Engagement analytics

---

## Technology Stack

### Frontend

- React 18
- TypeScript
- React Router
- Zustand
- TanStack Query
- Tailwind CSS
- CometChat React UI Kit v6 (`@cometchat/chat-uikit-react`)
- CometChat Chat + Calls SDK
- Firebase Web SDK (FCM push)
- React Hook Form
- Zod
- Vite

### Backend

- Node.js 20
- Express.js
- JWT Authentication
- Prisma ORM
- BullMQ + Redis (job queue)
- CometChat REST API (server-side user/group sync)
- firebase-admin (FCM push dispatch)
- Groq via OpenAI-compatible SDK (AI assistants)
- Winston (logging)

> Mobile: **Flutter** (`apps/mobile`) with Riverpod, go_router, CometChat Flutter UI Kit v6, and FCM.

### Database & Infrastructure

- PostgreSQL 16
- Redis 7
- Docker
- Docker Compose
- GitHub Actions
- AWS EC2 / Railway
- Sentry
- Winston

---

## Repository Structure

```text
cometlms/
├── apps/
│   ├── api/
│   ├── web/
│   └── mobile/
├── packages/
│   ├── shared-types/
│   └── shared-utils/
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Architecture

```text
 React Web App / Flutter Mobile App
        │                  │
        │ REST (JWT)       │ CometChat SDK + UI Kit
        ▼                  ▼
   Express API ──────► CometChat Cloud
        │   ▲                │
        │   │ webhook (HMAC) │
 ┌──────┴───┴─┐              │
 │            │              ▼
 ▼            ▼          Chat / Calls /
Postgres    Redis        Moderation / AI Agents
 │           (BullMQ)
 ▼
Groq (AI assistants) · FCM (push)
```

---

## User Roles

### Student

- Enroll in courses
- Participate in discussions
- Use AI assistants
- Message instructors
- Join live sessions

### Instructor

- Create and manage courses
- Moderate course discussions
- Host office hours
- Use AI Copilot tools

### Admin

- Moderate platform activity
- Manage users and courses
- Configure AI systems
- Review analytics

### Super Admin

- Full platform control
- System configuration
- User and role management

---

## Core Modules

### Authentication

- Registration
- Login
- Refresh tokens
- Role-based access control
- JWT authentication

### Courses

- Course creation
- Publishing workflows
- Curriculum management
- Categories
- Reviews

### Chat System

- Course discussion groups
- Direct messaging
- Event-driven architecture
- Presence management
- Reactions and threads

### Notifications

- In-app notifications
- Push notifications
- Email notifications
- Event-triggered alerts

### AI Services

- Study Assistant
- FAQ Bot
- Instructor Copilot
- Moderation Engine

---

## Environment Variables

> The authoritative, complete sample is [`.env.example`](.env.example). The blocks below are an overview — copy `.env.example` to `.env` and fill in the values.

### Backend

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=
REDIS_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

# AI assistants (Groq, OpenAI-compatible)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# CometChat (REST key + webhook secret are server-side only)
COMETCHAT_APP_ID=
COMETCHAT_REGION=in
COMETCHAT_AUTH_KEY=
COMETCHAT_REST_API_KEY=
COMETCHAT_WEBHOOK_SECRET=

# Firebase Admin (FCM push dispatch)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

CLIENT_URL=
WEB_URL=
FRONTEND_URL=
```

### Frontend

```env
VITE_API_URL=

# CometChat (client)
VITE_COMETCHAT_APP_ID=
VITE_COMETCHAT_REGION=in
VITE_COMETCHAT_AUTH_KEY=

# Firebase Web (FCM push)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

---

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 16+
- Redis 7+

### Install Dependencies

```bash
npm install
```

### Start Development Environment

```bash
npm run dev
```

Default URLs:

- Frontend: http://localhost:5173
- API: http://localhost:3000

---

## Database Setup

Install Prisma dependencies and run:

```bash
cd apps/api
npx prisma generate
npx prisma db push
```

Optional seed:

```bash
npm run seed
```

---

## Docker Deployment

Production services include:

- PostgreSQL
- Redis
- API
- Web Frontend

Start services:

```bash
docker compose up -d
```

Stop services:

```bash
docker compose down
```

---

## API Overview

### Authentication

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET /api/auth/me

### Courses

- GET /api/courses
- GET /api/courses/:id
- POST /api/courses
- PATCH /api/courses/:id

### Chat (CometChat)

Messaging and calling run on the CometChat SDK/UI Kit (not REST endpoints on this API).
The API only exposes CometChat **support** routes:

- POST /api/chat/agents/message — server-side AI agent (Groq)
- POST /api/webhooks/cometchat/events — CometChat webhook (engagement analytics)
- (auth routes return a `cometchatAuthToken` for client login)

### Administration

- GET /api/admin/stats
- GET /api/admin/users — manage users (+ ban/unban)
- GET /api/admin/moderation — CometChat moderation queue
- GET /api/admin/engagement — webhook-driven engagement metrics
- GET /api/admin/events/log

---

## Security

- JWT authentication
- Refresh token rotation
- Role-based authorization
- Rate limiting
- Secure password hashing
- Input validation with Zod
- AI moderation pipeline
- Audit logging

---

## Testing Strategy

### Unit Tests

- Authentication
- Event processing
- Business logic

### Integration Tests

- API endpoints
- Chat workflows
- Enrollment workflows

### End-to-End Tests

- Student journey
- Instructor workflows
- Admin moderation workflows

### Performance Tests

- Concurrent messaging
- Event processing throughput
- WebSocket scalability

---

## Roadmap

### Phase 1 — Production LMS (branch `main`) ✅

- Core LMS (courses, enrollments, lessons, quizzes, certificates)
- JWT authentication + role-based access control (5 roles)
- FCM push notifications + admin dashboard
- 100+ seeded users
- Flutter mobile app

### Phase 2 — CometChat Integration (branch `cometchat`) ✅

- Existing + new users synced to CometChat
- 1-1 chat, per-course group chat, office-hours video calls
- AI agents (CometChat Agent Builder + Groq)
- Moderation queue + webhook-driven engagement analytics
- CometChat push alongside the existing FCM push

### Future Enhancements

- CometChat **tags** for cohort/role-based filtering (currently role is in user metadata)
- Admin notification-log view
- Gamification, SCORM, enterprise portals
- Multi-language support (CometChat i18n)

---

## License

Private project. All rights reserved.

---

## Contributors

Built with:

- React
- TypeScript
- Express
- PostgreSQL
- Redis
- Socket.IO
- Groq
- Prisma
# cometlms
