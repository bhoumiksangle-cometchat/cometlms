import { prisma } from '../../server';

const isDevMode = () => !process.env.DATABASE_URL;

/**
 * Process activity events to generate analytics and update engagement metrics
 * This should run periodically (e.g., every minute) to process pending events
 */
export async function processActivityEvents() {
  // Skip processing in dev mode
  if (isDevMode()) {
    return { processed: 0, failed: 0, skipped: 'dev-mode' };
  }

  try {
    const pendingEvents = await prisma.activityEventLog.findMany({
      where: { status: 'RECEIVED' },
      orderBy: { createdAt: 'asc' },
      take: 100, // Process in batches
    });

    if (pendingEvents.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const event of pendingEvents) {
      try {
        await processEvent(event);
        processed++;
      } catch (error) {
        failed++;
        console.error(`Failed to process event ${event.id}:`, error);

        // Mark as failed
        await prisma.activityEventLog.update({
          where: { id: event.id },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    return { processed, failed };
  } catch (error) {
    console.error('Error processing activity events:', error);
    throw error;
  }
}

/**
 * Process a single activity event
 */
async function processEvent(event: { id: string; eventType: string; payload: Record<string, unknown> }) {
  const { eventType, payload } = event;

  switch (eventType) {
    case 'message:sent':
      await handleMessageSent(payload);
      break;

    case 'message:reaction_added':
      await handleReactionAdded(payload);
      break;

    case 'message:reaction_removed':
      await handleReactionRemoved(payload);
      break;

    case 'user:mentioned':
      await handleMentionEvent(payload);
      break;

    case 'user:presence_changed':
      await handlePresenceChange(payload);
      break;

    case 'call:started':
      await handleCallStarted(payload);
      break;

    case 'call:ended':
      await handleCallEnded(payload);
      break;

    case 'moderation:flagged':
      await handleModerationFlagged(payload);
      break;

    case 'message:edited':
    case 'message:deleted':
    case 'call:user_joined':
    case 'call:user_left':
    case 'message:read_by':
      // These don't require special processing for now
      break;

    default:
      console.warn(`Unknown event type: ${eventType}`);
  }

  // Mark event as processed
  await prisma.activityEventLog.update({
    where: { id: event.id },
    data: {
      status: 'PROCESSED',
      processedAt: new Date(),
    },
  });
}

/**
 * Handle message sent event - update engagement metrics
 */
async function handleMessageSent(payload: Record<string, unknown>) {
  const { roomId } = payload;

  if (!roomId || typeof roomId !== 'string') {
    throw new Error('Invalid roomId in message:sent event');
  }

  // Find the course for this room
  const room = await prisma.chatRoom.findUnique({
    where: { roomId },
    include: { course: true },
  });

  if (!room?.course) {
    return; // Not a course room
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfToday = new Date(today);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  // Count unique senders for this room today
  const chattersCountResult = await prisma.chatMessage.groupBy({
    by: ['senderId'],
    where: {
      roomId: room.id,
      createdAt: {
        gte: startOfToday,
        lte: endOfToday,
      },
    },
  });

  const activeChattersCount = chattersCountResult.length;

  // Update or create engagement metrics for today
  await prisma.courseEngagementMetrics.upsert({
    where: {
      courseId_date: {
        courseId: room.course.id,
        date: today,
      },
    },
    update: {
      totalMessages: { increment: 1 },
      activeChatters: activeChattersCount,
    },
    create: {
      courseId: room.course.id,
      date: today,
      totalMessages: 1,
      totalReactions: 0,
      activeChatters: 1,
      callMinutes: 0,
      flaggedMessages: 0,
      resolvedFlags: 0,
    },
  });
}

/**
 * Handle reaction added event
 */
async function handleReactionAdded(payload: Record<string, unknown>) {
  const { roomId } = payload;

  if (!roomId || typeof roomId !== 'string') {
    return;
  }

  const room = await prisma.chatRoom.findUnique({
    where: { roomId },
    include: { course: true },
  });

  if (!room?.course) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.courseEngagementMetrics.upsert({
    where: {
      courseId_date: {
        courseId: room.course.id,
        date: today,
      },
    },
    update: {
      totalReactions: { increment: 1 },
    },
    create: {
      courseId: room.course.id,
      date: today,
      totalMessages: 0,
      totalReactions: 1,
      activeChatters: 0,
      callMinutes: 0,
      flaggedMessages: 0,
      resolvedFlags: 0,
    },
  });
}

/**
 * Handle reaction removed event
 */
async function handleReactionRemoved(payload: Record<string, unknown>) {
  const { roomId } = payload;

  if (!roomId || typeof roomId !== 'string') {
    return;
  }

  const room = await prisma.chatRoom.findUnique({
    where: { roomId },
    include: { course: true },
  });

  if (!room?.course) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Decrement only if count is positive
  const existing = await prisma.courseEngagementMetrics.findUnique({
    where: {
      courseId_date: {
        courseId: room.course.id,
        date: today,
      },
    },
  });

  if (existing && existing.totalReactions > 0) {
    await prisma.courseEngagementMetrics.update({
      where: {
        courseId_date: {
          courseId: room.course.id,
          date: today,
        },
      },
      data: {
        totalReactions: { decrement: 1 },
      },
    });
  }
}

/**
 * Handle mention event - log for notification purposes
 */
async function handleMentionEvent(payload: Record<string, unknown>) {
  const { roomId } = payload;

  if (!roomId || typeof roomId !== 'string') {
    return;
  }

  const room = await prisma.chatRoom.findUnique({
    where: { roomId },
    include: { course: true },
  });

  if (!room?.course) {
    return;
  }

  // Mentions are already logged in the message metadata, nothing additional to do
}

/**
 * Handle presence change event - update last seen
 */
async function handlePresenceChange(payload: Record<string, unknown>) {
  const { userId, lastSeenAt } = payload;

  if (!userId || typeof userId !== 'string') {
    return;
  }

  if (lastSeenAt && typeof lastSeenAt === 'string') {
    // Update user's last_seen in database if needed
    // For now, this is just for tracking
  }
}

/**
 * Handle call started event - initialize call tracking
 */
async function handleCallStarted(payload: Record<string, unknown>) {
  // Call events are logged separately, this is for future enhancements
  // Could track call start times, participants, etc.
}

/**
 * Handle call ended event - update call metrics
 */
async function handleCallEnded(payload: Record<string, unknown>) {
  const { roomId, duration } = payload;

  if (!roomId || typeof roomId !== 'string' || !duration || typeof duration !== 'number') {
    return;
  }

  const room = await prisma.chatRoom.findUnique({
    where: { roomId },
    include: { course: true },
  });

  if (!room?.course) {
    return;
  }

  const callMinutes = Math.ceil(duration / 60);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.courseEngagementMetrics.upsert({
    where: {
      courseId_date: {
        courseId: room.course.id,
        date: today,
      },
    },
    update: {
      callMinutes: { increment: callMinutes },
    },
    create: {
      courseId: room.course.id,
      date: today,
      totalMessages: 0,
      totalReactions: 0,
      activeChatters: 0,
      callMinutes,
      flaggedMessages: 0,
      resolvedFlags: 0,
    },
  });
}

/**
 * Handle moderation flagged event - update flag count
 */
async function handleModerationFlagged(payload: Record<string, unknown>) {
  const { roomId } = payload;

  if (!roomId || typeof roomId !== 'string') {
    return;
  }

  const room = await prisma.chatRoom.findUnique({
    where: { roomId },
    include: { course: true },
  });

  if (!room?.course) {
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.courseEngagementMetrics.upsert({
    where: {
      courseId_date: {
        courseId: room.course.id,
        date: today,
      },
    },
    update: {
      flaggedMessages: { increment: 1 },
    },
    create: {
      courseId: room.course.id,
      date: today,
      totalMessages: 0,
      totalReactions: 0,
      activeChatters: 0,
      callMinutes: 0,
      flaggedMessages: 1,
      resolvedFlags: 0,
    },
  });
}
