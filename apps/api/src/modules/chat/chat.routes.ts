import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../server';
import { requireAuth, requireRole } from '../../middleware/auth';
import { addRoomMember, createChatRoom, removeRoomMember } from './groups';
import { generateAgentReply } from './agents';
import { listRoomMessages, sendChatMessage } from './messages';

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
