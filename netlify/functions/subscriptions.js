import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import { getCurrencyForCountry, convertCurrency, getFxRate } from './lib/fx.js';
import {
  getSubscriptionPlans,
  getUserActiveSubscription,
  canUserPurchase,
  getSubscriptionStats,
  createSubscription,
  cancelSubscription,
  initializeSubscriptionPlans,
  SUBSCRIPTION_PLANS,
} from './lib/subscription.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Get or create Stripe prices for subscription plans
async function getOrCreateStripePrice(plan, currency) {
  const priceInCents = currency === 'PLN'
    ? Math.round(plan.pricePln * 100)
    : Math.round(plan.priceEur * 100);

  // Look for existing price
  const prices = await stripe.prices.list({
    product: `subscription_${plan.tier.toLowerCase()}`,
    currency: currency.toLowerCase(),
    active: true,
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0];
  }

  // Create product if doesn't exist
  let product;
  try {
    product = await stripe.products.retrieve(`subscription_${plan.tier.toLowerCase()}`);
  } catch {
    product = await stripe.products.create({
      id: `subscription_${plan.tier.toLowerCase()}`,
      name: `FlyAndEarn ${plan.name} - Annual Subscription`,
      description: plan.description || `${plan.name} tier subscription`,
    });
  }

  // Create price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: priceInCents,
    currency: currency.toLowerCase(),
    recurring: { interval: 'year', interval_count: 1 },
  });

  return price;
}

