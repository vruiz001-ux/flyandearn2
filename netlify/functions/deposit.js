import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import { getFxRate, getCurrencyForCountry } from './lib/fx.js';
import Stripe from 'stripe';
import crypto from 'crypto';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Fixed deposit amount in EUR
const DEPOSIT_AMOUNT_EUR = 20;

// Stripe requires amounts in cents/smallest currency unit
const EUR_MULTIPLIER = 100;
const PLN_MULTIPLIER = 100;

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // All deposit endpoints require authentication
  const token = getSessionToken(event);
  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.userId) {
    return jsonResponse(401, { error: 'Invalid session' });
  }

  const userId = payload.userId;

  switch (httpMethod) {
    case 'GET':
      if (action === 'status') {
        const requestId = event.queryStringParameters?.requestId;
        return getDepositStatus(userId, requestId);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    case 'POST':
      if (action === 'create') {
        return createDeposit(userId, event);
      }
      if (action === 'confirm') {
        return confirmDeposit(userId, event);
      }
      if (action === 'refund') {
        return refundDeposit(userId, event);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

/**
 * POST /deposit/create - Create a deposit PaymentIntent for a request
 *
 * Creates a €20 (or PLN equivalent) PaymentIntent with manual capture.
 * Returns client_secret for frontend Payment Element.
 *
 * Supports payment methods: card, blik (Poland), p24 (Poland)
 */
async function createDeposit(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { requestId, preferredCurrency } = body;

    if (!requestId) {
      return jsonResponse(400, { error: 'requestId is required' });
    }

    // Get request and verify ownership
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            name: true,
            country: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    if (request.buyerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to pay for this request' });
    }

    // Check if request is in valid state for deposit
    if (request.status !== 'OPEN') {
      return jsonResponse(400, {
        error: `Cannot pay deposit for request in ${request.status} status`
      });
    }

    // Check existing deposit status
    if (request.depositStatus === 'CAPTURED') {
      return jsonResponse(400, { error: 'Deposit already paid' });
    }

    if (request.depositStatus === 'TRANSFERRED') {
      return jsonResponse(400, { error: 'Deposit already transferred to traveller' });
    }

    // If there's an existing PaymentIntent that's not failed, return it
    if (
      request.stripeDepositPaymentIntentId &&
      request.depositStatus !== 'FAILED'
    ) {
      const existingIntent = await stripe.paymentIntents.retrieve(
        request.stripeDepositPaymentIntentId
      );

      if (
        existingIntent.status === 'requires_payment_method' ||
        existingIntent.status === 'requires_confirmation' ||
        existingIntent.status === 'requires_action'
      ) {
        return jsonResponse(200, {
          success: true,
          existing: true,
          clientSecret: existingIntent.client_secret,
          paymentIntentId: existingIntent.id,
          amount: existingIntent.amount / 100,
          currency: existingIntent.currency.toUpperCase(),
        });
      }
    }

    // Determine currency based on user's country or preference
    const currency = preferredCurrency || getCurrencyForCountry(request.buyer.country);
    let amount = DEPOSIT_AMOUNT_EUR;
    let fxRate = null;

    // Convert to PLN if needed
    if (currency === 'PLN') {
      const fx = await getFxRate('EUR', 'PLN');
      amount = Math.round(DEPOSIT_AMOUNT_EUR * fx.rate * 100) / 100;
      fxRate = fx.rate;
    }

    // Amount in Stripe's smallest unit (cents)
    const amountInCents = Math.round(amount * 100);

    // Get or create Stripe customer
    let stripeCustomerId = request.buyer.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: request.buyer.email,
        name: request.buyer.name,
        metadata: {
          userId: userId,
          platform: 'flyandearn',
        },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // Generate idempotency key
    const idempotencyKey = `deposit-${requestId}-${Date.now()}`;

    // Determine payment methods based on currency
    const paymentMethodTypes = ['card'];
    if (currency === 'PLN') {
      paymentMethodTypes.push('blik', 'p24');
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: currency.toLowerCase(),
        customer: stripeCustomerId,
        payment_method_types: paymentMethodTypes,
        capture_method: 'automatic', // Auto-capture since we're using Separate Charges
        metadata: {
          type: 'deposit',
          requestId,
          userId,
          depositEurAmount: DEPOSIT_AMOUNT_EUR.toString(),
          fxRate: fxRate?.toString() || '1',
          platform: 'flyandearn',
        },
        description: `FlyAndEarn deposit for request ${requestId}`,
        statement_descriptor_suffix: 'FAE DEPOSIT',
      },
      {
        idempotencyKey,
      }
    );

    // Update request with deposit info
    await prisma.request.update({
      where: { id: requestId },
      data: {
        depositAmount: amount,
        depositCurrency: currency,
        depositStatus: 'CREATED',
        stripeDepositPaymentIntentId: paymentIntent.id,
        depositIdempotencyKey: idempotencyKey,
      },
    });

    return jsonResponse(200, {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency,
      fxRate,
      supportedPaymentMethods: paymentMethodTypes,
    });
  } catch (error) {
    console.error('Create deposit error:', error);
    return jsonResponse(500, {
      error: 'Failed to create deposit payment',
      details: error.message,
    });
  }
}

/**
 * POST /deposit/confirm - Confirm deposit was successful (called after 3DS/BLIK)
 *
 * Updates deposit status based on PaymentIntent status.
 * Called by frontend after payment completion.
 */
async function confirmDeposit(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { requestId, paymentIntentId } = body;

    if (!requestId) {
      return jsonResponse(400, { error: 'requestId is required' });
    }

    // Get request
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    if (request.buyerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized' });
    }

    // Use provided paymentIntentId or stored one
    const piId = paymentIntentId || request.stripeDepositPaymentIntentId;
    if (!piId) {
      return jsonResponse(400, { error: 'No payment found for this request' });
    }

    // Get PaymentIntent status from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(piId);

    let newStatus;
    let depositPaidAt = null;

    switch (paymentIntent.status) {
      case 'succeeded':
        newStatus = 'CAPTURED';
        depositPaidAt = new Date();
        break;
      case 'requires_action':
        newStatus = 'REQUIRES_ACTION';
        break;
      case 'requires_payment_method':
        newStatus = 'CREATED';
        break;
      case 'processing':
        newStatus = 'REQUIRES_ACTION'; // Still processing (e.g., BLIK)
        break;
      case 'canceled':
        newStatus = 'FAILED';
        break;
      default:
        newStatus = request.depositStatus;
    }

    // Update request
    const updated = await prisma.request.update({
      where: { id: requestId },
      data: {
        depositStatus: newStatus,
        ...(depositPaidAt && { depositPaidAt }),
      },
    });

    return jsonResponse(200, {
      success: true,
      depositStatus: newStatus,
      paymentStatus: paymentIntent.status,
      paidAt: depositPaidAt,
      amount: request.depositAmount,
      currency: request.depositCurrency,
    });
  } catch (error) {
    console.error('Confirm deposit error:', error);
    return jsonResponse(500, { error: 'Failed to confirm deposit' });
  }
}

