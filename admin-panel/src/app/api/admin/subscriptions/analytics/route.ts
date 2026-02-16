import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDateRange } from '@/lib/utils';
import { subDays, format, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, startOfWeek, subMonths } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '30d') as 'today' | '7d' | '30d' | '90d' | 'all';

    const { startDate, endDate } = getDateRange(range);

    // Get previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevStartDate = new Date(startDate.getTime() - periodLength);
    const prevEndDate = new Date(startDate.getTime() - 1);

    const [
      // Plans data
      plans,

      // Current subscription counts
      activeSubscriptions,
      trialingSubscriptions,
      cancelledInPeriod,
      newSubscriptionsInPeriod,

      // Previous period for comparison
      prevCancelledSubscriptions,
      prevNewSubscriptions,

      // MRR calculation - active subscriptions
      mrrData,

      // Churn data
      churnData,

      // Trial metrics
      trialStarts,
      trialConversions,
      trialExpiries,

      // Subscription changes (upgrades/downgrades)
      subscriptionChanges,

      // Daily stats for charts
      dailyStatsData,

      // Cohort data - subscriptions by month
      cohortData,

      // Revenue by plan
      revenueByPlan,

      // Subscription lifecycle events
      subscriptionEvents,
    ] = await Promise.all([
      // All active plans
      prisma.plan.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { subscriptions: true },
          },
        },
      }),

      // Active subscriptions
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),

      // Trialing subscriptions
      prisma.subscription.count({
        where: { status: 'TRIALING' },
      }),

      // Cancelled in current period
      prisma.subscription.count({
        where: {
          cancelledAt: { gte: startDate, lte: endDate },
        },
      }),

      // New subscriptions in period
      prisma.subscription.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Previous period cancelled
      prisma.subscription.count({
        where: {
          cancelledAt: { gte: prevStartDate, lte: prevEndDate },
        },
      }),

      // Previous period new
      prisma.subscription.count({
        where: {
          createdAt: { gte: prevStartDate, lte: prevEndDate },
        },
      }),

      // MRR calculation
      prisma.subscription.aggregate({
        where: {
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        _sum: { currentPrice: true },
        _count: true,
      }),

      // Churn calculation - subscriptions that were active at period start and cancelled
      prisma.subscription.count({
        where: {
          createdAt: { lt: startDate },
          status: 'CANCELLED',
          cancelledAt: { gte: startDate, lte: endDate },
        },
      }),

      // Trial starts in period
      prisma.subscription.count({
        where: {
          trialStartDate: { gte: startDate, lte: endDate },
        },
      }),

      // Trial conversions
      prisma.subscriptionHistory.count({
        where: {
          changeType: 'TRIAL_CONVERTED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Trial expiries
      prisma.subscriptionHistory.count({
        where: {
          changeType: 'TRIAL_EXPIRED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Subscription changes
      prisma.subscriptionHistory.groupBy({
        by: ['changeType'],
        where: {
          createdAt: { gte: startDate, lte: endDate },
          changeType: { in: ['UPGRADED', 'DOWNGRADED', 'RENEWED', 'CANCELLED'] },
        },
        _count: true,
        _sum: { toPrice: true, fromPrice: true },
      }),

      // Daily stats with subscription metrics
      prisma.dailyStats.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          newSubscriptions: true,
          cancelledSubscriptions: true,
          trialStarts: true,
          trialConversions: true,
          mrr: true,
          expansionMrr: true,
          contractionMrr: true,
          churnedMrr: true,
        },
      }),

      // Cohort data - group subscriptions by creation month
      prisma.subscription.groupBy({
        by: ['status'],
        where: {
          createdAt: { gte: subMonths(new Date(), 6) },
        },
        _count: true,
      }),

      // Revenue by plan
      prisma.subscription.groupBy({
        by: ['planId'],
        where: {
          status: { in: ['ACTIVE', 'TRIALING'] },
        },
        _sum: { currentPrice: true },
        _count: true,
      }),

      // Recent subscription events
      prisma.subscriptionHistory.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
        },
      }),
    ]);

    // Calculate MRR (Monthly Recurring Revenue)
    const currentMrr = Number(mrrData._sum.currentPrice) || 0;
    const arr = currentMrr * 12;

    // Calculate ARPU (Average Revenue Per User)
    const arpu = mrrData._count > 0 ? currentMrr / mrrData._count : 0;

    // Calculate churn rate
    const activeAtStart = activeSubscriptions + cancelledInPeriod;
    const churnRate = activeAtStart > 0 ? (churnData / activeAtStart) * 100 : 0;

    // Calculate trial conversion rate
    const trialConversionRate = trialStarts > 0 ? (trialConversions / trialStarts) * 100 : 0;

    // Process subscription changes
    const upgrades = subscriptionChanges.find(c => c.changeType === 'UPGRADED')?._count || 0;
    const downgrades = subscriptionChanges.find(c => c.changeType === 'DOWNGRADED')?._count || 0;
    const renewals = subscriptionChanges.find(c => c.changeType === 'RENEWED')?._count || 0;

    // Calculate expansion and contraction MRR from changes
    const upgradeData = subscriptionChanges.find(c => c.changeType === 'UPGRADED');
    const downgradeData = subscriptionChanges.find(c => c.changeType === 'DOWNGRADED');

    const expansionMrr = upgradeData
      ? Number(upgradeData._sum.toPrice || 0) - Number(upgradeData._sum.fromPrice || 0)
      : 0;
    const contractionMrr = downgradeData
      ? Number(downgradeData._sum.fromPrice || 0) - Number(downgradeData._sum.toPrice || 0)
      : 0;

    // Calculate Net MRR change
    const newMrr = newSubscriptionsInPeriod * arpu; // Estimated
    const churnedMrr = churnData * arpu; // Estimated
    const netMrrChange = newMrr + expansionMrr - contractionMrr - churnedMrr;

    // Map revenue by plan with plan details
    const revenueByPlanWithDetails = await Promise.all(
      revenueByPlan.map(async (item) => {
        const plan = plans.find(p => p.id === item.planId);
        return {
          planId: item.planId,
          planName: plan?.name || 'Unknown',
          tier: plan?.tier || 'BASIC',
          subscribers: item._count,
          mrr: Number(item._sum.currentPrice) || 0,
        };
      })
    );

    // Format chart data
    const chartData = dailyStatsData.map((d) => ({
      date: format(d.date, 'MMM d'),
      newSubscriptions: d.newSubscriptions,
      cancellations: d.cancelledSubscriptions,
      trialStarts: d.trialStarts,
      trialConversions: d.trialConversions,
      mrr: Number(d.mrr),
      netMrr: Number(d.mrr) + Number(d.expansionMrr) - Number(d.contractionMrr) - Number(d.churnedMrr),
    }));

    // Build cohort retention data
    const cohortRetention = buildCohortRetention(subscriptionEvents);

    // Plans breakdown with subscriber counts
    const plansWithMetrics = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      tier: plan.tier,
      monthlyPrice: Number(plan.monthlyPrice),
      yearlyPrice: plan.yearlyPrice ? Number(plan.yearlyPrice) : null,
      trialDays: plan.trialDays,
      isActive: plan.isActive,
      subscribers: plan._count.subscriptions,
      mrr: revenueByPlanWithDetails.find(r => r.planId === plan.id)?.mrr || 0,
    }));

    const response = {
      success: true,
      data: {
        summary: {
          mrr: currentMrr,
          arr,
          arpu,
          activeSubscriptions,
          trialingSubscriptions,
          totalSubscribers: activeSubscriptions + trialingSubscriptions,
          churnRate,
          trialConversionRate,
        },
        period: {
          newSubscriptions: newSubscriptionsInPeriod,
          cancellations: cancelledInPeriod,
          upgrades,
          downgrades,
          renewals,
          trialStarts,
          trialConversions,
          trialExpiries,
          expansionMrr,
          contractionMrr,
          churnedMrr,
          netMrrChange,
          // Comparisons
          prevNewSubscriptions,
          prevCancellations: prevCancelledSubscriptions,
          newSubsChange: prevNewSubscriptions > 0
            ? ((newSubscriptionsInPeriod - prevNewSubscriptions) / prevNewSubscriptions) * 100
            : 0,
        },
        plans: plansWithMetrics,
        revenueByPlan: revenueByPlanWithDetails,
        charts: {
          subscriptions: chartData,
          mrrTrend: chartData.map(d => ({
            date: d.date,
            mrr: d.mrr,
            netMrr: d.netMrr,
          })),
        },
        cohortRetention,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Subscription Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
}

// Helper function to build cohort retention data
function buildCohortRetention(events: any[]): any[] {
  // Group events by subscription creation month
  const cohorts: Map<string, { total: number; retained: Map<number, number> }> = new Map();

  events.forEach(event => {
    if (!event.subscription) return;

    const cohortMonth = format(event.subscription.createdAt, 'yyyy-MM');

    if (!cohorts.has(cohortMonth)) {
      cohorts.set(cohortMonth, {
        total: 0,
        retained: new Map(),
      });
    }

    const cohort = cohorts.get(cohortMonth)!;

    // Count initial subscriptions
    if (event.changeType === 'CREATED' || event.changeType === 'TRIAL_STARTED') {
      cohort.total++;
    }

    // Track retention at week intervals
    const weeksSinceCreation = Math.floor(
      (event.createdAt.getTime() - event.subscription.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    if (event.subscription.status === 'ACTIVE' || event.subscription.status === 'TRIALING') {
      const currentRetained = cohort.retained.get(weeksSinceCreation) || 0;
      cohort.retained.set(weeksSinceCreation, currentRetained + 1);
    }
  });

  // Convert to array format
  return Array.from(cohorts.entries()).map(([month, data]) => ({
    cohort: month,
    total: data.total,
    week1: data.total > 0 ? ((data.retained.get(1) || data.total) / data.total) * 100 : 0,
    week4: data.total > 0 ? ((data.retained.get(4) || data.total) / data.total) * 100 : 0,
    week8: data.total > 0 ? ((data.retained.get(8) || data.total) / data.total) * 100 : 0,
    week12: data.total > 0 ? ((data.retained.get(12) || data.total) / data.total) * 100 : 0,
  })).slice(0, 6); // Last 6 months
}
