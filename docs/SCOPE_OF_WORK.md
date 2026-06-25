# Scope of Work — CometLMS (LearnLoop)

> Requirement / Scope of Work document for Assignment 1.
> This document describes the production application built in **Step 1** and the
> CometChat integration delivered in **Step 2**.

---

## 1. Application Use Case

**CometLMS** (internal codename *LearnLoop*) is a **Learning Management System**: a
platform where instructors publish video courses, students enrol and learn, and
admins operate the platform. Each course has a discussion space, learners can ask
questions, and instructors/agents respond — which is a natural fit for real-time
chat, calls, moderation, AI agents, and webhook-driven activity tracking.

## 2. Problem Statement

Online learners drop off when they are stuck and have no fast way to get help.
Email is slow, forums are asynchronous, and instructors have no live view of
class engagement. CometLMS solves this by combining structured course delivery
with **real-time, role-aware communication** (course group chat, 1:1 messaging,
AI study assistants, and instructor calls) on top of a conventional LMS.

## 3. Target Users

- **Students** — enrol in courses, watch lessons, take quizzes, ask questions.
- **Instructors** — author/publish courses, run live sessions, answer learners.
- **Admins / Super Admins** — operate the platform: manage users, view activity,
  moderate chat, review engagement analytics.
- **AI Agents** — automated assistants (FAQ Bot, Study Assistant, Instructor Copilot).

## 4. User Roles

The role model is the `UserRole` enum in Prisma:

| Role | Maps to assignment role | Purpose |
|------|------------------------|---------|
| `STUDENT` | Customer | Learner; consumes courses, asks questions |
| `INSTRUCTOR` | Staff / Agent | Authors courses, answers learners, owns course groups |
| `ADMIN` | Admin | Manages users, moderation, analytics |
| `SUPER_ADMIN` | Admin (elevated) | Full platform control |
| `AI_AGENT` | Agent (automated) | Bot accounts answering in chat |

## 5. User Permissions

| Capability | STUDENT | INSTRUCTOR | ADMIN | SUPER_ADMIN |
|---|---|---|---|---|
| Register / login / manage own profile | ✅ | ✅ | ✅ | ✅ |
| Browse & enrol in courses | ✅ | ✅ | ✅ | ✅ |
| Complete lessons, take quizzes | ✅ | ✅ | ✅ | ✅ |
| Create / publish / edit own courses | ❌ | ✅ | ✅ | ✅ |
| Manage course sections & lessons | ❌ | ✅ (own) | ✅ | ✅ |
| View all users / ban / unban | ❌ | ❌ | ✅ | ✅ |
| View moderation queue & act | ❌ | ❌ | ✅ | ✅ |
| View engagement analytics | ❌ | ❌ | ✅ | ✅ |
| Chat in enrolled course groups | ✅ | ✅ | ✅ | ✅ |
| Chat with AI agents | ✅ | ✅ | ✅ | ✅ |

Enforced server-side via `requireAuth` + `requireRole(...)` middleware.

## 6. User Workflows

- **Student**: register → browse catalog → enrol → watch lessons → mark complete →
  take quiz → ask questions in the course group chat → chat with AI Study Assistant.
- **Instructor**: login → create course → add sections/lessons → publish (auto-creates
  a CometChat course group with the instructor as owner) → answer learners → run calls.
- **Admin**: login → dashboard → view users / activity / engagement → moderate flagged
  messages → ban abusive users → review webhook-driven activity logs.

## 7. Screens / Pages (Web)

Login, Registration, Catalog/Dashboard, Course detail, Lesson player, Quiz,
Profile, Notifications, Chat (conversations + messages + groups), AI agent chat,
Admin dashboard (users, moderation, engagement, agents). Loading / empty / error
states are handled across list and detail views. Layout is responsive.

A Flutter **mobile app** mirrors auth, catalog, course, chat, and push.

## 8. Backend APIs

REST API (Express + TypeScript). Module groups: `auth`, `users`, `courses`,
`enrollments`, `quizzes`, `payments`, `notifications`, `admin`, `categories`,
and `chat` (CometChat webhook, moderation proxy, AI agents). Full reference in
[`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).

## 9. Database Entities

PostgreSQL via Prisma. Core entities: `User`, `Category`, `Course`, `Section`,
`Lesson`, `LessonCompletion`, `Enrollment`, `Quiz`, `Question`, `QuizAttempt`,
`Payment`, `Payout`, `Notification`, `DeviceToken`, `Review`, `Certificate`,
`LiveSession`, `SessionRecording`, and `CourseEngagementMetrics` (fed by CometChat
webhooks). Full design in [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md).

## 10. Notification Flows

In-app, email (stubbed), and **push (FCM)** notifications driven by a BullMQ queue
and worker. Triggers include course published, enrolment, and admin announcements.
After Step 2, CometChat push (messages/calls) runs **alongside** the app's own push
without interference. Full flow in [`NOTIFICATION_FLOW.md`](./NOTIFICATION_FLOW.md).

## 11. Admin Dashboard Scope

View/search users, ban/unban, view activity & notification context, view
moderation queue (flagged messages from CometChat), dismiss/ban from a flag, and
view per-course engagement analytics (messages, reactions, call-minutes) derived
from CometChat webhooks.

## 12. Assumptions

- One device token per user (single active session per platform).
- Course discussion = one CometChat **group** per course (`course-{courseId}`).
- CometChat App ID / Region / Auth Key are client-safe; the **REST API Key** is a
  server-only secret.
- Email delivery (SendGrid) is stubbed; in-app + push are the live channels.
- Payments are scaffolded (checkout + webhook placeholder), not a full gateway.

## 13. Out of Scope

- Full payment gateway settlement and instructor payouts automation.
- SLA management / ticket analytics for agent chat.
- AI-based ticket routing.
- Advanced LMS features (SCORM, proctoring, gradebook export).

## 14. Acceptance Criteria

See the assignment's Step 1 / Step 2 acceptance criteria. Status is tracked in
[`TESTING_NOTES.md`](./TESTING_NOTES.md). Headline: full-stack app functional,
auth + RBAC working, 100+ seeded users, role activities, app push working, and a
CometChat integration covering user sync, real-time chat, AI agents, moderation,
and a webhook use case — without breaking existing app workflows.

## 15. Testing Plan

Unit + integration tests (Vitest) for auth, error handling, course creation,
categories, and the push dispatcher; plus a live smoke pass against the running
API (health, auth, RBAC, agent, moderation proxy, webhook). See
[`TESTING_NOTES.md`](./TESTING_NOTES.md).

## 16. Demo Plan

Reproducible 20-step demo covering admin login, user management, a student
activity that fires an app push, CometChat 1:1 + group chat with presence/typing,
CometChat push, AI agent chat, a moderation trigger, and a webhook event landing
in the admin dashboard. See [`DEMO_GUIDE.md`](./DEMO_GUIDE.md).
