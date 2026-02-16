import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
      if (action === 'order') return getOrder(event, adminId);
      return listOrders(event, adminId);

    case 'POST':
      if (action === 'refund') return refundOrder(event, adminId);
      if (action === 'complete') return completeOrder(event, adminId);
      if (action === 'auto-release') return autoReleaseOrders(event, adminId);
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /admin-orders/stats - Order statistics
async function getStats(adminId) {
  try {
    const [
      total,
      pendingPayment,
      paid,
      inProgress,
      completed,
      refunded,
      disputed,
      cancelled,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.count({ where: { status: 'REFUNDED' } }),
      prisma.order.count({ where: { status: 'DISPUTED' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
    ]);

    // Revenue stats
    const revenue = await prisma.order.aggregate({
      where: { status: { in: ['PAID', 'IN_PROGRESS', 'COMPLETED'] } },
      _sum: {
        totalAmount: true,
        platformFee: true,
        travellerServiceFee: true,
      },
    });

    // Orders eligible for auto-release
    const autoReleaseEligible = await prisma.order.count({
      where: {
        status: 'PAID',
        releaseAt: { lte: new Date() },
      },
    });

    // Last 30 days
    const last30Days = await prisma.order.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    return jsonResponse(200, {
      success: true,
      stats: {
        total,
        byStatus: {
          pendingPayment,
          paid,
          inProgress,
          completed,
          refunded,
          disputed,
          cancelled,
        },
        revenue: {
          totalAmount: revenue._sum.totalAmount || 0,
          platformFees: revenue._sum.platformFee || 0,
          travelerFees: revenue._sum.travellerServiceFee || 0,
        },
        autoReleaseEligible,
        last30Days,
      },
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return jsonResponse(500, { error: 'Failed to fetch order stats' });
  }
}

// GET /admin-orders - List orders with filters
async function listOrders(event, adminId) {
  try {
    const params = event.queryStringParameters || {};
    const {
      status,
      buyerId,
      travelerId,
      search,
      minAmount,
      maxAmount,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = '50',
      offset = '0',
    } = params;

    const where = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (travelerId) {
      where.travelerId = travelerId;
    }

    if (minAmount) {
      where.totalAmount = { gte: parseFloat(minAmount) };
    }

    if (maxAmount) {
      where.totalAmount = { ...where.totalAmount, lte: parseFloat(maxAmount) };
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { buyer: { name: { contains: search, mode: 'insensitive' } } },
        { buyer: { email: { contains: search, mode: 'insensitive' } } },
        { traveler: { name: { contains: search, mode: 'insensitive' } } },
        { traveler: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder.toLowerCase();

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          buyer: {
            select: { id: true, name: true, email: true },
          },
          traveler: {
            select: { id: true, name: true, email: true },
          },
          request: {
            select: { id: true, product: true, fromCity: true, toCity: true },
          },
        },
        orderBy,
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.order.count({ where }),
    ]);

    return jsonResponse(200, {
      success: true,
      orders,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: parseInt(offset, 10) + orders.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing orders:', error);
    return jsonResponse(500, { error: 'Failed to list orders' });
  }
}

// GET /admin-orders/order?id=xxx - Get order details
async function getOrder(event, adminId) {
  try {
    const { id } = event.queryStringParameters || {};

    if (!id) {
      return jsonResponse(400, { error: 'Order ID is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        traveler: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        request: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    // Get ledger entries for this order
    const travelerWallet = await prisma.wallet.findUnique({
      where: { userId: order.travelerId },
      include: { accounts: true },
    });

    let ledgerEntries = [];
    if (travelerWallet) {
      const accountIds = travelerWallet.accounts.map(a => a.id);
      ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          referenceType: 'ORDER',
          referenceId: order.id,
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    return jsonResponse(200, {
      success: true,
      order,
      ledgerEntries,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return jsonResponse(500, { error: 'Failed to fetch order' });
  }
}

// POST /admin-orders/refund - Refund an order
async function refundOrder(event, adminId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId, reason } = body;

    if (!orderId) {
      return jsonResponse(400, { error: 'Order ID is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    if (!['PAID', 'IN_PROGRESS'].includes(order.status)) {
      return jsonResponse(400, {
        error: `Cannot refund order with status: ${order.status}`,
      });
    }

    // Create Stripe refund
    if (order.stripePaymentIntentId) {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        reason: 'requested_by_customer',
      });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        refundedAt: new Date(),
      },
    });

    // Update request status
    await prisma.request.update({
      where: { id: order.requestId },
      data: { status: 'OPEN' },
    });

    // Create audit log
    await createAuditLog(adminId, 'REFUND', 'ORDER', orderId, { reason }, event);

    return jsonResponse(200, {
      success: true,
      order: updatedOrder,
      message: 'Order has been refunded',
    });
  } catch (error) {
    console.error('Error refunding order:', error);
    return jsonResponse(500, { error: 'Failed to refund order' });
  }
}

// POST /admin-orders/complete - Force complete an order
async function completeOrder(event, adminId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId, reason } = body;

    if (!orderId) {
      return jsonResponse(400, { error: 'Order ID is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    if (!['PAID', 'IN_PROGRESS'].includes(order.status)) {
      return jsonResponse(400, {
        error: `Cannot complete order with status: ${order.status}`,
      });
    }

    // Release funds to traveler
    const travelerWallet = await prisma.wallet.findUnique({
      where: { userId: order.travelerId },
      include: { accounts: true },
    });

    if (travelerWallet) {
      const pendingAccount = travelerWallet.accounts.find(a => a.type === 'PENDING');
      const availableAccount = travelerWallet.accounts.find(a => a.type === 'AVAILABLE');

      if (pendingAccount && availableAccount && pendingAccount.balance >= order.travelerAmount) {
        await prisma.$transaction([
          prisma.walletAccount.update({
            where: { id: pendingAccount.id },
            data: { balance: { decrement: order.travelerAmount } },
          }),
          prisma.walletAccount.update({
            where: { id: availableAccount.id },
            data: { balance: { increment: order.travelerAmount } },
          }),
          prisma.ledgerEntry.create({
            data: {
              type: 'RELEASE',
              status: 'COMPLETED',
              amount: order.travelerAmount,
              currency: order.currency,
              debitAccountId: pendingAccount.id,
              creditAccountId: availableAccount.id,
              referenceType: 'ORDER',
              referenceId: order.id,
              idempotencyKey: `admin-release-${order.id}-${Date.now()}`,
              description: `Admin release for order ${order.id}`,
              createdBy: adminId,
            },
          }),
        ]);
      }
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update request status
    await prisma.request.update({
      where: { id: order.requestId },
      data: { status: 'COMPLETED' },
    });

    // Create audit log
    await createAuditLog(adminId, 'COMPLETE', 'ORDER', orderId, { reason }, event);

    return jsonResponse(200, {
      success: true,
      order: updatedOrder,
      message: 'Order has been completed and funds released',
    });
  } catch (error) {
    console.error('Error completing order:', error);
    return jsonResponse(500, { error: 'Failed to complete order' });
  }
}

// POST /admin-orders/auto-release - Release all eligible orders
async function autoReleaseOrders(event, adminId) {
  try {
    const eligibleOrders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        releaseAt: { lte: new Date() },
      },
      include: {
        traveler: {
          include: {
            wallet: {
              include: { accounts: true },
            },
          },
        },
      },
    });

    const results = [];

    for (const order of eligibleOrders) {
      try {
        const wallet = order.traveler?.wallet;
        if (!wallet) {
          results.push({ orderId: order.id, status: 'error', message: 'No wallet found' });
          continue;
        }

        const pendingAccount = wallet.accounts.find(a => a.type === 'PENDING');
        const availableAccount = wallet.accounts.find(a => a.type === 'AVAILABLE');

        if (!pendingAccount || !availableAccount) {
          results.push({ orderId: order.id, status: 'error', message: 'Missing accounts' });
          continue;
        }

        if (pendingAccount.balance < order.travelerAmount) {
          results.push({ orderId: order.id, status: 'error', message: 'Insufficient pending balance' });
          continue;
        }

        await prisma.$transaction([
          prisma.walletAccount.update({
            where: { id: pendingAccount.id },
            data: { balance: { decrement: order.travelerAmount } },
          }),
          prisma.walletAccount.update({
            where: { id: availableAccount.id },
            data: { balance: { increment: order.travelerAmount } },
          }),
          prisma.ledgerEntry.create({
            data: {
              type: 'RELEASE',
              status: 'COMPLETED',
              amount: order.travelerAmount,
              currency: order.currency,
              debitAccountId: pendingAccount.id,
              creditAccountId: availableAccount.id,
              referenceType: 'ORDER',
              referenceId: order.id,
              idempotencyKey: `auto-release-${order.id}-${Date.now()}`,
              description: `Auto-release for order ${order.id}`,
              createdBy: adminId,
            },
          }),
          prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          }),
          prisma.request.update({
            where: { id: order.requestId },
            data: { status: 'COMPLETED' },
          }),
        ]);

        results.push({ orderId: order.id, status: 'released', amount: order.travelerAmount });
      } catch (err) {
        results.push({ orderId: order.id, status: 'error', message: err.message });
      }
    }

    // Create audit log
    await createAuditLog(adminId, 'AUTO_RELEASE', 'ORDER', 'batch', {
      totalProcessed: eligibleOrders.length,
      results,
    }, event);

    return jsonResponse(200, {
      success: true,
      processed: eligibleOrders.length,
      results,
    });
  } catch (error) {
    console.error('Error auto-releasing orders:', error);
    return jsonResponse(500, { error: 'Failed to auto-release orders' });
  }
}
