import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../server';
export const enrollmentRoutes = Router();
enrollmentRoutes.post('/', requireAuth, async (req, res, next) => {
    try {
        const { courseId } = z.object({ courseId: z.string().uuid() }).parse(req.body);
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            res.status(404).json({ success: false, error: 'Course not found' });
            return;
        }
        const enrollment = await prisma.$transaction(async (tx) => {
            const created = await tx.enrollment.upsert({
                where: { userId_courseId: { userId: req.user.id, courseId } },
                update: {},
                create: { userId: req.user.id, courseId },
            });
            if (course.chatRoomId) {
                await tx.chatRoomMember.upsert({
                    where: { roomId_userId: { roomId: course.chatRoomId, userId: req.user.id } },
                    update: { removedAt: null },
                    create: { roomId: course.chatRoomId, userId: req.user.id, role: 'member' },
                });
            }
            return created;
        });
        res.status(201).json({ success: true, data: enrollment });
    }
    catch (error) {
        next(error);
    }
});
enrollmentRoutes.get('/me', requireAuth, async (req, res, next) => {
    try {
        const enrollments = await prisma.enrollment.findMany({
            where: { userId: req.user.id },
            include: { course: true },
            orderBy: { enrolledAt: 'desc' },
        });
        res.json({ success: true, data: enrollments });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=enrollment.routes.js.map