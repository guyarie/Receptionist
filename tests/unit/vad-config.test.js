'use strict';

/**
 * Unit tests for VAD configuration loading in src/config.js
 *
 * These tests verify that:
 *  - The config.realtime.vad structure is correctly shaped
 *  - Default values are applied when env vars are absent
 *  - Custom values are parsed correctly from env vars
 *  - Invalid env var values fall back to defaults
 *  - The VAD config object is correctly shaped for openai-adapter.js consumption
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store original env so we can restore it after each test
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Clear module cache before each test
  vi.resetModules();
  // Unmock everything
  vi.restoreAllMocks();
});

afterEach(() => {
  // Restore original environment after every test
  process.env = { ...ORIGINAL_ENV };
  // Reset module registry
  vi.resetModules();
  vi.restoreAllMocks();
});

/**
 * Load config with specific environment variables.
 * Uses vi.stubEnv to set environment variables before loading the module.
 *
 * @param {Record<string, string|undefined>} overrides - env var overrides
 * @returns {object} loaded config module
 */
async function loadConfig(overrides = {}) {
  // Stub required environment variables
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'ACtest');
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'authtest');
  vi.stubEnv('OPENROUTER_API_KEY', 'ortest');
  
  // Stub override environment variables
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      vi.unstubEnv(key);
    } else {
      vi.stubEnv(key, value);
    }
  }

  // Suppress the OpenAI key warning during tests
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Dynamically import to get fresh module with stubbed env
  const config = await import('../../src/config.js?t=' + Date.now());

  warnSpy.mockRestore();

  return config.default || config;
}

// ── Structure ────────────────────────────────────────────────────────────────

describe('config.realtime.vad structure', () => {
  it('exposes a vad object nested under realtime', async () => {
    const config = await loadConfig();
    expect(config.realtime).toBeDefined();
    expect(config.realtime.vad).toBeDefined();
    expect(typeof config.realtime.vad).toBe('object');
  });

  it('vad object contains exactly the three expected keys', async () => {
    const config = await loadConfig();
    const vadKeys = Object.keys(config.realtime.vad).sort();
    expect(vadKeys).toEqual(
      ['minSpeechDurationMs', 'prefixPaddingMs', 'silenceDurationMs'].sort()
    );
  });
});

// ── Defaults ─────────────────────────────────────────────────────────────────

describe('default values (no env vars set)', () => {
  it('silenceDurationMs defaults to 600', async () => {
    const config = await loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: undefined });
    expect(config.realtime.vad.silenceDurationMs).toBe(600);
  });

  it('minSpeechDurationMs defaults to 300', async () => {
    const config = await loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: undefined });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(300);
  });

  it('prefixPaddingMs defaults to 300', async () => {
    const config = await loadConfig({ OPENAI_VAD_PREFIX_PADDING_MS: undefined });
    expect(config.realtime.vad.prefixPaddingMs).toBe(300);
  });

  it('all three default to correct values simultaneously', async () => {
    const config = await loadConfig({
      OPENAI_VAD_SILENCE_DURATION_MS: undefined,
      OPENAI_VAD_MIN_SPEECH_DURATION_MS: undefined,
      OPENAI_VAD_PREFIX_PADDING_MS: undefined
    });
    expect(config.realtime.vad).toEqual({
      silenceDurationMs: 600,
      minSpeechDurationMs: 300,
      prefixPaddingMs: 300
    });
  });
});

// ── Custom env var values ─────────────────────────────────────────────────────

describe('custom values from environment variables', () => {
  it('silenceDurationMs is parsed from OPENAI_VAD_SILENCE_DURATION_MS', async () => {
    const config = await loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: '800' });
    expect(config.realtime.vad.silenceDurationMs).toBe(800);
  });

  it('minSpeechDurationMs is parsed from OPENAI_VAD_MIN_SPEECH_DURATION_MS', async () => {
    const config = await loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: '500' });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(500);
  });

  it('prefixPaddingMs is parsed from OPENAI_VAD_PREFIX_PADDING_MS', async () => {
    const config = await loadConfig({ OPENAI_VAD_PREFIX_PADDING_MS: '150' });
    expect(config.realtime.vad.prefixPaddingMs).toBe(150);
  });

  it('all three are parsed correctly when all env vars are set', async () => {
    const config = await loadConfig({
      OPENAI_VAD_SILENCE_DURATION_MS: '1000',
      OPENAI_VAD_MIN_SPEECH_DURATION_MS: '400',
      OPENAI_VAD_PREFIX_PADDING_MS: '200'
    });
    expect(config.realtime.vad).toEqual({
      silenceDurationMs: 1000,
      minSpeechDurationMs: 400,
      prefixPaddingMs: 200
    });
  });

  it('values are numbers not strings', async () => {
    const config = await loadConfig({
      OPENAI_VAD_SILENCE_DURATION_MS: '999',
      OPENAI_VAD_MIN_SPEECH_DURATION_MS: '111',
      OPENAI_VAD_PREFIX_PADDING_MS: '222'
    });
    expect(typeof config.realtime.vad.silenceDurationMs).toBe('number');
    expect(typeof config.realtime.vad.minSpeechDurationMs).toBe('number');
    expect(typeof config.realtime.vad.prefixPaddingMs).toBe('number');
  });
});

