import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { findDevUserById, isDevAuthStoreEnabled } from '../modules/auth/devAuthStore';

type JwtPayload = {
  sub: string;
  role: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: string;
    };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET ?? 'dev-secret') as JwtPayload;

    if (isDevAuthStoreEnabled()) {
      const user = findDevUserById(payload.sub);

      if (!user?.isActive) {
        res.status(401).json({ success: false, error: 'User is not active' });
        return;
      }

      req.user = { id: user.id, role: user.role };
      next();
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, isActive: true },
    });

    if (!user?.isActive) {
      res.status(401).json({ success: false, error: 'User is not active' });
      return;
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
