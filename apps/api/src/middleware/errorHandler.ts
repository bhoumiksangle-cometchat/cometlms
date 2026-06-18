import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export type ApiError = Error & {
  statusCode?: number;
};

// Used by service layers to throw HTTP errors with a specific status code
export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export function errorHandler(error: ApiError, _req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors → 422
  if (error instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: 'Validation error',
      issues: error.errors.map((e) => ({ path: e.path, message: e.message })),
    });
    return;
  }

  // Prisma known request errors → meaningful 4xx
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        res.status(409).json({ success: false, error: 'A record with this value already exists' });
        return;
      case 'P2003': // Foreign key constraint violation
        res.status(400).json({ success: false, error: 'Referenced record does not exist' });
        return;
      case 'P2025': // Record not found (update/delete)
        res.status(404).json({ success: false, error: 'Record not found' });
        return;
      default:
        res.status(400).json({ success: false, error: `Database error: ${error.code}` });
        return;
    }
  }

  const statusCode = error.statusCode ?? 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : error.message,
  });
}
