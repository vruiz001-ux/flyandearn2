#!/usr/bin/env npx ts-node
/**
 * Metrics Verification Script
 *
 * This script verifies data integrity and metrics accuracy
 * by running a series of checks against the database.
 *
 * Usage:
 *   npx ts-node scripts/verify-metrics.ts
 *   npm run verify-metrics
 */

import { PrismaClient, SubscriptionStatus, TransactionType, TransactionStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

async function log(result: VerificationResult) {
  results.push(result);
  const icon = result.status === 'pass' ? '✓' : result.status === 'fail' ? '✗' : '⚠';
  const color = result.status === 'pass' ? '\x1b[32m' : result.status === 'fail' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}${icon}\x1b[0m ${result.name}: ${result.message}`);
  if (result.details && result.status !== 'pass') {
    console.log(`  Details:`, JSON.stringify(result.details, null, 2));
  }
}

async function verifyUserMetrics() {
  console.log('\n=== User Metrics Verification ===\n');

  // Check total user count
  const totalUsers = await prisma.user.count();
  await log({
    name: 'Total Users Count',
    status: totalUsers >= 0 ? 'pass' : 'fail',
    message: `${totalUsers} users in database`,
  });

  // Check verified vs unverified ratio
  const verifiedUsers = await prisma.user.count({ where: { emailVerified: true } });
  const unverifiedUsers = totalUsers - verifiedUsers;
  const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

  await log({
    name: 'Email Verification Rate',
    status: verificationRate >= 0 ? 'pass' : 'fail',
    message: `${verificationRate.toFixed(1)}% (${verifiedUsers}/${totalUsers})`,
  });

  // Check for users without wallets
  const usersWithWallets = await prisma.wallet.count();
  const usersWithoutWallets = totalUsers - usersWithWallets;

  await log({
    name: 'Users with Wallets',
    status: usersWithoutWallets === 0 ? 'pass' : 'warning',
    message: usersWithoutWallets === 0
      ? 'All users have wallets'
      : `${usersWithoutWallets} users missing wallets`,
    details: usersWithoutWallets > 0 ? { missing: usersWithoutWallets } : undefined,
  });

  // Check for duplicate emails
  const duplicateEmails = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
    ) as dupes
  `;
  const duplicateCount = Number(duplicateEmails[0]?.count || 0);

  await log({
    name: 'Duplicate Emails',
    status: duplicateCount === 0 ? 'pass' : 'fail',
    message: duplicateCount === 0 ? 'No duplicate emails' : `${duplicateCount} duplicate emails found`,
  });
}

async function verifyFinancialMetrics() {
  console.log('\n=== Financial Metrics Verification ===\n');

  // Calculate GMV from completed matches
  const gmvResult = await prisma.match.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { agreedPrice: true },
    _count: true,
  });

  const gmv = Number(gmvResult._sum.agreedPrice || 0);
  const completedMatches = gmvResult._count;

  await log({
    name: 'GMV Calculation',
    status: 'pass',
    message: `GMV: €${gmv.toFixed(2)} from ${completedMatches} completed matches`,
  });

  // Verify wallet balance consistency
  const totalWalletBalance = await prisma.wallet.aggregate({
    _sum: { balance: true, holdBalance: true },
  });

  const totalBalance = Number(totalWalletBalance._sum.balance || 0);
  const totalHeld = Number(totalWalletBalance._sum.holdBalance || 0);

  await log({
    name: 'Wallet Balances',
    status: totalBalance >= 0 && totalHeld >= 0 ? 'pass' : 'fail',
    message: `Total: €${totalBalance.toFixed(2)}, Held: €${totalHeld.toFixed(2)}`,
  });

  // Check for negative balances
  const negativeBalances = await prisma.wallet.count({
    where: {
      OR: [
        { balance: { lt: 0 } },
        { holdBalance: { lt: 0 } },
      ],
    },
  });

  await log({
    name: 'Negative Balances',
    status: negativeBalances === 0 ? 'pass' : 'fail',
    message: negativeBalances === 0
      ? 'No negative balances'
      : `${negativeBalances} wallets with negative balances`,
  });

  // Verify transaction balance consistency
  const transactionSums = await prisma.walletTransaction.groupBy({
    by: ['type'],
    where: { status: 'COMPLETED' },
    _sum: { amount: true },
  });

  const topups = Number(transactionSums.find(t => t.type === 'TOPUP')?._sum.amount || 0);
  const payouts = Number(transactionSums.find(t => t.type === 'PAYOUT')?._sum.amount || 0);
  const fees = Number(transactionSums.find(t => t.type === 'FEE')?._sum.amount || 0);

  await log({
    name: 'Transaction Summary',
    status: 'pass',
    message: `Topups: €${topups.toFixed(2)}, Payouts: €${Math.abs(payouts).toFixed(2)}, Fees: €${fees.toFixed(2)}`,
  });

  // Check for failed payouts
  const failedPayouts = await prisma.walletTransaction.count({
    where: { type: 'PAYOUT', status: 'FAILED' },
  });

  const totalPayouts = await prisma.walletTransaction.count({
    where: { type: 'PAYOUT' },
  });

  const payoutSuccessRate = totalPayouts > 0 ? ((totalPayouts - failedPayouts) / totalPayouts) * 100 : 100;

  await log({
    name: 'Payout Success Rate',
    status: payoutSuccessRate >= 95 ? 'pass' : payoutSuccessRate >= 80 ? 'warning' : 'fail',
    message: `${payoutSuccessRate.toFixed(1)}% (${failedPayouts} failed of ${totalPayouts})`,
  });
}

