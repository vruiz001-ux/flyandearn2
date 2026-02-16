import prisma from './lib/prisma.js';
import { jsonResponse } from './lib/auth.js';
import Stripe from 'stripe';
import {
  getOrCreateWallet,
  getAccount,
  postLedgerEntry,
  getOrCreatePlatformAccount,
  generateIdempotencyKey,
} from './wallet.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      endpointSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return jsonResponse(400, { error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  try {
    switch (stripeEvent.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;

      case 'payout.paid':
        await handlePayoutPaid(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'payout.failed':
        await handlePayoutFailed(stripeEvent.data.object);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'charge.dispute.closed':
        await handleDisputeClosed(stripeEvent.data.object, stripeEvent.id);
        break;

      // Subscription events
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripeEvent.data.object, stripeEvent.id);
        break;

      // Stripe Connect events
      case 'account.updated':
        await handleAccountUpdated(stripeEvent.data.object);
        break;

      // Transfer events
      case 'transfer.created':
        await handleTransferCreated(stripeEvent.data.object, stripeEvent.id);
        break;

      case 'transfer.failed':
        await handleTransferFailed(stripeEvent.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return jsonResponse(200, { received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return jsonResponse(500, { error: 'Webhook processing failed' });
  }
}

/**
 * Handle successful payment - allocate funds to traveler's pending account
 * Also handles deposit payments
 */
async function handlePaymentSucceeded(paymentIntent, eventId) {
  const { type, orderId, requestId } = paymentIntent.metadata;

  // Handle deposit payments
  if (type === 'deposit' && requestId) {
    await handleDepositSucceeded(paymentIntent, eventId, requestId);
    return;
  }

  if (!orderId || orderId === 'pending') {
    console.error('No orderId in payment intent metadata');
    return;
  }

  // Check for idempotency
  const existingEntry = await prisma.ledgerEntry.findUnique({
    where: { providerEventId: eventId },
  });

  if (existingEntry) {
    console.log('Payment already processed (idempotent)');
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    console.error('Order not found:', orderId);
    return;
  }

  if (order.status !== 'PENDING_PAYMENT') {
    console.log('Order already processed:', order.status);
    return;
  }

  // Get platform escrow account
  const platformEscrow = await getOrCreatePlatformAccount('PLATFORM_ESCROW');
  const platformFees = await getOrCreatePlatformAccount('PLATFORM_FEES');

  // Get traveler's wallet
  const travelerWallet = await getOrCreateWallet(order.travelerId);
  const pendingAccount = getAccount(travelerWallet, 'PENDING');

  if (!pendingAccount) {
    console.error('Traveler pending account not found');
    return;
  }

  // Create ledger entries atomically
  await prisma.$transaction(async (tx) => {
    // 1. Record deposit to platform escrow (virtual - the money is at Stripe)
    // We're using platformEscrow as a tracking account
    await tx.platformAccount.update({
      where: { id: platformEscrow.id },
      data: { balance: { increment: order.totalAmount } },
    });

    // 2. Allocate platform fee
    await tx.platformAccount.update({
      where: { id: platformFees.id },
      data: { balance: { increment: order.platformFee } },
    });

    // 3. Credit traveler's pending account
    await tx.walletAccount.update({
      where: { id: pendingAccount.id },
      data: { balance: { increment: order.travelerAmount } },
    });

    // 4. Deduct from escrow (tracking)
    await tx.platformAccount.update({
      where: { id: platformEscrow.id },
      data: { balance: { decrement: order.travelerAmount + order.platformFee } },
    });

    // 5. Create ledger entry for audit trail
    await tx.ledgerEntry.create({
      data: {
        type: 'DEPOSIT',
        status: 'COMPLETED',
        amount: order.totalAmount,
        currency: order.currency,
        debitAccountId: platformEscrow.id, // Debit from platform escrow (buyer's payment)
        creditAccountId: pendingAccount.id, // Credit to traveler pending
        referenceType: 'ORDER',
        referenceId: order.id,
        idempotencyKey: generateIdempotencyKey('DEPOSIT', 'ORDER', order.id),
        providerEventId: eventId,
        description: `Payment received for order ${order.id}`,
        metadata: {
          paymentIntentId: paymentIntent.id,
          productPrice: order.productPrice,
          serviceFee: order.serviceFee,
          platformFee: order.platformFee,
          travelerAmount: order.travelerAmount,
        },
      },
    });

    // 6. Create fee allocation entry
    await tx.ledgerEntry.create({
      data: {
        type: 'FEE_ALLOCATION',
        status: 'COMPLETED',
        amount: order.platformFee,
        currency: order.currency,
        debitAccountId: pendingAccount.id,
        creditAccountId: pendingAccount.id,
        referenceType: 'ORDER',
        referenceId: order.id,
        idempotencyKey: generateIdempotencyKey('FEE_ALLOCATION', 'ORDER', order.id),
        description: `Platform fee for order ${order.id}`,
      },
    });

    // 7. Update order status
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paymentStatus: 'succeeded',
        paidAt: new Date(),
        // Set auto-release date (e.g., 14 days after payment)
        releaseAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  });

  console.log(`Payment succeeded for order ${orderId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(paymentIntent) {
  const { type, orderId, requestId } = paymentIntent.metadata;

  // Handle deposit payment failure
  if (type === 'deposit' && requestId) {
    await prisma.request.update({
      where: { id: requestId },
      data: { depositStatus: 'FAILED' },
    });
    console.log(`Deposit payment failed for request ${requestId}`);
    return;
  }

  if (!orderId || orderId === 'pending') return;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'failed',
    },
  });

  console.log(`Payment failed for order ${orderId}`);
}

/**
 * Handle successful payout
 */
async function handlePayoutPaid(payout, eventId) {
  // Find payout request by Stripe payout ID
  const payoutRequest = await prisma.payoutRequest.findUnique({
    where: { stripePayoutId: payout.id },
    include: { wallet: { include: { accounts: true } } },
  });

  if (!payoutRequest) {
    console.log('Payout request not found for:', payout.id);
    return;
  }

  if (payoutRequest.status === 'COMPLETED') {
    console.log('Payout already completed');
    return;
  }

  const availableAccount = getAccount(payoutRequest.wallet, 'AVAILABLE');

  if (!availableAccount) {
    console.error('Available account not found');
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Create withdrawal ledger entry
    await tx.ledgerEntry.create({
      data: {
        type: 'WITHDRAWAL',
        status: 'COMPLETED',
        amount: payoutRequest.amount,
        currency: payoutRequest.currency,
        debitAccountId: availableAccount.id,
        creditAccountId: availableAccount.id,
        referenceType: 'PAYOUT',
        referenceId: payoutRequest.id,
        idempotencyKey: generateIdempotencyKey('WITHDRAWAL', 'PAYOUT', payoutRequest.id),
        providerEventId: eventId,
        description: `Withdrawal payout ${payoutRequest.id}`,
      },
    });

    // Deduct from available balance
    await tx.walletAccount.update({
      where: { id: availableAccount.id },
      data: { balance: { decrement: payoutRequest.amount } },
    });

    // Update payout request status
    await tx.payoutRequest.update({
      where: { id: payoutRequest.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  });

  console.log(`Payout completed for request ${payoutRequest.id}`);
}

/**
 * Handle failed payout
 */
async function handlePayoutFailed(payout) {
  const payoutRequest = await prisma.payoutRequest.findUnique({
    where: { stripePayoutId: payout.id },
  });

  if (!payoutRequest) return;

  await prisma.payoutRequest.update({
    where: { id: payoutRequest.id },
    data: {
      status: 'FAILED',
      failureReason: payout.failure_message || 'Unknown failure',
      failureCode: payout.failure_code,
    },
  });

  console.log(`Payout failed for request ${payoutRequest.id}`);
}

/**
 * Handle charge refunded
 */
async function handleChargeRefunded(charge, eventId) {
  // Find order by payment intent
  const order = await prisma.order.findFirst({
    where: {
      stripePaymentIntentId: charge.payment_intent,
    },
  });

  if (!order) return;

  if (order.status === 'REFUNDED') {
    console.log('Order already refunded');
    return;
  }

  // Get traveler wallet
  const travelerWallet = await getOrCreateWallet(order.travelerId);
  const pendingAccount = getAccount(travelerWallet, 'PENDING');

  if (pendingAccount && pendingAccount.balance >= order.travelerAmount) {
    await prisma.$transaction(async (tx) => {
      // Reverse the pending allocation
      await tx.walletAccount.update({
        where: { id: pendingAccount.id },
        data: { balance: { decrement: order.travelerAmount } },
      });

      // Create refund ledger entry
      await tx.ledgerEntry.create({
        data: {
          type: 'REFUND',
          status: 'COMPLETED',
          amount: order.travelerAmount,
          currency: order.currency,
          debitAccountId: pendingAccount.id,
          creditAccountId: pendingAccount.id,
          referenceType: 'ORDER',
          referenceId: order.id,
          idempotencyKey: generateIdempotencyKey('REFUND', 'ORDER', order.id),
          providerEventId: eventId,
          description: `Refund for order ${order.id}`,
        },
      });

      // Update order status
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
        },
      });

      // Update request status
      await tx.request.update({
        where: { id: order.requestId },
        data: { status: 'OPEN' },
      });
    });
  }

  console.log(`Refund processed for order ${order.id}`);
}

/**
 * Handle Stripe dispute created (chargeback initiated)
 */
async function handleDisputeCreated(dispute, eventId) {
  const charge = dispute.charge;

  // Find the order
  const order = await prisma.order.findFirst({
    where: {
      stripePaymentIntentId: dispute.payment_intent,
    },
  });

  if (!order) return;

  // Freeze traveler's funds if not already frozen
  const travelerWallet = await getOrCreateWallet(order.travelerId);
  const pendingAccount = getAccount(travelerWallet, 'PENDING');
  const availableAccount = getAccount(travelerWallet, 'AVAILABLE');
  const frozenAccount = getAccount(travelerWallet, 'FROZEN');

  // Determine which account has the funds
  let sourceAccount = null;
  if (pendingAccount && pendingAccount.balance >= order.travelerAmount) {
    sourceAccount = pendingAccount;
  } else if (availableAccount && availableAccount.balance >= order.travelerAmount) {
    sourceAccount = availableAccount;
  }

  if (sourceAccount && frozenAccount) {
    await postLedgerEntry({
      type: 'FREEZE',
      amount: order.travelerAmount,
      debitAccountId: sourceAccount.id,
      creditAccountId: frozenAccount.id,
      referenceType: 'ORDER',
      referenceId: order.id,
      idempotencyKey: generateIdempotencyKey('FREEZE', 'DISPUTE', dispute.id),
      providerEventId: eventId,
      description: `Chargeback dispute for order ${order.id}`,
      metadata: { disputeId: dispute.id, reason: dispute.reason },
    });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'DISPUTED' },
  });

  console.log(`Dispute created for order ${order.id}`);
}

/**
 * Handle dispute closed
 */
async function handleDisputeClosed(dispute, eventId) {
  const order = await prisma.order.findFirst({
    where: {
      stripePaymentIntentId: dispute.payment_intent,
    },
  });

  if (!order) return;

  const travelerWallet = await getOrCreateWallet(order.travelerId);
  const frozenAccount = getAccount(travelerWallet, 'FROZEN');

  if (dispute.status === 'won') {
    // Merchant won - unfreeze funds
    const availableAccount = getAccount(travelerWallet, 'AVAILABLE');

    if (frozenAccount && availableAccount && frozenAccount.balance >= order.travelerAmount) {
      await postLedgerEntry({
        type: 'UNFREEZE',
        amount: order.travelerAmount,
        debitAccountId: frozenAccount.id,
        creditAccountId: availableAccount.id,
        referenceType: 'ORDER',
        referenceId: order.id,
        idempotencyKey: generateIdempotencyKey('UNFREEZE', 'DISPUTE', dispute.id),
        providerEventId: eventId,
        description: `Dispute won - funds unfrozen for order ${order.id}`,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' },
      });
    }
  } else if (dispute.status === 'lost') {
    // Merchant lost - debit frozen funds
    if (frozenAccount && frozenAccount.balance >= order.travelerAmount) {
      await prisma.$transaction(async (tx) => {
        await tx.walletAccount.update({
          where: { id: frozenAccount.id },
          data: { balance: { decrement: order.travelerAmount } },
        });

        await tx.ledgerEntry.create({
          data: {
            type: 'CHARGEBACK',
            status: 'COMPLETED',
            amount: order.travelerAmount,
            currency: order.currency,
            debitAccountId: frozenAccount.id,
            creditAccountId: frozenAccount.id,
            referenceType: 'ORDER',
            referenceId: order.id,
            idempotencyKey: generateIdempotencyKey('CHARGEBACK', 'DISPUTE', dispute.id),
            providerEventId: eventId,
            description: `Chargeback lost for order ${order.id}`,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'REFUNDED' },
        });
      });
    }
  }

  console.log(`Dispute closed for order ${order.id}: ${dispute.status}`);
}

// ==========================================
// SUBSCRIPTION WEBHOOK HANDLERS
// ==========================================

/**
 * Handle checkout session completed - activate subscription
 */
async function handleCheckoutCompleted(session, eventId) {
  // Only handle subscription checkouts
  if (session.mode !== 'subscription') {
    return;
  }

  const { subscriptionId, userId, planTier } = session.metadata || {};

  if (!subscriptionId) {
    console.log('No subscriptionId in checkout session metadata');
    return;
  }

  // Get the Stripe subscription ID from the session
  const stripeSubscriptionId = session.subscription;

  // Update our subscription record
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    console.error('Subscription not found:', subscriptionId);
    return;
  }

  if (subscription.status === 'ACTIVE') {
    console.log('Subscription already active');
    return;
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      stripeSubscriptionId,
      startDate: now,
      endDate,
      amountPaid: session.amount_total / 100, // Convert from cents
    },
  });

  console.log(`Subscription activated: ${subscriptionId} for user ${userId}`);
}

/**
 * Handle subscription updated (status changes, renewals, etc.)
 */
async function handleSubscriptionUpdated(stripeSubscription, eventId) {
  // Find our subscription by Stripe subscription ID
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.log('Subscription not found for Stripe ID:', stripeSubscription.id);
    return;
  }

  // Map Stripe status to our status
  let status = subscription.status;
  switch (stripeSubscription.status) {
    case 'active':
      status = 'ACTIVE';
      break;
    case 'past_due':
    case 'unpaid':
      status = 'PENDING_PAYMENT';
      break;
    case 'canceled':
    case 'incomplete_expired':
      status = 'CANCELLED';
      break;
  }

  // Update subscription
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status,
      endDate: new Date(stripeSubscription.current_period_end * 1000),
    },
  });

  console.log(`Subscription updated: ${subscription.id} -> ${status}`);
}

/**
 * Handle subscription deleted/cancelled
 */
async function handleSubscriptionDeleted(stripeSubscription, eventId) {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSubscription.id },
  });

  if (!subscription) {
    console.log('Subscription not found for Stripe ID:', stripeSubscription.id);
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  console.log(`Subscription cancelled: ${subscription.id}`);
}

/**
 * Handle successful invoice payment (subscription renewal)
 */
async function handleInvoicePaymentSucceeded(invoice, eventId) {
  // Only handle subscription invoices
  if (!invoice.subscription) {
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription },
  });

  if (!subscription) {
    return;
  }

  // If this is a renewal (not the first payment), reset purchase count
  if (invoice.billing_reason === 'subscription_cycle') {
    const newEndDate = new Date();
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'ACTIVE',
        purchasesUsed: 0, // Reset for new billing period
        startDate: new Date(),
        endDate: newEndDate,
        amountPaid: invoice.amount_paid / 100,
      },
    });

    console.log(`Subscription renewed: ${subscription.id}`);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice, eventId) {
  if (!invoice.subscription) {
    return;
  }

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: invoice.subscription },
  });

  if (!subscription) {
    return;
  }

  // Mark subscription as pending payment
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: 'PENDING_PAYMENT',
    },
  });

  console.log(`Subscription payment failed: ${subscription.id}`);
}

// ==========================================
// DEPOSIT PAYMENT HANDLERS
// ==========================================

/**
 * Handle successful deposit payment
 * Updates request depositStatus to CAPTURED
 */
async function handleDepositSucceeded(paymentIntent, eventId, requestId) {
  console.log(`Processing deposit payment for request ${requestId}`);

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    console.error('Request not found for deposit:', requestId);
    return;
  }

  // Idempotency check
  if (request.depositStatus === 'CAPTURED' || request.depositStatus === 'TRANSFERRED') {
    console.log('Deposit already processed (idempotent)');
    return;
  }

  // Update request with deposit status
  await prisma.request.update({
    where: { id: requestId },
    data: {
      depositStatus: 'CAPTURED',
      depositPaidAt: new Date(),
    },
  });

  console.log(`Deposit captured for request ${requestId}`);
}

// ==========================================
// STRIPE CONNECT HANDLERS
// ==========================================

/**
 * Handle Connect account updates
 * Syncs account status back to user record
 */
async function handleAccountUpdated(account) {
  const accountId = account.id;

  // Find user by Connect account ID
  const user = await prisma.user.findFirst({
    where: { stripeConnectAccountId: accountId },
  });

  if (!user) {
    console.log('No user found for Connect account:', accountId);
    return;
  }

  const onboardingComplete = account.details_submitted === true;
  const payoutsEnabled = account.payouts_enabled === true;

  // Only update if status changed
  if (
    user.connectOnboardingComplete !== onboardingComplete ||
    user.connectPayoutsEnabled !== payoutsEnabled
  ) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        connectOnboardingComplete: onboardingComplete,
        connectPayoutsEnabled: payoutsEnabled,
      },
    });

    console.log(`Connect account updated for user ${user.id}: onboarding=${onboardingComplete}, payouts=${payoutsEnabled}`);
  }
}

// ==========================================
// TRANSFER HANDLERS
// ==========================================

/**
 * Handle successful transfer creation
 * This confirms the deposit was transferred to the Traveller
 */
async function handleTransferCreated(transfer, eventId) {
  const { type, requestId, travellerId } = transfer.metadata || {};

  if (type !== 'deposit_transfer' || !requestId) {
    // Not a deposit transfer, skip
    return;
  }

  console.log(`Transfer created for request ${requestId}: ${transfer.id}`);

  // The request should already be updated by the API call,
  // but we can double-check and log for audit purposes
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { depositStatus: true, stripeDepositTransferId: true },
  });

  if (request && request.depositStatus !== 'TRANSFERRED') {
    await prisma.request.update({
      where: { id: requestId },
      data: {
        depositStatus: 'TRANSFERRED',
        depositTransferredAt: new Date(),
        stripeDepositTransferId: transfer.id,
      },
    });
  }

  console.log(`Deposit transfer confirmed for request ${requestId}`);
}

/**
 * Handle failed transfer
 * This is a critical failure - we need to alert and potentially refund
 */
async function handleTransferFailed(transfer) {
  const { type, requestId, travellerId } = transfer.metadata || {};

  if (type !== 'deposit_transfer' || !requestId) {
    return;
  }

  console.error(`Transfer FAILED for request ${requestId}:`, transfer.failure_message);

  // For now, log the failure. In production, this should:
  // 1. Alert admins
  // 2. Potentially revert the request status
  // 3. Queue for retry or manual intervention

  // Update request to indicate transfer failure
  // Note: We keep depositStatus as CAPTURED since the payment succeeded
  // The transfer just needs to be retried
  await prisma.request.update({
    where: { id: requestId },
    data: {
      // Add a metadata field to track this, or create an audit log
    },
  });

  // TODO: Send admin alert about failed transfer
  console.error(`CRITICAL: Deposit transfer failed for request ${requestId}. Manual intervention required.`);
}
