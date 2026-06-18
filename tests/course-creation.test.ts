import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { errorHandler } from '../apps/api/src/middleware/errorHandler';

// ── Mocks (hoisted before any imports) ───────────────────────────────────────

// Prevent server.ts from starting an HTTP server / workers
vi.mock('../apps/api/src/server', () => ({
  prisma: {
    course: { create: vi.fn() },
  },
}));

// Bypass JWT auth — inject a fake INSTRUCTOR user onto req
vi.mock('../apps/api/src/middleware/auth', () => ({
  requireAuth: vi.fn((_req: any, _res: any, next: any) => {
    _req.user = { id: 'instructor-test', role: 'INSTRUCTOR', email: 'test@test.com' };
    next();
  }),
  // requireRole is a factory; each call returns Express middleware
  requireRole: vi.fn((..._roles: string[]) => (_req: any, _res: any, next: any) => next()),
}));

import { courseRoutes } from '../apps/api/src/modules/courses/course.routes';
import { prisma } from '../apps/api/src/server';

const mockCreate = vi.mocked(prisma.course.create);

// Helper: build a minimal Express app with course router + error handler
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/courses', courseRoutes);
  app.use(errorHandler);
  return app;
};

// Minimal valid payload that satisfies the full courseSchema
const validPayload = {
  title: 'Test Course',
  slug: 'test-course',
  description: 'A test course description',
  categoryId: 'cat-1',
  price: 0,
};

// Prisma error factory
const makePrismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('DB error', {
    code,
    clientVersion: '5.0.0',
  });

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('POST /api/courses — course creation', () => {
  const savedDbUrl = process.env.DATABASE_URL;

  afterEach(() => {
    mockCreate.mockReset();
    if (savedDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDbUrl;
  });

  // ── Dev mode ───────────────────────────────────────────────────────────────
  describe('dev mode (no DATABASE_URL)', () => {
    beforeEach(() => { delete process.env.DATABASE_URL; });

    it('returns 201 with a mock course object', async () => {
      const res = await request(buildApp())
        .post('/api/courses')
        .send(validPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('course response contains expected fields', async () => {
      const res = await request(buildApp())
        .post('/api/courses')
        .send(validPayload);
      const course = res.body.data;
      expect(course).toHaveProperty('id');
      expect(course).toHaveProperty('title', 'Test Course');
      expect(course).toHaveProperty('slug', 'test-course');
      expect(course).toHaveProperty('instructorId', 'instructor-test');
    });

    it('dev mode uses partial schema — partial data still returns 201', async () => {
      // In dev mode courseSchema.partial() is used, so missing slug is fine
      const res = await request(buildApp())
        .post('/api/courses')
        .send({ title: 'Partial Course' });
      expect(res.status).toBe(201);
    });

    it('does NOT call prisma.course.create in dev mode', async () => {
      await request(buildApp()).post('/api/courses').send(validPayload);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ── Production mode — validation errors (used to be 500, now 422) ──────────
  describe('production mode — Zod validation errors', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/lms_test';
    });

    it('missing title → 422 (not 500)', async () => {
      const { title: _t, ...noTitle } = validPayload;
      const res = await request(buildApp()).post('/api/courses').send(noTitle);
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('missing slug → 422', async () => {
      const { slug: _s, ...noSlug } = validPayload;
      const res = await request(buildApp()).post('/api/courses').send(noSlug);
      expect(res.status).toBe(422);
    });

    it('missing description → 422', async () => {
      const { description: _d, ...noDesc } = validPayload;
      const res = await request(buildApp()).post('/api/courses').send(noDesc);
      expect(res.status).toBe(422);
    });

    it('completely empty body → 422', async () => {
      const res = await request(buildApp()).post('/api/courses').send({});
      expect(res.status).toBe(422);
    });

    it('validation error response includes issues array', async () => {
      const res = await request(buildApp()).post('/api/courses').send({});
      expect(res.body.error).toBe('Validation error');
      expect(Array.isArray(res.body.issues)).toBe(true);
      expect(res.body.issues.length).toBeGreaterThan(0);
    });

    it('invalid level enum → 422', async () => {
      const res = await request(buildApp())
        .post('/api/courses')
        .send({ ...validPayload, level: 'EXPERT' }); // not in enum
      expect(res.status).toBe(422);
    });

    it('prisma is NOT called when validation fails', async () => {
      await request(buildApp()).post('/api/courses').send({});
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ── Production mode — DB constraint errors (used to be 500, now 4xx) ───────
  describe('production mode — Prisma constraint errors', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/lms_test';
    });

    it('invalid categoryId (P2003 FK) → 400 (not 500)', async () => {
      mockCreate.mockRejectedValue(makePrismaError('P2003'));
      const res = await request(buildApp()).post('/api/courses').send(validPayload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('P2003 response mentions "does not exist"', async () => {
      mockCreate.mockRejectedValue(makePrismaError('P2003'));
      const res = await request(buildApp()).post('/api/courses').send(validPayload);
      expect(res.body.error).toMatch(/does not exist/i);
    });

    it('duplicate slug (P2002 unique) → 409 (not 500)', async () => {
      mockCreate.mockRejectedValue(makePrismaError('P2002'));
      const res = await request(buildApp()).post('/api/courses').send(validPayload);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('P2002 response mentions "already exists"', async () => {
      mockCreate.mockRejectedValue(makePrismaError('P2002'));
      const res = await request(buildApp()).post('/api/courses').send(validPayload);
      expect(res.body.error).toMatch(/already exists/i);
    });
  });

  // ── Production mode — success path ────────────────────────────────────────
  describe('production mode — success', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/lms_test';
    });

    it('valid payload → 201 with created course', async () => {
      const created = { id: 'new-uuid', ...validPayload, instructorId: 'instructor-test', status: 'DRAFT' };
      mockCreate.mockResolvedValue(created as any);
      const res = await request(buildApp()).post('/api/courses').send(validPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('new-uuid');
    });

    it('instructorId comes from auth token, not request body', async () => {
      const created = { id: 'c-1', ...validPayload, instructorId: 'instructor-test', status: 'DRAFT' };
      mockCreate.mockResolvedValue(created as any);
      await request(buildApp()).post('/api/courses').send(validPayload);
      const callArg = mockCreate.mock.calls[0][0] as any;
      expect(callArg.data.instructorId).toBe('instructor-test');
    });
  });
});
