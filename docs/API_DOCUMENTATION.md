# API Documentation — CometLMS

- **Base URL:** `http://localhost:3000/api` (dev) — configurable via `PORT`
- **Format:** JSON
- **Auth:** `Authorization: Bearer <accessToken>` (JWT, 15-min expiry)
- **Refresh token:** 30-day expiry, exchanged at `POST /api/auth/refresh`

### Response envelope
```jsonc
// success
{ "success": true, "data": { /* ... */ } }
// error
{ "success": false, "error": "message", "issues": [ /* zod issues, 422 only */ ] }
```

### Status codes
| Code | Meaning |
|---|---|
| 200 / 201 | OK / Created |
| 204 | No content (deletes) |
| 401 | Missing/invalid token, or bad credentials |
| 403 | Authenticated but role not allowed |
| 404 | Not found |
| 409 | Conflict (unique constraint, e.g. duplicate slug/email) |
| 422 | Validation error (Zod) — includes `issues[]` |
| 500 | Internal error (generic message; details logged server-side) |

> **Dev mode:** when `DATABASE_URL` is unset the API serves mock data and uses an
> in-memory dev auth store (accounts `student@ / instructor@ / admin@learnloop.test`,
> password `Password123`). All write endpoints still validate input.

---

## Auth — `/api/auth`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | — | `{ email, password(min 8), name, role? }` | Creates user, syncs CometChat, returns tokens + `cometchatAuthToken` |
| POST | `/login` | — | `{ email, password }` | Returns user + tokens + `cometchatAuthToken` |
| POST | `/logout` | Bearer | — | Returns `{success:true}` (stateless; see note) |
| POST | `/refresh` | — | `{ refreshToken }` | New access/refresh + fresh `cometchatAuthToken` |
| GET | `/me` | Bearer | — | Current user (no password hash) |
| POST | `/dev-bypass-login` | — | `{ role: STUDENT\|INSTRUCTOR\|ADMIN }` | Dev/demo convenience login |

**Login 200 example**
```jsonc
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "STUDENT", "isActive": true },
    "tokens": { "accessToken": "jwt", "refreshToken": "jwt" },
    "cometchatAuthToken": "uuid_169..._xxx"  // single-use, used by client loginWithAuthToken()
  }
}
```
> `role` on register accepts only `STUDENT | INSTRUCTOR`. `logout` is currently a
> no-op server-side (JWT is stateless); the client discards tokens. Token
> revocation/blacklist is a recommended hardening item.

## Users — `/api/users`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | Bearer | List users (for chat directory) |
| GET | `/:id` | Bearer | Single user |
| GET | `/admin/all` | ADMIN, SUPER_ADMIN | Full user list |

## Categories — `/api/categories`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | — | List course categories |

## Courses — `/api/courses`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | optional | Published courses + requester's own drafts |
| GET | `/:id` | — | Course detail (sections + lessons) |
| POST | `/` | INSTRUCTOR/ADMIN/SUPER_ADMIN | Create course; provisions CometChat group |
| PATCH | `/:id` | INSTRUCTOR/ADMIN/SUPER_ADMIN | Update |
| POST | `/:id/publish` | INSTRUCTOR/ADMIN/SUPER_ADMIN | Publish + provision group + push to enrolled |
| POST | `/:id/unpublish` | INSTRUCTOR/ADMIN/SUPER_ADMIN | Archive + deactivate group |
| DELETE | `/:id` | INSTRUCTOR/ADMIN/SUPER_ADMIN | Delete + remove CometChat group |
| GET | `/:courseId/sections` | — | Sections + lessons |
| POST | `/:courseId/sections` | INSTRUCTOR+ | Create section |
| PATCH/DELETE | `/:courseId/sections/:sectionId` | INSTRUCTOR+ | Update / delete section |
| GET | `/:courseId/sections/:sectionId/lessons` | — | List lessons |
| GET | `/:courseId/sections/:sectionId/lessons/:lessonId` | — | Lesson detail |
| POST | `/:courseId/sections/:sectionId/lessons` | INSTRUCTOR+ | Create lesson |
| PATCH/DELETE | `.../lessons/:lessonId` | INSTRUCTOR+ | Update / delete lesson |
| POST | `/:courseId/lessons/:lessonId/complete` | Bearer | Mark lesson complete |
| GET | `/:courseId/progress` | Bearer | Progress % for current user |

