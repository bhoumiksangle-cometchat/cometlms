import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';
import { addNotificationJob } from '../../lib/queue';
import { cometChatService, courseGroupGuid } from '../../services/cometchat.service';
import { logger } from '../../lib/logger';

export const courseRoutes = Router();

const isDevMode = () => !process.env.DATABASE_URL;

// Stable CometChat group id for a course.
export { courseGroupGuid };

/**
 * Create (or sync) the CometChat group that backs a course discussion, with the
 * instructor as owner/admin. Ensures the instructor exists as a CometChat user
 * first (createGroup with `owner` requires it). Best-effort — never throws.
 * Returns the group guid or null.
 */
async function provisionCourseGroup(course: {
  id: string;
  title: string;
  instructorId: string;
}): Promise<string | null> {
  if (!cometChatService.isEnabled()) return null;
  const guid = courseGroupGuid(course.id);
  try {
    const instructor = await prisma.user.findUnique({
      where: { id: course.instructorId },
      select: { id: true, name: true, avatarUrl: true, role: true },
    });
    if (instructor) {
      await cometChatService.createUser({
        uid: instructor.id,
        name: instructor.name,
        avatar: instructor.avatarUrl,
        role: instructor.role,
      });
    }
    await cometChatService.createGroup({
      guid,
      name: course.title,
      type: 'public',
      owner: course.instructorId,
      metadata: { lmsCourseId: course.id, lmsStatus: 'active' },
    });
    // Belt-and-suspenders: ensure the instructor is an admin member.
    await cometChatService.addGroupMembers(guid, [{ uid: course.instructorId, scope: 'admin' }]);
    return guid;
  } catch (e) {
    logger.warn(`[Courses] provisionCourseGroup(${guid}) failed (non-fatal):`, e);
    return null;
  }
}

/** Soft-deactivate the CometChat group when a course is unpublished/archived. */
async function deactivateCourseGroup(courseId: string): Promise<void> {
  if (!cometChatService.isEnabled()) return;
  try {
    await cometChatService.updateGroup(courseGroupGuid(courseId), {
      metadata: { lmsCourseId: courseId, lmsStatus: 'archived' },
    });
  } catch (e) {
    logger.warn(`[Courses] deactivateCourseGroup(${courseId}) failed (non-fatal):`, e);
  }
}

