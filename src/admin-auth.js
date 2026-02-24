/**
 * Admin Authentication Module
 * 
 * Provides cryptographic functions for session management and password verification.
 * Uses Node.js crypto module for HMAC-SHA256 signing and constant-time comparisons.
 */

const crypto = require('crypto');

/**
 * Sign a session token using HMAC-SHA256
 * 
 * Creates a token in the format: <timestamp_hex>.<hmac_hex>
 * The timestamp is the current time in milliseconds, and the HMAC is computed
 * over the timestamp using the provided secret.
 * 
 * @param {string} secret - The secret key for HMAC signing
 * @returns {string} Signed token in format "timestamp.signature"
 */
function signSessionToken(secret) {
  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret must be a non-empty string');
  }

  // Generate timestamp in milliseconds
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16);

  // Compute HMAC-SHA256 over the timestamp
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(timestampHex);
  const signature = hmac.digest('hex');

  return `${timestampHex}.${signature}`;
}

/**
 * Verify a session token by re-computing the HMAC and comparing
 * 
 * Uses crypto.timingSafeEqual for constant-time comparison to prevent timing attacks.
 * 
 * @param {string} token - The token to verify in format "timestamp.signature"
 * @param {string} secret - The secret key used for signing
 * @returns {boolean} True if the token is valid, false otherwise
 */
function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || !secret || typeof secret !== 'string') {
    return false;
  }

  // Parse the token
  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [timestampHex, providedSignature] = parts;

  // Validate timestamp format (must be valid hex)
  if (!/^[0-9a-f]+$/i.test(timestampHex)) {
    return false;
  }

  // Re-compute the HMAC
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(timestampHex);
  const expectedSignature = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Ensure both buffers are the same length before comparison
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    // timingSafeEqual throws if buffers have different lengths or invalid input
    return false;
  }
}

/**
 * Compare two passwords using constant-time comparison
 * 
 * Prevents timing attacks by ensuring the comparison takes the same amount of time
 * regardless of where the strings differ.
 * 
 * @param {string} provided - The password provided by the user
 * @param {string} expected - The expected password
 * @returns {boolean} True if passwords match, false otherwise
 */
function comparePasswords(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string') {
    return false;
  }

  try {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    // Ensure both buffers are the same length before comparison
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (error) {
    // timingSafeEqual throws if buffers have different lengths or invalid input
    return false;
  }
}

/**
 * Generate a CSRF token for the double-submit pattern
 * 
 * Creates a random 32-byte hex token and returns both the token value
 * and a cookie string for setting the CSRF cookie.
 * 
 * @returns {{ token: string, cookie: string }} Object with token and cookie string
 */
function generateCsrfToken() {
  // Generate 32 random bytes as hex (64 hex characters)
  const token = crypto.randomBytes(32).toString('hex');

  // Create cookie string with appropriate flags
  // SameSite=Lax, Path=/admin/login, Max-Age=600 (10 minutes)
  const cookie = `csrf_token=${token}; Path=/admin/login; Max-Age=600; SameSite=Lax`;

  return { token, cookie };
}

/**
 * Validate CSRF token using double-submit pattern
 * 
 * Compares the CSRF token from the cookie with the token from the form body.
 * Both must be present and match exactly.
 * 
 * @param {object} req - Express request object with cookies and body
 * @returns {boolean} True if CSRF token is valid, false otherwise
 */
