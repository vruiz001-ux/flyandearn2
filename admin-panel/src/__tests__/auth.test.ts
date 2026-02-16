import bcrypt from 'bcryptjs';
import { hashPassword } from '@/lib/auth';
import { checkLoginRateLimit, checkUsernameRateLimit } from '@/lib/rate-limit';
import { formatCurrency, maskEmail, maskPhone, buildCSV, calculateChange } from '@/lib/utils';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    loginAttempt: {
      count: jest.fn(),
      create: jest.fn(),
    },
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  },
}));

describe('Auth Module', () => {
  describe('hashPassword', () => {
    it('should hash a password correctly', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should create different hashes for the same password', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should be verifiable with bcrypt.compare', async () => {
      const password = 'testPassword123';
      const hash = await hashPassword(password);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });
});

describe('Utils Module', () => {
  describe('formatCurrency', () => {
    it('should format EUR correctly', () => {
      expect(formatCurrency(100)).toContain('100');
      expect(formatCurrency(1234.56)).toContain('1,234.56');
    });

    it('should handle string input', () => {
      expect(formatCurrency('50.00')).toContain('50');
    });
  });

  describe('maskEmail', () => {
    it('should mask email correctly', () => {
      const masked = maskEmail('john.doe@example.com');
      expect(masked).toContain('@example.com');
      expect(masked).not.toContain('john.doe');
      expect(masked).toMatch(/^jo\*\*\*e@example\.com$/);
    });

    it('should handle short local parts', () => {
      const masked = maskEmail('ab@test.com');
      expect(masked).toContain('@test.com');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone number', () => {
      const masked = maskPhone('+1234567890');
      expect(masked).toBe('+12****890');
    });

    it('should handle short numbers', () => {
      const masked = maskPhone('123');
      expect(masked).toBe('123');
    });
  });

  describe('buildCSV', () => {
    it('should build CSV from data', () => {
      const data = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];
      const csv = buildCSV(data);

      expect(csv).toContain('name,age');
      expect(csv).toContain('John,30');
      expect(csv).toContain('Jane,25');
    });

    it('should handle commas in values', () => {
      const data = [{ name: 'Doe, John', city: 'New York' }];
      const csv = buildCSV(data);

      expect(csv).toContain('"Doe, John"');
    });

    it('should return empty string for empty data', () => {
      expect(buildCSV([])).toBe('');
    });
  });

  describe('calculateChange', () => {
    it('should calculate positive change', () => {
      const result = calculateChange(150, 100);
      expect(result.value).toBe(50);
      expect(result.percentage).toBe(50);
      expect(result.direction).toBe('up');
    });

    it('should calculate negative change', () => {
      const result = calculateChange(50, 100);
      expect(result.value).toBe(-50);
      expect(result.percentage).toBe(50);
      expect(result.direction).toBe('down');
    });

    it('should handle zero previous value', () => {
      const result = calculateChange(100, 0);
      expect(result.percentage).toBe(100);
      expect(result.direction).toBe('up');
    });

    it('should handle no change', () => {
      const result = calculateChange(100, 100);
      expect(result.value).toBe(0);
      expect(result.direction).toBe('neutral');
    });
  });
});

describe('Rate Limit Module', () => {
  const mockPrisma = require('@/lib/db').default;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkLoginRateLimit', () => {
    it('should allow login when under limit', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(2);

      const result = await checkLoginRateLimit('192.168.1.1');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(3);
    });

    it('should block login when at limit', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(5);

      const result = await checkLoginRateLimit('192.168.1.1');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('checkUsernameRateLimit', () => {
    it('should allow login when under limit', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(1);

      const result = await checkUsernameRateLimit('admin');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });
});
