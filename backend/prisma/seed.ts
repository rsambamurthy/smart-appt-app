import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create association
  const association = await prisma.association.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Sunrise Apartments',
      address: '123 MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560001',
    },
  });

  // Association config
  await prisma.associationConfig.upsert({
    where: { association_id: association.id },
    update: {},
    create: {
      association_id: association.id,
      association_name: association.name,
      onboarding_mode: 'INVITE_ONLY',
      require_manager_approval: true,
      expense_approval_threshold: 5000,
    },
  });

  // Create units
  const units = await Promise.all(
    ['A-101', 'A-102', 'A-201', 'A-202', 'B-101', 'B-102'].map((flat, i) =>
      prisma.unit.upsert({
        where: { association_id_flat_number: { association_id: association.id, flat_number: flat } },
        update: {},
        create: { association_id: association.id, flat_number: flat, block: flat[0], floor: Math.floor(i / 2) + 1, unit_type: '2BHK' },
      }),
    ),
  );

  // Create manager
  const manager = await prisma.user.upsert({
    where: { association_id_phone: { association_id: association.id, phone: '+919999999999' } },
    update: {},
    create: {
      association_id: association.id,
      phone: '+919999999999',
      name: 'Ramesh Kumar (Manager)',
      role: UserRole.MANAGER,
      email: 'manager@smartappt.dev',
      is_active: true,
    },
  });

  // Create residents
  await Promise.all([
    { phone: '+919111111111', name: 'Priya Sharma', flat: units[0].id },
    { phone: '+919222222222', name: 'Amit Patel', flat: units[1].id },
    { phone: '+919333333333', name: 'Sneha Rao', flat: units[2].id },
  ].map(({ phone, name, flat }) =>
    prisma.user.upsert({
      where: { association_id_phone: { association_id: association.id, phone } },
      update: {},
      create: { association_id: association.id, phone, name, role: UserRole.RESIDENT, unit_id: flat, is_owner: true, is_active: true },
    }),
  ));

  // Create treasurer
  await prisma.user.upsert({
    where: { association_id_phone: { association_id: association.id, phone: '+919444444444' } },
    update: {},
    create: { association_id: association.id, phone: '+919444444444', name: 'Kavya Nair', role: UserRole.TREASURER, email: 'treasurer@smartappt.dev', is_active: true },
  });

  // Create gate staff
  await prisma.user.upsert({
    where: { association_id_phone: { association_id: association.id, phone: '+919555555555' } },
    update: {},
    create: { association_id: association.id, phone: '+919555555555', name: 'Raju Gate Staff', role: UserRole.GATE_STAFF, is_active: true },
  });

  // Dues config
  await prisma.duesConfig.upsert({
    where: { association_id: association.id },
    update: {},
    create: {
      association_id: association.id,
      monthly_charge: 2500,
      due_day: 5,
      penalty_type: 'FLAT',
      penalty_value: 100,
      penalty_grace_days: 7,
      updated_by: manager.id,
    },
  });

  console.log('Seed complete!');
  console.log('Manager login: +919999999999 (OTP logged to console in dev mode)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
