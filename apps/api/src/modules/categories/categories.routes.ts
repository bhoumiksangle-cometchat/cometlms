import { Router } from 'express';
import { prisma } from '../../server';

export const categoryRoutes = Router();

const isDevMode = () => !process.env.DATABASE_URL;

// Use stable IDs that match the mock courses in course.routes.ts
const MOCK_CATEGORIES = [
  { id: 'cat-1', name: 'Web Development', description: null },
  { id: 'cat-2', name: 'Backend Development', description: null },
  { id: 'cat-3', name: 'Design', description: null },
  { id: 'cat-4', name: 'Data Science', description: null },
  { id: 'cat-5', name: 'Mobile Development', description: null },
  { id: 'cat-6', name: 'Business', description: null },
];

categoryRoutes.get('/', async (_req, res, next) => {
  if (isDevMode()) {
    res.json({ success: true, data: MOCK_CATEGORIES });
    return;
  }
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});
