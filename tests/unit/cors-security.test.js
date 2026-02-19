// CORS security tests - ensure error messages don't leak server details
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cors from 'cors';
import request from 'supertest';

describe('CORS Security', () => {
  let app;
  let server;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Simulate production CORS configuration
    const allowedOrigin = 'https://example.com';
    
    const webchatCorsOptions = {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigin) {
          if (origin === allowedOrigin) {
            return callback(null, true);
          }
          // Log server-side but don't leak to client
          console.warn(`🚫 CORS blocked request from origin: ${origin}`);
          return callback(new Error('CORS policy: origin not allowed'));
        }

        if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }

        console.warn(`🚫 CORS blocked request from origin: ${origin}`);
        return callback(new Error('CORS policy: origin not allowed'));
      },
      methods: ['POST'],
      allowedHeaders: ['Content-Type']
    };

    // Test endpoint with CORS
    app.post('/api/webchat', cors(webchatCorsOptions), (req, res) => {
      res.json({ reply: 'test response', sessionId: 'test-123' });
    });

    server = app.listen(0);
  });

  afterAll(() => {
    server.close();
  });

  describe('CORS Error Messages', () => {
    it('should not leak origin in error message when blocked', async () => {
      const maliciousOrigin = 'https://evil.com';
      
      const response = await request(app)
        .post('/api/webchat')
        .set('Origin', maliciousOrigin)
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      // Should be blocked
      expect(response.status).toBe(500); // CORS errors come through as 500 from cors middleware

      // Error message should NOT contain the origin
      const responseText = response.text.toLowerCase();
      expect(responseText).not.toContain('evil.com');
      expect(responseText).not.toContain(maliciousOrigin);
      
      // Should contain generic message
      expect(responseText).toContain('cors');
    });

    it('should not leak origin in error for non-localhost development origin', async () => {
      const testOrigin = 'https://attacker-dev.local:3000';
      
      const response = await request(app)
        .post('/api/webchat')
        .set('Origin', testOrigin)
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(500);
      
      const responseText = response.text.toLowerCase();
      expect(responseText).not.toContain('attacker-dev.local');
      expect(responseText).not.toContain(testOrigin);
    });

    it('should allow configured origin', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .set('Origin', 'https://example.com')
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(200);
      expect(response.body.reply).toBe('test response');
    });

    it('should allow requests with no origin', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(200);
      expect(response.body.reply).toBe('test response');
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers for allowed origin', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .set('Origin', 'https://example.com')
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.headers['access-control-allow-origin']).toBe('https://example.com');
    });

    it('should not include CORS headers for blocked origin', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .set('Origin', 'https://evil.com')
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