function validateCsrfToken(req) {
  // Extract token from cookie
  const cookieToken = req.cookies?.csrf_token;
  
  // Extract token from form body
  const bodyToken = req.body?.csrf_token;

  // Both must be present
  if (!cookieToken || !bodyToken) {
    return false;
  }

  // Both must be strings
  if (typeof cookieToken !== 'string' || typeof bodyToken !== 'string') {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    const cookieBuffer = Buffer.from(cookieToken, 'utf8');
    const bodyBuffer = Buffer.from(bodyToken, 'utf8');

    // Ensure both buffers are the same length
    if (cookieBuffer.length !== bodyBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(cookieBuffer, bodyBuffer);
  } catch (error) {
    return false;
  }
}

/**
 * Create a rate limiter for tracking failed login attempts
 * 
 * Uses an in-memory Map to track failed attempts per IP address.
 * Blocks further attempts after reaching the threshold within the time window.
 * Includes periodic cleanup to prevent memory leaks.
 * 
 * @param {number} maxAttempts - Maximum failed attempts allowed (default: 5)
 * @param {number} windowMs - Time window in milliseconds (default: 15 minutes)
 * @returns {object} Rate limiter with check() and record() methods
 */
function createRateLimiter(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  // In-memory storage: Map<ip, { count, firstAttempt }>
  const attempts = new Map();

  // Periodic cleanup to prevent memory leaks
  // Run every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of attempts.entries()) {
      // Remove entries older than the window
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(ip);
      }
    }
  }, 5 * 60 * 1000);

  // Allow cleanup to be stopped (useful for testing)
  cleanupInterval.unref();

  /**
   * Check if an IP address is currently blocked
   * 
   * @param {string} ip - IP address to check
   * @returns {boolean} True if blocked (rate limit exceeded), false if allowed
   */
  function check(ip) {
    const data = attempts.get(ip);
    
    if (!data) {
      return false; // No attempts recorded, allowed
    }

    const now = Date.now();
    const elapsed = now - data.firstAttempt;

    // If window has expired, reset and allow
    if (elapsed > windowMs) {
      attempts.delete(ip);
      return false;
    }

    // Block if threshold reached
    return data.count >= maxAttempts;
  }

  /**
   * Record a failed login attempt for an IP address
   * 
   * @param {string} ip - IP address to record
   */
  function record(ip) {
    const now = Date.now();
    const data = attempts.get(ip);

    if (!data) {
      // First failure in this window
      attempts.set(ip, { count: 1, firstAttempt: now });
    } else {
      const elapsed = now - data.firstAttempt;

      if (elapsed > windowMs) {
        // Window expired, start new window
        attempts.set(ip, { count: 1, firstAttempt: now });
      } else {
        // Increment count within current window
        data.count++;
      }
    }
  }

  return {
    check,
    record,
  };
}

/**
 * Create authentication middleware for protecting admin routes
 * 
 * When adminPassword is not set, returns a no-op middleware that allows all requests.
 * When adminPassword is set, validates session cookies and enforces authentication.
 * 
 * @param {string|null} adminPassword - The admin password (if falsy, auth is disabled)
 * @param {object} options - Configuration options
 * @param {string} options.sessionSecret - Secret for HMAC signing (defaults to adminPassword)
 * @param {string} options.cookieName - Name of the session cookie (default: 'admin_session')
 * @param {number} options.maxAge - Session max age in seconds (default: 86400 = 24 hours)
 * @returns {Function} Express middleware function
 */
function createAuthMiddleware(adminPassword, options = {}) {
  // If no password is set, return no-op middleware
  if (!adminPassword) {
    return (req, res, next) => next();
  }

  const {
    sessionSecret = adminPassword,
    cookieName = 'admin_session',
    maxAge = 86400, // 24 hours in seconds
  } = options;

  return (req, res, next) => {
    // Skip authentication for login routes
    // Note: req.path is relative to the mount point (/admin)
    if (req.path === '/login') {
      return next();
    }

    // Get session cookie
    const sessionToken = req.cookies?.[cookieName];

    // Validate session token
    const isValid = sessionToken && verifySessionToken(sessionToken, sessionSecret);

    if (isValid) {
      // Check if token is expired (older than maxAge)
      const parts = sessionToken.split('.');
      if (parts.length === 2) {
        const timestampHex = parts[0];
        const timestamp = parseInt(timestampHex, 16);
        const age = (Date.now() - timestamp) / 1000; // Convert to seconds

        if (age > maxAge) {
          // Token expired, treat as unauthenticated
          return handleUnauthenticated(req, res);
        }
      }

      // Valid and not expired, allow request
      return next();
    }

    // Invalid or missing token
    return handleUnauthenticated(req, res);
  };

  /**
   * Handle unauthenticated requests
   * - API requests get 401 JSON response
   * - Page requests get redirected to login
   */
  function handleUnauthenticated(req, res) {
    // Check if this is an API request
    // Note: req.path is relative to the mount point (/admin)
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Redirect page requests to login
    return res.redirect('/admin/login');
  }
}

module.exports = {
  signSessionToken,
  verifySessionToken,
  comparePasswords,
  generateCsrfToken,
  validateCsrfToken,
  createRateLimiter,
  createAuthMiddleware,
};

/**
 * Create login/logout router for admin authentication
 * 
 * Provides routes for:
 * - GET /admin/login - Serve login page with CSRF token
 * - POST /admin/login - Process login with CSRF validation, rate limiting, and password check
 * - POST /admin/logout - Clear session and redirect to login
 * 
 * @param {string|null} adminPassword - The admin password (if falsy, routes are disabled)
 * @param {object} options - Configuration options
 * @param {string} options.sessionSecret - Secret for HMAC signing (defaults to adminPassword)
 * @param {string} options.cookieName - Name of the session cookie (default: 'admin_session')
 * @param {number} options.maxAge - Session max age in seconds (default: 86400 = 24 hours)
 * @param {number} options.maxAttempts - Max failed login attempts (default: 5)
 * @param {number} options.windowMs - Rate limit window in ms (default: 15 minutes)
 * @returns {object} Express Router instance
 */
