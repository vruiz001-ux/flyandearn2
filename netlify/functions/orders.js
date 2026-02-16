import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import { getFxRate } from './lib/fx.js';
import {
  canUserPurchase,
  incrementPurchaseCount,
  calculateOrderFees,
  PLATFORM_FEE_PERCENT,
  TRAVELLER_SERVICE_FEE_PERCENT,
  OTHER_SERVICE_FEE_PERCENT,
  ORDER_TYPES,
} from './lib/subscription.js';
import Stripe from 'stripe';
import crypto from 'crypto';
import {
  getOrCreateWallet,
  getAccount,
  postLedgerEntry,
  getOrCreatePlatformAccount,
  generateIdempotencyKey,
} from './wallet.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // All order endpoints require authentication
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
      return getOrders(userId, event);

    case 'POST':
      if (action === 'create') {
        return createOrder(userId, event);
      }
      if (action === 'complete') {
        return completeOrder(userId, event);
      }
      if (action === 'cancel') {
        return cancelOrder(userId, event);
      }
      if (action === 'dispute') {
        return disputeOrder(userId, event);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

/**
 * GET /orders - Get user's orders (as buyer or traveler)
 */
async function getOrders(userId, event) {
  try {
    const params = event.queryStringParameters || {};
    const { role, status, limit = '20' } = params;

    const where = {
      OR: [{ buyerId: userId }, { travelerId: userId }],
    };

    if (role === 'buyer') {
      where.OR = [{ buyerId: userId }];
    } else if (role === 'traveler') {
      where.OR = [{ travelerId: userId }];
    }

    if (status) {
      where.status = status.toUpperCase();
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        request: {
          select: {
            id: true,
            product: true,
            category: true,
            fromCity: true,
            toCity: true,
          },
        },
        buyer: {
          select: { id: true, name: true },
        },
        traveler: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
    });

    return jsonResponse(200, { success: true, orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return jsonResponse(500, { error: 'Failed to fetch orders' });
  }
}

/**
 * POST /orders/create - Create an order from an accepted offer
 */
async function createOrder(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { requestId, offerId } = body;

    if (!requestId || !offerId) {
      return jsonResponse(400, { error: 'requestId and offerId are required' });
    }

    // Check if user has an active subscription with remaining purchases
    const purchaseCheck = await canUserPurchase(userId);
    if (!purchaseCheck.canPurchase) {
      return jsonResponse(403, {
        error: 'Subscription required',
        details: purchaseCheck.reason,
        remainingPurchases: purchaseCheck.remainingPurchases,
      });
    }

    // Get request and offer
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        offers: { where: { id: offerId } },
        order: true,
      },
    });

    if (!request) {
      return jsonResponse(404, { error: 'Request not found' });
    }

    if (request.buyerId !== userId) {
      return jsonResponse(403, { error: 'Only the buyer can create an order' });
    }

    if (request.order) {
      return jsonResponse(400, { error: 'Order already exists for this request' });
    }

    const offer = request.offers[0];
    if (!offer) {
      return jsonResponse(404, { error: 'Offer not found' });
    }

    // Calculate amounts using new fee structure
    // goodsValue = price of goods (duty-free or retail)
    // platformFee = 5% of goodsValue
    // travellerServiceFee = 15% (duty-free) or 20% (other) of goodsValue
    // totalAmount = goodsValue + platformFee + travellerServiceFee
    const goodsValue = request.dutyFreePrice;
    const orderType = request.orderType || ORDER_TYPES.DUTY_FREE;
    const fees = calculateOrderFees(goodsValue, orderType);

    // Get FX rate if needed
    let fxRateUsed = null;
    let originalCurrency = null;
    if (request.currency !== 'EUR') {
      const fxResult = await getFxRate(request.currency, 'EUR');
      fxRateUsed = fxResult.rate;
      originalCurrency = request.currency;
    }

    // Generate idempotency key
    const idempotencyKey = `order-${requestId}-${offerId}-${Date.now()}`;

    // Get or create buyer's Stripe customer
    let buyer = await prisma.user.findUnique({ where: { id: userId } });
    let stripeCustomerId = buyer.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: buyer.email,
        name: buyer.name,
        metadata: { userId: buyer.id },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(fees.totalAmount * 100), // Stripe uses cents
      currency: request.currency.toLowerCase(),
      customer: stripeCustomerId,
      metadata: {
        orderId: 'pending', // Will update after order creation
        requestId,
        buyerId: userId,
        travelerId: offer.travelerId,
        orderType,
        goodsValue: goodsValue.toString(),
        platformFee: fees.platformFee.toString(),
        travellerServiceFee: fees.travellerServiceFee.toString(),
        serviceFeePercent: (fees.serviceFeePercent * 100).toString(),
      },
      automatic_payment_methods: { enabled: true },
    }, {
      idempotencyKey: `pi-${idempotencyKey}`,
    });

    // Create order with new fee structure
    const order = await prisma.order.create({
      data: {
        requestId,
        buyerId: userId,
        travelerId: offer.travelerId,
        // Order type
        orderType,
        // New fee structure fields
        goodsValue: fees.goodsValue,
        platformFee: fees.platformFee,
        travellerServiceFee: fees.travellerServiceFee,
        totalAmount: fees.totalAmount,
        travelerAmount: fees.travelerAmount,
        currency: request.currency,
        // FX tracking
        fxRateUsed,
        originalCurrency,
        // Legacy fields (for backward compatibility)
        productPrice: goodsValue,
        serviceFee: fees.travellerServiceFee,
        // Status and payment
        status: 'PENDING_PAYMENT',
        stripePaymentIntentId: paymentIntent.id,
        idempotencyKey,
      },
      include: {
        request: { select: { product: true, toCity: true } },
        traveler: { select: { name: true } },
      },
    });

    // Increment subscription purchase count
    if (purchaseCheck.subscriptionId) {
      await incrementPurchaseCount(purchaseCheck.subscriptionId);
    }

    // Update PaymentIntent metadata with order ID
    await stripe.paymentIntents.update(paymentIntent.id, {
      metadata: { orderId: order.id },
    });

    // Update request status
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'IN_PROGRESS' },
    });

    // Accept the offer
    await prisma.offer.update({
      where: { id: offerId },
      data: { status: 'accepted' },
    });

    return jsonResponse(201, {
      success: true,
      order: {
        id: order.id,
        status: order.status,
        orderType: order.orderType,
        // Fee breakdown
        goodsValue: order.goodsValue,
        platformFee: order.platformFee,
        travellerServiceFee: order.travellerServiceFee,
        serviceFeePercent: fees.serviceFeePercent * 100,
        totalAmount: order.totalAmount,
        currency: order.currency,
        // FX info
        fxRateUsed: order.fxRateUsed,
        originalCurrency: order.originalCurrency,
      },
      payment: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
      subscription: {
        remainingPurchases: purchaseCheck.remainingPurchases,
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return jsonResponse(500, { error: 'Failed to create order' });
  }
}

/**
 * POST /orders/complete - Complete an order (buyer confirms delivery)
 */
async function completeOrder(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId } = body;

    if (!orderId) {
      return jsonResponse(400, { error: 'orderId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    if (order.buyerId !== userId) {
      return jsonResponse(403, { error: 'Only the buyer can complete the order' });
    }

    if (order.status !== 'PAID' && order.status !== 'IN_PROGRESS') {
      return jsonResponse(400, {
        error: `Cannot complete order with status: ${order.status}`,
      });
    }

    // Get traveler's wallet
    const travelerWallet = await getOrCreateWallet(order.travelerId);
    const pendingAccount = getAccount(travelerWallet, 'PENDING');
    const availableAccount = getAccount(travelerWallet, 'AVAILABLE');

    if (!pendingAccount || !availableAccount) {
      return jsonResponse(500, { error: 'Traveler wallet accounts not found' });
    }

    // Release funds: move from PENDING to AVAILABLE
    await postLedgerEntry({
      type: 'RELEASE',
      amount: order.travelerAmount,
      debitAccountId: pendingAccount.id,
      creditAccountId: availableAccount.id,
      referenceType: 'ORDER',
      referenceId: order.id,
      idempotencyKey: generateIdempotencyKey('RELEASE', 'ORDER', order.id),
      description: `Funds released for order ${order.id}`,
    });

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Update request status
    await prisma.request.update({
      where: { id: order.requestId },
      data: { status: 'COMPLETED' },
    });

    return jsonResponse(200, {
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        completedAt: updatedOrder.completedAt,
      },
      message: 'Order completed. Funds released to traveler.',
    });
  } catch (error) {
    console.error('Error completing order:', error);
    return jsonResponse(500, { error: 'Failed to complete order' });
  }
}

