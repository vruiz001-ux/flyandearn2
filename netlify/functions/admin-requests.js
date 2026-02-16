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
      if (action === 'request') return getRequest(event, adminId);
      return listRequests(event, adminId);

    case 'POST':
      if (action === 'cancel') return cancelRequest(event, adminId);
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /admin-requests/stats - Request statistics
async function getStats(adminId) {
  try {
    const [
      total,
      open,
      matched,
      inProgress,
      completed,
      cancelled,
      last30Days,
      dutyFree,
      outsideDutyFree,
      both,
    ] = await Promise.all([
      prisma.request.count(),
      prisma.request.count({ where: { status: 'OPEN' } }),
      prisma.request.count({ where: { status: 'MATCHED' } }),
      prisma.request.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.request.count({ where: { status: 'COMPLETED' } }),
      prisma.request.count({ where: { status: 'CANCELLED' } }),
      prisma.request.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.request.count({ where: { requestType: 'DUTY_FREE' } }),
      prisma.request.count({ where: { requestType: 'OUTSIDE_DUTY_FREE' } }),
      prisma.request.count({ where: { requestType: 'BOTH' } }),
    ]);

    // Top routes
    const topRoutes = await prisma.request.groupBy({
      by: ['fromCity', 'toCity'],
      _count: true,
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return jsonResponse(200, {
      success: true,
      stats: {
        total,
        byStatus: { open, matched, inProgress, completed, cancelled },
        last30Days,
        byType: { dutyFree, outsideDutyFree, both },
        topRoutes: topRoutes.map(r => ({
          route: `${r.fromCity} → ${r.toCity}`,
          count: r._count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching request stats:', error);
    return jsonResponse(500, { error: 'Failed to fetch request stats' });
  }
}

// GET /admin-requests - List requests with filters
async function listRequests(event, adminId) {
  try {
    const params = event.queryStringParameters || {};
    const {
      status,
      type,
      buyerId,
      search,
      fromCity,
      toCity,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = '50',
      offset = '0',
    } = params;

    const where = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (type) {
      where.requestType = type.toUpperCase();
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (fromCity) {
      where.fromCity = { contains: fromCity, mode: 'insensitive' };
    }

    if (toCity) {
      where.toCity = { contains: toCity, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { product: { contains: search, mode: 'insensitive' } },
        { generalNotes: { contains: search, mode: 'insensitive' } },
        { buyer: { name: { contains: search, mode: 'insensitive' } } },
        { buyer: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder.toLowerCase();

    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        include: {
          buyer: {
            select: { id: true, name: true, email: true },
          },
          items: {
            select: { id: true, itemName: true, quantity: true, budgetPrice: true },
          },
          offers: {
            select: { id: true, travelerId: true, status: true },
          },
          order: {
            select: { id: true, status: true, totalAmount: true },
          },
        },
        orderBy,
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.request.count({ where }),
    ]);

    return jsonResponse(200, {
      success: true,
      requests: requests.map(r => ({
        ...r,
        offerCount: r.offers.length,
        itemCount: r.items.length,
      })),
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: parseInt(offset, 10) + requests.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing requests:', error);
    return jsonResponse(500, { error: 'Failed to list requests' });
  }
}

// GET /admin-requests/request?id=xxx - Get request details
async function getRequest(event, adminId) {
  try {
    const { id } = event.queryStringParameters || {};

    if (!id) {
      return jsonResponse(400, { error: 'Request ID is required' });
    }

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            country: true,
          },
        },
        items: true,
        offers: {
          include: {
            traveler: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        order: {
          include: {
            traveler: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    return jsonResponse(200, {
      success: true,
      request,
    });
  } catch (error) {
    console.error('Error fetching request:', error);
    return jsonResponse(500, { error: 'Failed to fetch request' });
  }
}

// POST /admin-requests/cancel - Cancel a request
async function cancelRequest(event, adminId) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { requestId, reason } = body;

    if (!requestId) {
      return jsonResponse(400, { error: 'Request ID is required' });
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { order: true },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    if (request.status === 'CANCELLED') {
      return jsonResponse(400, { error: 'Request is already cancelled' });
    }

    if (request.order && ['PAID', 'IN_PROGRESS'].includes(request.order.status)) {
      return jsonResponse(400, {
        error: 'Cannot cancel request with active order. Cancel the order first.',
      });
    }

    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    // Create audit log
    await createAuditLog(adminId, 'CANCEL', 'REQUEST', requestId, { reason }, event);

    return jsonResponse(200, {
      success: true,
      request: updatedRequest,
      message: 'Request has been cancelled',
    });
  } catch (error) {
    console.error('Error cancelling request:', error);
    return jsonResponse(500, { error: 'Failed to cancel request' });
  }
}
