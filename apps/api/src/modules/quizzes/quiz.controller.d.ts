import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
export declare class QuizController {
    private quizService;
    constructor();
    getBySection: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    getById: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    create: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    update: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    delete: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    submit: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getAttempts: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
    getLatestAttempt: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
}
//# sourceMappingURL=quiz.controller.d.ts.map