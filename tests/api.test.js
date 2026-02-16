import { jest } from '@jest/globals';
import bcrypt from 'bcryptjs';

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  request: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  trip: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  offer: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  requestItem: {
    create: jest.fn(),
  },
};

// Mock the prisma module
jest.unstable_mockModule('../netlify/functions/lib/prisma.js', () => ({
  default: mockPrisma,
}));

// Import auth utilities for testing
const { isValidEmail, validatePassword, parseCookies } = await import('../netlify/functions/lib/auth.js');

describe('API Input Validation', () => {
  describe('Email Validation', () => {
    test('accepts valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@test-domain.org',
      ];
      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    test('rejects invalid email formats', () => {
      const invalidEmails = [
        '',
        'invalid',
        'invalid@',
        '@domain.com',
        'user@.com',
        'user@domain',
        'user name@example.com',
        'user@exam ple.com',
      ];
      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('Password Validation', () => {
    test('accepts strong passwords', () => {
      const strongPasswords = [
        'Password1',
        'MyP@ssw0rd',
        'Str0ngPass!',
        'AbCdEf123',
      ];
      strongPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('rejects weak passwords', () => {
      const weakPasswords = [
        { password: 'short', expectedErrors: 4 }, // too short, no upper, no number
        { password: 'nouppercase1', expectedErrors: 1 }, // no uppercase
        { password: 'NOLOWERCASE1', expectedErrors: 1 }, // no lowercase
        { password: 'NoNumbers', expectedErrors: 1 }, // no number
        { password: '12345678', expectedErrors: 2 }, // no letters
      ];
      weakPasswords.forEach(({ password, expectedErrors }) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Cookie Parsing', () => {
    test('parses single cookie', () => {
      const cookies = parseCookies('session=abc123');
      expect(cookies.session).toBe('abc123');
    });

    test('parses multiple cookies', () => {
      const cookies = parseCookies('session=abc123; user=john; theme=dark');
      expect(cookies.session).toBe('abc123');
      expect(cookies.user).toBe('john');
      expect(cookies.theme).toBe('dark');
    });

    test('handles cookies with equals sign in value', () => {
      const cookies = parseCookies('token=eyJhbGciOiJIUzI1NiJ9.test=value');
      expect(cookies.token).toBe('eyJhbGciOiJIUzI1NiJ9.test=value');
    });

    test('handles empty cookie header', () => {
      expect(parseCookies('')).toEqual({});
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies(undefined)).toEqual({});
    });

    test('handles whitespace around cookies', () => {
      // Standard cookie format has whitespace after semicolons but not around equals
      const cookies = parseCookies('  session=abc123 ; user=john ');
      expect(cookies.session).toBe('abc123');
      expect(cookies.user).toBe('john');
    });
  });
});

describe('Request Validation Logic', () => {
  const REQUEST_TYPES = {
    DUTY_FREE: 'DUTY_FREE',
    OUTSIDE_DUTY_FREE: 'OUTSIDE_DUTY_FREE',
    BOTH: 'BOTH',
  };

  const ITEM_SOURCES = {
    DUTY_FREE: 'DUTY_FREE',
    OUTSIDE_DUTY_FREE: 'OUTSIDE_DUTY_FREE',
  };

  test('validates request type values', () => {
    expect(Object.values(REQUEST_TYPES)).toContain('DUTY_FREE');
    expect(Object.values(REQUEST_TYPES)).toContain('OUTSIDE_DUTY_FREE');
    expect(Object.values(REQUEST_TYPES)).toContain('BOTH');
  });

  test('validates item source values', () => {
    expect(Object.values(ITEM_SOURCES)).toContain('DUTY_FREE');
    expect(Object.values(ITEM_SOURCES)).toContain('OUTSIDE_DUTY_FREE');
  });

  test('airport codes should be uppercase', () => {
    const normalizeAirport = (code) => code?.trim().toUpperCase();
    expect(normalizeAirport('jfk')).toBe('JFK');
    expect(normalizeAirport(' lhr ')).toBe('LHR');
    expect(normalizeAirport('CDG')).toBe('CDG');
  });

  test('validates price values', () => {
    const validatePrice = (price) => {
      const parsed = parseFloat(price);
      return !isNaN(parsed) && parsed >= 0;
    };

    expect(validatePrice(100)).toBe(true);
    expect(validatePrice('50.99')).toBe(true);
    expect(validatePrice(0)).toBe(true);
    expect(validatePrice(-10)).toBe(false);
    expect(validatePrice('invalid')).toBe(false);
    expect(validatePrice(NaN)).toBe(false);
  });

  test('validates quantity values', () => {
    const validateQuantity = (qty) => {
      const parsed = parseInt(qty, 10);
      return !isNaN(parsed) && parsed >= 1;
    };

    expect(validateQuantity(1)).toBe(true);
    expect(validateQuantity(10)).toBe(true);
    expect(validateQuantity('5')).toBe(true);
    expect(validateQuantity(0)).toBe(false);
    expect(validateQuantity(-1)).toBe(false);
    expect(validateQuantity('invalid')).toBe(false);
  });
});

describe('Sanitization', () => {
  const sanitize = (str) => str ? str.replace(/<[^>]*>/g, '').trim() : null;

  test('removes HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitize('<b>Bold</b>')).toBe('Bold');
    expect(sanitize('Hello <a href="#">World</a>')).toBe('Hello World');
  });

  test('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
    expect(sanitize('\n\ttest\n\t')).toBe('test');
  });

  test('handles null and empty strings', () => {
    expect(sanitize(null)).toBe(null);
    expect(sanitize(undefined)).toBe(null);
    expect(sanitize('')).toBe(null);
  });

  test('preserves normal text', () => {
    expect(sanitize('Normal text with no HTML')).toBe('Normal text with no HTML');
    expect(sanitize('Price: $100.00')).toBe('Price: $100.00');
  });
});

describe('Service Fee Calculations', () => {
  const TRAVELLER_SERVICE_FEE_PERCENT = 0.15;
  const OTHER_SERVICE_FEE_PERCENT = 0.20;
  const PLATFORM_FEE_PERCENT = 0.05;

  test('calculates duty-free service fee correctly', () => {
    const goodsValue = 100;
    const serviceFee = goodsValue * TRAVELLER_SERVICE_FEE_PERCENT;
    expect(serviceFee).toBe(15);
  });

  test('calculates outside duty-free service fee correctly', () => {
    const goodsValue = 100;
    const serviceFee = goodsValue * OTHER_SERVICE_FEE_PERCENT;
    expect(serviceFee).toBe(20);
  });

  test('calculates platform fee correctly', () => {
    const goodsValue = 100;
    const platformFee = goodsValue * PLATFORM_FEE_PERCENT;
    expect(platformFee).toBe(5);
  });

  test('validates max service fee enforcement', () => {
    const goodsValue = 100;
    const maxDutyFreeFee = goodsValue * TRAVELLER_SERVICE_FEE_PERCENT;
    const maxOtherFee = goodsValue * OTHER_SERVICE_FEE_PERCENT;

    // Valid fees
    expect(10 <= maxDutyFreeFee).toBe(true);
    expect(15 <= maxDutyFreeFee).toBe(true);
    expect(20 <= maxOtherFee).toBe(true);

    // Invalid fees (exceeds max)
    expect(16 <= maxDutyFreeFee).toBe(false);
    expect(21 <= maxOtherFee).toBe(false);
  });
});

describe('Password Hashing', () => {
  test('bcrypt hashes password correctly', async () => {
    const password = 'TestPassword123';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
  });

  test('bcrypt verifies correct password', async () => {
    const password = 'TestPassword123';
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare(password, hash);
    expect(isValid).toBe(true);
  });

  test('bcrypt rejects incorrect password', async () => {
    const password = 'TestPassword123';
    const hash = await bcrypt.hash(password, 10);

    const isValid = await bcrypt.compare('WrongPassword123', hash);
    expect(isValid).toBe(false);
  });
});

describe('HTTP Response Format', () => {
  const jsonResponse = (statusCode, body) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  test('creates success response correctly', () => {
    const response = jsonResponse(200, { success: true, data: 'test' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(response.body)).toEqual({ success: true, data: 'test' });
  });

  test('creates error response correctly', () => {
    const response = jsonResponse(400, { error: 'Bad request' });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'Bad request' });
  });

  test('creates unauthorized response correctly', () => {
    const response = jsonResponse(401, { error: 'Authentication required' });
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error).toBe('Authentication required');
  });

  test('creates forbidden response correctly', () => {
    const response = jsonResponse(403, { error: 'Not authorized' });
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error).toBe('Not authorized');
  });

  test('creates not found response correctly', () => {
    const response = jsonResponse(404, { error: 'Not found' });
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error).toBe('Not found');
  });
});

describe('Date Handling', () => {
  test('parses ISO date strings correctly', () => {
    const dateStr = '2024-12-25';
    const date = new Date(dateStr);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(11); // 0-indexed
    expect(date.getDate()).toBe(25);
  });

  test('handles null dates', () => {
    const processDate = (dateStr) => dateStr ? new Date(dateStr) : null;
    expect(processDate(null)).toBe(null);
    expect(processDate('')).toBe(null);
    expect(processDate(undefined)).toBe(null);
  });

  test('validates future dates for neededBy', () => {
    const isFutureDate = (dateStr) => {
      if (!dateStr) return true; // null is valid (optional)
      const date = new Date(dateStr);
      return date > new Date();
    };

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    expect(isFutureDate(futureDate.toISOString())).toBe(true);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    expect(isFutureDate(pastDate.toISOString())).toBe(false);
  });
});

describe('Currency Handling', () => {
  test('validates supported currencies', () => {
    const supportedCurrencies = ['EUR', 'PLN', 'USD', 'GBP'];
    expect(supportedCurrencies).toContain('EUR');
    expect(supportedCurrencies).toContain('PLN');
  });

  test('defaults to EUR when currency not specified', () => {
    const getCurrency = (currency) => currency || 'EUR';
    expect(getCurrency(null)).toBe('EUR');
    expect(getCurrency(undefined)).toBe('EUR');
    expect(getCurrency('')).toBe('EUR');
    expect(getCurrency('PLN')).toBe('PLN');
  });

  test('gets correct currency symbol', () => {
    const getSymbol = (currency) => {
      const symbols = { EUR: '€', PLN: 'zł', USD: '$', GBP: '£' };
      return symbols[currency] || currency;
    };
    expect(getSymbol('EUR')).toBe('€');
    expect(getSymbol('PLN')).toBe('zł');
    expect(getSymbol('USD')).toBe('$');
    expect(getSymbol('GBP')).toBe('£');
    expect(getSymbol('CHF')).toBe('CHF');
  });
});
