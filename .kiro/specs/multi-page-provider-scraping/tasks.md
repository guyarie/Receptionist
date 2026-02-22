# Implementation Plan: Multi-Page Provider Scraping

## Overview

This implementation transforms the provider scraping system from single-page to multi-page architecture. The approach is incremental: add new functions alongside existing code, implement core functionality first, then add testing and error handling. The implementation reuses existing functions (fetchWebsite, extractText, validateProvider, etc.) to maintain consistency and reduce code duplication.

## Tasks

- [ ] 1. Implement provider link extraction
  - [x] 1.1 Create extractProviderLinks function
    - Parse HTML with Cheerio to find provider links
    - Look for links in "Meet the Team" section or navigation menu
    - Filter out non-provider links (about, contact, services)
    - Return array of {name, url} objects
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [ ]* 1.2 Write property test for link extraction
    - **Property 1: Provider Link Extraction Completeness**
    - **Validates: Requirements 1.1, 1.4**
    - Generate random HTML with provider links
    - Verify all valid links are extracted
  
  - [ ]* 1.3 Write unit tests for link extraction edge cases
    - Test empty HTML (no links found)
    - Test malformed HTML
    - Test various link formats (/name, /providers/name, /team/name)
    - Test links with query parameters
    - _Requirements: 1.1, 1.3_

- [ ] 2. Implement single provider processing
  - [x] 2.1 Create processSingleProvider function
    - Accept providerLink, browser, index, total parameters
    - Log progress: "Processing provider X of Y: [name]"
    - Fetch provider page using fetchWebsite (with retry logic)
    - Extract text using extractText
    - Save cache with provider-specific filename
    - Return result object with success, slug, operation, warnings, error, duration
    - _Requirements: 2.1, 2.3, 7.1, 7.2_
  
  - [ ]* 2.2 Write property test for error resilience
    - **Property 3: Error Resilience**
    - **Validates: Requirements 1.3, 2.3, 3.4, 5.3, 6.2, 6.3, 9.4**
    - Generate list of providers with some that fail
    - Verify processing continues for all providers
    - Verify errors are logged correctly
  
  - [ ]* 2.3 Write unit tests for single provider processing
    - Test successful processing
    - Test fetch failure (timeout, 404)
    - Test duration logging
    - _Requirements: 2.1, 2.3, 7.2_

- [ ] 3. Implement LLM prompt generation
  - [x] 3.1 Create generateProviderPrompt function
    - Accept providerName and text parameters
    - Build prompt focusing on single provider extraction
    - Emphasize insurance information extraction
    - Specify JSON response structure
    - _Requirements: 3.2_
  
  - [x] 3.2 Create generatePracticeOverviewPrompt function
    - Accept text parameter
    - Build prompt for practice overview extraction
    - Specify JSON response structure
    - _Requirements: 9.3_
  
  - [ ]* 3.3 Write property test for prompt structure
    - **Property 7: Single-Provider Prompt Structure**
    - **Validates: Requirements 3.2**
    - Generate random provider names
    - Verify prompts contain provider name and single-provider instructions

- [ ] 4. Implement LLM processing for single provider
  - [x] 4.1 Create callLLMForProvider function
    - Accept providerName and text parameters
    - Generate prompt using generateProviderPrompt
    - Call OpenRouter API
    - Parse JSON response (handle code blocks, backticks)
    - Validate response structure (name, content required)
    - Normalize insurance field to array
    - Return provider data or throw error
    - _Requirements: 3.1, 3.3_
  
  - [ ]* 4.2 Write property test for response validation
    - **Property 8: Response Validation Completeness**
    - **Validates: Requirements 3.3**
    - Generate random LLM responses (valid and invalid)
    - Verify validation correctly identifies missing fields
  
  - [ ]* 4.3 Write unit tests for LLM processing
    - Test successful LLM call
    - Test JSON parsing (code blocks, backticks, "json" prefix)
    - Test insurance field normalization (string to array)
    - Test validation errors
    - _Requirements: 3.1, 3.3_

