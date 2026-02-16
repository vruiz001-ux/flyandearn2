import prisma from './prisma.js';
import { getFxRate, getCurrencyForCountry } from './fx.js';

// Fee percentages
export const PLATFORM_FEE_PERCENT = 0.05; // 5%
export const TRAVELLER_SERVICE_FEE_PERCENT = 0.15; // 15% for duty-free orders
export const OTHER_SERVICE_FEE_PERCENT = 0.20; // 20% for non-duty-free orders

// Order types
export const ORDER_TYPES = {
  DUTY_FREE: 'DUTY_FREE',
  OTHER: 'OTHER',
};

// Subscription plan definitions (prices in base currencies)
export const SUBSCRIPTION_PLANS = {
  SILVER: {
    tier: 'SILVER',
    name: 'Silver',
    priceEur: 4.63, // ~19.99 PLN
    pricePln: 19.99,
    purchaseLimit: 5,
    description: 'Perfect for occasional travelers',
    features: ['Up to 5 purchases per year', 'Standard support', 'Basic tracking'],
  },
  GOLD: {
    tier: 'GOLD',
    name: 'Gold',
    priceEur: 6.94, // ~29.99 PLN
    pricePln: 29.99,
    purchaseLimit: 10,
    description: 'For regular travelers',
    features: ['Up to 10 purchases per year', 'Priority support', 'Advanced tracking', 'Early access to deals'],
  },
  PLATINUM: {
    tier: 'PLATINUM',
    name: 'Platinum',
    priceEur: 11.57, // ~49.99 PLN
    pricePln: 49.99,
    purchaseLimit: null, // unlimited
    description: 'For power users',
    features: ['Unlimited purchases', 'VIP support', 'Premium tracking', 'Exclusive deals', 'Priority matching'],
  },
};

/**
 * Initialize subscription plans in the database
 */
export async function initializeSubscriptionPlans() {
  for (const [tier, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
    await prisma.subscriptionPlan.upsert({
      where: { tier },
      update: {
        name: plan.name,
        priceEur: plan.priceEur,
        pricePln: plan.pricePln,
        purchaseLimit: plan.purchaseLimit,
        description: plan.description,
        features: plan.features,
        isActive: true,
      },
      create: {
        tier,
        name: plan.name,
        priceEur: plan.priceEur,
        pricePln: plan.pricePln,
        purchaseLimit: plan.purchaseLimit,
        description: plan.description,
        features: plan.features,
        isActive: true,
      },
    });
  }
}

/**
 * Get all active subscription plans with prices in user's currency
 * @param {string} userCurrency - User's preferred currency
 * @returns {Promise<Array>}
 */
export async function getSubscriptionPlans(userCurrency = 'EUR') {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { priceEur: 'asc' },
  });

  return plans.map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    name: plan.name,
    price: userCurrency === 'PLN' ? plan.pricePln : plan.priceEur,
    currency: userCurrency,
    priceEur: plan.priceEur,
    pricePln: plan.pricePln,
    purchaseLimit: plan.purchaseLimit,
    description: plan.description,
    features: plan.features,
  }));
}

/**
 * Get user's active subscription
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
export async function getUserActiveSubscription(userId) {
  const now = new Date();

  return prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      plan: true,
    },
    orderBy: { endDate: 'desc' },
  });
}

/**
 * Check if user can make a purchase (has active subscription with remaining limit)
 * @param {string} userId
 * @returns {Promise<{canPurchase: boolean, reason?: string, remainingPurchases?: number}>}
 */
export async function canUserPurchase(userId) {
  const subscription = await getUserActiveSubscription(userId);

  if (!subscription) {
    return {
      canPurchase: false,
      reason: 'No active subscription. Please subscribe to make purchases.',
      remainingPurchases: 0,
    };
  }

  // Unlimited plan
  if (subscription.purchaseLimit === null) {
    return {
      canPurchase: true,
      remainingPurchases: null, // unlimited
      subscriptionId: subscription.id,
    };
  }

  const remaining = subscription.purchaseLimit - subscription.purchasesUsed;

  if (remaining <= 0) {
    return {
      canPurchase: false,
      reason: 'You have reached your purchase limit for this subscription period. Please upgrade your plan.',
      remainingPurchases: 0,
      subscriptionId: subscription.id,
    };
  }

  return {
    canPurchase: true,
    remainingPurchases: remaining,
    subscriptionId: subscription.id,
  };
}

