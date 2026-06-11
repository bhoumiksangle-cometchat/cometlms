# LMS Feature Audit - Requirements Document

## Introduction

This document identifies broken, missing, and incomplete features in the LMS implementation based on the comprehensive requirements in `.ai_context.md`. The audit covers real-time chat, voice/video calling, AI agents, moderation, and backend integration features.

## Audit Scope

**Focus Areas from Requirements:**
- Real-time chat using Socket.IO (client and server)
- Course discussion groups
- Direct messages (DMs) between students and instructors
- Voice/video calling (Daily.co or WebRTC)
- AI Study Assistant (OpenAI GPT-4o)
- Course FAQ Bot
- Instructor AI Copilot
- AI Content Moderation
- Real-time presence and typing indicators
- Message reactions, threads, and @mentions
- Push notifications
- Internal event bus
- Admin moderation queue
- Activity event log
- AI Agent configuration

## Findings Summary

### Updates Completed (2026-06-09)

- Direct-message socket handlers are implemented on the backend.
- Authentication persistence now stores and restores access and refresh tokens across page refreshes.
- Token refresh flow is supported during auth restoration.
- WebRTC signaling flow now includes offer, answer, and ICE candidate handling for peer-to-peer calls.
- Voice/video calling infrastructure uses Socket.IO signaling plus browser WebRTC and is ready for UI integration in DMs and live class sessions.
- Added dedicated call controls component with voice/video, answer, reject, and end-call actions.
- Prepared architecture for presence-driven incoming call notifications.
- Identified next phase: LiveKit/Daily classroom sessions, TURN infrastructure, screen sharing, and recording services.

### Communication Infrastructure Added

- Added socket signaling events: `call:invite`, `call:ringing`, `call:accepted`, `call:rejected`.
- Added Prisma models for live classroom sessions and recording metadata persistence.
- Prepared backend for presence-driven incoming call workflows.
- Planned TURN configuration via `TURN_URL`, `TURN_USERNAME`, and `TURN_PASSWORD` environment variables.
- Planned SFU-based classroom architecture using LiveKit/Daily instead of peer-to-peer meshes.

| Category | Feature | Status |
|----------|---------|--------|
| ✅ Implemented | Real-time chat (basic) | Complete |
| ✅ Implemented | Socket.IO connection & auth | Complete |
| ✅ Implemented | Typing indicators | Complete |
| ✅ Implemented | Message reactions | Complete |
| ✅ Implemented | Message threading | Complete |
| ✅ Implemented | @mentions parsing | Complete |
| ✅ Implemented | Moderation queue (basic) | Complete |
| ✅ Implemented | Event logging (basic) | Complete |
| ⚠️ Incomplete | Direct Messages UI | Partial |
| ⚠️ Missing | Course Discussion UI Integration | Missing |
| ⚠️ Missing | Voice/Video Calling Integration | Missing |
| ⚠️ Missing | AI Agent Configuration UI | Missing |
| ⚠️ Missing | Real push notifications | Missing |
| ⚠️ Missing | Daily.co/mediasoup video integration | Missing |
| ⚠️ Missing | Email notifications (SendGrid) | Missing |
| ⚠️ Missing | Push notification credentials (FCM/APNs) | Missing |
| ⚠️ Missing | OpenAI API integration for AI agents | Missing |
| ⚠️ Missing | Image moderation (AWS Rekognition) | Missing |

---

## Detailed Feature Analysis

### 1. Real-Time Chat - Socket.IO Implementation

**Status: PARTIALLY IMPLEMENTED**

#### ✅ Implemented Features

**Backend (`apps/api/src/modules/chat/socket.server.ts`):**
- Socket.IO server setup with JWT authentication
- User presence tracking (online/offline)
- Room joining with membership validation
- Message sending with moderation
- Typing indicators (`typing:start`, `typing:stop`)
- Message reactions (add/remove)
- Message read receipts
- Message editing and deletion
- Call signaling events (`call:started`, `call:ended`, etc.)
- WebRTC signaling (`call:signal`)
- User mention notifications
- Activity event logging