function createLoginRouter(adminPassword, options = {}) {
  const express = require('express');
  const router = express.Router();

  // If no password is set, return empty router
  if (!adminPassword) {
    return router;
  }

  const {
    sessionSecret = adminPassword,
    cookieName = 'admin_session',
    maxAge = 86400, // 24 hours in seconds
    maxAttempts = 5,
    windowMs = 15 * 60 * 1000, // 15 minutes
  } = options;

  // Create rate limiter
  const rateLimiter = createRateLimiter(maxAttempts, windowMs);

  /**
   * GET /admin/login
   * Serve the login page with embedded CSRF token
   */
  router.get('/admin/login', (req, res) => {
    // Generate CSRF token
    const { token, cookie } = generateCsrfToken();

    // Set CSRF cookie
    res.setHeader('Set-Cookie', cookie);

    // Serve login page HTML with embedded CSRF token
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <style>
    .login-container {
      max-width: 400px;
      margin: 100px auto;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-group label {
      font-weight: 500;
    }
    .form-group input {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    .btn-primary {
      padding: 0.75rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    .btn-primary:hover {
      background: #0056b3;
    }
    .error-message {
      padding: 0.75rem;
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      display: none;
    }
    .error-message.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Admin Login</h1>
    <div id="error-message" class="error-message"></div>
    <form class="login-form" method="POST" action="/admin/login">
      <input type="hidden" name="csrf_token" value="${token}">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit" class="btn-primary">Login</button>
    </form>
  </div>
</body>
</html>
    `;

    res.send(html);
  });

  /**
   * POST /admin/login
   * Process login attempt with CSRF validation, rate limiting, and password verification
   */
  router.post('/admin/login', (req, res) => {
    // Get client IP address
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    // Check rate limit first
    if (rateLimiter.check(ip)) {
      return res.status(429).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Too Many Attempts</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <style>
    .error-container {
      max-width: 400px;
      margin: 100px auto;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .error-container h1 {
      color: #dc3545;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Too Many Attempts</h1>
    <p>Too many login attempts. Please try again later.</p>
  </div>
</body>
</html>
      `);
    }

    // Validate CSRF token
    if (!validateCsrfToken(req)) {
      return res.status(403).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invalid Request</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <style>
    .error-container {
      max-width: 400px;
      margin: 100px auto;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .error-container h1 {
      color: #dc3545;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Invalid Request</h1>
    <p>Invalid request. Please try again.</p>
  </div>
</body>
</html>
      `);
    }

    // Get submitted password
    const submittedPassword = req.body?.password || '';

    // Compare passwords using constant-time comparison
    const isValid = comparePasswords(submittedPassword, adminPassword);

    if (!isValid) {
      // Record failed attempt
      rateLimiter.record(ip);

      // Generate new CSRF token for retry
      const { token, cookie } = generateCsrfToken();
      res.setHeader('Set-Cookie', cookie);

      // Return login page with error message
      return res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <style>
    .login-container {
      max-width: 400px;
      margin: 100px auto;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-group label {
      font-weight: 500;
    }
    .form-group input {
      padding: 0.5rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
    }
    .btn-primary {
      padding: 0.75rem;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
    }
    .btn-primary:hover {
      background: #0056b3;
    }
    .error-message {
      padding: 0.75rem;
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>Admin Login</h1>
    <div class="error-message">Invalid credentials. Please try again.</div>
    <form class="login-form" method="POST" action="/admin/login">
      <input type="hidden" name="csrf_token" value="${token}">
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit" class="btn-primary">Login</button>
    </form>
  </div>
</body>
</html>
      `);
    }

    // Password is correct - create session token
    const sessionToken = signSessionToken(sessionSecret);

    // Set session cookie with appropriate flags
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const secureFlagStr = isSecure ? '; Secure' : '';
    const sessionCookie = `${cookieName}=${sessionToken}; Path=/admin; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureFlagStr}`;

    res.setHeader('Set-Cookie', sessionCookie);

    // Redirect to admin panel
    res.redirect('/admin/');
  });

  /**
   * POST /admin/logout
   * Clear session cookie and redirect to login page
   */
  router.post('/admin/logout', (req, res) => {
    // Clear session cookie by setting it to empty with Max-Age=0
    const clearCookie = `${cookieName}=; Path=/admin; Max-Age=0; HttpOnly; SameSite=Lax`;
    res.setHeader('Set-Cookie', clearCookie);

    // Redirect to login page
    res.redirect('/admin/login');
  });

  return router;
}

module.exports = {
  signSessionToken,
  verifySessionToken,
  comparePasswords,
  generateCsrfToken,
  validateCsrfToken,
  createRateLimiter,
  createAuthMiddleware,
  createLoginRouter,
};
