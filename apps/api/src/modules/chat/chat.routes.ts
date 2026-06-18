import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../server';
import { requireAuth, requireRole } from '../../middleware/auth';
import { addRoomMember, createChatRoom, removeRoomMember } from './groups';
import { generateAgentReply } from './agents';
import { listRoomMessages, sendChatMessage } from './messages';
import { addNotificationJob } from '../../lib/queue';

export const chatRoutes = Router();

const isDevMode = () => !process.env.DATABASE_URL;

chatRoutes.get('/rooms/:roomId/messages', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    // Dev mode is handled in listRoomMessages function
    console.log(`[Dev Mode] Fetching messages for room ${req.params.roomId}`);
  }
  try {
    const messages = await listRoomMessages(req.params.roomId, Number(req.query.limit ?? 50));
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// Get thread replies for a specific message
chatRoutes.get('/messages/:messageId/replies', requireAuth, async (req, res, next) => {
  try {
    const replies = await prisma.chatMessage.findMany({
      where: { parentMessageId: req.params.messageId, isDeleted: false },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } }, replies: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: replies });
  } catch (error) {
    next(error);
  }
});

chatRoutes.post('/rooms/:roomId/messages', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ content: z.string().min(1), parentMessageId: z.string().uuid().optional() }).parse(req.body);
    const result = await sendChatMessage({ roomId: req.params.roomId, senderId: req.user!.id, ...input });
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

chatRoutes.get('/conversations', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    // Return empty array in dev mode - DMs work via socket events
    res.json({ success: true, data: [] });
    return;
  }
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        type: 'DM',
        members: {
          some: {
            userId: req.user!.id,
            removedAt: null,
          },
        },
      },
      include: {
        members: {
          where: {
            removedAt: null,
          },
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    const conversations = rooms.map((room) => {
      const otherMember = room.members.find((m) => m.userId !== req.user!.id);
      return {
        ...room,
        name: otherMember?.user?.name || room.name || 'Direct Message',
        avatarUrl: otherMember?.user?.avatarUrl || null,
      };
    });

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

chatRoutes.post('/dm/:userId', requireAuth, async (req, res, next) => {
  try {
    const otherUserId = req.params.userId;
    const currentUserId = req.user!.id;

    const roomKey = [currentUserId, otherUserId].sort().join('-');

    let room = await prisma.chatRoom.findFirst({
      where: { roomId: `dm-${roomKey}`, type: 'DM' },
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          roomId: `dm-${roomKey}`,
          name: 'Direct Message',
          type: 'DM',
          ownerId: currentUserId,
          members: {
            create: [
              { userId: currentUserId },
              { userId: otherUserId },
            ],
          },
        },
      });
    }

    res.json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
});

chatRoutes.post('/rooms', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = z.object({ roomId: z.string().min(1), name: z.string().min(1), type: z.enum(['GROUP', 'DM']).optional() }).parse(req.body);
    const room = await createChatRoom({ ...input, ownerId: req.user!.id });
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    next(error);
  }
});

