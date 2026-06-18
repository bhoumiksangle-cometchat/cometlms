import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../apps/api/src/middleware/errorHandler';

// ── Mock server module BEFORE any route imports ───────────────────────────────
// Prevents server.ts from binding to a port and starting workers.
// categories.routes.ts does `import { prisma } from '../../server'` — it will
// receive this mock instead of the real server singleton.
vi.mock('../apps/api/src/server', () => ({
  prisma: {
    category: {
      findMany: vi.fn(),
    },
  },
}));

// These imports run AFTER the mock is hoisted
import { categoryRoutes } from '../apps/api/src/modules/categories/categories.routes';
import { prisma } from '../apps/api/src/server';

// Typed reference to the mock so we can set return values per-test
const mockFindMany = vi.mocked(prisma.category.findMany);

// Minimal Express app — mirrors how server.ts mounts the router
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/categories', categoryRoutes);
  app.use(errorHandler); // so we can verify error → HTTP status mapping
  return app;
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/categories', () => {
  // Preserve DATABASE_URL around each test
  const savedDbUrl = process.env.DATABASE_URL;
  afterEach(() => {
    mockFindMany.mockReset();
    if (savedDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDbUrl;
  });

  // ── Dev mode ───────────────────────────────────────────────────────────────
  describe('dev mode (no DATABASE_URL)', () => {
    beforeEach(() => { delete process.env.DATABASE_URL; });

    it('returns HTTP 200', async () => {
      const res = await request(buildApp()).get('/api/categories');
      expect(res.status).toBe(200);
    });

    it('returns { success: true }', async () => {
      const res = await request(buildApp()).get('/api/categories');
      expect(res.body.success).toBe(true);
    });

    it('returns an array in data', async () => {
      const res = await request(buildApp()).get('/api/categories');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns exactly 6 mock categories', async () => {
      const res = await request(buildApp()).get('/api/categories');
      expect(res.body.data).toHaveLength(6);
    });

    it('includes stable IDs cat-1, cat-2, cat-3 (match mock courses)', async () => {
      const res = await request(buildApp()).get('/api/categories');
      const ids: string[] = res.body.data.map((c: any) => c.id);
      expect(ids).toContain('cat-1');
      expect(ids).toContain('cat-2');
      expect(ids).toContain('cat-3');
    });

    it('IDs are stable across multiple requests (not crypto.randomUUID)', async () => {
      const app = buildApp();
      const [r1, r2] = await Promise.all([
        request(app).get('/api/categories'),
        request(app).get('/api/categories'),
      ]);
      const ids1 = r1.body.data.map((c: any) => c.id);
      const ids2 = r2.body.data.map((c: any) => c.id);
      expect(ids1).toEqual(ids2);
    });

    it('each category has id, name, description fields', async () => {
      const res = await request(buildApp()).get('/api/categories');
      for (const cat of res.body.data) {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('description');
      }
    });

    it('does NOT call prisma in dev mode', async () => {
      await request(buildApp()).get('/api/categories');
      expect(mockFindMany).not.toHaveBeenCalled();
    });
  });

  // ── Production mode ────────────────────────────────────────────────────────
  describe('production mode (DATABASE_URL set)', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/lms_test';
    });

    it('calls prisma.category.findMany with orderBy: name asc', async () => {
      mockFindMany.mockResolvedValue([]);
      await request(buildApp()).get('/api/categories');
      expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });

    it('returns categories returned by the database', async () => {
      const dbRows = [
        { id: 'uuid-1', name: 'Alpha', description: 'First category' },
        { id: 'uuid-2', name: 'Beta',  description: null },
      ];
      mockFindMany.mockResolvedValue(dbRows);
      const res = await request(buildApp()).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(dbRows);
    });

    it('returns empty array when no categories exist', async () => {
      mockFindMany.mockResolvedValue([]);
      const res = await request(buildApp()).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('forwards DB errors to the error handler (returns 500)', async () => {
      mockFindMany.mockRejectedValue(new Error('connection timeout'));
      const res = await request(buildApp()).get('/api/categories');
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('does NOT return hard-coded mock IDs in production mode', async () => {
      const dbRows = [{ id: 'real-uuid', name: 'Real Cat', description: null }];
      mockFindMany.mockResolvedValue(dbRows);
      const res = await request(buildApp()).get('/api/categories');
      const ids: string[] = res.body.data.map((c: any) => c.id);
      expect(ids).not.toContain('cat-1');
      expect(ids).toContain('real-uuid');
    });
  });
});
