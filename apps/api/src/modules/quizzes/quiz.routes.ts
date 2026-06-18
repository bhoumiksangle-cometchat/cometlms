import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import { prisma } from '../../server';

export const quizRoutes = Router();

// ---- Schemas -------------------------------------------------------------

// Each question carries its own option list. `id` is the option's stable id
// (used by grading); `isCorrect` marks the right answer(s). Stored as JSON so
// we don't have to add another table just for options.
const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['single_choice', 'multiple_choice', 'true_false']),
  options: z.array(optionSchema).min(2),
  explanation: z.string().optional(),
  order: z.number().int().nonnegative(),
});

const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  timeLimit: z.number().int().positive().optional(),
  // Optional: callers can create a quiz with all its questions in one shot.
  questions: z.array(questionSchema).optional(),
});

// answers: { [questionId]: optionId | optionId[] } — array form is for
// multiple_choice; single_choice / true_false send a single string.
const submitSchema = z.object({
  answers: z.record(z.union([z.string(), z.array(z.string())])),
});

// ---- Routes --------------------------------------------------------------

quizRoutes.post(
  '/sections/:id/quiz',
  requireAuth,
  requireRole('INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const input = createQuizSchema.parse(req.body);

      // Persist quiz + questions in a single transaction so a partially-saved
      // quiz never goes live.
      const quiz = await prisma.$transaction(async (tx) => {
        const created = await tx.quiz.create({
          data: {
            sectionId: req.params.id,
            title: input.title,
            description: input.description,
            passingScore: input.passingScore ?? 60,
            timeLimit: input.timeLimit,
          },
        });

        if (input.questions && input.questions.length > 0) {
          await tx.question.createMany({
            data: input.questions.map((q, idx) => ({
              quizId: created.id,
              text: q.text,
              type: q.type,
              options: q.options as any, // Json column
              explanation: q.explanation,
              order: q.order ?? idx,
            })),
          });
        }

        return tx.quiz.findUnique({
          where: { id: created.id },
          include: { questions: { orderBy: { order: 'asc' } } },
        });
      });

      res.status(201).json({ success: true, data: quiz });
    } catch (error) {
      next(error);
    }
  },
);

quizRoutes.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    if (!quiz) {
      res.status(404).json({ success: false, error: 'Quiz not found' });
      return;
    }

    // Strip the correct-answer flags before returning to a non-owner. The
    // student should never see which option is correct via the GET endpoint.
    const isOwner = ['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(req.user!.role);
    const sanitized = {
      ...quiz,
      questions: quiz.questions.map((q) => ({
        ...q,
        options: isOwner
          ? q.options
          : Array.isArray(q.options)
            ? (q.options as any[]).map(({ isCorrect: _omit, ...rest }) => rest)
            : q.options,
      })),
    };

    res.json({ success: true, data: sanitized });
  } catch (error) {
    next(error);
  }
});

quizRoutes.post('/:id/submit', requireAuth, async (req, res, next) => {
  try {
    const input = submitSchema.parse(req.body);

    const quiz = await prisma.quiz.findUnique({
      where: { id: req.params.id },
      include: { questions: true },
    });

    if (!quiz) {
      res.status(404).json({ success: false, error: 'Quiz not found' });
      return;
    }

    // Score the attempt. Each question is worth one point; per-question grading
    // depends on type.
    let correct = 0;
    const total = quiz.questions.length;
    const breakdown: Record<string, { correct: boolean; correctOptionIds: string[] }> = {};

    for (const q of quiz.questions) {
      const submitted = input.answers[q.id];
      const opts = Array.isArray(q.options) ? (q.options as any[]) : [];
      const correctIds = opts.filter((o) => o.isCorrect).map((o) => String(o.id));

      let isRight = false;
      if (q.type === 'multiple_choice') {
        const submittedArr = Array.isArray(submitted) ? submitted.map(String) : [];
        // exact-set match
        isRight =
          submittedArr.length === correctIds.length &&
          submittedArr.every((id) => correctIds.includes(id));
      } else {
        // single_choice / true_false
        const submittedId = Array.isArray(submitted) ? submitted[0] : submitted;
        isRight = !!submittedId && correctIds.length === 1 && submittedId === correctIds[0];
      }

      if (isRight) correct += 1;
      breakdown[q.id] = { correct: isRight, correctOptionIds: correctIds };
    }

    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= (quiz.passingScore ?? 60);

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: req.user!.id,
        answers: input.answers as any,
        score,
        passed,
        completedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...attempt,
        total,
        correct,
        breakdown,
      },
    });
  } catch (error) {
    next(error);
  }
});
