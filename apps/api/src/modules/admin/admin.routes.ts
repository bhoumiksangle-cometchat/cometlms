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
    provider: 'COMETCHAT_AGENT_BUILDER',
    modelName: 'Configured in CometChat Dashboard',
    systemPrompt: 'You are a helpful FAQ assistant. Answer questions about React, hooks, and component patterns.',
    courseId: 'course-react-foundations',
    botUserId: 'bot-1',
    course: { id: 'course-react-foundations', title: 'React Foundations for Product Teams' },
    botUser: { id: 'bot-1', name: 'FAQ Bot', avatarUrl: null },
    managedBy: 'CometChat Agent Builder',
  },
  {
    id: 'agent-study-1',
    agentType: 'STUDY_ASSISTANT',
    isEnabled: true,
    provider: 'COMETCHAT_AGENT_BUILDER',
    modelName: 'Configured in CometChat Dashboard',
    systemPrompt: 'You are a patient study tutor. Help students understand difficult concepts with step-by-step explanations.',
    courseId: null,
    botUserId: 'bot-2',
    course: null,
    botUser: { id: 'bot-2', name: 'Study Tutor', avatarUrl: null },
    managedBy: 'CometChat Agent Builder',
  },
  {
    id: 'agent-copilot-1',
    agentType: 'INSTRUCTOR_COPILOT',
    isEnabled: true,
    provider: 'COMETCHAT_AGENT_BUILDER',
    modelName: 'Configured in CometChat Dashboard',
    systemPrompt: 'You are an instructor copilot. Summarize discussions and draft instructor replies.',
    courseId: null,
    botUserId: 'bot-3',
    course: null,
    botUser: { id: 'bot-3', name: 'Instructor Copilot', avatarUrl: null },
    managedBy: 'CometChat Agent Builder',
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
        pendingFlags: 0,
        activeUsers: 18,
        messagesToday: 74,
        activeCourses: 3,
        engagementScore: 87,
      },
    });
    return;
  }
  try {
    const [users, courses, enrollments] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
    ]);

    // Message stats now come from CometChat engagement metrics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const metrics = await prisma.courseEngagementMetrics.findMany({
      where: { date: { gte: today } },
    });
    const messagesToday = metrics.reduce((sum, m) => sum + m.totalMessages, 0);
    const activeChatters = metrics.reduce((sum, m) => sum + m.activeChatters, 0);
    const flaggedMessages = metrics.reduce((sum, m) => sum + m.flaggedMessages, 0);

    const activeRatio = users > 0 ? (Math.max(activeChatters, 1) / users) * 50 : 0;
    const messageVolumeFactor = Math.min(50, (messagesToday / 10) * 50);
    const engagementScore = Math.round(Math.min(100, Math.max(10, activeRatio + messageVolumeFactor)));

    res.json({
      success: true,
      data: {
        users,
        courses,
        enrollments,
        pendingFlags: flaggedMessages,
        activeUsers: Math.max(activeChatters, 1),
        messagesToday: messagesToday || 0,
        activeCourses: courses,
        engagementScore,
      },
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: Moderation is served by `moderationApiRoutes` (modules/chat/moderation-api.routes.ts),
// which proxies CometChat's moderation API and is mounted at `/api/admin/moderation`
// BEFORE this router in server.ts. The previous empty placeholder handlers were
// removed because they shadowed the real CometChat-backed endpoints.

// Activity events are now tracked via CometChat webhooks → CourseEngagementMetrics
adminRoutes.get('/events/log', async (_req, res) => {
  res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

// Agent config — agents are now managed via CometChat's Agent Builder (dashboard).
// This endpoint returns the list for the admin UI to display status.
adminRoutes.get('/agents', async (_req, res) => {
  res.json({ success: true, data: MOCK_AGENTS });
});

adminRoutes.patch('/agents/:id', async (req, res, next) => {
  try {
    const input = z.object({
      systemPrompt: z.string().optional(),
      modelName: z.string().optional(),
      isEnabled: z.boolean().optional(),
      provider: z.enum(['OPENAI', 'LANGCHAIN', 'COMETCHAT_AGENT_BUILDER']).optional(),
    }).parse(req.body);

    // Find and update in MOCK_AGENTS for now
    const agent = MOCK_AGENTS.find((a) => a.id === req.params.id);
    if (!agent) {
      res.status(404).json({ success: false, error: 'Agent not found' });
      return;
    }
    Object.assign(agent, input);
    res.json({ success: true, data: agent });
  } catch (error) {
    next(error);
  }
});

// ── User management ──────────────────────────────────────────────────────────

const MOCK_USERS = [
  { id: 'user-1', name: 'Alice Chen', email: 'alice@learnloop.test', role: 'STUDENT', isActive: true, isVerified: true, createdAt: new Date('2024-01-15').toISOString() },
  { id: 'user-2', name: 'Bob Mehta', email: 'bob@learnloop.test', role: 'INSTRUCTOR', isActive: true, isVerified: true, createdAt: new Date('2024-02-10').toISOString() },
  { id: 'user-3', name: 'Carol Ng', email: 'carol@learnloop.test', role: 'STUDENT', isActive: false, isVerified: false, createdAt: new Date('2024-03-05').toISOString() },
  { id: 'user-4', name: 'David Park', email: 'david@learnloop.test', role: 'ADMIN', isActive: true, isVerified: true, createdAt: new Date('2024-03-20').toISOString() },
];

adminRoutes.get('/users', async (req, res, next) => {
  if (isDevMode()) {
    const { role, search } = req.query as { role?: string; search?: string };
    let users = MOCK_USERS;
    if (role) users = users.filter((u) => u.role === role);
    if (search) {
      const q = search.toLowerCase();
      users = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    res.json({ success: true, data: users, pagination: { page: 1, limit: 50, total: users.length, totalPages: 1 } });
    return;
  }
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip = (page - 1) * limit;
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;

    const where = {
      ...(role ? { role: role as any } : {}),
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, isActive: true, isVerified: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch('/users/:id/ban', async (req, res, next) => {
  if (isDevMode()) {
    const user = MOCK_USERS.find((u) => u.id === req.params.id);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    user.isActive = false;
    res.json({ success: true, data: user });
    return;
  }
  try {
    // Prevent admins from banning themselves or other admins
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true } });
    if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    if (target.id === req.user!.id) { res.status(400).json({ success: false, error: 'Cannot ban yourself' }); return; }
    if ((target.role === 'ADMIN' || target.role === 'SUPER_ADMIN') && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, error: 'Only SUPER_ADMIN can ban admins' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: { id: true, name: true, email: true, role: true, isActive: true, isVerified: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// ── Engagement analytics ─────────────────────────────────────────────────────

const MOCK_ENGAGEMENT = [
  { courseId: 'course-react-foundations', courseTitle: 'React Foundations for Product Teams', totalMessages: 312, totalReactions: 87, callMinutes: 45, flaggedMessages: 2 },
  { courseId: 'course-node-api', courseTitle: 'Production Node.js APIs', totalMessages: 198, totalReactions: 52, callMinutes: 30, flaggedMessages: 0 },
  { courseId: 'course-design-systems', courseTitle: 'Design Systems at Scale', totalMessages: 145, totalReactions: 41, callMinutes: 15, flaggedMessages: 1 },
];

adminRoutes.get('/engagement', async (req, res, next) => {
  if (isDevMode()) {
    res.json({ success: true, data: MOCK_ENGAGEMENT });
    return;
  }
  try {
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const metrics = await prisma.courseEngagementMetrics.findMany({
      where: { date: { gte: since } },
      include: { course: { select: { id: true, title: true } } },
    });

    // Aggregate by course
    const byCourse: Record<string, {
      courseId: string;
      courseTitle: string;
      totalMessages: number;
      totalReactions: number;
      callMinutes: number;
      flaggedMessages: number;
    }> = {};

    for (const m of metrics) {
      if (!byCourse[m.courseId]) {
        byCourse[m.courseId] = {
          courseId: m.courseId,
          courseTitle: m.course.title,
          totalMessages: 0,
          totalReactions: 0,
          callMinutes: 0,
          flaggedMessages: 0,
        };
      }
      const row = byCourse[m.courseId];
      row.totalMessages += m.totalMessages;
      row.totalReactions += m.totalReactions;
      row.callMinutes += m.callMinutes;
      row.flaggedMessages += m.flaggedMessages;
    }

    const data = Object.values(byCourse).sort((a, b) => b.totalMessages - a.totalMessages);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRoutes.patch('/users/:id/unban', async (req, res, next) => {
  if (isDevMode()) {
    const user = MOCK_USERS.find((u) => u.id === req.params.id);
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
    user.isActive = true;
    res.json({ success: true, data: user });
    return;
  }
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: true },
      select: { id: true, name: true, email: true, role: true, isActive: true, isVerified: true, createdAt: true },
    });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});
