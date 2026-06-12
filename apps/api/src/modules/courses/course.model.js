import { prisma } from '../../server';
export class Course {
    id;
    instructorId;
    title;
    slug;
    description;
    thumbnailUrl;
    categoryId;
    price;
    currency;
    level;
    language;
    status;
    chatRoomId;
    createdAt;
    updatedAt;
    publishedAt;
    constructor(data) {
        this.id = data.id || crypto.randomUUID();
        this.instructorId = data.instructorId;
        this.title = data.title;
        this.slug = data.slug;
        this.description = data.description;
        this.thumbnailUrl = data.thumbnailUrl;
        this.categoryId = data.categoryId;
        this.price = data.price;
        this.currency = data.currency;
        this.level = data.level;
        this.language = data.language;
        this.status = data.status || 'DRAFT';
        this.chatRoomId = data.chatRoomId;
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = data.updatedAt || new Date();
        this.publishedAt = data.publishedAt;
    }
    async save() {
        const course = await prisma.course.upsert({
            where: { id: this.id },
            update: {
                instructorId: this.instructorId,
                title: this.title,
                slug: this.slug,
                description: this.description,
                thumbnailUrl: this.thumbnailUrl,
                categoryId: this.categoryId,
                price: this.price,
                currency: this.currency,
                level: this.level,
                language: this.language,
                status: this.status,
                chatRoomId: this.chatRoomId,
                publishedAt: this.publishedAt,
                updatedAt: this.updatedAt = new Date(),
            },
            create: {
                id: this.id,
                instructorId: this.instructorId,
                title: this.title,
                slug: this.slug,
                description: this.description,
                thumbnailUrl: this.thumbnailUrl,
                categoryId: this.categoryId,
                price: this.price,
                currency: this.currency,
                level: this.level,
                language: this.language,
                status: this.status,
                chatRoomId: this.chatRoomId,
                createdAt: this.createdAt,
                updatedAt: this.updatedAt,
                publishedAt: this.publishedAt,
            },
        });
        Object.assign(this, course);
        return this;
    }
    static async findById(id) {
        const course = await prisma.course.findUnique({ where: { id } });
        if (!course)
            return null;
        return new Course(course);
    }
    static async findBySlug(slug) {
        const course = await prisma.course.findUnique({ where: { slug } });
        if (!course)
            return null;
        return new Course(course);
    }
    static async findMany(options = {}) {
        const where = {};
        if (options.where) {
            Object.assign(where, options.where);
        }
        if (options.search) {
            where.OR = [
                { title: { contains: options.search, mode: 'insensitive' } },
                { description: { contains: options.search, mode: 'insensitive' } },
            ];
        }
        const courses = await prisma.course.findMany({
            skip: options.skip,
            take: options.take,
            where,
            orderBy: options.orderBy ?? { createdAt: 'desc' },
        });
        return courses.map(c => new Course(c));
    }
    static async count(options = {}) {
        const where = {};
        if (options.where) {
            Object.assign(where, options.where);
        }
        if (options.search) {
            where.OR = [
                { title: { contains: options.search, mode: 'insensitive' } },
                { description: { contains: options.search, mode: 'insensitive' } },
            ];
        }
        return await prisma.course.count({ where });
    }
    static async delete(id) {
        const result = await prisma.course.delete({ where: { id } });
        return !!result;
    }
    toJSON() {
        const { ...safeCourse } = this;
        return safeCourse;
    }
}
//# sourceMappingURL=course.model.js.map