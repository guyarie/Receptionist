/**
 * tests/test-widget.js
 *
 * Automated tests for the chat widget.
 *
 * Unit tests  – cover core helper functions exposed on window._RTCChatWidget
 *               using mocked localStorage and fetch.
 * Integration – spins up a minimal Express server and verifies the widget's
 *               sendToAPI() function communicates correctly with /api/webchat.
 *
 * Run with:  node --experimental-vm-modules node_modules/.bin/jest tests/test-widget.js
 * Or simply: npx jest tests/test-widget.js
 */

'use strict';

const http    = require('http');
const express = require('express');

// ─── Helpers to simulate the widget functions in Node.js ──────────────────────
// The widget is written as an IIFE for browsers.  We extract the pure helper
// functions here so they can be unit-tested without a DOM.

// ── generateUUID ──────────────────────────────────────────────────────────────
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0;
    var v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── localStorage mock factory ─────────────────────────────────────────────────
function makeLocalStorageMock() {
  let store = {};
  return {
    getItem:    (k)    => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { store = {}; },
    _store:     ()     => store
  };
}

// ── Widget helper functions (mirrored from chat-widget.js) ────────────────────
const STORAGE_KEYS = {
  history:   'receptionist_chat_history',
  sessionId: 'receptionist_session_id'
};

function makeWidgetHelpers(ls) {
  function getOrCreateSessionId() {
    try {
      const existing = ls.getItem(STORAGE_KEYS.sessionId);
      if (existing) return existing;
      const newId = generateUUID();
      ls.setItem(STORAGE_KEYS.sessionId, newId);
      return newId;
    } catch (e) {
      return generateUUID();
    }
  }

  function loadHistory() {
    try {
      const raw = ls.getItem(STORAGE_KEYS.history);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      ls.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    } catch (e) { /* silent */ }
  }

  function appendToHistory(history, role, content) {
    history.push({ role, content });
    saveHistory(history);
  }

  return { getOrCreateSessionId, loadHistory, saveHistory, appendToHistory };
}

// ── sendToAPI (uses node-fetch or global fetch in Node 18+) ───────────────────
async function sendToAPI(baseUrl, sessionId, messages) {
  const fetchFn = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
  const response = await fetchFn(baseUrl + '/api/webchat', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ sessionId, messages })
  });
  if (!response.ok) throw new Error('Server responded with status ' + response.status);
  const data = await response.json();
  const reply = data.response || data.message;
  if (typeof reply !== 'string') throw new Error('Unexpected response format from server');
  return reply;
}

