import { PrismaClient, Role, ConsentSource } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

async function main() {
  console.log('🌱 Seeding JiraniPass database...');

  // 1. Create Pilot Estate
  const estate = await prisma.estate.upsert({
    where: { id: 'estate-pilot-green-valley' },
    update: {},
    create: {
      id: 'estate-pilot-green-valley',
      name: 'Green Valley Estate',
      timezone: 'Africa/Nairobi',
      approvalTtlMinutes: 10,
      visitorRetentionDays: 90,
    },
  });
  console.log(`✅ Estate created: ${estate.name} (${estate.id})`);

  // 2. Create Units
  const units = ['House A1', 'House A2', 'House B12', 'House C4', 'Unit 102'];
  const householdMap: Record<string, string> = {};

  for (const unitCode of units) {
    const household = await prisma.household.upsert({
      where: {
        estateId_unitCode: {
          estateId: estate.id,
          unitCode,
        },
      },
      update: {},
      create: {
        estateId: estate.id,
        unitCode,
        isActive: true,
      },
    });
    householdMap[unitCode] = household.id;
  }
  console.log(`✅ Created ${units.length} households`);

  // 3. Create Primary Residents with WhatsApp Consent
  const residents = [
    {
      name: 'Mary Nduta',
      phone: '+254712345678',
      unit: 'House B12',
    },
    {
      name: 'John Kamau',
      phone: '+254722000001',
      unit: 'House A1',
    },
    {
      name: 'Grace Wanjiku',
      phone: '+254733000002',
      unit: 'House A2',
    },
  ];

  for (const r of residents) {
    const user = await prisma.user.upsert({
      where: { id: `user-${r.phone}` },
      update: {},
      create: {
        id: `user-${r.phone}`,
        name: r.name,
        phone: r.phone,
        phoneLookupHash: hashPhone(r.phone),
        verifiedAt: new Date(),
      },
    });

    const householdId = householdMap[r.unit];
    await prisma.membership.upsert({
      where: { id: `member-${user.id}-${householdId}` },
      update: {},
      create: {
        id: `member-${user.id}-${householdId}`,
        userId: user.id,
        estateId: estate.id,
        householdId,
        role: Role.RESIDENT,
        isPrimary: true,
        isActive: true,
      },
    });

    await prisma.whatsAppConsent.upsert({
      where: { id: `consent-${user.id}` },
      update: {},
      create: {
        id: `consent-${user.id}`,
        userId: user.id,
        phone: r.phone,
        purpose: 'ESTATE_VISITOR_ACCESS_ALERTS',
        noticeVersion: '1.0',
        collectionSource: ConsentSource.ADMIN_PORTAL,
      },
    });
  }
  console.log(`✅ Created ${residents.length} primary residents with verified WhatsApp consent`);

  // 4. Create Staff: Guard, Supervisor, Admin
  // Guard
  const guard = await prisma.user.upsert({
    where: { id: 'user-guard-samson' },
    update: {},
    create: {
      id: 'user-guard-samson',
      name: 'Samson Omwamba',
      phone: '+254799000001',
      phoneLookupHash: hashPhone('+254799000001'),
      pinHash: hashPin('1234'), // PIN 1234
      verifiedAt: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: { id: `member-${guard.id}-${estate.id}` },
    update: {},
    create: {
      id: `member-${guard.id}-${estate.id}`,
      userId: guard.id,
      estateId: estate.id,
      role: Role.GUARD,
      isActive: true,
    },
  });

  // Supervisor
  const supervisor = await prisma.user.upsert({
    where: { id: 'user-supervisor-peter' },
    update: {},
    create: {
      id: 'user-supervisor-peter',
      name: 'Peter Mwangi',
      phone: '+254799000002',
      phoneLookupHash: hashPhone('+254799000002'),
      pinHash: hashPin('9999'), // PIN 9999
      verifiedAt: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: { id: `member-${supervisor.id}-${estate.id}` },
    update: {},
    create: {
      id: `member-${supervisor.id}-${estate.id}`,
      userId: supervisor.id,
      estateId: estate.id,
      role: Role.SUPERVISOR,
      isActive: true,
    },
  });

  // Admin
  const admin = await prisma.user.upsert({
    where: { id: 'user-admin-evans' },
    update: {},
    create: {
      id: 'user-admin-evans',
      name: 'Admin Evans',
      phone: '+254700000000',
      phoneLookupHash: hashPhone('+254700000000'),
      passwordHash: crypto.createHash('sha256').update('AdminPass123!').digest('hex'),
      verifiedAt: new Date(),
    },
  });

  await prisma.membership.upsert({
    where: { id: `member-${admin.id}-${estate.id}` },
    update: {},
    create: {
      id: `member-${admin.id}-${estate.id}`,
      userId: admin.id,
      estateId: estate.id,
      role: Role.ESTATE_ADMIN,
      isActive: true,
    },
  });

  // 5. Create an Active Shift for Samson at "Main Gate"
  await prisma.guardShift.upsert({
    where: { id: 'shift-pilot-main-gate' },
    update: {},
    create: {
      id: 'shift-pilot-main-gate',
      guardId: guard.id,
      gateId: 'GATE-MAIN',
      estateId: estate.id,
      deviceId: 'DEVICE-TABLET-01',
      startedAt: new Date(),
    },
  });

  console.log('✅ Active shift created for guard Samson at GATE-MAIN');
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