**Frontend (`apps/web/src/features/chat/ChatProvider.tsx`):**
- Socket.IO client connection with JWT auth
- Real-time message receiving
- Typing indicator display
- Reaction handling
- Read receipt tracking
- Call event listeners

#### ⚠️ Issues Found

**1.1 Direct Messages (DM) Route Missing**
- **Issue**: Frontend uses `dm:fetch` and `dm:send` Socket.IO events, but no backend handlers exist for these events
- **Location**: `apps/web/src/features/chat/DirectMessages.tsx`
- **Impact**: DM functionality is completely non-functional
- **Required**: Add Socket.IO handlers for DM events

**1.2 Course Discussion Tab Not Integrated**
- **Issue**: Course player has Discussion tab but no actual chat integration
- **Location**: `apps/web/src/pages/index.tsx` CourseDiscussion component
- **Impact**: Chat UI renders but doesn't connect to backend
- **Required**: Connect ChatWindow component to current room

**1.3 Frontend ChatRoom Type Mismatch**
- **Issue**: Frontend ChatRoom interface missing critical fields from database schema
- **Location**: `apps/web/src/features/chat/ChatProvider.tsx`
- **Impact**: TypeScript type mismatches with actual data
- **Required**: Update interface to match backend schema

---

### 2. Direct Messages (DM) System

**Status: BROKEN - Missing Backend Implementation**

#### ✅ What's Implemented

**Database Schema (Prisma):**
- `ChatRoom` model with `type: 'DM'` support
- `ChatRoomMember` for user pairs
- `ChatMessage` with `parentMessageId` for threading

**Frontend Components:**
- `DirectMessages.tsx` - Basic DM UI with `dm:fetch` and `dm:send` events
- `DirectMessagesPage.tsx` - Full DM page
- `WebRTCContext.tsx` - Video call setup for DMs

#### ❌ Missing Backend Implementation

**Required Socket.IO Handlers:**
```typescript
// Missing in socket.server.ts:

socket.on('dm:fetch', async ({ otherUserId }: { otherUserId: string }) => {
  // Find or create DM room for user pair
  // Fetch messages from that room
  // Emit 'dm:messages' with message history
});

socket.on('dm:send', async ({ otherUserId, content }: { otherUserId: string; content: string }) => {
  // Find or create DM room for user pair
  // Send message to that room
  // Emit to both users
});
```

**Required Actions:**
1. Add DM room creation logic (find existing or create new)
2. Implement DM message sending
3. Add proper error handling for inactive users
4. Implement unread count tracking

---

### 3. Course Discussion Groups

**Status: PARTIALLY IMPLEMENTED**

#### ✅ What's Implemented

**Backend:**
- Automatic chat room creation on course publish
- Automatic member addition on enrollment
- Automatic member removal on unenrollment
- `createChatRoom()` and `addRoomMember()` functions

**Frontend:**
- `ChatWindow.tsx` component ready to use
- `CourseDiscussion` component in page index

#### ❌ Missing Integration

**Issue 3.1: Room Joining Not Implemented in Course Player**
```typescript
// In apps/web/src/pages/index.tsx CourseDiscussion():
// Current: Shows static messages
// Required: Should use ChatWindow component with roomId="course-{courseId}"

function CourseDiscussion() {
  // Current implementation uses static messages
  // Should be:
  const { roomId } = useContext(CourseContext);
  return <ChatWindow roomId={roomId} roomName={courseTitle} />;
}
```

**Issue 3.2: Course Room ID Not Available in Frontend**
- Frontend components don't receive `chatRoomId` from course data
- Required: Update course detail API to include `chatRoomId`

---

### 4. Voice/Video Calling

**Status: MISSING INTEGRATION**

#### ✅ What's Implemented

**Database Schema:**
- Call events logged in `ActivityEventLog`
- `call:started`, `call:ended` events logged

**Frontend Components:**
- `WebRTCContext.tsx` - Basic WebRTC setup
- `CallPanel.tsx` - Video element container
- Socket.IO call events sent but not handled

