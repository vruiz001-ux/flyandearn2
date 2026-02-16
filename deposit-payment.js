// ==========================================
// DEPOSIT PAYMENT MODULE
// Handles €20 upfront deposit payments using Stripe Payment Element
// Supports card, BLIK (Poland), and P24 (Poland)
// ==========================================

const DepositPayment = (function() {
  'use strict';

  // Stripe.js instance
  let stripe = null;
  let elements = null;
  let paymentElement = null;
  let currentRequestId = null;
  let clientSecret = null;

  // Configuration
  const CONFIG = {
    STRIPE_PUBLIC_KEY: 'pk_test_YOUR_STRIPE_PUBLIC_KEY', // Replace in production
    DEPOSIT_AMOUNT_EUR: 20,
    API_BASE: '/.netlify/functions',
  };

  // State
  const state = {
    isInitialized: false,
    isProcessing: false,
    depositStatus: null,
  };

  /**
   * Initialize Stripe.js
   * Must be called before any payment operations
   */
  function init(stripePublicKey) {
    if (state.isInitialized) return;

    if (stripePublicKey) {
      CONFIG.STRIPE_PUBLIC_KEY = stripePublicKey;
    }

    if (!window.Stripe) {
      console.error('Stripe.js not loaded. Include <script src="https://js.stripe.com/v3/"></script>');
      return;
    }

    stripe = window.Stripe(CONFIG.STRIPE_PUBLIC_KEY);
    state.isInitialized = true;
    console.log('DepositPayment initialized');
  }

  /**
   * Create a deposit payment for a request
   * Returns clientSecret for Payment Element
   */
  async function createDeposit(requestId, preferredCurrency = null) {
    if (!state.isInitialized) {
      throw new Error('DepositPayment not initialized. Call init() first.');
    }

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${CONFIG.API_BASE}/deposit/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestId,
        preferredCurrency,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create deposit');
    }

    currentRequestId = requestId;
    clientSecret = data.clientSecret;

    return {
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
      amount: data.amount,
      currency: data.currency,
      supportedPaymentMethods: data.supportedPaymentMethods,
      existing: data.existing || false,
    };
  }

  /**
   * Mount Payment Element to a container
   * @param {string|HTMLElement} container - Container element or selector
   * @param {Object} options - Payment Element options
   */
  async function mountPaymentElement(container, options = {}) {
    if (!clientSecret) {
      throw new Error('No client secret. Call createDeposit() first.');
    }

    const containerEl = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!containerEl) {
      throw new Error('Container element not found');
    }

    // Create Elements instance
    const appearance = options.appearance || {
      theme: 'night',
      variables: {
        colorPrimary: '#d4a853',
        colorBackground: '#18181b',
        colorText: '#fafafa',
        colorDanger: '#ef4444',
        fontFamily: 'Outfit, system-ui, sans-serif',
        spacingUnit: '4px',
        borderRadius: '8px',
        colorTextSecondary: '#a1a1aa',
        colorTextPlaceholder: '#71717a',
      },
      rules: {
        '.Input': {
          border: '1px solid #27272a',
          boxShadow: 'none',
        },
        '.Input:focus': {
          border: '1px solid #d4a853',
          boxShadow: '0 0 0 3px rgba(212, 168, 83, 0.15)',
        },
        '.Label': {
          color: '#a1a1aa',
        },
        '.Tab': {
          border: '1px solid #27272a',
          backgroundColor: '#111113',
        },
        '.Tab:hover': {
          border: '1px solid #d4a853',
        },
        '.Tab--selected': {
          border: '1px solid #d4a853',
          backgroundColor: 'rgba(212, 168, 83, 0.1)',
        },
      },
    };

    elements = stripe.elements({
      clientSecret,
      appearance,
    });

    // Create Payment Element
    paymentElement = elements.create('payment', {
      layout: options.layout || 'tabs',
      defaultCollapsed: false,
      paymentMethodOrder: ['card', 'blik', 'p24'],
    });

    // Mount to container
    paymentElement.mount(containerEl);

    // Return promise that resolves when element is ready
    return new Promise((resolve, reject) => {
      paymentElement.on('ready', () => {
        resolve(paymentElement);
      });
      paymentElement.on('loaderror', (event) => {
        reject(new Error(event.error?.message || 'Failed to load payment element'));
      });
    });
  }

  /**
   * Confirm the payment
   * @param {Object} options - Confirmation options
   * @returns {Promise<Object>} Payment result
   */
  async function confirmPayment(options = {}) {
    if (!elements || !clientSecret) {
      throw new Error('Payment not initialized. Mount payment element first.');
    }

    if (state.isProcessing) {
      throw new Error('Payment already processing');
    }

    state.isProcessing = true;

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: options.returnUrl || `${window.location.origin}/wallet?deposit=success`,
        },
        redirect: options.redirect || 'if_required',
      });

      if (error) {
        throw error;
      }

      // If we get here without redirect, payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm with backend
        await confirmDepositBackend(currentRequestId, paymentIntent.id);

        return {
          success: true,
          paymentIntent,
        };
      }

      // Payment requires additional action (3DS, BLIK confirmation)
      if (paymentIntent && paymentIntent.status === 'requires_action') {
        return {
          success: false,
          requiresAction: true,
          paymentIntent,
        };
      }

      return {
        success: paymentIntent?.status === 'succeeded',
        paymentIntent,
      };
    } finally {
      state.isProcessing = false;
    }
  }

  /**
   * Confirm deposit with backend after successful payment
   */
  async function confirmDepositBackend(requestId, paymentIntentId) {
    const token = localStorage.getItem('token');

    const response = await fetch(`${CONFIG.API_BASE}/deposit/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestId,
        paymentIntentId,
      }),
    });

    return response.json();
  }

  /**
   * Get deposit status for a request
   */
  async function getDepositStatus(requestId) {
    const token = localStorage.getItem('token');

    const response = await fetch(
      `${CONFIG.API_BASE}/deposit/status?requestId=${requestId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get deposit status');
    }

    state.depositStatus = data.depositStatus;
    return data;
  }

  /**
   * Request a refund for the deposit
   */
  async function refundDeposit(requestId, reason = null) {
    const token = localStorage.getItem('token');

    const response = await fetch(`${CONFIG.API_BASE}/deposit/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        requestId,
        reason,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to refund deposit');
    }

    return data;
  }

  /**
   * Cleanup payment element
   */
  function destroy() {
    if (paymentElement) {
      paymentElement.destroy();
      paymentElement = null;
    }
    elements = null;
    clientSecret = null;
    currentRequestId = null;
  }

  /**
   * Format currency amount for display
   */
  function formatAmount(amount, currency) {
    const symbols = {
      EUR: '\u20AC',
      PLN: 'z\u0142',
      USD: '$',
      GBP: '\u00A3',
    };
    const symbol = symbols[currency] || currency;
    return `${symbol}${parseFloat(amount).toFixed(2)}`;
  }

  // Public API
  return {
    init,
    createDeposit,
    mountPaymentElement,
    confirmPayment,
    getDepositStatus,
    refundDeposit,
    destroy,
    formatAmount,
    get isInitialized() { return state.isInitialized; },
    get isProcessing() { return state.isProcessing; },
    get depositStatus() { return state.depositStatus; },
  };
})();

// ==========================================
// STRIPE CONNECT SETUP MODULE
// Handles Traveller payout account onboarding
// ==========================================

const StripeConnect = (function() {
  'use strict';

  const CONFIG = {
    API_BASE: '/.netlify/functions',
  };

  const state = {
    accountId: null,
    onboardingComplete: false,
    payoutsEnabled: false,
  };

  /**
   * Start Connect onboarding for Travellers
   * Returns onboarding URL to redirect user to
   */
  async function startOnboarding() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${CONFIG.API_BASE}/stripe-connect/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to start onboarding');
    }

    if (data.alreadyOnboarded) {
      state.onboardingComplete = true;
      return { alreadyOnboarded: true };
    }

    state.accountId = data.accountId;

    return {
      onboardingUrl: data.onboardingUrl,
      accountId: data.accountId,
    };
  }

  /**
   * Refresh onboarding link if expired
   */
  async function refreshOnboardingLink() {
    const token = localStorage.getItem('token');

    const response = await fetch(`${CONFIG.API_BASE}/stripe-connect/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to refresh onboarding link');
    }

    return data;
  }

  /**
   * Get Connect account status
   */
  async function getStatus() {
    const token = localStorage.getItem('token');

    const response = await fetch(`${CONFIG.API_BASE}/stripe-connect/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get Connect status');
    }

    state.accountId = data.accountId;
    state.onboardingComplete = data.onboardingComplete;
    state.payoutsEnabled = data.payoutsEnabled;

    return data;
  }

  /**
   * Get link to Stripe Express Dashboard
   */
  async function getDashboardLink() {
    const token = localStorage.getItem('token');

    const response = await fetch(`${CONFIG.API_BASE}/stripe-connect/dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get dashboard link');
    }

    return data.dashboardUrl;
  }

  /**
   * Get Connect account balance
   */
  async function getBalance() {
    const token = localStorage.getItem('token');

    const response = await fetch(`${CONFIG.API_BASE}/stripe-connect/balance`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get balance');
    }

    return data;
  }

  // Public API
  return {
    startOnboarding,
    refreshOnboardingLink,
    getStatus,
    getDashboardLink,
    getBalance,
    get accountId() { return state.accountId; },
    get onboardingComplete() { return state.onboardingComplete; },
    get payoutsEnabled() { return state.payoutsEnabled; },
  };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DepositPayment, StripeConnect };
}
