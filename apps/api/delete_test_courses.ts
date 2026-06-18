import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Courses to remove — test/junk courses
  const junkTitles = ['Push Trigger Test Course', 'sDc'];

  const toDelete = await prisma.course.findMany({
    where: { title: { in: junkTitles } },
    select: { id: true, title: true, chatRoomId: true },
  });

  console.log(`Found ${toDelete.length} courses to delete:`);
  toDelete.forEach(c => console.log(`  - ${c.title} (${c.id})`));

  for (const course of toDelete) {
    console.log(`\nDeleting: ${course.title} (${course.id})`);

    // 1. Get the ChatRoom record if linked
    let chatRoomDbId: string | null = null;
    if (course.chatRoomId) {
      const room = await prisma.chatRoom.findUnique({
        where: { roomId: course.chatRoomId },
        select: { id: true },
      });
      chatRoomDbId = room?.id ?? null;
    }

    // 2. Delete chat messages, members, moderation logs for this room
    if (chatRoomDbId) {
      await prisma.chatModerationLog.deleteMany({ where: { roomId: chatRoomDbId } });
      await prisma.chatMessage.deleteMany({ where: { roomId: chatRoomDbId } });
      await prisma.chatRoomMember.deleteMany({ where: { roomId: chatRoomDbId } });
    }

    // 3. Delete enrollments
    await prisma.enrollment.deleteMany({ where: { courseId: course.id } });

    // 4. Delete sections & lessons
    const sections = await prisma.section.findMany({ where: { courseId: course.id }, select: { id: true } });
    for (const s of sections) {
      const lessons = await prisma.lesson.findMany({ where: { sectionId: s.id }, select: { id: true } });
      for (const l of lessons) {
        await prisma.lessonCompletion.deleteMany({ where: { lessonId: l.id } });
      }
      await prisma.lesson.deleteMany({ where: { sectionId: s.id } });
    }
    await prisma.section.deleteMany({ where: { courseId: course.id } });

    // 5. Unlink chatRoom from course (set chatRoomId = null)
    await prisma.course.update({ where: { id: course.id }, data: { chatRoomId: null } });

    // 6. Delete the chat room itself
    if (chatRoomDbId) {
      await prisma.chatRoom.delete({ where: { id: chatRoomDbId } });
    }

    // 7. Delete the course
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
