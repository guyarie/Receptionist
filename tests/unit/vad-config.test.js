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

import { describe, it, expect } from 'vitest';

// Import _buildConfig directly so we can pass custom env objects without relying on
// process.env manipulation or dotenv loading order.
const { _buildConfig: buildConfig } = await import('../../src/config.js');

/**
 * Build a config from specific VAD env vars.
 * Only the supplied keys are set; all others are absent (triggering defaults).
 */
function loadConfig(overrides = {}) {
  // Provide the minimum required keys so validateConfig-style checks don't trip
  const env = { OPENROUTER_API_KEY: 'test-key', ...overrides };
  return buildConfig(env);
}

// ── Structure ────────────────────────────────────────────────────────────────

describe('config.realtime.vad structure', () => {
  it('exposes a vad object nested under realtime', () => {
    const config = loadConfig();
    expect(config.realtime).toBeDefined();
    expect(config.realtime.vad).toBeDefined();
    expect(typeof config.realtime.vad).toBe('object');
  });

  it('vad object contains exactly the three expected keys', () => {
    const config = loadConfig();
    const vadKeys = Object.keys(config.realtime.vad).sort();
    expect(vadKeys).toEqual(
      ['minSpeechDurationMs', 'prefixPaddingMs', 'silenceDurationMs'].sort()
    );
  });
});

// ── Defaults ─────────────────────────────────────────────────────────────────

describe('default values (no env vars set)', () => {
  it('silenceDurationMs defaults to 600', () => {
    const config = loadConfig();
    expect(config.realtime.vad.silenceDurationMs).toBe(600);
  });

  it('minSpeechDurationMs defaults to 300', () => {
    const config = loadConfig();
    expect(config.realtime.vad.minSpeechDurationMs).toBe(300);
  });

  it('prefixPaddingMs defaults to 300', () => {
    const config = loadConfig();
    expect(config.realtime.vad.prefixPaddingMs).toBe(300);
  });

  it('all three default to correct values simultaneously', () => {
    const config = loadConfig();
    expect(config.realtime.vad).toEqual({
      silenceDurationMs: 600,
      minSpeechDurationMs: 300,
      prefixPaddingMs: 300
    });
  });
});

// ── Custom env var values ─────────────────────────────────────────────────────

describe('custom values from environment variables', () => {
  it('silenceDurationMs is parsed from OPENAI_VAD_SILENCE_DURATION_MS', () => {
    const config = loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: '800' });
    expect(config.realtime.vad.silenceDurationMs).toBe(800);
  });

  it('minSpeechDurationMs is parsed from OPENAI_VAD_MIN_SPEECH_DURATION_MS', () => {
    const config = loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: '500' });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(500);
  });

  it('prefixPaddingMs is parsed from OPENAI_VAD_PREFIX_PADDING_MS', () => {
    const config = loadConfig({ OPENAI_VAD_PREFIX_PADDING_MS: '150' });
    expect(config.realtime.vad.prefixPaddingMs).toBe(150);
  });

  it('all three are parsed correctly when all env vars are set', () => {
    const config = loadConfig({
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

  it('values are numbers not strings', () => {
    const config = loadConfig({
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
  it('falls back to 600 for silenceDurationMs when value is non-numeric', () => {
    const config = loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: 'abc' });
    expect(config.realtime.vad.silenceDurationMs).toBe(600);
  });

  it('falls back to 300 for minSpeechDurationMs when value is non-numeric', () => {
    const config = loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: 'not-a-number' });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(300);
  });

  it('falls back to 300 for prefixPaddingMs when value is an empty string', () => {
    const config = loadConfig({ OPENAI_VAD_PREFIX_PADDING_MS: '' });
    expect(config.realtime.vad.prefixPaddingMs).toBe(300);
  });

  it('falls back to 300 for minSpeechDurationMs when value is whitespace-only', () => {
    const config = loadConfig({ OPENAI_VAD_MIN_SPEECH_DURATION_MS: '   ' });
    expect(config.realtime.vad.minSpeechDurationMs).toBe(300);
  });

  it('falls back to all defaults when all values are invalid', () => {
    const config = loadConfig({
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

  it('truncates float string to integer (parseInt behavior)', () => {
    const config = loadConfig({ OPENAI_VAD_SILENCE_DURATION_MS: '750.9' });
    // parseInt('750.9', 10) === 750
    expect(config.realtime.vad.silenceDurationMs).toBe(750);
  });
});

// ── Shape validation for openai-adapter.js consumption ───────────────────────

describe('VAD config object is correctly shaped for openai-adapter.js', () => {
  it('produces a valid turn_detection payload with custom values', () => {
    const config = loadConfig({
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

  it('produces a valid turn_detection payload with default values', () => {
    const config = loadConfig();

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
