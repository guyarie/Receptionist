'use strict';

/**
 * Unit tests for goodbye-phrase detection in OpenAIAdapter.
 *
 * Covers:
 *  - goodbyeCallback is fired when transcript contains a default goodbye phrase
 *  - goodbyeCallback is NOT fired on a partial match (word-boundary enforcement)
 *  - goodbyeCallback is NOT fired when it is not set
 *  - Detection is case-insensitive
 *  - Custom phrase lists work correctly
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('ws', () => {
  const MockWS = vi.fn();
  MockWS.OPEN = 1;
  return { default: MockWS };
});

vi.mock('../../src/config.js', () => ({
  default: {
    goodbyePhrases: ['goodbye', 'have a great day', 'take care', 'bye'],
    realtime: { vad: { silenceDurationMs: 600, minSpeechDurationMs: 300, prefixPaddingMs: 300 } },
    openai: { realtimeVoice: 'alloy' },
  }
}));

import OpenAIAdapter from '../../src/realtime/openai-adapter.js';

function makeAdapter() {
  return new OpenAIAdapter('fake-api-key', 'alloy');
}

// ── _containsGoodbye — default phrases ───────────────────────────────────────

describe('_containsGoodbye — default phrases', () => {
  it('detects "goodbye" as a standalone word', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('Well, goodbye!')).toBe(true);
  });

  it('detects "have a great day"', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('Thanks for calling, have a great day!')).toBe(true);
  });

  it('detects "take care"', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('Take care and stay safe.')).toBe(true);
  });

  it('detects "bye"', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('Okay, bye!')).toBe(true);
  });

  it('is case-insensitive', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('GOODBYE!')).toBe(true);
    expect(adapter._containsGoodbye('Bye')).toBe(true);
  });

  it('returns false for a transcript with no goodbye phrase', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('How can I help you today?')).toBe(false);
  });
});

// ── _containsGoodbye — word-boundary enforcement ──────────────────────────────

describe('_containsGoodbye — word-boundary enforcement (no false positives)', () => {
  it('does NOT match "goodbye" inside a longer word like "goodbyecruel"', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('goodbyecruel world')).toBe(false);
  });

  it('does NOT match "bye" inside "bypass"', () => {
    const adapter = makeAdapter();
    // Pass explicit phrase list to isolate "bye" check
    expect(adapter._containsGoodbye('I will bypass the issue', ['bye'])).toBe(false);
  });

  it('does NOT match "bye" as a substring inside "goodbye" (no boundary before b)', () => {
    const adapter = makeAdapter();
    // "goodbye" — 'b' in 'bye' is preceded by 'd', not a word boundary
    expect(adapter._containsGoodbye('goodbye', ['bye'])).toBe(false);
  });
});

// ── goodbyeCallback wiring ────────────────────────────────────────────────────

describe('goodbyeCallback wiring via _handleMessage', () => {
  it('fires goodbyeCallback when transcript matches a goodbye phrase', () => {
    const adapter = makeAdapter();
    const cb = vi.fn();
    adapter.goodbyeCallback = cb;

    adapter._handleMessage(JSON.stringify({
      type: 'response.audio_transcript.done',
      transcript: 'Thank you for calling! Goodbye!'
    }));

    expect(cb).toHaveBeenCalledOnce();
  });

  it('does NOT fire goodbyeCallback when transcript has no goodbye phrase', () => {
    const adapter = makeAdapter();
    const cb = vi.fn();
    adapter.goodbyeCallback = cb;

    adapter._handleMessage(JSON.stringify({
      type: 'response.audio_transcript.done',
      transcript: 'Let me check on that appointment for you.'
    }));

    expect(cb).not.toHaveBeenCalled();
  });

  it('does NOT throw when goodbyeCallback is not set', () => {
    const adapter = makeAdapter();
    expect(() => {
      adapter._handleMessage(JSON.stringify({
        type: 'response.audio_transcript.done',
        transcript: 'Goodbye!'
      }));
    }).not.toThrow();
  });

  it('does NOT fire goodbyeCallback on a partial match (bypass)', () => {
    const adapter = makeAdapter();
    const cb = vi.fn();
    adapter.goodbyeCallback = cb;

    adapter._handleMessage(JSON.stringify({
      type: 'response.audio_transcript.done',
      transcript: 'I will bypass the issue.'
    }));

    expect(cb).not.toHaveBeenCalled();
  });
});

// ── custom phrase lists ───────────────────────────────────────────────────────

describe('custom phrase list passed directly', () => {
  it('matches a custom phrase', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('see you later, friend!', ['see you later', 'cheerio'])).toBe(true);
    expect(adapter._containsGoodbye('cheerio!', ['see you later', 'cheerio'])).toBe(true);
  });

  it('does not match default phrases when only custom phrases are checked', () => {
    const adapter = makeAdapter();
    expect(adapter._containsGoodbye('goodbye', ['cheerio'])).toBe(false);
  });
});