// ---------------------------------------------------------------------------
// Dev-mode mock data
// ---------------------------------------------------------------------------
const MOCK_COURSES = [
  {
    id: 'course-react-foundations',
    title: 'React Foundations for Product Teams',
    slug: 'react-foundations',
    description: 'Build modern UIs with React 18, hooks, context, and form libraries. Includes real-world projects.',
    thumbnailUrl: null,
    level: 'BEGINNER',
    language: 'English',
    price: 0,
    currency: 'USD',
    status: 'PUBLISHED',
    publishedAt: new Date('2024-01-15').toISOString(),
    cometchatGroupId: 'course-react-foundations',
    instructorId: 'instructor-1',
    categoryId: 'cat-1',
    instructor: { id: 'instructor-1', name: 'Maya Chen', avatarUrl: null, bio: 'Senior Frontend Engineer at TechCorp' },
    category: { id: 'cat-1', name: 'Web Development' },
    sections: [
      {
        id: 'section-1',
        title: 'Getting Started with React',
        description: 'Install React, understand JSX, and build your first component',
        order: 0,
        courseId: 'course-react-foundations',
        lessons: [
          { id: 'lesson-1', title: 'Introduction to React', duration: 900, isFree: true, order: 0, sectionId: 'section-1', videoUrl: null, description: 'Overview of React and its ecosystem.' },
          { id: 'lesson-2', title: 'JSX and Component Basics', duration: 1200, isFree: true, order: 1, sectionId: 'section-1', videoUrl: null, description: 'Learn JSX syntax and write your first React component.' },
          { id: 'lesson-3', title: 'Props and State', duration: 1500, isFree: false, order: 2, sectionId: 'section-1', videoUrl: null, description: 'Understanding data flow in React.' },
        ],
      },
      {
        id: 'section-2',
        title: 'Hooks Deep Dive',
        description: 'useState, useEffect, useContext, custom hooks',
        order: 1,
        courseId: 'course-react-foundations',
        lessons: [
          { id: 'lesson-4', title: 'useState and useEffect', duration: 1800, isFree: false, order: 0, sectionId: 'section-2', videoUrl: null, description: 'State and side-effects in React.' },
          { id: 'lesson-5', title: 'Custom Hooks', duration: 1200, isFree: false, order: 1, sectionId: 'section-2', videoUrl: null, description: 'Build reusable logic with custom hooks.' },
        ],
      },
    ],
    aiAgentConfigs: [],
  },
  {
    id: 'course-node-api',
    title: 'Production Node.js APIs',
    slug: 'production-node-apis',
    description: 'Build scalable REST and WebSocket APIs with Express, Prisma, authentication, and deployment.',
    thumbnailUrl: null,
    level: 'INTERMEDIATE',
    language: 'English',
    price: 4999,
    currency: 'USD',
    status: 'PUBLISHED',
    publishedAt: new Date('2024-02-01').toISOString(),
    cometchatGroupId: 'course-node-api',
    instructorId: 'instructor-2',
    categoryId: 'cat-2',
    instructor: { id: 'instructor-2', name: 'Arjun Mehta', avatarUrl: null, bio: 'Staff Backend Engineer' },
    category: { id: 'cat-2', name: 'Backend Development' },
    sections: [
      {
        id: 'section-3',
        title: 'API Design Principles',
        description: 'REST best practices, versioning, and error handling',
        order: 0,
        courseId: 'course-node-api',
        lessons: [
          { id: 'lesson-6', title: 'REST API Design', duration: 1800, isFree: true, order: 0, sectionId: 'section-3', videoUrl: null, description: 'Learn REST conventions and best practices.' },
          { id: 'lesson-7', title: 'Authentication with JWT', duration: 2100, isFree: false, order: 1, sectionId: 'section-3', videoUrl: null, description: 'Implement JWT-based auth from scratch.' },
        ],
      },
    ],
    aiAgentConfigs: [],
  },
  {
    id: 'course-design-systems',
    title: 'Design Systems with Figma & CSS',
    slug: 'design-systems',
    description: 'Create a production-ready design system: tokens, component library, documentation.',
    thumbnailUrl: null,
    level: 'ADVANCED',
    language: 'English',
    price: 2999,
    currency: 'USD',
    status: 'PUBLISHED',
    publishedAt: new Date('2024-03-10').toISOString(),
    cometchatGroupId: 'course-design-systems',
    instructorId: 'instructor-1',
    categoryId: 'cat-3',
    instructor: { id: 'instructor-1', name: 'Maya Chen', avatarUrl: null, bio: 'Senior Frontend Engineer at TechCorp' },
    category: { id: 'cat-3', name: 'Design' },
    sections: [
      {
        id: 'section-4',
        title: 'Design Tokens',
        description: 'Colors, spacing, typography tokens',
        order: 0,
        courseId: 'course-design-systems',
        lessons: [
          { id: 'lesson-8', title: 'What Are Design Tokens?', duration: 720, isFree: true, order: 0, sectionId: 'section-4', videoUrl: null, description: 'Introduction to design tokens and their purpose.' },
        ],
      },
    ],
    aiAgentConfigs: [],
  },
];

const courseSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  categoryId: z.string().min(1), // Accept any string in dev mode, UUID in production
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  language: z.string().optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal('')),
});

courseRoutes.get('/', async (req, res, next) => {
  if (isDevMode()) {
    res.json({ success: true, data: MOCK_COURSES });
    return;
  }
  try {
    // Always show PUBLISHED courses; also include the requester's own DRAFT courses
    const userId = (req as any).user?.id as string | undefined;
    const where: any = userId
      ? { OR: [{ status: 'PUBLISHED' }, { instructorId: userId }] }
      : { status: 'PUBLISHED' };

    const courses = await prisma.course.findMany({
      where,
      include: { instructor: { select: { id: true, name: true, avatarUrl: true } }, category: true },
      orderBy: { publishedAt: 'desc' },
    });
    res.json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
});

courseRoutes.get('/:id', async (req, res, next) => {
  if (isDevMode()) {
    const course = MOCK_COURSES.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }
    res.json({ success: true, data: course });
    return;
  }
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: { instructor: true, category: true, sections: { include: { lessons: true } } },
    });

    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    res.json({ success: true, data: course });
  } catch (error) {
    next(error);
  }
});

