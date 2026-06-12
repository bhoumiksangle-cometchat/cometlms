import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';
export const userRoutes = Router();
userRoutes.get('/', requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), async (_req, res, next) => {
    try {
        const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
        res.json({ success: true, data: users });
    }
    catch (error) {
        next(error);
    }
});
userRoutes.get('/:id', requireAuth, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { id: true, email: true, name: true, avatarUrl: true, bio: true, role: true, isActive: true, createdAt: true },
        });
        res.json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=user.routes.js.map