import prisma from './lib/prisma.js';
import { getSessionToken, verifyToken, jsonResponse } from './lib/auth.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Base URL for redirects (set in environment)
const BASE_URL = process.env.URL || 'http://localhost:8888';

export async function handler(event) {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  // All Connect endpoints require authentication
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
        return getConnectStatus(userId);
      }
      if (action === 'dashboard') {
        return getConnectDashboardLink(userId);
      }
      if (action === 'balance') {
        return getConnectBalance(userId);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    case 'POST':
      if (action === 'onboard') {
        return startOnboarding(userId, event);
      }
      if (action === 'refresh') {
        return refreshOnboardingLink(userId);
      }
      return jsonResponse(400, { error: 'Unknown action' });

    default:
      return jsonResponse(405, { error: 'Method not allowed' });
  }
}

/**
 * POST /stripe-connect/onboard - Start Stripe Connect Express onboarding
 *
 * Creates an Express account and returns an onboarding link.
 * User must be a traveller to onboard.
 */
async function startOnboarding(userId, event) {
  try {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        country: true,
        isTraveler: true,
        stripeConnectAccountId: true,
        connectOnboardingComplete: true,
      },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    // User must be a traveller to receive payouts
    if (!user.isTraveler) {
      return jsonResponse(403, {
        error: 'Only travellers can set up payouts. Enable traveller mode first.'
      });
    }

    // If already onboarded, return status
    if (user.connectOnboardingComplete) {
      return jsonResponse(200, {
        success: true,
        alreadyOnboarded: true,
        message: 'Connect account already set up',
      });
    }

    let accountId = user.stripeConnectAccountId;

    // Create Express account if not exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: mapCountryCode(user.country),
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          userId: user.id,
          platform: 'flyandearn',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'daily',
            },
          },
        },
      });

      accountId = account.id;

      // Save account ID to user
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeConnectAccountId: accountId,
          connectOnboardingComplete: false,
          connectPayoutsEnabled: false,
        },
      });
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${BASE_URL}/wallet?connect_refresh=true`,
      return_url: `${BASE_URL}/wallet?connect_return=true`,
      type: 'account_onboarding',
    });

    return jsonResponse(200, {
      success: true,
      onboardingUrl: accountLink.url,
      accountId,
    });
  } catch (error) {
    console.error('Connect onboarding error:', error);
    return jsonResponse(500, {
      error: 'Failed to start onboarding',
      details: error.message,
    });
  }
}

/**
 * POST /stripe-connect/refresh - Refresh onboarding link (if expired)
 */
async function refreshOnboardingLink(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true, connectOnboardingComplete: true },
    });

    if (!user?.stripeConnectAccountId) {
      return jsonResponse(400, {
        error: 'No Connect account found. Start onboarding first.'
      });
    }

    if (user.connectOnboardingComplete) {
      return jsonResponse(200, {
        success: true,
        alreadyComplete: true,
        message: 'Onboarding already complete',
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: user.stripeConnectAccountId,
      refresh_url: `${BASE_URL}/wallet?connect_refresh=true`,
      return_url: `${BASE_URL}/wallet?connect_return=true`,
      type: 'account_onboarding',
    });

    return jsonResponse(200, {
      success: true,
      onboardingUrl: accountLink.url,
    });
  } catch (error) {
    console.error('Refresh onboarding link error:', error);
    return jsonResponse(500, { error: 'Failed to refresh onboarding link' });
  }
}

/**
 * GET /stripe-connect/status - Get Connect account status
 */
async function getConnectStatus(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeConnectAccountId: true,
        connectOnboardingComplete: true,
        connectPayoutsEnabled: true,
        isTraveler: true,
      },
    });

    if (!user) {
      return jsonResponse(404, { error: 'User not found' });
    }

    if (!user.stripeConnectAccountId) {
      return jsonResponse(200, {
        success: true,
        hasAccount: false,
        onboardingComplete: false,
        payoutsEnabled: false,
        isTraveler: user.isTraveler,
      });
    }

    // Fetch latest status from Stripe
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);

    const onboardingComplete = account.details_submitted;
    const payoutsEnabled = account.payouts_enabled;

    // Update local state if changed
    if (
      onboardingComplete !== user.connectOnboardingComplete ||
      payoutsEnabled !== user.connectPayoutsEnabled
    ) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          connectOnboardingComplete: onboardingComplete,
          connectPayoutsEnabled: payoutsEnabled,
        },
      });
    }

    return jsonResponse(200, {
      success: true,
      hasAccount: true,
      accountId: user.stripeConnectAccountId,
      onboardingComplete,
      payoutsEnabled,
      chargesEnabled: account.charges_enabled,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        pastDue: account.requirements?.past_due || [],
        disabledReason: account.requirements?.disabled_reason,
      },
      isTraveler: user.isTraveler,
    });
  } catch (error) {
    console.error('Get Connect status error:', error);
    return jsonResponse(500, { error: 'Failed to get Connect status' });
  }
}

/**
 * GET /stripe-connect/dashboard - Get link to Stripe Express Dashboard
 */
async function getConnectDashboardLink(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true, connectOnboardingComplete: true },
    });

    if (!user?.stripeConnectAccountId) {
      return jsonResponse(400, { error: 'No Connect account found' });
    }

    if (!user.connectOnboardingComplete) {
      return jsonResponse(400, {
        error: 'Complete onboarding first to access dashboard'
      });
    }

    const loginLink = await stripe.accounts.createLoginLink(
      user.stripeConnectAccountId
    );

    return jsonResponse(200, {
      success: true,
      dashboardUrl: loginLink.url,
    });
  } catch (error) {
    console.error('Get dashboard link error:', error);
    return jsonResponse(500, { error: 'Failed to get dashboard link' });
  }
}

/**
 * GET /stripe-connect/balance - Get Connect account balance
 */
async function getConnectBalance(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeConnectAccountId: true, connectPayoutsEnabled: true },
    });

    if (!user?.stripeConnectAccountId) {
      return jsonResponse(400, { error: 'No Connect account found' });
    }

    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripeConnectAccountId,
    });

    return jsonResponse(200, {
      success: true,
      available: balance.available.map(b => ({
        amount: b.amount / 100, // Convert from cents
        currency: b.currency.toUpperCase(),
      })),
      pending: balance.pending.map(b => ({
        amount: b.amount / 100,
        currency: b.currency.toUpperCase(),
      })),
    });
  } catch (error) {
    console.error('Get balance error:', error);
    return jsonResponse(500, { error: 'Failed to get balance' });
  }
}

/**
 * Map country names to ISO 3166-1 alpha-2 codes
 */
function mapCountryCode(country) {
  if (!country) return 'FR'; // Default to France for EU

  const countryMap = {
    'poland': 'PL',
    'polska': 'PL',
    'pl': 'PL',
    'france': 'FR',
    'germany': 'DE',
    'deutschland': 'DE',
    'spain': 'ES',
    'españa': 'ES',
    'italy': 'IT',
    'italia': 'IT',
    'united kingdom': 'GB',
    'uk': 'GB',
    'netherlands': 'NL',
    'belgium': 'BE',
    'austria': 'AT',
    'portugal': 'PT',
    'ireland': 'IE',
    'luxembourg': 'LU',
  };

  const normalized = country.toLowerCase().trim();

  // If already a 2-letter code, validate and return
  if (normalized.length === 2) {
    return normalized.toUpperCase();
  }

  return countryMap[normalized] || 'FR';
}
