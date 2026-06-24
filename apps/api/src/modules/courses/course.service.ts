import { prisma } from '../../server';
import { Course } from './course.model';
import { AppError } from '../../middleware/errorHandler';
import { cometChatService } from '../../services/cometchat.service';

export class CourseService {
  public async getAll(options: {
    page?: number;
    limit?: number;
    search?: string;
    level?: string;
    language?: string;
    status?: string;
    instructorId?: string;
  } = {}) {
    const skip = (options.page ?? 1 - 1) * (options.limit ?? 10);
    const take = options.limit ?? 10;

    const where: any = {};
    
    if (options.instructorId) where.instructorId = options.instructorId;
    if (options.level) where.level = options.level;
    if (options.language) where.language = options.language;
    if (options.status) where.status = options.status;
    
    if (options.search) {
      where.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [courses, total] = await prisma.$transaction([
      prisma.course.findMany({
        skip,
        take,
        where,
        select: {
          id: true,
          instructorId: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          categoryId: true,
          price: true,
          currency: true,
          level: true,
          language: true,
          status: true,
          cometchatGroupId: true,
          createdAt: true,
          updatedAt: true,
          publishedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.course.count({ where }),
    ]);

    return {
      courses: courses.map(c => new Course(c)),
      pagination: {
        page: options.page ?? 1,
        limit: options.limit ?? 10,
        total,
        pages: Math.ceil(total / (options.limit ?? 10)),
      },
    };
  }

  public async getById(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        id: true,
        instructorId: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        categoryId: true,
        price: true,
        currency: true,
        level: true,
        language: true,
        status: true,
        cometchatGroupId: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    return new Course(course);
  }

  public async getBySlug(slug: string) {
    const course = await prisma.course.findUnique({
      where: { slug },
      select: {
        id: true,
        instructorId: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        categoryId: true,
        price: true,
        currency: true,
        level: true,
        language: true,
        status: true,
        cometchatGroupId: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    return new Course(course);
  }

  public async create(data: Partial<Course>, instructorId: string) {
    // Check if slug already exists
    const existing = await prisma.course.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new AppError('Course with this slug already exists', 400);
    }

    const course = new Course({
      ...data,
      instructorId,
    });

    return await course.save();
  }

  public async update(id: string, data: Partial<Course>, userId: string) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Check ownership
    if (course.instructorId !== userId) {
      throw new AppError('Not authorized to update this course', 403);
    }

    // Check if slug is being changed and already exists
    if (data.slug && data.slug !== course.slug) {
      const existing = await prisma.course.findUnique({ where: { slug: data.slug } });
      if (existing) {
        throw new AppError('Course with this slug already exists', 400);
      }
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data,
      select: {
        id: true,
        instructorId: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        categoryId: true,
        price: true,
        currency: true,
        level: true,
        language: true,
        status: true,
        cometchatGroupId: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    return new Course(updatedCourse);
  }

  public async delete(id: string, userId: string) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Check ownership
    if (course.instructorId !== userId) {
      throw new AppError('Not authorized to delete this course', 403);
    }

    await prisma.course.delete({ where: { id } });
  }

  public async publish(id: string, userId: string) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Check ownership
    if (course.instructorId !== userId) {
      throw new AppError('Not authorized to publish this course', 403);
    }

    // Create CometChat group for the course discussion
    const groupGuid = `course-${id}`;
    try {
      await cometChatService.createGroup({
        guid: groupGuid,
        name: course.title,
        type: 'public',
      });
    } catch (err: any) {
      // Group may already exist if course was previously published
      if (!err?.message?.includes('already exists')) {
        console.warn('[CourseService] Failed to create CometChat group:', err);
      }
    }

    // Update course with CometChat group ID and publish
    const publishedCourse = await prisma.course.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        cometchatGroupId: groupGuid,
      },
      select: {
        id: true,
        instructorId: true,
        title: true,
        slug: true,
        description: true,
        thumbnailUrl: true,
        categoryId: true,
        price: true,
        currency: true,
        level: true,
        language: true,
        status: true,
        cometchatGroupId: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
      },
    });

    return new Course(publishedCourse);
  }
}