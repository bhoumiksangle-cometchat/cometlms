# CometLMS

A production-grade Learning Management System (LMS) built with React, TypeScript, Express, PostgreSQL, Redis, Socket.IO, AI-powered assistants, and real-time communication features.

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
- shadcn/ui
- Socket.IO Client
- React Hook Form
- Zod
- Vite

### Backend

- Node.js 20
- Express.js
- Socket.IO
- JWT Authentication
- Prisma ORM
- BullMQ
- Redis
- OpenAI SDK
- LangChain
- Multer
- AWS S3
- SendGrid

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
React Web App
      │
      │ REST + WebSocket
      ▼
Express API + Socket.IO
      │
 ┌────┴────┐
 │         │
 ▼         ▼
Postgres  Redis
 │
 ▼
AI Services
(groq)
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

### Backend

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=
REDIS_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

OPENAI_API_KEY=

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=

SENDGRID_API_KEY=

CLIENT_URL=
WEB_URL=
FRONTEND_URL=
```

### Frontend

```env
VITE_API_URL=
VITE_SOCKET_URL=

Example HTTP deployment:

VITE_API_URL=http://api.example.internal:3000
CLIENT_URL=http://app.example.internal
WEB_URL=http://app.example.internal
FRONTEND_URL=http://app.example.internal
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

### Chat

- GET /api/chat/rooms/:roomId/messages
- POST /api/chat/rooms/:roomId/messages
- GET /api/chat/conversations

### Administration

- GET /api/admin/stats
- GET /api/admin/moderation
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

### Phase 1

- Core LMS
- Authentication
- Courses
- Enrollments
- Quizzes

### Phase 2

- Real-time chat
- AI assistants
- Direct messaging
- Notifications

### Phase 3

- Video calls
- Office hours
- Advanced moderation
- Analytics

### Future Enhancements

- Mobile applications
- Gamification
- Multi-language support
- Enterprise portals
- SCORM support

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
