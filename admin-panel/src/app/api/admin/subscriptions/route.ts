import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (planId) {
      where.planId = planId;
    }

    if (search) {
      where.userId = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'currentPrice') {
      orderBy.currentPrice = sortOrder;
    } else if (sortBy === 'status') {
      orderBy.status = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Fetch subscriptions with plan details
    const [subscriptions, totalCount, statusCounts] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          plan: {
            select: {
              id: true,
              name: true,
              tier: true,
              monthlyPrice: true,
            },
          },
        },
      }),
      prisma.subscription.count({ where }),
      prisma.subscription.groupBy({
        by: ['status'],
        _count: true,
      }),
    ]);

    // Process status counts
    const statusCountsMap = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const response = {
      success: true,
      data: {
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          userId: sub.userId,
          planId: sub.planId,
          planName: sub.plan.name,
          planTier: sub.plan.tier,
          status: sub.status,
          billingCycle: sub.billingCycle,
          currentPrice: Number(sub.currentPrice),
          currency: sub.currency,
          startDate: sub.startDate,
          trialStartDate: sub.trialStartDate,
          trialEndDate: sub.trialEndDate,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          nextBillingDate: sub.nextBillingDate,
          cancelledAt: sub.cancelledAt,
          cancelReason: sub.cancelReason,
          createdAt: sub.createdAt,
        })),
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        filters: {
          statusCounts: statusCountsMap,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Subscriptions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
