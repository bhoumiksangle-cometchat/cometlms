import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class UserController {
    private userService;
    constructor();
    getProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    updateProfile: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAll: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    deactivate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=user.controller.d.ts.map