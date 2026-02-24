/**
 * Unit tests for createAuthMiddleware
 * 
 * Tests the authentication middleware behavior including:
 * - No-op mode when password is not set
 * - Login route skipping
 * - Session validation
 * - Redirect vs 401 responses
 */

import { describe, it, expect } from 'vitest';
import { createAuthMiddleware, signSessionToken } from '../../src/admin-auth.js';
import crypto from 'crypto';

describe('createAuthMiddleware', () => {
  describe('when adminPassword is not set', () => {
    it('should return no-op middleware that calls next()', () => {
      const middleware = createAuthMiddleware(null);
      
      const req = { path: '/admin/index' };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
    });

    it('should allow access to any admin route', () => {
      const middleware = createAuthMiddleware('');
      
      const req = { path: '/admin/api/calls' };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
    });
  });

  describe('when adminPassword is set', () => {
    const adminPassword = 'test-password-123';
    
    it('should skip authentication for /admin/login', () => {
      const middleware = createAuthMiddleware(adminPassword);
      
      const req = { path: '/admin/login', cookies: {} };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
    });

    it('should skip authentication for /login', () => {
      const middleware = createAuthMiddleware(adminPassword);
      
      const req = { path: '/login', cookies: {} };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
    });

    it('should allow access with valid session cookie', () => {
      const sessionSecret = adminPassword;
      const middleware = createAuthMiddleware(adminPassword, { sessionSecret });
      
      const validToken = signSessionToken(sessionSecret);
      const req = { 
        path: '/admin/index',
        cookies: { admin_session: validToken }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
    });

    it('should redirect to login for page requests without valid session', () => {
      const middleware = createAuthMiddleware(adminPassword);
      
      const req = { 
        path: '/admin/index',
        cookies: {}
      };
      let redirectPath = null;
      const res = {
        redirect: (path) => { redirectPath = path; }
      };
      const next = () => {};
      
      middleware(req, res, next);
      
      expect(redirectPath).toBe('/admin/login');
    });

    it('should return 401 JSON for API requests without valid session', () => {
      const middleware = createAuthMiddleware(adminPassword);
      
      const req = { 
        path: '/admin/api/calls',
        cookies: {}
      };
      let statusCode = null;
      let jsonResponse = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { jsonResponse = data; }
          };
        }
      };
      const next = () => {};
      
      middleware(req, res, next);
      
      expect(statusCode).toBe(401);
      expect(jsonResponse).toEqual({ error: 'Unauthorized' });
    });

    it('should reject expired session tokens', () => {
      const sessionSecret = adminPassword;
      const middleware = createAuthMiddleware(adminPassword, { 
        sessionSecret,
        maxAge: 1 // 1 second max age
      });
      
      // Create a token with an old timestamp
      const oldTimestamp = Date.now() - 5000; // 5 seconds ago
      const timestampHex = oldTimestamp.toString(16);
      const hmac = crypto.createHmac('sha256', sessionSecret);
      hmac.update(timestampHex);
      const signature = hmac.digest('hex');
      const expiredToken = `${timestampHex}.${signature}`;
      
      const req = { 
        path: '/admin/index',
        cookies: { admin_session: expiredToken }
      };
      let redirectPath = null;
      const res = {
        redirect: (path) => { redirectPath = path; }
      };
      const next = () => {};
      
      middleware(req, res, next);
      
      expect(redirectPath).toBe('/admin/login');
    });

    it('should use custom cookie name from options', () => {
      const sessionSecret = adminPassword;
      const customCookieName = 'my_custom_session';
      const middleware = createAuthMiddleware(adminPassword, { 
        sessionSecret,
        cookieName: customCookieName
      });
      
      const validToken = signSessionToken(sessionSecret);
      const req = { 
        path: '/admin/index',
        cookies: { [customCookieName]: validToken }
      };
      const res = {};
      let nextCalled = false;
      const next = () => { nextCalled = true; };
      
      middleware(req, res, next);
      
      expect(nextCalled).toBe(true);
    });

    it('should reject invalid session tokens', () => {
      const middleware = createAuthMiddleware(adminPassword);
      
      const req = { 
        path: '/admin/index',
        cookies: { admin_session: 'invalid-token' }
      };
      let redirectPath = null;
      const res = {
        redirect: (path) => { redirectPath = path; }
      };
      const next = () => {};
      
      middleware(req, res, next);
      
      expect(redirectPath).toBe('/admin/login');
    });
  });
});
