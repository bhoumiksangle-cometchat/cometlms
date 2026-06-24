# CometLMS Cleanup Notes

Generated during Task 15 (End-to-End Testing & Cleanup).

---

## 1. Dependencies to Remove

### `apps/api/package.json`

| Package | Reason |
|---------|--------|
| `socket.io` | Real-time messaging migrated to CometChat. Server.ts already has a removal note. |

### `apps/web/package.json`

| Package | Reason |
|---------|--------|
| `socket.io-client` | No active imports in source `.ts`/`.tsx` files. CometChat SDK handles real-time. |

---

## 2. Dead Files Already Cleaned (Task 12)

The following old Socket.IO / WebRTC chat files were removed in earlier tasks:

- `apps/web/src/features/chat/ChatProvider.tsx` (old Socket.IO context)
- `apps/web/src/features/chat/DirectMessages.tsx` (old Socket.IO DM component)
- `apps/web/src/features/chat/DirectMessagesPage.tsx`
- `apps/web/src/features/chat/WebRTCContext.tsx`
- `apps/web/src/features/chat/ChatWindow.tsx`
- `apps/web/src/features/chat/CallManager.tsx`
- `apps/api/src/modules/chat/socket.server.ts` (old Socket.IO server)
- `apps/api/src/modules/chat/chat.routes.ts` (old REST routes for local chat)

### Still present but stale (compiled `.js` artifacts)

The following `.js` files in `apps/api/src/` are stale pre-migration compiled outputs.
They are NOT used at runtime (the server runs via `tsx watch src/server.ts`). They reference
old ChatRoom, socket.io, and chatRoomMember code that no longer exists in the `.ts` source.
Safe to delete:

- `apps/api/src/server.js` (references old `socket.server`, `chatRoutes`)
- `apps/api/src/modules/courses/course.service.js` (references `chatRoomId`, `chatRoom`)
- `apps/api/src/modules/courses/course.model.js` (references `chatRoomId`)
- `apps/api/src/modules/courses/course.routes.js` (references `chatRoom` upsert)
- `apps/api/src/modules/enrollments/enrollment.routes.js` (references `chatRoomMember`)
- `apps/api/src/modules/enrollments/enrollment.service.js` (references `chatRoomMember`)
- `apps/api/src/modules/payments/payment.service.js` (references `chatRoomMember`)
- All other `*.js` and `*.js.map` files in `apps/api/src/` (stale compiled output)

### Dead test file

- `tests/socket.integration.test.ts` — tests old Socket.IO server; should be removed.

### Shared types with dead interfaces

- `packages/shared-types/src/index.ts` still exports `ChatRoom`, `ChatRoomMember`, `ChatMessage`, `ChatRoomType`, `MessageContentType` interfaces that are no longer used by any active frontend or backend code. These can be removed when the Prisma schema drops the legacy tables.

---

## 3. TypeScript Error Status

### `apps/web/` — PASSES CLEANLY

```
npx tsc --noEmit --skipLibCheck  →  0 errors
npx vite build                   →  Success (built in ~4s)
```

### `apps/api/` — 226 errors (ALL PRE-EXISTING)

None of these are related to the CometChat migration. They are pre-existing issues:

| Category | Count | Notes |
|----------|-------|-------|
| ioredis / bullmq version mismatch | 2 | `src/lib/queue.ts` — needs ioredis version alignment |
| `AuthRequest` not exported | 5 | Controllers import `AuthRequest` from auth middleware |
| Prisma type mismatches (enum as string) | ~40 | Course/Enrollment/Notification/Quiz models pass strings where Prisma expects enums |
| `Course` model constructor null vs undefined | ~20 | `thumbnailUrl: string | null` vs `string | undefined` |
| `default` export not found | 4 | Module index files export `default as X` but routes use named exports |
| Quiz model complex type issues | ~40 | Quiz/Answer Prisma types don't match model class |
| Pages/components typing (index.tsx) | ~90 | Large admin page with untyped event targets, optional chaining issues |
| Test file typing | 3 | Mock setup issues in test files |

These are NOT new errors introduced by the CometChat integration.

---

## 4. Production Readiness Checklist

### Auth Flow

| Check | Status | Notes |
|-------|--------|-------|
| `loginWithAuthToken()` used for login | PASS | `apps/web/src/cometchat/init.ts` line 72 — prefers server token |
| Auth Key only a fallback | PASS | Falls back to `CometChatUIKit.login(uid)` only when token fails (dev mode) |
| Backend uses `COMETCHAT_REST_API_KEY` (server-only) | PASS | `apps/api/src/services/cometchat.service.ts` — env var, never exposed |
| No `VITE_COMETCHAT_REST_API_KEY` in client | PASS | Grep returns zero matches |
| `VITE_COMETCHAT_AUTH_KEY` NOT used for direct login | PASS | Only passed to `UIKitSettingsBuilder.setAuthKey()` for SDK init (required by SDK) |

### Build & Compilation

| Check | Status |
|-------|--------|
| `apps/web/` TypeScript compiles | PASS |
| `apps/web/` Vite production build | PASS |
| `apps/api/` TypeScript compiles | FAIL (pre-existing, unrelated to CometChat) |

### Dead Code

| Check | Status |
|-------|--------|
| No `simple-peer` imports | PASS |
| No `WebRTCContext` in web app | PASS |
| No `ChatWindow` component imports | PASS |
| No `CallManager` component imports | PASS |
| No active socket.io imports in `.ts` source | PASS (only in stale `.js` files and dead test) |

### Mobile App (Flutter)

The Flutter mobile app (`apps/mobile/`) still references `flutter_webrtc` and `WebRTCService`.
This is expected — the mobile app has its own call implementation and was NOT part of the
CometChat web migration scope.

---

## 5. Recommendations

1. **Run `npm uninstall socket.io`** in `apps/api/` and `npm uninstall socket.io-client` in `apps/web/`
2. **Delete stale `.js` / `.js.map` / `.d.ts` / `.d.ts.map` files** from `apps/api/src/` (they are compiled artifacts, not source)
3. **Delete `tests/socket.integration.test.ts`** — tests dead infrastructure
4. **Remove legacy chat interfaces** from `packages/shared-types/src/index.ts` when ready to drop old DB tables
5. **Fix pre-existing API TypeScript errors** (separate effort — not blocking CometChat)
