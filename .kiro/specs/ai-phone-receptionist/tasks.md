# Implementation Plan: AI Phone Receptionist — Friends & Family Release

## Overview

This plan extends the working demo into an office-manager-operable system. All tasks build on the existing codebase (Node.js/CommonJS, Express, Twilio Gather flow). New modules are added for the admin UI, availability loading, and error buffering. Testing uses vitest + fast-check.

## Tasks

- [x] 1. Add vitest and fast-check, create test infrastructure
  - Install vitest and fast-check as dev dependencies
  - Create `vitest.config.js` at project root
  - Create `tests/unit/` and `tests/property/` directories
  - Add `"test": "vitest --run"` script to package.json
  - _Requirements: Testing Strategy_

- [x] 2. Implement error buffer module
  - [x] 2.1 Create `src/error-buffer.js` with ring buffer logic
    - Constructor takes maxSize (default 50)
    - `add(error)` stores `{ message, timestamp, context }`, drops oldest when full
    - `getAll()` returns array newest-first
    - `clear()` and `count()` methods
    - Export singleton instance
    - _Requirements: 1.2, 8.1, 8.2, 8.3_
  - [ ]* 2.2 Write property test for error buffer ring behavior
    - **Property 3: Error buffer ring behavior**
    - **Validates: Requirements 8.3**
  - [ ]* 2.3 Write property test for error buffer stores errors with metadata
    - **Property 2: Error buffer stores errors with metadata**
    - **Validates: Requirements 1.2, 8.1, 8.2**

- [x] 3. Implement availability loader module
  - [x] 3.1 Create `src/availability-loader.js`
    - Constructor takes directory path (default `availability/`)
    - `ensureDirectory()` creates dir if missing, logs notice
    - `loadAll()` reads all `.md` files into memory map
    - `getAll()` returns `{ filename: content }` map
    - `getAIContext()` returns combined content as string for AI prompt
    - `getFile(filename)` and `saveFile(filename, content)` for admin editing
    - `reload()` re-reads all files from disk
    - Export singleton instance
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [ ]* 3.2 Write property test for availability loading returns all files
    - **Property 7: Availability loading returns all files**
    - **Validates: Requirements 3.1, 3.3**
  - [ ]* 3.3 Write property test for availability save/read round-trip
    - **Property 9: Availability save/read round-trip**
    - **Validates: Requirements 3.4**

- [x] 4. Checkpoint — Ensure new modules work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend prompts module for admin editing
  - [x] 5.1 Add `getAll()` and `savePrompt(filename, content)` methods to `src/prompts.js`
    - `getAll()` returns array of `{ name, filename, content }` for each prompt
    - `savePrompt()` validates content is non-empty/non-whitespace, writes to disk, reloads
    - Reject empty/whitespace-only content with an error
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 5.2 Write property test for prompt save/read round-trip
    - **Property 5: Prompt save/read round-trip**
    - **Validates: Requirements 2.2, 2.4**
  - [ ]* 5.3 Write property test for empty/whitespace prompt rejection
    - **Property 6: Empty/whitespace prompt rejection**
    - **Validates: Requirements 2.3**

- [x] 6. Extend call summary module for pagination
  - [x] 6.1 Add `getSummariesPaginated(page, limit)` and `getSummaryById(id)` to `src/call-summary.js`
    - `getSummariesPaginated()` returns `{ calls, total, page, totalPages }`
    - `getSummaryById()` returns single call log by filename
    - Maintain existing `getAllSummaries()` and `saveCallSummary()` unchanged
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 6.2 Write property test for call logs sorted by most recent first
    - **Property 11: Call logs sorted by most recent first**
    - **Validates: Requirements 4.1**
  - [ ]* 6.3 Write property test for call log pagination correctness
    - **Property 13: Call log pagination correctness**
    - **Validates: Requirements 4.3**

- [x] 7. Integrate availability and error buffer into AI client and server
  - [x] 7.1 Modify `src/ai-client.js` to include availability context
    - Add `setAvailabilityContext(context)` method
    - Modify `initSession()` to append availability context after website context in system prompt
    - When no availability content exists, add instruction that scheduling info is not available
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 7.2 Modify `src/server.js` startup to load availability and wire error buffer
    - Import and initialize availability loader on startup
    - Pass availability context to AI client via `setAvailabilityContext()`
    - Import error buffer and add `errorBuffer.add()` calls in existing catch blocks
    - _Requirements: 3.1, 3.2, 8.1, 8.2_
  - [ ]* 7.3 Write property test for availability content included in AI context
    - **Property 8: Availability content included in AI context**
    - **Validates: Requirements 3.2, 6.1**
  - [ ]* 7.4 Write property test for AI context includes website and custom info
    - **Property 14: AI context includes website and custom info**
    - **Validates: Requirements 6.2**

