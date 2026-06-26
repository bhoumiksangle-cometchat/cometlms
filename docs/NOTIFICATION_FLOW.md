# Notification Flow

> **Scope:** This document describes how notifications are produced, queued, dispatched, and rendered across the CometLMS monorepo (`apps/api`, `apps/web`, `apps/mobile`) as of the `cometchat` branch (Phase 2).
>
> **Cross-references:**
> - [`COMETCHAT_INTEGRATION.md`](./COMETCHAT_INTEGRATION.md) — CometChat SDK wiring, group provisioning, auth.
> - [`COMETCHAT_WEBHOOKS.md`](./COMETCHAT_WEBHOOKS.md) — engagement-metric webhook (`POST /api/webhooks/cometchat/events`).
> - [`apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md) — AI agents + dashboard-native features.
> - [`TESTING_NOTES.md`](./TESTING_NOTES.md) — what is covered by automated/manual tests.

---

## 1. Two Coexisting Notification Systems

This is the single most important architectural fact about notifications in CometLMS: **there are two independent push systems running side by side.** They were *not* merged in Phase 2 — the existing app-push pipeline was deliberately **kept**, and CometChat-native push was **added alongside** it. Each owns a different class of notification.

| | **(1) App Push Pipeline** (Phase 1, KEPT) | **(2) CometChat-Native Push** (Phase 2, ADDED) |
|---|---|---|
| **Owns** | LMS activity: course published, @mentions (in-app + email) | Chat: new messages, mentions inside chat, incoming voice/video calls |
| **Delivery provider** | Firebase Cloud Messaging (FCM) via `firebase-admin` | Firebase / APNs, dispatched by **CometChat's** servers |
| **Server code involved** | `PushDispatcherService` + BullMQ `notifications` worker | None — configured entirely in the CometChat Dashboard |
| **Token registered with** | LMS backend (`POST /api/notifications/device-token`) | CometChat SDK (`CometChatNotifications.registerPushToken`) |
| **Gating** | `user.pushNotificationsEnabled` flag + stored `DeviceToken` | CometChat user presence / notification preferences |
| **Persistence / log** | `Notification` rows in Postgres | Not persisted in the LMS database |
| **Config surface** | Server `.env` (`FIREBASE_*`, `REDIS_URL`) | CometChat Dashboard → Notifications → Push |

### Why both?

The app push pipeline gives the LMS **full control over notification content and routing** for first-party events (a course going live, a discussion mention). CometChat push handles the **real-time chat/call** surface, which CometChat already models natively (delivery, presence, call signaling) — re-implementing that on top of the app pipeline would mean rebuilding a large part of the messaging stack.

> The two never collide on the wire: app push messages carry LMS data payloads (`type: course_published`, `type: mention`), while CometChat push messages carry CometChat data payloads (`type: chat | call`, `receiverType`, `receiver`). The **mobile foreground handler keys off `data['type']`** to tell them apart (see §7).

The CometChat docs note this explicitly — see [`apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md) ("Push Notifications (unchanged)"): the FCM pipeline and CometChat push are separate, and consolidating is *optional*, not done here.

---

## 2. App Push Architecture (System 1)

### 2.1 Components

| Component | File | Responsibility |
|---|---|---|
| Queue | `apps/api/src/lib/queue.ts` | BullMQ `notifications` queue on Redis; `attempts: 3`, exponential backoff (`delay: 2000ms`) |
| Worker | `apps/api/src/workers/notification.worker.ts` | Dequeues jobs; `processPushJob` runs the dispatch gate; concurrency 5 |
| Dispatcher | `apps/api/src/services/push-dispatcher.service.ts` | Wraps `firebase-admin`; builds FCM message; classifies errors |
| Service | `apps/api/src/services/notification.service.ts` | Persists `Notification` rows; routes email/push/in-app; enqueues push jobs |
| Routes | `apps/api/src/modules/notifications/notification.routes.ts` | Device-token CRUD, preferences, notification center endpoints |

### 2.2 Dispatch gate (`processPushJob`)

Every `type: 'push'` job runs through a strict gate in `notification.worker.ts`. The order matters — each gate is a cheap early-exit before the next, more expensive, check:

1. **Dispatcher initialized?** `pushDispatcherService.isEnabled()` — false when Firebase creds are missing/invalid → `skipped_disabled` (graceful degrade, no-op).
2. **User toggle on?** `user.pushNotificationsEnabled` (default `true`) — false → `skipped_disabled`.
3. **Device token exists?** one `DeviceToken` per user → none → `skipped_no_token`.
4. **Send via FCM** → `pushDispatcherService.send(...)`.
5. **Handle result:**
   - success → `sent`
   - `invalid-token` → **delete** the user's `DeviceToken` (`deleteMany`), return `token_invalidated` (job completes; **no retry**)
   - `transient` → **throw**, which triggers BullMQ retry with exponential backoff
   - `unknown` → `failed` (logged, no retry)

