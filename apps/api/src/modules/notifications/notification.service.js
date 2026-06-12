import { prisma } from '../../server';
import { Notification } from './notification.model';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';
export class NotificationService {
    async getUserNotifications(userId, page = 1, limit = 20, unreadOnly = false) {
        const skip = (page - 1) * limit;
        const [notifications, total] = await prisma.$transaction([
            prisma.notification.findMany({
                skip,
                take: limit,
                where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.notification.count({
                where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
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
    async createNotification(data) {
        const notification = new Notification({
            userId: data.userId,
            type: data.type,
            title: data.title,
            message: data.message,
            channel: data.channel || 'in_app',
            data: data.data,
        });
        const saved = await notification.save();
        // If email channel, send email via SendGrid (in production)
        if (data.channel === 'email') {
            this.sendEmailNotification(data).catch(err => logger.error('Failed to send email notification:', err));
        }
        return saved;
    }
    async markAsRead(id, userId) {
        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification) {
            throw new AppError('Notification not found', 404);
        }
        if (notification.userId !== userId) {
            throw new AppError('Not authorized', 403);
        }
        await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
    }
    async markAllAsRead(userId) {
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
    async getUnreadCount(userId) {
        return await prisma.notification.count({
            where: { userId, isRead: false },
        });
    }
    async sendEmailNotification(data) {
        // In production, integrate with SendGrid
        // const sgMail = require('@sendgrid/mail');
        // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        // await sgMail.send({ ... });
        logger.info(`Email notification would be sent: ${data.title}`);
    }
}
//# sourceMappingURL=notification.service.js.map