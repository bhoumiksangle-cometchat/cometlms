# Decision Log — CometLMS (LearnLoop)

> Architecture & integration decision record for Assignment 1.
> **Step 1** is the production LMS app (the `main` branch / Phase 1). **Step 2** is the
> CometChat integration delivered on the `cometchat` branch (Phase 2 = Phase 1 + CometChat).
>
> Phase 1 originally specified a **custom real-time stack** — Socket.IO for chat, Daily.co /
> WebRTC for calls, and OpenAI / LangChain for AI agents (see `.ai_context.md`). Step 2
> **replaced** that custom stack with CometChat. Each Step 2 decision below records what was
> swapped, why, and what was deliberately kept.
>
> Each decision follows a fixed template: Selected Approach → Alternate Options Considered →
> Why This Was Chosen → Trade-offs → Limitations or Assumptions → Future Improvements.
>
> Related docs: [`SCOPE_OF_WORK.md`](./SCOPE_OF_WORK.md) ·
> [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) ·
> [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md) ·
> [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) ·
> [`../apps/api/COMETCHAT_AI_AGENTS.md`](../apps/api/COMETCHAT_AI_AGENTS.md) ·
> `COMETCHAT_SKILLS_USAGE.md`

---

## Table of Contents

**Step 1 — Production App**

