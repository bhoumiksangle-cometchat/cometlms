import { prisma } from '../../server';
import { AppError } from '../../middleware/errorHandler';
export class UserService {
    async getProfile(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                bio: true,
                role: true,
                isActive: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            throw new AppError('User not found', 404);
        }
        return user;
    }
    async updateProfile(userId, data) {
        const user = await prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                bio: true,
                role: true,
                isActive: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return user;
    }
    async getAll(options = {}) {
        const skip = (options.page ?? 1 - 1) * (options.limit ?? 10);
        const take = options.limit ?? 10;
        const where = {};
        if (options.role)
            where.role = options.role;
        if (options.isActive !== undefined)
            where.isActive = options.isActive;
        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                skip,
                take,
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    bio: true,
                    role: true,
                    isActive: true,
                    isVerified: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);
        return {
            users,
            pagination: {
                page: options.page ?? 1,
                limit: options.limit ?? 10,
                total,
                pages: Math.ceil(total / (options.limit ?? 10)),
            },
        };
    }
    async getById(id) {
        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                bio: true,
                role: true,
                isActive: true,
                isVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            throw new AppError('User not found', 404);
        }
        return user;
    }
    async deactivate(id) {
        const user = await prisma.user.update({
            where: { id },
            data: { isActive: false },
            select: { id: true, email: true, name: true },
        });
        return user;
    }
}
//# sourceMappingURL=user.service.js.map