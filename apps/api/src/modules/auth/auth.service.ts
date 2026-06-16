import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/errorHandler';

export class AuthService {
  public async register(data: { email: string; password: string; name: string; role?: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('Email already registered', 400);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role || 'STUDENT',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return { user, accessToken, refreshToken };
  }

  public async login(data: { email: string; password: string }) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const accessToken = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      accessToken,
      refreshToken,
    };
  }

  public async logout(_userId: string): Promise<void> {
    // In a real app, invalidate the token or add to a blacklist
    return;
  }

  public async refresh(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw new AppError('User not found', 401);
      }

      const newAccessToken = generateToken(user.id);
      const newRefreshToken = generateRefreshToken(user.id);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
  }

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
        pushNotificationsEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }
}