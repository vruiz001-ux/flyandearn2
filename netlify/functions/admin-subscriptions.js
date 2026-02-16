import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import { initializeSubscriptionPlans } from './lib/subscription.js';

// Admin emails (configure via environment variable)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

/**
 * Check if user is admin
 */
async function isAdmin(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // All admin endpoints require authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  // Check admin access
  if (!(await isAdmin(payload.userId))) {
    return jsonResponse(403, { error: 'Admin access required' });
  }

  try {
    switch (httpMethod) {
      case 'GET':
        if (action === 'stats') {
          return getSubscriptionStats();
        }
        if (action === 'subscriptions' || action === 'admin-subscriptions') {
          return getAllSubscriptions(event);
        }
        if (action === 'plans') {
          return getPlans();
        }
        if (action === 'revenue') {
          return getRevenueStats(event);
        }
        return jsonResponse(400, { error: 'Unknown action' });

      case 'POST':
        if (action === 'init-plans') {
          return initPlans();
        }
        if (action === 'update-plan') {
          return updatePlan(event);
        }
        if (action === 'cancel-subscription') {
          return adminCancelSubscription(event);
        }
        if (action === 'extend-subscription') {
          return extendSubscription(event);
        }
        return jsonResponse(400, { error: 'Unknown action' });

      default:
        return jsonResponse(405, { error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Admin subscription error:', error);
    return jsonResponse(500, { error: 'Internal server error', details: error.message });
  }
}

/**
 * GET /admin-subscriptions/stats - Get subscription statistics
 */
async function getSubscriptionStats() {
  const now = new Date();

  // Active subscriptions by tier
  const activeByTier = await prisma.subscription.groupBy({
    by: ['status'],
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
    },
    _count: true,
  });

  // Subscriptions by plan
  const byPlan = await prisma.subscription.groupBy({
    by: ['planId'],
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
    },
    _count: true,
    _sum: { amountPaid: true },
  });

  // Get plan names
  const plans = await prisma.subscriptionPlan.findMany();
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]));

  const subscriptionsByPlan = byPlan.map(b => ({
    planId: b.planId,
    planName: planMap[b.planId]?.name || 'Unknown',
    tier: planMap[b.planId]?.tier || 'Unknown',
    count: b._count,
    revenue: b._sum.amountPaid || 0,
  }));

  // Total counts
  const totalActive = await prisma.subscription.count({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
    },
  });

  const totalExpired = await prisma.subscription.count({
    where: {
      OR: [
        { status: 'EXPIRED' },
        { status: 'ACTIVE', endDate: { lt: now } },
      ],
    },
  });

  const totalCancelled = await prisma.subscription.count({
    where: { status: 'CANCELLED' },
  });

  const totalPending = await prisma.subscription.count({
    where: { status: 'PENDING_PAYMENT' },
  });

  // Revenue stats
  const totalRevenue = await prisma.subscription.aggregate({
    where: { status: 'ACTIVE' },
    _sum: { amountPaid: true },
  });

  // This month's subscriptions
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyNew = await prisma.subscription.count({
    where: {
      createdAt: { gte: startOfMonth },
      status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
    },
  });

  const monthlyRevenue = await prisma.subscription.aggregate({
    where: {
      createdAt: { gte: startOfMonth },
      status: 'ACTIVE',
    },
    _sum: { amountPaid: true },
  });

  // Purchase usage stats
  const purchaseStats = await prisma.subscription.aggregate({
    where: {
      status: 'ACTIVE',
      endDate: { gte: now },
    },
    _sum: { purchasesUsed: true },
    _avg: { purchasesUsed: true },
  });

  return jsonResponse(200, {
    success: true,
    stats: {
      active: totalActive,
      expired: totalExpired,
      cancelled: totalCancelled,
      pending: totalPending,
      byPlan: subscriptionsByPlan,
      revenue: {
        total: totalRevenue._sum.amountPaid || 0,
        thisMonth: monthlyRevenue._sum.amountPaid || 0,
        newThisMonth: monthlyNew,
      },
      purchases: {
        totalUsed: purchaseStats._sum.purchasesUsed || 0,
        avgPerSubscription: Math.round((purchaseStats._avg.purchasesUsed || 0) * 10) / 10,
      },
    },
  });
}

/**
 * GET /admin-subscriptions/subscriptions - Get all subscriptions with filters
 */
async function getAllSubscriptions(event) {
  const params = event.queryStringParameters || {};
  const { status, planTier, limit = '50', offset = '0', search } = params;

  const where = {};

  if (status) {
    where.status = status.toUpperCase();
  }

  if (planTier) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { tier: planTier } });
    if (plan) {
      where.planId = plan.id;
    }
  }

  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, name: true, country: true } },
        plan: { select: { tier: true, name: true, purchaseLimit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    }),
    prisma.subscription.count({ where }),
  ]);

  return jsonResponse(200, {
    success: true,
    subscriptions: subscriptions.map(sub => ({
      id: sub.id,
      user: sub.user,
      plan: sub.plan,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      purchasesUsed: sub.purchasesUsed,
      purchaseLimit: sub.purchaseLimit,
      currency: sub.currency,
      amountPaid: sub.amountPaid,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      createdAt: sub.createdAt,
      cancelledAt: sub.cancelledAt,
    })),
    total,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });
}

