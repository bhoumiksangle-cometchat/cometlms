import bcrypt from 'bcryptjs';
import { prisma } from '../../server';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/errorHandler';
export class AuthService {
    async register(data) {
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
    async login(data) {
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
    async logout(_userId) {
        // In a real app, invalidate the token or add to a blacklist
        return;
    }
    async refresh(refreshToken) {
        try {
            const decoded = verifyRefreshToken(refreshToken);
            const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
            if (!user) {
                throw new AppError('User not found', 401);
            }
            const newAccessToken = generateToken(user.id);
            const newRefreshToken = generateRefreshToken(user.id);
            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        }
        catch {
            throw new AppError('Invalid refresh token', 401);
        }
    }
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
}
//# sourceMappingURL=auth.service.js.map