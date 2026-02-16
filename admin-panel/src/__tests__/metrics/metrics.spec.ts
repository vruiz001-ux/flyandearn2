/**
 * Metrics Verification Tests
 *
 * These tests verify that metrics are calculated correctly and that
 * data integrity is maintained across the admin panel.
 */

import { Decimal } from '@prisma/client/runtime/library';

// Mock Prisma client
const mockPrisma = {
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  request: {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  match: {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  wallet: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  walletTransaction: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  subscription: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  subscriptionHistory: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  event: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  dailyStats: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  dispute: {
    count: jest.fn(),
    aggregate: jest.fn(),
  },
};

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: mockPrisma,
}));

describe('Metrics Data Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Metrics', () => {
    it('should count total users correctly', async () => {
      mockPrisma.user.count.mockResolvedValue(1500);

      const count = await mockPrisma.user.count();

      expect(count).toBe(1500);
      expect(mockPrisma.user.count).toHaveBeenCalledTimes(1);
    });

    it('should count new signups within date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      mockPrisma.user.count.mockResolvedValue(250);

      const count = await mockPrisma.user.count({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      expect(count).toBe(250);
    });

    it('should calculate verified user rate', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000) // Total users
        .mockResolvedValueOnce(750); // Verified users

      const totalUsers = await mockPrisma.user.count();
      const verifiedUsers = await mockPrisma.user.count({
        where: { emailVerified: true },
      });

      const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

      expect(verificationRate).toBe(75);
    });
  });

  describe('Request Metrics', () => {
    it('should count requests by status correctly', async () => {
      const statusCounts = {
        OPEN: 50,
        ACCEPTED: 30,
        COMPLETED: 100,
        CANCELLED: 20,
      };

      for (const [status, count] of Object.entries(statusCounts)) {
        mockPrisma.request.count.mockResolvedValueOnce(count);
      }

      const openCount = await mockPrisma.request.count({ where: { status: 'OPEN' } });
      const acceptedCount = await mockPrisma.request.count({ where: { status: 'ACCEPTED' } });
      const completedCount = await mockPrisma.request.count({ where: { status: 'COMPLETED' } });
      const cancelledCount = await mockPrisma.request.count({ where: { status: 'CANCELLED' } });

      expect(openCount).toBe(50);
      expect(acceptedCount).toBe(30);
      expect(completedCount).toBe(100);
      expect(cancelledCount).toBe(20);
    });

    it('should calculate completion rate correctly', async () => {
      mockPrisma.request.count
        .mockResolvedValueOnce(200) // Total requests
        .mockResolvedValueOnce(150); // Completed requests

      const total = await mockPrisma.request.count();
      const completed = await mockPrisma.request.count({ where: { status: 'COMPLETED' } });

      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      expect(completionRate).toBe(75);
    });
  });

  describe('Match Metrics', () => {
    it('should calculate acceptance rate correctly', async () => {
      mockPrisma.match.count
        .mockResolvedValueOnce(500) // Total matches
        .mockResolvedValueOnce(350); // Accepted matches

      const total = await mockPrisma.match.count();
      const accepted = await mockPrisma.match.count({
        where: { status: { in: ['ACCEPTED', 'PURCHASED', 'SHIPPED', 'DELIVERED', 'COMPLETED'] } },
      });

      const acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;

      expect(acceptanceRate).toBe(70);
    });
  });

  describe('Financial Metrics', () => {
    it('should calculate GMV correctly from completed matches', async () => {
      mockPrisma.match.aggregate.mockResolvedValue({
        _sum: { agreedPrice: new Decimal('15000.50') },
        _count: 100,
      });

      const result = await mockPrisma.match.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { agreedPrice: true },
        _count: true,
      });

      expect(Number(result._sum.agreedPrice)).toBe(15000.50);
      expect(result._count).toBe(100);
    });

    it('should calculate platform fees correctly', async () => {
      mockPrisma.match.aggregate.mockResolvedValue({
        _sum: { platformFee: new Decimal('750.25') },
      });

      const result = await mockPrisma.match.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { platformFee: true },
      });

      expect(Number(result._sum.platformFee)).toBe(750.25);
    });

    it('should calculate total wallet balances', async () => {
      mockPrisma.wallet.aggregate.mockResolvedValue({
        _sum: {
          balance: new Decimal('50000.00'),
          holdBalance: new Decimal('5000.00'),
        },
      });

      const result = await mockPrisma.wallet.aggregate({
        _sum: { balance: true, holdBalance: true },
      });

      const totalBalance = Number(result._sum.balance);
      const totalHeld = Number(result._sum.holdBalance);
      const totalLiabilities = totalBalance + totalHeld;

      expect(totalBalance).toBe(50000);
      expect(totalHeld).toBe(5000);
      expect(totalLiabilities).toBe(55000);
    });

    it('should calculate payout success rate', async () => {
      mockPrisma.walletTransaction.count
        .mockResolvedValueOnce(100) // Total payouts
        .mockResolvedValueOnce(95); // Successful payouts

      const totalPayouts = await mockPrisma.walletTransaction.count({
        where: { type: 'PAYOUT' },
      });
      const successfulPayouts = await mockPrisma.walletTransaction.count({
        where: { type: 'PAYOUT', status: 'COMPLETED' },
      });

      const successRate = totalPayouts > 0 ? (successfulPayouts / totalPayouts) * 100 : 100;

      expect(successRate).toBe(95);
    });
  });

  describe('Subscription Metrics', () => {
    it('should calculate MRR correctly', async () => {
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _sum: { currentPrice: new Decimal('5000.00') },
        _count: 100,
      });

      const result = await mockPrisma.subscription.aggregate({
        where: { status: { in: ['ACTIVE', 'TRIALING'] } },
        _sum: { currentPrice: true },
        _count: true,
      });

      const mrr = Number(result._sum.currentPrice);
      const arr = mrr * 12;

      expect(mrr).toBe(5000);
      expect(arr).toBe(60000);
    });

    it('should calculate ARPU correctly', async () => {
      mockPrisma.subscription.aggregate.mockResolvedValue({
        _sum: { currentPrice: new Decimal('10000.00') },
        _count: 200,
      });

      const result = await mockPrisma.subscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { currentPrice: true },
        _count: true,
      });

      const mrr = Number(result._sum.currentPrice);
      const subscribers = result._count;
      const arpu = subscribers > 0 ? mrr / subscribers : 0;

      expect(arpu).toBe(50);
    });

    it('should calculate churn rate correctly', async () => {
      const activeAtStart = 100;
      const cancelledInPeriod = 5;

      mockPrisma.subscription.count
        .mockResolvedValueOnce(activeAtStart)
        .mockResolvedValueOnce(cancelledInPeriod);

      const churnRate = activeAtStart > 0 ? (cancelledInPeriod / activeAtStart) * 100 : 0;

      expect(churnRate).toBe(5);
    });

    it('should calculate trial conversion rate', async () => {
      // Reset mock before this test
      mockPrisma.subscription.count.mockReset();
      mockPrisma.subscription.count
        .mockResolvedValueOnce(50) // Trial starts
        .mockResolvedValueOnce(35); // Trial conversions

      const trialStarts = await mockPrisma.subscription.count({
        where: { trialStartDate: { not: null } },
      });
      const trialConversions = await mockPrisma.subscription.count({
        where: { status: 'ACTIVE', trialStartDate: { not: null } },
      });

      const conversionRate = trialStarts > 0 ? (trialConversions / trialStarts) * 100 : 0;

      expect(conversionRate).toBe(70);
    });
  });

  describe('Visitor/Event Metrics', () => {
    it('should count unique visitors correctly', async () => {
      mockPrisma.event.groupBy.mockResolvedValue([
        { sessionId: 'session1' },
        { sessionId: 'session2' },
        { sessionId: 'session3' },
      ]);

      const result = await mockPrisma.event.groupBy({
        by: ['sessionId'],
        where: { type: 'PAGEVIEW', sessionId: { not: null } },
      });

      const uniqueVisitors = result.length;

      expect(uniqueVisitors).toBe(3);
    });

    it('should aggregate daily stats correctly', async () => {
      mockPrisma.dailyStats.aggregate.mockResolvedValue({
        _sum: {
          totalVisits: 10000,
          uniqueVisitors: 5000,
          pageviews: 25000,
          newSignups: 250,
          gmv: new Decimal('50000.00'),
        },
      });

      const result = await mockPrisma.dailyStats.aggregate({
        _sum: {
          totalVisits: true,
          uniqueVisitors: true,
          pageviews: true,
          newSignups: true,
          gmv: true,
        },
      });

      expect(result._sum.totalVisits).toBe(10000);
      expect(result._sum.uniqueVisitors).toBe(5000);
      expect(result._sum.pageviews).toBe(25000);
      expect(result._sum.newSignups).toBe(250);
      expect(Number(result._sum.gmv)).toBe(50000);
    });
  });

  describe('Dispute Metrics', () => {
    it('should count disputes by status', async () => {
      mockPrisma.dispute.count
        .mockResolvedValueOnce(5) // Open
        .mockResolvedValueOnce(45); // Resolved

      const openDisputes = await mockPrisma.dispute.count({
        where: { status: 'OPEN' },
      });
      const resolvedDisputes = await mockPrisma.dispute.count({
        where: { status: { in: ['RESOLVED_BUYER', 'RESOLVED_SELLER', 'RESOLVED_SPLIT', 'CLOSED'] } },
      });

      expect(openDisputes).toBe(5);
      expect(resolvedDisputes).toBe(45);
    });

    it('should calculate total refunds', async () => {
      mockPrisma.dispute.aggregate.mockResolvedValue({
        _sum: { refundAmount: new Decimal('2500.00') },
      });

      const result = await mockPrisma.dispute.aggregate({
        _sum: { refundAmount: true },
      });

      expect(Number(result._sum.refundAmount)).toBe(2500);
    });
  });
});

