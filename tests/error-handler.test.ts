import { describe, it, expect, vi } from 'vitest';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { errorHandler, AppError } from '../apps/api/src/middleware/errorHandler';
import type { Request, Response, NextFunction } from 'express';

// ── Mock Express primitives ──────────────────────────────────────────────────
const mockReq = () => ({}) as Request;
const mockNext = () => vi.fn() as unknown as NextFunction;

const mockRes = () => {
  const res = {} as Response;
  // Each method returns `res` so chains like res.status(x).json(y) work
  (res as any).status = vi.fn().mockReturnThis();
  (res as any).json   = vi.fn().mockReturnThis();
  return res;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeZodError = (): ZodError => {
  try {
    z.object({ title: z.string(), age: z.number() }).parse({ age: 'not-a-number' });
  } catch (e) {
    return e as ZodError;
  }
  throw new Error('Expected ZodError to be thrown');
};

const makePrismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('DB error', {
    code,
    clientVersion: '5.0.0',
  });

// ── Tests ────────────────────────────────────────────────────────────────────
describe('errorHandler middleware', () => {
  describe('ZodError → 422', () => {
    it('returns status 422', () => {
      const res = mockRes();
      errorHandler(makeZodError(), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(422);
    });

    it('sets success:false', () => {
      const res = mockRes();
      errorHandler(makeZodError(), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.success).toBe(false);
    });

    it('includes issues array with path and message', () => {
      const res = mockRes();
      errorHandler(makeZodError(), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(Array.isArray(body.issues)).toBe(true);
      expect(body.issues.length).toBeGreaterThan(0);
      expect(body.issues[0]).toHaveProperty('path');
      expect(body.issues[0]).toHaveProperty('message');
    });

    it('reports the correct field name in issues', () => {
      const res = mockRes();
      errorHandler(makeZodError(), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      // missing `title` and wrong type for `age` → issues should reference those fields
      const paths = body.issues.map((i: any) => i.path).flat();
      expect(paths).toContain('title');
    });

    it('sets error message to "Validation error"', () => {
      const res = mockRes();
      errorHandler(makeZodError(), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toBe('Validation error');
    });
  });

  describe('Prisma errors', () => {
    it('P2002 (unique constraint) → 409', () => {
      const res = mockRes();
      errorHandler(makePrismaError('P2002'), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(409);
      expect((res as any).json.mock.calls[0][0].success).toBe(false);
    });

    it('P2002 response mentions "already exists"', () => {
      const res = mockRes();
      errorHandler(makePrismaError('P2002'), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toMatch(/already exists/i);
    });

    it('P2003 (foreign key) → 400', () => {
      const res = mockRes();
      errorHandler(makePrismaError('P2003'), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(400);
    });

    it('P2003 response mentions "does not exist"', () => {
      const res = mockRes();
      errorHandler(makePrismaError('P2003'), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toMatch(/does not exist/i);
    });

    it('P2025 (record not found) → 404', () => {
      const res = mockRes();
      errorHandler(makePrismaError('P2025'), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(404);
    });

    it('unknown Prisma code → 400 with code in message', () => {
      const res = mockRes();
      errorHandler(makePrismaError('P9999'), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(400);
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toContain('P9999');
    });
  });

  describe('AppError', () => {
    it('uses the statusCode set on the error', () => {
      const res = mockRes();
      errorHandler(new AppError('Not found', 404), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(404);
    });

    it('exposes the message for non-500 errors', () => {
      const res = mockRes();
      errorHandler(new AppError('Not found', 404), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toBe('Not found');
    });

    it('AppError 400 → 400 with message', () => {
      const res = mockRes();
      errorHandler(new AppError('Bad request', 400), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(400);
      expect((res as any).json.mock.calls[0][0].error).toBe('Bad request');
    });

    it('AppError 403 → 403 with message', () => {
      const res = mockRes();
      errorHandler(new AppError('Forbidden', 403), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(403);
      expect((res as any).json.mock.calls[0][0].error).toBe('Forbidden');
    });

    it('AppError without explicit statusCode defaults to 500', () => {
      const res = mockRes();
      errorHandler(new AppError('oops'), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(500);
    });

    it('AppError 500 returns generic message, not raw error text', () => {
      const res = mockRes();
      errorHandler(new AppError('secret db details', 500), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toBe('Internal server error');
      expect(body.error).not.toContain('secret db details');
    });
  });

  describe('generic Error → 500', () => {
    it('returns 500 for a plain Error', () => {
      const res = mockRes();
      errorHandler(new Error('something broke'), mockReq(), res, mockNext());
      expect((res as any).status).toHaveBeenCalledWith(500);
    });

    it('returns generic message, not raw error details', () => {
      const res = mockRes();
      errorHandler(new Error('internal details'), mockReq(), res, mockNext());
      const body = (res as any).json.mock.calls[0][0];
      expect(body.error).toBe('Internal server error');
      expect(body.success).toBe(false);
    });
  });
});
