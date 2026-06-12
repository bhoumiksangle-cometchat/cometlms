import { prisma } from './lib/prisma';

async function main() {
  console.log('users before', await prisma.user.count());

  await prisma.user.create({
    data: {
      email: `check-${Date.now()}@example.com`,
      name: 'DB Check',
      passwordHash: 'test',
    },
  });

  console.log('users after', await prisma.user.count());
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