```ts
// notification.worker.ts (abridged)
if (!pushDispatcherService.isEnabled()) return { status: 'skipped_disabled' };          // gate 1
const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushNotificationsEnabled: true } });
if (!user || !user.pushNotificationsEnabled) return { status: 'skipped_disabled' };      // gate 2
const deviceToken = await prisma.deviceToken.findUnique({ where: { userId } });
if (!deviceToken) return { status: 'skipped_no_token' };                                  // gate 3
const result = await pushDispatcherService.send({ token: deviceToken.token, title, body: message, data });
if (result.error === 'invalid-token') { await prisma.deviceToken.deleteMany({ where: { userId } }); return { status: 'token_invalidated' }; }
if (result.error === 'transient')     { throw new Error('Transient FCM error — will retry'); }   // → BullMQ backoff
```

### 2.3 FCM message construction (`buildFcmMessage`)

`PushDispatcherService.buildFcmMessage` always sets, for a payload `{ token, title, body, data? }`:

| Field | Value |
|---|---|
| `notification.title` / `notification.body` | from the job |
| `webpush.fcmOptions.link` | `process.env.FRONTEND_URL` or `http://localhost:5173` |
| `android.notification.clickAction` | `OPEN_HOME` |
| `apns.payload.aps.category` | `DEFAULT` |
| `data` | included **only** when the job carries metadata |

### 2.4 Graceful degradation

`initialize()` reads `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. If any is missing, it logs an error and sets `enabled = false` — **the server still starts normally** and every push job short-circuits at gate 1. This makes Firebase strictly optional for local/dev runs.

---

## 3. Device Token Lifecycle

A user has **exactly one** `DeviceToken` (Postgres `userId UNIQUE`). Registration is an idempotent upsert.

### 3.1 Endpoints (`notification.routes.ts`, all `requireAuth`)

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/api/notifications/device-token` | Validates `token` (non-empty string) + `platform` (`web`/`android`/`ios`); if identical to stored record, returns success **without** touching `updatedAt`; otherwise upserts on `userId` |
| `DELETE` | `/api/notifications/device-token` | `deleteMany({ where: { userId } })` — called on logout; no error if nothing stored |
| `GET` | `/api/notifications/push-preferences` | Returns `{ pushNotificationsEnabled }` |
| `PATCH` | `/api/notifications/push-preferences` | Sets the toggle; rejects non-boolean `enabled` with `400` |

### 3.2 The `pushNotificationsEnabled` flag

Lives on the `User` model, **defaults to `true`**, and is the per-user master switch checked at gate 2. Toggling it off does not delete the device token — pushes are simply skipped while it is off.

---

## 4. Persistence & Notification Center

### 4.1 Persistence

`NotificationService.sendNotification` writes a `Notification` row **on every send**, regardless of type, before dispatching:

```prisma
model Notification {
  id        String           @id @default(uuid())
  userId    String
  type      NotificationType // EMAIL | PUSH | IN_APP
  title     String
  message   String
  data      Json?
  read      Boolean          @default(false)
  createdAt DateTime         @default(now())
}
```

The service maps the lowercase app-level type (`email`/`push`/`in_app`) onto the uppercase Prisma enum (`EMAIL`/`PUSH`/`IN_APP`).

### 4.2 End-user notification center (web)

The **bell dropdown** lives in `apps/web/src/pages/index.tsx`:

- Polls `GET /api/notifications/unread/count` every **30s** (`setInterval(fetchUnreadCount, 30000)`).
- On open, fetches `GET /api/notifications` (latest 50).
- Mark one read → `PATCH /api/notifications/:id/read`; mark all → `POST /api/notifications/mark-all-read`.

> **Honest gap:** there is **no dedicated admin notification-log view**. Admins cannot browse a global feed of notifications/dispatch outcomes today. The `Notification` table is the source of truth, but only per-user reads are exposed. This is **future work**.

---

## 5. App Notification Triggers

| Trigger | Where | Channel(s) | Status |
|---|---|---|---|
| **Course published** | `apps/api/src/modules/courses/course.routes.ts` (`POST /:id/publish`) | PUSH to every enrolled student | **Wired** |
| **@mention** | `notification.service.ts` (`sendMentionNotification`) | IN_APP + EMAIL | **Wired** |
| Enrollment welcome | `sendEnrollmentNotification` | EMAIL | helper exists, **not wired** |
| Course completion | `sendCompletionNotification` | EMAIL | helper exists, **not wired** |
| New student (to instructor) | `sendNewStudentNotification` | IN_APP | helper exists, **not wired** |

### Course-published trigger (detail)

