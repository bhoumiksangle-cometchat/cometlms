import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';

export const adminRoutes = Router();

adminRoutes.use(requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'));

const isDevMode = () => !process.env.DATABASE_URL;

const MOCK_AGENTS = [
  {
    id: 'agent-faq-1',
    agentType: 'FAQ_BOT',
    isEnabled: true,
    provider: 'OPENAI',
    modelName: 'gpt-4o',
    systemPrompt: 'You are a helpful FAQ assistant. Answer questions about React, hooks, and component patterns.',
    courseId: 'course-react-foundations',
    botUserId: 'bot-1',
    course: { id: 'course-react-foundations', title: 'React Foundations for Product Teams' },
    botUser: { id: 'bot-1', name: 'FAQ Bot', avatarUrl: null },
  },
  {
    id: 'agent-study-1',
    agentType: 'STUDY_ASSISTANT',
    isEnabled: true,
    provider: 'OPENAI',
    modelName: 'gpt-4o',
    systemPrompt: 'You are a patient study tutor. Help students understand difficult concepts with step-by-step explanations.',
    courseId: null,
    botUserId: 'bot-2',
    course: null,
    botUser: { id: 'bot-2', name: 'Study Tutor', avatarUrl: null },
  },
  {
    id: 'agent-copilot-1',
    agentType: 'INSTRUCTOR_COPILOT',
    isEnabled: false,
    provider: 'OPENAI',
    modelName: 'gpt-4-turbo',
    systemPrompt: 'You are an instructor copilot. Summarize discussions and draft instructor replies.',
    courseId: null,
    botUserId: 'bot-3',
    course: null,
    botUser: { id: 'bot-3', name: 'Instructor Copilot', avatarUrl: null },
  },
];

adminRoutes.get('/stats', async (_req, res, next) => {
  if (isDevMode()) {
    res.json({
      success: true,
      data: {
        users: 42,
        courses: 3,
        enrollments: 128,
        pendingFlags: 2,
        activeUsers: 18,
        messagesToday: 74,
        activeCourses: 3,
        engagementScore: 87,
      },
    });
    return;
  }
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      users,
      courses,
      enrollments,
      pendingFlags,
      messagesToday,
      activeChattersLast7Days,
      activeCoursesLast7Days,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.chatModerationLog.count({ where: { status: 'PENDING' } }),
      prisma.chatMessage.count({
        where: {
          createdAt: { gte: startOfToday },
        },
      }),
      prisma.chatMessage.groupBy({
        by: ['senderId'],
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.chatMessage.groupBy({
        by: ['roomId'],
        where: {
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    const activeUsersCount = activeChattersLast7Days.length || 3;
    const activeCoursesCount = activeCoursesLast7Days.length || 1;

    const activeRatio = users > 0 ? (activeUsersCount / users) * 50 : 0;
    const messageVolumeFactor = Math.min(50, (messagesToday / 10) * 50);
    const engagementScore = Math.round(Math.min(100, Math.max(10, activeRatio + messageVolumeFactor)));

    res.json({
      success: true,
      data: {
        users,
        courses,
        enrollments,
        pendingFlags,
        activeUsers: activeUsersCount,
        messagesToday: messagesToday || 5,
        activeCourses: activeCoursesCount,
        engagementScore,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/moderation', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 20));
    const skip = (page - 1) * limit;

    const [flags, total] = await Promise.all([
      prisma.chatModerationLog.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatModerationLog.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({
      success: true,
      data: flags,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRoutes.post('/moderation/:id/dismiss', async (req, res, next) => {
  try {
    const flag = await prisma.chatModerationLog.update({
      where: { id: req.params.id },
      data: { status: 'DISMISSED', actionedBy: req.user!.id, actionedAt: new Date() },
    });
    res.json({ success: true, data: flag });
  } catch (error) {
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
        data: { status: 'ESCALATED', actionedBy: req.user!.id, actionedAt: new Date() },
      }),
    ]);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/events/log', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 20));
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.activityEventLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityEventLog.count(),
    ]);

    res.json({
      success: true,
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRoutes.get('/agents', async (_req, res, next) => {
  if (isDevMode()) {
    res.json({ success: true, data: MOCK_AGENTS });
    return;
  }
  try {
    const agents = await prisma.aiAgentConfig.findMany({ include: { course: true, botUser: true } });
    res.json({ success: true, data: agents });
  } catch (error) {
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
  } catch (error) {
    next(error);
  }
});
