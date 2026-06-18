import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../server';

export const enrollmentRoutes = Router();

const isDevMode = () => !process.env.DATABASE_URL;

// In-memory enrollments for dev mode
const devEnrollments = new Map<string, any>();

enrollmentRoutes.post('/', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    // Dev mode: create mock enrollment
    const { courseId } = z.object({ courseId: z.string().min(1) }).parse(req.body);
    const enrollmentId = `enrollment-${Date.now()}`;
    const enrollment = {
      id: enrollmentId,
      userId: req.user!.id,
      courseId,
      enrolledAt: new Date().toISOString(),
      progress: 0,
    };
    
    const key = `${req.user!.id}-${courseId}`;
    devEnrollments.set(key, enrollment);
    
    console.log('[Dev Mode] Created enrollment:', enrollment);
    res.status(201).json({ success: true, data: enrollment });
    return;
  }
  
  try {
    const { courseId } = z.object({ courseId: z.string().uuid() }).parse(req.body);
    const course = await prisma.course.findUnique({ where: { id: courseId } });

    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const created = await tx.enrollment.upsert({
        where: { userId_courseId: { userId: req.user!.id, courseId } },
        update: {},
        create: { userId: req.user!.id, courseId },
      });

      if (course.chatRoomId) {
        // ChatRoomMember.roomId references ChatRoom.id (UUID), not ChatRoom.roomId (string)
        const chatRoom = await tx.chatRoom.findUnique({
          where: { roomId: course.chatRoomId },
          select: { id: true },
        });
        if (chatRoom) {
          await tx.chatRoomMember.upsert({
            where: { roomId_userId: { roomId: chatRoom.id, userId: req.user!.id } },
            update: { removedAt: null },
            create: { roomId: chatRoom.id, userId: req.user!.id, role: 'member' },
          });
        }
      }

      return created;
    });

    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    next(error);
  }
});

enrollmentRoutes.get('/me', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    // Dev mode: return all enrollments for this user
    const userEnrollments = Array.from(devEnrollments.values())
      .filter((e) => e.userId === req.user!.id);
    
    console.log('[Dev Mode] Fetching enrollments for user:', req.user!.id, 'Found:', userEnrollments.length);
    res.json({ success: true, data: userEnrollments });
    return;
  }
  
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.id },
      include: { course: true },
      orderBy: { enrolledAt: 'desc' },
    });
    res.json({ success: true, data: enrollments });
  } catch (error) {
    next(error);
  }
});