**Create course body**
```jsonc
{ "title": "...", "slug": "...", "description": "...", "categoryId": "...",
  "price": 0, "currency": "USD", "level": "BEGINNER", "language": "English",
  "thumbnailUrl": "https://..." }
```

## Enrollments — `/api/enrollments`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | Bearer | Enroll `{ courseId }`; adds to CometChat group |
| GET | `/me` | Bearer | Current user's enrollments |
| DELETE | `/:courseId` | Bearer | Unenroll; removes from CometChat group |

## Quizzes — `/api/quizzes`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | INSTRUCTOR+ | Create quiz with questions |
| GET | `/:id` | Bearer | Quiz detail |
| POST | `/:id/submit` | Bearer | Submit answers → `{ score, passed }` |

## Notifications — `/api/notifications`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | Bearer | Notification feed |
| GET | `/unread` | Bearer | Unread list |
| GET | `/unread/count` | Bearer | Unread count |
| PATCH | `/:id/read` | Bearer | Mark one read |
| POST | `/mark-all-read` | Bearer | Mark all read |
| DELETE | `/:id` | Bearer | Delete notification |
| GET | `/push-preferences` | Bearer | `{ pushNotificationsEnabled }` |
| PATCH | `/push-preferences` | Bearer | Toggle push opt-in |
| POST | `/device-token` | Bearer | Register FCM token `{ token, platform }` (idempotent) |
| DELETE | `/device-token` | Bearer | Remove token (on logout) |

## Payments — `/api/payments`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/checkout` | Bearer | Start checkout (scaffold) |
| POST | `/webhook` | — | Provider webhook placeholder |

## Admin — `/api/admin` (ADMIN / SUPER_ADMIN)

| Method | Path | Notes |
|---|---|---|
| GET | `/stats` | Platform summary (users, messages today, pending flags, engagement score) |
| GET | `/users` | List/search/filter users |
| PATCH | `/users/:id/ban` | Deactivate user (+ CometChat ban) |
| PATCH | `/users/:id/unban` | Reactivate user |
| GET | `/engagement` | Per-course engagement analytics (from `CourseEngagementMetrics`) |
| GET | `/events/log` | Activity/event log view |
| GET | `/agents` | List configured AI agents |
| PATCH | `/agents/:id` | Toggle/update an agent |
| GET | `/moderation` | (legacy stub — prefer `/api/admin/moderation` below) |

## Moderation — `/api/admin/moderation` (ADMIN / SUPER_ADMIN)

Server-side proxy to CometChat's moderation API (keeps the REST key off the client).

| Method | Path | Notes |
|---|---|---|
| GET | `/` | List flagged messages (`?page`, `?limit`) |
| POST | `/:id/dismiss` | Approve/dismiss a flagged message |
| POST | `/:id/ban` | Dismiss flag + ban the sender (`{ uid }`) |

## AI Agents — `/api/chat/agents`

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/agents/message` | Bearer | `{ prompt, agentType?, courseId? }` | Groq LLM reply (`llama-3.3-70b-versatile`) |
| POST | `/agents/summarize` | Bearer | `{ messages | conversationId }` | Conversation summary |

**Agent message 200 example**
```jsonc
{ "success": true, "data": {
  "role": "assistant", "content": "A JavaScript closure is ...",
  "model": "llama-3.3-70b-versatile",
  "tokens": { "prompt_tokens": 110, "completion_tokens": 42, "total_tokens": 152 }
}}
```

## Webhooks — `/api/webhooks/cometchat/events`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/` | HMAC-SHA256 | CometChat engagement events; see [`COMETCHAT_WEBHOOKS.md`](./COMETCHAT_WEBHOOKS.md) |

## Health — `/api/health`
Returns `{ status: "ok", timestamp, queues: { healthy, notifications, events } }`.

---

## Auth flow (sequence)

```
Client → POST /api/auth/login {email,password}
API    → verify bcrypt → sign JWT (15m) + refresh (30m)
API    → CometChat: createUser(uid=user.id) [idempotent] + createAuthToken
API    → 200 { user, tokens, cometchatAuthToken }
Client → CometChatUIKit.loginWithAuthToken(cometchatAuthToken)
... 15 min later ...
Client → POST /api/auth/refresh {refreshToken} → new tokens + fresh cometchatAuthToken
```
