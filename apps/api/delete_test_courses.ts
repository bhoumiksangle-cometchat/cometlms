import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Courses to remove — test/junk courses
  const junkTitles = ['Push Trigger Test Course', 'sDc'];

  const toDelete = await prisma.course.findMany({
    where: { title: { in: junkTitles } },
    select: { id: true, title: true, cometchatGroupId: true },
  });

  console.log(`Found ${toDelete.length} courses to delete:`);
  toDelete.forEach(c => console.log(`  - ${c.title} (${c.id})`));

  for (const course of toDelete) {
    console.log(`\nDeleting: ${course.title} (${course.id})`);

    // 1. Delete enrollments
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });

    // 2. Delete engagement metrics
    await prisma.courseEngagementMetrics.deleteMany({ where: { courseId: course.id } });

    // 3. Delete sections & lessons
    const sections = await prisma.section.findMany({ where: { courseId: course.id }, select: { id: true } });
    for (const s of sections) {
      const lessons = await prisma.lesson.findMany({ where: { sectionId: s.id }, select: { id: true } });
      for (const l of lessons) {
        await prisma.lessonCompletion.deleteMany({ where: { lessonId: l.id } });
      }
      await prisma.lesson.deleteMany({ where: { sectionId: s.id } });
    }
    await prisma.section.deleteMany({ where: { courseId: course.id } });

    // 4. Delete the course
    await prisma.course.delete({ where: { id: course.id } });
    console.log(`  ✓ Deleted`);
  }

  const remaining = await prisma.course.findMany({ select: { id: true, title: true } });
  console.log(`\nRemaining courses (${remaining.length}):`);
  remaining.forEach(c => console.log(`  - ${c.title}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
