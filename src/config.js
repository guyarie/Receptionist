// Configuration loader
const path = require('path');
// paths.js must be required before dotenv so INSTALL_DIR is resolved first
const { repoRoot, envFile } = require('./paths');

// Layer 1: repo defaults (checked in, no secrets)
require('dotenv').config({ path: path.join(repoRoot, 'config', 'defaults.env') });
// Layer 2: shared API keys for all installs — installs/_defaults.env (gitignored)
require('dotenv').config({ path: path.join(repoRoot, 'installs', '_defaults.env') });
// Layer 3: per-install config — installs/<name>/.env
require('dotenv').config({ path: envFile, override: true });

function validateConfig() {
  const required = [
    'OPENROUTER_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    // In setup mode the server starts with missing config so the setup agent
    // can guide the user through entering it. Outside setup mode, exit.
    if (process.env.SETUP_MODE === 'true') {
      console.warn('⚠️  Missing required environment variables (setup mode):', missing.join(', '));
      console.warn('   Visit /setup to configure your receptionist.');
    } else {
      console.error('❌ Missing required environment variables:', missing.join(', '));
      console.error('Please check your .env file or run the setup assistant at /setup');
      process.exit(1);
    }
  }
}

/**
 * Parse an integer from an env-like object, returning a default if absent or invalid.
 * @param {object} env - Environment object (e.g. process.env)
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Fallback value
 * @returns {number}
 */
function parseIntEnvFrom(env, key, defaultValue) {
  const raw = env[key];
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Build the config object from a given environment.
 * Exported as _buildConfig for unit tests that need to pass custom env values
 * without relying on dotenv loading or process.env manipulation.
 * @param {object} env - Environment object
 * @returns {object} config
 */
function buildConfig(env) {
  return {
    twilio: {
      phoneNumber: env.TWILIO_PHONE_NUMBER,
      accountSid: env.TWILIO_ACCOUNT_SID || null,
      authToken: env.TWILIO_AUTH_TOKEN || null,
    },
    openRouter: {
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || 'openai/gpt-4'
    },
    openai: {
      apiKey: env.OPENAI_API_KEY || null,
      realtimeVoice: env.OPENAI_REALTIME_VOICE || 'alloy'
    },
    realtime: {
      provider: env.REALTIME_AI_PROVIDER || 'openai',
      vad: {
        silenceDurationMs: parseIntEnvFrom(env, 'OPENAI_VAD_SILENCE_DURATION_MS', 600),
        minSpeechDurationMs: parseIntEnvFrom(env, 'OPENAI_VAD_MIN_SPEECH_DURATION_MS', 300),
        prefixPaddingMs: parseIntEnvFrom(env, 'OPENAI_VAD_PREFIX_PADDING_MS', 300)
      }
    },
    server: {
      port: parseInt(env.PORT || '3000', 10),
      setupPort: parseInt(env.SETUP_PORT || '3001', 10),
      sslCert: env.SSL_CERT_PATH || null,
      sslKey: env.SSL_KEY_PATH || null,
      adminAllowedIps: env.ADMIN_ALLOWED_IPS
        ? env.ADMIN_ALLOWED_IPS.split(',').map(ip => ip.trim()).filter(ip => ip)
        : []
    },
    admin: {
      password: env.ADMIN_PASSWORD || null,
      sessionSecret: env.SESSION_SECRET || env.ADMIN_PASSWORD || null
    },
    smtp: {
      host: env.SMTP_HOST || null,
      port: env.SMTP_PORT || null,
      user: env.SMTP_USER || null,
      pass: env.SMTP_PASS || null,
      from: env.SMTP_FROM || null,
    },
    business: {
      name: env.BUSINESS_NAME || 'Your Business',
      ownerName: env.OWNER_NAME || 'the owner',
      receptionistName: env.RECEPTIONIST_NAME || 'the AI receptionist',
      ownerPhone: env.OWNER_PHONE || null,
      publicUrl: env.PUBLIC_URL || null,
    },
    goodbyePhrases: (env.GOODBYE_PHRASES || 'goodbye,have a great day,take care,bye')
      .split(',').map(p => p.trim()).filter(p => p),
    adminEmail: env.ADMIN_EMAIL || null,
    digestEnabled: (env.DIGEST_ENABLED || 'false').toLowerCase() === 'true',
    digestScheduleHour: parseInt(env.DIGEST_SCHEDULE_HOUR || '18', 10),
    postCallAgentMode: (env.POST_CALL_AGENT_MODE || 'active').toLowerCase(),
    timezone: env.TIMEZONE || 'America/Los_Angeles',
  };
}

// Validate on load
validateConfig();

const config = buildConfig(process.env);

// Warn if OpenAI API key is not set (realtime voice streaming will be unavailable)
if (!config.openai.apiKey) {
  console.warn('⚠️ OPENAI_API_KEY not set — real-time voice streaming unavailable, using Gather fallback');
}

// Warn if admin password is not set (admin panel will be unprotected)
if (!config.admin.password || config.admin.password.trim() === '') {
  console.warn('⚠️ ADMIN_PASSWORD not set or empty — admin panel is unprotected and accessible without authentication');
}

module.exports = config;
module.exports._buildConfig = buildConfig;
