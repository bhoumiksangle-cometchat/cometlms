# CometChat Skills — Development-Time Usage

This document explains the **CometChat "Skills"** committed to and used by this
repository, how they drove the Phase 2 integration, and the evidence that they were
actually applied.

**Related docs**

| Doc | Relevance |
|---|---|
| [`COMETCHAT_INTEGRATION.md`](./COMETCHAT_INTEGRATION.md) | The integration these skills produced |
| [`COMETCHAT_WEBHOOKS.md`](./COMETCHAT_WEBHOOKS.md) | Engagement analytics webhook |

---

## 1. What CometChat Skills are

CometChat publishes official **AI-agent "Skills"** — Markdown `SKILL.md` definitions
(source: GitHub **`cometchat/cometchat-skills`**) that an **AI coding agent loads
during development** to drive a correct, conversational CometChat integration. A
"dispatcher" skill detects the project's framework, gathers requirements through an
interactive Q&A, and routes to per-platform "core / components / placement" skills
that contain the source-verified API surface.

> **Important:** Skills are **dev-time tooling, not application runtime code.** None
> of them ship in the web/mobile bundles. They guide *how the integration was
> written*; the resulting code (in `apps/web` and `apps/mobile`) is what runs.

---

## 2. Committed skills — `apps/mobile/.agents/skills/`

Four **cross-cutting** skills are committed to the repo (the dispatcher + calls +
the two horizontal concerns). The per-platform pattern skills they route to are kept
**locally** (see §4).

### 2.1 `cometchat` — entry-point dispatcher (v3.0.0)

The top-level integration dispatcher. It:

- **Detects the framework** — React (Vite/CRA), Next.js, React Router, Astro, Expo /
  bare React Native, Angular, native Android (V6/V5), native iOS, and **Flutter
  (V6 stable / V5 legacy)**.
- **Gathers requirements** through an interactive conversation (it never guesses
  load-bearing choices like UID, region, route path, or Flutter version).
- **Routes** to the matching per-platform `*-core`, `*-components`, and `*-placement`
  pattern skills plus a framework-specific patterns skill.
- Ships **`references/asking-questions.md`** — the model-agnostic "clarification
  contract": render a structured/numbered choice, **wait for a real answer**, map by
  value/label not ordinal, accept free-text, one decision per prompt, and stop (not
  guess) when headless.

### 2.2 `cometchat-calls` — voice/video dispatcher (v4.0.0)

The calls integration entry-point. It:

- Picks **standalone** (calls-only) vs **additive** (calls on top of existing chat)
  mode and routes to the per-family calls skill.
- Documents the **dual-SDK contract** (Chat SDK `initiateCall` vs Calls SDK
  `joinSession` — not interchangeable) and that **group calls** use a custom
  `"meeting"` message, not the 1:1 ringing channel.
- Calls out the **Flutter V6 requirement**: one explicit
  `MaterialApp(navigatorKey: CallNavigationContext.navigatorKey)` wiring — exactly
  what this repo implements (see §5).
- Includes **5 use-case references**: `use-case-broadcast.md`,
  `use-case-marketplace.md`, `use-case-support.md`, `use-case-team.md`,
  `use-case-telehealth.md`.

### 2.3 `cometchat-a11y` — accessibility (v4.0.0)

Cross-family accessibility targeting **WCAG 2.1 AA**: theme color-contrast checks,
keyboard navigation, screen-reader live regions for new messages, focus management on
screen entry, and `prefers-reduced-motion`. Notes the UI Kit components are mostly
accessible out of the box; gaps appear in the wiring *around* the kit.

### 2.4 `cometchat-i18n` — localization (v4.0.0)

Cross-family localization: `CometChatLocalize.init` signature differences per
family, ~15 bundled languages with English fallback, custom-language registration,
and RTL support. For **React v6** the object form is
`CometChatLocalize.init({ language, fallbackLanguage })`; **Flutter** registers the
kit's `Translations` localization delegate (no `CometChatLocalize` class).

---

## 3. Lockfile — `apps/mobile/skills-lock.json`

A `version: 1` lockfile pins each committed skill to its upstream source with a
**SHA-256 `computedHash`** for provenance and reproducibility (so the agent uses the
exact reviewed skill text, not a drifted copy).

| Skill | source | sourceType | skillPath | computedHash (SHA-256, truncated) |
|---|---|---|---|---|
| `cometchat` | `cometchat/cometchat-skills` | `github` | `skills/cometchat/SKILL.md` | `b02b404b…c7a5fe7` |
| `cometchat-a11y` | `cometchat/cometchat-skills` | `github` | `skills/cometchat-a11y/SKILL.md` | `aa9f6616…dff1b6d` |
| `cometchat-calls` | `cometchat/cometchat-skills` | `github` | `skills/cometchat-calls/SKILL.md` | `0262b41f…f8ee3be` |
| `cometchat-i18n` | `cometchat/cometchat-skills` | `github` | `skills/cometchat-i18n/SKILL.md` | `58bb4196…2e4894253` |

