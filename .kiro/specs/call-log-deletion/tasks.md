# Implementation Plan: Call Log Deletion

## Overview

Add delete single and delete all capabilities to the call logs page in the admin panel. Two new methods on `CallSummaryManager`, two new DELETE endpoints on the Express server, and UI controls on `calls.html`. No new dependencies needed.

## Tasks

- [x] 0. Create feature branch
  - [x] 0.1 Create and switch to a new git branch `feature/call-log-deletion` from the current branch

- [x] 1. Add deletion methods to CallSummaryManager
  - [x] 1.1 Add `deleteSummaryById(id)` method to `src/call-summary.js`
    - Sanitize `id` with `path.basename()` to prevent directory traversal
    - Append `.json` if not already present
    - Return `true` if file existed and was deleted, `false` if not found
    - Use `fs.unlinkSync` for deletion
    - _Requirements: 3.1, 3.3, 3.4, 3.5_

  - [x] 1.2 Add `deleteAllSummaries()` method to `src/call-summary.js`
    - Read directory, filter to `.json` files only
    - Delete each `.json` file with `fs.unlinkSync`
    - Return count of deleted files (0 if directory was empty)
    - _Requirements: 3.2, 2.5, 2.7_

  - [ ]* 1.3 Write property test for single delete (Property 1)
    - **Property 1: Delete single existing call log**
    - For any existing call summary file, `deleteSummaryById` removes it and returns `true`
    - Use temp directory with generated JSON files
    - **Validates: Requirements 1.3, 3.1, 3.4**

  - [ ]* 1.4 Write property test for non-existent delete (Property 2)
    - **Property 2: Delete non-existent call log returns false**
    - For any ID not matching an existing file, `deleteSummaryById` returns `false` and directory is unchanged
    - **Validates: Requirements 1.5, 3.3**

  - [ ]* 1.5 Write property test for path traversal sanitization (Property 3)
    - **Property 3: Path traversal sanitization**
    - For any string with path separators or `../`, the resolved path stays within `call-summaries/`
    - **Validates: Requirements 1.7, 3.5**

  - [ ]* 1.6 Write property test for delete all (Property 4)
    - **Property 4: Delete all removes all JSON files and returns correct count**
    - For any directory with N JSON files, `deleteAllSummaries` returns N and zero JSON files remain
    - **Validates: Requirements 2.3, 3.2**

  - [ ]* 1.7 Write property test for non-JSON preservation (Property 5)
    - **Property 5: Delete all preserves non-JSON files**
    - For any directory with mixed file types, only `.json` files are removed
    - **Validates: Requirements 2.7**

- [x] 2. Add DELETE API endpoints to server
  - [x] 2.1 Add `DELETE /admin/api/calls/:id` endpoint to `src/server.js`
    - Sanitize `req.params.id` with `path.basename()` (defense in depth)
    - Call `callSummaryManager.deleteSummaryById(id)`
    - Return 200 on success, 404 if not found, 500 on error
    - Log deletion with error buffer on failure
    - _Requirements: 1.3, 1.5, 1.6, 1.7, 1.8_

  - [x] 2.2 Add `DELETE /admin/api/calls` endpoint to `src/server.js`
    - Call `callSummaryManager.deleteAllSummaries()`
    - Return 200 with `{ success: true, deletedCount: N }`
    - Return 500 on error
    - Log deletion with error buffer on failure
    - _Requirements: 2.3, 2.5, 2.6, 2.9_

- [x] 3. Add deletion UI to calls page
  - [x] 3.1 Add "Delete All" button and per-row delete buttons to `public/admin/calls.html`
    - Add "Delete All" button (`.btn-danger`) in the card header next to "Call History" heading
    - Add delete button (🗑️) in each table row's Actions column
    - Single delete: `confirm()` dialog, then `DELETE /admin/api/calls/:id`, remove row from DOM, show success toast
    - Delete all: `confirm()` dialog, then `DELETE /admin/api/calls`, show success toast with count, reload call list
    - Disable "Delete All" button while request is in flight
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.4, 2.8_

- [ ] 4. Write unit tests for API endpoints
  - [ ]* 4.1 Write unit tests in `tests/unit/call-log-deletion.test.js`
    - `DELETE /admin/api/calls/:id` returns 404 for non-existent ID
    - `DELETE /admin/api/calls/:id` returns 200 for existing ID
    - `DELETE /admin/api/calls` returns 200 with `deletedCount: 0` for empty directory
    - `DELETE /admin/api/calls/:id` returns 401 without auth session
    - `DELETE /admin/api/calls` returns 401 without auth session
    - _Requirements: 1.5, 1.6, 1.8, 2.5, 2.6, 2.9_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations per property
- All property tests go in `tests/property/call-log-deletion.property.test.js`
- Unit tests go in `tests/unit/call-log-deletion.test.js`
- No new npm dependencies needed
