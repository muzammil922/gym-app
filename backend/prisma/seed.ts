import { PrismaClient, Role, OfferType, DeviceVendor } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const gymName = process.env.SEED_GYM_NAME || 'Demo Fitness Club';
  const ownerPhone = process.env.SEED_OWNER_PHONE || '03001234567';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'Owner@12345';
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);

  console.log('Seeding demo gym...');

  let gym = await prisma.gym.findFirst({ where: { name: gymName } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        name: gymName,
        phone: ownerPhone,
        email: 'demo@gym.local',
        address: 'Lahore, Pakistan',
        city: 'Lahore',
        timezone: 'Asia/Karachi',
        currency: 'PKR',
      },
    });
  }

  const passwordHash = await bcrypt.hash(ownerPassword, rounds);

  const owner = await prisma.user.upsert({
    where: { gymId_phone: { gymId: gym.id, phone: ownerPhone } },
    create: {
      gymId: gym.id,
      phone: ownerPhone,
      passwordHash,
      fullName: 'Demo Owner',
      email: 'owner@gym.local',
      role: Role.OWNER,
    },
    update: { passwordHash, fullName: 'Demo Owner', isActive: true },
  });

  await prisma.staff.upsert({
    where: { gymId_phone: { gymId: gym.id, phone: ownerPhone } },
    create: {
      gymId: gym.id,
      userId: owner.id,
      staffCode: 'S0001',
      fullName: 'Demo Owner',
      phone: ownerPhone,
      email: 'owner@gym.local',
      role: Role.OWNER,
      salaryAmount: 0,
      hireDate: new Date(),
    },
    update: { userId: owner.id, fullName: 'Demo Owner' },
  });

  const plans = [
    { name: 'Monthly Basic', durationDays: 30, price: 5000, sortOrder: 1 },
    { name: 'Quarterly', durationDays: 90, price: 13500, sortOrder: 2 },
    { name: 'Annual Elite', durationDays: 365, price: 48000, sortOrder: 3 },
  ];

  for (const p of plans) {
    const existing = await prisma.plan.findFirst({
      where: { gymId: gym.id, name: p.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.plan.create({
        data: {
          gymId: gym.id,
          name: p.name,
          durationDays: p.durationDays,
          price: p.price,
          sortOrder: p.sortOrder,
          description: `${p.name} membership`,
          currency: 'PKR',
        },
      });
    }
  }

  const monthly = await prisma.plan.findFirst({
    where: { gymId: gym.id, name: 'Monthly Basic' },
  });

  const offerExisting = await prisma.offer.findFirst({
    where: { gymId: gym.id, code: 'WELCOME10' },
  });
  if (!offerExisting && monthly) {
    const now = new Date();
    const later = new Date();
    later.setFullYear(later.getFullYear() + 1);
    await prisma.offer.create({
      data: {
        gymId: gym.id,
        planId: monthly.id,
        name: 'Welcome 10%',
        code: 'WELCOME10',
        type: OfferType.PERCENT,
        value: 10,
        validFrom: now,
        validTo: later,
        maxRedemptions: 100,
      },
    });
  }

  {
    const existing = await prisma.paymentAccount.findFirst({
      where: { gymId: gym.id, name: 'Cash Counter' },
    });
    if (!existing) {
      await prisma.paymentAccount.create({
        data: { gymId: gym.id, name: 'Cash Counter', type: 'CASH' },
      });
    }
  }

  // Sample members
  const sampleMembers = [
    { code: 'M00001', name: 'Ali Khan', phone: '03001111111', pin: '1001' },
    { code: 'M00002', name: 'Sara Ahmed', phone: '03002222222', pin: '1002' },
    { code: 'M00003', name: 'Bilal Hussain', phone: '03003333333', pin: '1003' },
  ];

  for (const m of sampleMembers) {
    const exists = await prisma.member.findFirst({
      where: { gymId: gym.id, memberCode: m.code },
    });
    if (!exists && monthly) {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 30);
      const member = await prisma.member.create({
        data: {
          gymId: gym.id,
          memberCode: m.code,
          fullName: m.name,
          phone: m.phone,
          devicePin: m.pin,
          status: 'ACTIVE',
          gender: 'other',
        },
      });
      await prisma.memberSubscription.create({
        data: {
          gymId: gym.id,
          memberId: member.id,
          planId: monthly.id,
          status: 'ACTIVE',
          startDate: start,
          endDate: end,
          price: monthly.price,
          discount: 0,
          finalAmount: monthly.price,
        },
      });
    }
  }

  const device = await prisma.attendanceDevice.findFirst({
    where: { gymId: gym.id, serialNumber: 'ZKTECODEMO001' },
  });
  if (!device) {
    await prisma.attendanceDevice.create({
      data: {
        gymId: gym.id,
        name: 'Front Door ZKTeco',
        vendor: DeviceVendor.ZKTECO,
        serialNumber: 'ZKTECODEMO001',
        location: 'Entrance',
      },
    });
  }

  const templates = [
    {
      key: 'welcome',
      name: 'Welcome',
      body: 'Welcome {{name}} to Demo Fitness Club! Your membership is active. Train hard!',
    },
    {
      key: 'fee_reminder',
      name: 'Fee Reminder',
      body: 'Hi {{name}}, dues of {{amount}} PKR pending for invoice {{invoice}}.',
    },
    {
      key: 'diet_reminder',
      name: 'Diet Reminder',
      body: 'Meal reminder for {{name}}: check your diet schedule.',
    },
  ];
  for (const t of templates) {
    await prisma.messageTemplate.upsert({
      where: { gymId_key: { gymId: gym.id, key: t.key } },
      create: { gymId: gym.id, ...t },
      update: { body: t.body, name: t.name },
    });
  }

  for (const key of ['welcome', 'fee_reminder', 'diet_reminder']) {
    await prisma.automationSetting.upsert({
      where: { gymId_key: { gymId: gym.id, key } },
      create: { gymId: gym.id, key, enabled: true },
      update: {},
    });
  }

  // Sample exercises + workout plan
  const ex = await prisma.exercise.findFirst({
    where: { gymId: gym.id, name: 'Barbell Squat' },
  });
  if (!ex) {
    await prisma.exercise.createMany({
      data: [
        { gymId: gym.id, name: 'Barbell Squat', muscleGroup: 'Legs', category: 'Strength' },
        { gymId: gym.id, name: 'Bench Press', muscleGroup: 'Chest', category: 'Strength' },
        { gymId: gym.id, name: 'Deadlift', muscleGroup: 'Back', category: 'Strength' },
      ],
    });
  }

  console.log('Seed complete.');
  console.log('---');
  console.log(`Gym: ${gym.name} (${gym.id})`);
  console.log(`Owner phone: ${ownerPhone}`);
  console.log(`Owner password: ${ownerPassword}`);
  console.log('Login: POST /api/auth/login { "phone": "...", "password": "..." }');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
