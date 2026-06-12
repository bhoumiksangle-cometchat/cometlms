import { prisma } from '../../server';
import { User } from './user.model';
import { AppError } from '../../middleware/errorHandler';

export class UserService {
  public async getProfile(userId: string) {
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

  public async updateProfile(userId: string, data: Partial<{
    name: string;
    avatarUrl: string;
    bio: string;
  }>) {
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

  public async getAll(options: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
  } = {}) {
    const skip = (options.page ?? 1 - 1) * (options.limit ?? 10);
    const take = options.limit ?? 10;

    const where: any = {};
    if (options.role) where.role = options.role;
    if (options.isActive !== undefined) where.isActive = options.isActive;

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

  public async getById(id: string) {
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

  public async deactivate(id: string) {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, name: true },
    });

    return user;
  }
}