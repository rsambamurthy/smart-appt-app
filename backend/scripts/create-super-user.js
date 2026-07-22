// Run from Railway Console: node scripts/create-super-user.js
const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const SUPER_ASSOC = '00000000-0000-0000-0000-000000000000';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Phone (+91XXXXXXXXXX): ', async (phone) => {
  const p = new PrismaClient();
  try {
    // Check if user already exists
    const existing = await p.user.findFirst({
      where: { phone, association_id: SUPER_ASSOC },
    });

    let user;
    if (existing) {
      user = await p.user.update({
        where: { id: existing.id },
        data: { role: 'SUPER_USER', is_active: true, deleted_at: null },
      });
      console.log('Updated existing user:', user.id);
    } else {
      user = await p.user.create({
        data: {
          phone,
          name: 'Super Admin',
          role: 'SUPER_USER',
          is_active: true,
          association_id: SUPER_ASSOC,
        },
      });
      console.log('Created super user:', user.id);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
    rl.close();
  }
});
