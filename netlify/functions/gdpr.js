import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, verifyPassword, jsonResponse } from './lib/auth.js';

// Simple in-memory rate limiting (per-instance; good enough for serverless)
const rateLimitMap = new Map();
const RATE_LIMIT_MS = 60000; // 1 minute

function checkRateLimit(userId) {
  const now = Date.now();
  const last = rateLimitMap.get(userId);
  if (last && now - last < RATE_LIMIT_MS) {
    return false;
  }
  rateLimitMap.set(userId, now);
  return true;
}

async function getAuthenticatedUser(event) {
  const token = getSessionToken(event);
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || !payload.userId) return null;
  return payload;
}

// GET ?action=export
async function handleExport(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, isTraveler: true, isBuyer: true,
      emailVerified: true, phone: true, street: true, postalCode: true, city: true,
      country: true, latitude: true, longitude: true, preferredLocale: true,
      preferredLanguage: true, preferredCountry: true, timezone: true,
      createdAt: true, updatedAt: true, lastLoginAt: true,
    },
  });

  if (!user) return jsonResponse(404, { error: 'User not found' });

  const [trips, requests, buyerOrders, travelerOrders, sentMessages,
    ratingsGiven, ratingsReceived, subscriptions, wallet] = await Promise.all([
    prisma.trip.findMany({ where: { travellerId: userId } }),
    prisma.request.findMany({
      where: { buyerId: userId },
      include: { items: true },
    }),
    prisma.order.findMany({ where: { buyerId: userId } }),
    prisma.order.findMany({ where: { travelerId: userId } }),
    prisma.message.findMany({ where: { senderId: userId } }),
    prisma.rating.findMany({ where: { fromUserId: userId } }),
    prisma.rating.findMany({ where: { toUserId: userId } }),
    prisma.subscription.findMany({ where: { userId } }),
    prisma.wallet.findUnique({
      where: { userId },
      include: { accounts: true },
    }),
  ]);

  // Get wallet transactions if wallet exists
  let transactions = [];
  if (wallet) {
    const accountIds = wallet.accounts.map(a => a.id);
    if (accountIds.length > 0) {
      transactions = await prisma.ledgerEntry.findMany({
        where: {
          OR: [
            { debitAccountId: { in: accountIds } },
            { creditAccountId: { in: accountIds } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  // Get conversations
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ buyerId: userId }, { travellerId: userId }],
    },
    include: {
      messages: { where: { senderId: userId } },
    },
  });

  const exportData = {
    exportDate: new Date().toISOString(),
    profile: user,
    trips,
    requests,
    orders: { asBuyer: buyerOrders, asTraveler: travelerOrders },
    messages: sentMessages,
    conversations: conversations.map(c => ({
      id: c.id, tripId: c.tripId, status: c.status, createdAt: c.createdAt,
      myMessages: c.messages,
    })),
    ratings: { given: ratingsGiven, received: ratingsReceived },
    wallet: wallet ? {
      id: wallet.id, currency: wallet.currency, status: wallet.status,
      accounts: wallet.accounts.map(a => ({ type: a.type, balance: a.balance, currency: a.currency })),
    } : null,
    transactions,
    subscriptions,
  };

  const body = JSON.stringify(exportData, null, 2);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="flyandearn-my-data.json"',
    },
    body,
  };
}

// GET ?action=info
async function handleInfo(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, lastLoginAt: true },
  });

  if (!user) return jsonResponse(404, { error: 'User not found' });

  const [tripCount, requestCount, buyerOrderCount, travelerOrderCount,
    messageCount, wallet] = await Promise.all([
    prisma.trip.count({ where: { travellerId: userId } }),
    prisma.request.count({ where: { buyerId: userId } }),
    prisma.order.count({ where: { buyerId: userId } }),
    prisma.order.count({ where: { travelerId: userId } }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.wallet.findUnique({
      where: { userId },
      include: { accounts: { where: { type: 'AVAILABLE' } } },
    }),
  ]);

  return jsonResponse(200, {
    accountCreated: user.createdAt,
    lastLogin: user.lastLoginAt,
    dataSummary: {
      trips: tripCount,
      requests: requestCount,
      orders: buyerOrderCount + travelerOrderCount,
      messages: messageCount,
      walletBalance: wallet?.accounts?.[0]?.balance ?? 0,
      walletCurrency: wallet?.currency ?? 'EUR',
    },
  });
}

// DELETE ?action=delete
async function handleDelete(userId, event) {
  if (!checkRateLimit(userId)) {
    return jsonResponse(429, { error: 'Too many requests. Please wait 1 minute.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid request body' });
  }

  const { password } = body;
  if (!password) {
    return jsonResponse(400, { error: 'Password confirmation required' });
  }

  // Verify password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) return jsonResponse(404, { error: 'User not found' });

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    return jsonResponse(403, { error: 'Incorrect password' });
  }

  // Execute soft-delete in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Anonymize user
    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: `deleted-${userId}@anonymized.flyandearn.eu`,
        phone: null,
        street: null,
        postalCode: null,
        city: null,
        country: null,
        latitude: null,
        longitude: null,
        preferredLocale: null,
        preferredLanguage: null,
        preferredCountry: null,
        timezone: null,
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'GDPR account deletion request',
        stripeCustomerId: null,
        stripeConnectAccountId: null,
      },
    });

    // 2. Delete messages (personal data)
    await tx.message.deleteMany({ where: { senderId: userId } });

    // 3. Cancel active subscriptions
    await tx.subscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // 4. Delete password reset & email verification tokens
    await tx.passwordResetToken.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
  });

  return jsonResponse(200, {
    success: true,
    message: 'Your account has been deleted. Personal data has been anonymized. Financial records are retained as required by law.',
  });
}

export async function handler(event) {
  const method = event.httpMethod;
  const params = event.queryStringParameters || {};
  const action = params.action;

  // Authenticate
  const payload = await getAuthenticatedUser(event);
  if (!payload) {
    return jsonResponse(401, { error: 'Not authenticated' });
  }
  const userId = payload.userId;

  if (method === 'GET' && action === 'export') {
    return handleExport(userId);
  }

  if (method === 'GET' && action === 'info') {
    return handleInfo(userId);
  }

  if (method === 'DELETE' && action === 'delete') {
    return handleDelete(userId, event);
  }

  return jsonResponse(400, { error: 'Invalid action. Use: export, info, or delete' });
}

export const config = { path: ['/api/gdpr', '/.netlify/functions/gdpr'] };
