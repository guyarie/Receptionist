// Integration tests for /api/webchat endpoint
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('/api/webchat Integration Tests', () => {
  let app;
  let mockAiClient;

  beforeAll(() => {
    // Create a minimal Express app with the webchat endpoint
    app = express();
    app.use(express.json());

    // Mock AI client
    mockAiClient = {
      sendMessageWithHistory: vi.fn(),
      buildSystemContent: vi.fn().mockReturnValue('System prompt')
    };

    // Add the webchat endpoint (simplified version for testing)
    app.post('/api/webchat', async (req, res) => {
      try {
        const { sessionId, messages } = req.body;

        // Input validation
        if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
          return res.status(400).json({ error: 'Missing or invalid sessionId' });
        }

        if (!Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: 'messages must be a non-empty array' });
        }

        // Validate each message
        for (const msg of messages) {
          if (
            typeof msg !== 'object' ||
            msg === null ||
            typeof msg.role !== 'string' ||
            typeof msg.content !== 'string'
          ) {
            return res.status(400).json({
              error: 'Each message must be an object with string "role" and "content" fields'
            });
          }

          const allowedRoles = ['user', 'assistant'];
          if (!allowedRoles.includes(msg.role)) {
            return res.status(400).json({
              error: `Invalid message role "${msg.role}". Allowed roles: ${allowedRoles.join(', ')}`
            });
          }
        }

        // Call AI client
        const reply = await mockAiClient.sendMessageWithHistory(messages);
        res.json({ reply, sessionId: sessionId.trim() });

      } catch (error) {
        res.status(500).json({ error: 'Failed to process message', details: error.message });
      }
    });
  });

  describe('POST /api/webchat', () => {

    it('should return 400 for missing sessionId', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('sessionId');
    });

    it('should return 400 for empty sessionId', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: '   ',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sessionId');
    });

    it('should return 400 for missing messages', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('messages');
    });

    it('should return 400 for empty messages array', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-123',
          messages: []
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('non-empty array');
    });

    it('should return 400 for invalid message role', async () => {
      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'system', content: 'Hello' }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid message role');
    });

    it('should return 200 with valid request', async () => {
      mockAiClient.sendMessageWithHistory.mockResolvedValue('AI response here');

      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-session-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reply');
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body.reply).toBe('AI response here');
      expect(response.body.sessionId).toBe('test-session-123');
    });

    it('should handle conversation history', async () => {
      mockAiClient.sendMessageWithHistory.mockResolvedValue('We are open Monday-Friday');

      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-session-456',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi! How can I help?' },
            { role: 'user', content: 'What are your hours?' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.reply).toBe('We are open Monday-Friday');
      expect(mockAiClient.sendMessageWithHistory).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'Hello' }),
          expect.objectContaining({ role: 'assistant', content: 'Hi! How can I help?' }),
          expect.objectContaining({ role: 'user', content: 'What are your hours?' })
        ])
      );
    });

    it('should trim whitespace from sessionId', async () => {
      mockAiClient.sendMessageWithHistory.mockResolvedValue('Response');

      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: '  test-123  ',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('test-123');
    });

    it('should return 500 on AI client error', async () => {
      mockAiClient.sendMessageWithHistory.mockRejectedValue(new Error('AI service down'));

      const response = await request(app)
        .post('/api/webchat')
        .send({
          sessionId: 'test-123',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Failed to process message');
    });
  });
});
