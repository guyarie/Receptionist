# Implementation Plan: Provider Filename Fix

## Overview

This bugfix modifies the provider scraping system to generate accurate filenames by adding a dedicated `fileName` field to the LLM response. The implementation involves updating the prompt generation, response parsing, and filename generation logic while maintaining backward compatibility through fallback mechanisms.

## Tasks

- [x] 1. Add fileName validation helper function
  - Create `validateFileName(fileName)` function in `src/scrape-providers.js`
  - Implement validation rules: non-empty string, contains letters, only letters/spaces/hyphens, max 100 chars
  - Add unit tests for validation edge cases (empty, null, special characters, too long)
  - _Requirements: 2.4, 4.1, 4.2_

- [ ]* 1.1 Write property test for fileName validation
  - **Property 2: Filename validation correctness**
  - **Validates: Requirements 2.4, 4.1**
  - Generate random strings and verify validateFileName returns correct boolean based on validation rules
  - Use fast-check library with minimum 100 iterations

- [x] 2. Update generateProviderPrompt to request fileName field
  - Modify the JSON structure in the prompt to include `fileName` field
  - Add explicit instructions: "fileName should contain only first and last name without credentials"
  - Keep existing fields (name, content, email, phone, insurance) unchanged
  - _Requirements: 1.1, 2.1_

- [ ]* 2.1 Write unit test for prompt generation
  - Verify generated prompt includes fileName field in JSON structure
  - Verify prompt contains instructions about first and last name only
  - _Requirements: 1.1, 2.1, 2.3_

- [x] 3. Update callLLMForProvider to extract fileName field
  - Extract `fileName` field from LLM JSON response
  - Add fileName to the returned provider data object
  - Handle cases where fileName is missing (set to null or undefined)
  - _Requirements: 2.3_

- [ ]* 3.1 Write unit test for response parsing
  - Test that both name and fileName fields are extracted correctly
  - Test that missing fileName field doesn't break parsing
  - _Requirements: 2.3, 3.4_

- [x] 4. Update processSingleProvider to use fileName for slug generation
  - Check if `providerData.fileName` exists and is valid using `validateFileName()`
  - If valid: use `nameToSlug(providerData.fileName)` to generate slug
  - If invalid/missing: fall back to `normalizeProviderName(providerData.name)`
  - Add logging to indicate which method was used (fileName vs fallback)
  - _Requirements: 1.2, 1.4, 3.1, 3.2, 4.4_

- [ ]* 4.1 Write unit test for concrete bug scenario
  - Test that "Miri Arie, PhD, CGP" with fileName "Miri Arie" generates "miri-arie" slug
  - Test that "Lilach Geppert-Shapira, MA, CLC" with fileName "Lilach Geppert-Shapira" generates "lilach-geppert-shapira" slug
  - _Requirements: 1.3_

- [ ]* 4.2 Write property test for filename generation logic
  - **Property 1: Filename generation uses correct source**
  - **Validates: Requirements 1.2, 1.4, 3.1, 3.2**
  - Generate random provider data objects with/without valid fileName fields
  - Verify slug generation uses fileName when valid, normalizeProviderName when invalid/missing
  - Use fast-check library with minimum 100 iterations

- [ ]* 4.3 Write unit tests for fallback behavior
  - Test fallback when fileName is null
  - Test fallback when fileName is empty string
  - Test fallback when fileName contains invalid characters
  - Test fallback when fileName is missing from object
  - _Requirements: 1.4, 3.1, 3.2, 4.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Run test suite: `npm test`
  - Verify all unit tests and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Verify normalizeProviderName remains unchanged
  - Confirm that normalizeProviderName function code is unchanged
  - Run existing tests to ensure backward compatibility
  - _Requirements: 3.3_

- [ ]* 6.1 Write integration test for legacy data handling
  - Test that provider data without fileName field still works correctly
  - Verify that normalizeProviderName is used as fallback
  - _Requirements: 3.4_

- [x] 7. Final checkpoint - Manual testing
  - Test with real provider data if available
  - Verify log messages are clear and helpful
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster bugfix deployment
- The validateFileName function should be added near the normalizeProviderName function for logical grouping
- Property tests use fast-check library (already available in the project via Vitest)
- Each property test should run minimum 100 iterations to ensure comprehensive coverage
- Logging should use emoji prefixes consistent with existing code style (⚠️ for warnings)
- All changes maintain backward compatibility - existing code paths continue to work
