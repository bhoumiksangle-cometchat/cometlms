import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class EnrollmentController {
    private enrollmentService;
    constructor();
    enroll: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getMyEnrollments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    updateProgress: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    completeLesson: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getCourseEnrollments: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=enrollment.controller.d.ts.map