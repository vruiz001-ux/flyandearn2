import { jest } from '@jest/globals';
import {
  isValidEmail,
  validatePassword,
  parseCookies,
} from '../netlify/functions/lib/auth.js';

describe('Auth Library', () => {
  describe('isValidEmail', () => {
    test('accepts valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    test('rejects invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('no@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    test('accepts strong passwords', () => {
      const result = validatePassword('StrongPass1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects short passwords', () => {
      const result = validatePassword('Short1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    test('requires uppercase letter', () => {
      const result = validatePassword('lowercase1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    test('requires lowercase letter', () => {
      const result = validatePassword('UPPERCASE1');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    test('requires number', () => {
      const result = validatePassword('NoNumberHere');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  describe('parseCookies', () => {
    test('parses cookie header correctly', () => {
      const cookies = parseCookies('session=abc123; user=john');
      expect(cookies.session).toBe('abc123');
      expect(cookies.user).toBe('john');
    });

    test('handles empty cookie header', () => {
      expect(parseCookies('')).toEqual({});
      expect(parseCookies(null)).toEqual({});
      expect(parseCookies(undefined)).toEqual({});
    });

    test('handles cookies with equals in value', () => {
      const cookies = parseCookies('token=abc=def=ghi');
      expect(cookies.token).toBe('abc=def=ghi');
    });
  });
});
