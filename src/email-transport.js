// Email transport module — thin wrapper around nodemailer SMTP
// Uses lazy initialization to avoid creating TLS connections at startup,
// which can interfere with OpenAI Realtime WebSocket audio streaming.
const nodemailer = require('nodemailer');

let transporter = null;
let configured = false;
let configChecked = false;
let fromAddress = null;

// Check if SMTP env vars are present (no connection created)
function initialize() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    console.warn('⚠️ SMTP not fully configured — email notifications disabled');
    configured = false;
    configChecked = true;
    return;
  }

  // Mark as configured but don't create the transport yet
  fromAddress = from;
  configured = true;
  configChecked = true;
  console.log('📧 SMTP email transport configured (lazy — connects on first send)');
}

// Create the actual nodemailer transport on demand
function ensureTransport() {
  if (transporter) return true;
  if (!configured) return false;

  try {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log('📧 SMTP transport created (first use)');
    return true;
  } catch (err) {
    console.error('❌ SMTP transport creation failed:', err.message);
    return false;
  }
}

function isConfigured() {
  return configured;
}

async function sendMail({ to, subject, body }) {
  if (!configured) {
    throw new Error('Email transport is not configured');
  }
  if (!ensureTransport()) {
    throw new Error('Failed to create email transport');
  }
  return transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text: body
  });
}

module.exports = { initialize, isConfigured, sendMail };