/**
 * POST /orders/cancel - Cancel an order and refund buyer
 */
async function cancelOrder(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId, reason } = body;

    if (!orderId) {
      return jsonResponse(400, { error: 'orderId is required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    // Only buyer or traveler can cancel
    if (order.buyerId !== userId && order.travelerId !== userId) {
      return jsonResponse(403, { error: 'Not authorized to cancel this order' });
    }

    if (!['PENDING_PAYMENT', 'PAID', 'IN_PROGRESS'].includes(order.status)) {
      return jsonResponse(400, {
        error: `Cannot cancel order with status: ${order.status}`,
      });
    }

    // If paid, process refund
    if (order.status === 'PAID' || order.status === 'IN_PROGRESS') {
      if (order.stripePaymentIntentId) {
        // Create Stripe refund
        const refund = await stripe.refunds.create({
          payment_intent: order.stripePaymentIntentId,
          reason: 'requested_by_customer',
        });

        // Update order with refund info
        await prisma.order.update({
          where: { id: orderId },
          data: {
            stripeRefundId: refund.id,
          },
        });
      }

      // If funds were allocated to traveler's pending, reverse them
      const travelerWallet = await getOrCreateWallet(order.travelerId);
      const pendingAccount = getAccount(travelerWallet, 'PENDING');

      if (pendingAccount && pendingAccount.balance >= order.travelerAmount) {
        // Get platform escrow account
        const platformEscrow = await getOrCreatePlatformAccount('PLATFORM_ESCROW');

        // Create a virtual debit from pending (funds go back to platform for refund)
        // This is a simplification - in production you'd have proper refund ledger entries
        await prisma.walletAccount.update({
          where: { id: pendingAccount.id },
          data: { balance: { decrement: order.travelerAmount } },
        });
      }
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        refundedAt: new Date(),
      },
    });

    // Update request status back to OPEN
    await prisma.request.update({
      where: { id: order.requestId },
      data: { status: 'OPEN' },
    });

    return jsonResponse(200, {
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
      message: order.status !== 'PENDING_PAYMENT'
        ? 'Order cancelled. Refund initiated.'
        : 'Order cancelled.',
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return jsonResponse(500, { error: 'Failed to cancel order' });
  }
}

/**
 * POST /orders/dispute - Open a dispute on an order
 */
async function disputeOrder(userId, event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { orderId, reason } = body;

    if (!orderId || !reason) {
      return jsonResponse(400, { error: 'orderId and reason are required' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return jsonResponse(404, { error: 'Order not found' });
    }

    // Only buyer can open a dispute
    if (order.buyerId !== userId) {
      return jsonResponse(403, { error: 'Only the buyer can open a dispute' });
    }

    if (order.status !== 'PAID' && order.status !== 'IN_PROGRESS') {
      return jsonResponse(400, {
        error: `Cannot dispute order with status: ${order.status}`,
      });
    }

    // Move traveler's pending funds to frozen
    const travelerWallet = await getOrCreateWallet(order.travelerId);
    const pendingAccount = getAccount(travelerWallet, 'PENDING');
    const frozenAccount = getAccount(travelerWallet, 'FROZEN');

    if (pendingAccount && frozenAccount) {
      await postLedgerEntry({
        type: 'FREEZE',
        amount: order.travelerAmount,
        debitAccountId: pendingAccount.id,
        creditAccountId: frozenAccount.id,
        referenceType: 'ORDER',
        referenceId: order.id,
        idempotencyKey: generateIdempotencyKey('FREEZE', 'ORDER', order.id),
        description: `Funds frozen for dispute on order ${order.id}`,
        metadata: { reason },
      });
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPUTED' },
    });

    return jsonResponse(200, {
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
      },
      message: 'Dispute opened. Funds frozen pending resolution. Our team will review within 24-48 hours.',
    });
  } catch (error) {
    console.error('Error disputing order:', error);
    return jsonResponse(500, { error: 'Failed to open dispute' });
  }
}