- [x] 8. Checkpoint — Ensure integration works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add admin API routes to server
  - [x] 9.1 Add admin API endpoints to `src/server.js`
    - `GET /admin/api/status` — returns uptime, active calls, model, phone, recent errors, prompt count, availability count
    - `GET /admin/api/prompts` and `PUT /admin/api/prompts/:filename` — list and save prompts
    - `GET /admin/api/calls` (with ?page&limit) and `GET /admin/api/calls/:id` — paginated call logs
    - `GET /admin/api/availability` and `PUT /admin/api/availability/:filename` — list and save availability files
    - `POST /admin/api/reload` — reload prompts and availability
    - `POST /admin/api/refresh-website` — re-scrape website (reuse existing logic)
    - _Requirements: 1.1, 2.1, 2.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3_
  - [ ]* 9.2 Write property test for status endpoint completeness
    - **Property 1: Status endpoint completeness**
    - **Validates: Requirements 1.1, 5.1**
  - [ ]* 9.3 Write property test for prompt listing returns all files
    - **Property 4: Prompt listing returns all files**
    - **Validates: Requirements 2.1**
  - [ ]* 9.4 Write property test for call log detail contains required fields
    - **Property 12: Call log detail contains required fields**
    - **Validates: Requirements 4.2**
  - [ ]* 9.5 Write property test for reload updates in-memory data from disk
    - **Property 10: Reload updates in-memory data from disk**
    - **Validates: Requirements 5.2**

- [x] 10. Checkpoint — Ensure admin API works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Create admin UI HTML pages
  - [x] 11.1 Create `public/admin/admin.css` and `public/admin/admin.js` shared assets
    - Simple CSS for dashboard layout, navigation, forms, tables
    - Shared JS: fetch wrapper with error handling, nav component, toast notifications
    - _Requirements: 1.3, 1.5_
  - [x] 11.2 Create `public/admin/index.html` dashboard page
    - Display server uptime, active calls, model name, phone number
    - Show recent errors list from error buffer
    - Quick-action buttons: reload all, refresh website data
    - Navigation links to prompts, calls, availability pages
    - _Requirements: 1.1, 1.3, 5.1_
  - [x] 11.3 Create `public/admin/prompts.html` prompt editor page
    - List all prompts with text areas showing current content
    - Save button per prompt with validation (reject empty)
    - Success/error feedback messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 11.4 Create `public/admin/calls.html` call log browser page
    - Table of calls: date, caller phone, duration, summary snippet
    - Click to expand full transcript
    - Pagination controls (20 per page)
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 11.5 Create `public/admin/availability.html` availability editor page
    - List provider markdown files with text areas
    - Save button per file
    - Option to create new availability file
    - Reload button
    - _Requirements: 3.3, 3.4_

- [x] 12. Serve admin pages from Express
  - [x] 12.1 Add static file serving and route for `/admin` in `src/server.js`
    - Serve `public/admin/` files under `/admin` path
    - Redirect `/admin` to `/admin/index.html`
    - _Requirements: 1.4_

- [ ] 13. Add TwiML property tests
  - [ ]* 13.1 Write property test for TwiML greeting contains prompt content
    - **Property 15: TwiML greeting contains prompt content**
    - **Validates: Requirements 7.1**
  - [ ]* 13.2 Write property test for speech text forwarded to AI client
    - **Property 16: Speech text forwarded to AI client**
    - **Validates: Requirements 7.2**
  - [ ]* 13.3 Write property test for AI response wrapped in TwiML Say and Gather
    - **Property 17: AI response wrapped in TwiML Say and Gather**
    - **Validates: Requirements 7.3**
  - [ ]* 13.4 Write property test for call end triggers summary generation
    - **Property 18: Call end triggers summary generation**
    - **Validates: Requirements 7.6**

- [x] 14. Deployment support
  - [x] 14.1 Create startup script and systemd service file
    - Add `start.sh` script at project root for Linux
    - Create `docs/systemd-setup.md` with instructions for auto-start on boot
    - Verify all file paths use `path.join()` for cross-platform compatibility
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 14.2 Create sample availability files
    - Create `availability/` directory with a `README.md` explaining the format
    - Add one example file `availability/example-provider.md` with sample content
    - _Requirements: 3.1, 3.6_

- [ ] 15. Final checkpoint — Run all tests
  - Run full test suite with `npm test`
  - Verify all property tests run with 100 iterations
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks build incrementally on the existing working demo
- Tasks marked with `*` are optional and can be skipped for faster delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The admin UI uses plain HTML/CSS/JS — no framework, no build step
- All new modules follow existing CommonJS conventions
- Property tests validate universal correctness properties from the design document
