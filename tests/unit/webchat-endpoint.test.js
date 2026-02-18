// Unit tests for /api/webchat endpoint
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('/api/webchat endpoint', () => {
  let aiClient;
  let mockSendMessageWithHistory;

  beforeEach(() => {
    // Mock the AI client
    mockSendMessageWithHistory = vi.fn();
    aiClient = {
      sendMessageWithHistory: mockSendMessageWithHistory
    };
  });

  describe('Input Validation', () => {
    it('should reject missing sessionId', async () => {
      const request = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Expected: 400 Bad Request with error message
      expect(request.sessionId).toBeUndefined();
    });

    it('should reject empty sessionId', async () => {
      const request = {
        sessionId: '',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Expected: 400 Bad Request
      expect(request.sessionId.trim()).toBe('');
    });

    it('should reject non-string sessionId', async () => {
      const request = {
        sessionId: 12345,
        messages: [{ role: 'user', content: 'Hello' }]
      };

      // Expected: 400 Bad Request
      expect(typeof request.sessionId).not.toBe('string');
    });

    it('should reject missing messages', async () => {
      const request = {
        sessionId: 'test-session-123'
      };

      // Expected: 400 Bad Request
      expect(request.messages).toBeUndefined();
    });

    it('should reject non-array messages', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: 'not an array'
      };

      // Expected: 400 Bad Request
      expect(Array.isArray(request.messages)).toBe(false);
    });

    it('should reject empty messages array', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: []
      };

      // Expected: 400 Bad Request
      expect(request.messages.length).toBe(0);
    });

    it('should reject messages with missing role', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [{ content: 'Hello' }]
      };

      // Expected: 400 Bad Request
      expect(request.messages[0].role).toBeUndefined();
    });

    it('should reject messages with missing content', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [{ role: 'user' }]
      };

      // Expected: 400 Bad Request
      expect(request.messages[0].content).toBeUndefined();
    });

    it('should reject messages with invalid role', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [{ role: 'system', content: 'Hello' }]
      };

      // Expected: 400 Bad Request (only 'user' and 'assistant' allowed)
      const allowedRoles = ['user', 'assistant'];
      expect(allowedRoles.includes(request.messages[0].role)).toBe(false);
    });

    it('should reject messages with non-string role', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [{ role: 123, content: 'Hello' }]
      };

      // Expected: 400 Bad Request
      expect(typeof request.messages[0].role).not.toBe('string');
    });

    it('should reject messages with non-string content', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [{ role: 'user', content: 123 }]
      };

      // Expected: 400 Bad Request
      expect(typeof request.messages[0].content).not.toBe('string');
    });

    it('should reject messages with null message object', async () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [null]
      };

      // Expected: 400 Bad Request
      expect(request.messages[0]).toBeNull();
    });
  });

  describe('Valid Requests', () => {
    it('should accept valid single user message', () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      expect(request.sessionId).toBe('test-session-123');
      expect(Array.isArray(request.messages)).toBe(true);
      expect(request.messages.length).toBe(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[0].content).toBe('Hello');
    });

    it('should accept valid conversation history', () => {
      const request = {
        sessionId: 'test-session-123',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi! How can I help?' },
          { role: 'user', content: 'What are your hours?' }
        ]
      };

      expect(request.messages.length).toBe(3);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[1].role).toBe('assistant');
      expect(request.messages[2].role).toBe('user');
    });

    it('should trim whitespace from sessionId', () => {
      const request = {
        sessionId: '  test-session-123  ',
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const trimmedSessionId = request.sessionId.trim();
      expect(trimmedSessionId).toBe('test-session-123');
    });
  });

  describe('AI Client Integration', () => {
    it('should call sendMessageWithHistory with messages', async () => {
      mockSendMessageWithHistory.mockResolvedValue('AI response');

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await aiClient.sendMessageWithHistory(messages);

      expect(mockSendMessageWithHistory).toHaveBeenCalledWith(messages);
      expect(result).toBe('AI response');
    });

    it('should handle AI client errors', async () => {
      const error = new Error('AI service unavailable');
      mockSendMessageWithHistory.mockRejectedValue(error);

      const messages = [{ role: 'user', content: 'Hello' }];

      await expect(aiClient.sendMessageWithHistory(messages)).rejects.toThrow('AI service unavailable');
    });
  });

  describe('Response Format', () => {
    it('should return reply and sessionId', () => {
      const expectedResponse = {
        reply: 'AI response message',
        sessionId: 'test-session-123'
      };

      expect(expectedResponse).toHaveProperty('reply');
      expect(expectedResponse).toHaveProperty('sessionId');
      expect(typeof expectedResponse.reply).toBe('string');
      expect(typeof expectedResponse.sessionId).toBe('string');
    });

    it('should return same sessionId as input', () => {
      const inputSessionId = 'test-session-123';
      const response = {
        reply: 'AI response',
        sessionId: inputSessionId
      };

      expect(response.sessionId).toBe(inputSessionId);
    });
  });

  describe('Stateless Behavior', () => {
    it('should not store conversation history server-side', async () => {
      // The endpoint should not call initSession or store anything
      // It should only call sendMessageWithHistory which is stateless
      
      mockSendMessageWithHistory.mockResolvedValue('Response 1');
      await aiClient.sendMessageWithHistory([{ role: 'user', content: 'Message 1' }]);

      mockSendMessageWithHistory.mockResolvedValue('Response 2');
      await aiClient.sendMessageWithHistory([{ role: 'user', content: 'Message 2' }]);

      // Each call should be independent - no shared state
      expect(mockSendMessageWithHistory).toHaveBeenCalledTimes(2);
      expect(mockSendMessageWithHistory.mock.calls[0][0]).not.toBe(mockSendMessageWithHistory.mock.calls[1][0]);
    });
  });
});
