# Implementation Plan: Admin Authentication

## Overview

Add password-based authentication to the admin panel using stateless HMAC sessions, CSRF protection, and rate limiting. All auth logic lives in a new `src/admin-auth.js` module, integrated into the existing Express server after the IP whitelist middleware. No new dependencies required — uses Node.js `crypto` for all cryptographic operations.

## Tasks

- [x] 1. Add admin config fields and environment variable support
  - [x] 1.1 Add `admin.password` and `admin.sessionSecret` to the config object in `src/config.js`
    - Load `ADMIN_PASSWORD` from env; set to `null` if unset or empty string
    - Load `SESSION_SECRET` from env; fall back to `ADMIN_PASSWORD` if not set
    - Log a warning when `ADMIN_PASSWORD` is not set or empty
    - Update `.env.example` with `ADMIN_PASSWORD` and `SESSION_SECRET` entries
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 1.2 Write property test for config loading (Property 1)
    - **Property 1: Config loads ADMIN_PASSWORD**
    - For any string value assigned to `ADMIN_PASSWORD`, `admin.password` equals that value; when unset or empty, it is `null`
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 2. Implement core auth helpers in `src/admin-auth.js`
  - [x] 2.1 Create `src/admin-auth.js` with session token functions
    - Implement `signSessionToken(secret)` — creates `<timestamp_hex>.<hmac_hex>` using HMAC-SHA256
    - Implement `verifySessionToken(token, secret)` — re-computes HMAC and compares with `crypto.timingSafeEqual`
    - Implement constant-time password comparison helper using `crypto.timingSafeEqual`
    - _Requirements: 3.3, 6.2_

  - [ ]* 2.2 Write property test for session token round-trip (Property 3)
    - **Property 3: Session token round-trip**
    - For any secret and timestamp, `verifySessionToken(signSessionToken(secret), secret)` returns `true`; any modified token returns `false`
    - **Validates: Requirements 3.3**

  - [ ]* 2.3 Write property test for password comparison (Property 7)
    - **Property 7: Password comparison correctness**
    - For any two byte-equal strings, comparison returns `true`; for any differing strings, returns `false`
    - **Validates: Requirements 6.2**

- [x] 3. Implement CSRF token generation and validation
  - [x] 3.1 Add `generateCsrfToken()` and `validateCsrfToken(req)` to `src/admin-auth.js`
    - Generate 32 random hex bytes for the token
    - Return `{ token, cookie }` pair for embedding in form and setting cookie
    - Validate by comparing cookie value to form body value
    - _Requirements: 6.3_

  - [ ]* 3.2 Write property test for CSRF validation (Property 8)
    - **Property 8: CSRF token validation**
    - Matching cookie and form tokens pass; mismatched or missing tokens are rejected
    - **Validates: Requirements 6.3**

- [x] 4. Implement rate limiter
  - [x] 4.1 Add `createRateLimiter(maxAttempts, windowMs)` to `src/admin-auth.js`
    - Use in-memory `Map` keyed by IP address with `{ count, firstAttempt }` entries
    - `check(ip)` returns blocked after 5 failures within 15-minute window
    - `record(ip)` increments failure count
    - Periodic cleanup every 5 minutes to prevent memory leaks
    - _Requirements: 6.1_

  - [ ]* 4.2 Write property test for rate limiter (Property 6)
    - **Property 6: Rate limiter blocks after threshold**
    - After 5 failures within window, `check()` returns blocked; before threshold, returns allowed; after window expires, resets
    - **Validates: Requirements 6.1**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement auth middleware and login router
  - [x] 6.1 Add `createAuthMiddleware(adminPassword, options)` to `src/admin-auth.js`
    - Return no-op middleware when `adminPassword` is falsy
    - Skip `/admin/login` GET and POST routes
    - Validate session cookie on all other `/admin/` routes
    - Redirect to `/admin/login` for unauthenticated page requests
    - Return 401 JSON for unauthenticated `/admin/api/*` requests
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Add `createLoginRouter(adminPassword, options)` to `src/admin-auth.js`
    - `GET /admin/login` — serve login page with embedded CSRF token
    - `POST /admin/login` — validate CSRF, check rate limit, compare password with `timingSafeEqual`, set session cookie on success, show error on failure
    - `POST /admin/logout` — clear session cookie, redirect to `/admin/login`
    - Return 429 when rate limit exceeded
    - Return 403 when CSRF validation fails
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [ ]* 6.3 Write property test for login correctness (Property 2)
    - **Property 2: Login correctness**
    - For any configured and submitted password pair, session cookie is set if and only if they match
    - **Validates: Requirements 2.4, 2.5, 3.1, 3.2**

  - [ ]* 6.4 Write property test for route protection (Property 4)
    - **Property 4: Route protection**
    - Unauthenticated requests to protected admin paths get 302 redirect (pages) or 401 JSON (API)
    - **Validates: Requirements 3.4, 4.1, 4.2, 4.3**

  - [ ]* 6.5 Write property test for logout (Property 5)
    - **Property 5: Logout clears session**
    - POST to `/admin/logout` clears session cookie and redirects to `/admin/login`
    - **Validates: Requirements 5.2, 5.3**

- [x] 7. Create login page and update admin UI
  - [x] 7.1 Create `public/admin/login.html`
    - Password input field and submit button
    - Hidden CSRF token field in the form
    - Error message display area
    - Style consistently with existing `admin.css`
    - _Requirements: 2.1, 2.2, 2.3, 6.3_

  - [x] 7.2 Add logout button to admin navigation in `public/admin/admin.js`
    - Add logout control to `renderNav()` visible on all admin pages
    - Logout button submits POST to `/admin/logout`
    - Update `apiFetch()` to handle 401 responses by redirecting to `/admin/login`
    - _Requirements: 5.1_

- [x] 8. Integrate auth into server
  - [x] 8.1 Wire auth middleware and login router into `src/server.js`
    - Require `src/admin-auth.js`
    - Register `createAuthMiddleware` on `/admin` after IP whitelist middleware
    - Register `createLoginRouter` after the auth middleware
    - Pass `config.admin.password` and `config.admin.sessionSecret` as options
    - _Requirements: 4.4_

  - [ ]* 8.2 Write unit tests for integration and edge cases
    - Test login page serves at GET `/admin/login` without auth
    - Test empty/unset `ADMIN_PASSWORD` allows unauthenticated access
    - Test middleware ordering (IP whitelist before auth)
    - Test CSRF token is present in login page HTML
    - Test rate limiter window expiry resets the counter
    - _Requirements: 1.2, 1.3, 2.1, 2.6, 4.4, 6.1_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations per property
- All property tests go in `tests/property/admin-auth.property.test.js`
- Unit tests go in `tests/unit/admin-auth.test.js`
- No new npm dependencies needed — Node.js `crypto` handles all cryptographic operations
