import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { subHours, subDays, format, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const oneHourAgo = subHours(now, 1);
    const oneDayAgo = subDays(now, 1);
    const sevenDaysAgo = subDays(now, 7);

    const [
      // Event ingestion health
      lastEvent,
      eventsLastHour,
      eventsLast24h,
      eventsLast7d,

      // Daily event counts for trend
      dailyEventCounts,

      // Data quality - null field rates
      eventsWithNullSession,
      eventsWithNullPath,
      eventsWithNullDevice,
      totalRecentEvents,

      // Database health
      userCount,
      requestCount,
      matchCount,
      walletCount,

      // Payout health
      failedPayouts24h,
      pendingPayouts,
      totalPayouts24h,

      // Audit log activity
      auditLogsLast24h,

      // Message activity
      messagesLast24h,

      // Active sessions
      activeSessions,
    ] = await Promise.all([
      // Last event timestamp
      prisma.event.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, type: true },
      }),

      // Events in last hour
      prisma.event.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),

      // Events in last 24h
      prisma.event.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),

      // Events in last 7 days
      prisma.event.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),

      // Daily event counts
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM events
        WHERE created_at >= ${sevenDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `.catch(() => []),

      // Events missing session ID
      prisma.event.count({
        where: {
          createdAt: { gte: oneDayAgo },
          type: 'PAGEVIEW',
          sessionId: null,
        },
      }),

      // Events missing path
      prisma.event.count({
        where: {
          createdAt: { gte: oneDayAgo },
          type: 'PAGEVIEW',
          path: null,
        },
      }),

      // Events missing device type
      prisma.event.count({
        where: {
          createdAt: { gte: oneDayAgo },
          type: 'PAGEVIEW',
          deviceType: null,
        },
      }),

      // Total pageview events for quality calculation
      prisma.event.count({
        where: {
          createdAt: { gte: oneDayAgo },
          type: 'PAGEVIEW',
        },
      }),

      // Database record counts
      prisma.user.count(),
      prisma.request.count(),
      prisma.match.count(),
      prisma.wallet.count(),

      // Failed payouts in 24h
      prisma.walletTransaction.count({
        where: {
          type: 'PAYOUT',
          status: 'FAILED',
          failedAt: { gte: oneDayAgo },
        },
      }),

      // Pending payouts
      prisma.walletTransaction.count({
        where: {
          type: 'PAYOUT',
          status: 'PENDING',
        },
      }),

      // Total payouts in 24h
      prisma.walletTransaction.count({
        where: {
          type: 'PAYOUT',
          createdAt: { gte: oneDayAgo },
        },
      }),

      // Audit logs
      prisma.auditLog.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),

      // Messages
      prisma.message.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),

      // Active admin sessions
      prisma.adminSession.count({
        where: { expiresAt: { gt: now } },
      }),
    ]);

    // Calculate health metrics
    const avgEventsPerDay = eventsLast7d / 7;
    const expectedEventsLastHour = avgEventsPerDay / 24;
    const eventIngestionHealth = expectedEventsLastHour > 0
      ? Math.min((eventsLastHour / expectedEventsLastHour) * 100, 100)
      : 0;

    // Calculate time since last event
    const timeSinceLastEvent = lastEvent
      ? Math.floor((now.getTime() - lastEvent.createdAt.getTime()) / 1000 / 60)
      : null;

    // Data quality scores
    const sessionNullRate = totalRecentEvents > 0 ? (eventsWithNullSession / totalRecentEvents) * 100 : 0;
    const pathNullRate = totalRecentEvents > 0 ? (eventsWithNullPath / totalRecentEvents) * 100 : 0;
    const deviceNullRate = totalRecentEvents > 0 ? (eventsWithNullDevice / totalRecentEvents) * 100 : 0;
    const overallDataQuality = 100 - ((sessionNullRate + pathNullRate + deviceNullRate) / 3);

    // Payout health
    const payoutSuccessRate = totalPayouts24h > 0
      ? ((totalPayouts24h - failedPayouts24h) / totalPayouts24h) * 100
      : 100;

    // Calculate overall system health
    const healthScores = [
      eventIngestionHealth,
      overallDataQuality,
      payoutSuccessRate,
      timeSinceLastEvent !== null && timeSinceLastEvent < 60 ? 100 : 50, // Event freshness
    ];
    const overallHealth = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;

    // Format daily event trend
    const eventTrend = (dailyEventCounts as any[]).map((d: any) => ({
      date: format(new Date(d.date), 'MMM d'),
      count: Number(d.count),
    }));

    // Determine status indicators
    const getStatus = (value: number, thresholds: [number, number]): 'healthy' | 'warning' | 'critical' => {
      if (value >= thresholds[0]) return 'healthy';
      if (value >= thresholds[1]) return 'warning';
      return 'critical';
    };

    const response = {
      success: true,
      data: {
        overall: {
          health: overallHealth,
          status: getStatus(overallHealth, [80, 50]),
        },

        eventIngestion: {
          lastEvent: lastEvent?.createdAt || null,
          lastEventType: lastEvent?.type || null,
          minutesSinceLastEvent: timeSinceLastEvent,
          eventsLastHour,
          eventsLast24h,
          eventsLast7d,
          avgEventsPerDay: Math.round(avgEventsPerDay),
          health: eventIngestionHealth,
          status: getStatus(eventIngestionHealth, [70, 40]),
          trend: eventTrend,
        },

        dataQuality: {
          score: overallDataQuality,
          status: getStatus(overallDataQuality, [90, 70]),
          missingFields: {
            sessionId: {
              count: eventsWithNullSession,
              rate: sessionNullRate,
            },
            path: {
              count: eventsWithNullPath,
              rate: pathNullRate,
            },
            deviceType: {
              count: eventsWithNullDevice,
              rate: deviceNullRate,
            },
          },
          totalPageviews24h: totalRecentEvents,
        },

        payouts: {
          successRate: payoutSuccessRate,
          status: getStatus(payoutSuccessRate, [95, 80]),
          failed24h: failedPayouts24h,
          pending: pendingPayouts,
          total24h: totalPayouts24h,
        },

        database: {
          users: userCount,
          requests: requestCount,
          matches: matchCount,
          wallets: walletCount,
        },

        activity: {
          auditLogs24h: auditLogsLast24h,
          messages24h: messagesLast24h,
          activeAdminSessions: activeSessions,
        },

        alerts: generateAlerts({
          timeSinceLastEvent,
          eventIngestionHealth,
          overallDataQuality,
          payoutSuccessRate,
          failedPayouts24h,
          pendingPayouts,
        }),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Health API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch health data' },
      { status: 500 }
    );
  }
}

// Generate alerts based on health metrics
function generateAlerts(metrics: {
  timeSinceLastEvent: number | null;
  eventIngestionHealth: number;
  overallDataQuality: number;
  payoutSuccessRate: number;
  failedPayouts24h: number;
  pendingPayouts: number;
}): Array<{ level: 'info' | 'warning' | 'critical'; message: string }> {
  const alerts: Array<{ level: 'info' | 'warning' | 'critical'; message: string }> = [];

  // Event ingestion alerts
  if (metrics.timeSinceLastEvent !== null && metrics.timeSinceLastEvent > 60) {
    alerts.push({
      level: 'critical',
      message: `No events received in the last ${metrics.timeSinceLastEvent} minutes`,
    });
  } else if (metrics.timeSinceLastEvent !== null && metrics.timeSinceLastEvent > 30) {
    alerts.push({
      level: 'warning',
      message: `Event ingestion slowed - last event ${metrics.timeSinceLastEvent} minutes ago`,
    });
  }

  if (metrics.eventIngestionHealth < 40) {
    alerts.push({
      level: 'critical',
      message: 'Event ingestion rate is significantly below normal',
    });
  } else if (metrics.eventIngestionHealth < 70) {
    alerts.push({
      level: 'warning',
      message: 'Event ingestion rate is below normal',
    });
  }

  // Data quality alerts
  if (metrics.overallDataQuality < 70) {
    alerts.push({
      level: 'warning',
      message: 'Data quality score is low - many events missing required fields',
    });
  }

  // Payout alerts
  if (metrics.failedPayouts24h > 0) {
    alerts.push({
      level: metrics.failedPayouts24h > 5 ? 'critical' : 'warning',
      message: `${metrics.failedPayouts24h} payout(s) failed in the last 24 hours`,
    });
  }

  if (metrics.pendingPayouts > 50) {
    alerts.push({
      level: 'warning',
      message: `${metrics.pendingPayouts} payouts pending processing`,
    });
  }

  if (metrics.payoutSuccessRate < 80) {
    alerts.push({
      level: 'critical',
      message: `Payout success rate is critically low (${metrics.payoutSuccessRate.toFixed(1)}%)`,
    });
  } else if (metrics.payoutSuccessRate < 95) {
    alerts.push({
      level: 'warning',
      message: `Payout success rate is below target (${metrics.payoutSuccessRate.toFixed(1)}%)`,
    });
  }

  return alerts;
}
