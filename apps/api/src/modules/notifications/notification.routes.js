import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../server';
export const notificationRoutes = Router();
notificationRoutes.get('/', requireAuth, async (req, res, next) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.json({ success: true, data: notifications });
    }
    catch (error) {
        next(error);
    }
});
//# sourceMappingURL=notification.routes.js.map