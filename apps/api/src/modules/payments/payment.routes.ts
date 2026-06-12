import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { prisma } from '../../server';

export const paymentRoutes = Router();

paymentRoutes.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const input = z.object({ courseId: z.string().uuid(), provider: z.string().default('stripe') }).parse(req.body);
    const course = await prisma.course.findUnique({ where: { id: input.courseId } });

    if (!course) {
      res.status(404).json({ success: false, error: 'Course not found' });
      return;
    }

    const payment = await prisma.payment.create({
      data: { userId: req.user!.id, courseId: course.id, amount: course.price, currency: course.currency, status: 'pending', provider: input.provider },
    });

    res.status(201).json({ success: true, data: { payment, checkoutUrl: null } });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post('/webhook', (_req, res) => {
  res.json({ success: true });
});