// ── Invalid / malformed env var values ───────────────────────────────────────

describe('invalid environment variable values fall back to defaults', () => {
  it('falls back to 600 for silenceDurationMs when value is non-numeric', async () => {
    const config = await loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: 'abc' });
    expect(config.realtime.vad.silenceDurationMs).toBe(600);
  });

  it('falls back to 300 for minSpeechDurationMs when value is non-numeric', async () => {
    const config = await loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: 'not-a-number' });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(300);
  });

  it('falls back to 300 for prefixPaddingMs when value is an empty string', async () => {
    const config = await loadConfig({ OPENAI_VAD_PREFIX_PADDING_MS: '' });
    expect(config.realtime.vad.prefixPaddingMs).toBe(300);
  });

  it('falls back to 300 for minSpeechDurationMs when value is whitespace-only', async () => {
    const config = await loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: '   ' });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(300);
  });

  it('falls back to all defaults when all values are invalid', async () => {
    const config = await loadConfig({
      OPENAI_VAD_SILENCE_DURATION_MS: 'bad',
      OPENAI_VAD_MIN_SPEECH_DURATION_MS: 'bad',
      OPENAI_VAD_PREFIX_PADDING_MS: 'bad'
    });
    expect(config.realtime.vad).toEqual({
      silenceDurationMs: 600,
      minSpeechDurationMs: 300,
      prefixPaddingMs: 300
    });
  });

  it('truncates float string to integer (parseInt behavior)', async () => {
    const config = await loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: '750.9' });
    // parseInt('750.9', 10) === 750
    expect(config.realtime.vad.silenceDurationMs).toBe(750);
  });
});

// ── Shape validation for openai-adapter.js consumption ───────────────────────

describe('VAD config object is correctly shaped for openai-adapter.js', () => {
  it('produces a valid turn_detection payload with custom values', async () => {
    const config = await loadConfig({
      OPENAI_VAD_SILENCE_DURATION_MS: '700',
      OPENAI_VAD_MIN_SPEECH_DURATION_MS: '350',
      OPENAI_VAD_PREFIX_PADDING_MS: '250'
    });

    const { silenceDurationMs, minSpeechDurationMs, prefixPaddingMs } = config.realtime.vad;

    // Simulate what openai-adapter.js does when building the session.update payload
    const turnDetection = {
      type: 'server_vad',
      silence_duration_ms: silenceDurationMs,
      min_speech_duration_ms: minSpeechDurationMs,
      prefix_padding_ms: prefixPaddingMs
    };

    expect(turnDetection).toEqual({
      type: 'server_vad',
      silence_duration_ms: 700,
      min_speech_duration_ms: 350,
      prefix_padding_ms: 250
    });
  });

  it('produces a valid turn_detection payload with default values', async () => {
    const config = await loadConfig({
      OPENAI_VAD_SILENCE_DURATION_MS: undefined,
      OPENAI_VAD_MIN_SPEECH_DURATION_MS: undefined,
      OPENAI_VAD_PREFIX_PADDING_MS: undefined
    });

    const { silenceDurationMs, minSpeechDurationMs, prefixPaddingMs } = config.realtime.vad;

    const turnDetection = {
      type: 'server_vad',
      silence_duration_ms: silenceDurationMs,
      min_speech_duration_ms: minSpeechDurationMs,
      prefix_padding_ms: prefixPaddingMs
    };

    expect(turnDetection).toEqual({
      type: 'server_vad',
      silence_duration_ms: 600,
      min_speech_duration_ms: 300,
      prefix_padding_ms: 300
    });
  });
});
