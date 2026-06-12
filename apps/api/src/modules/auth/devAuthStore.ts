import bcrypt from 'bcryptjs';

export type DevAuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR';
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const users = new Map<string, DevAuthUser>();

export function isDevAuthStoreEnabled() {
  return !process.env.DATABASE_URL;
}

export async function createDevUser(input: { email: string; password: string; name: string; role?: 'STUDENT' | 'INSTRUCTOR' }) {
  if (users.has(input.email)) {
    const error = new Error('Email is already registered') as Error & { statusCode?: number };
    error.statusCode = 409;
    throw error;
  }

  const now = new Date();
  const user: DevAuthUser = {
    id: crypto.randomUUID(),
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
    name: input.name,
    role: input.role ?? 'STUDENT',
    isActive: true,
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.email, user);
  return user;
}

export function findDevUserByEmail(email: string) {
  return users.get(email) ?? null;
}

export function findDevUserById(id: string) {
  return [...users.values()].find((user) => user.id === id) ?? null;
}

export function toPublicDevUser(user: DevAuthUser) {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

// ---------------------------------------------------------------------------
// Pre-seeded accounts — available immediately after every server restart.
// Password for all accounts: Password123
// ---------------------------------------------------------------------------
const SEED_PASSWORD = 'Password123';

async function seedDevUsers() {
  const seeds: Array<{ email: string; name: string; role: 'STUDENT' | 'INSTRUCTOR' }> = [
    { email: 'student@learnloop.test',    name: 'Test Student',    role: 'STUDENT'    },
    { email: 'instructor@learnloop.test', name: 'Test Instructor', role: 'INSTRUCTOR' },
    { email: 'admin@learnloop.test',      name: 'Test Admin',      role: 'INSTRUCTOR' }, // admin role patched below
  ];

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const now = new Date();

  for (const seed of seeds) {
    if (!users.has(seed.email)) {
      users.set(seed.email, {
        id: crypto.randomUUID(),
        email: seed.email,
        passwordHash,
        name: seed.name,
        role: seed.role,
        isActive: true,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Patch admin role so JWT contains ADMIN
  const admin = users.get('admin@learnloop.test');
  if (admin) (admin as any).role = 'ADMIN';

  console.log('[DevAuthStore] Seeded dev accounts: student@, instructor@, admin@ (password: Password123)');
}

// Fire immediately — non-blocking
seedDevUsers().catch(console.error);