courseRoutes.post('/', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  if (isDevMode()) {
    // In dev mode, generate a mock course and add it to the mock list
    const input = courseSchema.partial().parse(req.body);
    const mockCourse = {
      id: `course-${Date.now()}`,
      title: input.title || 'Untitled Course',
      slug: input.slug || `untitled-${Date.now()}`,
      description: input.description || '',
      thumbnailUrl: input.thumbnailUrl || null,
      level: input.level || 'BEGINNER',
      language: input.language || 'English',
      price: input.price || 0,
      currency: input.currency || 'USD',
      status: 'PUBLISHED', // Make it published so it shows up
      publishedAt: new Date().toISOString(),
      cometchatGroupId: null,
      instructorId: req.user!.id,
      categoryId: input.categoryId || 'cat-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // Add instructor and category info
      instructor: { id: req.user!.id, name: 'Mock Instructor', avatarUrl: null },
      category: { id: input.categoryId || 'cat-1', name: 'General' },
      sections: [],
      aiAgentConfigs: [],
    };
    
    // Add to mock courses list so it appears in GET /api/courses
    MOCK_COURSES.push(mockCourse as any);
    
    console.log('[Dev Mode] Created mock course:', mockCourse.title);
    res.status(201).json({ success: true, data: mockCourse });
    return;
  }
  try {
    const input = courseSchema.parse(req.body);

    // Create the course as PUBLISHED immediately, then provision its CometChat
    // discussion group (with the instructor as owner/admin).
    const course = await prisma.$transaction(async (tx) => {
      const newCourse = await tx.course.create({
        data: {
          ...input,
          instructorId: req.user!.id,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      return tx.course.update({
        where: { id: newCourse.id },
        data: { cometchatGroupId: courseGroupGuid(newCourse.id) },
        include: {
          instructor: { select: { id: true, name: true, avatarUrl: true } },
          category: true,
          sections: { include: { lessons: true } },
        },
      });
    });

    await provisionCourseGroup({
      id: course.id,
      title: course.title,
      instructorId: course.instructorId,
    });

    res.status(201).json({ success: true, data: course });
  } catch (error) {
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
  } catch (error) {
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

    const guid = courseGroupGuid(course.id);
    const published = await prisma.course.update({
      where: { id: course.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        cometchatGroupId: guid,
      },
    });

    // Create / reactivate the CometChat discussion group for this course.
    await provisionCourseGroup({
      id: course.id,
      title: course.title,
      instructorId: course.instructorId,
    });

    res.json({ success: true, data: published });

    // Fire-and-forget: push to all enrolled students so they know the course is live.
    // The worker gates on each user's pushNotificationsEnabled flag + device token,
    // so it's safe to enqueue for every enrolled user without extra checks here.
    prisma.enrollment.findMany({
      where: { courseId: published.id },
      select: { userId: true },
    }).then((enrollments) => {
      for (const { userId } of enrollments) {
        addNotificationJob({
          userId,
          type: 'push',
          title: 'New course published!',
          message: `"${published.title}" is now live and ready to explore.`,
          data: {
            type: 'course_published',
            courseId: published.id,
            courseTitle: published.title,
          },
        }, { priority: 3 }).catch((err) =>
          console.error('[Push] Failed to queue course-published push:', err)
        );
      }
    }).catch((err) =>
      console.error('[Push] Failed to fetch enrollments for course-published push:', err)
    );
  } catch (error) {
    next(error);
  }
});

courseRoutes.post('/:id/unpublish', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { status: 'ARCHIVED' },
    });

    // Deactivate the CometChat group (non-destructive — preserves history).
    await deactivateCourseGroup(course.id);

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

courseRoutes.delete('/:id', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    // Remove the CometChat discussion group for the deleted course.
    if (cometChatService.isEnabled()) {
      await cometChatService.deleteGroup(courseGroupGuid(req.params.id));
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================
// Section Routes
// ============================================

const sectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  order: z.number().nonnegative(),
});

courseRoutes.get('/:courseId/sections', async (req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      where: { courseId: req.params.courseId },
      include: { lessons: { orderBy: { order: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: sections });
  } catch (error) {
    next(error);
  }
});

courseRoutes.post('/:courseId/sections', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = sectionSchema.parse(req.body);
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    
    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    const section = await prisma.section.create({
      data: { ...input, courseId: req.params.courseId },
      include: { lessons: true },
    });

    res.status(201).json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

courseRoutes.patch('/:courseId/sections/:sectionId', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = sectionSchema.partial().parse(req.body);
    const section = await prisma.section.update({
      where: { id: req.params.sectionId },
      data: input,
      include: { lessons: true },
    });
    res.json({ success: true, data: section });
  } catch (error) {
    next(error);
  }
});

