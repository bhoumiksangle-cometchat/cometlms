import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';

export const quizRoutes = Router();

quizRoutes.post('/sections/:id/quiz', requireAuth, requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const input = z.object({ title: z.string(), description: z.string().optional(), passingScore: z.number().optional() }).parse(req.body);
    const quiz = await prisma.quiz.create({ data: { ...input, sectionId: req.params.id } });
    res.status(201).json({ success: true, data: quiz });
  } catch (error) {
    next(error);
  }
});

quizRoutes.post('/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ answers: z.record(z.string()) }).parse(req.body);
    const attempt = await prisma.quizAttempt.create({
      data: { quizId: req.params.id, userId: req.user!.id, answers: input.answers, score: 0, passed: false, completedAt: new Date() },
    });
    res.status(201).json({ success: true, data: attempt });
  } catch (error) {
    next(error);
  }
});
