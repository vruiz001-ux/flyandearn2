import prisma from './lib/prisma.js';

// This is a scheduled function that runs automatically to release eligible escrow funds
// It can be triggered by Netlify scheduled functions or called manually

export async function handler(event) {
  // For scheduled functions, we use a simple API key check
  // In production, this should be called by Netlify's scheduler
  const authHeader = event.headers.authorization || event.headers.Authorization;
  const cronSecret = process.env.CRON_SECRET;

  // Allow if called from Netlify scheduler or with valid secret
  const isScheduledCall = event.headers['x-netlify-event'] === 'schedule';
  const hasValidSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isScheduledCall && !hasValidSecret) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  console.log('Starting scheduled auto-release at:', new Date().toISOString());

  try {
    // Find all orders eligible for auto-release
    // Criteria: status is PAID and releaseAt date has passed
    const eligibleOrders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        releaseAt: { lte: new Date() },
      },
      include: {
        traveler: {
          include: {
            wallet: {
              include: { accounts: true },
            },
          },
        },
      },
    });

    console.log(`Found ${eligibleOrders.length} orders eligible for auto-release`);

    const results = {
      processed: 0,
      released: 0,
      errors: [],
    };

    for (const order of eligibleOrders) {
      results.processed++;

      try {
        const wallet = order.traveler?.wallet;
        if (!wallet) {
          results.errors.push({
            orderId: order.id,
            error: 'No wallet found for traveler',
          });
          continue;
        }

        const pendingAccount = wallet.accounts.find(a => a.type === 'PENDING');
        const availableAccount = wallet.accounts.find(a => a.type === 'AVAILABLE');

        if (!pendingAccount || !availableAccount) {
          results.errors.push({
            orderId: order.id,
            error: 'Missing wallet accounts',
          });
          continue;
        }

        if (pendingAccount.balance < order.travelerAmount) {
          results.errors.push({
            orderId: order.id,
            error: 'Insufficient pending balance',
          });
          continue;
        }

        // Perform the release in a transaction
        await prisma.$transaction([
          // Debit from pending
          prisma.walletAccount.update({
            where: { id: pendingAccount.id },
            data: { balance: { decrement: order.travelerAmount } },
          }),
          // Credit to available
          prisma.walletAccount.update({
            where: { id: availableAccount.id },
            data: { balance: { increment: order.travelerAmount } },
          }),
          // Create ledger entry
          prisma.ledgerEntry.create({
            data: {
              type: 'RELEASE',
              status: 'COMPLETED',
              amount: order.travelerAmount,
              currency: order.currency,
              debitAccountId: pendingAccount.id,
              creditAccountId: availableAccount.id,
              referenceType: 'ORDER',
              referenceId: order.id,
              idempotencyKey: `scheduled-release-${order.id}-${Date.now()}`,
              description: `Scheduled auto-release for order ${order.id}`,
            },
          }),
          // Update order status
          prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          }),
          // Update related request
          prisma.request.update({
            where: { id: order.requestId },
            data: { status: 'COMPLETED' },
          }),
        ]);

        // Create audit log for the auto-release
        await prisma.auditLog.create({
          data: {
            adminId: null, // System action
            action: 'AUTO_RELEASE',
            entityType: 'ORDER',
            entityId: order.id,
            metadata: {
              amount: order.travelerAmount,
              currency: order.currency,
              travelerId: order.travelerId,
              triggeredBy: 'scheduled_function',
            },
          },
        });

        results.released++;
        console.log(`Released order ${order.id} - €${order.travelerAmount}`);
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error);
        results.errors.push({
          orderId: order.id,
          error: error.message,
        });
      }
    }

    console.log('Auto-release completed:', results);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
      }),
    };
  } catch (error) {
    console.error('Auto-release function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Auto-release function failed',
        message: error.message,
      }),
    };
  }
}

// Netlify scheduled function configuration
// This will run daily at 3:00 AM UTC
export const config = {
  schedule: '@daily',
};