export async function handler(event) {
  const { httpMethod, path } = event;

  // Parse the action from the path
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  try {
    // GET /subscriptions/plans - Get all subscription plans (public)
    if (httpMethod === 'GET' && action === 'plans') {
      // Get user currency from query params or default to EUR
      const params = event.queryStringParameters || {};
      let currency = params.currency || 'EUR';

      // If user is authenticated, use their country's currency
      const token = getSessionToken(event);
      if (token) {
        try {
          const payload = await verifyToken(token);
          if (payload?.userId) {
            const user = await prisma.user.findUnique({
              where: { id: payload.userId },
              select: { country: true },
            });
            if (user) {
              currency = getCurrencyForCountry(user.country);
            }
          }
        } catch {
          // Ignore auth errors for public endpoint
        }
      }

      const plans = await getSubscriptionPlans(currency);
      return jsonResponse(200, { success: true, plans, currency });
    }

    // All other endpoints require authentication
    const token = getSessionToken(event);
    if (!token) {
      return jsonResponse(401, { error: 'Not authenticated' });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return jsonResponse(401, { error: 'Invalid session' });
    }

    const userId = payload.userId;

    // GET /subscriptions/status - Get user's subscription status
    if (httpMethod === 'GET' && action === 'status') {
      const stats = await getSubscriptionStats(userId);
      const purchaseCheck = await canUserPurchase(userId);

      return jsonResponse(200, {
        success: true,
        ...stats,
        canPurchase: purchaseCheck.canPurchase,
        purchaseBlockReason: purchaseCheck.reason,
      });
    }

    // GET /subscriptions/current - Get user's current active subscription
    if (httpMethod === 'GET' && action === 'current') {
      const subscription = await getUserActiveSubscription(userId);

      if (!subscription) {
        return jsonResponse(200, {
          success: true,
          subscription: null,
          message: 'No active subscription',
        });
      }

      return jsonResponse(200, {
        success: true,
        subscription: {
          id: subscription.id,
          tier: subscription.plan.tier,
          planName: subscription.plan.name,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          purchasesUsed: subscription.purchasesUsed,
          purchaseLimit: subscription.purchaseLimit,
          currency: subscription.currency,
          amountPaid: subscription.amountPaid,
        },
      });
    }

    // POST /subscriptions/create - Create a new subscription (initiate checkout)
    if (httpMethod === 'POST' && action === 'create') {
      let createBody;
      try {
        createBody = JSON.parse(event.body || '{}');
      } catch {
        return jsonResponse(400, { error: 'Invalid request body' });
      }
      const { planId, planTier, successUrl, cancelUrl } = createBody;

      // Find plan by ID or tier
      let plan;
      if (planId) {
        plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
      } else if (planTier) {
        plan = await prisma.subscriptionPlan.findUnique({ where: { tier: planTier } });
      }

      if (!plan) {
        return jsonResponse(400, { error: 'Invalid subscription plan' });
      }

      // Check if user already has an active subscription
      const existingSubscription = await getUserActiveSubscription(userId);
      if (existingSubscription) {
        return jsonResponse(400, {
          error: 'Active subscription exists',
          details: 'You already have an active subscription. Cancel it first or wait for it to expire.',
          currentPlan: existingSubscription.plan.tier,
        });
      }

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { country: true, email: true, name: true, stripeCustomerId: true },
      });

      const currency = getCurrencyForCountry(user?.country);

      // Get or create Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
        await prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId },
        });
      }

      // Get or create Stripe price for this plan/currency
      const stripePrice = await getOrCreateStripePrice(plan, currency);

      // Get FX rate for tracking
      let fxRateUsed = null;
      if (currency === 'PLN') {
        const fxResult = await getFxRate('EUR', 'PLN');
        fxRateUsed = fxResult.rate;
      }

      // Create pending subscription in database
      const subscription = await createSubscription(userId, plan.id, {
        status: 'PENDING_PAYMENT',
        stripeCustomerId,
        stripePriceId: stripePrice.id,
      });

      // Create Stripe Checkout Session
      const baseUrl = process.env.URL || 'https://flyandearn.eu';
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: stripePrice.id,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `${baseUrl}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${baseUrl}/pricing?cancelled=true`,
        subscription_data: {
          metadata: {
            subscriptionId: subscription.id,
            userId,
            planTier: plan.tier,
          },
        },
        metadata: {
          subscriptionId: subscription.id,
          userId,
          planTier: plan.tier,
        },
      });

      return jsonResponse(201, {
        success: true,
        subscription: {
          id: subscription.id,
          tier: plan.tier,
          planName: plan.name,
          status: subscription.status,
        },
        checkout: {
          sessionId: session.id,
          url: session.url,
        },
        price: currency === 'PLN' ? plan.pricePln : plan.priceEur,
        currency,
      });
    }

    // POST /subscriptions/cancel - Cancel subscription
    if (httpMethod === 'POST' && action === 'cancel') {
      let cancelBody;
      try {
        cancelBody = JSON.parse(event.body || '{}');
      } catch {
        return jsonResponse(400, { error: 'Invalid request body' });
      }
      const { immediate } = cancelBody;

      const subscription = await getUserActiveSubscription(userId);
      if (!subscription) {
        return jsonResponse(400, { error: 'No active subscription to cancel' });
      }

      const cancelled = await cancelSubscription(subscription.id, immediate);

      return jsonResponse(200, {
        success: true,
        message: immediate
          ? 'Subscription cancelled immediately'
          : 'Subscription will be cancelled at the end of the billing period',
        subscription: {
          id: cancelled.id,
          status: cancelled.status,
          endDate: cancelled.endDate,
          cancelledAt: cancelled.cancelledAt,
        },
      });
    }

    // POST /subscriptions/init-plans - Initialize subscription plans (admin only)
    if (httpMethod === 'POST' && action === 'init-plans') {
      // Check if user is admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, email: true },
      });

      // Simple admin check - in production, use a proper admin role
      const adminEmails = ['admin@flyandearn.eu', 'vincent@flyandearn.eu'];
      if (!adminEmails.includes(user?.email)) {
        return jsonResponse(403, { error: 'Admin access required' });
      }

      await initializeSubscriptionPlans();
      const plans = await getSubscriptionPlans('EUR');

      return jsonResponse(200, {
        success: true,
        message: 'Subscription plans initialized',
        plans,
      });
    }

    // GET /subscriptions - Get user's subscription history
    if (httpMethod === 'GET' && (action === 'subscriptions' || !action)) {
      const subscriptions = await prisma.subscription.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      return jsonResponse(200, {
        success: true,
        subscriptions: subscriptions.map((sub) => ({
          id: sub.id,
          tier: sub.plan.tier,
          planName: sub.plan.name,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
          purchasesUsed: sub.purchasesUsed,
          purchaseLimit: sub.purchaseLimit,
          currency: sub.currency,
          amountPaid: sub.amountPaid,
          cancelledAt: sub.cancelledAt,
        })),
      });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error('Subscription error:', error);
    return jsonResponse(500, {
      error: 'Internal server error',
      details: error.message,
    });
  }
}