/**
 * GET /deposit/status - Get deposit status for a request
 */
async function getDepositStatus(userId, requestId) {
  try {
    if (!requestId) {
      return jsonResponse(400, { error: 'requestId is required' });
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        buyerId: true,
        depositAmount: true,
        depositCurrency: true,
        depositStatus: true,
        depositPaidAt: true,
        depositTransferredAt: true,
        stripeDepositPaymentIntentId: true,
      },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    // Only buyer can see deposit details
    if (request.buyerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized' });
    }

    // If there's a PaymentIntent, get latest status
    let paymentIntentStatus = null;
    if (request.stripeDepositPaymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(
          request.stripeDepositPaymentIntentId
        );
        paymentIntentStatus = pi.status;
      } catch (e) {
        console.error('Error fetching PaymentIntent:', e);
      }
    }

    return jsonResponse(200, {
      success: true,
      depositStatus: request.depositStatus,
      amount: request.depositAmount,
      currency: request.depositCurrency,
      paidAt: request.depositPaidAt,
      transferredAt: request.depositTransferredAt,
      paymentIntentStatus,
    });
  } catch (error) {
    console.error('Get deposit status error:', error);
    return jsonResponse(500, { error: 'Failed to get deposit status' });
  }
}

/**
 * POST /deposit/refund - Refund deposit (for cancelled requests)
 *
 * Only allowed if deposit is CAPTURED and request is being cancelled.
 * Admin or buyer can request refund.
 */
