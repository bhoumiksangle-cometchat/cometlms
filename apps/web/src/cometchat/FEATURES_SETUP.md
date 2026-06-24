# CometChat Extensions & AI Features Setup

This document describes the CometChat dashboard extensions and AI features to enable for the CometLMS application.

## Prerequisites

- CometChat App ID: `168018950424c5f81`
- Region: `india`
- Dashboard URL: https://app.cometchat.com

---

## 1. Extensions to Enable

Navigate to **CometChat Dashboard > Extensions** and enable each of the following:

### 1.1 Reactions
- **Extension name:** Reactions
- **Purpose:** Allow users to react to messages with emojis
- **Configuration:** None required (works out of the box)

### 1.2 Polls
- **Extension name:** Polls
- **Purpose:** Instructors and students can create polls in group discussions
- **Configuration:** None required

### 1.3 Stickers
- **Extension name:** Stickers
- **Purpose:** Sticker packs in the message composer
- **Configuration:** Default sticker packs are included. Custom packs can be added later.

### 1.4 Rich Text Formatting
- **Extension name:** Rich Media / Formatted Messages
- **Purpose:** Bold, italic, code blocks, and inline code in messages
- **Configuration:** None required — the `CometChatMessageComposer` component automatically shows the rich text toolbar when this extension is active.
- **Note:** The React UI Kit v6 auto-enables the formatting toolbar. No code changes needed in `CourseDiscussion.tsx`.

### 1.5 Message Translation
- **Extension name:** Message Translation
- **Purpose:** Auto-translate messages into the reader's preferred language
- **Configuration:**
  1. Enable the extension
  2. Add a Google Translate API key in the extension settings (or use the built-in CometChat translation if available on your plan)

### 1.6 Link Preview
- **Extension name:** Link Preview
- **Purpose:** Shows URL previews (title, image, description) for shared links
- **Configuration:** None required

### 1.7 Profanity Filter
- **Extension name:** Data Masking / Profanity Filter
- **Purpose:** Automatically masks profane words in messages
- **Configuration:**
  1. Enable the extension
  2. Choose masking character (default: `*`)
  3. Add custom blocked words if needed

### 1.8 Moderation (Content Moderation)
- **Extension name:** Content Moderation
- **Purpose:** Auto-flags messages containing inappropriate content for admin review
- **Configuration:**
  1. Enable the extension
  2. Set moderation mode to "Flag" (not "Block") so messages are visible but flagged
  3. Configure categories (profanity, spam, hate speech)
- **Admin Endpoint:** Flagged messages are queryable via `GET /api/admin/moderation`

### 1.9 Collaborative Document (Optional)
- **Extension name:** Collaborative Document
- **Purpose:** Real-time collaborative document editing in chat
- **Configuration:** Requires an Etherpad instance. Enable only if Etherpad is deployed.

### 1.10 Collaborative Whiteboard (Optional)
- **Extension name:** Collaborative Whiteboard
- **Purpose:** Real-time whiteboard collaboration in chat
- **Configuration:** Requires a whiteboard service. Enable only if the service is deployed.

---

## 2. AI Features to Enable

Navigate to **CometChat Dashboard > AI** section:

### 2.1 AI Smart Replies
- **Purpose:** Suggests contextual quick-reply options below received messages
- **Setup:**
  1. Navigate to Dashboard > AI > Smart Replies
  2. Enable Smart Replies
  3. Add your OpenAI API key
  4. Select model (recommended: `gpt-4o-mini` for cost efficiency)

### 2.2 AI Conversation Starter
- **Purpose:** Suggests a first message for new/empty conversations
- **Setup:**
  1. Navigate to Dashboard > AI > Conversation Starter
  2. Enable Conversation Starter
  3. Uses the same OpenAI API key configured above

### 2.3 AI Conversation Summary
- **Purpose:** Provides a summary of long conversation threads
- **Setup:**
  1. Navigate to Dashboard > AI > Conversation Summary
  2. Enable Conversation Summary
  3. Uses the same OpenAI API key configured above

---

## 3. Webhook Configuration

Navigate to **CometChat Dashboard > Webhooks**:

1. **URL:** `https://<your-api-domain>/api/webhooks/cometchat`
2. **Events to subscribe:**
   - `message_sent` — triggers AI bot replies on @mention
   - `message_edited`
   - `message_deleted`
3. **Webhook Secret:** Set a random secret and add it to your API `.env` as `COMETCHAT_WEBHOOK_SECRET`
4. The webhook handler verifies the `x-cometchat-signature` header using HMAC-SHA256.

---

## 4. Environment Variables

### API (`apps/api/.env`)

```env
COMETCHAT_APP_ID=168018950424c5f81
COMETCHAT_REGION=india
COMETCHAT_AUTH_KEY=63afb1ed8e52ebd5bc2098689e6c14713f7dccdb
COMETCHAT_REST_API_KEY=7ec8eea1d54144f1d64908a99a8c3e30ad2f580a
COMETCHAT_WEBHOOK_SECRET=<your-webhook-secret>
```

### Web (`apps/web/.env`)

```env
VITE_COMETCHAT_APP_ID=168018950424c5f81
VITE_COMETCHAT_REGION=india
VITE_COMETCHAT_AUTH_KEY=63afb1ed8e52ebd5bc2098689e6c14713f7dccdb
```

Optional feature flags (all default to `true` unless noted):

```env
VITE_COMETCHAT_FEATURES_POLLS=true
VITE_COMETCHAT_FEATURES_REACTIONS=true
VITE_COMETCHAT_FEATURES_STICKERS=true
VITE_COMETCHAT_FEATURES_RICH_TEXT=true
VITE_COMETCHAT_FEATURES_TRANSLATION=true
VITE_COMETCHAT_FEATURES_LINK_PREVIEW=true
VITE_COMETCHAT_FEATURES_MODERATION=true
VITE_COMETCHAT_FEATURES_AI_SMART_REPLIES=true
VITE_COMETCHAT_FEATURES_AI_CONVERSATION_STARTER=true
VITE_COMETCHAT_FEATURES_AI_CONVERSATION_SUMMARY=true
VITE_COMETCHAT_FEATURES_COLLABORATIVE_DOC=false
VITE_COMETCHAT_FEATURES_WHITEBOARD=false
```

---

## 5. Notes on the React UI Kit v6

- **Rich Text:** The `CometChatMessageComposer` component automatically shows the rich text toolbar when the Rich Media extension is active in the dashboard. No additional props or component swaps are needed.
- **Reactions:** Rendered inline on messages when the Reactions extension is active.
- **Polls:** The "+" attachment menu in the composer shows "Create Poll" when the Polls extension is enabled.
- **Stickers:** Sticker icon appears in the composer toolbar when the Stickers extension is active.
- **AI Smart Replies:** Shown as suggestion chips below received messages automatically.
- **AI Conversation Starter:** Shown as suggested first messages in empty conversations.
- **AI Conversation Summary:** Available via the message header or info panel.

All features are dashboard-driven — the UI Kit detects enabled extensions at runtime and shows the corresponding UI elements.
