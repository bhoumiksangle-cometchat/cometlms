# Database Design — CometLMS

- **Engine:** PostgreSQL 16
- **ORM:** Prisma (`apps/api/prisma/schema.prisma`)
- **IDs:** UUID v4 (`@default(uuid())`) everywhere
- **Naming:** `camelCase` in code, `snake_case` columns via `@map`
- **Timestamps:** `createdAt` / `updatedAt` (`@updatedAt`) on mutable entities

> Note: `Course.currency` defaults to `CNY` and `Course.language` to `zh-CN` in
> the schema, while the seed data uses `USD` / `English`. Override per course on
> creation.

---

## Entity overview

| Domain | Models |
|---|---|
| Identity & access | `User`, `DeviceToken` |
| Catalog | `Category`, `Course`, `Section`, `Lesson` |
| Learning progress | `Enrollment`, `LessonCompletion`, `Quiz`, `Question`, `QuizAttempt`, `Certificate`, `Review` |
| Commerce | `Payment`, `Payout` |
| Notifications | `Notification`, `DeviceToken` |
| Live & engagement | `LiveSession`, `SessionRecording`, `CourseEngagementMetrics` |

## Enums

- `UserRole`: `STUDENT | INSTRUCTOR | ADMIN | SUPER_ADMIN | AI_AGENT`
- `CourseStatus`: `DRAFT | PUBLISHED | ARCHIVED`
- `CourseLevel`: `BEGINNER | INTERMEDIATE | ADVANCED`
- `PaymentStatus`: `PENDING | COMPLETED | FAILED | REFUNDED`
- `PayoutStatus`: `PENDING | COMPLETED | FAILED`
- `NotificationType`: `EMAIL | PUSH | IN_APP`

---

## Key tables

### User
The identity record. CometChat UID == `User.id` (no separate mapping table).
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Also the CometChat UID |
| email | string unique | login identity |
| passwordHash | string | bcrypt (cost 12); stripped from all API responses |
| name, avatarUrl, bio | string | profile |
| role | UserRole | drives RBAC |
| isActive | bool | soft-deactivate / ban flag |
| isVerified | bool | email verification |
| pushNotificationsEnabled | bool | per-user push opt-out gate |

Relations: `taughtCourses`, `enrollments`, `lessonCompletions`, `quizAttempts`,
`payments`, `payouts`, `notifications`, `reviews`, `certificates`,
`liveSessions`, `deviceToken (1:1)`.

### Course
| Column | Notes |
|---|---|
| instructorId (FK→User) | owner; becomes CometChat group owner/admin |
| slug | unique |
| status | DRAFT/PUBLISHED/ARCHIVED |
| cometchatGroupId | unique; the CometChat group guid (`course-{id}`), column `chat_room_id` |
| price, currency, level, language | catalog metadata |

`Course → Section → Lesson` is the content hierarchy. `LessonCompletion`
(`@@unique([userId, lessonId])`) tracks per-user progress.

### Enrollment
`@@unique([userId, courseId])` — a student enrolls once per course. Enrolling/
unenrolling adds/removes the student from the course's CometChat group.

### Quiz / Question / QuizAttempt
`Question.options` and `QuizAttempt.answers` are `Json`. Attempts store `score`
and `passed` (passing score default 60).

### Notification & DeviceToken
- `Notification` — in-app notification feed (`type`, `title`, `message`, `data`, `read`).
- `DeviceToken` — `@@unique(userId)` so one push token per user; `onDelete: Cascade`;
  `platform` ∈ `web | android | ios`. Table mapped to `device_tokens`.

### CourseEngagementMetrics  ← fed by CometChat webhooks
| Column | Source |
|---|---|
| courseId + date | `@@unique([courseId, date])` daily rollup |
| totalMessages | webhook `message_new` |
| totalReactions | webhook `message_reaction_added` |
| callMinutes | webhook `call_ended` (duration → minutes) |
| activeChatters | reserved |
| flaggedMessages / resolvedFlags | reserved for moderation rollups (see gaps) |

This table is the **persistence target of the CometChat webhook** and the data
source for the admin engagement analytics endpoint. See
[`COMETCHAT_WEBHOOKS.md`](./COMETCHAT_WEBHOOKS.md).

### Payment / Payout
Commerce scaffolding. `Payment` indexed by `userId`, `courseId`, `status`.
`provider` ∈ `stripe | alipay | wechat`. Full settlement is out of scope.

### LiveSession / SessionRecording
Live class metadata (provider default `livekit`) and recording references.

### Review / Certificate
`@@unique([userId, courseId])` each — one review and one certificate per
user/course.

---

## Relationships (text ER)

```
User 1───* Course (instructor)
User *───* Course  via Enrollment
Category 1───* Course
Course 1───* Section 1───* Lesson
Lesson 1───* LessonCompletion *───1 User
Section 1───* Quiz 1───* Question
Quiz 1───* QuizAttempt *───1 User
Course 1───* CourseEngagementMetrics   (one row per day)
User 1───1 DeviceToken
User 1───* Notification
Course 1───* Payment ; User 1───* Payment
Course 1───* Review / Certificate ; User 1───* Review / Certificate
Course 1───* LiveSession 1───* SessionRecording
```

## CometChat ↔ DB mapping

| CometChat concept | DB anchor |
|---|---|
| User UID | `User.id` |
| User display name / avatar | `User.name` / `User.avatarUrl` |
| Group (course discussion) | `Course.cometchatGroupId` = `course-{Course.id}` |
| Group owner/admin | `Course.instructorId` |
| Group members | `Enrollment` rows for the course |
| Engagement events | `CourseEngagementMetrics` (via webhook) |

## Migrations & seeding

- Migrations: `apps/api/prisma/migrations/*`
- Generate client: `npm run prisma:generate -w apps/api`
- Seed (103 users + categories + courses): `npm run seed -w apps/api`
  - `prisma/seed.ts` — 3 named accounts + 85 students + 10 instructors + 5 admins
  - `prisma/seed-bots.ts` — 3 `AI_AGENT` bots + 1 `SUPER_ADMIN`

### Known schema drift (action item)
The baseline migration `20260611105210_baseline` still creates legacy tables/enums
from the pre-CometChat design (`AiAgentConfig`, `ChatRoom`, `ModerationStatus`,
`MessageContentType`, etc.) that were removed from `schema.prisma` when the project
moved to CometChat-native chat. These tables are created by the migration but have
no Prisma model. Recommended fix: add a corrective migration that drops the unused
tables so the migration history matches the schema.