---

## 4. Local superset — `.kiro/skills/` (git-ignored)

During development, an IDE-local superset of **~34 `SKILL.md`** files lived under
`.kiro/skills/` (git-ignored). These are the **per-platform pattern skills the
dispatcher routes to**, including the full **`cometchat-flutter-v5-*`** and
**`cometchat-flutter-v6-*`** families:

```
cometchat, cometchat-a11y, cometchat-calls, cometchat-i18n,
cometchat-flutter-v5-{core, calls, conversations, customization, events,
  messages, production, push, testing, theming, troubleshooting, users-groups},
cometchat-flutter-v6-{core, calls, components, conversations, customization,
  events, features, messages, migration, placement, production, push, testing,
  theming, troubleshooting, users-groups}
```

These supplied the concrete init/login, component, placement, theming, push,
testing, and troubleshooting guidance for the Flutter app. **Only the 4 cross-cutting
skills + the lockfile are committed**; the per-platform pattern skills were used
locally and intentionally not checked in.

---

## 5. Evidence the skills were actually used

| Evidence (in repo) | Matches skill prescription |
|---|---|
| `apps/mobile/lib/core/cometchat/cometchat_theme.dart` contains the comment **"Per the cometchat-flutter-v6-core skill:"** | Direct citation of `cometchat-flutter-v6-core` by name. |
| `apps/mobile/lib/core/router/app_router.dart` sets `MaterialApp(navigatorKey: CallNavigationContext.navigatorKey)` and imports `CallNavigationContext` | Exactly the **Flutter V6 calls wiring** the `cometchat-calls` skill flags as load-bearing. |
| `cometchat_service.dart` runs `CometChatUIKit.init(... enableCalls = true)` then **explicitly** `CometChatUIKitCalls.init(...)` after Chat SDK is ready | The skill's **dual-SDK init rule** (init Calls SDK after Chat SDK). |
| Web uses `@cometchat/chat-uikit-react@^6.5.2` with `UIKitSettingsBuilder` + `CometChatUIKit.init` and `loginWithAuthToken` | Follows the React **UI Kit v6 core** init/login pattern. |
| Mobile uses `cometchat_chat_uikit: 6.0.1` (calls bundled) | The Flutter **V6 (stable)** path the dispatcher recommends. |

---

## 6. Skill → implementation mapping

| Skill (family) | Guided | In repo |
|---|---|---|
| `cometchat` dispatcher + `cometchat-react-*` (web core/components/placement) | Web init, provider chain, login-with-token, chat/call surface placement | `apps/web/src/cometchat/`, `apps/web/src/features/chat/` |
| `cometchat-flutter-v6-core` | Flutter init/login, theme tokens | `apps/mobile/lib/core/cometchat/cometchat_service.dart`, `cometchat_theme.dart` |
| `cometchat-flutter-v6-components` / `-placement` | Conversations / messages / discussion screens | `apps/mobile/lib/features/chat/screens/` |
| `cometchat-calls` (+ `cometchat-flutter-v6-calls`) | Dual-SDK calls init, navigatorKey wiring, office-hours/group video | `cometchat_service.dart`, `app_router.dart`, web `OfficeHoursCall.tsx` / `CallButtons.tsx` |
| `cometchat-flutter-v6-push` | Push integration alongside the kept FCM pipeline | mobile push wiring |
| `cometchat-flutter-v6-theming` | Theme/customization | `cometchat_theme.dart` |
| `cometchat-a11y` | Accessibility review (cross-cutting) | UI Kit components (built-in) + custom surfaces |
| `cometchat-i18n` | Localization (cross-cutting) | UI Kit built-in localization |

---

## 7. Honest note on a11y and i18n

The `cometchat-a11y` and `cometchat-i18n` skills were **available and consulted**,
but their application was **partial**:

- **Localization (i18n):** the UI Kit v6 ships built-in localization (English +
  bundled languages with fallback). The app relies on these defaults; no custom
  language packs or RTL-specific work were added.
- **Accessibility (a11y):** the UI Kit components are accessible out of the box, and
  the skill's guidance informed the custom surfaces. However, a **full WCAG 2.1 AA
  audit was not formally completed** (e.g. the contrast/keyboard/live-region/
  reduced-motion checklist in the skill was not exhaustively verified and signed
  off). Treat full a11y conformance as outstanding work.
