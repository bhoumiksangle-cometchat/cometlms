import { Notification } from './notification.model';
export declare class NotificationService {
    getUserNotifications(userId: string, page?: number, limit?: number, unreadOnly?: boolean): Promise<{
        notifications: any;
        pagination: {
            page: number;
            limit: number;
            total: any;
            pages: number;
        };
    }>;
    createNotification(data: {
        userId: string;
        type: string;
        title: string;
        message: string;
        channel?: string;
        data?: Record<string, any>;
    }): Promise<Notification>;
    markAsRead(id: string, userId: string): Promise<void>;
    markAllAsRead(userId: string): Promise<void>;
    getUnreadCount(userId: string): Promise<any>;
    private sendEmailNotification;
}
//# sourceMappingURL=notification.service.d.ts.map