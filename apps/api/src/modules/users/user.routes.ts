import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';

export const userRoutes = Router();

const isDevMode = () => !process.env.DATABASE_URL;

const DEV_USERS = [
  { id: 'instructor-1', name: 'Maya Chen', email: 'instructor@learnloop.test', role: 'INSTRUCTOR', avatarUrl: null, isActive: true },
  { id: 'instructor-2', name: 'Arjun Mehta', email: 'instructor2@learnloop.test', role: 'INSTRUCTOR', avatarUrl: null, isActive: true },
  { id: 'student-dev-1', name: 'Alex Student', email: 'student@learnloop.test', role: 'STUDENT', avatarUrl: null, isActive: true },
  { id: 'admin-dev-1', name: 'Admin User', email: 'admin@learnloop.test', role: 'ADMIN', avatarUrl: null, isActive: true },
];

// GET /api/users — searchable user list (any authenticated user)
userRoutes.get('/', requireAuth, async (req, res, next) => {
  const search = (req.query.search as string | undefined)?.trim() ?? '';
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));

  if (isDevMode()) {
    const q = search.toLowerCase();
    const results = search
      ? DEV_USERS.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      : DEV_USERS;
    res.json({ success: true, data: results.slice(0, limit) });
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, isActive: true },
      orderBy: { name: 'asc' },
      take: limit,
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id — single user profile
userRoutes.get('/:id', requireAuth, async (req, res, next) => {
  if (isDevMode()) {
    const user = DEV_USERS.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, name: true, avatarUrl: true, bio: true, role: true, isActive: true, createdAt: true },
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

// Admin-only: full user list
userRoutes.get('/admin/all', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (_req, res, next) => {
  if (isDevMode()) {
    res.json({ success: true, data: DEV_USERS });
    return;
  }
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});
