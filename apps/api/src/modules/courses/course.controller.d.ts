import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class CourseController {
    private courseService;
    constructor();
    getAll: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getBySlug: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    create: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    update: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    publish: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=course.controller.d.ts.map