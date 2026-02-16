import { jest } from '@jest/globals';
import {
  calculateOrderFees,
  PLATFORM_FEE_PERCENT,
  TRAVELLER_SERVICE_FEE_PERCENT,
  OTHER_SERVICE_FEE_PERCENT,
  ORDER_TYPES,
  SUBSCRIPTION_PLANS,
} from '../netlify/functions/lib/subscription.js';
import {
  getCurrencyForCountry,
  formatCurrency,
} from '../netlify/functions/lib/fx.js';

describe('Subscription Library', () => {
  describe('Fee Calculations', () => {
    test('calculates fees correctly for a 100 EUR order', () => {
      const fees = calculateOrderFees(100);

      expect(fees.goodsValue).toBe(100);
      expect(fees.platformFee).toBe(5); // 5% of 100
      expect(fees.travellerServiceFee).toBe(15); // 15% of 100
      expect(fees.totalAmount).toBe(120); // 100 + 5 + 15
      expect(fees.travelerAmount).toBe(15); // Traveler gets the service fee
    });

    test('calculates fees correctly for a 250 EUR order', () => {
      const fees = calculateOrderFees(250);

      expect(fees.goodsValue).toBe(250);
      expect(fees.platformFee).toBe(12.5); // 5% of 250
      expect(fees.travellerServiceFee).toBe(37.5); // 15% of 250
      expect(fees.totalAmount).toBe(300); // 250 + 12.5 + 37.5
      expect(fees.travelerAmount).toBe(37.5);
    });

    test('handles decimal goods values correctly', () => {
      const fees = calculateOrderFees(99.99);

      expect(fees.goodsValue).toBe(99.99);
      expect(fees.platformFee).toBe(5); // 5% of 99.99 = 4.9995, rounded to 5.00
      expect(fees.travellerServiceFee).toBe(15); // 15% of 99.99 = 14.9985, rounded to 15.00
      // Total should be sum of rounded values
      expect(fees.totalAmount).toBe(119.99);
    });

    test('handles zero goods value', () => {
      const fees = calculateOrderFees(0);

      expect(fees.goodsValue).toBe(0);
      expect(fees.platformFee).toBe(0);
      expect(fees.travellerServiceFee).toBe(0);
      expect(fees.totalAmount).toBe(0);
      expect(fees.travelerAmount).toBe(0);
    });

    test('fee percentages are correct', () => {
      expect(PLATFORM_FEE_PERCENT).toBe(0.05);
      expect(TRAVELLER_SERVICE_FEE_PERCENT).toBe(0.15);
      expect(OTHER_SERVICE_FEE_PERCENT).toBe(0.20);
    });

    test('ORDER_TYPES enum has correct values', () => {
      expect(ORDER_TYPES.DUTY_FREE).toBe('DUTY_FREE');
      expect(ORDER_TYPES.OTHER).toBe('OTHER');
    });
  });

  describe('Fee Calculations for Other (Non-Duty-Free) Orders', () => {
    test('calculates fees correctly for a 100 EUR OTHER order (20% service fee)', () => {
      const fees = calculateOrderFees(100, ORDER_TYPES.OTHER);

      expect(fees.goodsValue).toBe(100);
      expect(fees.platformFee).toBe(5); // 5% of 100
      expect(fees.travellerServiceFee).toBe(20); // 20% of 100
      expect(fees.totalAmount).toBe(125); // 100 + 5 + 20
      expect(fees.travelerAmount).toBe(20); // Traveler gets the service fee
      expect(fees.orderType).toBe(ORDER_TYPES.OTHER);
      expect(fees.serviceFeePercent).toBe(0.20);
    });

    test('calculates fees correctly for a 250 EUR OTHER order', () => {
      const fees = calculateOrderFees(250, ORDER_TYPES.OTHER);

      expect(fees.goodsValue).toBe(250);
      expect(fees.platformFee).toBe(12.5); // 5% of 250
      expect(fees.travellerServiceFee).toBe(50); // 20% of 250
      expect(fees.totalAmount).toBe(312.5); // 250 + 12.5 + 50
      expect(fees.travelerAmount).toBe(50);
      expect(fees.serviceFeePercent).toBe(0.20);
    });

    test('defaults to DUTY_FREE when no order type specified', () => {
      const fees = calculateOrderFees(100);

      expect(fees.orderType).toBe(ORDER_TYPES.DUTY_FREE);
      expect(fees.serviceFeePercent).toBe(0.15);
      expect(fees.travellerServiceFee).toBe(15); // 15% of 100
    });

    test('DUTY_FREE order uses 15% service fee', () => {
      const fees = calculateOrderFees(100, ORDER_TYPES.DUTY_FREE);

      expect(fees.travellerServiceFee).toBe(15); // 15% of 100
      expect(fees.serviceFeePercent).toBe(0.15);
      expect(fees.orderType).toBe(ORDER_TYPES.DUTY_FREE);
    });
  });

  describe('Subscription Plans', () => {
    test('Silver plan has correct properties', () => {
      const silver = SUBSCRIPTION_PLANS.SILVER;

      expect(silver.tier).toBe('SILVER');
      expect(silver.name).toBe('Silver');
      expect(silver.pricePln).toBe(19.99);
      expect(silver.purchaseLimit).toBe(5);
    });

    test('Gold plan has correct properties', () => {
      const gold = SUBSCRIPTION_PLANS.GOLD;

      expect(gold.tier).toBe('GOLD');
      expect(gold.name).toBe('Gold');
      expect(gold.pricePln).toBe(29.99);
      expect(gold.purchaseLimit).toBe(10);
    });

    test('Platinum plan has correct properties', () => {
      const platinum = SUBSCRIPTION_PLANS.PLATINUM;

      expect(platinum.tier).toBe('PLATINUM');
      expect(platinum.name).toBe('Platinum');
      expect(platinum.pricePln).toBe(49.99);
      expect(platinum.purchaseLimit).toBeNull(); // Unlimited
    });

    test('all plans have EUR prices', () => {
      Object.values(SUBSCRIPTION_PLANS).forEach(plan => {
        expect(plan.priceEur).toBeDefined();
        expect(plan.priceEur).toBeGreaterThan(0);
      });
    });

    test('all plans have features array', () => {
      Object.values(SUBSCRIPTION_PLANS).forEach(plan => {
        expect(Array.isArray(plan.features)).toBe(true);
        expect(plan.features.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('FX Library', () => {
  describe('getCurrencyForCountry', () => {
    test('returns PLN for Poland variants', () => {
      expect(getCurrencyForCountry('Poland')).toBe('PLN');
      expect(getCurrencyForCountry('poland')).toBe('PLN');
      expect(getCurrencyForCountry('POLAND')).toBe('PLN');
      expect(getCurrencyForCountry('Polska')).toBe('PLN');
      expect(getCurrencyForCountry('polska')).toBe('PLN');
      expect(getCurrencyForCountry('PL')).toBe('PLN');
      expect(getCurrencyForCountry('pl')).toBe('PLN');
      expect(getCurrencyForCountry('POL')).toBe('PLN');
    });

    test('returns EUR for other countries', () => {
      expect(getCurrencyForCountry('Germany')).toBe('EUR');
      expect(getCurrencyForCountry('France')).toBe('EUR');
      expect(getCurrencyForCountry('Spain')).toBe('EUR');
      expect(getCurrencyForCountry('Italy')).toBe('EUR');
      expect(getCurrencyForCountry('Netherlands')).toBe('EUR');
    });

    test('returns EUR for null/undefined country', () => {
      expect(getCurrencyForCountry(null)).toBe('EUR');
      expect(getCurrencyForCountry(undefined)).toBe('EUR');
      expect(getCurrencyForCountry('')).toBe('EUR');
    });
  });

  describe('formatCurrency', () => {
    test('formats EUR correctly', () => {
      expect(formatCurrency(100, 'EUR')).toBe('\u20AC100.00');
      expect(formatCurrency(99.99, 'EUR')).toBe('\u20AC99.99');
      expect(formatCurrency(0, 'EUR')).toBe('\u20AC0.00');
    });

    test('formats PLN correctly', () => {
      const result = formatCurrency(100, 'PLN');
      expect(result).toContain('100.00');
      expect(result).toContain('z\u0142'); // PLN symbol
    });

    test('handles unknown currencies', () => {
      const result = formatCurrency(50, 'XYZ');
      expect(result).toContain('50.00');
      expect(result).toContain('XYZ');
    });
  });
});

describe('Purchase Limit Logic', () => {
  // These tests verify the business logic for purchase limits

  test('Silver plan allows exactly 5 purchases', () => {
    const silver = SUBSCRIPTION_PLANS.SILVER;
    expect(silver.purchaseLimit).toBe(5);

    // Simulate usage check
    const checkCanPurchase = (used, limit) => {
      if (limit === null) return true; // Unlimited
      return used < limit;
    };

    expect(checkCanPurchase(0, silver.purchaseLimit)).toBe(true);
    expect(checkCanPurchase(4, silver.purchaseLimit)).toBe(true);
    expect(checkCanPurchase(5, silver.purchaseLimit)).toBe(false);
    expect(checkCanPurchase(6, silver.purchaseLimit)).toBe(false);
  });

  test('Gold plan allows exactly 10 purchases', () => {
    const gold = SUBSCRIPTION_PLANS.GOLD;
    expect(gold.purchaseLimit).toBe(10);

    const checkCanPurchase = (used, limit) => {
      if (limit === null) return true;
      return used < limit;
    };

    expect(checkCanPurchase(0, gold.purchaseLimit)).toBe(true);
    expect(checkCanPurchase(9, gold.purchaseLimit)).toBe(true);
    expect(checkCanPurchase(10, gold.purchaseLimit)).toBe(false);
  });

  test('Platinum plan allows unlimited purchases', () => {
    const platinum = SUBSCRIPTION_PLANS.PLATINUM;
    expect(platinum.purchaseLimit).toBeNull();

    const checkCanPurchase = (used, limit) => {
      if (limit === null) return true; // Unlimited
      return used < limit;
    };

    expect(checkCanPurchase(0, platinum.purchaseLimit)).toBe(true);
    expect(checkCanPurchase(100, platinum.purchaseLimit)).toBe(true);
    expect(checkCanPurchase(1000, platinum.purchaseLimit)).toBe(true);
  });
});

describe('Order Total Calculations', () => {
  test('buyer pays correct total for various order values', () => {
    const testCases = [
      { goodsValue: 50, expectedTotal: 60 }, // 50 + 2.5 + 7.5 = 60
      { goodsValue: 100, expectedTotal: 120 }, // 100 + 5 + 15 = 120
      { goodsValue: 200, expectedTotal: 240 }, // 200 + 10 + 30 = 240
      { goodsValue: 500, expectedTotal: 600 }, // 500 + 25 + 75 = 600
    ];

    testCases.forEach(({ goodsValue, expectedTotal }) => {
      const fees = calculateOrderFees(goodsValue);
      expect(fees.totalAmount).toBe(expectedTotal);
    });
  });

  test('traveler receives correct amount (15% service fee)', () => {
    const testCases = [
      { goodsValue: 100, expectedTravelerAmount: 15 },
      { goodsValue: 200, expectedTravelerAmount: 30 },
      { goodsValue: 500, expectedTravelerAmount: 75 },
    ];

    testCases.forEach(({ goodsValue, expectedTravelerAmount }) => {
      const fees = calculateOrderFees(goodsValue);
      expect(fees.travelerAmount).toBe(expectedTravelerAmount);
    });
  });

  test('platform receives correct amount (5% fee)', () => {
    const testCases = [
      { goodsValue: 100, expectedPlatformFee: 5 },
      { goodsValue: 200, expectedPlatformFee: 10 },
      { goodsValue: 500, expectedPlatformFee: 25 },
    ];

    testCases.forEach(({ goodsValue, expectedPlatformFee }) => {
      const fees = calculateOrderFees(goodsValue);
      expect(fees.platformFee).toBe(expectedPlatformFee);
    });
  });
});

describe('Order Total Calculations - OTHER (Non-Duty-Free) Orders', () => {
  test('buyer pays correct total for OTHER orders (20% service fee)', () => {
    const testCases = [
      { goodsValue: 50, expectedTotal: 62.5 }, // 50 + 2.5 + 10 = 62.5
      { goodsValue: 100, expectedTotal: 125 }, // 100 + 5 + 20 = 125
      { goodsValue: 200, expectedTotal: 250 }, // 200 + 10 + 40 = 250
      { goodsValue: 500, expectedTotal: 625 }, // 500 + 25 + 100 = 625
    ];

    testCases.forEach(({ goodsValue, expectedTotal }) => {
      const fees = calculateOrderFees(goodsValue, ORDER_TYPES.OTHER);
      expect(fees.totalAmount).toBe(expectedTotal);
    });
  });

  test('traveler receives correct amount for OTHER orders (20% service fee)', () => {
    const testCases = [
      { goodsValue: 100, expectedTravelerAmount: 20 },
      { goodsValue: 200, expectedTravelerAmount: 40 },
      { goodsValue: 500, expectedTravelerAmount: 100 },
    ];

    testCases.forEach(({ goodsValue, expectedTravelerAmount }) => {
      const fees = calculateOrderFees(goodsValue, ORDER_TYPES.OTHER);
      expect(fees.travelerAmount).toBe(expectedTravelerAmount);
    });
  });

  test('compares DUTY_FREE vs OTHER order totals', () => {
    const goodsValue = 100;

    const dutyFreeFees = calculateOrderFees(goodsValue, ORDER_TYPES.DUTY_FREE);
    const otherFees = calculateOrderFees(goodsValue, ORDER_TYPES.OTHER);

    // Platform fee should be the same (5%)
    expect(dutyFreeFees.platformFee).toBe(otherFees.platformFee);
    expect(dutyFreeFees.platformFee).toBe(5);

    // Service fees should differ
    expect(dutyFreeFees.travellerServiceFee).toBe(15); // 15%
    expect(otherFees.travellerServiceFee).toBe(20); // 20%

    // Total amounts should differ
    expect(dutyFreeFees.totalAmount).toBe(120); // 100 + 5 + 15
    expect(otherFees.totalAmount).toBe(125); // 100 + 5 + 20

    // Difference should be 5% of goods value
    expect(otherFees.totalAmount - dutyFreeFees.totalAmount).toBe(5);
  });
});
