# Demo Guide — CometLMS (LearnLoop)

> A reproducible, step-by-step demo of the production LMS (**Step 1**) and the **CometChat
> integration** (**Step 2**). The numbered script maps to the assignment's suggested 20-step
> demo flow.
>
> Related docs: [`DECISION_LOG.md`](./DECISION_LOG.md) (why each choice was made) ·
> [`SCOPE_OF_WORK.md`](./SCOPE_OF_WORK.md) · [`../DEPLOYMENT.md`](../DEPLOYMENT.md) ·
> [`../apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md) ·
> `COMETCHAT_SKILLS_USAGE.md`

---

## 1. Prerequisites & Startup

You can run the app two ways. **Path A (Docker)** is the closest to the deployed environment
and runs migrations + seed automatically. **Path B (local dev)** is best for live-editing.

> **About CometChat keys:** for the *full* chat/calls/AI/moderation/webhook experience, the
> CometChat **Dashboard** must be configured (extensions enabled, AI agents created, webhook
> URL + secret set — see [§7](#7-configure-cometchat-dashboard)). **Without CometChat keys the
> app still runs** — login, courses, quizzes, enrollments, admin, FCM push, and all non-chat
> workflows work; the chat layer simply **degrades gracefully** (server CometChat calls no-op,
> the in-app chat panes show a "connecting"/empty state). This is by design (see
> `DECISION_LOG.md` Decisions 8–9).

### Path A — Docker (recommended)

```bash
# 1. From the repo root
cp .env.example .env

# 2. Fill in values marked CHANGE_ME (use placeholders — never commit real secrets):
#    POSTGRES_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET   (openssl rand -base64 48)
#    COMETCHAT_APP_ID, COMETCHAT_REGION, COMETCHAT_AUTH_KEY, COMETCHAT_REST_API_KEY
#    COMETCHAT_WEBHOOK_SECRET                              (any random string)
#    FIREBASE_* / VITE_FIREBASE_*                          (optional — for push)

# 3. Build and start everything (postgres, redis, api, web)
docker compose up -d --build
```

- First build takes ~3–5 min; **migrations and the seed run automatically** on first start.
- Web app: **http://localhost** (or `http://localhost:${WEB_PORT}` if you changed `WEB_PORT`).
  API: **:3000** (Nginx proxies `/api/*` → `api:3000` internally).
- Verify:
  ```bash
  curl http://localhost:3000/api/health        # → {"status":"ok", ...}
  curl -s http://localhost/ | grep '<title>'   # → <title>LearnLoop LMS</title>
  ```

> The default `docker-compose.yml` maps the web container to host port **80**. If port 80 is
> taken, set `WEB_PORT=8080` in `.env` and re-run `docker compose up -d web`.

### Path B — Local Dev

```bash
# 1. Install workspace deps from the repo root
npm install

# 2. Provision PostgreSQL 16 and Redis 7 (locally or via Docker), then set
#    DATABASE_URL and REDIS_URL in apps/api/.env (plus JWT_* and COMETCHAT_* as above).

# 3. Create the schema and seed demo data
cd apps/api
npx prisma generate
npx prisma db push
npm run seed            # seeds users, categories, courses, bots, super-admin

# 4. Start web + API together (from the repo root)
cd ../..
npm run dev
```

- Frontend (Vite): **http://localhost:5173**
- API (Express): **http://localhost:3000**

---

## 2. Seeded Demo Accounts

The seed (`apps/api/prisma/seed.ts` + `seed-bots.ts`) creates **~107 users**. **All human
accounts share the password `Password123`.** Bot accounts never log in by password.

### Primary accounts (use these to drive the demo)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@learnloop.test` | `Password123` |
| Instructor | `instructor@learnloop.test` | `Password123` |
| Student | `student@learnloop.test` | `Password123` |

### Bulk & system accounts

| Set | Count | Pattern | Role | Password |
|-----|-------|---------|------|----------|
| Bulk students | 85 | `student1@learnloop.test` … `student85@learnloop.test` | STUDENT | `Password123` |
| Bulk instructors | 10 | `instructor1@learnloop.test` … `instructor10@learnloop.test` | INSTRUCTOR | `Password123` |
| Bulk admins | 5 | `admin1@learnloop.test` … `admin5@learnloop.test` | ADMIN | `Password123` |
| Super admin | 1 | `superadmin@learnloop.test` | SUPER_ADMIN | `Password123` |
| AI agents (bots) | 3 | `faq-bot@system.local`, `study-assistant@system.local`, `instructor-copilot@system.local` | AI_AGENT | *(no password login)* |

That's **3 named + 85 + 10 + 5 + 1 + 3 = 107 users**. The 3 bots — **FAQ Bot**,
**Study Assistant**, **Instructor Copilot** — exist as `AI_AGENT` user rows; their *behaviour*
(LLM, prompt, knowledge base) is configured in the **CometChat AI Agent Builder**, not the DB.

Seeded content: 2 published courses — **"React Foundations for Product Teams"**
(`react-foundations`, free) and **"Production Node.js APIs"** (`production-node-apis`, paid) —
each pre-wired with a CometChat group id `course-{courseId}`.

> **Dev-bypass login:** the web app ships a **DevBypass** control (and the auth flow has a dev
> path) that lets you jump into a role without typing credentials — handy for quickly showing
> the student vs. instructor vs. admin surfaces during a demo. Use the seeded accounts above
> for the "real" login walkthrough.

---

## 3. The 20-Step Demo Script

Each step lists the **action** and the **route** in *this* app. Routes come from
`apps/web/src/pages/index.tsx`. Run the whole thing in ~15–20 minutes.

> **Tip:** keep two browser windows open from the start (see [§4](#4-twowindowtwodevice-tip)) —
> one logged in as the **instructor**, one as a **student** — so real-time steps are instant to
> show.

| # | Step | Action | Route |
|---|------|--------|-------|
| 1 | **Admin login** | Log in as `admin@learnloop.test` / `Password123`. Land on the admin dashboard (Moderation Command Center). | `/login` → `/admin` |
| 2 | **View seeded users** | Open the Users page; show the ~107 seeded accounts (search/filter). | `/admin/users` |
| 3 | **Verify roles** | Point out STUDENT / INSTRUCTOR / ADMIN / SUPER_ADMIN / AI_AGENT in the user list — proof of the 5-role RBAC. | `/admin/users` |
| 4 | **Student login** | In the **second window**, log in as `student@learnloop.test`. Land on the student dashboard (course player + AI Study Assistant + Course Community). | `/login` → `/` |
| 5 | **Trigger an app notification** | As the **instructor** (or admin), publish/announce on a course; the enrolled student receives an **app push** (FCM, if configured) and the **bell** badge increments. | instructor dashboard `/` → student sees bell in topbar |
| 6 | **Show existing app push** | Click the **bell** as the student — show the in-app notification list (course published / announcement). This is the *pre-existing* LMS push, independent of CometChat. | any page (topbar bell) |
| 7 | **Open CometChat messaging** | As the student, open the Messages workspace (CometChat Web UI Kit conversation list). | `/messages` |
| 8 | **Send a 1-1 message** | Start/open a DM with the instructor and send a message. | `/messages` |
| 9 | **Open a course group discussion** | Open the course's group chat (the per-course CometChat group `course-{id}`). | `/courses/:id/discussion` (or via `/messages`) |
| 10 | **Show real-time delivery** | In the **instructor window**, open the same group; messages from the student appear **instantly**, and vice-versa. | both windows on `/courses/:id/discussion` |
| 11 | **Typing indicator + presence** | Start typing in one window — the **typing indicator** shows in the other; show **online/offline presence** on avatars (CometChat UI Kit features). | both windows |
| 12 | **Show CometChat push** | Background the student window/app; have the instructor send a message → **CometChat push notification** arrives (browser notification or on the Flutter app). | mobile app or browser notification |
| 13 | **Start an office-hours video call** | As the instructor, start **Office Hours** (group video room, CometChat Calls SDK); as the student, **join** via the office-hours banner/button. | instructor `/` (Office Hours) → student "Join Office Hours" |
| 14 | **Receive the call** | Show the student joining; demonstrate video/audio (and screen-share if shown). End the call. | call UI |
| 15 | **Chat with the AI Study Assistant** | As the student, use the **AI Study Assistant** widget (sends to the `study-assistant` CometChat user) and ask a course question. | student dashboard `/` (AI Study Assistant panel) |
| 16 | **Agent responds** | The CometChat **AI Agent Builder** agent replies in the widget/conversation (trigger → LLM → reply, handled by CometChat). | same widget / `/messages` |
| 17 | **Trigger a moderation rule** | As a student, send content that matches a configured moderation rule (e.g. an external link / flagged term). CometChat **flags** it (Flag mode). | `/courses/:id/discussion` |
| 18 | **Review & action the flag** | As the admin, open **Moderation**, see the flagged message in the queue, and **dismiss** the flag or **ban** the user (server proxy → CometChat REST). | `/admin/moderation` |
| 19 | **Webhook event received** | Send a few messages / add reactions / end a call in a course group — CometChat fires webhooks to `POST /api/webhooks/cometchat/events`, which updates `CourseEngagementMetrics`. | (background) `course-{id}` activity |
| 20 | **Admin views webhook-driven engagement** | As the admin, open **Engagement** — per-course messages / reactions / call-minutes (populated by the webhook in step 19) are visible. Then **explain CometChat Skills** (point to `COMETCHAT_SKILLS_USAGE.md`) and **key decisions** (point to [`DECISION_LOG.md`](./DECISION_LOG.md)). | `/admin/engagement` |

**Route reference** (from `apps/web/src/pages/index.tsx`): `/login`, `/register`, `/` (role
dashboard), `/admin`, `/admin/users`, `/admin/moderation`, `/admin/engagement`, `/courses`,
`/courses/:id`, `/courses/:id/discussion`, `/messages`, `/download` (mobile app),
`/diagnostic`.

---

## 4. Two-Window / Two-Device Tip

Real-time features (steps 10–14) are most convincing side by side:

- **Two browser windows:** use one normal window (instructor) and one **incognito/private**
  window (student) so the two JWT sessions don't collide in storage. Arrange them side by side
  and perform send/type/call in one while watching the other.
- **Browser + Flutter app:** drive the web app in the browser as the instructor and the
  **Flutter mobile app** as the student (it points at the same API and CometChat app) to show
  delivery *and* **CometChat push** (step 12) on a real device. Build instructions are in
  [`../DEPLOYMENT.md`](../DEPLOYMENT.md); an install page is at `/download`.
- For **office hours** (step 13), join the call from the second window/device to show
  multi-party video.

---

## 5. Reset / Re-seed

**Docker (destructive — wipes Postgres + Redis volumes, then re-seeds on next boot):**

```bash
docker compose down -v
docker compose up -d --build      # migrations + seed run automatically
```

**Local dev (re-seed without dropping the DB):**

```bash
cd apps/api
npm run seed                      # upserts demo users/courses/bots (idempotent)
```

The seed uses **upserts**, so re-running it is safe and won't duplicate accounts. To fully
reset the local schema, re-run `npx prisma db push` (add `--force-reset` to drop data).

> **Note:** re-seeding only resets the **LMS database**. CometChat-side state (users, groups,
> messages, flags) lives in your CometChat app and is **not** reset by this. Seeded users are
> (re)provisioned into CometChat on their next login via the idempotent sync
> (`DECISION_LOG.md` Decision 10).

---

## 6. Troubleshooting (Graceful Degradation)

The app is built so that missing optional integrations **degrade gracefully** rather than
crashing. Here's what works without each piece:

| Missing / unset | What breaks | What still works |
|-----------------|-------------|------------------|
| **CometChat keys** (`COMETCHAT_APP_ID` / `REGION` / `AUTH_KEY` / `REST_API_KEY`) | No chat, calls, presence, AI agents, or moderation; chat panes show empty/"connecting"; server CometChat calls no-op; no auth token is minted. | **Everything non-chat:** login/RBAC, courses, lessons, quizzes, enrollments, payments scaffold, admin users page, FCM push, and the in-app bell. |
| **`COMETCHAT_WEBHOOK_SECRET` unset** | The engagement webhook **skips HMAC verification** (logs a warning and accepts unsigned events) — fine for local demos but insecure for production. Engagement metrics still update *if the dashboard webhook is pointed at the endpoint*. | The webhook endpoint and `CourseEngagementMetrics` still function; everything else unaffected. |
| **FCM not configured** (`FIREBASE_*` blank) | No FCM device push for LMS events (course published, @mention). | In-app notifications (the **bell** + `Notification` rows) still record and display; CometChat's own push (if configured) is independent. |
| **Moderation rules not configured** in the dashboard | Nothing gets flagged → the moderation queue stays empty. | The Moderation page loads; dismiss/ban actions work once flags exist. |
| **AI agents not created** in the Agent Builder | @mentioning / messaging an agent gets no reply. | Chat, groups, calls, presence all still work. |
| **Redis down** | Queued FCM notifications stall (jobs don't dispatch). | API requests still serve; the app remains usable. |

Common checks:
- API health: `curl http://localhost:3000/api/health`
- Confirm seed ran (Docker): `docker compose logs api | grep -i seed`
- Confirm CometChat is enabled server-side: the auth response includes a non-null
  `cometchatAuthToken` when keys are set (otherwise it's `null`).
- Webhook reachability: CometChat must be able to reach
  `https://<your-domain>/api/webhooks/cometchat/events` (a public/staging URL, not
  `localhost`, in a real demo).

---

## 7. Configure CometChat Dashboard

For the full Step 2 experience, configure these once in
[app.cometchat.com](https://app.cometchat.com) → your app (full details in
[`../apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md)):

1. **API & Auth Keys** → copy App ID, Region, Auth Key, and REST API Key into `.env`
   (REST API Key is **server-only** — never ship it to the client).
2. **AI Agent Builder** → create **FAQ Bot**, **Study Assistant**, **Instructor Copilot**
   (set LLM + system prompt + optional knowledge base) and add them to the relevant
   `course-<courseId>` groups. The Study Assistant should use the UID `study-assistant` to
   match the web widget.
3. **Moderation → Rules** → enable a rule (profanity / external-link / spam) in **Flag** mode
   so flagged messages surface in `/admin/moderation`.
4. **Webhooks** → create a webhook to
   `https://<your-domain>/api/webhooks/cometchat/events` with triggers **`message_new`**,
   **`message_reaction_added`**, **`call_ended`**, HMAC-SHA256 signing enabled, and the
   **same secret** as `COMETCHAT_WEBHOOK_SECRET`.
5. **Notifications → Push** → optionally enable CometChat's native push for chat/call events
   (this runs alongside the app's FCM push without interference).

> Never paste real keys into committed files. Keep them in `.env` (git-ignored) and rotate any
> credential that is accidentally exposed.

---

*Demo Guide — CometLMS (LearnLoop). Pair this with [`DECISION_LOG.md`](./DECISION_LOG.md) for
the reasoning behind each integration choice and [`SCOPE_OF_WORK.md`](./SCOPE_OF_WORK.md) for
the requirement context.*
