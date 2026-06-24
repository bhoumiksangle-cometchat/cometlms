// Canonical application seed.
// All future seed data should be added here.
// Bot-specific configuration remains in prisma/seed-bots.ts.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users with hashed passwords
  const password = 'Password123';
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create student
  const student = await prisma.user.upsert({
    where: { email: 'student@learnloop.test' },
    update: {},
    create: {
      email: 'student@learnloop.test',
      passwordHash: hashedPassword,
      name: 'Test Student',
      role: 'STUDENT',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Created student:', student.email);

  // Create instructor
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@learnloop.test' },
    update: {},
    create: {
      email: 'instructor@learnloop.test',
      passwordHash: hashedPassword,
      name: 'Test Instructor',
      role: 'INSTRUCTOR',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Created instructor:', instructor.email);

  // Create admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@learnloop.test' },
    update: {},
    create: {
      email: 'admin@learnloop.test',
      passwordHash: hashedPassword,
      name: 'Test Admin',
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
    },
  });
  console.log('✅ Created admin:', admin.email);

  const bulkUsers = [
    ...Array.from({ length: 85 }, (_, i) => ({
      email: `student${i + 1}@learnloop.test`,
      name: `Student ${i + 1}`,
      role: 'STUDENT',
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      email: `instructor${i + 1}@learnloop.test`,
      name: `Instructor ${i + 1}`,
      role: 'INSTRUCTOR',
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      email: `admin${i + 1}@learnloop.test`,
      name: `Admin ${i + 1}`,
      role: 'ADMIN',
    })),
  ];

  for (const user of bulkUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        passwordHash: hashedPassword,
        name: user.name,
        role: user.role as any,
        isActive: true,
        isVerified: true,
      },
    });
  }

  console.log(`✅ Seeded ${bulkUsers.length} additional users`);

  // Create categories
  const webDevCategory = await prisma.category.upsert({
    where: { name: 'Web Development' },
    update: {},
    create: {
      name: 'Web Development',
      description: 'Learn web development technologies',
    },
  });

  const backendCategory = await prisma.category.upsert({
    where: { name: 'Backend Development' },
    update: {},
    create: {
      name: 'Backend Development',
      description: 'Learn backend technologies',
    },
  });
  console.log('✅ Created categories');

  // Create sample courses
  const reactCourse = await prisma.course.upsert({
    where: { slug: 'react-foundations' },
    update: {},
    create: {
      title: 'React Foundations for Product Teams',
      slug: 'react-foundations',
      description: 'Build modern UIs with React 18, hooks, context, and form libraries. Includes real-world projects.',
      instructorId: instructor.id,
      categoryId: webDevCategory.id,
      price: 0,
      currency: 'USD',
      status: 'PUBLISHED',
      level: 'BEGINNER',
      language: 'English',
      publishedAt: new Date(),
    },
  });
  console.log('✅ Created React course');

  const nodeCourse = await prisma.course.upsert({
    where: { slug: 'production-node-apis' },
    update: {},
    create: {
      title: 'Production Node.js APIs',
      slug: 'production-node-apis',
      description: 'Build scalable REST and WebSocket APIs with Express, Prisma, authentication, and deployment.',
      instructorId: instructor.id,
      categoryId: backendCategory.id,
      price: 4999,
      currency: 'USD',
      status: 'PUBLISHED',
      level: 'INTERMEDIATE',
      language: 'English',
      publishedAt: new Date(),
    },
  });
  console.log('✅ Created Node.js course');

  // Set CometChat group IDs for courses (groups are created in CometChat on publish)
  await prisma.course.update({
    where: { id: reactCourse.id },
    data: { cometchatGroupId: `course-${reactCourse.id}` },
  });

  await prisma.course.update({
    where: { id: nodeCourse.id },
    data: { cometchatGroupId: `course-${nodeCourse.id}` },
  });

  console.log('✅ Set CometChat group IDs for courses');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Test accounts:');
  console.log('   Student:    student@learnloop.test / Password123');
  console.log('   Instructor: instructor@learnloop.test / Password123');
  console.log('   Admin:      admin@learnloop.test / Password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
