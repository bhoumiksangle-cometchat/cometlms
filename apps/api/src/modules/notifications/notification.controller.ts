import { Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
import { AuthRequest } from '../../middleware/auth';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  public getMyNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 20, unreadOnly } = req.query;
      const notifications = await this.notificationService.getUserNotifications(
        req.user!.id,
        Number(page),
        Number(limit),
        unreadOnly === 'true'
      );
      res.status(200).json({ success: true, data: notifications });
    } catch (error) {
      next(error);
    }
  };

  public markAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.notificationService.markAsRead(req.params.id, req.user!.id);
      res.status(200).json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
      next(error);
    }
  };

  public markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.notificationService.markAllAsRead(req.user!.id);
      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      next(error);
    }
  };

  public getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = await this.notificationService.getUnreadCount(req.user!.id);
      res.status(200).json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  };
}