courseRoutes.delete('/:courseId/sections/:sectionId', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.section.delete({ where: { id: req.params.sectionId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================
// Lesson Routes
// ============================================

const lessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  videoUrl: z.string().url().optional(),
  duration: z.number().nonnegative().optional(),
  order: z.number().nonnegative(),
  isFree: z.boolean().optional(),
});

courseRoutes.get('/:courseId/sections/:sectionId/lessons', async (req, res, next) => {
  try {
    const lessons = await prisma.lesson.findMany({
      where: { sectionId: req.params.sectionId },
      orderBy: { order: 'asc' },
    });
    res.json({ success: true, data: lessons });
  } catch (error) {
    next(error);
  }
});

courseRoutes.get('/:courseId/sections/:sectionId/lessons/:lessonId', async (req, res, next) => {
  if (isDevMode()) {
    const course = MOCK_COURSES.find((c) => c.id === req.params.courseId);
    const section = course?.sections.find((s) => s.id === req.params.sectionId);
    const lesson = section?.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) {
      res.status(404).json({ success: false, error: 'Lesson not found' });
      return;
    }
    res.json({ success: true, data: lesson });
    return;
  }
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
    });
    if (!lesson) {
      res.status(404).json({ success: false, error: 'Lesson not found' });
      return;
    }
    res.json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
});

courseRoutes.post('/:courseId/sections/:sectionId/lessons', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = lessonSchema.parse(req.body);
    const section = await prisma.section.findUnique({ where: { id: req.params.sectionId } });

    if (!section) {
      res.status(404).json({ success: false, error: 'Section not found' });
      return;
    }

    const lesson = await prisma.lesson.create({
      data: { ...input, sectionId: req.params.sectionId },
    });

    res.status(201).json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
});

courseRoutes.patch('/:courseId/sections/:sectionId/lessons/:lessonId', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = lessonSchema.partial().parse(req.body);
    const lesson = await prisma.lesson.update({
      where: { id: req.params.lessonId },
      data: input,
    });
    res.json({ success: true, data: lesson });
  } catch (error) {
    next(error);
  }
});

courseRoutes.delete('/:courseId/sections/:sectionId/lessons/:lessonId', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    await prisma.lesson.delete({ where: { id: req.params.lessonId } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ============================================
// Lesson Completion / Progress Routes
// ============================================

courseRoutes.post('/:courseId/lessons/:lessonId/complete', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    res.json({ success: true, data: { lessonId: req.params.lessonId, completedAt: new Date().toISOString() } });
    return;
  }
  try {
    const completion = await prisma.lessonCompletion.upsert({
      where: { userId_lessonId: { userId: req.user!.id, lessonId: req.params.lessonId } },
      update: { completedAt: new Date() },
      create: { userId: req.user!.id, lessonId: req.params.lessonId },
    });
    res.json({ success: true, data: completion });
  } catch (error) {
    next(error);
  }
});

courseRoutes.get('/:courseId/progress', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    const course = MOCK_COURSES.find((c) => c.id === req.params.courseId);
    const totalLessons = course?.sections.reduce((sum, s) => sum + s.lessons.length, 0) ?? 0;
    res.json({
      success: true,
      data: { courseId: req.params.courseId, totalLessons, completedLessons: 0, progressPercentage: 0, completedLessonIds: [] },
    });
    return;
  }
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
      include: { sections: { include: { lessons: true } } },
    });

    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    const completions = await prisma.lessonCompletion.findMany({
      where: {
        userId: req.user!.id,
        lesson: { section: { courseId: req.params.courseId } },
      },
      select: { lessonId: true, completedAt: true },
    });

    const totalLessons = course.sections.reduce((sum, section) => sum + section.lessons.length, 0);
    const completedLessons = completions.length;
    const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    res.json({
      success: true,
      data: {
        courseId: req.params.courseId,
        totalLessons,
        completedLessons,
        progressPercentage,
        completedLessonIds: completions.map(c => c.lessonId),
      },
    });
  } catch (error) {
    next(error);
  }
});
