import { prisma } from '../../server';
import { NotificationType } from '@prisma/client';
import { Notification } from './notification.model';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';

export class NotificationService {
  public async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await prisma.$transaction([
      prisma.notification.findMany({
        skip,
        take: limit,
        where: { userId, ...(unreadOnly ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({
        where: { userId, ...(unreadOnly ? { read: false } : {}) },
      }),
    ]);

    return {
      notifications: notifications.map(n => new Notification(n)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  public async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }) {
    const notification = new Notification({
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
    });

    const saved = await notification.save();

    // If email channel, send email via SendGrid (in production)
    if (data.type === NotificationType.EMAIL) {
      this.sendEmailNotification(data).catch(err =>
        logger.error('Failed to send email notification:', err)
      );
    }

    return saved;
  }

  public async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    if (notification.userId !== userId) {
      throw new AppError('Not authorized', 403);
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  public async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  public async getUnreadCount(userId: string) {
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  }

  private async sendEmailNotification(data: {
    email?: string;
    title: string;
    message: string;
  }) {
    // In production, integrate with SendGrid
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ ... });
    logger.info(`Email notification would be sent: ${data.title}`);
  }
}