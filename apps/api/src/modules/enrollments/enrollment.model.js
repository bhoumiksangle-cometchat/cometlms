import { prisma } from '../../server';
export class Enrollment {
    id;
    userId;
    courseId;
    enrolledAt;
    completedAt;
    progress; // 0-100
    constructor(data) {
        this.id = data.id || crypto.randomUUID();
        this.userId = data.userId;
        this.courseId = data.courseId;
        this.enrolledAt = data.enrolledAt || new Date();
        this.completedAt = data.completedAt;
        this.progress = data.progress ?? 0;
    }
    async save() {
        const enrollment = await prisma.enrollment.upsert({
            where: { id: this.id },
            update: {
                userId: this.userId,
                courseId: this.courseId,
                enrolledAt: this.enrolledAt,
                completedAt: this.completedAt,
                progress: this.progress,
                updatedAt: new Date(),
            },
            create: {
                id: this.id,
                userId: this.userId,
                courseId: this.courseId,
                enrolledAt: this.enrolledAt,
                completedAt: this.completedAt,
                progress: this.progress,
            },
        });
        Object.assign(this, enrollment);
        return this;
    }
    static async findById(id) {
        const enrollment = await prisma.enrollment.findUnique({ where: { id } });
        if (!enrollment)
            return null;
        return new Enrollment(enrollment);
    }
    static async findByUserAndCourse(userId, courseId) {
        const enrollment = await prisma.enrollment.findFirst({
            where: { userId, courseId },
        });
        if (!enrollment)
            return null;
        return new Enrollment(enrollment);
    }
    static async findMany(options = {}) {
        const enrollments = await prisma.enrollment.findMany({
            skip: options.skip,
            take: options.take,
            where: options.where,
            orderBy: options.orderBy ?? { enrolledAt: 'desc' },
            include: {
                user: {
                    select: { id: true, name: true, email: true, avatarUrl: true }
                },
                course: {
                    select: { id: true, title: true, slug: true, thumbnailUrl: true }
                }
            }
        });
        return enrollments.map(e => new Enrollment(e));
    }
    static async count(options = {}) {
        return await prisma.enrollment.count({ where: options.where });
    }
    static async delete(id) {
        const result = await prisma.enrollment.delete({ where: { id } });
        return !!result;
    }
    toJSON() {
        const { ...safeEnrollment } = this;
        return safeEnrollment;
    }
}
//# sourceMappingURL=enrollment.model.js.map