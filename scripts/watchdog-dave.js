#!/usr/bin/env node
// Pings dave and checks error log for new errors since last run.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'installs', 'dave', '.env') });

const URL = 'https://dave.phone.16jets.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_TO = process.env.WATCHDOG_ALERT_TO || 'arieguy@gmail.com';
const ALERT_FROM = '16jets watchdog <onboarding@resend.dev>';
const ERROR_LOG = '/home/guyarie/.pm2/logs/receptionist-dave-error.log';
const STATE_FILE = '/home/guyarie/.pm2/logs/watchdog-dave.state';

if (!RESEND_API_KEY) {
  console.error('[watchdog] RESEND_API_KEY not set in installs/dave/.env — cannot send alerts');
  process.exit(1);
}

async function ping() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 404) {
      await sendAlert(`dave returned HTTP ${res.status}`, []);
    }
  } catch (err) {
    clearTimeout(timeout);
    await sendAlert(`dave unreachable: ${err.message}`, []);
  }
}

function checkErrors() {
  if (!fs.existsSync(ERROR_LOG)) return;

  const logSize = fs.statSync(ERROR_LOG).size;
  let lastSize = 0;
  if (fs.existsSync(STATE_FILE)) {
    lastSize = parseInt(fs.readFileSync(STATE_FILE, 'utf8').trim(), 10) || 0;
  }
  fs.writeFileSync(STATE_FILE, String(logSize));

  if (logSize <= lastSize) return;

  // Read only the new bytes since last check
  const fd = fs.openSync(ERROR_LOG, 'r');
  const buf = Buffer.alloc(logSize - lastSize);
  fs.readSync(fd, buf, 0, buf.length, lastSize);
  fs.closeSync(fd);

  const newLines = buf.toString('utf8').split('\n').filter(l => l.includes('❌'));
  if (newLines.length > 0) {
    sendAlert(`${newLines.length} new error(s) in dave's log`, newLines);
  }
}

async function sendAlert(reason, lines) {
  console.error(`[watchdog] ALERT: ${reason}`);
  const body = [
    `Watchdog alert: ${reason}`,
    `\nCheck: ${URL}`,
    `Time: ${new Date().toISOString()}`,
    lines.length > 0 ? `\n--- Errors ---\n${lines.join('\n')}` : '',
  ].join('\n');

  const subject = lines.length > 0 ? `⚠️ dave: ${lines.length} new error(s)` : `⚠️ dave receptionist is down`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: ALERT_FROM, to: ALERT_TO, subject, text: body }),
  });
}

ping();
checkErrors();
