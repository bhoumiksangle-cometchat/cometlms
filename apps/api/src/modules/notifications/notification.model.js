import { prisma } from '../../server';
export class Notification {
    id;
    userId;
    type;
    title;
    message;
    data;
    isRead;
    channel; // 'in_app' | 'email' | 'push'
    createdAt;
    updatedAt;
    constructor(data) {
        this.id = data.id || crypto.randomUUID();
        this.userId = data.userId;
        this.type = data.type;
        this.title = data.title;
        this.message = data.message;
        this.data = data.data;
        this.isRead = data.isRead ?? false;
        this.channel = data.channel;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
    }
    async save() {
        const notification = await prisma.notification.upsert({
            where: { id: this.id },
            update: {
                userId: this.userId,
                type: this.type,
                title: this.title,
                message: this.message,
                data: this.data,
                isRead: this.isRead,
                channel: this.channel,
                updatedAt: this.updatedAt = new Date(),
            },
            create: {
                id: this.id,
                userId: this.userId,
                type: this.type,
                title: this.title,
                message: this.message,
                data: this.data,
                isRead: this.isRead,
                channel: this.channel,
            },
        });
        Object.assign(this, notification);
        return this;
    }
    static async findById(id) {
        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification)
            return null;
        return new Notification(notification);
    }
    static async findByUser(userId, options = {}) {
        const where = { userId };
        if (options.unreadOnly)
            where.isRead = false;
        const notifications = await prisma.notification.findMany({
            skip: options.skip,
            take: options.take,
            where,
            orderBy: { createdAt: 'desc' },
        });
        return notifications.map(n => new Notification(n));
    }
    static async countUnread(userId) {
        return await prisma.notification.count({
            where: { userId, isRead: false },
        });
    }
    toJSON() {
        const { ...safeNotification } = this;
        return safeNotification;
    }
}
//# sourceMappingURL=notification.model.js.map