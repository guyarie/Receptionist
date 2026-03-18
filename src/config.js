// Configuration loader
require('dotenv').config();

function validateConfig() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'OPENROUTER_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env file');
    process.exit(1);
  }
}

/**
 * Parse an integer environment variable, returning a default if absent or invalid.
 * @param {string} key - Environment variable name
 * @param {number} defaultValue - Fallback value
 * @returns {number}
 */
function parseIntEnv(key, defaultValue) {
  const raw = process.env[key];
  if (raw === undefined || raw === null || raw.trim() === '') return defaultValue;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || null,
    realtimeVoice: process.env.OPENAI_REALTIME_VOICE || 'alloy'
  },
  realtime: {
    provider: process.env.REALTIME_AI_PROVIDER || 'openai',
    vad: {
      // Milliseconds of silence before the turn is considered complete.
      // Lower values make the assistant respond faster but may cut off slow speakers.
      silenceDurationMs: parseIntEnv('OPENAI_VAD_SILENCE_DURATION_MS', 600),
      // Minimum duration of speech (ms) required to be considered valid speech.
      minSpeechDurationMs: parseIntEnv('OPENAI_VAD_MIN_SPEECH_DURATION_MS', 300),
      // Audio padding (ms) prepended to detected speech to avoid clipping the start.
      prefixPaddingMs: parseIntEnv('OPENAI_VAD_PREFIX_PADDING_MS', 300)
    }
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    sslCert: process.env.SSL_CERT_PATH || null,
    sslKey: process.env.SSL_KEY_PATH || null,
    adminAllowedIps: process.env.ADMIN_ALLOWED_IPS 
      ? process.env.ADMIN_ALLOWED_IPS.split(',').map(ip => ip.trim()).filter(ip => ip)
      : []
  },
  admin: {
    password: process.env.ADMIN_PASSWORD || null,
    sessionSecret: process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || null
  },
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: process.env.SMTP_PORT || null,
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || null,
  },
  adminEmail: process.env.ADMIN_EMAIL || null,
  digestEnabled: (process.env.DIGEST_ENABLED || 'false').toLowerCase() === 'true',
  digestScheduleHour: parseInt(process.env.DIGEST_SCHEDULE_HOUR || '18', 10),
  postCallAgentMode: (process.env.POST_CALL_AGENT_MODE || 'active').toLowerCase(),
};

// Validate on load
validateConfig();

// Warn if OpenAI API key is not set (realtime voice streaming will be unavailable)
if (!config.openai.apiKey) {
  console.warn('⚠️ OPENAI_API_KEY not set — real-time voice streaming unavailable, using Gather fallback');
}

// Warn if admin password is not set (admin panel will be unprotected)
if (!config.admin.password || config.admin.password.trim() === '') {
  console.warn('⚠️ ADMIN_PASSWORD not set or empty — admin panel is unprotected and accessible without authentication');
}

module.exports = config;