/**
 * Increment the purchase count for a user's subscription
 * @param {string} subscriptionId
 * @returns {Promise<Object>}
 */
export async function incrementPurchaseCount(subscriptionId) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      purchasesUsed: { increment: 1 },
    },
  });
}

/**
 * Create a subscription for a user
 * @param {string} userId
 * @param {string} planId
 * @param {Object} options - Additional options (stripeSubscriptionId, etc.)
 * @returns {Promise<Object>}
 */
export async function createSubscription(userId, planId, options = {}) {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setFullYear(endDate.getFullYear() + 1); // 1 year subscription

  // Get user's currency
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { country: true },
  });

  const currency = getCurrencyForCountry(user?.country);
  const amountPaid = currency === 'PLN' ? plan.pricePln : plan.priceEur;

  // Get FX rate if applicable
  let fxRateUsed = null;
  if (currency === 'PLN') {
    const { rate } = await getFxRate('EUR', 'PLN');
    fxRateUsed = rate;
  }

  return prisma.subscription.create({
    data: {
      userId,
      planId,
      status: options.status || 'ACTIVE',
      startDate: now,
      endDate,
      purchaseLimit: plan.purchaseLimit,
      purchasesUsed: 0,
      currency,
      amountPaid,
      fxRateUsed,
      stripeSubscriptionId: options.stripeSubscriptionId,
      stripeCustomerId: options.stripeCustomerId,
      stripePriceId: options.stripePriceId,
    },
    include: {
      plan: true,
    },
  });
}

/**
 * Cancel a subscription
 * @param {string} subscriptionId
 * @param {boolean} immediate - If true, cancel immediately; otherwise, cancel at period end
 * @returns {Promise<Object>}
 */
export async function cancelSubscription(subscriptionId, immediate = false) {
  const updates = {
    cancelledAt: new Date(),
  };

  if (immediate) {
    updates.status = 'CANCELLED';
    updates.endDate = new Date();
  }

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: updates,
  });
}

/**
 * Calculate fees for an order
 * @param {number} goodsValue - The price of goods
 * @param {string} orderType - 'DUTY_FREE' or 'OTHER'
 * @returns {{platformFee: number, travellerServiceFee: number, totalAmount: number, orderType: string}}
 */
export function calculateOrderFees(goodsValue, orderType = ORDER_TYPES.DUTY_FREE) {
  // Use 20% service fee for non-duty-free orders, 15% for duty-free
  const serviceFeePercent = orderType === ORDER_TYPES.OTHER
    ? OTHER_SERVICE_FEE_PERCENT
    : TRAVELLER_SERVICE_FEE_PERCENT;

  const platformFee = Math.round(goodsValue * PLATFORM_FEE_PERCENT * 100) / 100;
  const travellerServiceFee = Math.round(goodsValue * serviceFeePercent * 100) / 100;
  const totalAmount = Math.round((goodsValue + platformFee + travellerServiceFee) * 100) / 100;

  return {
    goodsValue,
    platformFee,
    travellerServiceFee,
    totalAmount,
    travelerAmount: travellerServiceFee, // Traveler receives the service fee
    orderType,
    serviceFeePercent,
  };
}

/**
 * Get subscription statistics for a user
 * @param {string} userId
 * @returns {Promise<Object>}
 */
export async function getSubscriptionStats(userId) {
  const activeSubscription = await getUserActiveSubscription(userId);

  if (!activeSubscription) {
    return {
      hasActiveSubscription: false,
      subscription: null,
    };
  }

  const daysRemaining = Math.ceil(
    (new Date(activeSubscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)
  );

  return {
    hasActiveSubscription: true,
    subscription: {
      id: activeSubscription.id,
      tier: activeSubscription.plan.tier,
      planName: activeSubscription.plan.name,
      startDate: activeSubscription.startDate,
      endDate: activeSubscription.endDate,
      daysRemaining,
      purchasesUsed: activeSubscription.purchasesUsed,
      purchaseLimit: activeSubscription.purchaseLimit,
      remainingPurchases: activeSubscription.purchaseLimit
        ? activeSubscription.purchaseLimit - activeSubscription.purchasesUsed
        : null,
      currency: activeSubscription.currency,
      amountPaid: activeSubscription.amountPaid,
    },
  };
}
