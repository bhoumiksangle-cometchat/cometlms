import type { NextFunction, Request, Response } from 'express';
declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: string;
            role: string;
        };
    }
}
export declare function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requireRole(...roles: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map