import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import Stripe from 'stripe';
import {
  getOrCreateWallet,
  getAccount,
  postLedgerEntry,
  getOrCreatePlatformAccount,
  generateIdempotencyKey,
} from './wallet.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Admin emails (configure via environment variable)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

/**
 * Check if user is admin
 */
async function isAdmin(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user && ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // All admin endpoints require authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  // Check admin access
  if (!(await isAdmin(payload.userId))) {
    return jsonResponse(403, { error: 'Admin access required' });
  }

  const adminUserId = payload.userId;

  switch (httpMethod) {
    case 'GET':
      if (action === 'stats') {
        return getPlatformStats();
      }
      if (action === 'pending-payouts') {
        return getPendingPayouts(event);
      }
      if (action === 'disputes') {
        return getDisputes(event);
      }
      if (action === 'wallet') {
        return getWalletDetails(event);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    case 'POST':
      if (action === 'process-payout') {
        return processPayout(adminUserId, event);
      }
      if (action === 'resolve-dispute') {
        return resolveDispute(adminUserId, event);
      }
      if (action === 'freeze-wallet') {
        return freezeWallet(adminUserId, event);
      }
      if (action === 'unfreeze-wallet') {
        return unfreezeWallet(adminUserId, event);
      }
      if (action === 'adjustment') {
        return createAdjustment(adminUserId, event);
      }
      if (action === 'auto-release') {
        return autoReleaseOrders(adminUserId);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

/**
 * GET /admin-wallet/stats - Get platform financial stats
 */
async function getPlatformStats() {
  try {
    // Get platform accounts
    const platformFees = await getOrCreatePlatformAccount('PLATFORM_FEES');
    const platformEscrow = await getOrCreatePlatformAccount('PLATFORM_ESCROW');

    // Get order stats
    const orderStats = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
      _sum: { totalAmount: true, platformFee: true },
    });

    // Get wallet stats
    const walletStats = await prisma.walletAccount.groupBy({
      by: ['type'],
      _sum: { balance: true },
    });

    // Get pending payouts
    const pendingPayouts = await prisma.payoutRequest.aggregate({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      _count: true,
      _sum: { amount: true },
    });

    // Get recent transactions
    const recentTransactions = await prisma.ledgerEntry.count({
      where: {
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    return jsonResponse(200, {
      success: true,
      stats: {
        platform: {
          totalFees: platformFees.balance,
          escrowBalance: platformEscrow.balance,
        },
        orders: orderStats.reduce((acc, s) => {
          acc[s.status] = {
            count: s._count,
            totalAmount: s._sum.totalAmount || 0,
            platformFee: s._sum.platformFee || 0,
          };
          return acc;
        }, {}),
        wallets: walletStats.reduce((acc, s) => {
          acc[s.type] = s._sum.balance || 0;
          return acc;
        }, {}),
        payouts: {
          pendingCount: pendingPayouts._count,
          pendingAmount: pendingPayouts._sum.amount || 0,
        },
        activity: {
          transactionsLast24h: recentTransactions,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return jsonResponse(500, { error: 'Failed to fetch stats' });
  }
}

/**
 * GET /admin-wallet/pending-payouts - Get pending payout requests
 */
async function getPendingPayouts(event) {
  try {
    const params = event.queryStringParameters || {};
    const { limit = '50' } = params;

    const payouts = await prisma.payoutRequest.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      include: {
        wallet: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            accounts: { where: { type: 'AVAILABLE' } },
            payoutMethods: { where: { status: 'VERIFIED', isDefault: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit, 10),
    });

    return jsonResponse(200, { success: true, payouts });
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    return jsonResponse(500, { error: 'Failed to fetch payouts' });
  }
}

/**
 * GET /admin-wallet/disputes - Get disputed orders
 */
async function getDisputes(event) {
  try {
    const params = event.queryStringParameters || {};
    const { limit = '50' } = params;

    const disputes = await prisma.order.findMany({
      where: { status: 'DISPUTED' },
      include: {
        request: { select: { product: true, category: true, fromCity: true, toCity: true } },
        buyer: { select: { id: true, name: true, email: true } },
        traveler: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit, 10),
    });

    return jsonResponse(200, { success: true, disputes });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return jsonResponse(500, { error: 'Failed to fetch disputes' });
  }
}

/**
 * GET /admin-wallet/wallet?userId=xxx - Get detailed wallet info
 */
async function getWalletDetails(event) {
  try {
    const params = event.queryStringParameters || {};
    const { userId } = params;

    if (!userId) {
      return jsonResponse(400, { error: 'userId is required' });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        accounts: true,
        payoutMethods: true,
        payoutRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!wallet) {
      return jsonResponse(404, { error: 'Wallet not found' });
    }

    // Get recent ledger entries
    const accountIds = wallet.accounts.map(a => a.id);
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        OR: [
          { debitAccountId: { in: accountIds } },
          { creditAccountId: { in: accountIds } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return jsonResponse(200, {
      success: true,
      wallet,
      ledgerEntries,
    });
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    return jsonResponse(500, { error: 'Failed to fetch wallet details' });
  }
}

/**
 * POST /admin-wallet/process-payout - Process a payout request
 */
async function processPayout(adminUserId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { payoutRequestId } = body;

    if (!payoutRequestId) {
      return jsonResponse(400, { error: 'payoutRequestId is required' });
    }

    const payoutRequest = await prisma.payoutRequest.findUnique({
      where: { id: payoutRequestId },
      include: {
        wallet: {
          include: {
            accounts: true,
            payoutMethods: { where: { status: 'VERIFIED', isDefault: true } },
          },
        },
      },
    });

    if (!payoutRequest) {
      return jsonResponse(404, { error: 'Payout request not found' });
    }

    if (payoutRequest.status !== 'PENDING') {
      return jsonResponse(400, { error: 'Payout is not in pending status' });
    }

    const payoutMethod = payoutRequest.wallet.payoutMethods[0];
    if (!payoutMethod) {
      return jsonResponse(400, { error: 'No verified payout method' });
    }

    const availableAccount = getAccount(payoutRequest.wallet, 'AVAILABLE');
    if (!availableAccount || availableAccount.balance < payoutRequest.amount) {
      return jsonResponse(400, { error: 'Insufficient available balance' });
    }

    // Create Stripe payout (if using Stripe Connect)
    let stripePayout = null;
    if (payoutMethod.stripeConnectedAccountId) {
      // Transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(payoutRequest.amount * 100),
        currency: payoutRequest.currency.toLowerCase(),
        destination: payoutMethod.stripeConnectedAccountId,
        metadata: {
          payoutRequestId: payoutRequest.id,
          walletId: payoutRequest.walletId,
        },
      });

      // Create payout from connected account
      stripePayout = await stripe.payouts.create({
        amount: Math.round(payoutRequest.amount * 100),
        currency: payoutRequest.currency.toLowerCase(),
      }, {
        stripeAccount: payoutMethod.stripeConnectedAccountId,
      });
    }

    // Update payout request
    await prisma.payoutRequest.update({
      where: { id: payoutRequestId },
      data: {
        status: 'PROCESSING',
        stripePayoutId: stripePayout?.id,
      },
    });

    return jsonResponse(200, {
      success: true,
      message: 'Payout processing initiated',
      stripePayoutId: stripePayout?.id,
    });
  } catch (error) {
    console.error('Error processing payout:', error);
    return jsonResponse(500, { error: 'Failed to process payout' });
  }
}

/**
 * POST /admin-wallet/resolve-dispute - Resolve a disputed order
 */
async function resolveDispute(adminUserId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId, resolution, reason } = body;

    if (!orderId || !resolution) {
      return jsonResponse(400, { error: 'orderId and resolution are required' });
    }

    if (!['buyer_wins', 'traveler_wins'].includes(resolution)) {
      return jsonResponse(400, { error: 'resolution must be buyer_wins or traveler_wins' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    if (order.status !== 'DISPUTED') {
      return jsonResponse(400, { error: 'Order is not in disputed status' });
    }

    const travelerWallet = await getOrCreateWallet(order.travelerId);
    const frozenAccount = getAccount(travelerWallet, 'FROZEN');
    const availableAccount = getAccount(travelerWallet, 'AVAILABLE');

    if (resolution === 'traveler_wins') {
      // Unfreeze funds to traveler's available
      if (frozenAccount && availableAccount && frozenAccount.balance >= order.travelerAmount) {
        await postLedgerEntry({
          type: 'UNFREEZE',
          amount: order.travelerAmount,
          debitAccountId: frozenAccount.id,
          creditAccountId: availableAccount.id,
          referenceType: 'ORDER',
          referenceId: order.id,
          idempotencyKey: generateIdempotencyKey('UNFREEZE', 'RESOLVE', order.id),
          description: `Dispute resolved in traveler's favor for order ${order.id}`,
          metadata: { resolution, reason, resolvedBy: adminUserId },
          createdBy: adminUserId,
        });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    } else {
      // buyer_wins - refund buyer, debit frozen
      if (frozenAccount && frozenAccount.balance >= order.travelerAmount) {
        await prisma.$transaction(async (tx) => {
          await tx.walletAccount.update({
            where: { id: frozenAccount.id },
            data: { balance: { decrement: order.travelerAmount } },
          });

          await tx.ledgerEntry.create({
            data: {
              type: 'REFUND',
              status: 'COMPLETED',
              amount: order.travelerAmount,
              currency: order.currency,
              debitAccountId: frozenAccount.id,
              creditAccountId: frozenAccount.id,
              referenceType: 'ORDER',
              referenceId: order.id,
              idempotencyKey: generateIdempotencyKey('REFUND', 'RESOLVE', order.id),
              description: `Dispute resolved in buyer's favor - refund for order ${order.id}`,
              metadata: { resolution, reason, resolvedBy: adminUserId },
              createdBy: adminUserId,
            },
          });
        });

        // Process Stripe refund if payment exists
        if (order.stripePaymentIntentId) {
          await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
            reason: 'requested_by_customer',
          });
        }
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED', refundedAt: new Date() },
      });

      // Reopen request
      await prisma.request.update({
        where: { id: order.requestId },
        data: { status: 'OPEN' },
      });
    }

    return jsonResponse(200, {
      success: true,
      message: `Dispute resolved: ${resolution}`,
    });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    return jsonResponse(500, { error: 'Failed to resolve dispute' });
  }
}

/**
 * POST /admin-wallet/freeze-wallet - Freeze a user's wallet
 */
async function freezeWallet(adminUserId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, reason } = body;

    if (!userId) {
      return jsonResponse(400, { error: 'userId is required' });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return jsonResponse(404, { error: 'Wallet not found' });
    }

    await prisma.wallet.update({
      where: { userId },
      data: { status: 'FROZEN' },
    });

    console.log(`Wallet frozen for user ${userId} by admin ${adminUserId}. Reason: ${reason}`);

    return jsonResponse(200, {
      success: true,
      message: 'Wallet frozen',
    });
  } catch (error) {
    console.error('Error freezing wallet:', error);
    return jsonResponse(500, { error: 'Failed to freeze wallet' });
  }
}

/**
 * POST /admin-wallet/unfreeze-wallet - Unfreeze a user's wallet
 */
async function unfreezeWallet(adminUserId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, reason } = body;

    if (!userId) {
      return jsonResponse(400, { error: 'userId is required' });
    }

    await prisma.wallet.update({
      where: { userId },
      data: { status: 'ACTIVE' },
    });

    console.log(`Wallet unfrozen for user ${userId} by admin ${adminUserId}. Reason: ${reason}`);

    return jsonResponse(200, {
      success: true,
      message: 'Wallet unfrozen',
    });
  } catch (error) {
    console.error('Error unfreezing wallet:', error);
    return jsonResponse(500, { error: 'Failed to unfreeze wallet' });
  }
}

/**
 * POST /admin-wallet/adjustment - Create a manual balance adjustment
 */
async function createAdjustment(adminUserId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, accountType, amount, reason } = body;

    if (!userId || !accountType || !amount || !reason) {
      return jsonResponse(400, {
        error: 'userId, accountType, amount, and reason are required',
      });
    }

    const wallet = await getOrCreateWallet(userId);
    const account = getAccount(wallet, accountType);

    if (!account) {
      return jsonResponse(404, { error: 'Account not found' });
    }

    // Prevent negative balances for deductions
    if (amount < 0 && account.balance + amount < 0) {
      return jsonResponse(400, {
        error: 'Adjustment would result in negative balance',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.walletAccount.update({
        where: { id: account.id },
        data: { balance: { increment: amount } },
      });

      await tx.ledgerEntry.create({
        data: {
          type: 'ADJUSTMENT',
          status: 'COMPLETED',
          amount: Math.abs(amount),
          currency: 'EUR',
          debitAccountId: account.id,
          creditAccountId: account.id,
          referenceType: 'ADJUSTMENT',
          referenceId: `adj-${Date.now()}`,
          idempotencyKey: generateIdempotencyKey('ADJUSTMENT', 'MANUAL', userId),
          description: `Admin adjustment: ${reason}`,
          metadata: {
            direction: amount >= 0 ? 'credit' : 'debit',
            reason,
            adminUserId,
          },
          createdBy: adminUserId,
        },
      });
    });

    return jsonResponse(200, {
      success: true,
      message: `Adjustment of ${amount >= 0 ? '+' : ''}${amount} EUR applied`,
      newBalance: account.balance + amount,
    });
  } catch (error) {
    console.error('Error creating adjustment:', error);
    return jsonResponse(500, { error: 'Failed to create adjustment' });
  }
}

/**
 * POST /admin-wallet/auto-release - Auto-release funds for orders past release date
 */
async function autoReleaseOrders(adminUserId) {
  try {
    // Find orders ready for auto-release
    const ordersToRelease = await prisma.order.findMany({
      where: {
        status: 'PAID',
        releaseAt: { lte: new Date() },
      },
      take: 100, // Batch size
    });

    let released = 0;
    let errors = 0;

    for (const order of ordersToRelease) {
      try {
        const travelerWallet = await getOrCreateWallet(order.travelerId);
        const pendingAccount = getAccount(travelerWallet, 'PENDING');
        const availableAccount = getAccount(travelerWallet, 'AVAILABLE');

        if (pendingAccount && availableAccount && pendingAccount.balance >= order.travelerAmount) {
          await postLedgerEntry({
            type: 'RELEASE',
            amount: order.travelerAmount,
            debitAccountId: pendingAccount.id,
            creditAccountId: availableAccount.id,
            referenceType: 'ORDER',
            referenceId: order.id,
            idempotencyKey: generateIdempotencyKey('RELEASE', 'AUTO', order.id),
            description: `Auto-release for order ${order.id}`,
            createdBy: adminUserId,
          });

          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });

          await prisma.request.update({
            where: { id: order.requestId },
            data: { status: 'COMPLETED' },
          });

          released++;
        }
      } catch (err) {
        console.error(`Error releasing order ${order.id}:`, err);
        errors++;
      }
    }

    return jsonResponse(200, {
      success: true,
      message: `Auto-release complete: ${released} orders released, ${errors} errors`,
      released,
      errors,
      total: ordersToRelease.length,
    });
  } catch (error) {
    console.error('Error in auto-release:', error);
    return jsonResponse(500, { error: 'Failed to run auto-release' });
  }
}
