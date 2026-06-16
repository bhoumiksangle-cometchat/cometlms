import { prisma } from '../../server';

export class User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  pushNotificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<User> & { email: string; passwordHash: string; name: string }) {
    this.id = data.id || crypto.randomUUID();
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.name = data.name;
    this.avatarUrl = data.avatarUrl;
    this.bio = data.bio;
    this.role = data.role || 'STUDENT';
    this.isActive = data.isActive ?? true;
    this.isVerified = data.isVerified ?? false;
    this.pushNotificationsEnabled = data.pushNotificationsEnabled ?? true;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async comparePassword(password: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, this.passwordHash);
  }

  async save(): Promise<User> {
    const user = await prisma.user.upsert({
      where: { id: this.id },
      update: {
        email: this.email,
        name: this.name,
        avatarUrl: this.avatarUrl,
        bio: this.bio,
        role: this.role,
        isActive: this.isActive,
        isVerified: this.isVerified,
        updatedAt: this.updatedAt = new Date(),
      },
      create: {
        id: this.id,
        email: this.email,
        passwordHash: this.passwordHash,
        name: this.name,
        avatarUrl: this.avatarUrl,
        bio: this.bio,
        role: this.role,
        isActive: this.isActive,
        isVerified: this.isVerified,
      },
    });

    // Update instance with saved data
    Object.assign(this, user);
    return this;
  }

  static async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return new User(user);
  }

  static async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    return new User(user);
  }

  static async findMany(options: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  } = {}): Promise<User[]> {
    const users = await prisma.user.findMany({
      skip: options.skip,
      take: options.take,
      where: options.where,
      orderBy: options.orderBy,
    });
    return users.map(u => new User(u));
  }

  static async delete(id: string): Promise<boolean> {
    const result = await prisma.user.delete({ where: { id } });
    return !!result;
  }

  toJSON() {
    const {
      passwordHash,
      ...safeUser
    } = this;
    return safeUser;
  }
}