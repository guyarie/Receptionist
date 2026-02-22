# Implementation Plan: Provider Scraping Improvements

## Overview

This implementation enhances the existing `src/scrape-providers.js` to eliminate duplicate provider files through name normalization, improve insurance information extraction through enhanced AI prompting, and add comprehensive data validation with reporting. The changes maintain the current architecture while adding new validation and normalization stages.

## Tasks

- [ ] 1. Implement name normalization functions
  - [x] 1.1 Create `normalizeProviderName()` function in `src/scrape-providers.js`
    - Remove credentials using regex patterns (PhD, LMFT, LCSW, PsyD, MD, DO, MA, MS, MSW, MEd, LPC, LPCC, LMHC)
    - Remove middle initials (single letters with or without periods)
    - Extract first and last name components only
    - Apply existing `nameToSlug()` to cleaned name
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 1.2 Write property test for name normalization idempotence
    - **Property 1: Name normalization is idempotent**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
    - Generate random provider names with credentials and middle initials
    - Verify `normalize(normalize(name)) === normalize(name)`
  
  - [ ]* 1.3 Write property test for slug character validation
    - **Property 2: Normalized names contain only valid slug characters**
    - **Validates: Requirements 1.3, 1.4**
    - Generate random provider names
    - Verify normalized slug matches `/^[a-z]+(-[a-z]+)*$/`
  
  - [ ]* 1.4 Write property test for name variant equivalence
    - **Property 3: Name variants normalize to same slug**
    - **Validates: Requirements 1.1, 1.2, 1.6**
    - Generate base name, create variants with/without middle initial and credentials
    - Verify all variants normalize to same slug
  
  - [ ]* 1.5 Write unit tests for name normalization edge cases
    - Test "Jeffrey B. Gillman, PhD" → "jeffrey-gillman"
    - Test "Miri Arie, PhD, LMFT" → "miri-arie"
    - Test empty name handling
    - Test names with special characters
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 2. Implement duplicate detection
  - [x] 2.1 Create `providerFileExists()` and `findExistingProviderFile()` functions
    - Use `fs.existsSync()` to check for existing files
    - Construct file path from normalized slug
    - Return boolean for existence, path for updates
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 2.2 Modify `writeProviderFiles()` to check for duplicates before writing
    - Call duplicate detector for each provider
    - Log whether creating new file or updating existing
    - Track operations (created vs updated) for reporting
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  
  - [ ]* 2.3 Write unit tests for duplicate detection
    - Test file exists returns true for existing files
    - Test file exists returns false for non-existent files
    - Test finding existing file returns correct path
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Checkpoint - Ensure normalization and duplicate detection work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enhance AI extraction prompt for insurance information
  - [x] 4.1 Update `prompts/scraping-instructions.txt` with enhanced insurance extraction guidance
    - Add multiple emphatic statements about insurance importance
    - Include examples of insurance information locations
    - Specify exact JSON structure for insurance field (array of strings)
    - Add verification checklist for insurance extraction
    - Provide examples of common insurance provider names
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 4.2 Modify AI response JSON structure to include insurance array
    - Update expected response structure in `generateSummaries()`
    - Ensure insurance field is parsed as array, not string
    - Handle cases where AI returns string instead of array
    - _Requirements: 3.2, 3.3, 3.4_

