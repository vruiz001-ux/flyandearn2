import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { logAuditAction, getClientIP, getUserAgent } from '@/lib/auth';
import { AuditAction } from '@prisma/client';

// GET - List users with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('perPage') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const role = searchParams.get('role') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDirection = (searchParams.get('sortDirection') || 'desc') as 'asc' | 'desc';

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (role) {
      where.role = role;
    }

    // Count total
    const total = await prisma.user.count({ where });

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        displayName: true,
        role: true,
        status: true,
        emailVerified: true,
        city: true,
        country: true,
        createdAt: true,
        lastActiveAt: true,
        wallet: {
          select: {
            balance: true,
          },
        },
        _count: {
          select: {
            requestsCreated: true,
            matchesAsTraveller: true,
          },
        },
      },
      orderBy: { [sortBy]: sortDirection },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    // Format response with masked data
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: maskEmail(user.email),
      phone: user.phone ? maskPhone(user.phone) : null,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      location: [user.city, user.country].filter(Boolean).join(', ') || null,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      walletBalance: Number(user.wallet?.balance) || 0,
      requestCount: user._count.requestsCreated,
      matchCount: user._count.matchesAsTraveller,
    }));

    return NextResponse.json({
      success: true,
      data: formattedUsers,
      pagination: {
        total,
        page,
        perPage,
        totalPages: Math.ceil(total / perPage),
      },
    });
  } catch (error) {
    console.error('Users API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// PATCH - Update user status (suspend/unsuspend)
export async function PATCH(request: NextRequest) {
  try {
    const adminId = request.headers.get('x-admin-id');
    const body = await request.json();

    const schema = z.object({
      userId: z.string(),
      action: z.enum(['suspend', 'unsuspend', 'resetWallet']),
      reason: z.string().optional(),
    });

    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 }
      );
    }

    const { userId, action, reason } = validation.data;
    const ipAddress = getClientIP(request);
    const userAgent = getUserAgent(request);

    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (action === 'suspend') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: 'SUSPENDED',
          suspendedAt: new Date(),
          suspendReason: reason,
        },
      });

      await logAuditAction({
        adminId,
        action: AuditAction.USER_SUSPENDED,
        targetType: 'user',
        targetId: userId,
        ipAddress,
        userAgent,
        details: { reason },
        previousValue: { status: user.status },
        newValue: { status: 'SUSPENDED' },
      });
    } else if (action === 'unsuspend') {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: 'ACTIVE',
          suspendedAt: null,
          suspendReason: null,
        },
      });

      await logAuditAction({
        adminId,
        action: AuditAction.USER_UNSUSPENDED,
        targetType: 'user',
        targetId: userId,
        ipAddress,
        userAgent,
        previousValue: { status: user.status },
        newValue: { status: 'ACTIVE' },
      });
    } else if (action === 'resetWallet') {
      if (user.wallet) {
        const previousBalance = user.wallet.balance;

        await prisma.wallet.update({
          where: { id: user.wallet.id },
          data: { balance: 0, holdBalance: 0 },
        });

        await logAuditAction({
          adminId,
          action: AuditAction.WALLET_RESET,
          targetType: 'wallet',
          targetId: user.wallet.id,
          ipAddress,
          userAgent,
          details: { userId, reason },
          previousValue: { balance: Number(previousBalance) },
          newValue: { balance: 0 },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// Helper functions
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const maskedLocal = local.length > 3
    ? `${local.slice(0, 2)}***${local.slice(-1)}`
    : `${local[0]}***`;
  return `${maskedLocal}@${domain}`;
}

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}
