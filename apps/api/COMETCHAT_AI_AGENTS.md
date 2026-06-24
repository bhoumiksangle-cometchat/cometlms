# CometChat AI Agents & Webhooks — Setup Guide

This project previously used custom Groq-powered AI bots relayed through a server-side webhook. That code has been removed in favor of **CometChat's built-in AI Agent Builder**, which handles bot creation, LLM integration, and message delivery natively — no server-side relay needed.

---

## AI Agents (replaces custom agents.ts + bot-sync.ts + webhook.handler.ts)

### What changed

| Before (custom) | After (CometChat native) |
|---|---|
| 3 bot users synced to CometChat on server startup | Agents created in CometChat Dashboard |
| Webhook intercepted @mentions, called Groq API, sent reply via REST API | CometChat handles the full loop: trigger → LLM → reply |
| Required GROQ_API_KEY on the server | LLM keys configured in CometChat Dashboard |
| Custom system prompts in code | System prompts configured in Agent Builder |

### Setup (one-time, in CometChat Dashboard)

1. **Open Agent Builder:** Go to [app.cometchat.com](https://app.cometchat.com) → Your App → AI Agent → Agent Builder → Add AI Agent.

2. **Create 3 agents** (to match the previous functionality):

   | Agent Name | Purpose | Suggested System Prompt |
   |---|---|---|
   | FAQ Bot | Answer course FAQs | "You are a helpful FAQ assistant for an online learning platform. Answer questions about course material, schedules, requirements, and policies concisely." |
   | Study Assistant | Help students understand material | "You are a patient study tutor. Help students understand difficult concepts with step-by-step explanations. Keep responses under 500 characters." |
   | Instructor Copilot | Assist instructors with replies | "You are an instructor copilot. Summarize discussions and draft instructor replies that are professional, supportive, and educational." |

3. **Configure each agent:**
   - Select an LLM model (e.g., GPT-4o, Claude, or any supported model)
   - Set the system prompt (instructions)
   - Optionally attach a Knowledge Base (upload course materials, syllabi, etc.)
   - Configure trigger mode (e.g., respond when @mentioned, or respond to all messages in a conversation)

4. **Link agents to course groups:** Add the agent user as a member of the relevant CometChat groups (`course-<courseId>`).

### Documentation

- [Agent Builder Overview](https://www.cometchat.com/docs/ai-agents/agent-builder/overview)
- [Configure Instructions](https://www.cometchat.com/docs/ai-agents/agent-builder/instructions)
- [Knowledge Base](https://www.cometchat.com/docs/ai-agents/agent-builder/knowledge-base/overview)
- [BYO Agent (bring your own)](https://www.cometchat.com/docs/ai-agents/cometchat-ag-ui-byoa)

---

## Webhooks (simplified)

### What remains on the server

Only **one** custom webhook endpoint is still active:

```
POST /api/webhooks/cometchat/events
```

This tracks **per-course engagement metrics** (messages/day, reactions/day, call minutes/day) in the `CourseEngagementMetrics` table — data CometChat doesn't aggregate at the course-group level.

### Dashboard webhook configuration

1. Go to [app.cometchat.com](https://app.cometchat.com) → Your App → Webhooks
2. Create a webhook:
   - **URL:** `https://<your-domain>/api/webhooks/cometchat/events`
   - **Triggers:** Enable these events:
     - `message_new` (or `on_message_sent`)
     - `message_reaction_added` (or `on_message_reaction_added`)
     - `call_ended` (or `on_call_ended`)
   - **Security:** Enable HMAC-SHA256 signing
   - **Secret:** Set a random value and put the same value in your `.env` as `COMETCHAT_WEBHOOK_SECRET`

### Webhook events CometChat handles natively (no server needed)

These are configured entirely in the CometChat Dashboard and don't require your server:

| Feature | How to enable |
|---|---|
| Push notifications on new message | Dashboard → Notifications → Push Notifications |
| Email notifications | Dashboard → Notifications → Email (or custom provider webhook) |
| AI bot replies | Dashboard → AI Agent → Agent Builder (see above) |
| Profanity filter | Dashboard → Moderation → Rules |
| Image moderation | Dashboard → Moderation → Rules |
| Smart Replies | Dashboard → Chat → Features → AI User Copilot → Smart Replies |
| Conversation Summary | Dashboard → Chat → Features → AI User Copilot → Conversation Summary |
| Conversation Starter | Dashboard → Chat → Features → AI User Copilot → Conversation Starter |
| Message Translation | Dashboard → Chat → Features → Message Translation |

---

## Push Notifications (unchanged)

Push notifications still use the Firebase Cloud Messaging pipeline on this server:

- **Registration:** `POST /api/notifications/device-token` (client registers FCM token)
- **Dispatch:** BullMQ worker → Firebase Admin SDK → FCM
- **Triggers:** Course published, @mentions (in-app + email)

This is separate from CometChat's built-in push notification system. If you want to consolidate, you can enable CometChat's native push notifications in the Dashboard and disable the custom pipeline — but the current setup gives you control over notification content and routing.

---

## Environment Variables

| Variable | Purpose | Required? |
|---|---|---|
| `COMETCHAT_APP_ID` | CometChat app identifier | Yes |
| `COMETCHAT_REGION` | CometChat region (us/eu/in) | Yes |
| `COMETCHAT_REST_API_KEY` | Server-side API key for user/group management | Yes |
| `COMETCHAT_AUTH_KEY` | Client-side auth key (used in web/mobile apps) | Yes (client) |
| `COMETCHAT_WEBHOOK_SECRET` | HMAC secret for verifying webhook signatures | Recommended |
| `FIREBASE_PROJECT_ID` | Firebase project for push notifications | Optional |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email | Optional |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key | Optional |

**No longer needed:** `GROQ_API_KEY`, `GROQ_MODEL` — AI is managed in CometChat Dashboard.
