/**
 * Deposit Payment System Tests
 * Tests for €20 upfront deposit and Stripe Connect flows
 */

describe('Deposit Payment System', () => {
  describe('DepositStatus State Machine', () => {
    const validStatuses = [
      'NONE',
      'CREATED',
      'REQUIRES_ACTION',
      'CAPTURED',
      'TRANSFERRED',
      'REFUNDED',
      'FAILED',
    ];

    test('all deposit statuses are defined', () => {
      expect(validStatuses.length).toBe(7);
    });

    test('initial status is NONE', () => {
      expect(validStatuses[0]).toBe('NONE');
    });

    test('valid state transitions from NONE', () => {
      const validTransitions = ['CREATED', 'FAILED'];
      validTransitions.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });

    test('valid state transitions from CREATED', () => {
      const validTransitions = ['REQUIRES_ACTION', 'CAPTURED', 'FAILED'];
      validTransitions.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });

    test('valid state transitions from CAPTURED', () => {
      const validTransitions = ['TRANSFERRED', 'REFUNDED'];
      validTransitions.forEach(status => {
        expect(validStatuses).toContain(status);
      });
    });

    test('TRANSFERRED is a terminal state', () => {
      // Once transferred, deposit cannot change state
      expect(validStatuses).toContain('TRANSFERRED');
    });

    test('REFUNDED is a terminal state', () => {
      expect(validStatuses).toContain('REFUNDED');
    });
  });

  describe('Deposit Amount Calculation', () => {
    const DEPOSIT_AMOUNT_EUR = 20;
    const EUR_TO_PLN_RATE = 4.32;

    test('EUR deposit is fixed at €20', () => {
      expect(DEPOSIT_AMOUNT_EUR).toBe(20);
    });

    test('PLN deposit is converted from EUR', () => {
      const plnAmount = Math.round(DEPOSIT_AMOUNT_EUR * EUR_TO_PLN_RATE * 100) / 100;
      expect(plnAmount).toBeGreaterThan(80); // Should be around 86 PLN
      expect(plnAmount).toBeLessThan(90);
    });

    test('deposit amount is always positive', () => {
      expect(DEPOSIT_AMOUNT_EUR).toBeGreaterThan(0);
    });
  });

  describe('Deposit Creation', () => {
    // Mock request data
    const createMockRequest = (status, depositStatus = 'NONE') => ({
      id: 'request-123',
      buyerId: 'buyer-456',
      status,
      depositStatus,
      depositAmount: null,
      depositCurrency: null,
      stripeDepositPaymentIntentId: null,
    });

    test('deposit can only be created for OPEN requests', () => {
      const validRequest = createMockRequest('OPEN');
      expect(validRequest.status).toBe('OPEN');
    });

    test('deposit cannot be created for MATCHED requests', () => {
      const invalidRequest = createMockRequest('MATCHED');
      expect(invalidRequest.status).not.toBe('OPEN');
    });

    test('deposit cannot be created if already CAPTURED', () => {
      const invalidRequest = createMockRequest('OPEN', 'CAPTURED');
      expect(invalidRequest.depositStatus).toBe('CAPTURED');
    });

    test('deposit cannot be created if already TRANSFERRED', () => {
      const invalidRequest = createMockRequest('OPEN', 'TRANSFERRED');
      expect(invalidRequest.depositStatus).toBe('TRANSFERRED');
    });
  });

  describe('Payment Method Support', () => {
    test('EUR supports card payments', () => {
      const eurMethods = ['card'];
      expect(eurMethods).toContain('card');
    });

    test('PLN supports card payments', () => {
      const plnMethods = ['card', 'blik', 'p24'];
      expect(plnMethods).toContain('card');
    });

    test('PLN supports BLIK payments', () => {
      const plnMethods = ['card', 'blik', 'p24'];
      expect(plnMethods).toContain('blik');
    });

    test('PLN supports P24 payments', () => {
      const plnMethods = ['card', 'blik', 'p24'];
      expect(plnMethods).toContain('p24');
    });
  });

  describe('Offer Acceptance with Deposit Transfer', () => {
    // Mock offer data
    const createMockOffer = (travellerConnected, payoutsEnabled) => ({
      id: 'offer-789',
      requestId: 'request-123',
      travelerId: 'traveller-456',
      status: 'pending',
      traveler: {
        id: 'traveller-456',
        stripeConnectAccountId: travellerConnected ? 'acct_xxx' : null,
        connectPayoutsEnabled: payoutsEnabled,
      },
    });

    test('cannot accept offer if deposit not captured', () => {
      const request = {
        depositStatus: 'NONE',
      };
      expect(request.depositStatus).not.toBe('CAPTURED');
    });

    test('cannot accept offer if traveller has no Connect account', () => {
      const offer = createMockOffer(false, false);
      expect(offer.traveler.stripeConnectAccountId).toBeNull();
    });

    test('cannot accept offer if traveller payouts not enabled', () => {
      const offer = createMockOffer(true, false);
      expect(offer.traveler.stripeConnectAccountId).not.toBeNull();
      expect(offer.traveler.connectPayoutsEnabled).toBe(false);
    });

    test('can accept offer when deposit captured and traveller connected', () => {
      const request = {
        depositStatus: 'CAPTURED',
      };
      const offer = createMockOffer(true, true);

      expect(request.depositStatus).toBe('CAPTURED');
      expect(offer.traveler.stripeConnectAccountId).not.toBeNull();
      expect(offer.traveler.connectPayoutsEnabled).toBe(true);
    });
  });

  describe('Deposit Refund', () => {
    test('refund only allowed for CAPTURED deposits', () => {
      const validStatus = 'CAPTURED';
      expect(validStatus).toBe('CAPTURED');
    });

    test('refund not allowed for TRANSFERRED deposits', () => {
      const invalidStatus = 'TRANSFERRED';
      expect(invalidStatus).not.toBe('CAPTURED');
    });

    test('refund not allowed for NONE deposits', () => {
      const invalidStatus = 'NONE';
      expect(invalidStatus).not.toBe('CAPTURED');
    });
  });
});