- [ ] 5. Implement data validation
  - [x] 5.1 Create `validateProvider()` function
    - Check for required fields (name, content)
    - Validate email format using regex
    - Validate phone format (digits, spaces, parentheses, hyphens)
    - Check if insurance array is empty
    - Return validation result object with warnings array
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [x] 5.2 Create `isValidEmail()` and `isValidPhone()` helper functions
    - Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
    - Phone regex: `/^[\d\s()\-]+$/`
    - _Requirements: 4.4, 4.5_
  
  - [ ]* 5.3 Write property test for email validation
    - **Property 7: Email validation accepts standard formats**
    - **Validates: Requirements 4.4**
    - Generate valid email addresses
    - Verify validator returns true for all valid formats
  
  - [ ]* 5.4 Write property test for phone validation
    - **Property 8: Phone validation accepts standard formats**
    - **Validates: Requirements 4.5**
    - Generate valid phone numbers with various formatting
    - Verify validator returns true for all valid formats
  
  - [ ]* 5.5 Write unit tests for validation edge cases
    - Test invalid email formats
    - Test invalid phone formats
    - Test missing required fields
    - Test empty insurance array warning
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Integrate validation into scraping pipeline
  - [x] 6.1 Add validation calls in `writeProviderFiles()` before writing each file
    - Call `validateProvider()` for each provider
    - Log warnings to console
    - Collect warnings for report generation
    - Continue processing even with warnings (non-blocking)
    - _Requirements: 4.1, 4.2, 4.3, 4.6, 4.7_
  
  - [ ]* 6.2 Write property test for validation non-blocking behavior
    - **Property 6: Validation warnings are non-blocking**
    - **Validates: Requirements 4.7**
    - Generate providers with various validation issues
    - Verify all providers are processed despite warnings

- [x] 7. Checkpoint - Ensure validation and enhanced prompts work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement reporting system
  - [x] 8.1 Create `generateScrapingReport()` function
    - Generate summary with provider count, operations, validation warnings
    - List all providers with their normalized slugs
    - Indicate created vs updated files
    - Highlight providers with missing insurance
    - Include all validation warnings
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 8.2 Create `writeReport()` function
    - Create reports directory if it doesn't exist
    - Generate timestamped filename
    - Write report content to file
    - Handle write errors gracefully
    - _Requirements: 4.6, 6.6_
  
  - [x] 8.3 Integrate reporting into `main()` function
    - Collect operation data during scraping
    - Generate report after all files written
    - Write report to file
    - Display summary to console
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [ ]* 8.4 Write property test for report completeness
    - **Property 9: Report generation is comprehensive**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    - Generate random scraping results
    - Verify report includes all required sections and counts
  
  - [ ]* 8.5 Write unit tests for report generation
    - Test report format with various data
    - Test timestamped filename generation
    - Test report directory creation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [ ] 9. Update module exports for testing
  - [x] 9.1 Export new functions from `src/scrape-providers.js`
    - Export `normalizeProviderName`, `providerFileExists`, `validateProvider`
    - Export `isValidEmail`, `isValidPhone`, `generateScrapingReport`
    - Maintain existing exports
    - _Requirements: All (enables testing)_

- [ ] 10. Add error handling for new components
  - [x] 10.1 Add error handling to normalization functions
    - Handle empty name input (return empty string, log warning)
    - Handle names with no alphabetic characters
    - Handle extremely long names (truncate to 100 chars)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [x] 10.2 Add error handling to validation functions
    - Handle null/undefined inputs gracefully
    - Ensure validation never throws exceptions
    - Log all validation errors
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_
  
  - [x] 10.3 Add error handling to report generation
    - Handle report write failures (log to console, continue)
    - Handle missing reports directory (create it)
    - Ensure scraping completes even if reporting fails
    - _Requirements: 6.6, 6.7_

- [ ] 11. Final checkpoint - Integration testing
  - [x] 11.1 Run full scraping process with test data
    - Verify duplicate detection works (no duplicate files created)
    - Verify insurance information is extracted
    - Verify validation warnings are generated
    - Verify report is created with correct information
    - _Requirements: All_
  
  - [x] 11.2 Test with actual RTC website
    - Run scraper against live website
    - Verify Jeffrey Gillman only creates one file
    - Check if insurance information is now extracted
    - Review validation report for issues
    - _Requirements: All_

- [ ] 12. Documentation updates
  - [x] 12.1 Update comments in `src/scrape-providers.js`
    - Document new functions with JSDoc comments
    - Explain normalization logic
    - Document validation rules
    - _Requirements: All_
  
  - [x] 12.2 Add usage notes to `prompts/scraping-instructions.txt`
    - Document the enhanced insurance extraction guidance
    - Explain why insurance emphasis is important
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check library (100+ iterations each)
- Unit tests validate specific examples and edge cases
- The scraper maintains backward compatibility with existing functionality
- All validation is non-blocking to ensure scraping completes successfully