On publish, after the response is sent, the route fire-and-forgets a fan-out: it loads all enrollments and enqueues one push job per enrolled `userId`. No pre-filtering on toggle/token happens here — that's the worker's job (gate 2/3), so it is safe to enqueue for everyone:

```ts
prisma.enrollment.findMany({ where: { courseId: published.id }, select: { userId: true } })
  .then((enrollments) => {
    for (const { userId } of enrollments) {
      addNotificationJob({
        userId, type: 'push',
        title: 'New course published!',
        message: `"${published.title}" is now live and ready to explore.`,
        data: { type: 'course_published', courseId: published.id, courseTitle: published.title },
      }, { priority: 3 });
    }
  });
```

---

## 6. Web Client (System 1)

| File | Role |
|---|---|
| `apps/web/src/lib/firebase-messaging.ts` | `requestPermissionAndRegisterToken()` (permission → `getToken(vapidKey)` → `POST /device-token` as `platform: 'web'`), `onTokenRefresh()`, `onForegroundMessage()`, `removeDeviceToken()` |
| `apps/web/public/firebase-messaging-sw.js` | Service worker; `onBackgroundMessage` → `showNotification(title, body)`; `notificationclick` → focus existing tab or open `/` |
| `apps/web/src/components/NotificationPrompt.tsx` | Toast prompting the user to enable notifications; persists dismissal in `localStorage` |