/**
 * GET /admin-subscriptions/plans - Get all plans
 */
async function getPlans() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { priceEur: 'asc' },
    include: {
      _count: {
        select: {
          subscriptions: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    },
  });

  return jsonResponse(200, {
    success: true,
    plans: plans.map(p => ({
      id: p.id,
      tier: p.tier,
      name: p.name,
      priceEur: p.priceEur,
      pricePln: p.pricePln,
      purchaseLimit: p.purchaseLimit,
      description: p.description,
      features: p.features,
      isActive: p.isActive,
      activeSubscriptions: p._count.subscriptions,
    })),
  });
}

/**
 * GET /admin-subscriptions/revenue - Get revenue breakdown
 */
async function getRevenueStats(event) {
  const params = event.queryStringParameters || {};
  const { period = '30' } = params; // days

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(period, 10));

  // Revenue by currency
  const byCurrency = await prisma.subscription.groupBy({
    by: ['currency'],
    where: {
      status: 'ACTIVE',
      createdAt: { gte: startDate },
    },
    _sum: { amountPaid: true },
    _count: true,
  });

  // Revenue by plan
  const byPlan = await prisma.subscription.groupBy({
    by: ['planId'],
    where: {
      status: 'ACTIVE',
      createdAt: { gte: startDate },
    },
    _sum: { amountPaid: true },
    _count: true,
  });

  const plans = await prisma.subscriptionPlan.findMany();
  const planMap = Object.fromEntries(plans.map(p => [p.id, p]));

  // Daily breakdown (last 30 days)
  const dailyRevenue = await prisma.$queryRaw`
    SELECT
      DATE("createdAt") as date,
      COUNT(*) as count,
      SUM("amountPaid") as revenue
    FROM "Subscription"
    WHERE "status" = 'ACTIVE'
      AND "createdAt" >= ${startDate}
    GROUP BY DATE("createdAt")
    ORDER BY date DESC
  `;

  return jsonResponse(200, {
    success: true,
    revenue: {
      period: parseInt(period, 10),
      byCurrency: byCurrency.map(c => ({
        currency: c.currency,
        total: c._sum.amountPaid || 0,
        count: c._count,
      })),
      byPlan: byPlan.map(p => ({
        planId: p.planId,
        planName: planMap[p.planId]?.name || 'Unknown',
        tier: planMap[p.planId]?.tier || 'Unknown',
        total: p._sum.amountPaid || 0,
        count: p._count,
      })),
      daily: dailyRevenue,
    },
  });
}

/**
 * POST /admin-subscriptions/init-plans - Initialize subscription plans
 */
async function initPlans() {
  await initializeSubscriptionPlans();
  const plans = await prisma.subscriptionPlan.findMany();

  return jsonResponse(200, {
    success: true,
    message: 'Subscription plans initialized',
    plans,
  });
}

/**
 * POST /admin-subscriptions/update-plan - Update a subscription plan
 */
async function updatePlan(event) {
  const body = JSON.parse(event.body || '{}');
  const { planId, priceEur, pricePln, purchaseLimit, description, features, isActive } = body;

  if (!planId) {
    return jsonResponse(400, { error: 'planId is required' });
  }

  const updateData = {};
  if (priceEur !== undefined) updateData.priceEur = priceEur;
  if (pricePln !== undefined) updateData.pricePln = pricePln;
  if (purchaseLimit !== undefined) updateData.purchaseLimit = purchaseLimit;
  if (description !== undefined) updateData.description = description;
  if (features !== undefined) updateData.features = features;
  if (isActive !== undefined) updateData.isActive = isActive;

  const plan = await prisma.subscriptionPlan.update({
    where: { id: planId },
    data: updateData,
  });

  return jsonResponse(200, {
    success: true,
    message: 'Plan updated',
    plan,
  });
}

/**
 * POST /admin-subscriptions/cancel-subscription - Cancel a user's subscription
 */
async function adminCancelSubscription(event) {
  const body = JSON.parse(event.body || '{}');
  const { subscriptionId, reason } = body;

  if (!subscriptionId) {
    return jsonResponse(400, { error: 'subscriptionId is required' });
  }

  const subscription = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
    include: { user: { select: { email: true, name: true } } },
  });

  return jsonResponse(200, {
    success: true,
    message: `Subscription cancelled for ${subscription.user.email}`,
    subscription: {
      id: subscription.id,
      status: subscription.status,
      cancelledAt: subscription.cancelledAt,
    },
  });
}

/**
 * POST /admin-subscriptions/extend-subscription - Extend a subscription's end date
 */
async function extendSubscription(event) {
  const body = JSON.parse(event.body || '{}');
  const { subscriptionId, days } = body;

  if (!subscriptionId || !days) {
    return jsonResponse(400, { error: 'subscriptionId and days are required' });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return jsonResponse(404, { error: 'Subscription not found' });
  }

  const currentEnd = subscription.endDate || new Date();
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + parseInt(days, 10));

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      endDate: newEnd,
      status: 'ACTIVE', // Reactivate if expired
    },
    include: { user: { select: { email: true } } },
  });

  return jsonResponse(200, {
    success: true,
    message: `Subscription extended by ${days} days`,
    subscription: {
      id: updated.id,
      endDate: updated.endDate,
      status: updated.status,
    },
  });
}