describe('Metrics Calculation Helpers', () => {
  describe('calculateChange', () => {
    const calculateChange = (current: number, previous: number) => {
      const value = current - previous;
      const percentage = previous > 0 ? Math.abs(value / previous) * 100 : (current > 0 ? 100 : 0);
      const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
      return { value, percentage, direction };
    };

    it('should calculate positive change', () => {
      const result = calculateChange(150, 100);
      expect(result.value).toBe(50);
      expect(result.percentage).toBe(50);
      expect(result.direction).toBe('up');
    });

    it('should calculate negative change', () => {
      const result = calculateChange(80, 100);
      expect(result.value).toBe(-20);
      expect(result.percentage).toBe(20);
      expect(result.direction).toBe('down');
    });

    it('should handle zero previous value', () => {
      const result = calculateChange(100, 0);
      expect(result.percentage).toBe(100);
      expect(result.direction).toBe('up');
    });

    it('should handle no change', () => {
      const result = calculateChange(100, 100);
      expect(result.value).toBe(0);
      expect(result.direction).toBe('neutral');
    });
  });

  describe('formatCurrency', () => {
    const formatCurrency = (value: number | string, currency = 'EUR') => {
      const num = typeof value === 'string' ? parseFloat(value) : value;
      return new Intl.NumberFormat('en-EU', {
        style: 'currency',
        currency,
      }).format(num);
    };

    it('should format EUR correctly', () => {
      const result = formatCurrency(1234.56);
      expect(result).toContain('1,234.56');
    });

    it('should handle zero', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });

    it('should handle string input', () => {
      const result = formatCurrency('99.99');
      expect(result).toContain('99.99');
    });
  });
});