chatRoutes.post('/rooms/:roomId/members', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = z.object({ userId: z.string().uuid(), role: z.string().optional() }).parse(req.body);
    const member = await addRoomMember({ roomId: req.params.roomId, ...input });
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

chatRoutes.delete('/rooms/:roomId/members/:uid', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const member = await removeRoomMember({ roomId: req.params.roomId, userId: req.params.uid });
    res.json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

chatRoutes.post('/agents/summarize', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({
      roomId: z.string().min(1),
      messageIds: z.array(z.string().uuid()).optional(),
    }).parse(req.body);

    const room = await prisma.chatRoom.findUnique({
      where: { roomId: input.roomId },
      include: { course: true },
    });

    let messagesToSummarize;
    if (input.messageIds && input.messageIds.length > 0) {
      messagesToSummarize = await prisma.chatMessage.findMany({
        where: {
          id: { in: input.messageIds },
          roomId: input.roomId,
        },
        include: { sender: true },
        orderBy: { createdAt: 'asc' },
      });
    } else {
      messagesToSummarize = await prisma.chatMessage.findMany({
        where: { roomId: input.roomId },
        include: { sender: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      messagesToSummarize.reverse();
    }

    if (messagesToSummarize.length === 0) {
      res.json({ success: true, data: { summary: 'No messages to summarize.' } });
      return;
    }

    const conversationContext = messagesToSummarize
      .map((m) => `${m.sender.name} (${m.sender.role}): ${m.content}`)
      .join('\n');

    const prompt = `Summarize the following chat conversation from the course discussion group "${room?.course?.title || room?.name || 'Classroom'}":\n\n${conversationContext}\n\nProvide a high-level summary of the questions asked, issues resolved, or outstanding questions. Keep it professional, concise, and structured under 800 characters.`;

    const copilotConfig = await prisma.aiAgentConfig.findFirst({
      where: {
        courseId: room?.course?.id,
        agentType: 'INSTRUCTOR_COPILOT',
        isEnabled: true,
      },
    });

    const reply = await generateAgentReply({
      prompt,
      courseId: room?.course?.id || undefined,
      courseName: room?.course?.title || undefined,
      userId: copilotConfig?.botUserId || '',
    });

    res.json({ success: true, data: { summary: reply.content } });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Q&A Endpoints
// ============================================

// List all questions for a room (top-level messages tagged isQuestion)
chatRoutes.get('/rooms/:roomId/questions', requireAuth, async (req, res, next) => {
  try {
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { roomId: req.params.roomId },
      select: { id: true },
    });

    if (!chatRoom) {
      res.json({ success: true, data: [] });
      return;
    }

    const questions = await prisma.chatMessage.findMany({
      where: {
        roomId: chatRoom.id,
        parentMessageId: null,
        isDeleted: false,
        metadata: { path: ['isQuestion'], equals: true },
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
        replies: {
          where: { isDeleted: false },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Replace internal UUID roomId with the string roomId for frontend
    const result = questions.map((q) => ({
      ...q,
      roomId: req.params.roomId,
      replies: q.replies.map((r) => ({ ...r, roomId: req.params.roomId })),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Post a new question
chatRoutes.post('/rooms/:roomId/questions', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ content: z.string().min(1) }).parse(req.body);

    const chatRoom = await prisma.chatRoom.findUnique({
      where: { roomId: req.params.roomId },
      select: { id: true, roomId: true, name: true, ownerId: true },
    });

    if (!chatRoom) {
      res.status(404).json({ success: false, error: 'Chat room not found' });
      return;
    }

    const question = await prisma.chatMessage.create({
      data: {
        roomId: chatRoom.id,
        senderId: req.user!.id,
        content: input.content,
        contentType: 'TEXT',
        metadata: {
          isQuestion: true,
          reactions: {},
          readBy: [req.user!.id],
          mentions: [],
        },
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
        replies: true,
      },
    });

    res.status(201).json({
      success: true,
      data: { ...question, roomId: req.params.roomId },
    });

    // Push to the room owner (instructor) so they're alerted to the new question.
    // Skip if the room owner is the one asking (self-post to own room).
    if (chatRoom.ownerId && chatRoom.ownerId !== req.user!.id) {
      addNotificationJob({
        userId: chatRoom.ownerId,
        type: 'push',
        title: `New question in ${chatRoom.name || 'your course'}`,
        message: `${question.sender.name}: "${input.content.slice(0, 120)}"`,
        data: {
          type: 'new_question',
          questionId: question.id,
          roomId: req.params.roomId,
          askerId: req.user!.id,
          askerName: question.sender.name,
        },
      }, { priority: 3 }).catch((err) =>
        console.error('[Push] Failed to queue new-question push:', err)
      );
    }
  } catch (error) {
    next(error);
  }
});

// Post an answer to a question
chatRoutes.post('/rooms/:roomId/questions/:questionId/answers', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ content: z.string().min(1) }).parse(req.body);

    const chatRoom = await prisma.chatRoom.findUnique({
      where: { roomId: req.params.roomId },
      select: { id: true, roomId: true },
    });

    if (!chatRoom) {
      res.status(404).json({ success: false, error: 'Chat room not found' });
      return;
    }

    // Verify the parent question exists
    const parentQuestion = await prisma.chatMessage.findUnique({
      where: { id: req.params.questionId },
    });

    if (!parentQuestion) {
      res.status(404).json({ success: false, error: 'Question not found' });
      return;
    }

    const answer = await prisma.chatMessage.create({
      data: {
        roomId: chatRoom.id,
        senderId: req.user!.id,
        parentMessageId: req.params.questionId,
        content: input.content,
        contentType: 'TEXT',
        metadata: {
          isAnswer: true,
          reactions: {},
          readBy: [req.user!.id],
          mentions: [],
        },
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: { ...answer, roomId: req.params.roomId },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Announcement Endpoint
// ============================================

// POST an announcement to a course room (instructor/admin only).
// Stores the message with isAnnouncement metadata; mentionAll prepends "@all ".
chatRoutes.post('/rooms/:roomId/announce', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  if (isDevMode()) {
    const { content = '', mentionAll = false } = req.body ?? {};
    res.status(201).json({
      success: true,
      data: {
        id: `announce-${Date.now()}`,
        content: mentionAll ? `@all ${content}` : content,
        roomId: req.params.roomId,
        createdAt: new Date().toISOString(),
        sender: { id: 'dev-instructor', name: 'Instructor', role: 'INSTRUCTOR' },
      },
    });
    return;
  }
  try {
    const input = z.object({
      content:    z.string().min(1, 'Announcement cannot be empty'),
      mentionAll: z.boolean().default(false),
    }).parse(req.body);

    const chatRoom = await prisma.chatRoom.findUnique({
      where: { roomId: req.params.roomId },
      select: { id: true },
    });

    if (!chatRoom) {
      res.status(404).json({ success: false, error: 'Chat room not found' });
      return;
    }

    const finalContent = input.mentionAll ? `@all ${input.content}` : input.content;

    const message = await prisma.chatMessage.create({
      data: {
        roomId:      chatRoom.id,
        senderId:    req.user!.id,
        content:     finalContent,
        contentType: 'TEXT',
        metadata: {
          isAnnouncement: true,
          mentionAll:     input.mentionAll,
          reactions:      {},
          readBy:         [req.user!.id],
          mentions:       input.mentionAll ? ['all'] : [],
        },
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    res.status(201).json({ success: true, data: { ...message, roomId: req.params.roomId } });

    // Fire-and-forget: push to every room member so they see the announcement
    // even when the tab/app is backgrounded. Sender is excluded.
    prisma.chatRoomMember.findMany({
      where: { roomId: chatRoom.id, removedAt: null },
      select: { userId: true },
    }).then((members) => {
      for (const { userId } of members) {
        if (userId === req.user!.id) continue; // don't notify the sender
        addNotificationJob({
          userId,
          type: 'push',
          title: `📢 Announcement from ${message.sender.name}`,
          message: input.content.slice(0, 150),
          data: {
            type: 'announcement',
            messageId: message.id,
            roomId: req.params.roomId,
            senderName: message.sender.name,
          },
        }, { priority: 2 }).catch((err) =>
          console.error('[Push] Failed to queue announcement push:', err)
        );
      }
    }).catch((err) =>
      console.error('[Push] Failed to fetch members for announcement push:', err)
    );
  } catch (error) {
    next(error);
  }
});

chatRoutes.post('/agents/message', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ prompt: z.string().min(1), courseName: z.string().optional() }).parse(req.body);
    const reply = await generateAgentReply({
      ...input,
      userId: req.user!.id,
    });
    res.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});
