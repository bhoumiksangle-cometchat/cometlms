import type { NextFunction, Request, Response } from 'express';
export type ApiError = Error & {
    statusCode?: number;
};
export declare function errorHandler(error: ApiError, _req: Request, res: Response, _next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map