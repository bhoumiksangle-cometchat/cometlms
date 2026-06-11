import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BOT_USERS = [
  {
    email: 'faq-bot@system.local',
    name: 'FAQ Bot',
    password: 'bot-password-not-used',
    role: 'AI_AGENT',
    isActive: true,
    isVerified: true,
    avatarUrl: null,
    bio: 'I answer frequently asked questions about courses.',
    agentType: 'FAQ_BOT',
    systemPrompt: `You are a helpful FAQ Bot for this course. Answer frequently asked questions about course content, schedule, requirements, and policies. Keep responses concise and friendly. If you don't know the answer, suggest the student contact the instructor.`,
  },
  {
    email: 'study-assistant@system.local',
    name: 'Study Assistant',
    password: 'bot-password-not-used',
    role: 'AI_AGENT',
    isActive: true,
    isVerified: true,
    avatarUrl: null,
    bio: 'I help students understand course material and answer study questions.',
    agentType: 'STUDY_ASSISTANT',
    systemPrompt: `You are a helpful AI Study Assistant for this course. Help students understand concepts, debug code, explain difficult topics, and answer study questions. Provide clear, educational explanations. Encourage students to think critically. Keep responses under 500 characters.`,
  },
  {
    email: 'instructor-copilot@system.local',
    name: 'Instructor Copilot',
    password: 'bot-password-not-used',
    role: 'AI_AGENT',
    isActive: true,
    isVerified: true,
    avatarUrl: null,
    bio: 'I assist instructors with smart replies and conversation summaries.',
    agentType: 'INSTRUCTOR_COPILOT',
    systemPrompt: `You are an Instructor AI Copilot. Help instructors draft thoughtful, encouraging replies to student questions. Provide smart reply suggestions that are professional, supportive, and educational. When summarizing discussions, highlight key questions, common issues, and actionable insights.`,
  },
];

async function seedBotUsers() {
  console.log('🤖 Seeding bot users...\n');

  for (const botData of BOT_USERS) {
    try {
      // Check if bot user already exists
      const existing = await prisma.user.findUnique({
        where: { email: botData.email },
      });

      if (existing) {
        console.log(`✅ Bot user "${botData.name}" already exists (${existing.id})`);
        
        // Check if agent config exists
        const agentConfig = await prisma.aiAgentConfig.findFirst({
          where: { botUserId: existing.id },
        });

        if (!agentConfig) {
          // Create agent config for existing bot user
          await prisma.aiAgentConfig.create({
            data: {
              botUserId: existing.id,
              agentType: botData.agentType as 'FAQ_BOT' | 'STUDY_ASSISTANT' | 'INSTRUCTOR_COPILOT',
              provider: 'OPENAI',
              systemPrompt: botData.systemPrompt,
              modelName: 'gpt-4o',
              isEnabled: true,
            },
          });
          console.log(`   ✅ Created agent config for "${botData.name}"`);
        } else {
          console.log(`   ✅ Agent config already exists for "${botData.name}"`);
        }
        
        continue;
      }

      // Hash password (even though bots don't log in)
      const hashedPassword = await bcrypt.hash(botData.password, 10);

      // Create bot user
      const botUser = await prisma.user.create({
        data: {
          email: botData.email,
          name: botData.name,
          passwordHash: hashedPassword,
          role: botData.role as 'AI_AGENT',
          isActive: botData.isActive,
          isVerified: botData.isVerified,
          avatarUrl: botData.avatarUrl,
          bio: botData.bio,
        },
      });

      console.log(`✅ Created bot user: "${botUser.name}" (${botUser.id})`);

      // Create AI agent config
      const agentConfig = await prisma.aiAgentConfig.create({
        data: {
          botUserId: botUser.id,
          agentType: botData.agentType as 'FAQ_BOT' | 'STUDY_ASSISTANT' | 'INSTRUCTOR_COPILOT',
          provider: 'OPENAI',
          systemPrompt: botData.systemPrompt,
          modelName: 'gpt-4o',
          isEnabled: true,
        },
      });

      console.log(`   ✅ Created agent config: ${agentConfig.agentType}\n`);
    } catch (error) {
      console.error(`❌ Error creating bot user "${botData.name}":`, error);
    }
  }

  console.log('\n🎉 Bot user seeding complete!');
  console.log('\n📋 Bot Users Summary:');
  console.log('   • FAQ Bot - Answers course FAQs');
  console.log('   • Study Assistant - Helps students understand material');
  console.log('   • Instructor Copilot - Assists instructors with replies\n');
}

seedBotUsers()
  .catch((error) => {
    console.error('Error seeding bot users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
