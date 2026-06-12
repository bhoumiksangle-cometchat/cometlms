import { prisma } from '../../server';
import { Enrollment } from './enrollment.model';
import { AppError } from '../../middleware/errorHandler';
export class EnrollmentService {
    async enroll(userId, courseId) {
        // Check if course exists
        const course = await prisma.course.findUnique({ where: { id: courseId } });
        if (!course) {
            throw new AppError('Course not found', 404);
        }
        // Check if already enrolled
        const existing = await prisma.enrollment.findFirst({
            where: { userId, courseId },
        });
        if (existing) {
            throw new AppError('Already enrolled in this course', 400);
        }
        // Create enrollment
        const enrollment = new Enrollment({ userId, courseId });
        const saved = await enrollment.save();
        // Add user to course chat room if course has one
        if (course.chatRoomId) {
            await prisma.chatRoomMember.create({
                data: {
                    roomId: course.chatRoomId,
                    userId,
                    role: 'member',
                },
            });
        }
        return saved;
    }
    async getMyEnrollments(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [enrollments, total] = await prisma.$transaction([
            prisma.enrollment.findMany({
                skip,
                take: limit,
                where: { userId },
                orderBy: { enrolledAt: 'desc' },
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                            slug: true,
                            thumbnailUrl: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.enrollment.count({ where: { userId } }),
        ]);
        return {
            enrollments: enrollments.map(e => new Enrollment(e)),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getById(id) {
        const enrollment = await prisma.enrollment.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, name: true, email: true, avatarUrl: true }
                },
                course: {
                    select: { id: true, title: true, slug: true, thumbnailUrl: true }
                }
            }
        });
        if (!enrollment) {
            throw new AppError('Enrollment not found', 404);
        }
        return new Enrollment(enrollment);
    }
    async updateProgress(id, progress, userId) {
        // Validate progress
        if (progress < 0 || progress > 100) {
            throw new AppError('Progress must be between 0 and 100', 400);
        }
        const enrollment = await prisma.enrollment.findUnique({ where: { id } });
        if (!enrollment) {
            throw new AppError('Enrollment not found', 404);
        }
        // Check ownership
        if (enrollment.userId !== userId) {
            throw new AppError('Not authorized', 403);
        }
        const updated = await prisma.enrollment.update({
            where: { id },
            data: { progress, updatedAt: new Date() },
            include: {
                course: {
                    select: { id: true, title: true, slug: true, thumbnailUrl: true }
                }
            }
        });
        return new Enrollment(updated);
    }
    async completeLesson(id, lessonId, userId) {
        const enrollment = await prisma.enrollment.findUnique({ where: { id } });
        if (!enrollment) {
            throw new AppError('Enrollment not found', 404);
        }
        // Check ownership
        if (enrollment.userId !== userId) {
            throw new AppError('Not authorized', 403);
        }
        // Update progress - in a real app, this would calculate based on completed lessons
        // For now, we'll just increment by a fixed amount or set to 100 if it's the last lesson
        const updated = await prisma.enrollment.update({
            where: { id },
            data: {
                progress: Math.min(100, enrollment.progress + 10), // Simple increment
                updatedAt: new Date(),
            },
            include: {
                course: {
                    select: { id: true, title: true, slug: true, thumbnailUrl: true }
                }
            }
        });
        return new Enrollment(updated);
    }
    async getCourseEnrollments(courseId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [enrollments, total] = await prisma.$transaction([
            prisma.enrollment.findMany({
                skip,
                take: limit,
                where: { courseId },
                orderBy: { enrolledAt: 'desc' },
                include: {
                    user: {
                        select: { id: true, name: true, email: true, avatarUrl: true }
                    },
                },
            }),
            prisma.enrollment.count({ where: { courseId } }),
        ]);
        return {
            enrollments: enrollments.map(e => new Enrollment(e)),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }
}
//# sourceMappingURL=enrollment.service.js.map