import { NotificationService } from './notification.service';
export class NotificationController {
    notificationService;
    constructor() {
        this.notificationService = new NotificationService();
    }
    getMyNotifications = async (req, res, next) => {
        try {
            const { page = 1, limit = 20, unreadOnly } = req.query;
            const notifications = await this.notificationService.getUserNotifications(req.user.id, Number(page), Number(limit), unreadOnly === 'true');
            res.status(200).json({ success: true, data: notifications });
        }
        catch (error) {
            next(error);
        }
    };
    markAsRead = async (req, res, next) => {
        try {
            await this.notificationService.markAsRead(req.params.id, req.user.id);
            res.status(200).json({ success: true, message: 'Notification marked as read' });
        }
        catch (error) {
            next(error);
        }
    };
    markAllAsRead = async (req, res, next) => {
        try {
            await this.notificationService.markAllAsRead(req.user.id);
            res.status(200).json({ success: true, message: 'All notifications marked as read' });
        }
        catch (error) {
            next(error);
        }
    };
    getUnreadCount = async (req, res, next) => {
        try {
            const count = await this.notificationService.getUnreadCount(req.user.id);
            res.status(200).json({ success: true, data: { count } });
        }
        catch (error) {
            next(error);
        }
    };
}
//# sourceMappingURL=notification.controller.js.map