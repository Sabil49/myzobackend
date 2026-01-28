// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@luxurybags.com' },
    update: {},
    create: {
      email: 'admin@luxurybags.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created');
  console.log('   📧 Email: admin@luxurybags.com');
  console.log('   🔑 Password: Admin@123\n');

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'totes' },
      update: {},
      create: {
        name: 'Totes',
        slug: 'totes',
        description: 'Spacious and elegant tote bags',
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'crossbody' },
      update: {},
      create: {
        name: 'Crossbody',
        slug: 'crossbody',
        description: 'Stylish crossbody bags',
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: 'clutches' },
      update: {},
      create: {
        name: 'Clutches',
        slug: 'clutches',
        description: 'Evening clutches and small bags',
        order: 3,
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories\n`);
  console.log('🎉 Seeding completed!\n');
  console.log('⚠️  IMPORTANT: Change the admin password in production!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });