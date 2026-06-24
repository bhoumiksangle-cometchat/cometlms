import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../server';
import { cometChatService, courseGroupGuid } from '../../services/cometchat.service';
import { logger } from '../../lib/logger';

export const enrollmentRoutes = Router();

const isDevMode = () => !process.env.DATABASE_URL;

// In-memory enrollments for dev mode
const devEnrollments = new Map<string, any>();

// Add an enrolled student to the course's CometChat group as a participant.
async function addStudentToCourseGroup(courseId: string, userId: string): Promise<void> {
  if (!cometChatService.isEnabled()) return;
  try {
    await cometChatService.addGroupMembers(courseGroupGuid(courseId), [
      { uid: userId, scope: 'participant' },
    ]);
  } catch (e) {
    logger.warn(`[Enrollments] addStudentToCourseGroup(${courseId}, ${userId}) failed (non-fatal):`, e);
  }
}

// Remove an unenrolled/refunded student from the course's CometChat group.
async function removeStudentFromCourseGroup(courseId: string, userId: string): Promise<void> {
  if (!cometChatService.isEnabled()) return;
  try {
    await cometChatService.removeGroupMember(courseGroupGuid(courseId), userId);
  } catch (e) {
    logger.warn(`[Enrollments] removeStudentFromCourseGroup(${courseId}, ${userId}) failed (non-fatal):`, e);
  }
}

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

    // Best-effort: add to the CometChat group (works if the group exists).
    await addStudentToCourseGroup(courseId, req.user!.id);

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

    const enrollment = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.user!.id, courseId } },
      update: {},
      create: { userId: req.user!.id, courseId },
    });

    // Add the student to the course's CometChat discussion group so it shows up
    // in their conversations list.
    await addStudentToCourseGroup(courseId, req.user!.id);

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

// Unenroll (or refund) — removes the enrollment and the student's CometChat
// group membership so they lose access to the course discussion.
enrollmentRoutes.delete('/:courseId', requireAuth, async (req, res, next) => {
  const { courseId } = req.params;

  if (isDevMode()) {
    devEnrollments.delete(`${req.user!.id}-${courseId}`);
    await removeStudentFromCourseGroup(courseId, req.user!.id);
    res.json({ success: true });
    return;
  }

  try {
    await prisma.enrollment.deleteMany({
      where: { userId: req.user!.id, courseId },
    });
    await removeStudentFromCourseGroup(courseId, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
