// Email transport module — uses Resend HTTP API
// Falls back gracefully if not configured

let configured = false;
let configChecked = false;
let apiKey = null;
let fromAddress = null;

// Check if email env vars are present. Safe to call multiple times —
// re-reads process.env so credentials saved mid-session are picked up.
function initialize() {
  const key = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!key || !from) {
    if (!configChecked) console.warn('⚠️ Email not fully configured — email notifications disabled');
    configured = false;
    configChecked = true;
    return;
  }

  apiKey = key;
  fromAddress = from;
  configured = true;
  configChecked = true;
  console.log('📧 Resend email transport configured (HTTP API)');
}

function isConfigured() {
  return configured;
}

async function sendMail({ to, subject, body, attachments }) {
  if (!configured) {
    throw new Error('Email transport is not configured');
  }

  const payload = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    text: body,
  };

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  console.log(`📧 Email sent via Resend: ${data.id}`);
  return data;
}

module.exports = { initialize, isConfigured, sendMail };