async function refundDeposit(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { requestId, reason } = body;

    if (!requestId) {
      return jsonResponse(400, { error: 'requestId is required' });
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    // Only buyer can refund their own deposit
    if (request.buyerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to refund this deposit' });
    }

    // Can only refund CAPTURED deposits (not yet transferred)
    if (request.depositStatus !== 'CAPTURED') {
      return jsonResponse(400, {
        error: `Cannot refund deposit in ${request.depositStatus} status. Only CAPTURED deposits can be refunded.`
      });
    }

    if (!request.stripeDepositPaymentIntentId) {
      return jsonResponse(400, { error: 'No payment found to refund' });
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: request.stripeDepositPaymentIntentId,
      reason: 'requested_by_customer',
      metadata: {
        requestId,
        userId,
        refundReason: reason || 'Request cancelled',
      },
    });

    // Update request
    await prisma.request.update({
      where: { id: requestId },
      data: {
        depositStatus: 'REFUNDED',
        status: 'CANCELLED',
      },
    });

    return jsonResponse(200, {
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      currency: refund.currency.toUpperCase(),
      status: refund.status,
    });
  } catch (error) {
    console.error('Refund deposit error:', error);
    return jsonResponse(500, {
      error: 'Failed to refund deposit',
      details: error.message,
    });
  }
}

/**
 * Transfer deposit to Traveller's Connect account
 * Called internally when offer is accepted
 *
 * @param {string} requestId - The request ID
 * @param {string} travellerId - The traveller's user ID
 * @returns {Promise<{success: boolean, transferId?: string, error?: string}>}
 */
export async function transferDepositToTraveller(requestId, travellerId) {
  try {
    // Get request with deposit info
    const request = await prisma.request.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    // Verify deposit is captured
    if (request.depositStatus !== 'CAPTURED') {
      return {
        success: false,
        error: `Deposit not ready for transfer: ${request.depositStatus}`
      };
    }

    // Get traveller with Connect account
    const traveller = await prisma.user.findUnique({
      where: { id: travellerId },
      select: {
        id: true,
        stripeConnectAccountId: true,
        connectPayoutsEnabled: true,
      },
    });

    if (!traveller?.stripeConnectAccountId) {
      return {
        success: false,
        error: 'Traveller has not set up their payout account'
      };
    }

    if (!traveller.connectPayoutsEnabled) {
      return {
        success: false,
        error: 'Traveller\'s payout account is not fully verified'
      };
    }

    // Calculate amount to transfer (in cents)
    // For simplicity, transfer full deposit. Platform fee can be deducted here if needed.
    const amountInCents = Math.round(request.depositAmount * 100);

    // Create transfer to Traveller's Connect account
    const transfer = await stripe.transfers.create({
      amount: amountInCents,
      currency: request.depositCurrency.toLowerCase(),
      destination: traveller.stripeConnectAccountId,
      transfer_group: `request_${requestId}`,
      metadata: {
        type: 'deposit_transfer',
        requestId,
        travellerId,
        buyerId: request.buyerId,
        depositPaymentIntentId: request.stripeDepositPaymentIntentId,
      },
      description: `Deposit for request ${requestId}`,
    });

    // Update request
    await prisma.request.update({
      where: { id: requestId },
      data: {
        depositStatus: 'TRANSFERRED',
        depositTransferredAt: new Date(),
        stripeDepositTransferId: transfer.id,
      },
    });

    return {
      success: true,
      transferId: transfer.id,
      amount: request.depositAmount,
      currency: request.depositCurrency,
    };
  } catch (error) {
    console.error('Transfer deposit error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
