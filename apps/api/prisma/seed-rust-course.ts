/**
 * Seed: Rust Systems Programming course + sections/lessons for all existing courses.
 * Run inside the API container:
 *   npx tsx prisma/seed-rust-course.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── helpers ────────────────────────────────────────────────────────────────────
async function upsertSectionWithLessons(
  courseId: string,
  sectionData: { title: string; description: string; order: number },
  lessons: { title: string; description: string; videoUrl: string; duration: number; order: number; isFree: boolean }[],
) {
  const existing = await prisma.section.findFirst({
    where: { courseId, order: sectionData.order },
  });
  if (existing) return existing;
  return prisma.section.create({
    data: { ...sectionData, courseId, lessons: { create: lessons } },
    include: { lessons: true },
  });
}

// ── main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Running full course seed...\n');

  // ── prerequisite users ──────────────────────────────────────────────────────
  const instructor = await prisma.user.findUniqueOrThrow({
    where: { email: 'instructor@learnloop.test' },
  });
  const student = await prisma.user.findUniqueOrThrow({
    where: { email: 'student@learnloop.test' },
  });

  // ── categories ──────────────────────────────────────────────────────────────
  const backendCat = await prisma.category.findUniqueOrThrow({ where: { name: 'Backend Development' } });
  const webDevCat  = await prisma.category.findUniqueOrThrow({ where: { name: 'Web Development' } });
  const sysCat = await prisma.category.upsert({
    where:  { name: 'Systems Programming' },
    update: {},
    create: { name: 'Systems Programming', description: 'Low-level, performant, and safe systems software' },
  });
  console.log('✅ Categories ready');

  // ════════════════════════════════════════════════════════════════════════════
  // 1.  ADD SECTIONS + LESSONS TO REACT COURSE
  // ════════════════════════════════════════════════════════════════════════════
  const reactCourse = await prisma.course.findUniqueOrThrow({ where: { slug: 'react-foundations' } });

  await upsertSectionWithLessons(
    reactCourse.id,
    { title: 'Getting Started with React', description: 'Install React, understand JSX, and build your first component.', order: 0 },
    [
      { title: 'Introduction to React', description: 'Why React? Overview of the component model, JSX, and the virtual DOM.', videoUrl: 'https://www.youtube.com/watch?v=Tn6-PIqc4UM', duration: 900,  order: 0, isFree: true  },
      { title: 'JSX and Component Basics', description: 'Learn JSX syntax, create function components, and understand props.', videoUrl: 'https://www.youtube.com/watch?v=SqcY0GlETPk', duration: 1200, order: 1, isFree: true  },
      { title: 'Props and State', description: 'Pass data between components with props; manage local state with useState.', videoUrl: 'https://www.youtube.com/watch?v=35lXWvCuM8o', duration: 1500, order: 2, isFree: false },
    ],
  );

  await upsertSectionWithLessons(
    reactCourse.id,
    { title: 'Hooks Deep Dive', description: 'Master useState, useEffect, useContext, and custom hooks.', order: 1 },
    [
      { title: 'useState and useEffect', description: 'Manage state and synchronise side-effects with hooks.', videoUrl: 'https://www.youtube.com/watch?v=O6P86uwfdR0', duration: 1800, order: 0, isFree: false },
      { title: 'Custom Hooks', description: 'Extract and reuse stateful logic with your own hooks.', videoUrl: 'https://www.youtube.com/watch?v=6ThXsUwLWvc', duration: 1200, order: 1, isFree: false },
    ],
  );
  console.log('✅ React course sections seeded');

  // ════════════════════════════════════════════════════════════════════════════
  // 2.  ADD SECTIONS + LESSONS TO NODE.JS COURSE
  // ════════════════════════════════════════════════════════════════════════════
  const nodeCourse = await prisma.course.findUniqueOrThrow({ where: { slug: 'production-node-apis' } });

  await upsertSectionWithLessons(
    nodeCourse.id,
    { title: 'API Design Principles', description: 'REST best practices, versioning, and error handling.', order: 0 },
    [
      { title: 'REST API Design', description: 'Learn REST conventions, resource naming, and HTTP semantics.', videoUrl: 'https://www.youtube.com/watch?v=lsMQRaeKNDk', duration: 1800, order: 0, isFree: true  },
      { title: 'Authentication with JWT', description: 'Issue and verify JSON Web Tokens; protect routes server-side.', videoUrl: 'https://www.youtube.com/watch?v=7Q17ubqLfaM', duration: 2100, order: 1, isFree: false },
    ],
  );

  await upsertSectionWithLessons(
    nodeCourse.id,
    { title: 'Database & Deployment', description: 'Prisma ORM, database modelling, and shipping to production.', order: 1 },
    [
      { title: 'Prisma ORM Fundamentals', description: 'Define schemas, run migrations, and query with Prisma Client.', videoUrl: 'https://www.youtube.com/watch?v=RebA5J-rlwg', duration: 2400, order: 0, isFree: false },
      { title: 'Deploying Node.js APIs', description: 'Docker, environment variables, health checks, and zero-downtime deploys.', videoUrl: 'https://www.youtube.com/watch?v=9sIFBIapGl4', duration: 2000, order: 1, isFree: false },
    ],
  );
  console.log('✅ Node.js course sections seeded');

  // ════════════════════════════════════════════════════════════════════════════
  // 3.  CREATE RUST COURSE
  // ════════════════════════════════════════════════════════════════════════════
  const rustCourse = await prisma.course.upsert({
    where:  { slug: 'rust-systems-programming' },
    update: { status: 'PUBLISHED', categoryId: sysCat.id },
    create: {
      title:       'Rust Systems Programming: From Zero to Systems',
      slug:        'rust-systems-programming',
      description: 'Master Rust from first principles. Learn ownership, borrowing, lifetimes, and error handling to write safe, blazingly-fast systems software — no garbage collector required. By the end you will build a working CLI tool in Rust.',
      instructorId: instructor.id,
      categoryId:   sysCat.id,
      price:        29.99,
      currency:     'USD',
      status:       'PUBLISHED',
      level:        'INTERMEDIATE',
      language:     'English',
      publishedAt:  new Date(),
    },
  });
  console.log('✅ Rust course upserted:', rustCourse.id);

  // ── sections + lessons ──────────────────────────────────────────────────────
  const s1 = await upsertSectionWithLessons(
    rustCourse.id,
    { title: 'Rust Fundamentals', description: 'Toolchain setup, syntax, primitive types, and functions.', order: 0 },
    [
      {
        title:       'Introduction to Rust',
        description: 'Why Rust? Safety without GC, zero-cost abstractions, and Cargo. Walk through your first "Hello, World!" and understand the compile-run cycle.',
        videoUrl:    'https://www.youtube.com/watch?v=BpPEoZW5IiY',
        duration:    932,
        order:       0,
        isFree:      true,
      },
      {
        title:       'Variables, Types & Mutability',
        description: 'Scalar and compound types, variable shadowing, constants, and why mutability must be declared explicitly — and what that does to your bugs.',
        videoUrl:    'https://www.youtube.com/watch?v=Wrr02BLFRaI',
        duration:    1145,
        order:       1,
        isFree:      true,
      },
    ],
  );

  const s2 = await upsertSectionWithLessons(
    rustCourse.id,
    { title: 'Memory Management & Error Handling', description: 'The ownership system, borrowing, and robust error handling.', order: 1 },
    [
      {
        title:       'Ownership & Borrowing',
        description: 'Deep dive into the ownership system, references, slices, and the borrow checker. The core concepts that make Rust unique and safe.',
        videoUrl:    'https://www.youtube.com/watch?v=VFIOSWy93H0',
        duration:    1820,
        order:       0,
        isFree:      false,
      },
      {
        title:       'Error Handling with Result & Option',
        description: 'Panic vs recoverable errors, the ? operator, Option<T> for nullable values, and composing errors in real applications.',
        videoUrl:    'https://www.youtube.com/watch?v=wM6o70NAWUI',
        duration:    2100,
        order:       1,
        isFree:      false,
      },
    ],
  );
  console.log('✅ Rust sections created — section1:', (s1 as any).lessons?.length, 'lessons, section2:', (s2 as any).lessons?.length, 'lessons');

  // ── CometChat group (set cometchatGroupId on course) ──────────────────────
  // The CometChat group is created via the REST API when the course is published.
  // Here we just record the guid in the DB so the frontend knows which group to join.
  const groupGuid = `course-${rustCourse.id}`;
  await prisma.course.update({
    where: { id: rustCourse.id },
    data:  { cometchatGroupId: groupGuid },
  });
  console.log('✅ CometChat group guid linked:', groupGuid);

  // ── enroll test student ─────────────────────────────────────────────────────
  await prisma.enrollment.upsert({
    where:  { userId_courseId: { userId: student.id, courseId: rustCourse.id } },
    update: {},
    create: { userId: student.id, courseId: rustCourse.id },
  });
  console.log('✅ student@learnloop.test enrolled');
  // NOTE: Discussion messages are now managed by CometChat — no local ChatMessage seeding needed.

  // ════════════════════════════════════════════════════════════════════════════
  // 4.  ENROLL STUDENT IN ALL COURSES (ensures enrollment works everywhere)
  // ════════════════════════════════════════════════════════════════════════════
  for (const c of [reactCourse, nodeCourse]) {
    await prisma.enrollment.upsert({
      where:  { userId_courseId: { userId: student.id, courseId: c.id } },
      update: {},
      create: { userId: student.id, courseId: c.id },
    });
  }
  console.log('✅ student@learnloop.test enrolled in all 3 courses');

  console.log('\n🎉 All done!');
  console.log('  Rust course ID :', rustCourse.id);
  console.log('  CometChat group:', groupGuid);
  console.log('  Accounts       : student@learnloop.test / instructor@learnloop.test  (Password123)');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
