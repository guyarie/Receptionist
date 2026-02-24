/**
 * Unit tests for admin authentication login router
 * Tests the createLoginRouter function and its routes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createLoginRouter } from '../../src/admin-auth.js';

/**
 * Helper to parse cookies from Set-Cookie header
 */
function parseCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const match = cookieStr.match(/^([^=]+)=([^;]+)/);
  return match ? { name: match[1], value: match[2] } : null;
}

/**
 * Middleware to parse cookies from Cookie header
 */
function cookieParser(req, res, next) {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        req.cookies[name] = value;
      }
    });
  }
  next();
}

describe('createLoginRouter', () => {
  let app;
  const testPassword = 'test-admin-password-123';

  beforeEach(() => {
    app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(cookieParser);
  });

  describe('GET /admin/login', () => {
    it('should serve login page with CSRF token', async () => {
      const router = createLoginRouter(testPassword);
      app.use(router);

      const response = await request(app)
        .get('/admin/login')
        .expect(200);

      // Check that HTML contains login form elements
      expect(response.text).toContain('<form');
      expect(response.text).toContain('type="password"');
      expect(response.text).toContain('name="password"');
      expect(response.text).toContain('csrf_token');
      
      // Check that CSRF cookie is set
      expect(response.headers['set-cookie']).toBeDefined();
      const csrfCookie = response.headers['set-cookie'].find(c => c.startsWith('csrf_token='));
      expect(csrfCookie).toBeDefined();
    });

    it('should return empty router when password is not set', async () => {
      const router = createLoginRouter(null);
      app.use(router);

      // Should get 404 since router is empty
      await request(app)
        .get('/admin/login')
        .expect(404);
    });
  });

  describe('POST /admin/login', () => {
    it('should set session cookie and redirect on correct password', async () => {
      const router = createLoginRouter(testPassword);
      app.use(router);

      // First get the login page to get CSRF token
      const loginPage = await request(app).get('/admin/login');
      const csrfMatch = loginPage.text.match(/name="csrf_token" value="([^"]+)"/);
      const csrfToken = csrfMatch[1];
      const csrfCookie = loginPage.headers['set-cookie'].find(c => c.startsWith('csrf_token='));

      // Now submit login with correct password
      const response = await request(app)
        .post('/admin/login')
        .set('Cookie', csrfCookie)
        .send({ password: testPassword, csrf_token: csrfToken })
        .expect(302);

      // Check redirect to admin panel
      expect(response.headers.location).toBe('/admin/');

      // Check that session cookie is set
      const sessionCookie = response.headers['set-cookie'].find(c => c.includes('admin_session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('should show error on incorrect password', async () => {
      const router = createLoginRouter(testPassword);
      app.use(router);

      // Get CSRF token
      const loginPage = await request(app).get('/admin/login');
      const csrfMatch = loginPage.text.match(/name="csrf_token" value="([^"]+)"/);
      const csrfToken = csrfMatch[1];
      const csrfCookie = loginPage.headers['set-cookie'].find(c => c.startsWith('csrf_token='));

      // Submit with wrong password
      const response = await request(app)
        .post('/admin/login')
        .set('Cookie', csrfCookie)
        .send({ password: 'wrong-password', csrf_token: csrfToken })
        .expect(200);

      // Check for error message
      expect(response.text).toContain('Invalid credentials');
      
      // Should not set session cookie
      const sessionCookie = response.headers['set-cookie']?.find(c => c.includes('admin_session='));
      expect(sessionCookie).toBeUndefined();
    });

    it('should return 403 when CSRF token is invalid', async () => {
      const router = createLoginRouter(testPassword);
      app.use(router);

      // Get CSRF cookie but use wrong token in form
      const loginPage = await request(app).get('/admin/login');
      const csrfCookie = loginPage.headers['set-cookie'].find(c => c.startsWith('csrf_token='));

      const response = await request(app)
        .post('/admin/login')
        .set('Cookie', csrfCookie)
        .send({ password: testPassword, csrf_token: 'invalid-token' })
        .expect(403);

      expect(response.text).toContain('Invalid request');
    });

    it('should return 429 after rate limit exceeded', async () => {
      const router = createLoginRouter(testPassword, {
        maxAttempts: 3,
        windowMs: 60000,
      });
      app.use(router);

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const loginPage = await request(app).get('/admin/login');
        const csrfMatch = loginPage.text.match(/name="csrf_token" value="([^"]+)"/);
        const csrfToken = csrfMatch[1];
        const csrfCookie = loginPage.headers['set-cookie'].find(c => c.startsWith('csrf_token='));

        await request(app)
          .post('/admin/login')
          .set('Cookie', csrfCookie)
          .send({ password: 'wrong', csrf_token: csrfToken });
      }

      // Fourth attempt should be rate limited
      const loginPage = await request(app).get('/admin/login');
      const csrfMatch = loginPage.text.match(/name="csrf_token" value="([^"]+)"/);
      const csrfToken = csrfMatch[1];
      const csrfCookie = loginPage.headers['set-cookie'].find(c => c.startsWith('csrf_token='));

      const response = await request(app)
        .post('/admin/login')
        .set('Cookie', csrfCookie)
        .send({ password: 'wrong', csrf_token: csrfToken })
        .expect(429);

      expect(response.text).toContain('Too many');
    });
  });

  describe('POST /admin/logout', () => {
    it('should clear session cookie and redirect to login', async () => {
      const router = createLoginRouter(testPassword);
      app.use(router);

      const response = await request(app)
        .post('/admin/logout')
        .expect(302);

      // Check redirect to login page
      expect(response.headers.location).toBe('/admin/login');

      // Check that session cookie is cleared
      const clearCookie = response.headers['set-cookie'].find(c => c.includes('admin_session='));
      expect(clearCookie).toBeDefined();
      expect(clearCookie).toContain('Max-Age=0');
    });
  });
});