1. [Application Use Case — Learning Management System](#decision-1-application-use-case--learning-management-system-learnloop)
2. [Repository Architecture — npm-workspaces Monorepo](#decision-2-repository-architecture--npm-workspaces-monorepo)
3. [Backend Stack — Express + TypeScript + Prisma + PostgreSQL + BullMQ/Redis](#decision-3-backend-stack--express--typescript--prisma--postgresql--bullmqredis)
4. [Authentication — Stateless JWT (Access + Refresh)](#decision-4-authentication--stateless-jwt-access--refresh)
5. [Authorization — `requireRole` Middleware with 5 Roles](#decision-5-authorization--requirerole-middleware-with-5-roles)
6. [Push Notifications — FCM via firebase-admin + BullMQ](#decision-6-push-notifications--fcm-via-firebase-admin--bullmq)
7. [Mobile — Flutter (Single Codebase)](#decision-7-mobile--flutter-single-codebase)

**Step 2 — CometChat Integration**

8. [Chat & Calling Provider — CometChat](#decision-8-chat--calling-provider--cometchat)
9. [Migration Strategy — Full Replacement of the Custom Stack](#decision-9-migration-strategy--full-replacement-of-the-custom-stack)
10. [User Provisioning — UID == LMS User.id, Idempotent Sync](#decision-10-user-provisioning--cometchat-uid--lms-userid-idempotent-sync)
11. [Client Auth into CometChat — Server-Minted Auth Token](#decision-11-client-auth-into-cometchat--server-minted-auth-token)
12. [Role Representation — Metadata + Group Scopes (not Roles/Tags)](#decision-12-role-representation-in-cometchat--metadata--group-scopes)
13. [Conversation Model — One Group per Course](#decision-13-conversation-model--one-cometchat-group-per-course)
14. [AI Agents — CometChat AI Agent Builder](#decision-14-ai-agents--cometchat-ai-agent-builder)
15. [Moderation — CometChat Content Moderation + Admin Proxy](#decision-15-moderation--cometchat-content-moderation--server-side-admin-proxy)
16. [Webhook Use Case — Per-Course Engagement Analytics](#decision-16-webhook-use-case--per-course-engagement-analytics)
17. [Development Approach — CometChat Skills](#decision-17-development-approach--cometchat-skills)

---

# Step 1 Decisions (Production App)

## Decision 1: Application Use Case — Learning Management System (LearnLoop)

### Selected Approach
Build the production application as a **Learning Management System (LMS)**, internally
codenamed **LearnLoop**: instructors publish video courses, students enrol and learn, and
admins operate the platform. Every course has a discussion space, learners ask questions,
and instructors/AI agents respond.

### Alternate Options Considered
1. **Customer-support platform** (tickets, agents, SLAs) — the canonical "chat app" use case.
2. **Internal employee portal** (announcements, HR, directory, team channels).
3. **Project / team collaboration tool** (boards, threads, file sharing).

### Why This Was Chosen
The assignment requires demonstrating the full breadth of a chat/communication SDK
(1-1 chat, group chat, voice/video calls, moderation, AI agents, presence, push) **and** a
realistic non-chat application around it. An LMS exercises all of these naturally:
- **1-1 chat** → student ↔ instructor DMs.
- **Group chat** → per-course discussion groups.
- **Calls** → instructor office hours (group video) and 1-1 help calls.
- **Moderation** → public course discussions invite spam / abuse.
- **AI agents** → FAQ Bot, Study Assistant, Instructor Copilot.
- **Role hierarchy** → student / instructor / admin maps cleanly to customer / agent / admin.

Critically, an LMS also has **meaningful non-chat activity** — enrol, watch lessons, take a
quiz, earn a certificate, pay for a course — so push notifications have *real, non-chat
triggers* (course published, enrolment confirmed, certificate issued), which is exactly what
the assignment wants to see existing alongside the chat integration.

### Trade-offs
- An LMS is a *broad* domain: building a credible catalog, course player, quizzes, payments,
  certificates, and an admin console is significant Step 1 scope before any chat is added.
- A support-desk app would have reached "chat-heavy demo" faster, but with thinner non-chat
  surface area to justify push notifications and webhooks.

### Limitations or Assumptions
- Several adjacent LMS features are scaffolded rather than production-grade: payments are a
  checkout + webhook placeholder, email delivery is stubbed, and advanced LMS features
  (SCORM, proctoring, gradebook export) are explicitly out of scope.
- We assume the demo audience cares more about communication depth than LMS completeness, so
  course content (lessons, quizzes) is intentionally minimal.

### Future Improvements
- Add cohorts / learning paths and certification tracks to create richer group structures
  (cohort chat, peer study rooms) and more webhook-worthy lifecycle events.
- Flesh out payments into a real gateway so the "purchase → enrol → join course group" flow
  is fully end-to-end.

---

## Decision 2: Repository Architecture — npm-workspaces Monorepo

### Selected Approach
A single repository using **npm workspaces**, with `apps/api` (Express backend),
`apps/web` (React SPA), `apps/mobile` (Flutter), and `packages/*` for shared code
(`shared-types`, `shared-utils`). One `package.json` orchestrates the JS/TS workspaces.

### Alternate Options Considered
1. **Separate repositories** per app (api-repo, web-repo, mobile-repo).
2. **Nx or Turborepo** monorepo (task graph, caching, generators).
3. **Next.js fullstack** (single app: API routes + React in one framework).

### Why This Was Chosen
- A monorepo keeps the web client, mobile client, and API **in lockstep** — a single PR can
  change a shared type and all consumers at once, which matters when CometChat UIDs, roles,
  and DTOs must agree across three clients.
- **npm workspaces** ship with Node and need zero extra tooling, keeping the build simple and
  the learning curve flat for a reviewer cloning the repo.
- Nx/Turborepo add real value at scale (remote caching, affected-graph builds) but introduce
  config and concepts that aren't justified for a project of this size.
- Next.js fullstack was rejected because we need a **standalone REST API** that a Flutter app
  and a CometChat webhook can both call directly; a separate Express service is cleaner for
  that than colocated route handlers.

### Trade-offs
- npm workspaces give no build caching or task orchestration, so CI rebuilds more than an
  Nx/Turbo setup would.
- A monorepo couples deploy cadence somewhat; the Flutter app lives alongside JS code it
  doesn't share a toolchain with.

### Limitations or Assumptions
- Assumes a small team / single deploy target where coordinated versioning is a feature, not
  friction.
- `packages/*` sharing only applies to the JS/TS apps; the Flutter app re-declares its own
  models rather than consuming `shared-types`.

### Future Improvements
- Adopt Turborepo for cached, affected-only builds if the API/web build time grows.
- Generate Flutter (Dart) models from the same source of truth as `shared-types` to remove
  the manual re-declaration.

---

## Decision 3: Backend Stack — Express + TypeScript + Prisma + PostgreSQL + BullMQ/Redis

### Selected Approach
**Express.js + TypeScript** for the HTTP API, **Prisma** as the ORM over **PostgreSQL 16**,
and **BullMQ on Redis 7** for background jobs (notification dispatch). Redis doubles as the
cache/queue backend.

### Alternate Options Considered
1. **NestJS** — opinionated, DI-based, modular framework on top of Express/Fastify.
2. **Fastify** — high-throughput Node framework with a built-in schema/validation pipeline.
3. **Django (Python) or Rails (Ruby)** — batteries-included full-stack frameworks.

### Why This Was Chosen
- **Express** is minimal and universally understood; a reviewer can read a route file and
  immediately see what it does. Module-per-domain structure (`auth`, `courses`,
  `enrollments`, `chat`, …) gives enough organization without framework ceremony.
- **Prisma** gives type-safe queries and a single declarative schema that drives migrations —
  important because the data model (User, Course, Enrollment, `CourseEngagementMetrics`, …)
  evolved across both steps.
- **PostgreSQL** is the safe relational default for the strongly-relational LMS data
  (users → courses → enrollments → payments → certificates).
- **BullMQ + Redis** cleanly decouples push-notification dispatch from the request path, so
  a slow FCM call never blocks an API response.
- NestJS was rejected as over-structured for this scope; Fastify's perf edge isn't needed at
  this traffic; Python/Ruby would split the stack away from the TypeScript web/shared code.

### Trade-offs
- Express has no built-in validation/DI, so we add Zod and hand-wire middleware — more
  boilerplate than NestJS would impose a structure for.
- Running Postgres **and** Redis raises the infra footprint vs. a single-datastore design.

### Limitations or Assumptions
- Assumes Redis is always available; if Redis is down, queued notifications stall (the API
  itself still serves requests).
- Prisma migrations assume a single writer; no multi-region DB story.

### Future Improvements
- Introduce a thin service/controller convention (or migrate hot modules to NestJS-style
  structure) if the team grows and consistency becomes a problem.
- Add a dead-letter queue and retry dashboard for failed notification jobs.

---

## Decision 4: Authentication — Stateless JWT (Access + Refresh)

### Selected Approach
**Stateless JWT auth**: a short-lived **access token (~15 min)** plus a long-lived
**refresh token (~30 days)**. Passwords are hashed with **bcrypt**. The refresh endpoint
issues a new access token (and re-mints the CometChat auth token — see Decision 11).

### Alternate Options Considered
1. **Server sessions + cookies** (session store in Redis/Postgres).
2. **Managed auth provider** — Auth0 / Clerk / Firebase Auth.
3. **Long-lived single token** (no refresh) — simplest but least safe.

### Why This Was Chosen
- Stateless JWTs let the **API, web SPA, Flutter app, and CometChat token-minting** all share
  one auth model with no server-side session lookup, which is ideal for a multi-client
  monorepo where the mobile app talks to the API directly.
- Short access + long refresh balances security (small blast radius if an access token leaks)
  against UX (users aren't logged out every 15 minutes).
- A managed provider (Auth0/Clerk/Firebase Auth) would offload security but adds an external
  dependency, cost, and an extra identity to reconcile with both the LMS `User` row and the
  CometChat UID — more moving parts than the assignment needs.

### Trade-offs
- Stateless tokens are **hard to revoke** before expiry; a compromised access token is valid
  until it expires (mitigated by the short lifetime).
- We own password storage, reset flows, and rotation rather than delegating to a provider.

### Limitations or Assumptions
- Assumes refresh-token rotation/blacklisting is sufficient revocation; there is no global
  "kill all sessions" switch yet.
- One active device token per user (see Decision 6) implies effectively one active push
  target per user, not full multi-session.

### Future Improvements
- Add refresh-token rotation with reuse-detection and a server-side revocation list for
  instant logout-everywhere.
- Offer OAuth/SSO sign-in (Google) for instructors/admins.

---

## Decision 5: Authorization — `requireRole` Middleware with 5 Roles

### Selected Approach
Role-based access control enforced **server-side** by `requireAuth` + `requireRole(...)`
middleware. The role set is the Prisma `UserRole` enum:
**`STUDENT`, `INSTRUCTOR`, `ADMIN`, `SUPER_ADMIN`, `AI_AGENT`**. Routes declare the roles
they accept; the web app mirrors this with route guards for UX only.

### Alternate Options Considered
1. **A permissions / ability library** such as CASL (fine-grained abilities).
2. **A database permission table** (role → permission rows, runtime-editable).
3. **A single `isAdmin` boolean** on the user.

### Why This Was Chosen
- Five coarse roles map exactly onto the product's actors (learner, teacher, operator,
  super-operator, bot) and onto the assignment's customer/agent/admin model, so a small enum
  is expressive enough without a permission engine.
- Middleware keeps enforcement **at the edge of every route**, in one obvious place, and
  guarantees the server is the source of truth (the SPA guard is convenience, not security).
- `AI_AGENT` as a first-class role lets bot accounts (FAQ Bot, Study Assistant, Instructor
  Copilot) exist as real users without polluting human-role checks.
- CASL / a DB permission table is more power than needed and adds indirection; a single
  `isAdmin` boolean can't express the instructor tier or the super-admin/agent distinction.

### Trade-offs
- Coarse roles mean cross-cutting rules (e.g. "instructor may act only on *their own*
  course") are expressed as ad-hoc ownership checks inside handlers, not as declarative
  permissions.
- Adding a genuinely new capability sometimes means touching multiple route guards.

### Limitations or Assumptions
- Assumes role assignment is rare and admin-driven; there is no self-service role-request
  workflow.
- Ownership/scoping checks live in handler code, so their consistency depends on review.

### Future Improvements
- Introduce a permission abstraction (CASL or a DB-backed table) if per-resource rules
  multiply, so ownership logic becomes declarative and testable.
- Add an audit trail for role changes.

---

## Decision 6: Push Notifications — FCM via firebase-admin + BullMQ

### Selected Approach
Push notifications via **Firebase Cloud Messaging (FCM)** using the **firebase-admin** SDK on
the server, dispatched through a **BullMQ queue + worker**. Each user has **one
`DeviceToken`** row; every push is logged to a `Notification` table for in-app display and
auditing. Triggers include *course published*, *enrolment*, and *@mention* / announcements.

### Alternate Options Considered
1. **web-push (VAPID) only** — browser push without a vendor SDK.
2. **OneSignal** — managed cross-platform push service.
3. **Expo push** — convenient if the app were React Native.
4. **Email-only** notifications (no push).

### Why This Was Chosen
- **FCM covers both web and Flutter** with one provider and one server credential
  (`firebase-admin`), which is exactly the cross-platform shape of this project (React SPA +
  Flutter app). One pipeline, one token model.
- Routing through **BullMQ** keeps push off the request path and gives retries/backoff for
  flaky device delivery, plus a natural place to fan out notifications.
- The `Notification` table means push and in-app bell notifications share one source of
  truth, so users see history even if a device push was missed.
- web-push only covers browsers; OneSignal/Expo add a vendor or assume React Native;
  email-only fails the assignment's "real push trigger" requirement.

### Trade-offs
- FCM ties push to the Google/Firebase ecosystem and requires a service-account credential to
  be configured for push to work at all.
- One device token per user means a login on a second device effectively replaces the push
  target rather than adding one.

### Limitations or Assumptions
- Firebase env vars are **optional**: with them unset, push simply no-ops and the rest of the
  app (including in-app `Notification` rows) keeps working.
- Assumes single active device per user (consistent with Decision 4).
- After Step 2, **CometChat's own push** (new messages/calls) runs *alongside* this FCM
  pipeline without interference; the two are intentionally not merged.

### Future Improvements
- Support multiple device tokens per user for true multi-device push.
- Optionally consolidate onto CometChat's native push for chat events and reserve FCM for
  LMS-lifecycle events, reducing duplicate notifications.

---

## Decision 7: Mobile — Flutter (Single Codebase)

### Selected Approach
A **Flutter** app (`apps/mobile`) delivering iOS + Android from one Dart codebase, mirroring
auth, catalog, course, chat, and push. It points directly at the API base URL and uses
CometChat's **Flutter UI Kit v6** for chat.

### Alternate Options Considered
1. **React Native** — reuse JS/TS skills and some React mental model.
2. **Native iOS (Swift) + native Android (Kotlin)** — two separate apps.
3. **PWA only** — no native app, install the web SPA.

### Why This Was Chosen
- Flutter gives **one codebase for both platforms** with strong UI fidelity and a
  first-class **CometChat Flutter UI Kit (v6)**, so the same chat/calls feature set ships to
  mobile with minimal custom code.
- It pairs well with a standalone REST API + CometChat (the app just needs the API URL and a
  CometChat auth token), so no special backend-for-mobile is required.
- React Native would reuse JS skills but its CometChat tooling and native-module story are
  heavier here; native-twice doubles the work; a PWA can't deliver native push/calls cleanly.

### Trade-offs
- Flutter introduces a **second toolchain** (Dart/Flutter) that doesn't share code with the
  TypeScript apps, so models are re-declared on the mobile side.
- Team must maintain Flutter expertise separate from the web stack.

### Limitations or Assumptions
- The API base URL is **baked in as a default** in the Flutter network layer for the staging
  deployment, so pointing the app elsewhere means a rebuild.
- Assumes parity, not feature-completeness: the mobile app mirrors core flows rather than
  every admin screen.

### Future Improvements
- Generate Dart models from `shared-types` to remove duplicate model definitions.
- Make the API base URL runtime-configurable (build flavor / remote config) instead of baked
  in.

---

# Step 2 Decisions (CometChat Integration)

## Decision 8: Chat & Calling Provider — CometChat

### Selected Approach
Use **CometChat** as the single provider for real-time messaging, presence/typing, voice &
video calling, moderation, AI agents, and chat push — integrated via the **Web React UI Kit
v6**, the **Flutter UI Kit v6**, the **Calls SDK**, and the **server-side REST API**
(`apps/api/src/services/cometchat.service.ts`).

### Alternate Options Considered
1. **Keep the Phase-1 custom stack** — Socket.IO chat + Daily.co/WebRTC calls + OpenAI/LangChain agents.
2. **Stream Chat** (GetStream) — chat + (separate) video products.
3. **Sendbird** — chat + calls SDKs.
4. **Twilio Conversations** (+ Twilio Video) — messaging and video as separate APIs.

### Why This Was Chosen
- CometChat is the **assignment's integration target**, and it is **batteries-included**: one
  vendor supplies chat UI kits (web + Flutter), a calls SDK, content moderation, an **AI Agent
  Builder**, and push — so the custom Socket.IO server, the WebRTC/Daily.co signaling layer,
  and the custom Groq/LangChain agent loop all collapse into configuration + thin glue.
- The UI Kits mean **typing indicators, presence, reactions, threads, and a calling UI** come
  "for free," dramatically reducing custom front-end code on both web and mobile.
- Stream/Sendbird/Twilio are all credible chat vendors, but each would require stitching chat
  + calls (+ moderation + agents) from multiple products, and none is the assignment target.

### Trade-offs
- We take on a **third-party dependency** for a core product surface: outages, pricing, and
  feature limits are now external, and the chat UX is shaped by the UI Kit.
- Some control is lost vs. an in-house Socket.IO stack (custom event semantics, bespoke UI).

### Limitations or Assumptions
- Assumes CometChat App ID / Region / Auth Key are **client-safe** while the **REST API Key is
  a server-only secret** (enforced in `cometchat.service.ts`).
- Without CometChat credentials the chat layer **degrades gracefully** — the server methods
  no-op and the LMS keeps running (see Decision 9 and the troubleshooting section of the
  Demo Guide).

### Future Improvements
- Wrap CometChat behind a small internal interface so a future provider swap (or a fallback)
  is localized.
- Pin and track UI Kit versions deliberately as v6 evolves.

---

## Decision 9: Migration Strategy — Full Replacement of the Custom Stack

### Selected Approach
**Fully replace** the Phase-1 custom real-time stack with CometChat, rather than running both
in parallel. The Socket.IO chat server, custom React chat components, WebRTC/Daily.co calling,
and the custom Groq/LangChain agent loop were **removed** and superseded by CometChat. All
**non-chat LMS workflows and the existing FCM push pipeline were kept working** unchanged.

### Alternate Options Considered
1. **Run both stacks side by side** — keep Socket.IO live and add CometChat alongside, then
   migrate gradually.
2. **Strangler / feature-flag migration** — route a subset of users/courses to CometChat
   while the rest stay on the old stack.
3. **Full replacement (chosen).**

### Why This Was Chosen
- Two live real-time systems means **two sources of truth** for messages, presence, and
  calls — doubling maintenance, risking divergence, and confusing the demo. One real-time
  system is simpler to operate and reason about.
- The assignment's **core goal** is to integrate CometChat *without breaking the existing
  application*. The cleanest way to prove that is: rip out the parallel chat machinery, keep
  every non-chat workflow (enrol, learn, quiz, pay, certificate) and the **FCM push pipeline**
  intact, and show the app still fully functions.
- A side-by-side or strangler migration is the right call for a high-traffic production system
  mid-flight, but here it would add flag plumbing and dual-write complexity with no benefit.

### Trade-offs
- We **deleted working Phase-1 code** (Socket.IO server, custom chat UI, WebRTC signaling),
  which is sunk effort and removes the fallback of the old stack.
- A hard cutover means there is no gradual rollback to the previous chat system.

### Limitations or Assumptions
- Assumes CometChat can cover every real-time use case the custom stack did (it does: chat,
  calls, presence, moderation, agents).
- Assumes the demo/staging environment can rely on CometChat being configured; if it isn't,
  chat degrades gracefully but is non-functional (by design).

### Future Improvements
- Keep the deleted custom-stack code recoverable in git history as a documented reference.
- Add an integration test that asserts all non-chat flows succeed even when CometChat is
  fully disabled, to guard the "doesn't break the app" invariant.

---

## Decision 10: User Provisioning — CometChat UID == LMS User.id, Idempotent Sync

### Selected Approach
Each LMS user's **CometChat UID is exactly their LMS `User.id`**. Provisioning is an
**idempotent sync** performed on **register, login, and refresh**: the server calls
`cometChatService.createUser(...)` which creates the CometChat user, or — on a `409 /
ERR_UID_ALREADY_EXISTS` — updates the existing one. This single mechanism covers **both
pre-existing seeded users** (first login provisions them) and **newly registered users**.
The server also mints a CometChat auth token in the same flow (see Decision 11).

### Alternate Options Considered
1. **One-time signup-only sync** — provision into CometChat only at registration.
2. **A separate mapping table** — store an LMS-id ↔ CometChat-UID mapping with independent IDs.
3. **Nightly batch sync** — a cron job reconciles all users into CometChat periodically.

### Why This Was Chosen
- **UID == User.id** removes an entire class of mapping bugs: any place the code knows the LMS
  user knows the CometChat identity, and course group GUIDs (`course-{courseId}`) follow the
  same convention.
- **Sync on register/login/refresh** means the ~107 **seeded accounts** (which never went
  through a signup form) get provisioned the first time they authenticate — without a separate
  backfill script — and any drift (renamed user, new avatar) self-heals on next login.
- The operation is **idempotent and best-effort**: a create that collides becomes an update,
  and if CometChat is unconfigured it no-ops, so auth never fails because of chat.
- Signup-only sync would miss every seeded user; a mapping table adds a lookup and a second
  identity to keep consistent; a nightly batch leaves a provisioning lag and an extra job to
  operate.

### Trade-offs
- Calling CometChat on **every** login/refresh adds a network hop to the hot auth path
  (mitigated: it's wrapped, best-effort, and skipped entirely when CometChat is disabled).
- Reusing the LMS id as the CometChat UID couples the two identifiers permanently.

### Limitations or Assumptions
- Assumes LMS `User.id` values are stable and never reused.
- Assumes occasional redundant create/update calls are acceptable; there is no client-side
  "already synced" short-circuit.

### Future Improvements
- Cache a per-user "last synced" marker to skip redundant create/update calls on frequent
  refreshes.
- Add a one-shot admin "resync all users" maintenance endpoint for disaster recovery.

---

## Decision 11: Client Auth into CometChat — Server-Minted Auth Token

### Selected Approach
The client never holds the CometChat **REST API Key**. Instead, the server mints a per-user
**CometChat auth token** (`POST /users/{uid}/auth_tokens` via `createAuthToken`) during
register/login/refresh and returns it to the client as `cometchatAuthToken`. The client then
calls **`loginWithAuthToken(...)`**. In development, a fallback to **auth-key UID login** is
available when the server can't mint a token.

### Alternate Options Considered
1. **Client-side auth-key login** — ship the Auth Key to the client and log in by UID.
2. **A full custom token service** — a separate signing service that issues CometChat-shaped
   tokens.
3. **Server-minted auth token via REST (chosen).**

### Why This Was Chosen
- Minting the token **server-side keeps the REST API Key on the server only**, so the
  long-lived privileged credential is never exposed in a browser bundle or mobile binary.
- The flow rides on the **existing JWT auth**: the same endpoints that authenticate the user
  also return a scoped, per-user CometChat auth token — one round trip, no extra service.
- The **dev fallback to auth-key login** keeps local development frictionless when CometChat
  REST minting isn't set up, without weakening the production path.
- Client-side auth-key login is insecure (the Auth Key can mint tokens for *any* user); a
  bespoke token service is unnecessary infrastructure given CometChat already issues tokens.

### Trade-offs
- Token minting depends on the CometChat REST API being reachable at auth time; a CometChat
  outage means no fresh chat token (the LMS still logs the user in — chat just won't connect).
- The dev auth-key fallback is a second code path that must remain dev-only.

### Limitations or Assumptions
- Assumes the auth-token lifetime is acceptable and re-minted often enough (it is re-minted on
  refresh).
- Assumes the dev fallback is never enabled in production.

### Future Improvements
- Add explicit token-expiry handling on the client with a silent re-mint via the refresh flow.
- Remove or hard-gate the dev auth-key fallback behind an environment guard so it cannot ship.

---

## Decision 12: Role Representation in CometChat — Metadata + Group Scopes

### Selected Approach
Represent the LMS role inside CometChat in **two complementary ways**:
1. The LMS role string is stored in the CometChat **user `metadata`** as **`lmsRole`** (see
   `buildUserMetadata` in `cometchat.service.ts`).
2. Membership privileges use CometChat **group member scopes** — instructors are added with
   **`admin` / `moderator`** scope on their course group; students join as **`participant`**.

### Alternate Options Considered
1. **CometChat predefined Roles** — dashboard-configured top-level roles assigned per user.
2. **CometChat Tags** — attach role/cohort tags to users for filtering and rules.
3. **Metadata + scopes (chosen).**

### Why This Was Chosen
- CometChat's **top-level `role` field requires roles to be pre-defined in the dashboard**;
  storing the LMS role in **freeform `metadata.lmsRole`** keeps the LMS as the source of truth
  and avoids coupling provisioning to manual dashboard config.
- **Group scopes** are the native, enforceable way to express "instructor can moderate this
  course's group while students can only participate," which is precisely the privilege we
  need at the conversation level.
- Together, metadata answers *"what is this user?"* and scope answers *"what can they do in
  this group?"* — clean separation.

### Trade-offs
- `metadata.lmsRole` is **descriptive, not enforced** by CometChat — it's for display/filter
  context, while actual enforcement lives in group scopes and in the LMS's own RBAC.
- Reproducing scope changes (e.g. promoting a TA) requires REST calls rather than a dashboard
  toggle.

### Limitations or Assumptions
- **CometChat Tags were considered but are NOT used in this version.** This is a known
  limitation: there is currently no tag-based segmentation of users (by cohort or role) in
  CometChat. Filtering/segmentation today relies on metadata and group membership only.
- Assumes the LMS remains the authoritative role store and CometChat mirrors it.

### Future Improvements
- **Adopt CometChat Tags** for cohort- and role-based filtering (e.g. tag users by
  `role:instructor` or `cohort:2026-spring`) to power dashboard segmentation, targeted
  broadcasts, and tag-scoped moderation rules.
- Consider mapping `lmsRole` onto dashboard-defined CometChat Roles if first-class role
  semantics become useful.

---

## Decision 13: Conversation Model — One CometChat Group per Course

### Selected Approach
The primary conversation unit is **one CometChat GROUP per course**, with a stable GUID
**`course-{courseId}`** (set on the `Course.cometchatGroupId` field at publish/seed time).
The **owner** is the instructor; **members** are the course's enrollments (instructor =
admin/moderator scope, students = participant). On top of this sit **1-1 DMs** (student ↔
instructor) and an **office-hours group video room**.

### Alternate Options Considered
1. **Per-section groups** — a separate group per course section/module.
2. **Per-cohort groups** — group by enrollment cohort/term rather than by course.
3. **A single global group** — one platform-wide discussion channel.

### Why This Was Chosen
- One group per course is the **natural unit of learning community**: everyone in a course
  shares one discussion, the instructor owns it, and the deterministic GUID
  (`course-{courseId}`) lets the server, both clients, and the **engagement webhook** all
  derive the same id with zero lookup.
- Lifecycle is clean: **publish → create group (owner = instructor)**, **enrol → add member**,
  **unenrol/refund → remove member** — mapping the LMS lifecycle directly onto group
  membership.
- The `course-{courseId}` convention is also what the **webhook parses** to attribute
  engagement to a course (Decision 16), so this model is load-bearing for analytics.
- Per-section groups fragment small courses into ghost-town channels; per-cohort groups split
  one course's learners apart; a single global group destroys course-level context and
  moderation scoping.

### Trade-offs
- Very large courses get one big, busy channel (no built-in sub-channels/threading by topic
  beyond CometChat's own threads).
- DMs and the office-hours room are additional conversation types layered on, each with its
  own lifecycle to manage.

### Limitations or Assumptions
- Assumes course-level discussion is the right granularity for this product (true for an LMS
  of this size).
- Assumes `cometchatGroupId` stays in sync with course publish state.

### Future Improvements
- Add optional **per-section or per-cohort sub-groups** for large courses while keeping the
  course group as the parent community.
- Auto-archive a course group when a course is unpublished/retired.

---

## Decision 14: AI Agents — CometChat AI Agent Builder

### Selected Approach
AI assistants are built with **CometChat's AI Agent Builder** (dashboard-configured), not
custom server code. Three agents — **FAQ Bot, Study Assistant, Instructor Copilot** — are
seeded as **`AI_AGENT`** users (`prisma/seed-bots.ts`) and configured (LLM, system prompt,
knowledge base, trigger mode) in the CometChat Dashboard. CometChat handles the full
**trigger → LLM → reply** loop natively. A **server-side Groq endpoint is kept only** to power
standalone AI widgets that aren't part of the CometChat conversation loop.

### Alternate Options Considered
1. **Fully custom Groq + webhook relay** — the original Phase-1 design (webhook intercepts
   @mentions, calls Groq, posts the reply back via REST).
2. **OpenAI Assistants API** — host the agents on OpenAI's assistant runtime.
3. **No agents** — drop AI entirely.

### Why This Was Chosen
- The Agent Builder **handles bot creation, LLM integration, knowledge base, and message
  delivery natively**, so the custom `agents.ts` + `bot-sync.ts` + agent webhook handler were
  **removed** — the LLM key and prompts live in the dashboard, not in server code or env
  (`GROQ_API_KEY`/`GROQ_MODEL` are no longer needed *for agents*).
- Seeding the bots as real **`AI_AGENT` users** keeps them first-class identities that can be
  added to course groups and DM'd, while their *behaviour* is configured externally.
- This directly demonstrates the assignment's "AI agent" requirement with the vendor's
  purpose-built tool instead of a hand-rolled relay.
- Keeping a thin **Groq endpoint** for standalone widgets avoids forcing every AI feature
  through CometChat when a plain request/response widget is simpler.
- A custom Groq relay is exactly the maintenance burden CometChat removes; OpenAI Assistants
  would split AI config across a second vendor; "no agents" fails the requirement.

### Trade-offs
- Agent behaviour now lives in the **CometChat Dashboard**, so it isn't version-controlled in
  this repo — reproducing it requires the documented dashboard setup
  (`apps/api/COMETCHAT_AI_AGENTS.md`).
- Two AI paths coexist (CometChat agents for chat, Groq endpoint for widgets), which is a
  small conceptual split.

### Limitations or Assumptions
- Assumes the agents are configured in the dashboard and added to the relevant
  `course-{courseId}` groups; without that, @mentions get no reply.
- Assumes an LLM key is set on the **CometChat** side (not the server) for agent replies.

### Future Improvements
- Document/export the dashboard agent config (prompts, knowledge base) into the repo so it can
  be recreated deterministically.
- Attach course-specific knowledge bases per agent so answers are grounded in each course's
  materials.

---

## Decision 15: Moderation — CometChat Content Moderation + Server-Side Admin Proxy

### Selected Approach
Use **CometChat Content Moderation** (dashboard rules, **Flag** mode) to detect problematic
messages, then surface and action them through **server-side admin proxy endpoints** (which
hold the REST key server-side) consumed by the web **`AdminModerationPage`**
(`/admin/moderation`). Admins can review the flagged queue, **dismiss** a flag, or **ban** the
offending user — all via the server proxy in `cometchat.service.ts`
(`listFlaggedMessages`, `dismissFlaggedMessage`, `banUser`).

### Alternate Options Considered
1. **Phase-1 custom profanity filter** — wordlist / rate-limit / similarity checks in the
   message pipeline.
2. **A third-party moderation API** (e.g. OpenAI Moderation, AWS Rekognition for images).
3. **Manual-only** moderation — admins read channels and act, no automated flagging.

### Why This Was Chosen
- CometChat **already moderates inside the same system that carries the messages**, so flags
  are produced where the content lives — no separate inference pipeline to host, and no custom
  message-interception layer (the Phase-1 filter was removed alongside the Socket.IO stack).
- **Flag mode** (rather than auto-delete) keeps a human in the loop: messages are surfaced for
  admin review, which fits an LMS where false positives on legitimate content are costly.
- The **server-side proxy** is essential: it keeps the REST API Key off the client while still
  giving admins a real moderation UI, and it's the same security posture as the rest of the
  CometChat integration.
- A custom filter is maintenance we deliberately shed; a separate moderation vendor adds an
  integration with no co-location benefit; manual-only doesn't scale.

### Trade-offs
- Moderation quality and rule expressiveness are bounded by CometChat's moderation feature
  set and dashboard configuration.
- Actions round-trip through our proxy to CometChat, adding a hop versus acting in the
  CometChat dashboard directly (intentional, to keep the workflow inside the LMS admin UI).

### Limitations or Assumptions
- Assumes moderation **rules are configured in the dashboard**; with no rules, nothing is
  flagged and the queue stays empty.
- **Known gap — route ordering:** the moderation proxy routes are order-sensitive (a more
  specific path must be registered before a parameterized one); this is a maintenance hazard
  to watch when adding endpoints.
- There is currently **no admin notification-log view** tied to moderation (admins see the
  flag queue, not a historical action log).

### Future Improvements
- Add a moderation **action/audit log** and an admin notification-log view so dismiss/ban
  history is reviewable.
- Add image/NSFW moderation rules and harden the proxy route ordering with explicit, tested
  registration.

---

## Decision 16: Webhook Use Case — Per-Course Engagement Analytics

### Selected Approach
The one custom webhook we maintain — `POST /api/webhooks/cometchat/events`
(`apps/api/src/modules/chat/cometchat-webhook.ts`) — drives **per-course engagement
analytics**. It consumes **`message_new`**, **`message_reaction_added`**, and **`call_ended`**
events, extracts the course id from the `course-{courseId}` group receiver, and atomically
upserts daily counters (`totalMessages`, `totalReactions`, `callMinutes`) into the
**`CourseEngagementMetrics`** table. The data is visible on the **Admin Engagement** page
(`/admin/engagement`). The webhook is **HMAC-SHA256 verified** with `COMETCHAT_WEBHOOK_SECRET`
and responds `200` immediately, processing asynchronously.

### Alternate Options Considered
1. **Message archival / audit log** — persist every message server-side for compliance.
2. **Real-time activity feed** — stream events into a live admin feed.
3. **Moderation-flag sync** — mirror CometChat flags into a local table.
4. **Notification mirroring** — fan webhook events out as additional notifications.

### Why This Was Chosen
- Engagement analytics deliver the **highest admin value** and produce **visible dashboard
  proof** that the webhook works — the Admin Engagement page updates as messages/reactions/
  calls happen during a demo.
- CometChat **doesn't aggregate at the course-group level**, so this is genuinely additive:
  the server computes a metric the platform can't get from the dashboard.
- The course-scoped `course-{courseId}` GUID convention (Decision 13) makes attribution
  trivial, so the webhook is small, deterministic, and idempotent (upsert with `increment`).
- Archival duplicates what CometChat already stores; a real-time feed is flashier but less
  durable; flag-sync and notification-mirroring are narrower and lower-value than a true
  analytics surface.

### Trade-offs
- Day-grain counters trade detail for simplicity — we get per-day totals, not per-message
  records or per-user breakdowns.
- The webhook is the single integration point; if it's misconfigured or its secret is unset,
  metrics silently stop updating (it logs a warning and skips verification when the secret is
  absent).

### Limitations or Assumptions
- Assumes the dashboard webhook is pointed at the right URL with matching triggers and the
  same secret as `COMETCHAT_WEBHOOK_SECRET`.
- `activeChatters`, `flaggedMessages`, and `resolvedFlags` columns exist on the table but are
  not all populated by the current handler (counters focus on messages/reactions/call-minutes).

### Future Improvements
- Populate `activeChatters` (distinct senders/day) and wire flag counts from moderation into
  the same metrics table.
- Add hourly granularity or per-user engagement, and a trend/chart view on the engagement
  page.

---

## Decision 17: Development Approach — CometChat Skills

### Selected Approach
Drive the CometChat integration with **CometChat "Skills"** — AI-agent skill packs committed
under `apps/mobile/.agents/skills/` with a `apps/mobile/skills-lock.json` lockfile. Four
skills are pinned: **`cometchat`** (core integration), **`cometchat-calls`**,
**`cometchat-a11y`** (accessibility), and **`cometchat-i18n`** (internationalization). These
skills encode CometChat's recommended patterns for the **Flutter UI Kit v6** and the **React
UI Kit v6**, and were used to guide the implementation.

### Alternate Options Considered
1. **Read the docs manually** — implement straight from CometChat's web documentation.
2. **Copy quick-start samples** — paste from official starter repos and adapt.
3. **CometChat Skills (chosen).**

### Why This Was Chosen
- The skill packs give the coding agent **versioned, hash-locked guidance** (`skills-lock.json`
  records each skill's source and `computedHash`), so the integration follows CometChat's
  current best practices for v6 UI Kits rather than ad-hoc or stale patterns.
- Committing the skills makes the integration approach **reproducible and auditable** — a
  reviewer can see exactly which guidance shaped the code, and the lockfile pins it.
- Pulling in **a11y and i18n** skills nudges the implementation toward accessible,
  localizable chat UI from the start, not as an afterthought.
- Manual doc-reading is error-prone and drifts; copy-pasting samples bakes in sample-grade
  patterns without a record of provenance.

### Trade-offs
- The skills reflect a **point-in-time** snapshot of CometChat guidance (pinned by hash); they
  must be refreshed as the SDKs/UI Kits evolve.
- They add repo artifacts (`.agents/skills/`, `skills-lock.json`) that a reader unfamiliar with
  the workflow has to understand.

### Limitations or Assumptions
- Assumes the pinned skill hashes correspond to guidance compatible with the UI Kit v6
  versions actually used.
- The skills guide development; they are not runtime dependencies of the app.

### Future Improvements
- Refresh the skills lockfile when upgrading CometChat SDKs/UI Kits and record the bump.
- See **`COMETCHAT_SKILLS_USAGE.md`** for the full account of how each skill was applied
  across the Flutter and React integrations.

---

*Decision Log — CometLMS (LearnLoop). See [`DEMO_GUIDE.md`](./DEMO_GUIDE.md) for the
reproducible demo that exercises these decisions, and [`SCOPE_OF_WORK.md`](./SCOPE_OF_WORK.md)
for the requirement context.*
