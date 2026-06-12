import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';
export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));
adminRoutes.get('/stats', async (_req, res, next) => {
    try {
        const [users, courses, enrollments, pendingFlags] = await Promise.all([
            prisma.user.count(),
            prisma.course.count(),
            prisma.enrollment.count(),
            prisma.chatModerationLog.count({ where: { status: 'PENDING' } }),
        ]);
        res.json({ success: true, data: { users, courses, enrollments, pendingFlags } });
    }
    catch (error) {
        next(error);
    }
});
adminRoutes.get('/moderation', async (_req, res, next) => {
    try {
        const flags = await prisma.chatModerationLog.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
        res.json({ success: true, data: flags });
    }
    catch (error) {
        next(error);
    }
});
adminRoutes.post('/moderation/:id/dismiss', async (req, res, next) => {
    try {
        const flag = await prisma.chatModerationLog.update({
            where: { id: req.params.id },
            data: { status: 'DISMISSED', actionedBy: req.user.id, actionedAt: new Date() },
        });
        res.json({ success: true, data: flag });
    }
    catch (error) {
        next(error);
    }
});
adminRoutes.post('/moderation/:id/ban', async (req, res, next) => {
    try {
        const flag = await prisma.chatModerationLog.findUnique({ where: { id: req.params.id } });
        if (!flag) {
            res.status(404).json({ success: false, error: 'Moderation flag not found' });
            return;
        }
        const result = await prisma.$transaction([
            prisma.user.update({ where: { id: flag.senderId }, data: { isActive: false } }),
            prisma.chatModerationLog.update({
                where: { id: flag.id },
                data: { status: 'ESCALATED', actionedBy: req.user.id, actionedAt: new Date() },
            }),
        ]);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
adminRoutes.get('/events/log', async (_req, res, next) => {
    try {
        const events = await prisma.activityEventLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
        res.json({ success: true, data: events });
    }
    catch (error) {
        next(error);
    }
});
adminRoutes.get('/agents', async (_req, res, next) => {
    try {
        const agents = await prisma.aiAgentConfig.findMany({ include: { course: true, botUser: true } });
        res.json({ success: true, data: agents });
    }
    catch (error) {
        next(error);
    }
});
adminRoutes.patch('/agents/:id', async (req, res, next) => {
    try {
        const input = z.object({
            systemPrompt: z.string().optional(),
            modelName: z.string().optional(),
            isEnabled: z.boolean().optional(),
            provider: z.enum(['OPENAI', 'LANGCHAIN']).optional(),
        }).parse(req.body);
        const agent = await prisma.aiAgentConfig.update({ where: { id: req.params.id }, data: input });
        res.json({ success: true, data: agent });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=admin.routes.js.map