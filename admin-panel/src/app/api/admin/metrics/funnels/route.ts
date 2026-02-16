import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getDateRange } from '@/lib/utils';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || '30d') as 'today' | '7d' | '30d' | '90d' | 'all';

    const { startDate, endDate } = getDateRange(range);

    // Fetch funnel data in parallel
    const [
      // Visitor to Signup Funnel
      uniqueVisitors,
      signups,

      // Signup to Request Funnel
      usersWhoMadeRequests,

      // Request to Match Funnel
      requestsCreated,
      requestsWithMatches,
      acceptedMatches,
      completedMatches,

      // Subscription Funnel
      planViews,
      checkoutStarts,
      subscribed,
      checkoutAbandoned,

      // Trial Funnel
      trialStarts,
      trialConverted,
      trialExpired,

      // Device breakdown for visitors
      deviceBreakdown,

      // Source breakdown for visitors
      sourceBreakdown,

      // Daily funnel progression
      dailyFunnelData,
    ] = await Promise.all([
      // Unique visitors (from events)
      prisma.event.groupBy({
        by: ['sessionId'],
        where: {
          type: 'PAGEVIEW',
          createdAt: { gte: startDate, lte: endDate },
          sessionId: { not: null },
        },
      }).then(r => r.length),

      // Signups
      prisma.event.count({
        where: {
          type: 'SIGNUP',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Users who created at least one request
      prisma.user.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          requestsCreated: { some: {} },
        },
      }),

      // Total requests created
      prisma.request.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Requests that got at least one match
      prisma.request.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          matches: { some: {} },
        },
      }),

      // Accepted matches
      prisma.match.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['ACCEPTED', 'PURCHASED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] },
        },
      }),

      // Completed matches
      prisma.match.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED',
        },
      }),

      // Plan views
      prisma.event.count({
        where: {
          type: 'PLAN_VIEWED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Checkout starts
      prisma.event.count({
        where: {
          type: 'CHECKOUT_STARTED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Subscribed
      prisma.event.count({
        where: {
          type: 'SUBSCRIBED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Checkout abandoned
      prisma.event.count({
        where: {
          type: 'CHECKOUT_ABANDONED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Trial starts
      prisma.event.count({
        where: {
          type: 'TRIAL_STARTED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Trial converted
      prisma.event.count({
        where: {
          type: 'TRIAL_CONVERTED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Trial expired
      prisma.event.count({
        where: {
          type: 'TRIAL_EXPIRED',
          createdAt: { gte: startDate, lte: endDate },
        },
      }),

      // Device breakdown
      prisma.event.groupBy({
        by: ['deviceType'],
        where: {
          type: 'PAGEVIEW',
          createdAt: { gte: startDate, lte: endDate },
          deviceType: { not: null },
        },
        _count: true,
      }),

      // Source breakdown
      prisma.event.groupBy({
        by: ['source'],
        where: {
          type: 'PAGEVIEW',
          createdAt: { gte: startDate, lte: endDate },
          source: { not: null },
        },
        _count: true,
        orderBy: { _count: { source: 'desc' } },
        take: 10,
      }),

      // Daily funnel data from dailyStats
      prisma.dailyStats.findMany({
        where: { date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
        select: {
          date: true,
          uniqueVisitors: true,
          newSignups: true,
          newRequests: true,
          acceptedMatches: true,
          completedMatches: true,
          newSubscriptions: true,
          trialStarts: true,
          trialConversions: true,
        },
      }),
    ]);

    // Calculate conversion rates
    const visitorToSignupRate = uniqueVisitors > 0 ? (signups / uniqueVisitors) * 100 : 0;
    const signupToRequestRate = signups > 0 ? (usersWhoMadeRequests / signups) * 100 : 0;
    const requestToMatchRate = requestsCreated > 0 ? (requestsWithMatches / requestsCreated) * 100 : 0;
    const matchToAcceptRate = requestsWithMatches > 0 ? (acceptedMatches / requestsWithMatches) * 100 : 0;
    const acceptToCompleteRate = acceptedMatches > 0 ? (completedMatches / acceptedMatches) * 100 : 0;

    const planViewToCheckoutRate = planViews > 0 ? (checkoutStarts / planViews) * 100 : 0;
    const checkoutToSubscribeRate = checkoutStarts > 0 ? (subscribed / checkoutStarts) * 100 : 0;
    const checkoutAbandonRate = checkoutStarts > 0 ? (checkoutAbandoned / checkoutStarts) * 100 : 0;

    const trialConversionRate = trialStarts > 0 ? (trialConverted / trialStarts) * 100 : 0;
    const trialDropoffRate = trialStarts > 0 ? (trialExpired / trialStarts) * 100 : 0;

    // Format device breakdown
    const deviceData = deviceBreakdown.map(d => ({
      device: d.deviceType || 'unknown',
      count: d._count,
      percentage: uniqueVisitors > 0 ? (d._count / uniqueVisitors) * 100 : 0,
    }));

    // Format source breakdown
    const sourceData = sourceBreakdown.map(s => ({
      source: s.source || 'direct',
      count: s._count,
      percentage: uniqueVisitors > 0 ? (s._count / uniqueVisitors) * 100 : 0,
    }));

    // Format daily funnel data
    const dailyData = dailyFunnelData.map(d => ({
      date: format(d.date, 'MMM d'),
      visitors: d.uniqueVisitors,
      signups: d.newSignups,
      requests: d.newRequests,
      acceptedMatches: d.acceptedMatches,
      completedMatches: d.completedMatches,
      subscriptions: d.newSubscriptions,
      trials: d.trialStarts,
      trialConversions: d.trialConversions,
    }));

    const response = {
      success: true,
      data: {
        // Main acquisition funnel
        acquisitionFunnel: {
          steps: [
            { name: 'Visitors', count: uniqueVisitors, rate: 100 },
            { name: 'Signups', count: signups, rate: visitorToSignupRate },
            { name: 'First Request', count: usersWhoMadeRequests, rate: signupToRequestRate },
          ],
          overallConversion: uniqueVisitors > 0 ? (usersWhoMadeRequests / uniqueVisitors) * 100 : 0,
        },

        // Marketplace funnel
        marketplaceFunnel: {
          steps: [
            { name: 'Requests Created', count: requestsCreated, rate: 100 },
            { name: 'Got Match', count: requestsWithMatches, rate: requestToMatchRate },
            { name: 'Match Accepted', count: acceptedMatches, rate: matchToAcceptRate },
            { name: 'Completed', count: completedMatches, rate: acceptToCompleteRate },
          ],
          overallConversion: requestsCreated > 0 ? (completedMatches / requestsCreated) * 100 : 0,
        },

        // Subscription funnel
        subscriptionFunnel: {
          steps: [
            { name: 'Plan Viewed', count: planViews, rate: 100 },
            { name: 'Checkout Started', count: checkoutStarts, rate: planViewToCheckoutRate },
            { name: 'Subscribed', count: subscribed, rate: checkoutToSubscribeRate },
          ],
          abandoned: checkoutAbandoned,
          abandonRate: checkoutAbandonRate,
          overallConversion: planViews > 0 ? (subscribed / planViews) * 100 : 0,
        },

        // Trial funnel
        trialFunnel: {
          started: trialStarts,
          converted: trialConverted,
          expired: trialExpired,
          conversionRate: trialConversionRate,
          dropoffRate: trialDropoffRate,
        },

        // Conversion rates summary
        conversionRates: {
          visitorToSignup: visitorToSignupRate,
          signupToRequest: signupToRequestRate,
          requestToMatch: requestToMatchRate,
          matchToComplete: acceptToCompleteRate,
          visitorToSubscriber: uniqueVisitors > 0 ? (subscribed / uniqueVisitors) * 100 : 0,
          trialConversion: trialConversionRate,
        },

        // Traffic breakdown
        trafficBreakdown: {
          byDevice: deviceData,
          bySource: sourceData,
        },

        // Daily trend
        dailyTrend: dailyData,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Funnels API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch funnel data' },
      { status: 500 }
    );
  }
}