async function verifySubscriptionMetrics() {
  console.log('\n=== Subscription Metrics Verification ===\n');

  // Count subscriptions by status
  const statusCounts = await prisma.subscription.groupBy({
    by: ['status'],
    _count: true,
  });

  const active = statusCounts.find(s => s.status === 'ACTIVE')?._count || 0;
  const trialing = statusCounts.find(s => s.status === 'TRIALING')?._count || 0;
  const cancelled = statusCounts.find(s => s.status === 'CANCELLED')?._count || 0;

  await log({
    name: 'Subscription Distribution',
    status: 'pass',
    message: `Active: ${active}, Trialing: ${trialing}, Cancelled: ${cancelled}`,
  });

  // Calculate MRR
  const mrrResult = await prisma.subscription.aggregate({
    where: { status: { in: ['ACTIVE', 'TRIALING'] } },
    _sum: { currentPrice: true },
    _count: true,
  });

  const mrr = Number(mrrResult._sum.currentPrice || 0);
  const subscribers = mrrResult._count;
  const arpu = subscribers > 0 ? mrr / subscribers : 0;
  const arr = mrr * 12;

  await log({
    name: 'MRR Calculation',
    status: mrr >= 0 ? 'pass' : 'fail',
    message: `MRR: €${mrr.toFixed(2)}, ARR: €${arr.toFixed(2)}, ARPU: €${arpu.toFixed(2)}`,
  });

  // Check for orphaned subscriptions (no valid plan)
  const orphanedSubs = await prisma.subscription.count({
    where: {
      plan: {
        isActive: false,
      },
      status: 'ACTIVE',
    },
  });

  await log({
    name: 'Orphaned Subscriptions',
    status: orphanedSubs === 0 ? 'pass' : 'warning',
    message: orphanedSubs === 0
      ? 'No active subscriptions on inactive plans'
      : `${orphanedSubs} active subscriptions on inactive plans`,
  });

  // Check subscription history integrity
  const subsWithoutHistory = await prisma.subscription.count({
    where: {
      history: { none: {} },
    },
  });

  await log({
    name: 'Subscription History',
    status: subsWithoutHistory === 0 ? 'pass' : 'warning',
    message: subsWithoutHistory === 0
      ? 'All subscriptions have history records'
      : `${subsWithoutHistory} subscriptions missing history`,
  });
}

async function verifyEventMetrics() {
  console.log('\n=== Event Metrics Verification ===\n');

  // Check event count by type
  const eventCounts = await prisma.event.groupBy({
    by: ['type'],
    _count: true,
    orderBy: { _count: { type: 'desc' } },
    take: 10,
  });

  const totalEvents = eventCounts.reduce((sum, e) => sum + e._count, 0);

  await log({
    name: 'Event Distribution',
    status: totalEvents > 0 ? 'pass' : 'warning',
    message: `${totalEvents} total events`,
    details: eventCounts.map(e => ({ type: e.type, count: e._count })),
  });

  // Check for events with missing session IDs (for pageviews)
  const pageviewsWithoutSession = await prisma.event.count({
    where: {
      type: 'PAGEVIEW',
      sessionId: null,
    },
  });

  const totalPageviews = await prisma.event.count({
    where: { type: 'PAGEVIEW' },
  });

  const sessionCoverage = totalPageviews > 0
    ? ((totalPageviews - pageviewsWithoutSession) / totalPageviews) * 100
    : 100;

  await log({
    name: 'Session ID Coverage',
    status: sessionCoverage >= 95 ? 'pass' : sessionCoverage >= 80 ? 'warning' : 'fail',
    message: `${sessionCoverage.toFixed(1)}% of pageviews have session IDs`,
  });

  // Check for events with missing device type
  const eventsWithoutDevice = await prisma.event.count({
    where: {
      type: 'PAGEVIEW',
      deviceType: null,
    },
  });

  const deviceCoverage = totalPageviews > 0
    ? ((totalPageviews - eventsWithoutDevice) / totalPageviews) * 100
    : 100;

  await log({
    name: 'Device Type Coverage',
    status: deviceCoverage >= 80 ? 'pass' : deviceCoverage >= 50 ? 'warning' : 'fail',
    message: `${deviceCoverage.toFixed(1)}% of pageviews have device type`,
  });

  // Check last event timestamp
  const lastEvent = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, type: true },
  });

  if (lastEvent) {
    const minutesAgo = Math.floor((Date.now() - lastEvent.createdAt.getTime()) / 1000 / 60);
    await log({
      name: 'Event Freshness',
      status: minutesAgo < 60 ? 'pass' : minutesAgo < 1440 ? 'warning' : 'fail',
      message: `Last event: ${minutesAgo} minutes ago (${lastEvent.type})`,
    });
  } else {
    await log({
      name: 'Event Freshness',
      status: 'warning',
      message: 'No events found in database',
    });
  }
}