- [ ] 5. Integrate provider processing into processSingleProvider
  - [x] 5.1 Add LLM call to processSingleProvider
    - Call callLLMForProvider after text extraction
    - Catch and log LLM errors
    - Continue processing on error (return result with error field)
    - _Requirements: 3.1, 3.4_
  
  - [x] 5.2 Add file writing to processSingleProvider
    - Normalize provider name using normalizeProviderName
    - Validate provider data using validateProvider
    - Write file using existing file write logic
    - Track operation (created/updated)
    - Log warnings (non-blocking)
    - _Requirements: 4.3, 4.4, 4.5_
  
  - [ ]* 5.3 Write property test for validation before write
    - **Property 10: Validation Before Write**
    - **Validates: Requirements 4.4**
    - Verify validation occurs before file write
  
  - [ ]* 5.4 Write property test for non-blocking validation
    - **Property 11: Non-Blocking Validation**
    - **Validates: Requirements 4.5**
    - Generate providers with validation warnings
    - Verify files are still created

- [ ] 6. Implement per-provider caching
  - [x] 6.1 Modify saveScrapeCache to accept provider name
    - Add optional providerName parameter
    - Include provider name in filename if provided
    - Include provider name in cache data structure
    - Maintain backward compatibility (homepage cache without provider name)
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [ ]* 6.2 Write property test for cache file structure
    - **Property 12: Cache File Structure**
    - **Validates: Requirements 5.1, 5.2, 5.4**
    - Generate random providers and HTML
    - Verify cache files have correct structure and location
  
  - [ ]* 6.3 Write unit tests for caching
    - Test cache file creation
    - Test cache filename includes provider name
    - Test cache failure doesn't stop processing
    - _Requirements: 5.1, 5.3_

- [x] 7. Checkpoint - Test single provider processing end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement practice overview extraction
  - [x] 8.1 Create extractPracticeOverview function
    - Accept homepage HTML and text parameters
    - Call LLM with generatePracticeOverviewPrompt
    - Parse JSON response
    - Return practice overview string or null on error
    - Log warning on error (non-fatal)
    - _Requirements: 9.1, 9.3, 9.4_
  
  - [x] 8.2 Create writePracticeOverview function
    - Accept practice overview string
    - Write to data/practice/practice-overview.md
    - Reuse existing directory creation logic
    - _Requirements: 9.2_
  
  - [ ]* 8.3 Write property test for practice overview extraction
    - **Property 18: Practice Overview Extraction**
    - **Validates: Requirements 9.1, 9.2, 9.3**
    - Verify practice overview is extracted and saved correctly
  
  - [ ]* 8.4 Write unit tests for practice overview
    - Test successful extraction
    - Test LLM failure (non-fatal)
    - Test file writing
    - _Requirements: 9.1, 9.4_

- [ ] 9. Implement new main function
  - [x] 9.1 Create mainMultiPage function
    - Initialize timing and results tracking
    - Launch browser if Puppeteer mode
    - Fetch homepage using fetchWebsite
    - Extract provider links using extractProviderLinks
    - Loop through providers calling processSingleProvider
    - Aggregate results (created, updated, errors, warnings)
    - Extract and write practice overview
    - Calculate total duration
    - Generate and write report
    - Display summary
    - Close browser in finally block
    - _Requirements: 1.1, 2.1, 3.5, 6.4, 7.3, 9.1_
  
  - [ ]* 9.2 Write property test for operation tracking
    - **Property 9: Operation Tracking Accuracy**
    - **Validates: Requirements 3.5, 4.3, 6.4**
    - Generate random providers
    - Verify tracked counts match actual operations
  
  - [ ]* 9.3 Write integration test for complete flow
    - Mock homepage with provider links
    - Mock provider pages
    - Mock LLM responses
    - Verify files created
    - Verify cache files created
    - Verify report generated
    - _Requirements: 1.1, 2.1, 3.1, 4.3, 5.1, 7.3_

