// Run from Railway Console: node scripts/create-super-user.js
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Phone (+91XXXXXXXXXX): ', async (phone) => {
  const p = new PrismaClient();
  try {
    const user = await p.user.upsert({
      where: { phone },
      update: { role: 'SUPER_USER', is_active: true, deleted_at: null },
      create: {
        phone,
        name: 'Super Admin',
        role: 'SUPER_USER',
        is_active: true,
        association_id: '00000000-0000-0000-0000-000000000000',
      },
    });
    console.log('Done! Super user id:', user.id);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
    rl.close();
  }
});
