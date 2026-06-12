import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../server';
import { notificationService } from '../../services/notification.service';

export const notificationRoutes = Router();

// Get all notifications for current user
notificationRoutes.get('/', requireAuth, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

// Get unread notifications count
notificationRoutes.get('/unread/count', requireAuth, async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { 
        userId: req.user!.id,
        read: false,
      },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
});

// Get unread notifications
notificationRoutes.get('/unread', requireAuth, async (req, res, next) => {
  try {
    const notifications = await notificationService.getUnreadNotifications(req.user!.id);
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
notificationRoutes.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user!.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
notificationRoutes.post('/mark-all-read', requireAuth, async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Delete a notification
notificationRoutes.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await prisma.notification.delete({
      where: {
        id: req.params.id,
      },
    });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
});
