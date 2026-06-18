import { prisma } from '../../server';
import { moderateMessage } from './moderation';
import { addNotificationJob } from '../../lib/queue';

type SendMessageInput = {
  roomId: string;
  senderId: string;
  content: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
};

// Convert "FAQ Bot" → "faqbot", "Study-Assistant" → "studyassistant", etc.
// Used to match @mentions like @FAQBot, @faq-bot, @FAQ_BOT against User.name.
function slugifyHandle(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Parse @mentions from message content and resolve to user IDs.
// Accepts mention handles consisting of letters, digits, hyphens or underscores
// (e.g. @faq-bot, @FAQBot, @study_assistant). The resolution is slug-based, so
// `@FAQBot` and `@faq-bot` both match a user whose display name is "FAQ Bot".
export async function extractMentions(content: string): Promise<{ id: string; name: string }[]> {
  const mentionRegex = /@([\w-]+)/g;
  const matches = [...content.matchAll(mentionRegex)];
  const handles = Array.from(new Set(matches.map((m) => slugifyHandle(m[1])).filter(Boolean)));

  if (handles.length === 0) {
    return [];
  }

  // Pull a candidate set keyed on the first letter so the slug match isn't a
  // table scan. AI agent + most user names start with a letter, so this is a
  // pragmatic prefix narrowing without adding a dedicated handle column.
  const initialChars = Array.from(new Set(handles.map((h) => h[0])));
  const candidates = await prisma.user
    .findMany({
      where: {
        OR: initialChars.map((c) => ({ name: { startsWith: c, mode: 'insensitive' as const } })),
      },
      select: { id: true, name: true },
    })
    .catch(() => [] as { id: string; name: string }[]);

  // Match by slugified name. Multiple users may share a slug — pick the first
  // (current behavior); a real fix would add a unique handle column.
  const seen = new Set<string>();
  const resolved: { id: string; name: string }[] = [];
  for (const handle of handles) {
    const hit = candidates.find((u) => slugifyHandle(u.name) === handle);
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      resolved.push(hit);
    }
  }
  return resolved;
}

export async function sendChatMessage(input: SendMessageInput) {
  const moderation = moderateMessage(input.content);
  const mentionedUsers = await extractMentions(input.content);

  // First, find the chat room by its roomId string to get the UUID
  const chatRoom = await prisma.chatRoom.findUnique({ 
    where: { roomId: input.roomId },
    select: { id: true, name: true, roomId: true }
  });
  
  if (!chatRoom) {
    throw new Error(`Chat room not found: ${input.roomId}`);
  }

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: {
        roomId: chatRoom.id, // Use the UUID id, not the string roomId
        senderId: input.senderId,
        content: input.content,
        parentMessageId: input.parentMessageId,
        metadata: {
          ...input.metadata,
          mentions: mentionedUsers.map((u) => ({ id: u.id, name: u.name })),
          reactions: {},
          readBy: [input.senderId],
        },
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    });

    // Create event log for message
    await tx.activityEventLog.create({
      data: {
        eventType: 'message:sent',
        payload: { roomId: input.roomId, senderId: input.senderId, messageId: created.id },
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    // Create mention notifications for mentioned users
    if (mentionedUsers.length > 0) {
      // Create in-app notifications in database
      await Promise.all(
        mentionedUsers.map((user) =>
          tx.notification.create({
            data: {
              userId: user.id,
              type: 'IN_APP',
              title: `@${created.sender.name} mentioned you`,
              message: created.content.slice(0, 100),
              data: {
                messageId: created.id,
                roomId: input.roomId,
                roomName: chatRoom.name,
                senderId: input.senderId,
              },
            },
          }),
        ),
      );

      // Queue email + push notifications for mentions (async, won't block response)
      for (const user of mentionedUsers) {
        const title = `${created.sender.name} mentioned you in ${chatRoom.name || 'a discussion'}`;
        const preview = `${created.sender.name} mentioned you: "${created.content.slice(0, 150)}"`;
        const notifData = {
          type: 'mention',
          messageId: created.id,
          roomId: input.roomId,
          roomName: chatRoom.name,
          senderId: input.senderId,
        };

        await addNotificationJob({
          userId: user.id,
          type: 'email',
          title,
          message: preview,
          data: notifData,
        }).catch((err) => console.error('Failed to queue mention email:', err));

        await addNotificationJob({
          userId: user.id,
          type: 'push',
          title: `${created.sender.name} mentioned you`,
          message: created.content.slice(0, 150),
          data: notifData,
        }).catch((err) => console.error('Failed to queue mention push:', err));
      }

      // Log mention events
      await tx.activityEventLog.create({
        data: {
          eventType: 'user:mentioned',
          payload: {
            messageId: created.id,
            mentionedUsers: mentionedUsers.map((u) => u.id),
            senderId: input.senderId,
            roomId: input.roomId,
          },
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    }

    if (moderation.flagged) {
      await tx.chatModerationLog.create({
        data: {
          messageId: created.id,
          senderId: input.senderId,
          roomId: chatRoom.id, // Use UUID here too
          messagePreview: input.content.slice(0, 180),
          flagReason: moderation.reason,
        },
      });

      await tx.activityEventLog.create({
        data: {
          eventType: 'moderation:flagged',
          payload: { roomId: input.roomId, senderId: input.senderId, messageId: created.id, reason: moderation.reason },
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });
    }

    // Return the message with string roomId for frontend compatibility
    return {
      ...created,
      roomId: chatRoom.roomId // Replace UUID with string roomId
    };
  });

  return { message, moderation, mentionedUsers };
}

export async function listRoomMessages(roomId: string, take = 50) {
  try {
    // First find the chat room by its roomId string to get the UUID
    const chatRoom = await prisma.chatRoom.findUnique({ 
      where: { roomId },
      select: { id: true, roomId: true }
    });
    
    if (!chatRoom) {
      console.error('[Messages] Chat room not found:', roomId);
      return [];
    }
    
    const messages = await prisma.chatMessage.findMany({
      where: { roomId: chatRoom.id, isDeleted: false }, // Use UUID id
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } }, replies: true },
      orderBy: { createdAt: 'asc' },
      take,
    });
    
    // Transform messages to use the string roomId instead of UUID for frontend compatibility
    return messages.map(msg => ({
      ...msg,
      roomId: chatRoom.roomId // Replace UUID with string roomId
    }));
  } catch (err) {
    console.error('[Messages] Error fetching messages:', err);
    return [];
  }
}
