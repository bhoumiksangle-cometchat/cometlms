import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../server';
import { requireAuth } from '../../middleware/auth';
export const authRoutes = Router();
const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    role: z.enum(['STUDENT', 'INSTRUCTOR']).optional(),
});
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
function createTokens(user) {
    const secret = process.env.JWT_SECRET ?? 'dev-secret';
    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? `${secret}-refresh`;
    return {
        accessToken: jwt.sign({ role: user.role }, secret, { subject: user.id, expiresIn: '15m' }),
        refreshToken: jwt.sign({ role: user.role }, refreshSecret, { subject: user.id, expiresIn: '30d' }),
    };
}
authRoutes.post('/register', async (req, res, next) => {
    try {
        const input = registerSchema.parse(req.body);
        const passwordHash = await bcrypt.hash(input.password, 12);
        const user = await prisma.user.create({
            data: {
                email: input.email,
                passwordHash,
                name: input.name,
                role: input.role ?? 'STUDENT',
            },
        });
        res.status(201).json({ success: true, data: { user, tokens: createTokens(user) } });
    }
    catch (error) {
        next(error);
    }
});
authRoutes.post('/login', async (req, res, next) => {
    try {
        const input = loginSchema.parse(req.body);
        const user = await prisma.user.findUnique({ where: { email: input.email } });
        if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
            res.status(401).json({ success: false, error: 'Invalid email or password' });
            return;
        }
        res.json({ success: true, data: { user, tokens: createTokens(user) } });
    }
    catch (error) {
        next(error);
    }
});
authRoutes.get('/me', requireAuth, async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        res.json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
});
authRoutes.post('/logout', requireAuth, (_req, res) => {
    res.json({ success: true });
});
authRoutes.post('/refresh', (req, res) => {
    try {
        const refreshToken = z.object({ refreshToken: z.string() }).parse(req.body).refreshToken;
        const secret = process.env.JWT_REFRESH_SECRET ?? `${process.env.JWT_SECRET ?? 'dev-secret'}-refresh`;
        const payload = jwt.verify(refreshToken, secret);
        res.json({
            success: true,
            data: createTokens({ id: payload.sub, role: payload.role }),
        });
    }
    catch {
        res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
});
//# sourceMappingURL=auth.routes.js.map