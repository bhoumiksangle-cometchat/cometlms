import { prisma } from '../../server';

export class Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;

  constructor(data: Partial<Notification> & {
    userId: string;
    type: string;
    title: string;
    message: string;
  }) {
    this.id = data.id || crypto.randomUUID();
    this.userId = data.userId;
    this.type = data.type;
    this.title = data.title;
    this.message = data.message;
    this.data = data.data;
    this.read = data.read ?? false;
    this.createdAt = data.createdAt || new Date();
  }

  async save(): Promise<Notification> {
    const notification = await prisma.notification.upsert({
      where: { id: this.id },
      update: {
        userId: this.userId,
        type: this.type,
        title: this.title,
        message: this.message,
        data: this.data,
        read: this.read,
      },
      create: {
        id: this.id,
        userId: this.userId,
        type: this.type,
        title: this.title,
        message: this.message,
        data: this.data,
        read: this.read,
      },
    });

    Object.assign(this, notification);
    return this;
  }

  static async findById(id: string): Promise<Notification | null> {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) return null;
    return new Notification(notification);
  }

  static async findByUser(userId: string, options: {
    skip?: number;
    take?: number;
    unreadOnly?: boolean;
  } = {}): Promise<Notification[]> {
    const where: any = { userId };
    if (options.unreadOnly) where.read = false;

    const notifications = await prisma.notification.findMany({
      skip: options.skip,
      take: options.take,
      where,
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map(n => new Notification(n));
  }

  static async countUnread(userId: string): Promise<number> {
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  }

  toJSON() {
    const { ...safeNotification } = this;
    return safeNotification;
  }
}