#### ❌ Missing Implementation

**4.1 No Daily.co or mediasoup Integration**
- Frontend calls `WebRTCClient.start()` but no actual video service
- No API keys configured for Daily.co or mediasoup
- Call signaling events not processed by backend

**4.2 Missing Call State Management**
- Frontend emits `call:signal` events but no backend handlers
- Missing ICE candidate and offer/answer handling

**Required Actions:**
1. Integrate Daily.co SDK with API key configuration
2. Implement backend call signaling handlers
3. Create call rooms for office hours
4. Add call recording integration
5. Implement push notifications for live sessions

---

### 5. AI Agent Integration

**Status: PARTIALLY IMPLEMENTED**

#### ✅ What's Implemented

**Backend:**
- `generateAgentReply()` function in `agents.ts`
- `handleBotMention()` for @bot mentions
- Agent config storage in `AiAgentConfig` table

**Frontend:**
- `AiStudyAssistant` component in page index
- AI endpoint call in `apiClient` (`/api/chat/agents/message`)

#### ❌ Missing Implementation

**5.1 OpenAI API Not Configured**
```typescript
// In apps/api/src/modules/chat/agents.ts:
// Current: Mock response
// Required: Call OpenAI API when OPENAI_API_KEY is set

export async function generateAgentReply(input: AgentReplyInput) {
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - using mock response');
    return mockResponse; // Current behavior
  }
  
  // Call OpenAI API with LangChain or OpenAI SDK
  // Implementation missing
}
```

**5.2 FAQ Bot Not Working**
- Backend has `FAQ_BOT` agent type
- No bot users created in database
- No FAQ data source configured

**5.3 Instructor Copilot Missing**
- UI component exists in page index
- No backend endpoint for thread summarization
- No API key configuration for OpenAI

**5.4 Agent Configuration UI Missing**
- Admin dashboard shows agent list
- No UI to add/edit agent configurations
- System prompt editor not implemented

**Required Actions:**
1. Add OpenAI API key configuration
2. Create bot users in database (FAQ Bot, Study Assistant)
3. Implement FAQ knowledge base
4. Add agent configuration UI with prompt editor
5. Implement thread summarization for Instructor Copilot

---

### 6. Moderation System

**Status: PARTIALLY IMPLEMENTED**

#### ✅ What's Implemented

**Backend:**
- `moderateMessage()` function in `moderation.ts`
- Blocked terms check
- Profanity word check (empty list)
- Spam pattern detection
- Rate limiting
- Similarity checking
- Moderation log creation

**Frontend:**
- `ModerationQueue` component in admin dashboard
- Dismiss/Ban buttons
- Flag display

#### ❌ Issues Found

**6.1 Profanity Word List Empty**
```typescript
// In apps/api/src/modules/chat/moderation.ts:
const PROFANITY_WORDS = [
  // Add profanity list here - EMPTY!
];
```
- Required: Add profanity word list or integrate API

**6.2 Image Moderation Not Implemented**
- Requirements require AWS Rekognition or OpenAI Vision
- Only text moderation implemented
- No image upload handling

**6.3 External Link Blocking Not Configurable**
- URL pattern hardcoded in `SPAM_PATTERNS`
- No admin UI to configure blocked domains

**6.4 Moderation Queue Not Real-Time**
- Frontend shows static flags array
- No Socket.IO subscription to `moderation:flagged` events
- No auto-refresh when new flags arrive

**Required Actions:**
1. Add profanity word list or API integration
2. Implement image moderation
3. Add moderation configuration UI
4. Integrate Socket.IO for real-time flag updates
5. Add escalations to admin dashboard

---

### 7. Event Processing & Activity Log

**Status: PARTIALLY IMPLEMENTED**

#### ✅ What's Implemented

**Backend:**
- `ActivityEventLog` model in database
- `processActivityEvents()` function in `eventProcessor.ts`
- Event handlers for common events
- Course engagement metrics aggregation

**Frontend:**
- Activity log display in admin dashboard
- Event type display

