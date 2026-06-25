import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Seeds the system / non-human accounts:
 *   - AI_AGENT bot users (FAQ Bot, Study Assistant, Instructor Copilot)
 *   - A SUPER_ADMIN account
 *
 * NOTE: AI agent behaviour (LLM, system prompt, knowledge base) is configured in
 * the CometChat Dashboard → AI Agent Builder, not in the database. The old
 * `AiAgentConfig` table was removed from the Prisma schema when the project moved
 * to CometChat-native agents, so this seed only provisions the user rows.
 */
const BOT_USERS = [
  {
    email: 'faq-bot@system.local',
    name: 'FAQ Bot',
    bio: 'I answer frequently asked questions about courses.',
  },
  {
    email: 'study-assistant@system.local',
    name: 'Study Assistant',
    bio: 'I help students understand course material and answer study questions.',
  },
  {
    email: 'instructor-copilot@system.local',
    name: 'Instructor Copilot',
    bio: 'I assist instructors with smart replies and conversation summaries.',
  },
];

async function seedSystemUsers() {
  console.log('🤖 Seeding system users (bots + super admin)...\n');

  // Bots never log in via password, but a hash is required by the schema.
  const botHash = await bcrypt.hash('bot-account-no-login', 10);

  for (const bot of BOT_USERS) {
    const user = await prisma.user.upsert({
      where: { email: bot.email },
      update: { name: bot.name, bio: bot.bio },
      create: {
        email: bot.email,
        name: bot.name,
        bio: bot.bio,
        passwordHash: botHash,
        role: 'AI_AGENT',
        isActive: true,
        isVerified: true,
      },
    });
    console.log(`✅ AI_AGENT bot ready: "${user.name}" (${user.id})`);
  }

  // Super admin account
  const superAdminHash = await bcrypt.hash('Password123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@learnloop.test' },
    update: {},
    create: {
      email: 'superadmin@learnloop.test',
      name: 'Super Admin',
      passwordHash: superAdminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      isVerified: true,
    },
  });
  console.log(`✅ SUPER_ADMIN ready: "${superAdmin.name}" (${superAdmin.id})`);

  console.log('\n🎉 System user seeding complete!');
}

seedSystemUsers()
  .catch((error) => {
    console.error('Error seeding system users:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
