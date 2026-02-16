import { PrismaClient, UserRole, UserStatus, RequestStatus, RequestCategory, MatchStatus, TransactionType, TransactionStatus, EventType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================
  // 1. Create Admin User
  // ============================================
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { username: adminUsername },
  });

  if (existingAdmin) {
    console.log(`✅ Admin user "${adminUsername}" already exists`);
  } else {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.create({
      data: {
        username: adminUsername,
        passwordHash,
        email: 'admin@flyandearn.eu',
      },
    });
    console.log(`✅ Created admin user: ${adminUsername}`);
  }

  // ============================================
  // 2. Create Sample Users (for development)
  // ============================================
  if (process.env.NODE_ENV === 'development') {
    console.log('\n📦 Creating sample data for development...\n');

    // Sample users
    const users = await Promise.all([
      prisma.user.upsert({
        where: { email: 'john@example.com' },
        update: {},
        create: {
          email: 'john@example.com',
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: 'John',
          lastName: 'Doe',
          displayName: 'John D.',
          role: UserRole.REQUESTER,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          city: 'Paris',
          country: 'France',
          wallet: {
            create: {
              balance: 250.00,
              currency: 'EUR',
            },
          },
        },
      }),
      prisma.user.upsert({
        where: { email: 'jane@example.com' },
        update: {},
        create: {
          email: 'jane@example.com',
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: 'Jane',
          lastName: 'Smith',
          displayName: 'Jane S.',
          role: UserRole.TRAVELLER,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          city: 'London',
          country: 'United Kingdom',
          wallet: {
            create: {
              balance: 500.00,
              currency: 'EUR',
            },
          },
        },
      }),
      prisma.user.upsert({
        where: { email: 'bob@example.com' },
        update: {},
        create: {
          email: 'bob@example.com',
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: 'Bob',
          lastName: 'Wilson',
          displayName: 'Bob W.',
          role: UserRole.BOTH,
          status: UserStatus.ACTIVE,
          emailVerified: true,
          city: 'Berlin',
          country: 'Germany',
          wallet: {
            create: {
              balance: 150.00,
              currency: 'EUR',
            },
          },
        },
      }),
      prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {},
        create: {
          email: 'alice@example.com',
          passwordHash: await bcrypt.hash('password123', 10),
          firstName: 'Alice',
          lastName: 'Brown',
          displayName: 'Alice B.',
          role: UserRole.REQUESTER,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerified: false,
          city: 'Warsaw',
          country: 'Poland',
          wallet: {
            create: {
              balance: 0,
              currency: 'EUR',
            },
          },
        },
      }),
    ]);

    console.log(`✅ Created ${users.length} sample users`);

    // Sample requests
    const requests = await Promise.all([
      prisma.request.create({
        data: {
          requesterId: users[0].id,
          title: 'iPhone 15 Pro Max',
          description: 'Looking for someone traveling from USA to bring an iPhone 15 Pro Max',
          category: RequestCategory.ELECTRONICS,
          itemPrice: 1199.00,
          targetPrice: 1100.00,
          commission: 50.00,
          currency: 'EUR',
          pickupCity: 'New York',
          pickupCountry: 'USA',
          deliveryCity: 'Paris',
          deliveryCountry: 'France',
          status: RequestStatus.OPEN,
          publishedAt: new Date(),
        },
      }),
      prisma.request.create({
        data: {
          requesterId: users[0].id,
          title: 'Nike Air Jordan 1 Retro',
          description: 'Limited edition sneakers from US store',
          category: RequestCategory.FASHION,
          itemPrice: 180.00,
          targetPrice: 160.00,
          commission: 30.00,
          currency: 'EUR',
          pickupCity: 'Los Angeles',
          pickupCountry: 'USA',
          deliveryCity: 'Paris',
          deliveryCountry: 'France',
          status: RequestStatus.ACCEPTED,
          publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.request.create({
        data: {
          requesterId: users[2].id,
          title: 'Japanese Skincare Set',
          description: 'Shiseido skincare collection from Japan',
          category: RequestCategory.COSMETICS,
          itemPrice: 250.00,
          targetPrice: 220.00,
          commission: 40.00,
          currency: 'EUR',
          pickupCity: 'Tokyo',
          pickupCountry: 'Japan',
          deliveryCity: 'Berlin',
          deliveryCountry: 'Germany',
          status: RequestStatus.COMPLETED,
          publishedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    console.log(`✅ Created ${requests.length} sample requests`);

    // Sample matches
    const matches = await Promise.all([
      prisma.match.create({
        data: {
          requestId: requests[1].id,
          travellerId: users[1].id,
          status: MatchStatus.ACCEPTED,
          agreedPrice: 160.00,
          commission: 30.00,
          platformFee: 8.00,
          expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.match.create({
        data: {
          requestId: requests[2].id,
          travellerId: users[1].id,
          status: MatchStatus.COMPLETED,
          agreedPrice: 220.00,
          commission: 40.00,
          platformFee: 11.00,
          completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    console.log(`✅ Created ${matches.length} sample matches`);

    // Sample transactions
    const wallet1 = await prisma.wallet.findUnique({ where: { userId: users[0].id } });
    const wallet2 = await prisma.wallet.findUnique({ where: { userId: users[1].id } });

    if (wallet1 && wallet2) {
      await prisma.walletTransaction.createMany({
        data: [
          {
            walletId: wallet1.id,
            type: TransactionType.TOPUP,
            amount: 300.00,
            status: TransactionStatus.COMPLETED,
            description: 'Account top-up',
            completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          },
          {
            walletId: wallet1.id,
            type: TransactionType.HOLD,
            amount: -160.00,
            status: TransactionStatus.COMPLETED,
            description: 'Hold for request payment',
            referenceType: 'request',
            referenceId: requests[1].id,
            completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          },
          {
            walletId: wallet2.id,
            type: TransactionType.RELEASE,
            amount: 260.00,
            status: TransactionStatus.COMPLETED,
            description: 'Payment received for completed delivery',
            referenceType: 'match',
            referenceId: matches[1].id,
            completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          },
          {
            walletId: wallet2.id,
            type: TransactionType.PAYOUT,
            amount: -200.00,
            status: TransactionStatus.COMPLETED,
            description: 'Payout to bank account',
            payoutMethod: 'bank_transfer',
            completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          },
        ],
      });

      console.log('✅ Created sample transactions');
    }

    // Sample events
    const today = new Date();
    const eventData = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Pageviews (random amount per day)
      const pageviews = Math.floor(Math.random() * 100) + 20;
      for (let j = 0; j < Math.min(pageviews, 10); j++) {
        eventData.push({
          type: EventType.PAGEVIEW,
          sessionId: `session_${i}_${j}`,
          ipHash: `hash_${Math.floor(Math.random() * 1000)}`,
          path: ['/', '/dashboard', '/wallet', '/request/new'][Math.floor(Math.random() * 4)],
          country: ['France', 'Germany', 'Poland', 'UK', 'USA'][Math.floor(Math.random() * 5)],
          createdAt: date,
        });
      }
    }

    // Add user events
    eventData.push(
      { type: EventType.SIGNUP, userId: users[0].id, createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
      { type: EventType.SIGNUP, userId: users[1].id, createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000) },
      { type: EventType.SIGNUP, userId: users[2].id, createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
      { type: EventType.SIGNUP, userId: users[3].id, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      { type: EventType.REQUEST_CREATED, userId: users[0].id, requestId: requests[0].id, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { type: EventType.REQUEST_PUBLISHED, userId: users[0].id, requestId: requests[0].id, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { type: EventType.MATCH_ACCEPTED, userId: users[1].id, requestId: requests[1].id, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    );

    await prisma.event.createMany({
      data: eventData,
      skipDuplicates: true,
    });

    console.log(`✅ Created ${eventData.length} sample events`);

    // Create daily stats for the last 30 days
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      await prisma.dailyStats.upsert({
        where: { date },
        update: {},
        create: {
          date,
          totalVisits: Math.floor(Math.random() * 150) + 50,
          uniqueVisitors: Math.floor(Math.random() * 100) + 30,
          pageviews: Math.floor(Math.random() * 400) + 100,
          newSignups: Math.floor(Math.random() * 5),
          activeUsers: Math.floor(Math.random() * 30) + 10,
          newRequests: Math.floor(Math.random() * 8),
          publishedRequests: Math.floor(Math.random() * 6),
          completedRequests: Math.floor(Math.random() * 3),
          newMatches: Math.floor(Math.random() * 5),
          acceptedMatches: Math.floor(Math.random() * 4),
          completedMatches: Math.floor(Math.random() * 2),
          gmv: Math.random() * 2000 + 500,
          platformFees: Math.random() * 100 + 25,
          totalPayouts: Math.random() * 1500 + 300,
          messagesSent: Math.floor(Math.random() * 50) + 10,
        },
      });
    }

    console.log('✅ Created daily stats for last 30 days');
  }

  console.log('\n✨ Seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