#### ❌ Issues Found

**7.1 Event Processing Not Scheduled**
```typescript
// In apps/api/src/modules/chat/eventProcessor.ts:
export async function processActivityEvents() {
  // Function exists but is never called
  // Should be scheduled to run every minute (BullMQ job)
}
```
- Required: Set up BullMQ job to process events

**7.2 Frontend Activity Log Not Real-Time**
- Static display in admin dashboard
- No pagination or search
- No Socket.IO integration for live updates

**7.3 Metrics Not Calculated Correctly**
- `activeChatters` count always 0
- No deduplication of chatters per time window

**Required Actions:**
1. Set up BullMQ job for event processing
2. Add Socket.IO to admin dashboard for real-time updates
3. Implement active chatters calculation
4. Add pagination to activity log

---

### 8. Push Notifications

**Status: MISSING**

#### ❌ What's Missing

**8.1 No Push Notification System**
- Requirements specify FCM/APNs for mobile push
- Requirements specify email via SendGrid
- No notification sending implementation
- No notification queue (BullMQ)

**8.2 Missing Frontend Push Integration**
- Browser notification permission not requested
- Service worker not configured
- No FCM/APNs setup

**Required Actions:**
1. Set up BullMQ + Redis for notification queue
2. Configure SendGrid for email
3. Implement FCM/APNs credentials
4. Add service worker for browser notifications
5. Request notification permission in frontend
6. Handle push event in browser

---

### 9. Admin Dashboard Features

**Status: UI READY, MISSING BACKEND INTEGRATION**

#### ✅ What's Implemented

**Backend Routes (`apps/api/src/modules/admin/admin.routes.ts`):**
- `/api/admin/stats` - Platform KPIs
- `/api/admin/moderation` - Flagged messages
- `/api/admin/moderation/:id/dismiss` - Dismiss flag
- `/api/admin/moderation/:id/ban` - Ban user
- `/api/admin/events/log` - Activity event log
- `/api/admin/agents` - List agent configs
- `/api/admin/agents/:id` - Update agent config

**Frontend UI:**
- Stats display
- Moderation queue
- Activity log
- Agent configuration

#### ❌ Issues Found

**9.1 Admin Stats Endpoint Returns Wrong Data**
```typescript
// Current: Returns raw counts
{
  users: number,
  courses: number,
  enrollments: number,
  pendingFlags: number
}

// Required: Should include engagement metrics
{
  activeUsers: number, // Users active in last 7 days
  messagesToday: number,
  activeCourses: number,
  engagementScore: number // 0-100
}
```

**9.2 Frontend Admin Stats Not Connected**
- Static KPI data in `KpiRow` component
- No API call to `/api/admin/stats`

**9.3 Moderation Queue Not Real-Time**
- Uses static `flags` array
- Should use Socket.IO `moderation:flagged` events

---

### 10. Database Integration

**Status: PARTIALLY IMPLEMENTED**

#### ✅ What's Implemented

**Schema:**
- All required models created
- Proper relationships defined
- Enums for all status fields

#### ❌ Issues Found

**10.1 ChatRoom Model Missing Relations**
```prisma
// In schema.prisma:
model ChatRoom {
  // ...
  members   ChatRoomMember[]
  messages  ChatMessage[]
  // MISSING: course relation
  course    Course?  // Should exist for course rooms
}
```

**10.2 ChatRoomMember Role Type Not Enum**
- `role` field is `String` with default "member"
- Should be enum: `role: 'owner' | 'member' | 'bot'`

**10.3 Message Metadata Schema Not Defined**
- `metadata` is `Json?` with no structure definition
- Should define schema for reactions, mentions, readBy

---

### 11. Authentication & Authorization

**Status: IMPLEMENTED BUT INCOMPLETE**

#### ✅ What's Implemented

- JWT authentication
- Role-based middleware (`requireRole`)
- Socket.IO authentication
- User roles: STUDENT, INSTRUCTOR, ADMIN, SUPER_ADMIN, AI_AGENT