async function verifyDailyStats() {
  console.log('\n=== Daily Stats Verification ===\n');

  // Check for gaps in daily stats
  const dailyStats = await prisma.dailyStats.findMany({
    orderBy: { date: 'desc' },
    take: 30,
    select: { date: true },
  });

  const dates = dailyStats.map(d => d.date.toISOString().split('T')[0]);
  const gaps: string[] = [];

  for (let i = 0; i < dates.length - 1; i++) {
    const current = new Date(dates[i]);
    const prev = new Date(dates[i + 1]);
    const diffDays = Math.floor((current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
      gaps.push(`Gap between ${dates[i + 1]} and ${dates[i]}`);
    }
  }

  await log({
    name: 'Daily Stats Continuity',
    status: gaps.length === 0 ? 'pass' : 'warning',
    message: gaps.length === 0 ? 'No gaps in last 30 days' : `${gaps.length} gap(s) found`,
    details: gaps.length > 0 ? gaps : undefined,
  });

  // Verify daily stats sum matches actual data
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [statsSum, actualUserCount] = await Promise.all([
    prisma.dailyStats.aggregate({
      where: { date: { gte: thirtyDaysAgo } },
      _sum: { newSignups: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const statsSignups = statsSum._sum.newSignups || 0;
  const variance = actualUserCount > 0
    ? Math.abs(statsSignups - actualUserCount) / actualUserCount * 100
    : 0;

  await log({
    name: 'Signup Count Accuracy',
    status: variance < 5 ? 'pass' : variance < 15 ? 'warning' : 'fail',
    message: `Stats: ${statsSignups}, Actual: ${actualUserCount} (${variance.toFixed(1)}% variance)`,
  });
}

async function verifyRequestMatchIntegrity() {
  console.log('\n=== Request/Match Integrity ===\n');

  // Check for matches without valid requests
  const orphanedMatches = await prisma.match.count({
    where: {
      request: {
        status: { in: ['DRAFT', 'CANCELLED', 'EXPIRED'] },
      },
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
  });

  await log({
    name: 'Orphaned Matches',
    status: orphanedMatches === 0 ? 'pass' : 'warning',
    message: orphanedMatches === 0
      ? 'No orphaned matches'
      : `${orphanedMatches} matches on invalid requests`,
  });

  // Check for completed matches without payment records
  const completedMatchesWithoutPayment = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM matches m
    WHERE m.status = 'COMPLETED'
    AND m.platform_fee IS NULL
  `;

  const noPaymentCount = Number(completedMatchesWithoutPayment[0]?.count || 0);

  await log({
    name: 'Payment Record Integrity',
    status: noPaymentCount === 0 ? 'pass' : 'warning',
    message: noPaymentCount === 0
      ? 'All completed matches have payment records'
      : `${noPaymentCount} completed matches missing payment data`,
  });
}

async function generateSummary() {
  console.log('\n=== VERIFICATION SUMMARY ===\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const total = results.length;

  console.log(`Total Checks: ${total}`);
  console.log(`\x1b[32m✓ Passed: ${passed}\x1b[0m`);
  console.log(`\x1b[33m⚠ Warnings: ${warnings}\x1b[0m`);
  console.log(`\x1b[31m✗ Failed: ${failed}\x1b[0m`);

  const overallStatus = failed > 0 ? 'FAIL' : warnings > 0 ? 'WARNING' : 'PASS';
  const statusColor = failed > 0 ? '\x1b[31m' : warnings > 0 ? '\x1b[33m' : '\x1b[32m';

  console.log(`\n${statusColor}Overall Status: ${overallStatus}\x1b[0m\n`);

  return { passed, warnings, failed, total, overallStatus };
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          FlyAndEarn Metrics Verification Report           ║');
  console.log('║                    ' + new Date().toISOString().split('T')[0] + '                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    await verifyUserMetrics();
    await verifyFinancialMetrics();
    await verifySubscriptionMetrics();
    await verifyEventMetrics();
    await verifyDailyStats();
    await verifyRequestMatchIntegrity();

    const summary = await generateSummary();

    // Exit with appropriate code
    if (summary.failed > 0) {
      process.exit(1);
    } else if (summary.warnings > 0) {
      process.exit(2);
    }

    process.exit(0);
  } catch (error) {
    console.error('\x1b[31mVerification failed with error:\x1b[0m', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
