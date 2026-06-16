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

// Get push notification preferences
notificationRoutes.get('/push-preferences', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { pushNotificationsEnabled: true },
    });
    res.json({ success: true, data: { pushNotificationsEnabled: user!.pushNotificationsEnabled } });
  } catch (error) {
    next(error);
  }
});

// Update push notification preferences
notificationRoutes.patch('/push-preferences', requireAuth, async (req, res, next) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { pushNotificationsEnabled: enabled },
      select: { pushNotificationsEnabled: true },
    });

    res.json({ success: true, data: { pushNotificationsEnabled: user.pushNotificationsEnabled } });
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

// Remove device token (used during logout)
notificationRoutes.delete('/device-token', requireAuth, async (req, res, next) => {
  try {
    await prisma.deviceToken.deleteMany({
      where: { userId: req.user!.id },
    });
    res.json({ success: true });
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

// Register/upsert device token for push notifications
notificationRoutes.post('/device-token', requireAuth, async (req, res, next) => {
  try {
    const { token, platform } = req.body;

    // Validate token is present and non-empty
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Device token is required and must be a non-empty string',
      });
    }

    // Validate platform
    const validPlatforms = ['web', 'android', 'ios'];
    if (!platform || !validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Platform is required and must be one of: web, android, ios',
      });
    }

    const userId = req.user!.id;

    // Check if the existing token is identical (idempotence - Requirement 1.2)
    const existingToken = await prisma.deviceToken.findUnique({
      where: { userId },
    });

    if (existingToken && existingToken.token === token && existingToken.platform === platform) {
      // Token is identical — return success without modifying the record
      return res.json({
        success: true,
        data: {
          id: existingToken.id,
          userId: existingToken.userId,
          platform: existingToken.platform,
          updatedAt: existingToken.updatedAt,
        },
      });
    }

    // Upsert the device token (userId unique constraint ensures single token per user)
    const deviceToken = await prisma.deviceToken.upsert({
      where: { userId },
      update: { token, platform },
      create: { userId, token, platform },
    });

    res.json({
      success: true,
      data: {
        id: deviceToken.id,
        userId: deviceToken.userId,
        platform: deviceToken.platform,
        updatedAt: deviceToken.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});
