import { prisma } from '../../server';

export class Course {
  id: string;
  instructorId: string;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl?: string;
  categoryId: string;
  price: number;
  currency: string;
  level: string;
  language: string;
  status: string;
  chatRoomId?: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;

  constructor(data: Partial<Course> & {
    instructorId: string;
    title: string;
    slug: string;
    description: string;
    categoryId: string;
    price: number;
    currency: string;
    level: string;
    language: string;
  }) {
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

  async save(): Promise<Course> {
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

  static async findById(id: string): Promise<Course | null> {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) return null;
    return new Course(course);
  }

  static async findBySlug(slug: string): Promise<Course | null> {
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course) return null;
    return new Course(course);
  }

  static async findMany(options: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
    search?: string;
  } = {}): Promise<Course[]> {
    const where: any = {};
    
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

  static async count(options: { where?: any; search?: string } = {}): Promise<number> {
    const where: any = {};
    
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

  static async delete(id: string): Promise<boolean> {
    const result = await prisma.course.delete({ where: { id } });
    return !!result;
  }

  toJSON() {
    const {
      ...safeCourse
    } = this;
    return safeCourse;
  }
}