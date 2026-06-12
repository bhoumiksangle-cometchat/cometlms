import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { addRoomMember, createChatRoom, removeRoomMember } from './groups';
import { generateAgentReply } from './agents';
import { listRoomMessages, sendChatMessage } from './messages';
export const chatRoutes = Router();
chatRoutes.get('/rooms/:roomId/messages', requireAuth, async (req, res, next) => {
    try {
        const messages = await listRoomMessages(req.params.roomId, Number(req.query.limit ?? 50));
        res.json({ success: true, data: messages });
    }
    catch (error) {
        next(error);
    }
});
chatRoutes.post('/rooms/:roomId/messages', requireAuth, async (req, res, next) => {
    try {
        const input = z.object({ content: z.string().min(1), parentMessageId: z.string().uuid().optional() }).parse(req.body);
        const result = await sendChatMessage({ roomId: req.params.roomId, senderId: req.user.id, ...input });
        res.status(201).json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
chatRoutes.get('/conversations', requireAuth, async (_req, res) => {
    res.json({ success: true, data: [] });
});
chatRoutes.post('/rooms', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const input = z.object({ roomId: z.string().min(1), name: z.string().min(1), type: z.enum(['GROUP', 'DM']).optional() }).parse(req.body);
        const room = await createChatRoom({ ...input, ownerId: req.user.id });
        res.status(201).json({ success: true, data: room });
    }
    catch (error) {
        next(error);
    }
});
chatRoutes.post('/rooms/:roomId/members', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const input = z.object({ userId: z.string().uuid(), role: z.string().optional() }).parse(req.body);
        const member = await addRoomMember({ roomId: req.params.roomId, ...input });
        res.status(201).json({ success: true, data: member });
    }
    catch (error) {
        next(error);
    }
});
chatRoutes.delete('/rooms/:roomId/members/:uid', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const member = await removeRoomMember({ roomId: req.params.roomId, userId: req.params.uid });
        res.json({ success: true, data: member });
    }
    catch (error) {
        next(error);
    }
});
chatRoutes.post('/agents/message', requireAuth, async (req, res, next) => {
    try {
        const input = z.object({ prompt: z.string().min(1), courseName: z.string().optional() }).parse(req.body);
        const reply = await generateAgentReply(input);
        res.json({ success: true, data: reply });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=chat.routes.js.map