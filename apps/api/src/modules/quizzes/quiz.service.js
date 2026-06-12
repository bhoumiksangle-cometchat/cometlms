import { prisma } from '../../server';
import { Quiz, QuizAttempt } from './quiz.model';
import { AppError } from '../../middleware/errorHandler';
export class QuizService {
    async getBySection(sectionId) {
        const quizzes = await prisma.quiz.findMany({
            where: { sectionId },
            orderBy: { createdAt: 'asc' },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        options: {
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });
        return quizzes.map(q => new Quiz(q));
    }
    async getById(id) {
        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        options: {
                            orderBy: { order: 'asc' },
                            select: {
                                id: true,
                                questionId: true,
                                optionText: true,
                                order: true,
                            },
                        },
                    },
                },
            },
        });
        if (!quiz) {
            throw new AppError('Quiz not found', 404);
        }
        return new Quiz(quiz);
    }
    async create(data) {
        const quiz = await prisma.quiz.create({
            data: {
                sectionId: data.sectionId,
                title: data.title,
                description: data.description,
                passingScore: data.passingScore,
                timeLimit: data.timeLimit,
                attemptsAllowed: data.attemptsAllowed,
                questions: data.questions ? {
                    create: data.questions.map(q => ({
                        questionText: q.questionText,
                        questionType: q.questionType,
                        points: q.points,
                        order: q.order,
                        options: q.options ? {
                            create: q.options.map(o => ({
                                optionText: o.optionText,
                                isCorrect: o.isCorrect,
                                order: o.order,
                            })),
                        } : undefined,
                    })),
                } : undefined,
            },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: { options: { orderBy: { order: 'asc' } } },
                },
            },
        });
        return new Quiz(quiz);
    }
    async update(id, data) {
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) {
            throw new AppError('Quiz not found', 404);
        }
        const updated = await prisma.quiz.update({
            where: { id },
            data,
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: { options: { orderBy: { order: 'asc' } } },
                },
            },
        });
        return new Quiz(updated);
    }
    async delete(id) {
        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) {
            throw new AppError('Quiz not found', 404);
        }
        await prisma.quiz.delete({ where: { id } });
    }
    async submit(quizId, userId, answers) {
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    include: { options: true },
                },
            },
        });
        if (!quiz) {
            throw new AppError('Quiz not found', 404);
        }
        // Check attempt limit
        const existingAttempts = await prisma.quizAttempt.findMany({
            where: { quizId, userId },
        });
        if (existingAttempts.length >= quiz.attemptsAllowed) {
            throw new AppError('Maximum attempts reached', 400);
        }
        // Calculate score
        let totalPoints = 0;
        let earnedPoints = 0;
        for (const question of quiz.questions) {
            totalPoints += question.points;
            const userAnswer = answers[question.id];
            if (!userAnswer)
                continue;
            if (question.questionType === 'multiple_choice' || question.questionType === 'true_false') {
                const correctOption = question.options.find(o => o.isCorrect);
                if (correctOption && userAnswer === correctOption.id) {
                    earnedPoints += question.points;
                }
            }
            else if (question.questionType === 'short_answer') {
                const correctOption = question.options.find(o => o.isCorrect);
                if (correctOption && typeof userAnswer === 'string' &&
                    userAnswer.toLowerCase().trim() === correctOption.optionText.toLowerCase().trim()) {
                    earnedPoints += question.points;
                }
            }
            // Essay questions are graded manually - award 0 for now
        }
        const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        const passed = score >= quiz.passingScore;
        const attempt = await prisma.quizAttempt.create({
            data: {
                quizId,
                userId,
                attemptNumber: existingAttempts.length + 1,
                score,
                passed,
                completedAt: new Date(),
                answers,
            },
        });
        return {
            attempt: new QuizAttempt(attempt),
            score,
            passed,
            totalPoints,
            earnedPoints,
        };
    }
    async getAttempts(quizId, userId) {
        const attempts = await prisma.quizAttempt.findMany({
            where: { quizId, userId },
            orderBy: { attemptNumber: 'asc' },
        });
        return attempts.map(a => new QuizAttempt(a));
    }
    async getLatestAttempt(quizId, userId) {
        const attempt = await prisma.quizAttempt.findFirst({
            where: { quizId, userId },
            orderBy: { attemptNumber: 'desc' },
        });
        return attempt ? new QuizAttempt(attempt) : null;
    }
}
//# sourceMappingURL=quiz.service.js.map