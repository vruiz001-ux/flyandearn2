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

export async function handler(event) {
  const { httpMethod } = event;

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

  switch (httpMethod) {
    case 'GET':
      return listAuditLogs(event);
    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

// GET /admin-audit - List audit logs with filters
async function listAuditLogs(event) {
  try {
    const params = event.queryStringParameters || {};
    const {
      adminId,
      action,
      entityType,
      entityId,
      startDate,
      endDate,
      sortOrder = 'desc',
      limit = '50',
      offset = '0',
    } = params;

    const where = {};

    if (adminId) {
      where.adminId = adminId;
    }

    if (action) {
      where.action = action.toUpperCase();
    }

    if (entityType) {
      where.entityType = entityType.toUpperCase();
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sortOrder.toLowerCase() },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10),
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Get admin user names
    const adminIds = [...new Set(logs.map(l => l.adminId).filter(Boolean))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, name: true, email: true },
    });
    const adminMap = new Map(admins.map(a => [a.id, a]));

    const enrichedLogs = logs.map(log => ({
      ...log,
      admin: log.adminId ? adminMap.get(log.adminId) : null,
    }));

    // Get action and entity type counts for filtering
    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: true,
    });

    const entityTypeCounts = await prisma.auditLog.groupBy({
      by: ['entityType'],
      _count: true,
    });

    return jsonResponse(200, {
      success: true,
      logs: enrichedLogs,
      filters: {
        actions: actionCounts.map(a => ({ action: a.action, count: a._count })),
        entityTypes: entityTypeCounts.map(e => ({ entityType: e.entityType, count: e._count })),
      },
      pagination: {
        total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        hasMore: parseInt(offset, 10) + logs.length < total,
      },
    });
  } catch (error) {
    console.error('Error listing audit logs:', error);
    return jsonResponse(500, { error: 'Failed to list audit logs' });
  }
}