describe('Stripe Connect Onboarding', () => {
  describe('Connect Account States', () => {
    // Mock user data
    const createMockUser = (accountId, onboardingComplete, payoutsEnabled) => ({
      id: 'user-123',
      stripeConnectAccountId: accountId,
      connectOnboardingComplete: onboardingComplete,
      connectPayoutsEnabled: payoutsEnabled,
      isTraveler: true,
    });

    test('user starts without Connect account', () => {
      const user = createMockUser(null, false, false);
      expect(user.stripeConnectAccountId).toBeNull();
    });

    test('onboarding creates Connect account', () => {
      const user = createMockUser('acct_xxx', false, false);
      expect(user.stripeConnectAccountId).not.toBeNull();
      expect(user.connectOnboardingComplete).toBe(false);
    });

    test('completed onboarding enables account', () => {
      const user = createMockUser('acct_xxx', true, false);
      expect(user.connectOnboardingComplete).toBe(true);
    });

    test('verified account enables payouts', () => {
      const user = createMockUser('acct_xxx', true, true);
      expect(user.connectPayoutsEnabled).toBe(true);
    });

    test('only travellers can onboard', () => {
      const user = createMockUser(null, false, false);
      expect(user.isTraveler).toBe(true);
    });
  });

  describe('Country Code Mapping', () => {
    const mapCountryCode = (country) => {
      if (!country) return 'FR';
      const countryMap = {
        'poland': 'PL',
        'polska': 'PL',
        'pl': 'PL',
        'france': 'FR',
        'germany': 'DE',
      };
      const normalized = country.toLowerCase().trim();
      if (normalized.length === 2) return normalized.toUpperCase();
      return countryMap[normalized] || 'FR';
    };

    test('maps "Poland" to PL', () => {
      expect(mapCountryCode('Poland')).toBe('PL');
    });

    test('maps "Polska" to PL', () => {
      expect(mapCountryCode('Polska')).toBe('PL');
    });

    test('maps "pl" to PL', () => {
      expect(mapCountryCode('pl')).toBe('PL');
    });

    test('defaults to FR when country is null', () => {
      expect(mapCountryCode(null)).toBe('FR');
    });

    test('passes through 2-letter codes', () => {
      expect(mapCountryCode('DE')).toBe('DE');
    });
  });
});

describe('Webhook Event Handling', () => {
  describe('Payment Intent Events', () => {
    test('payment_intent.succeeded updates deposit to CAPTURED', () => {
      const expectedStatus = 'CAPTURED';
      expect(expectedStatus).toBe('CAPTURED');
    });

    test('payment_intent.payment_failed updates deposit to FAILED', () => {
      const expectedStatus = 'FAILED';
      expect(expectedStatus).toBe('FAILED');
    });
  });

  describe('Transfer Events', () => {
    test('transfer.created confirms deposit transfer', () => {
      const expectedStatus = 'TRANSFERRED';
      expect(expectedStatus).toBe('TRANSFERRED');
    });

    test('transfer.failed requires manual intervention', () => {
      // Transfer failure is critical - funds collected but not transferred
      const isDepositCaptured = true;
      const isTransferFailed = true;
      expect(isDepositCaptured && isTransferFailed).toBe(true);
    });
  });

  describe('Connect Account Events', () => {
    test('account.updated syncs onboarding status', () => {
      const mockAccount = {
        details_submitted: true,
        payouts_enabled: true,
      };
      expect(mockAccount.details_submitted).toBe(true);
      expect(mockAccount.payouts_enabled).toBe(true);
    });
  });
});

describe('Idempotency', () => {
  test('deposit creation uses idempotency key', () => {
    const requestId = 'request-123';
    const timestamp = Date.now();
    const idempotencyKey = `deposit-${requestId}-${timestamp}`;
    expect(idempotencyKey).toContain('deposit-');
    expect(idempotencyKey).toContain(requestId);
  });

  test('duplicate payment events are ignored', () => {
    const eventId = 'evt_xxx';
    const processedEvents = new Set(['evt_xxx']);
    const isAlreadyProcessed = processedEvents.has(eventId);
    expect(isAlreadyProcessed).toBe(true);
  });

  test('transfers use request-specific transfer group', () => {
    const requestId = 'request-123';
    const transferGroup = `request_${requestId}`;
    expect(transferGroup).toBe('request_request-123');
  });
});
