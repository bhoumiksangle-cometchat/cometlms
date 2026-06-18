import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middleware/auth';
import { createDevUser, findDevUserByEmail, findDevUserById, isDevAuthStoreEnabled, toPublicDevUser } from './devAuthStore';

export const authRoutes = Router();

// Strip the bcrypt password hash (and any other server-only fields) before
// serializing a User row out over the wire. Used by every auth response.
type AnyUser = Record<string, unknown> & { passwordHash?: unknown };
function toPublicUser<T extends AnyUser | null | undefined>(user: T): Omit<NonNullable<T>, 'passwordHash'> | null {
  if (!user) return null;
  const { passwordHash: _omit, ...rest } = user as AnyUser;
  return rest as Omit<NonNullable<T>, 'passwordHash'>;
}

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

function createTokens(user: { id: string; role: string }) {
  const secret = process.env.JWT_SECRET ?? 'dev-secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET ?? `${secret}-refresh`;

  return {
    accessToken: jwt.sign({ role: user.role }, secret, { subject: user.id, expiresIn: '15m' }),
    refreshToken: jwt.sign({ role: user.role }, refreshSecret, { subject: user.id, expiresIn: '30d' }),
  };
}

authRoutes.post('/dev-bypass-login', async (req, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']) }).parse(req.body);
    const email = `${role.toLowerCase()}@learnloop.test`;
    const name = `Test ${role.charAt(0) + role.slice(1).toLowerCase()}`;

    let user;
    if (isDevAuthStoreEnabled()) {
      user = findDevUserByEmail(email);
      if (!user) {
        user = await createDevUser({
          email,
          password: 'Password123',
          name,
          role: role === 'ADMIN' ? 'INSTRUCTOR' : role
        });
        user.role = role as any;
      }
    } else {
      user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        const passwordHash = await bcrypt.hash('Password123', 12);
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            name,
            role,
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        user: isDevAuthStoreEnabled() ? toPublicDevUser(user as any) : toPublicUser(user as any),
        tokens: createTokens(user),
      },
    });
  } catch (error) {
    next(error);
  }
});

authRoutes.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);

    if (isDevAuthStoreEnabled()) {
      const user = await createDevUser(input);
      res.status(201).json({ success: true, data: { user: toPublicDevUser(user), tokens: createTokens(user) } });
      return;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role ?? 'STUDENT',
      },
    });

    res.status(201).json({ success: true, data: { user: toPublicUser(user), tokens: createTokens(user) } });
  } catch (error) {
    next(error);
  }
});

authRoutes.post('/login', async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);

    if (isDevAuthStoreEnabled()) {
      const user = findDevUserByEmail(input.email);

      if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      res.json({ success: true, data: { user: toPublicDevUser(user), tokens: createTokens(user) } });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    res.json({ success: true, data: { user: toPublicUser(user), tokens: createTokens(user) } });
  } catch (error) {
    next(error);
  }
});

authRoutes.get('/me', requireAuth, async (req, res, next) => {
  try {
    if (isDevAuthStoreEnabled()) {
      const user = findDevUserById(req.user!.id);
      res.json({ success: true, data: user ? toPublicDevUser(user) : null });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    res.json({ success: true, data: toPublicUser(user) });
  } catch (error) {
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
    const payload = jwt.verify(refreshToken, secret) as jwt.JwtPayload & { role: string };

    res.json({
      success: true,
      data: createTokens({ id: payload.sub!, role: payload.role }),
    });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});