`firebase-messaging.ts` initializes Firebase only if `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` are present — otherwise push is silently disabled on the web client (mirrors the server's graceful degrade).

---

## 7. Mobile Client (Systems 1 **and** 2)

`apps/mobile/lib/core/services/push_notification_service.dart` is where the two systems visibly converge on one device. It uses `firebase_messaging` + `flutter_local_notifications`.

**On startup / login it registers the same FCM token with BOTH backends:**

1. **LMS backend** — `_registerTokenWithBackend(token, platform)` → `POST /api/notifications/device-token` (`platform` = `'ios'` or `'android'`). Feeds **System 1**.
2. **CometChat** — `registerTokenWithCometChat()`:
   - Android → `CometChatNotifications.registerPushToken(PushPlatforms.FCM_FLUTTER_ANDROID, fcmToken: token, providerId: 'fcm-provider')`
   - iOS → fetches the APNs token and calls `registerPushToken(PushPlatforms.APNS_FLUTTER_DEVICE, deviceToken: apnsToken, providerId: 'apns-provider')`
   - Feeds **System 2**.

   Token refresh (`listenForTokenRefresh`) re-registers with **both**.

**Channels & foreground handling:**

- Two Android channels are created: `default_channel` (high importance) and a dedicated **`call_channel`** (max importance, sound + vibration).
- The foreground handler (`configureForegroundHandler`) inspects `data['type']`:
  - `chat` / `call` → CometChat push → formats title/body from CometChat data fields.
  - `call` specifically → shown on `call_channel` with `Importance.max`, `Priority.max`, `AndroidNotificationCategory.call`, **`fullScreenIntent: true`**, `ongoing`, and `interruptionLevel: timeSensitive` on iOS (true incoming-call UX).
  - anything else → app push → `default_channel`.

**Tap routing** (`_handleNotificationNavigation`): CometChat data includes `receiverType` (`user`/`group`) and `receiver`. It resolves the full `CometChat.getUser` / `getGroup` object and deep-links to **`/messages`** (falling back to home on failure).

**Logout:** `unregisterTokenFromCometChat()` + `removeToken()` (`DELETE /api/notifications/device-token`).

---

## 8. CometChat Push (System 2)

CometChat push is configured **in the CometChat Dashboard** (Notifications → Push Notifications), not in this codebase. The only client-side code is the token registration in `push_notification_service.dart` (§7). It delivers **message and call** notifications to offline/background users. It runs strictly **alongside** app push — see the boundary in §1.

For the related dashboard-native features (AI agent replies, moderation, smart replies) and the one remaining server webhook (engagement metrics), see [`apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md) and [`COMETCHAT_WEBHOOKS.md`](./COMETCHAT_WEBHOOKS.md).

---

## 9. Sequence Diagrams

### 9.1 Device-token registration (App Push, System 1)

```mermaid
sequenceDiagram
    actor User
    participant Client as Web/Mobile Client
    participant FCM as FCM (token issuer)
    participant API as LMS API
    participant DB as Postgres

    User->>Client: Login / grant notification permission
    Client->>FCM: getToken(vapidKey) / getToken()
    FCM-->>Client: FCM device token
    Client->>API: POST /api/notifications/device-token {token, platform}
    API->>DB: findUnique(DeviceToken by userId)
    alt identical token already stored
        DB-->>API: existing record
        API-->>Client: 200 (no write, updatedAt unchanged)
    else new or changed token
        API->>DB: upsert(DeviceToken on userId)
        DB-->>API: record
        API-->>Client: 200 {id, userId, platform, updatedAt}
    end
```

### 9.2 App event → queue → worker → FCM dispatch (with gate checks)

```mermaid
sequenceDiagram
    participant Trigger as Event Trigger (e.g. course publish)
    participant Queue as BullMQ "notifications" (Redis)
    participant Worker as notification.worker (processPushJob)
    participant DB as Postgres
    participant Disp as PushDispatcherService
    participant FCM as FCM

    Trigger->>Queue: addNotificationJob({type:'push', userId, title, message, data})
    Queue->>Worker: dequeue job
    Worker->>Disp: isEnabled()?
    alt dispatcher disabled (no Firebase creds)
        Disp-->>Worker: false
        Worker-->>Queue: skipped_disabled (no-op)
    else enabled
        Worker->>DB: user.pushNotificationsEnabled?
        alt toggle off / no user
            DB-->>Worker: false
            Worker-->>Queue: skipped_disabled
        else toggle on
            Worker->>DB: deviceToken.findUnique(userId)
            alt no token
                DB-->>Worker: null
                Worker-->>Queue: skipped_no_token
            else token exists
                Worker->>Disp: send({token, title, body, data})
                Disp->>FCM: messaging().send(message)
                alt success
                    FCM-->>Disp: ok
                    Worker-->>Queue: sent
                else invalid-token
                    FCM-->>Disp: invalid-registration-token
                    Worker->>DB: deviceToken.deleteMany(userId)
                    Worker-->>Queue: token_invalidated (no retry)
                else transient (5xx / unavailable)
                    FCM-->>Disp: messaging/unavailable
                    Worker--xQueue: throw → exponential backoff retry
                end
            end
        end
    end
```

### 9.3 CometChat push registration (System 2, mobile)

```mermaid
sequenceDiagram
    actor User
    participant App as Flutter App
    participant FCM as FCM / APNs
    participant CC as CometChat
    participant API as LMS API

    User->>App: Login (CometChat session active)
    App->>FCM: getToken() / getAPNSToken()
    FCM-->>App: device token
    par Register with LMS (System 1)
        App->>API: POST /api/notifications/device-token {token, platform}
        API-->>App: 200
    and Register with CometChat (System 2)
        App->>CC: CometChatNotifications.registerPushToken(FCM_FLUTTER_ANDROID / APNS_FLUTTER_DEVICE)
        CC-->>App: onSuccess
    end
    Note over CC: CometChat now pushes chat & call<br/>notifications directly to this device
```

---

## 10. Error-Handling Reference (App Push)

| Scenario | Detection | Behavior |
|---|---|---|
| Invalid / unregistered token | `messaging/invalid-registration-token`, `messaging/registration-token-not-registered` | `error: 'invalid-token'` → worker **deletes** the `DeviceToken`; job completes (no retry) |
| Transient FCM error | `messaging/unavailable`, `messaging/internal-error`, or HTTP `5xx` | `error: 'transient'` → worker **throws** → BullMQ exponential backoff retry (max 3 attempts) |
| Missing Firebase creds | `initialize()` finds a missing env var | `enabled = false`; server runs; push jobs **graceful-degrade** (no-op) |
| User toggle off | `user.pushNotificationsEnabled === false` | push **skipped**; job completes |
| No device token | `DeviceToken` lookup returns `null` | push **skipped**; job completes |
| Unknown error | any other FCM error | `error: 'unknown'` → logged; job marked `failed` (no token deletion, no retry) |

---

## 11. Environment Variables

> Use placeholders below; **never commit real values.** See [`TESTING_NOTES.md`](./TESTING_NOTES.md) "Known Issues" — secrets currently committed to `.env` should be rotated.

### Server (`apps/api`)

| Variable | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` | `<your-firebase-project-id>` |
| `FIREBASE_CLIENT_EMAIL` | `<service-account>@<project>.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n<...>\n-----END PRIVATE KEY-----\n"` (escaped `\n` is un-escaped at init) |
| `REDIS_URL` | `redis://localhost:6379` (BullMQ connection) |
| `FRONTEND_URL` | used for `webpush.fcmOptions.link` (defaults to `http://localhost:5173`) |

### Web (`apps/web`, Vite — `VITE_` prefix exposes to client)

| Variable | Purpose |
|---|---|
| `VITE_FIREBASE_API_KEY` | `<web-api-key>` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `<your-firebase-project-id>` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `<sender-id>` |
| `VITE_FIREBASE_APP_ID` | `<web-app-id>` |
| `VITE_FIREBASE_VAPID_KEY` | `<web-push-vapid-key>` |

> **Note:** `apps/web/public/firebase-messaging-sw.js` currently has the Firebase web config **hard-coded** (service workers cannot read `import.meta.env`). The web API key there is not a secret in the OAuth sense, but the values should still match your project and be reviewed before publishing. Tracked in `TESTING_NOTES.md`.