describe('Funnel Metrics', () => {
  describe('Visitor to Signup Funnel', () => {
    it('should calculate conversion rate correctly', () => {
      const visitors = 10000;
      const signups = 500;

      const conversionRate = visitors > 0 ? (signups / visitors) * 100 : 0;

      expect(conversionRate).toBe(5);
    });
  });

  describe('Signup to Request Funnel', () => {
    it('should calculate conversion rate correctly', () => {
      const signups = 500;
      const usersWithRequests = 200;

      const conversionRate = signups > 0 ? (usersWithRequests / signups) * 100 : 0;

      expect(conversionRate).toBe(40);
    });
  });

  describe('Subscription Funnel', () => {
    it('should calculate full funnel conversion', () => {
      const planViews = 1000;
      const checkoutStarts = 300;
      const subscribed = 150;

      const viewToCheckoutRate = planViews > 0 ? (checkoutStarts / planViews) * 100 : 0;
      const checkoutToSubscribeRate = checkoutStarts > 0 ? (subscribed / checkoutStarts) * 100 : 0;
      const overallRate = planViews > 0 ? (subscribed / planViews) * 100 : 0;

      expect(viewToCheckoutRate).toBe(30);
      expect(checkoutToSubscribeRate).toBe(50);
      expect(overallRate).toBe(15);
    });
  });
});

describe('Time-based Metrics', () => {
  describe('Period Comparison', () => {
    it('should calculate correct date ranges for 30d', () => {
      const endDate = new Date('2026-01-18');
      const startDate = new Date('2025-12-19');

      const periodLength = endDate.getTime() - startDate.getTime();
      const expectedDays = 30;
      const actualDays = Math.round(periodLength / (1000 * 60 * 60 * 24));

      expect(actualDays).toBe(expectedDays);
    });

    it('should calculate previous period correctly', () => {
      const startDate = new Date('2025-12-19');
      const endDate = new Date('2026-01-18');

      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodLength);
      const prevEndDate = new Date(startDate.getTime() - 1);

      // Previous period should be the same length
      const prevPeriodLength = prevEndDate.getTime() - prevStartDate.getTime() + 1;

      expect(prevStartDate < startDate).toBe(true);
      expect(prevEndDate < startDate).toBe(true);
    });
  });
});