- [ ] 10. Update report generation
  - [x] 10.1 Modify generateScrapingReport to handle per-provider errors
    - Accept results object with providers array
    - Group errors by type (timeout, navigation, parsing, LLM, other)
    - Add "Scraping Errors" section with per-provider details
    - Maintain existing sections (summary, providers, validation, recommendations)
    - _Requirements: 6.4, 7.3, 7.4, 7.5_
  
  - [ ]* 10.2 Write property test for report completeness
    - **Property 14: Report Completeness**
    - **Validates: Requirements 7.3, 7.4, 7.5, 8.6**
    - Generate random scraping results
    - Verify report contains all required sections
  
  - [ ]* 10.3 Write unit tests for report generation
    - Test report with no errors
    - Test report with various error types
    - Test error grouping by type
    - Test backward compatibility (existing sections present)
    - _Requirements: 7.4, 7.5, 8.6_

- [ ] 11. Add error logging enhancements
  - [x] 11.1 Enhance error objects with required fields
    - Ensure all errors include: type, message, provider, url, attempts, duration
    - Update processSingleProvider to populate error fields
    - _Requirements: 6.1_
  
  - [ ]* 11.2 Write property test for error logging completeness
    - **Property 13: Error Logging Completeness**
    - **Validates: Requirements 6.1**
    - Generate random errors
    - Verify all required fields are present

- [ ] 12. Add progress logging
  - [x] 12.1 Implement progress logging in processSingleProvider
    - Log "Processing provider X of Y: [name]" at start
    - Log duration at end
    - Already implemented in step 2.1, verify it works
    - _Requirements: 7.1, 7.2_
  
  - [ ]* 12.2 Write property test for progress logging format
    - **Property 15: Progress Logging Format**
    - **Validates: Requirements 7.1**
    - Verify log format matches expected pattern
  
  - [ ]* 12.3 Write property test for duration logging
    - **Property 16: Duration Logging**
    - **Validates: Requirements 7.2**
    - Verify duration is logged for successful operations

- [ ] 13. Add feature flag and integration
  - [x] 13.1 Add MULTI_PAGE_SCRAPING environment variable
    - Default to false (use existing single-page scraper)
    - When true, use new mainMultiPage function
    - Update main() to check flag and dispatch accordingly
    - _Requirements: 8.5_
  
  - [x] 13.2 Update .env.example with new variable
    - Add MULTI_PAGE_SCRAPING=false
    - Add documentation comment
  
  - [ ]* 13.3 Write property test for environment variable compatibility
    - **Property 17: Environment Variable Compatibility**
    - **Validates: Requirements 8.5**
    - Test all existing environment variables still work
    - Test new MULTI_PAGE_SCRAPING flag

- [x] 14. Checkpoint - Test complete multi-page scraping
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Add configuration consistency validation
  - [ ]* 15.1 Write property test for configuration consistency
    - **Property 5: Configuration Consistency**
    - **Validates: Requirements 2.5**
    - Verify all fetch operations use same scraping mode

- [ ] 16. Add LLM call isolation validation
  - [ ]* 16.1 Write property test for LLM call isolation
    - **Property 6: LLM Call Isolation**
    - **Validates: Requirements 3.1**
    - Verify each provider gets separate LLM call

- [ ] 17. Add URL validation tests
  - [ ]* 17.1 Write property test for URL validation
    - **Property 2: URL Validation Correctness**
    - **Validates: Requirements 1.2**
    - Generate random URLs (valid and invalid)
    - Verify validation correctly identifies valid provider URLs

- [ ] 18. Add HTML fetch completeness tests
  - [ ]* 18.1 Write property test for HTML fetch completeness
    - **Property 4: HTML Fetch Completeness**
    - **Validates: Requirements 2.1**
    - Verify fetch returns complete HTML or properly typed error

- [ ] 19. Documentation and cleanup
  - [x] 19.1 Add JSDoc comments to all new functions
    - Document parameters, return values, error handling
    - Include examples where helpful
  
  - [x] 19.2 Update README.md with multi-page scraping information
    - Document MULTI_PAGE_SCRAPING flag
    - Explain benefits of multi-page scraping
    - Update performance expectations
  
  - [x] 19.3 Create migration guide
    - Document how to switch from single-page to multi-page
    - Explain validation criteria
    - Provide rollback instructions

- [x] 20. Final checkpoint - Complete testing and validation
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (100+ iterations each)
- Unit tests validate specific examples and edge cases
- The implementation reuses existing functions to maintain consistency
- Feature flag allows gradual rollout and easy rollback
- Per-provider error handling ensures resilience
