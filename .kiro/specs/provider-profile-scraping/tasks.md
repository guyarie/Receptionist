# Implementation Plan: Provider Profile Scraping & Management

## Overview

Replace the broken raw-text website scraping with an AI-powered pipeline that generates clean markdown provider profiles. Implementation follows the existing patterns (AvailabilityLoader, admin dashboard pages) to keep the codebase consistent.

## Tasks

- [ ] 1. Create the ProviderLoader module
  - [x] 1.1 Create `src/provider-loader.js` following the AvailabilityLoader pattern
    - Class with constructor accepting optional `providerDir` (default: `data/providers/`)
    - Methods: `ensureDirectory()`, `loadAll()`, `getAll()`, `getAIContext()`, `getFile(filename)`, `saveFile(filename, content)`, `reload()`
    - Export as singleton instance
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 1.2 Write property tests for ProviderLoader
    - **Property 4: ProviderLoader load round-trip**
    - **Property 5: getAIContext contains all file content**
    - **Property 6: saveFile round-trip**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

- [ ] 2. Create the scrape-providers script
  - [x] 2.1 Create `src/scrape-providers.js` as a standalone Node.js script
    - Fetch HTML from RTC website URL using axios
    - Extract text content using cheerio (exclude script, style, nav, footer)
    - Send extracted text to OpenRouter API with a prompt requesting JSON output containing `practiceOverview` and `providers` array
    - Parse AI response JSON
    - Write `practice-overview.md` and individual provider `.md` files to `data/providers/`
    - Use kebab-case slug for provider filenames
    - Log progress at each stage with emoji prefixes
    - Handle errors with descriptive messages and non-zero exit codes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 2.2 Add `scrape-providers` script entry to `package.json`
    - Add: `"scrape-providers": "node src/scrape-providers.js"`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.3 Write property tests for scrape-providers utilities
    - **Property 2: File count matches provider count plus one**
    - **Property 3: Provider name to kebab-case slug**
    - **Validates: Requirements 1.4, 1.5**

  - [ ]* 2.4 Write unit tests for HTML text extraction
    - **Property 1: HTML text extraction excludes unwanted elements**
    - Test that script/style/nav/footer content is excluded
    - Test that body text content is preserved
    - **Validates: Requirements 1.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Wire ProviderLoader into server and update AI context
  - [x] 4.1 Update `src/server.js` to use ProviderLoader instead of WebsiteScraper for AI context
    - Import `providerLoader` from `src/provider-loader.js`
    - On startup: call `providerLoader.loadAll()` and `aiClient.setWebsiteContext(providerLoader.getAIContext())`
    - Replace `websiteScraper.getAIContext()` with `providerLoader.getAIContext()` in the media-stream WebSocket handler
    - Keep WebsiteScraper import only if `/website-data` and `/refresh-website` endpoints are retained for backward compatibility, otherwise remove
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [x] 4.2 Add provider profile API endpoints to `src/server.js`
    - `GET /admin/api/providers` — returns `{ files: [{ filename, content }] }`
    - `PUT /admin/api/providers/:filename` — saves content, appends `.md` if missing, updates AI context
    - `POST /admin/api/refresh-providers` — reloads from disk, updates AI context
    - Validate empty content on PUT (return 400)
    - Log errors to errorBuffer
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 3.4_

  - [ ]* 4.3 Write property tests for API endpoints
    - **Property 8: API PUT/GET round-trip**
    - **Property 9: Filename .md normalization**
    - **Validates: Requirements 5.2, 5.4**

- [ ] 5. Create admin dashboard Provider Profiles page
  - [x] 5.1 Create `public/admin/providers.html`
    - Follow the same HTML structure as `availability.html`
    - Use `const UI = window.AdminUI;` pattern
    - Display all provider profile files in editable textareas
    - Save button per file calling `PUT /admin/api/providers/:filename`
    - "New Provider Profile" form with filename validation (must end `.md`, alphanumeric + hyphens/underscores/dots only)
    - "Reload from Disk" button calling `POST /admin/api/refresh-providers`
    - Toast notifications for success/error
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [x] 5.2 Update admin navigation to include "Provider Profiles" tab
    - Add `{ name: 'Provider Profiles', path: 'providers.html' }` to the pages array in `renderNav()` in `public/admin/admin.js`
    - _Requirements: 4.1_

  - [ ]* 5.3 Write property test for filename validation
    - **Property 7: Filename validation accepts only valid filenames**
    - **Validates: Requirements 4.8**

- [ ] 6. Update admin reload and status endpoints
  - [x] 6.1 Update `/admin/api/reload` to also reload provider profiles
    - Add `providerLoader.reload()` and context refresh to the existing reload handler
    - Update `/admin/api/status` to include provider profile count
    - _Requirements: 3.4_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The ProviderLoader follows the exact same pattern as AvailabilityLoader for consistency
- The scrape script is standalone and can be run independently of the server
- Property tests use fast-check with vitest (already configured in the project)