#### ❌ Missing

**11.1 Bot User Creation**
- AI agents need bot users in database
- No seeding script for bot users (FAQ Bot, Study Assistant, Copilot)
- No API to create bot users

**Required Actions:**
1. Create seed script for bot users
2. Add API endpoint for admin to create bot users
3. Update role enum to include AI_AGENT in auth middleware

---

### 12. Missing Utility Functions

**Status: MISSING**

**12.1 Message @mention Resolution**
```typescript
// In apps/api/src/modules/chat/messages.ts:
export function extractMentions(content: string): string[] {
  // Returns names, but should return user IDs
  // Should resolve @username to actual user ID
}
```

**12.2 Course Progress Calculation**
- Frontend has `CourseProgress` component
- Backend has progress endpoint
- But no real-time progress updates via Socket.IO

**12.3 Notification De-duplication**
- Multiple mentions should be grouped
- No unread count aggregation

---

## Broken Features Matrix

| Feature | Backend Status | Frontend Status | Priority |
|---------|---------------|-----------------|----------|
| Real-time Chat | ✅ Complete | ⚠️ Partial | High |
| Direct Messages | ❌ Broken | ⚠️ Partial | High |
| Course Discussion | ⚠️ Partial | ⚠️ Partial | High |
| Voice/Video Calling | ❌ Missing | ⚠️ Partial | High |
| AI Study Assistant | ⚠️ Mock | ⚠️ UI Only | Medium |
| FAQ Bot | ⚠️ Mock | ⚠️ UI Only | Medium |
| Instructor Copilot | ❌ Missing | ⚠️ UI Only | Medium |
| Content Moderation | ⚠️ Partial | ⚠️ UI Only | High |
| Push Notifications | ❌ Missing | ❌ Missing | Medium |
| Event Processing | ⚠️ Incomplete | ⚠️ UI Only | Medium |
| Admin Moderation Queue | ⚠️ Partial | ⚠️ UI Only | High |
| Activity Event Log | ⚠️ Incomplete | ⚠️ UI Only | Low |
| AI Agent Config UI | ❌ Missing | ❌ Missing | Medium |

---

## Impact Assessment

### Critical Issues (Block Production)
1. **DM System Not Functional** - No backend Socket.IO handlers for `dm:fetch` and `dm:send`
2. **Course Discussion Not Integrated** - Chat UI renders but doesn't connect to backend
3. **AI Agents Not Working** - All use mock responses, no OpenAI API integration
4. **Moderation Not Complete** - Empty profanity list, no image moderation

### High Priority (Should Fix Before Launch)
5. **Voice/Video Calling Not Working** - No video service integration
6. **Push Notifications Missing** - No FCM/APNs or email notifications
7. **Event Processing Not Scheduled** - `processActivityEvents()` never called

### Medium Priority (Improve UX)
8. **Admin Stats Not Connected** - UI shows static data
9. **Moderation Queue Not Real-Time** - No Socket.IO integration
10. **Bot Users Not Created** - AI agents have no bot users in database

### Low Priority (Nice to Have)
11. **Active Chatters Not Calculated** - Always 0
12. **Activity Log Not Paginated** - All events shown at once

---

## Recommendations

### Phase 1: Critical Fixes (1-2 weeks)
1. Implement DM Socket.IO handlers
2. Connect CourseDiscussion to real chat
3. Set up OpenAI API integration
4. Add profanity word list or API

### Phase 2: Enhancement (2-3 weeks)
5. Integrate Daily.co for video calling
6. Set up push notification system
7. Implement event scheduling with BullMQ
8. Add bot user seeding script

### Phase 3: Polish (1-2 weeks)
9. Connect admin stats to API
10. Add real-time moderation updates
11. Implement active chatters calculation
12. Add pagination to activity log

---

## Next Steps

1. **Review this audit report** - Ensure all issues are captured
2. **Prioritize fixes** - Decide which issues to address first
3. **Create implementation tasks** - Break down each fix into actionable tasks
4. **Set up testing** - Verify fixes work correctly