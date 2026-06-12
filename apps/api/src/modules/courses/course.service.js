import { prisma } from '../../server';
import { Course } from './course.model';
import { AppError } from '../../middleware/errorHandler';
export class CourseService {
    async getAll(options = {}) {
        const skip = (options.page ?? 1 - 1) * (options.limit ?? 10);
        const take = options.limit ?? 10;
        const where = {};
        if (options.instructorId)
            where.instructorId = options.instructorId;
        if (options.level)
            where.level = options.level;
        if (options.language)
            where.language = options.language;
        if (options.status)
            where.status = options.status;
        if (options.search) {
            where.OR = [
                { title: { contains: options.search, mode: 'insensitive' } },
                { description: { contains: options.search, mode: 'insensitive' } },
            ];
        }
        const [courses, total] = await prisma.$transaction([
            prisma.course.findMany({
                skip,
                take,
                where,
                select: {
                    id: true,
                    instructorId: true,
                    title: true,
                    slug: true,
                    description: true,
                    thumbnailUrl: true,
                    categoryId: true,
                    price: true,
                    currency: true,
                    level: true,
                    language: true,
                    status: true,
                    chatRoomId: true,
                    createdAt: true,
                    updatedAt: true,
                    publishedAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.course.count({ where }),
        ]);
        return {
            courses: courses.map(c => new Course(c)),
            pagination: {
                page: options.page ?? 1,
                limit: options.limit ?? 10,
                total,
                pages: Math.ceil(total / (options.limit ?? 10)),
            },
        };
    }
    async getById(id) {
        const course = await prisma.course.findUnique({
            where: { id },
            select: {
                id: true,
                instructorId: true,
                title: true,
                slug: true,
                description: true,
                thumbnailUrl: true,
                categoryId: true,
                price: true,
                currency: true,
                level: true,
                language: true,
                status: true,
                chatRoomId: true,
                createdAt: true,
                updatedAt: true,
                publishedAt: true,
            },
        });
        if (!course) {
            throw new AppError('Course not found', 404);
        }
        return new Course(course);
    }
    async getBySlug(slug) {
        const course = await prisma.course.findUnique({
            where: { slug },
            select: {
                id: true,
                instructorId: true,
                title: true,
                slug: true,
                description: true,
                thumbnailUrl: true,
                categoryId: true,
                price: true,
                currency: true,
                level: true,
                language: true,
                status: true,
                chatRoomId: true,
                createdAt: true,
                updatedAt: true,
                publishedAt: true,
            },
        });
        if (!course) {
            throw new AppError('Course not found', 404);
        }
        return new Course(course);
    }
    async create(data, instructorId) {
        // Check if slug already exists
        const existing = await prisma.course.findUnique({ where: { slug: data.slug } });
        if (existing) {
            throw new AppError('Course with this slug already exists', 400);
        }
        const course = new Course({
            ...data,
            instructorId,
        });
        return await course.save();
    }
    async update(id, data, userId) {
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) {
            throw new AppError('Course not found', 404);
        }
        // Check ownership
        if (course.instructorId !== userId) {
            throw new AppError('Not authorized to update this course', 403);
        }
        // Check if slug is being changed and already exists
        if (data.slug && data.slug !== course.slug) {
            const existing = await prisma.course.findUnique({ where: { slug: data.slug } });
            if (existing) {
                throw new AppError('Course with this slug already exists', 400);
            }
        }
        const updatedCourse = await prisma.course.update({
            where: { id },
            data,
            select: {
                id: true,
                instructorId: true,
                title: true,
                slug: true,
                description: true,
                thumbnailUrl: true,
                categoryId: true,
                price: true,
                currency: true,
                level: true,
                language: true,
                status: true,
                chatRoomId: true,
                createdAt: true,
                updatedAt: true,
                publishedAt: true,
            },
        });
        return new Course(updatedCourse);
    }
    async delete(id, userId) {
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) {
            throw new AppError('Course not found', 404);
        }
        // Check ownership
        if (course.instructorId !== userId) {
            throw new AppError('Not authorized to delete this course', 403);
        }
        await prisma.course.delete({ where: { id } });
    }
    async publish(id, userId) {
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course) {
            throw new AppError('Course not found', 404);
        }
        // Check ownership
        if (course.instructorId !== userId) {
            throw new AppError('Not authorized to publish this course', 403);
        }
        // Create chat room for the course
        const chatRoom = await prisma.chatRoom.create({
            data: {
                roomId: `course-${id}`,
                name: course.title,
                type: 'group',
                ownerId: userId,
            },
        });
        // Update course with chat room ID and publish
        const publishedCourse = await prisma.course.update({
            where: { id },
            data: {
                status: 'PUBLISHED',
                publishedAt: new Date(),
                chatRoomId: chatRoom.id,
            },
            select: {
                id: true,
                instructorId: true,
                title: true,
                slug: true,
                description: true,
                thumbnailUrl: true,
                categoryId: true,
                price: true,
                currency: true,
                level: true,
                language: true,
                status: true,
                chatRoomId: true,
                createdAt: true,
                updatedAt: true,
                publishedAt: true,
            },
        });
        return new Course(publishedCourse);
    }
}
//# sourceMappingURL=course.service.js.map