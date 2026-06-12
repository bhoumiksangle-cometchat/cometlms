import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';
export const courseRoutes = Router();
const courseSchema = z.object({
    title: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().min(1),
    categoryId: z.string().uuid(),
    price: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    language: z.string().optional(),
    thumbnailUrl: z.string().url().optional(),
});
courseRoutes.get('/', async (_req, res, next) => {
    try {
        const courses = await prisma.course.findMany({
            where: { status: 'PUBLISHED' },
            include: { instructor: { select: { id: true, name: true, avatarUrl: true } }, category: true },
            orderBy: { publishedAt: 'desc' },
        });
        res.json({ success: true, data: courses });
    }
    catch (error) {
        next(error);
    }
});
courseRoutes.get('/:id', async (req, res, next) => {
    try {
        const course = await prisma.course.findUnique({
            where: { id: req.params.id },
            include: { instructor: true, category: true, sections: { include: { lessons: true } }, aiAgentConfigs: true },
        });
        if (!course) {
            res.status(404).json({ success: false, error: 'Course not found' });
            return;
        }
        res.json({ success: true, data: course });
    }
    catch (error) {
        next(error);
    }
});
courseRoutes.post('/', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const input = courseSchema.parse(req.body);
        const course = await prisma.course.create({
            data: {
                ...input,
                instructorId: req.user.id,
            },
        });
        res.status(201).json({ success: true, data: course });
    }
    catch (error) {
        next(error);
    }
});
courseRoutes.patch('/:id', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const input = courseSchema.partial().parse(req.body);
        const course = await prisma.course.update({
            where: { id: req.params.id },
            data: input,
        });
        res.json({ success: true, data: course });
    }
    catch (error) {
        next(error);
    }
});
courseRoutes.post('/:id/publish', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        const course = await prisma.course.findUnique({ where: { id: req.params.id } });
        if (!course) {
            res.status(404).json({ success: false, error: 'Course not found' });
            return;
        }
        const roomKey = `course-${course.id}`;
        const published = await prisma.$transaction(async (tx) => {
            const room = await tx.chatRoom.upsert({
                where: { roomId: roomKey },
                update: { name: course.title, isActive: true },
                create: {
                    roomId: roomKey,
                    name: course.title,
                    type: 'GROUP',
                    ownerId: course.instructorId,
                    members: {
                        create: { userId: course.instructorId, role: 'owner' },
                    },
                },
            });
            return tx.course.update({
                where: { id: course.id },
                data: {
                    status: 'PUBLISHED',
                    publishedAt: new Date(),
                    chatRoomId: room.roomId,
                },
                include: { chatRoom: true },
            });
        });
        res.json({ success: true, data: published });
    }
    catch (error) {
        next(error);
    }
});
courseRoutes.delete('/:id', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
    try {
        await prisma.course.delete({ where: { id: req.params.id } });
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=course.routes.js.map