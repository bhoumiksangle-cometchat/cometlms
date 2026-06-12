import type { NextFunction, Request, Response } from 'express';

export type ApiError = Error & {
  statusCode?: number;
};

export function errorHandler(error: ApiError, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = error.statusCode ?? 500;

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : error.message,
  });
}
