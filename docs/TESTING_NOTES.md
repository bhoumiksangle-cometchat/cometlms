# Testing Notes

> **Scope:** Automated and manual test coverage for the CometLMS monorepo on the `cometchat` branch (Phase 2).
>
> **Cross-references:**
> - [`NOTIFICATION_FLOW.md`](./NOTIFICATION_FLOW.md) — the push pipelines these tests exercise.
> - [`COMETCHAT_INTEGRATION.md`](./COMETCHAT_INTEGRATION.md) — CometChat wiring (stubbed in tests).
> - [`COMETCHAT_WEBHOOKS.md`](./COMETCHAT_WEBHOOKS.md) — engagement webhook (manual smoke only).
> - [`apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md) — dashboard-native features (manual smoke only).

---

## 1. Test Stack

| Layer | Tool | Command |
|---|---|---|
| Unit / API integration | **Vitest** | `npm test` (→ `vitest`) |
| API route tests | **supertest** (on Express apps built in-test) | part of `npm test` |
| Browser end-to-end | **Playwright** | `npm run test:e2e` (→ `playwright test`) |

All commands run **from the repo root**. The `package.json` root scripts are:

```jsonc
"test":     "vitest",
"test:e2e": "playwright test"
```

---

## 2. Current Result (verified)

Verified by running `npx vitest run` from the repo root:

```
 Test Files  4 passed (4)
      Tests  64 passed (64)
   Duration  ~0.85s
```

| Suite | Tests | What it covers |
|---|---:|---|
| `tests/push-dispatcher.service.test.ts` | 15 | FCM message construction + `send()` success/error classification |
| `tests/error-handler.test.ts` | 19 | Central error → HTTP status mapping |
| `tests/categories.test.ts` | 13 | Dev-mode mock path vs production Prisma path |
| `tests/course-creation.test.ts` | 17 | Dev-mode mock create vs production validation/constraints |

### 2.1 `push-dispatcher.service.test.ts` (15)

Mocks `firebase-admin`. Asserts:

- **`buildFcmMessage`:** `notification.title`/`body`; `webpush.fcmOptions.link` from `FRONTEND_URL` (and the `http://localhost:5173` default when unset); `android.notification.clickAction === 'OPEN_HOME'`; `apns.payload.aps.category === 'DEFAULT'`; `data` present only when payload carries data.
- **`send`:** success → `{ success: true }`; `messaging/invalid-registration-token` and `registration-token-not-registered` → `invalid-token`; `messaging/unavailable`, `messaging/internal-error`, and HTTP `5xx` → `transient`; unrecognized → `unknown`; disabled service → `unknown`.

### 2.2 `error-handler.test.ts` (19)

Drives `errorHandler` middleware directly with mocked `req/res/next`:

- **ZodError → 422** with `success: false`, `error: 'Validation error'`, and an `issues[]` array carrying `path` + `message`.
- **Prisma** `P2002` → **409** ("already exists"); `P2003` → **400** ("does not exist"); `P2025` → **404**; unknown `Pxxxx` → 400 with the code echoed.
- **`AppError`** honors its `statusCode`; 500-class errors return the generic `Internal server error` (never leak raw text).
- **Generic `Error` → 500** with a generic message.

### 2.3 `categories.test.ts` (13)

`GET /api/categories` via supertest, mocking the server `prisma` singleton:

- **Dev mode (no `DATABASE_URL`):** 200, `success: true`, an array of **exactly 6 stable mock categories** (`cat-1`…), IDs stable across requests, and **asserts Prisma is NOT called**.
- **Production mode (`DATABASE_URL` set):** calls `prisma.category.findMany({ orderBy: { name: 'asc' } })`, returns DB rows, empty array when none, forwards DB errors as 500, and does **not** leak the dev mock IDs.

### 2.4 `course-creation.test.ts` (17)

`POST /api/courses` via supertest, mocking the server `prisma` (including `$transaction`) and auth middleware (injects a fake `INSTRUCTOR`):

- **Dev mode:** returns **201** with a mock course; `partial()` schema accepts incomplete bodies; `instructorId` comes from the **auth token** (`instructor-test`), not the body; Prisma not called.
- **Production mode:** missing `title`/`slug`/`description` or empty body → **422** (with `issues[]`); invalid `level` enum → 422; `P2003` → **400** ("does not exist"); `P2002` → **409** ("already exists"); valid payload → **201**.

> **Expected non-fatal noise:** in production-success cases this suite logs
> `[Courses] provisionCourseGroup(...) failed (non-fatal): Cannot read properties of undefined (reading 'findUnique')`.
> This is **expected** — CometChat group provisioning is stubbed in tests, and the route deliberately treats provisioning failure as non-fatal. It does **not** fail the test.

---

## 3. How to Run

```bash
# from repo root

# Full unit/integration suite (watch mode)
npm test

# Full suite, single run (CI-style)
npx vitest run

# A single file
npx vitest run tests/push-dispatcher.service.test.ts

# Filter by test name
npx vitest run -t "invalid-token"

# End-to-end (Playwright)
npm run test:e2e
```

---

## 4. Coverage: Covered vs NOT Covered

### Covered

- Central error handling (Zod → 422, Prisma constraint mapping, 500 sanitization).
- Dev-mode mock paths for categories and course creation (and the assertion that they bypass Prisma).
- FCM push **message construction** and **error classification**.
- Course-creation **validation** and **auth-sourced `instructorId`**.

### NOT covered yet (honest gaps)

| Gap | Notes |
|---|---|
| CometChat integration | No automated tests — CometChat is stubbed/mocked everywhere. Provisioning, AI agents, push (System 2) verified by **manual smoke** only. |
| Mobile (Flutter) | No automated Dart/Flutter tests for `push_notification_service.dart` or anything else in `apps/mobile`. |
| Playwright e2e | Configured (`test:e2e`) but **minimal** — not a meaningful browser coverage layer yet. |
| Auth / RBAC routes | No automated route-level RBAC tests (course-creation mocks auth away). Covered by manual smoke (§5). |
| Worker dispatch gate (end-to-end) | The dispatcher is unit-tested, but `processPushJob`'s gate logic against a real Redis/Prisma is not yet exercised by an integration test (see §6). |

---

## 5. Manual / Smoke Test Checklist

Reproducible smoke pass. **Dev-mode bypass accounts** (password `Password123`, also via `POST /api/auth/dev-bypass-login`):

| Email | Role |
|---|---|
| `student@learnloop.test` | STUDENT |
| `instructor@learnloop.test` | INSTRUCTOR |
| `admin@learnloop.test` | ADMIN |

Checklist:

1. **Health endpoint** responds (`GET /api/health` or equivalent).
2. **Register / login** succeeds; JWT issued.
3. **RBAC:** a STUDENT token is **blocked** from admin-only routes (403).
4. **CometChat 1-1 message** delivers between two users.
5. **CometChat group message** delivers in a `course-<id>` group.
6. **Office-hours call** connects (voice/video).
7. **AI study assistant** replies when @mentioned in a course group (dashboard-configured agent).
8. **Moderation:** dismiss a flag / ban a user via the moderation surface.
9. **Webhook → engagement metrics:** a CometChat event hits `POST /api/webhooks/cometchat/events` and increments the relevant `CourseEngagementMetrics` counter (messages/reactions/call-minutes).

---

## 6. Property-Based / Correctness Test Plan

Distilled from [`.kiro/specs/push-notifications/design.md`](../.kiro/specs/push-notifications/design.md). These are the correctness **properties** the push system should uphold; several map directly onto existing unit tests, the rest are the recommended next layer.

| # | Property | Statement | Status |
|---|---|---|---|
| P1 | **Token upsert semantics** | Registering a token yields exactly one `DeviceToken` per user, holding the most-recent token. | plan |
| P2 | **Registration idempotence** | Re-registering an identical token does not modify the record (`updatedAt` unchanged). | route-implemented; test = plan |
| P3 | **Invalid input rejection** | Empty / whitespace-only / missing token → HTTP 400. | route-implemented; test = plan |
| P4 | **Logout removes token** | Logout removal leaves zero `DeviceToken` rows for the user. | plan |
| P5 | **Dispatch gate** | Toggle off → FCM not called; no token → FCM not called; toggle on **and** token present → FCM called with that token. | partial (dispatcher unit-tested) |
| P6 | **Default toggle true** | A newly created user has `pushNotificationsEnabled = true`. | schema-enforced; test = plan |
| P7 | **Invalid-token cleanup** | FCM invalid/unregistered → delete the `DeviceToken`; job completes (no retry). | **covered** (classification) + plan (deletion) |
| P8 | **Payload structure invariant** | FCM message always carries title, body, home-screen click action, and metadata when present. | **covered** |
| P9 | **Service-worker display** | SW `showNotification` is called with the exact title/body. | plan |
| P10 | **Graceful degradation** | Missing/malformed creds → server starts, dispatcher `enabled = false`, push jobs skipped without error. | partial (disabled-send unit-tested) |
| P11 | **Toggle round-trip** | `PATCH` a boolean then `GET` returns the same boolean. | plan |

Recommended next layers (from the design's testing strategy): a worker integration test for the full dispatch gate (real Redis + Prisma + mocked FCM), the logout-with-no-token edge case, and concurrent same-user upsert safety.

---

## 7. Known Issues Surfaced During Review

Tracked so they don't get lost. None block the passing test suite; most are correctness/hygiene debt.

| # | Issue | Detail | Suggested action |
|---|---|---|---|
| 1 | **Moderation route shadowing** | Legacy empty stub routes in `admin.routes.ts` are mounted **before** the real `moderation-api.routes.ts`, shadowing the working handlers. | Remove the legacy stubs or fix mount order. |
| 2 | **`aiAgentConfig` model dropped but still queried** | The model was removed from the schema yet code still references it (caught during review). | Delete the dead query path. |
| 3 | **No admin notification-log endpoint** | No global admin view of notifications/dispatch outcomes (see `NOTIFICATION_FLOW.md` §4.2). | Add an admin-scoped log endpoint. |
| 4 | **CometChat tags unused** | Role is carried in metadata rather than CometChat tags; tag-based filtering unavailable. | Adopt tags or document the metadata convention. |
| 5 | **Schema / migration drift** | Legacy tables present in baseline SQL that no longer match the Prisma schema. | Reconcile baseline migration with current schema. |
| 6 | **Locale default drift** | `Course.currency` defaults to `CNY` and `Course.language` to `zh-CN` — likely unintended defaults. | Confirm intended defaults; adjust if needed. |
| 7 | **Two JWT token shapes + weak fallback secrets** | Two distinct token shapes in use, with weak fallback signing secrets. | Unify token shape; require a strong secret (fail closed). |
| 8 | **Secrets committed in `.env`** | Real secrets are committed. The web Firebase config is also hard-coded in `apps/web/public/firebase-messaging-sw.js`. | **Rotate** all committed secrets; gitignore `.env`. |
| 9 | **iOS CometChat version mismatch** | `apps/mobile` iOS `Podfile.lock` pins CometChat **v5** while `pubspec.yaml` declares **v6**. | Re-resolve pods to match `pubspec`. |
| 10 | **Orphaned `socket.io-client` dependency** | Dependency present but unused (in-app delivery is logged, not wired to a live socket). | Remove the dependency or finish the Socket.IO path. |

---

## 8. Quick Reference

```bash
npx vitest run                                   # 4 files, 64 tests, ~0.85s
npx vitest run tests/push-dispatcher.service.test.ts
npm run test:e2e                                 # Playwright (minimal)
```