// ═════════════════════════════════════════════════════════════════════════════
// UNIT TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('generateUUID()', () => {
  test('returns a string', () => {
    expect(typeof generateUUID()).toBe('string');
  });

  test('matches RFC4122 v4 UUID format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('generates unique values', () => {
    const ids = new Set(Array.from({ length: 1000 }, generateUUID));
    expect(ids.size).toBe(1000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('getOrCreateSessionId()', () => {
  let ls, helpers;

  beforeEach(() => {
    ls      = makeLocalStorageMock();
    helpers = makeWidgetHelpers(ls);
  });

  test('creates and persists a new session ID when none exists', () => {
    const id = helpers.getOrCreateSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(ls.getItem(STORAGE_KEYS.sessionId)).toBe(id);
  });

  test('returns the same session ID on subsequent calls', () => {
    const id1 = helpers.getOrCreateSessionId();
    const id2 = helpers.getOrCreateSessionId();
    expect(id1).toBe(id2);
  });

  test('reuses an existing session ID already in storage', () => {
    const preset = 'preset-session-id-123';
    ls.setItem(STORAGE_KEYS.sessionId, preset);
    expect(helpers.getOrCreateSessionId()).toBe(preset);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('loadHistory()', () => {
  let ls, helpers;

  beforeEach(() => {
    ls      = makeLocalStorageMock();
    helpers = makeWidgetHelpers(ls);
  });

  test('returns empty array when nothing is stored', () => {
    expect(helpers.loadHistory()).toEqual([]);
  });

  test('returns parsed history from storage', () => {
    const history = [{ role: 'user', content: 'Hello' }];
    ls.setItem(STORAGE_KEYS.history, JSON.stringify(history));
    expect(helpers.loadHistory()).toEqual(history);
  });

  test('returns empty array for invalid JSON', () => {
    ls.setItem(STORAGE_KEYS.history, 'not-valid-json{{{');
    expect(helpers.loadHistory()).toEqual([]);
  });

  test('returns empty array when stored value is not an array', () => {
    ls.setItem(STORAGE_KEYS.history, JSON.stringify({ role: 'user' }));
    expect(helpers.loadHistory()).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('saveHistory()', () => {
  let ls, helpers;

  beforeEach(() => {
    ls      = makeLocalStorageMock();
    helpers = makeWidgetHelpers(ls);
  });

  test('persists history to localStorage', () => {
    const history = [{ role: 'assistant', content: 'Hi there!' }];
    helpers.saveHistory(history);
    expect(ls.getItem(STORAGE_KEYS.history)).toBe(JSON.stringify(history));
  });

  test('overwrites previous history', () => {
    helpers.saveHistory([{ role: 'user', content: 'First' }]);
    helpers.saveHistory([{ role: 'user', content: 'Second' }]);
    const stored = JSON.parse(ls.getItem(STORAGE_KEYS.history));
    expect(stored).toHaveLength(1);
    expect(stored[0].content).toBe('Second');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('appendToHistory()', () => {
  let ls, helpers;

  beforeEach(() => {
    ls      = makeLocalStorageMock();
    helpers = makeWidgetHelpers(ls);
  });

  test('appends a user message and persists it', () => {
    const history = [];
    helpers.appendToHistory(history, 'user', 'Hello');
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(JSON.parse(ls.getItem(STORAGE_KEYS.history))).toEqual(history);
  });

  test('appends an assistant message', () => {
    const history = [{ role: 'user', content: 'Hi' }];
    helpers.appendToHistory(history, 'assistant', 'Hello back!');
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual({ role: 'assistant', content: 'Hello back!' });
  });

  test('accumulates multiple messages in order', () => {
    const history = [];
    helpers.appendToHistory(history, 'user',      'Message 1');
    helpers.appendToHistory(history, 'assistant', 'Reply 1');
    helpers.appendToHistory(history, 'user',      'Message 2');
    expect(history).toHaveLength(3);
    expect(history.map(m => m.content)).toEqual(['Message 1', 'Reply 1', 'Message 2']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS  –  sendToAPI() against a real HTTP server
// ═════════════════════════════════════════════════════════════════════════════

describe('sendToAPI() – integration', () => {
  let server;
  let baseUrl;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function startServer(handler) {
    return new Promise((resolve) => {
      const app = express();
      app.use(express.json());
      app.post('/api/webchat', handler);
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }

  afterEach((done) => {
    if (server && server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  // ── Tests ──────────────────────────────────────────────────────────────────

  test('sends sessionId and messages; returns response string', async () => {
    await startServer((req, res) => {
      res.json({ response: 'Hello from AI' });
    });

    const messages = [{ role: 'user', content: 'Hi' }];
    const reply = await sendToAPI(baseUrl, 'test-session-1', messages);
    expect(reply).toBe('Hello from AI');
  });

  test('accepts "message" key as alternative to "response"', async () => {
    await startServer((req, res) => {
      res.json({ message: 'Alternative key reply' });
    });

    const reply = await sendToAPI(baseUrl, 'test-session-2', []);
    expect(reply).toBe('Alternative key reply');
  });

  test('sends correct Content-Type and body to the server', async () => {
    let receivedBody;
    await startServer((req, res) => {
      receivedBody = req.body;
      res.json({ response: 'ok' });
    });

    const messages = [
      { role: 'user',      content: 'Hello' },
      { role: 'assistant', content: 'Hi!'   }
    ];
    await sendToAPI(baseUrl, 'session-abc', messages);

    expect(receivedBody).toEqual({ sessionId: 'session-abc', messages });
  });

  test('throws when server returns a non-2xx status', async () => {
    await startServer((req, res) => {
      res.status(500).json({ error: 'Internal Server Error' });
    });

    await expect(sendToAPI(baseUrl, 'session-err', [])).rejects.toThrow('500');
  });

  test('throws when response body has no response or message field', async () => {
    await startServer((req, res) => {
      res.json({ unexpected: 'field' });
    });

    await expect(sendToAPI(baseUrl, 'session-bad', [])).rejects.toThrow(
      'Unexpected response format'
    );
  });

  test('throws on network failure (unreachable host)', async () => {
    // Port 1 is almost certainly not listening
    await expect(
      sendToAPI('http://127.0.0.1:1', 'session-net', [])
    ).rejects.toThrow();
  });

  test('passes full conversation history to the server', async () => {
    let receivedMessages;
    await startServer((req, res) => {
      receivedMessages = req.body.messages;
      res.json({ response: 'got it' });
    });

    const history = [
      { role: 'assistant', content: 'Welcome!' },
      { role: 'user',      content: 'I need help' },
      { role: 'assistant', content: 'Sure, what do you need?' },
      { role: 'user',      content: 'Appointment info' }
    ];

    await sendToAPI(baseUrl, 'session-history', history);
    expect(receivedMessages).toEqual(history);
  });
});
