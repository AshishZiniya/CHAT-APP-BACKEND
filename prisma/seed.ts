import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Create sample users
  const user1 = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      phone: '+1234567890',
      password: await bcrypt.hash('password123', 10),
      displayName: 'Alice',
      status: 'Available for chat',
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      phone: '+1234567891',
      password: await bcrypt.hash('password123', 10),
      displayName: 'Bob',
      status: 'Working from home',
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'charlie@example.com' },
    update: {},
    create: {
      email: 'charlie@example.com',
      phone: '+1234567892',
      password: await bcrypt.hash('password123', 10),
      displayName: 'Charlie',
      status: "Let's catch up!",
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    },
  });

  console.log('✅ Users created:');
  console.log(`  - ${user1.displayName} (${user1.email})`);
  console.log(`  - ${user2.displayName} (${user2.email})`);
  console.log(`  - ${user3.displayName} (${user3.email})`);

  // Create sample group
  const group = await prisma.group.create({
    data: {
      name: 'Development Team',
      description: 'Chat for the dev team',
      createdBy: user1.id,
      profilePicture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DevTeam',
      members: {
        create: [
          { userId: user1.id, role: 'ADMIN' },
          { userId: user2.id, role: 'MEMBER' },
          { userId: user3.id, role: 'MEMBER' },
        ],
      },
    },
  });

  console.log(`\n✅ Group created: ${group.name}`);
  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
