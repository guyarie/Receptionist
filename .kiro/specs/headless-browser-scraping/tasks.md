# Implementation Plan: Headless Browser Scraping

## Overview

This implementation adds Puppeteer-based headless browser scraping to capture JavaScript-rendered content from provider pages. The approach maintains backward compatibility by keeping the axios implementation as a fallback and making the scraping mode configurable. All downstream components (AI extraction, validation, file generation) remain unchanged.

## Tasks

- [ ] 1. Set up Puppeteer dependency and browser manager module
  - Install puppeteer package (~170MB Chrome binary will download)
  - Create `src/browser-manager.js` with browser lifecycle functions
  - Add environment variables to `.env.example` for Puppeteer configuration
  - _Requirements: 1.1, 5.1, 7.5_

- [ ] 2. Implement browser manager core functionality
  - [ ] 2.1 Implement `launchBrowser()` function with production-ready options
    - Configure headless mode, sandbox settings, viewport size
    - Add error handling for missing Chrome/Chromium with actionable messages
    - _Requirements: 1.1, 4.2, 7.3_
  
  - [ ]* 2.2 Write unit tests for browser launch scenarios
    - Test successful launch with default options
    - Test launch failure handling and error messages
    - Test headless vs headed mode configuration
    - _Requirements: 7.3, 4.2_
  
  - [ ] 2.3 Implement `fetchWithBrowser()` function for page loading
    - Navigate to URL with configurable timeout
    - Wait for dynamic content using appropriate wait strategy
    - Extract and return rendered HTML content
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [ ]* 2.4 Write unit tests for page fetching
    - Test successful page load and HTML extraction
    - Test timeout handling with slow-loading pages
    - Test navigation error handling
    - _Requirements: 4.1, 4.3_
  
  - [ ] 2.5 Implement `closeBrowser()` function with proper cleanup
    - Close browser instance safely
    - Handle errors during cleanup
    - Ensure no processes remain after exit
    - _Requirements: 4.5, 6.2_
  
  - [ ]* 2.6 Write property test for resource cleanup
    - **Property 4: Resource Cleanup on Error**
    - **Validates: Requirements 4.5**
    - For any error during scraping, verify no browser processes remain running

- [ ] 3. Checkpoint - Ensure browser manager tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Modify scraper to support dual modes
  - [ ] 4.1 Add configuration constants at top of `src/scrape-providers.js`
    - Add SCRAPING_MODE, PAGE_LOAD_TIMEOUT, and other config variables
    - Load from environment with sensible defaults
    - _Requirements: 5.1, 5.4, 5.5_
  
  - [ ] 4.2 Refactor existing `fetchWebsite()` to `fetchWithAxios()`
    - Rename function to make mode explicit
    - Keep all existing axios logic unchanged
    - _Requirements: 3.1, 5.2_
  
  - [ ] 4.3 Implement new `fetchWithPuppeteer()` function
    - Import browser manager functions
    - Launch browser, fetch page, extract HTML, close browser
    - Add retry logic with exponential backoff (up to 3 attempts)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.3_
  
  - [ ]* 4.4 Write unit test for retry logic
    - Simulate navigation failures and verify 3 retry attempts
    - Verify exponential backoff delays
    - _Requirements: 4.3_
  
  - [ ] 4.5 Implement mode-aware `fetchWebsite()` dispatcher
    - Check SCRAPING_MODE configuration
    - Call appropriate fetch function (Puppeteer or axios)
    - Log which mode is being used
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 4.6 Write unit tests for mode switching
    - Test Puppeteer mode selection
    - Test axios mode selection
    - Test default mode (should be Puppeteer)
    - _Requirements: 5.2, 5.3, 5.4_

- [ ] 5. Optimize Puppeteer performance
  - [ ] 5.1 Implement request interception to disable images and CSS
    - Enable request interception on page
    - Block image and stylesheet requests
    - Allow document, script, and XHR requests
    - _Requirements: 6.4_
  
  - [ ] 5.2 Implement browser instance reuse for multiple providers
    - Modify main() to launch browser once before loop
    - Pass browser instance to fetchWithPuppeteer()
    - Close browser after all providers processed
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 5.3 Write unit test for browser reuse
    - Mock multiple provider scrapes
    - Verify only one browser instance created
    - Verify browser closed after completion
    - _Requirements: 6.1, 6.2_

- [ ] 6. Enhance error handling and reporting
  - [ ] 6.1 Add error tracking to scraping operations
    - Track errors per provider (timeout, navigation, parsing)
    - Include error details in operations object
    - _Requirements: 4.1, 4.4_
  
  - [ ] 6.2 Update `generateScrapingReport()` to include error details
    - Add section for scraping errors with provider names
    - Include scraping mode used (axios or Puppeteer)
    - Add timing information per provider
    - _Requirements: 4.4, 8.4, 8.5_
  
  - [ ]* 6.3 Write property test for error reporting completeness
    - **Property 3: Error Reporting Completeness**
    - **Validates: Requirements 4.4**
    - For any error type, verify it appears in the scraping report
  
  - [ ] 6.4 Add progress logging during multi-provider scraping
    - Log "Processing provider X of Y" messages
    - Log duration for each provider
    - _Requirements: 6.5_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add validation and verification features
  - [ ] 8.1 Update report to show insurance data statistics
    - Count providers with insurance information
    - Count providers missing insurance information
    - Compare with previous run if available
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ]* 8.2 Write property test for content capture completeness
    - **Property 1: Complete Visible Content Capture**
    - **Validates: Requirements 2.3, 2.4**
    - For any provider page with visible text, verify extracted HTML contains that text
  
  - [ ]* 8.3 Write property test for output format consistency
    - **Property 2: Output Format Consistency**
    - **Validates: Requirements 3.3**
    - For any provider data, verify markdown file matches established format structure

- [ ] 9. Create test fixtures and integration tests
  - [ ] 9.1 Create test HTML fixtures in `tests/fixtures/`
    - Create sample-provider-page.html with insurance data
    - Create dynamic-content-page.html with JavaScript-loaded content
    - Create minimal-provider-page.html for basic testing
    - _Requirements: 2.2, 2.3_
  
  - [ ]* 9.2 Write integration test for Jeffrey Gillman's profile
    - Test extraction of "Premera, Regence, BCBS" insurance data
    - Verify data appears in generated markdown file
    - _Requirements: 2.2_
  
  - [ ]* 9.3 Write integration test for backward compatibility
    - Verify prompts/scraping-instructions.txt unchanged
    - Verify output format matches previous implementation
    - Verify CLI options still work
    - _Requirements: 3.2, 3.4, 3.5_

- [ ] 10. Update documentation and configuration
  - [ ] 10.1 Update `.env.example` with all new environment variables
    - Add SCRAPING_MODE, PAGE_LOAD_TIMEOUT, BROWSER_HEADLESS, etc.
    - Include comments explaining each option
    - _Requirements: 5.1, 5.5, 7.5_
  
  - [ ] 10.2 Update README.md with Puppeteer setup instructions
    - Document system dependencies (Chrome/Chromium)
    - Explain configuration options
    - Add troubleshooting section for common issues
    - _Requirements: 7.5_
  
  - [ ] 10.3 Create migration guide for switching modes
    - Document recommended rollout process
    - Explain how to compare axios vs Puppeteer outputs
    - Provide fallback instructions
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Browser manager module is isolated for easier testing and maintenance
- Backward compatibility is maintained throughout - axios mode remains functional
