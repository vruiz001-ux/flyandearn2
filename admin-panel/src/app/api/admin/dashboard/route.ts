import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDateRange } from '@/lib/utils';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '30d') as 'today' | '7d' | '30d' | '90d' | 'all';

    const { startDate, endDate } = getDateRange(range);

    // Get previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime() - 1);

    // Fetch all metrics in parallel
    const [
      // Current period stats
      dailyStats,
      totalUsers,
      newUsers,
      verifiedUsers,
      totalRequests,
      openRequests,
      completedRequests,
      totalMatches,
      acceptedMatches,
      completedMatches,
      walletStats,
      pendingPayouts,
      conversationCount,
      messageCount,
      disputeStats,

      // Previous period stats for comparison
      prevDailyStats,
      prevUsers,
      prevRequests,
      prevMatches,

      // Charts data
      chartData,

      // Geo data
      geoData,
    ] = await Promise.all([
      // Daily stats aggregated
      prisma.dailyStats.aggregate({
        where: { date: { gte: startDate, lte: endDate } },
        _sum: {
          totalVisits: true,
          uniqueVisitors: true,
          pageviews: true,
          gmv: true,
          platformFees: true,
          totalPayouts: true,
          messagesSent: true,
        },
      }),

      // Users
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.user.count({
        where: { emailVerified: true },
      }),

      // Requests
      prisma.request.count(),
      prisma.request.count({
        where: { status: 'OPEN' },
      }),
      prisma.request.count({
        where: { status: 'COMPLETED' },
      }),

      // Matches
      prisma.match.count(),
      prisma.match.count({
        where: { status: 'ACCEPTED' },
      }),
      prisma.match.count({
        where: { status: 'COMPLETED' },
      }),

      // Wallet stats
      prisma.wallet.aggregate({
        _sum: {
          balance: true,
          holdBalance: true,
        },
      }),

      // Pending payouts
      prisma.walletTransaction.aggregate({
        where: {
          type: 'PAYOUT',
          status: 'PENDING',
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Messages
      prisma.conversation.count(),
      prisma.message.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),

      // Disputes
      prisma.dispute.groupBy({
        by: ['status'],
        _count: true,
        _sum: { refundAmount: true },
      }),

      // Previous period comparisons
      prisma.dailyStats.aggregate({
        where: { date: { gte: prevStartDate, lte: prevEndDate } },
        _sum: {
          totalVisits: true,
          uniqueVisitors: true,
        },
      }),
      prisma.user.count({
        where: { createdAt: { gte: prevStartDate, lte: prevEndDate } },
      }),
      prisma.request.count({
        where: { createdAt: { gte: prevStartDate, lte: prevEndDate } },
      }),
      prisma.match.count({
        where: { createdAt: { gte: prevStartDate, lte: prevEndDate } },
      }),

      // Chart data - daily breakdown
      prisma.dailyStats.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          totalVisits: true,
          uniqueVisitors: true,
          pageviews: true,
          newSignups: true,
          newRequests: true,
          completedRequests: true,
          gmv: true,
        },
      }),

      // Geographic data from events
      prisma.event.groupBy({
        by: ['country'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          country: { not: null },
        },
        _count: true,
        orderBy: { _count: { country: 'desc' } },
        take: 10,
      }),
    ]);

    // Calculate changes
    const currentVisits = dailyStats._sum.totalVisits || 0;
    const prevVisits = prevDailyStats._sum.totalVisits || 0;
    const visitsChange = prevVisits > 0 ? ((currentVisits - prevVisits) / prevVisits) * 100 : 0;

    const usersChange = prevUsers > 0 ? ((newUsers - prevUsers) / prevUsers) * 100 : 0;

    // Calculate acceptance rate
    const acceptanceRate = totalMatches > 0 ? (acceptedMatches / totalMatches) * 100 : 0;

    // Process dispute stats
    const openDisputes = disputeStats.find(d => d.status === 'OPEN')?._count || 0;
    const resolvedDisputes = disputeStats.filter(d =>
      ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_SPLIT', 'CLOSED'].includes(d.status)
    ).reduce((sum, d) => sum + d._count, 0);
    const totalRefunds = disputeStats.reduce((sum, d) => sum + (Number(d._sum.refundAmount) || 0), 0);

    // Format chart data
    const formattedChartData = chartData.map((d) => ({
      date: format(d.date, 'MMM d'),
      visits: d.totalVisits,
      unique: d.uniqueVisitors,
      pageviews: d.pageviews,
      signups: d.newSignups,
      requests: d.newRequests,
      completed: d.completedRequests,
      gmv: Number(d.gmv),
    }));

    // Calculate GMV and avg order value
    const totalGMV = Number(dailyStats._sum.gmv) || 0;
    const avgOrderValue = completedMatches > 0 ? totalGMV / completedMatches : 0;

    const response = {
      success: true,
      data: {
        kpis: {
          visitors: {
            total: currentVisits,
            unique: dailyStats._sum.uniqueVisitors || 0,
            pageviews: dailyStats._sum.pageviews || 0,
            change: visitsChange,
          },
          users: {
            total: totalUsers,
            newSignups: newUsers,
            verified: verifiedUsers,
            change: usersChange,
          },
          requests: {
            total: totalRequests,
            open: openRequests,
            completed: completedRequests,
            change: prevRequests > 0 ? ((totalRequests - prevRequests) / prevRequests) * 100 : 0,
          },
          matches: {
            total: totalMatches,
            accepted: acceptedMatches,
            completed: completedMatches,
            acceptanceRate,
          },
          financial: {
            gmv: totalGMV,
            platformFees: Number(dailyStats._sum.platformFees) || 0,
            totalPayouts: Number(dailyStats._sum.totalPayouts) || 0,
            pendingPayouts: Math.abs(Number(pendingPayouts._sum.amount)) || 0,
            avgOrderValue,
          },
          wallet: {
            totalBalance: Number(walletStats._sum.balance) || 0,
            totalHeld: Number(walletStats._sum.holdBalance) || 0,
            pendingPayoutsCount: pendingPayouts._count || 0,
          },
          messages: {
            conversations: conversationCount,
            messagesInPeriod: messageCount,
            messagesPerDay: chartData.length > 0 ? Math.round(messageCount / chartData.length) : 0,
          },
          disputes: {
            open: openDisputes,
            resolved: resolvedDisputes,
            totalRefunds,
          },
        },
        charts: {
          visitors: formattedChartData,
          geo: geoData.map((g) => ({
            country: g.country || 'Unknown',
            count: g._count,
          })),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
