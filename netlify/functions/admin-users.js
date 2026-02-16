import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';

// Admin email whitelist from environment
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Check if user is admin
async function isAdmin(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

// Create audit log entry
async function createAuditLog(adminId, action, entityType, entityId, metadata = null, event = null) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        entityType,
        entityId,
        metadata,
        ipAddress: event?.headers?.['x-forwarded-for'] || event?.headers?.['client-ip'] || null,
        userAgent: event?.headers?.['user-agent'] || null,
      },
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
  }
}

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // Verify authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  // Verify admin access
  const adminCheck = await isAdmin(payload.userId);
  if (!adminCheck) {
    return jsonResponse(403, { error: 'Admin access required' });
  }

  const adminId = payload.userId;

  switch (httpMethod) {
    case 'GET':
      if (action === 'stats') return getStats(adminId);
      if (action === 'user') return getUser(event, adminId);
      return listUsers(event, adminId);

    case 'POST':
      if (action === 'ban') return banUser(event, adminId);
      if (action === 'unban') return unbanUser(event, adminId);
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /admin-users/stats - User statistics
async function getStats(adminId) {
  try {
    const [
      totalUsers,
      buyers,
      travelers,
      dualRole,
      verified,
      banned,
      newLast30Days,
      activeSubscribers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isBuyer: true } }),
      prisma.user.count({ where: { isTraveler: true } }),
      prisma.user.count({ where: { isBuyer: true, isTraveler: true } }),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.user.count({ where: { isBanned: true } }),
      prisma.user.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    return jsonResponse(200, {
      success: true,
      stats: {
        totalUsers,
        buyers,
        travelers,
        dualRole,
        verified,
        unverified: totalUsers - verified,
        banned,
        newLast30Days,
        activeSubscribers,
      },
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return jsonResponse(500, { error: 'Failed to fetch user stats' });
  }
}

// GET /admin-users - List users with filters
async function listUsers(event, adminId) {
  try {
    const params = event.queryStringParameters || {};
    const {
      search,
      role,
      status,
      verified,
      hasSubscription,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = '50',
      offset = '0',
    } = params;

    const where = {};

    // Search by email or name
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by role
    if (role === 'buyer') {
      where.isBuyer = true;
    } else if (role === 'traveler') {
      where.isTraveler = true;
    } else if (role === 'both') {
      where.isBuyer = true;
      where.isTraveler = true;
    }

    // Filter by status
    if (status === 'banned') {
      where.isBanned = true;
    } else if (status === 'active') {
      where.isBanned = false;
    }

    // Filter by verification
    if (verified === 'true') {
      where.emailVerified = true;
    } else if (verified === 'false') {
      where.emailVerified = false;
    }

    // Sorting
    const orderBy = {};
    orderBy[sortBy] = sortOrder.toLowerCase();

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isBuyer: true,
          isTraveler: true,
          emailVerified: true,
          isBanned: true,
          bannedReason: true,
          phone: true,
          city: true,
          country: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              requests: true,
              trips: true,
              buyerOrders: true,
              travelerOrders: true,
            },
          },
        },
        orderBy,
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.user.count({ where }),
    ]);

    // Get subscription status for each user
    const userIds = users.map(u => u.id);
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: { in: userIds },
        status: 'ACTIVE',
      },
      select: {
        userId: true,
        plan: { select: { tier: true, name: true } },
        endDate: true,
      },
    });

    const subscriptionMap = new Map(
      subscriptions.map(s => [s.userId, s])
    );

    const enrichedUsers = users.map(user => ({
      ...user,
      subscription: subscriptionMap.get(user.id) || null,
      requestCount: user._count.requests,
      tripCount: user._count.trips,
      buyerOrderCount: user._count.buyerOrders,
      travelerOrderCount: user._count.travelerOrders,
    }));

    return jsonResponse(200, {
      success: true,
      users: enrichedUsers,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: parseInt(offset, 10) + users.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return jsonResponse(500, { error: 'Failed to list users' });
  }
}

// GET /admin-users/user?id=xxx - Get user details
async function getUser(event, adminId) {
  try {
    const { id } = event.queryStringParameters || {};

    if (!id) {
      return jsonResponse(400, { error: 'User ID is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBuyer: true,
        isTraveler: true,
        emailVerified: true,
        emailVerifiedAt: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        lastLoginAt: true,
        phone: true,
        street: true,
        postalCode: true,
        city: true,
        country: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
        requests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            requestType: true,
            status: true,
            totalBudget: true,
            fromCity: true,
            toCity: true,
            createdAt: true,
          },
        },
        trips: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            fromCity: true,
            toCity: true,
            departureDate: true,
            status: true,
            createdAt: true,
          },
        },
        buyerOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            totalAmount: true,
            currency: true,
            createdAt: true,
          },
        },
        travelerOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            travelerAmount: true,
            currency: true,
            createdAt: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: {
            plan: { select: { tier: true, name: true } },
          },
        },
        wallet: {
          include: {
            accounts: true,
          },
        },
        ratingsReceived: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            overallScore: true,
            feedback: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    // Calculate average rating
    const ratings = await prisma.rating.aggregate({
      where: { toUserId: id },
      _avg: { overallScore: true },
      _count: true,
    });

    return jsonResponse(200, {
      success: true,
      user: {
        ...user,
        averageRating: ratings._avg.overallScore || 0,
        totalRatings: ratings._count,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return jsonResponse(500, { error: 'Failed to fetch user' });
  }
}

// POST /admin-users/ban - Ban a user
async function banUser(event, adminId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, reason } = body;

    if (!userId) {
      return jsonResponse(400, { error: 'User ID is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isBanned: true },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    if (ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return jsonResponse(403, { error: 'Cannot ban an admin user' });
    }

    if (user.isBanned) {
      return jsonResponse(400, { error: 'User is already banned' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: reason || 'No reason provided',
      },
      select: {
        id: true,
        email: true,
        name: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
      },
    });

    // Create audit log
    await createAuditLog(adminId, 'BAN', 'USER', userId, { reason }, event);

    return jsonResponse(200, {
      success: true,
      user: updatedUser,
      message: 'User has been banned',
    });
  } catch (error) {
    console.error('Error banning user:', error);
    return jsonResponse(500, { error: 'Failed to ban user' });
  }
}

// POST /admin-users/unban - Unban a user
async function unbanUser(event, adminId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId } = body;

    if (!userId) {
      return jsonResponse(400, { error: 'User ID is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    if (!user.isBanned) {
      return jsonResponse(400, { error: 'User is not banned' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isBanned: true,
      },
    });

    // Create audit log
    await createAuditLog(adminId, 'UNBAN', 'USER', userId, null, event);

    return jsonResponse(200, {
      success: true,
      user: updatedUser,
      message: 'User has been unbanned',
    });
  } catch (error) {
    console.error('Error unbanning user:', error);
    return jsonResponse(500, { error: 'Failed to unban user' });
  }
}
