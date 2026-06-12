import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class NotificationController {
    private notificationService;
    constructor();
    getMyNotifications: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    markAsRead: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    markAllAsRead: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getUnreadCount: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=notification.controller.d.ts.map