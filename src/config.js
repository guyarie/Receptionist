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
    provider: process.env.REALTIME_AI_PROVIDER || 'openai'
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    sslCert: process.env.SSL_CERT_PATH || null,
    sslKey: process.env.SSL_KEY_PATH || null
  }
};

// Validate on load
validateConfig();

// Warn if OpenAI API key is not set (realtime voice streaming will be unavailable)
if (!config.openai.apiKey) {
  console.warn('⚠️ OPENAI_API_KEY not set — real-time voice streaming unavailable, using Gather fallback');
}

module.exports = config;
