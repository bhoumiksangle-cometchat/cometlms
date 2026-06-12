import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { AuthRequest } from '../../middleware/auth';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  public getProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.getProfile(req.user!.id);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  public updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.updateProfile(req.user!.id, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  public getAll = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 10, role, isActive } = req.query;
      const users = await this.userService.getAll({
        page: Number(page),
        limit: Number(limit),
        role: role as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      });
      res.status(200).json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.userService.getById(req.params.id);
      res.status(200).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  };

  public deactivate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.userService.deactivate(req.params.id);
      res.status(200).json({ success: true, message: 'User deactivated successfully' });
    } catch (error) {
      next(error);
    }
  };
}