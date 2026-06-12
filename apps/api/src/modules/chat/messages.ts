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

// Parse @mentions from message content and resolve to user IDs
export async function extractMentions(content: string): Promise<{ id: string; name: string }[]> {
  const mentionRegex = /@(\w+)/g;
  const matches = [...content.matchAll(mentionRegex)];
  const names = matches.map((m) => m[1]);
  
  if (names.length === 0) {
    return [];
  }
  
  // Resolve usernames to actual user IDs
  const users = await prisma.user.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true }
  }).catch(() => []);
  
  return users;
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
              type: 'in_app',
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

      // Queue email notifications for mentions (async, won't block response)
      for (const user of mentionedUsers) {
        await addNotificationJob({
          userId: user.id,
          type: 'email',
          title: `${created.sender.name} mentioned you in ${chatRoom.name || 'a discussion'}`,
          message: `${created.sender.name} mentioned you: "${created.content.slice(0, 150)}"`,
          data: {
            type: 'mention',
            messageId: created.id,
            roomId: input.roomId,
            roomName: chatRoom.name,
            senderId: input.senderId,
          },
        }).catch(err => console.error('Failed to queue mention email:', err));
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
