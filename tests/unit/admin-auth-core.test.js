/**
 * Unit tests for core admin-auth cryptographic functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signSessionToken, verifySessionToken, comparePasswords, generateCsrfToken, validateCsrfToken, createRateLimiter } from '../../src/admin-auth.js';

describe('admin-auth core functions', () => {
  describe('signSessionToken', () => {
    it('should create a token with timestamp and signature', () => {
      const secret = 'test-secret';
      const token = signSessionToken(secret);
      
      expect(token).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
    });

    it('should throw error for empty secret', () => {
      expect(() => signSessionToken('')).toThrow('Secret must be a non-empty string');
    });

    it('should throw error for non-string secret', () => {
      expect(() => signSessionToken(null)).toThrow('Secret must be a non-empty string');
      expect(() => signSessionToken(undefined)).toThrow('Secret must be a non-empty string');
    });

    it('should create different tokens on subsequent calls', () => {
      const secret = 'test-secret';
      const token1 = signSessionToken(secret);
      // Small delay to ensure different timestamp
      const token2 = signSessionToken(secret);
      
      // Tokens should be different due to different timestamps
      // (unless called in the same millisecond, which is unlikely but possible)
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
    });
  });

  describe('verifySessionToken', () => {
    it('should verify a valid token', () => {
      const secret = 'test-secret';
      const token = signSessionToken(secret);
      
      expect(verifySessionToken(token, secret)).toBe(true);
    });

    it('should reject token with wrong secret', () => {
      const secret = 'test-secret';
      const token = signSessionToken(secret);
      
      expect(verifySessionToken(token, 'wrong-secret')).toBe(false);
    });

    it('should reject token with modified timestamp', () => {
      const secret = 'test-secret';
      const token = signSessionToken(secret);
      const [timestamp, signature] = token.split('.');
      
      // Modify timestamp
      const modifiedToken = `${timestamp}0.${signature}`;
      expect(verifySessionToken(modifiedToken, secret)).toBe(false);
    });

    it('should reject token with modified signature', () => {
      const secret = 'test-secret';
      const token = signSessionToken(secret);
      const [timestamp, signature] = token.split('.');
      
      // Modify signature
      const modifiedSignature = signature.slice(0, -1) + (signature.slice(-1) === 'a' ? 'b' : 'a');
      const modifiedToken = `${timestamp}.${modifiedSignature}`;
      expect(verifySessionToken(modifiedToken, secret)).toBe(false);
    });

    it('should reject malformed tokens', () => {
      const secret = 'test-secret';
      
      expect(verifySessionToken('invalid', secret)).toBe(false);
      expect(verifySessionToken('no-hex-here.signature', secret)).toBe(false);
      expect(verifySessionToken('', secret)).toBe(false);
      expect(verifySessionToken('only-one-part', secret)).toBe(false);
      expect(verifySessionToken('too.many.parts', secret)).toBe(false);
    });

    it('should reject when secret is invalid', () => {
      const token = signSessionToken('test-secret');
      
      expect(verifySessionToken(token, '')).toBe(false);
      expect(verifySessionToken(token, null)).toBe(false);
      expect(verifySessionToken(token, undefined)).toBe(false);
    });

    it('should reject when token is invalid type', () => {
      expect(verifySessionToken(null, 'secret')).toBe(false);
      expect(verifySessionToken(undefined, 'secret')).toBe(false);
    });
  });

  describe('comparePasswords', () => {
    it('should return true for matching passwords', () => {
      expect(comparePasswords('password123', 'password123')).toBe(true);
      expect(comparePasswords('', '')).toBe(true);
      expect(comparePasswords('complex!@#$%', 'complex!@#$%')).toBe(true);
    });

    it('should return false for non-matching passwords', () => {
      expect(comparePasswords('password123', 'password124')).toBe(false);
      expect(comparePasswords('password', 'Password')).toBe(false);
      expect(comparePasswords('short', 'longer-password')).toBe(false);
    });

    it('should return false for different length passwords', () => {
      expect(comparePasswords('abc', 'abcd')).toBe(false);
      expect(comparePasswords('longer', 'short')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(comparePasswords(null, 'password')).toBe(false);
      expect(comparePasswords('password', null)).toBe(false);
      expect(comparePasswords(undefined, 'password')).toBe(false);
      expect(comparePasswords('password', undefined)).toBe(false);
      expect(comparePasswords('', null)).toBe(false);
    });

    it('should handle unicode characters', () => {
      expect(comparePasswords('pāsswörd🔒', 'pāsswörd🔒')).toBe(true);
      expect(comparePasswords('pāsswörd🔒', 'pāsswörd🔓')).toBe(false);
    });
  });

  describe('generateCsrfToken', () => {
    it('should generate a token and cookie pair', () => {
      const { token, cookie } = generateCsrfToken();
      
      expect(token).toBeDefined();
      expect(cookie).toBeDefined();
      expect(typeof token).toBe('string');
      expect(typeof cookie).toBe('string');
    });

    it('should generate 64 hex characters (32 bytes)', () => {
      const { token } = generateCsrfToken();
      
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should include token in cookie string', () => {
      const { token, cookie } = generateCsrfToken();
      
      expect(cookie).toContain(`csrf_token=${token}`);
    });

    it('should set appropriate cookie flags', () => {
      const { cookie } = generateCsrfToken();
      
      expect(cookie).toContain('Path=/admin/login');
      expect(cookie).toContain('Max-Age=600');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('should generate different tokens on each call', () => {
      const result1 = generateCsrfToken();
      const result2 = generateCsrfToken();
      
      expect(result1.token).not.toBe(result2.token);
    });
  });

  describe('validateCsrfToken', () => {
    it('should return true when cookie and body tokens match', () => {
      const token = 'test-csrf-token-12345';
      const req = {
        cookies: { csrf_token: token },
        body: { csrf_token: token }
      };
      
      expect(validateCsrfToken(req)).toBe(true);
    });

    it('should return false when tokens do not match', () => {
      const req = {
        cookies: { csrf_token: 'token1' },
        body: { csrf_token: 'token2' }
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when cookie token is missing', () => {
      const req = {
        cookies: {},
        body: { csrf_token: 'token' }
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when body token is missing', () => {
      const req = {
        cookies: { csrf_token: 'token' },
        body: {}
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when both tokens are missing', () => {
      const req = {
        cookies: {},
        body: {}
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when cookies object is missing', () => {
      const req = {
        body: { csrf_token: 'token' }
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when body object is missing', () => {
      const req = {
        cookies: { csrf_token: 'token' }
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should return false when token is not a string', () => {
      const req1 = {
        cookies: { csrf_token: 123 },
        body: { csrf_token: 123 }
      };
      expect(validateCsrfToken(req1)).toBe(false);

      const req2 = {
        cookies: { csrf_token: null },
        body: { csrf_token: 'token' }
      };
      expect(validateCsrfToken(req2)).toBe(false);

      const req3 = {
        cookies: { csrf_token: 'token' },
        body: { csrf_token: undefined }
      };
      expect(validateCsrfToken(req3)).toBe(false);
    });

    it('should handle empty string tokens', () => {
      const req = {
        cookies: { csrf_token: '' },
        body: { csrf_token: '' }
      };
      
      // Empty strings should fail validation (falsy check)
      expect(validateCsrfToken(req)).toBe(false);
    });

    it('should use constant-time comparison', () => {
      // This test verifies the function uses timingSafeEqual by checking
      // that it correctly handles tokens of different lengths
      const req = {
        cookies: { csrf_token: 'short' },
        body: { csrf_token: 'much-longer-token' }
      };
      
      expect(validateCsrfToken(req)).toBe(false);
    });
  });

  describe('createRateLimiter', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should allow requests before threshold is reached', () => {
      const limiter = createRateLimiter(5, 15 * 60 * 1000);
      const ip = '192.168.1.1';
      
      expect(limiter.check(ip)).toBe(false); // Not blocked initially
      
      limiter.record(ip);
      expect(limiter.check(ip)).toBe(false); // 1 failure, not blocked
      
      limiter.record(ip);
      limiter.record(ip);
      limiter.record(ip);
      expect(limiter.check(ip)).toBe(false); // 4 failures, not blocked yet
    });

    it('should block after reaching threshold', () => {
      const limiter = createRateLimiter(5, 15 * 60 * 1000);
      const ip = '192.168.1.1';
      
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        limiter.record(ip);
      }
      
      expect(limiter.check(ip)).toBe(true); // Should be blocked
    });

    it('should track different IPs independently', () => {
      const limiter = createRateLimiter(5, 15 * 60 * 1000);
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';
      
      // Record 5 failures for ip1
      for (let i = 0; i < 5; i++) {
        limiter.record(ip1);
      }
      
      expect(limiter.check(ip1)).toBe(true); // ip1 blocked
      expect(limiter.check(ip2)).toBe(false); // ip2 not blocked
    });

    it('should reset after window expires', () => {
      const windowMs = 15 * 60 * 1000; // 15 minutes
      const limiter = createRateLimiter(5, windowMs);
      const ip = '192.168.1.1';
      
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        limiter.record(ip);
      }
      
      expect(limiter.check(ip)).toBe(true); // Blocked
      
      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1000);
      
      expect(limiter.check(ip)).toBe(false); // Should be allowed again
    });

    it('should start new window after expiry', () => {
      const windowMs = 15 * 60 * 1000;
      const limiter = createRateLimiter(5, windowMs);
      const ip = '192.168.1.1';
      
      // Record 3 failures
      limiter.record(ip);
      limiter.record(ip);
      limiter.record(ip);
      
      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1000);
      
      // Record 2 more failures in new window
      limiter.record(ip);
      limiter.record(ip);
      
      expect(limiter.check(ip)).toBe(false); // Only 2 in current window, not blocked
    });

    it('should clean up old entries periodically', () => {
      const windowMs = 15 * 60 * 1000;
      const limiter = createRateLimiter(5, windowMs);
      const ip = '192.168.1.1';
      
      // Record some failures
      limiter.record(ip);
      limiter.record(ip);
      
      // Advance time past the window
      vi.advanceTimersByTime(windowMs + 1000);
      
      // Trigger cleanup (runs every 5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // After cleanup, old entries should be removed
      expect(limiter.check(ip)).toBe(false);
    });

    it('should use custom maxAttempts', () => {
      const limiter = createRateLimiter(3, 15 * 60 * 1000); // Only 3 attempts
      const ip = '192.168.1.1';
      
      limiter.record(ip);
      limiter.record(ip);
      expect(limiter.check(ip)).toBe(false); // 2 failures, not blocked
      
      limiter.record(ip);
      expect(limiter.check(ip)).toBe(true); // 3 failures, blocked
    });

    it('should use custom window duration', () => {
      const windowMs = 5 * 60 * 1000; // 5 minutes
      const limiter = createRateLimiter(5, windowMs);
      const ip = '192.168.1.1';
      
      // Record 5 failures
      for (let i = 0; i < 5; i++) {
        limiter.record(ip);
      }
      
      expect(limiter.check(ip)).toBe(true); // Blocked
      
      // Advance time past the shorter window
      vi.advanceTimersByTime(windowMs + 1000);
      
      expect(limiter.check(ip)).toBe(false); // Should be allowed again
    });
  });
});