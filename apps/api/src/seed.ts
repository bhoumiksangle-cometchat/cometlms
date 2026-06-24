// DEPRECATED.
// Canonical seed flow:
// 1. prisma/seed.ts
// 2. prisma/seed-bots.ts
//
// This file is retained temporarily for reference during migration.
import { prisma } from './lib/prisma';
import bcrypt from 'bcryptjs';

export async function seedCourses() {
  try {
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('Password123!', 12);

      await prisma.user.create({ data: { email: 'admin@learnloop.com', name: 'System Admin', role: 'ADMIN', passwordHash, isVerified: true } });

      for (let i = 1; i <= 10; i++) {
        await prisma.user.create({
          data: {
            email: `instructor${i}@learnloop.com`,
            name: `Instructor ${i}`,
            role: 'INSTRUCTOR',
            passwordHash,
            isVerified: true,
          },
        });
      }

      for (let i = 1; i <= 89; i++) {
        await prisma.user.create({
          data: {
            email: `student${i}@learnloop.com`,
            name: `Student ${i}`,
            role: 'STUDENT',
            passwordHash,
            isVerified: true,
          },
        });
      }
    }

    // Create categories
    const categories = await prisma.category.findMany();
    
    if (categories.length === 0) {
      console.log('[Seed] Creating course categories...');
      await prisma.category.createMany({
        data: [
          { name: 'Web Development', description: 'Learn to build modern web applications' },
          { name: 'Mobile Development', description: 'Build apps for iOS and Android' },
          { name: 'Data Science', description: 'Learn data analysis and machine learning' },
          { name: 'Cloud & DevOps', description: 'Deploy and scale applications' },
          { name: 'AI & Machine Learning', description: 'Build intelligent systems' },
        ],
      });
      console.log('[Seed] Categories created successfully');
    }

    // Create demo instructor if not exists
    const demoInstructor = await prisma.user.findUnique({
      where: { email: 'instructor@example.com' },
    });

    const instructor = demoInstructor || 
      await prisma.user.create({
        data: {
          email: 'instructor@example.com',
          passwordHash: '$2b$12$example', // Should be hashed in production
          name: 'John Smith',
          role: 'INSTRUCTOR',
          bio: 'Experienced web developer with 10+ years in the industry',
        },
      });

    console.log(`[Seed] Using instructor: ${instructor.email}`);

    // Create demo courses if none exist
    const existingCourses = await prisma.course.count();
    
    if (existingCourses === 0) {
      console.log('[Seed] Creating demo courses...');
      
      const category = await prisma.category.findFirst();
      
      if (!category) {
        console.log('[Seed] No categories found. Cannot create courses.');
        return;
      }

      const course = await prisma.course.create({
        data: {
          title: 'React Foundations',
          slug: 'react-foundations',
          description: 'Master the fundamentals of React and build modern web applications',
          instructorId: instructor.id,
          categoryId: category.id,
          level: 'BEGINNER',
          price: 49.99,
          currency: 'USD',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          language: 'en',
          sections: {
            create: [
              {
                title: 'Getting Started',
                description: 'Introduction to React concepts',
                order: 1,
                lessons: {
                  create: [
                    {
                      title: 'What is React?',
                      description: 'Understanding the React library and its ecosystem',
                      duration: 600, // 10 minutes
                      order: 1,
                      isFree: true,
                      videoUrl: 'https://www.youtube.com/embed/8Ktwog3Mjzw',
                    },
                    {
                      title: 'JSX and Components',
                      description: 'Learn about JSX syntax and component structure',
                      duration: 900, // 15 minutes
                      order: 2,
                      isFree: true,
                      videoUrl: 'https://www.youtube.com/embed/8Ktwog3Mjzw',
                    },
                    {
                      title: 'Props and State',
                      description: 'Understanding how to pass data and manage state',
                      duration: 1200, // 20 minutes
                      order: 3,
                      isFree: false,
                      videoUrl: 'https://www.youtube.com/embed/8Ktwog3Mjzw',
                    },
                  ],
                },
              },
              {
                title: 'Hooks Deep Dive',
                description: 'Master React Hooks for functional components',
                order: 2,
                lessons: {
                  create: [
                    {
                      title: 'useState Hook',
                      description: 'Using the useState hook for state management',
                      duration: 900,
                      order: 1,
                      isFree: false,
                      videoUrl: 'https://www.youtube.com/embed/8Ktwog3Mjzw',
                    },
                    {
                      title: 'useEffect Hook',
                      description: 'Side effects and lifecycle in functional components',
                      duration: 1200,
                      order: 2,
                      isFree: false,
                      videoUrl: 'https://www.youtube.com/embed/8Ktwog3Mjzw',
                    },
                  ],
                },
              },
            ],
          },
        },
        include: { sections: { include: { lessons: true } } },
      });

      console.log(`[Seed] Created course: ${course.title}`);
      console.log(`[Seed] Course has ${course.sections.length} sections`);
    } else {
      console.log(`[Seed] ${existingCourses} courses already exist. Skipping seeding.`);
    }

    // Bot Users and Configs Seeding
    console.log('[Seed] Seeding AI Agent Bot users...');
    const botPasswordHash = await bcrypt.hash('BotPassword123!', 12);
    
    const botsData = [
      {
        email: 'faq-bot@learnloop.com',
        name: 'FAQ Bot',
        agentType: 'FAQ_BOT' as const,
        systemPrompt: 'You are the FAQ Bot for LearnLoop. Answer student questions using the FAQ knowledge base. Be concise and friendly.',
      },
      {
        email: 'study-assistant@learnloop.com',
        name: 'Study Assistant',
        agentType: 'STUDY_ASSISTANT' as const,
        systemPrompt: 'You are the AI Study Assistant for this course. Help students understand code concepts, write examples, and debug their code step-by-step.',
      },
      {
        email: 'instructor-copilot@learnloop.com',
        name: 'Instructor Copilot',
        agentType: 'INSTRUCTOR_COPILOT' as const,
        systemPrompt: 'You are the Instructor AI Copilot. Summarize student threads and suggest replies. Be brief and professional.',
      },
    ];

    for (const bot of botsData) {
      let botUser = await prisma.user.findUnique({
        where: { email: bot.email },
      });

      if (!botUser) {
        botUser = await prisma.user.create({
          data: {
            email: bot.email,
            name: bot.name,
            role: 'AI_AGENT',
            passwordHash: botPasswordHash,
            isVerified: true,
          },
        });
        console.log(`[Seed] Created bot user: ${bot.name}`);
      }

      // AI agents are now managed via CometChat's Agent Builder (dashboard).
      // No server-side bot sync or agent config needed.
    }

  } catch (error) {
    console.error('[Seed] Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeding when executed directly via tsx/node
const isDirectExecution = process.argv[1]?.includes('seed.ts');

if (isDirectExecution) {
  seedCourses()
    .then(() => {
      console.log('[Seed] Completed successfully');
    })
    .catch((error) => {
      console.error('[Seed] Fatal error:', error);
      process.exit(1);
    });
}
