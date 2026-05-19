#!/usr/bin/env node
// Meta Admin Server
// Standalone web UI for managing all Receptionist installs on this machine.
// Start with: node meta-admin.js
// Or via PM2: node manage.js meta-admin start

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const {
  comparePasswords,
  signSessionToken,
  verifySessionToken,
  generateCsrfToken,
  validateCsrfToken,
  createRateLimiter,
} = require('./src/admin-auth');
const { runMetaAdminTurn, getInstallsStatus } = require('./src/agents/meta-admin-agent');

// ─── Config ───────────────────────────────────────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m && process.env[m[1].trim()] === undefined) {
      process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
    }
  }
}

loadEnvFile(path.join(__dirname, 'installs', '_defaults.env'));
loadEnvFile(path.join(__dirname, '.meta-admin.env'));

const PORT = parseInt(process.env.META_ADMIN_PORT || '3099', 10);
const PASSWORD = process.env.META_ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.META_ADMIN_SESSION_SECRET || PASSWORD || 'meta-admin-no-secret';
const COOKIE_NAME = 'meta_admin_session';

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public', 'meta-admin')));

// ─── Auth helpers ─────────────────────────────────────────────────────────────

const rateLimiter = createRateLimiter(5, 15 * 60 * 1000);

function isAuthenticated(req) {
  if (!PASSWORD) return true;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || !verifySessionToken(token, SESSION_SECRET)) return false;
  const age = (Date.now() - parseInt(token.split('.')[0], 16)) / 1000;
  return age < 86400;
}

function loginHtml(csrfToken, error = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meta Admin — Login</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f7f8fa;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border-radius:12px;box-shadow:0 2px 16px rgba(0,0,0,.1);padding:2.5rem;width:100%;max-width:360px}
    h1{font-size:1.25rem;font-weight:700;margin-bottom:.25rem;color:#1a1d23}
    .sub{font-size:.8125rem;color:#6b7280;margin-bottom:1.5rem}
    label{display:block;font-size:.875rem;font-weight:500;color:#374151;margin-bottom:.375rem}
    input{width:100%;padding:.625rem .875rem;border:1px solid #d1d5db;border-radius:8px;font-size:.9375rem;outline:none;transition:border-color .15s}
    input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.1)}
    button{width:100%;margin-top:1rem;padding:.625rem;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:.9375rem;font-weight:500;cursor:pointer}
    button:hover{background:#4338ca}
    .err{margin-bottom:1rem;padding:.75rem;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font-size:.875rem}
  </style>
</head>
<body>
  <div class="card">
    <h1>Meta Admin</h1>
    <p class="sub">AI Receptionist — Install Manager</p>
    ${error ? '<div class="err">Invalid password. Please try again.</div>' : ''}
    <form method="POST" action="/login">
      <input type="hidden" name="csrf_token" value="${csrfToken}">
      <label for="pw">Password</label>
      <input type="password" id="pw" name="password" autofocus required>
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`;
}

// ─── Login / logout routes ────────────────────────────────────────────────────

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  const { token, cookie } = generateCsrfToken();
  // generateCsrfToken hardcodes Path=/admin/login — fix it for our paths
  res.setHeader('Set-Cookie', cookie.replace('/admin/login', '/login'));
  res.send(loginHtml(token));
});

app.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (rateLimiter.check(ip)) return res.status(429).send('Too many attempts. Try again later.');
  if (!validateCsrfToken(req)) return res.status(403).send('Invalid request.');

  const submitted = req.body?.password || '';
  if (!PASSWORD || !comparePasswords(submitted, PASSWORD)) {
    rateLimiter.record(ip);
    const { token, cookie } = generateCsrfToken();
    res.setHeader('Set-Cookie', cookie.replace('/admin/login', '/login'));
    return res.send(loginHtml(token, true));
  }

  const sessionToken = signSessionToken(SESSION_SECRET);
  const secure = (req.secure || req.headers['x-forwarded-proto'] === 'https') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${sessionToken}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure}`);
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.redirect('/login');
});

// ─── Auth gate (all routes below require login) ───────────────────────────────

app.use((req, res, next) => {
  if (req.path === '/login') return next();
  if (!isAuthenticated(req)) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
    return res.redirect('/login');
  }
  next();
});

// ─── API: install status ──────────────────────────────────────────────────────

app.get('/api/installs', async (req, res) => {
  try {
    res.json(await getInstallsStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: chat (SSE streaming) ────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message required' });
  }

  const sid = (sessionId || 'default').slice(0, 64);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, data = {}) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const reply = await runMetaAdminTurn(sid, message, send);
    if (reply) send('message', { content: reply });
  } catch (err) {
    console.error('Meta admin agent error:', err);
    send('error', { message: err.message || 'An error occurred' });
  }

  send('done');
  res.end();
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Meta Admin running at http://localhost:${PORT}`);
  if (!PASSWORD) {
    console.warn('Warning: META_ADMIN_PASSWORD not set — no authentication required');
  }
});
