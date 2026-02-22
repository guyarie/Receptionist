# Requirements Document

## Introduction

This feature enhances the provider scraping system to extract detailed information from individual provider pages rather than relying solely on homepage content. The current implementation scrapes only the homepage, missing critical information like insurance details that exist on individual provider pages. This enhancement will enable comprehensive data extraction by visiting each provider's dedicated page and processing them individually.

## Glossary

- **Homepage**: The main website page at https://www.rtcbellevue.com
- **Provider_Page**: An individual provider's dedicated page (e.g., https://www.rtcbellevue.com/jeff)
- **Provider_Link**: A URL pointing to a Provider_Page, typically found under "Meet the Team" menu
- **Scraper**: The system component responsible for fetching and extracting website content
- **LLM**: Large Language Model used for AI-powered content extraction via OpenRouter API
- **Provider_Markdown**: The generated markdown file containing structured provider information
- **Cache_Entry**: A stored copy of scraped HTML and extracted text for debugging purposes
- **Slug**: A normalized, URL-friendly identifier derived from a provider's name (e.g., "jeffrey-gillman")

## Requirements

### Requirement 1: Provider Link Discovery

**User Story:** As a system administrator, I want the scraper to automatically discover all provider pages from the homepage, so that I don't need to manually maintain a list of provider URLs.

#### Acceptance Criteria

1. WHEN the Scraper fetches the homepage, THE Scraper SHALL extract all Provider_Links from the "Meet the Team" menu section
2. WHEN extracting Provider_Links, THE Scraper SHALL validate that each link points to a valid provider page URL
3. WHEN a Provider_Link is malformed or inaccessible, THE Scraper SHALL log a warning and continue processing remaining providers
4. THE Scraper SHALL return a list of discovered Provider_Links for subsequent processing

### Requirement 2: Individual Provider Page Scraping

**User Story:** As a system administrator, I want each provider's page to be scraped separately, so that complete information including insurance details is captured.

#### Acceptance Criteria

1. WHEN the Scraper processes a Provider_Link, THE Scraper SHALL fetch the complete HTML content from that Provider_Page
2. WHEN fetching a Provider_Page, THE Scraper SHALL use the existing fetchWebsite function with retry logic and error handling
3. WHEN a Provider_Page fetch fails after all retries, THE Scraper SHALL log the error with provider name and continue processing remaining providers
4. WHEN a Provider_Page is successfully fetched, THE Scraper SHALL extract text content using the existing extractText function
5. FOR ALL Provider_Pages, the Scraper SHALL maintain the same scraping mode configuration (Puppeteer or axios) as the homepage

### Requirement 3: Per-Provider LLM Processing

**User Story:** As a system administrator, I want each provider's content to be sent to the LLM individually, so that the AI has full context from their dedicated page for accurate extraction.

#### Acceptance Criteria

1. WHEN the Scraper has extracted text from a Provider_Page, THE Scraper SHALL send that text to the LLM as a separate API call
2. WHEN calling the LLM for a provider, THE Scraper SHALL use a modified prompt that focuses on extracting a single provider's information
3. WHEN the LLM returns provider data, THE Scraper SHALL validate the response structure contains required fields (name, content)
4. WHEN LLM processing fails for a provider, THE Scraper SHALL log the error with provider name and continue processing remaining providers
5. THE Scraper SHALL track successful and failed LLM calls for reporting purposes

### Requirement 4: Individual Provider File Generation

**User Story:** As a system administrator, I want each provider's data to be saved to a separate markdown file immediately after processing, so that partial results are preserved even if the scraper fails partway through.

#### Acceptance Criteria

1. WHEN the LLM returns valid provider data, THE Scraper SHALL generate a Provider_Markdown file using the existing writeProviderFiles logic
2. WHEN generating a Provider_Markdown file, THE Scraper SHALL use the existing normalization and duplicate detection logic
3. WHEN a Provider_Markdown file is created or updated, THE Scraper SHALL track the operation (created/updated) for reporting
4. THE Scraper SHALL validate provider data using the existing validateProvider function before writing files
5. WHEN validation warnings occur, THE Scraper SHALL log warnings but continue with file creation (non-blocking validation)

### Requirement 5: Per-Provider Caching

**User Story:** As a developer, I want each provider's scraped content cached separately, so that I can debug extraction issues for individual providers without re-scraping everything.

#### Acceptance Criteria

1. WHEN the Scraper successfully fetches a Provider_Page, THE Scraper SHALL save a Cache_Entry with the provider's name in the filename
2. WHEN creating a Cache_Entry, THE Scraper SHALL include the provider name, URL, HTML content, and extracted text
3. WHEN saving a Cache_Entry fails, THE Scraper SHALL log a warning and continue processing (caching is non-critical)
4. THE Scraper SHALL store Cache_Entries in the existing data/scrape-cache directory with provider-specific filenames

### Requirement 6: Error Handling and Resilience

**User Story:** As a system administrator, I want the scraper to handle individual provider failures gracefully, so that one problematic provider doesn't prevent others from being processed.

#### Acceptance Criteria

1. WHEN a Provider_Page fetch fails, THE Scraper SHALL log the error with provider name, URL, error type, and retry attempts
2. WHEN an LLM call fails for a provider, THE Scraper SHALL log the error and continue processing remaining providers
3. WHEN a file write operation fails for a provider, THE Scraper SHALL log the error and continue processing remaining providers
4. THE Scraper SHALL collect all errors during processing and include them in the final scraping report
5. IF the homepage fetch fails, THEN THE Scraper SHALL exit immediately with an error (cannot discover providers without homepage)

### Requirement 7: Progress Tracking and Reporting

**User Story:** As a system administrator, I want detailed progress information during scraping, so that I can monitor the process and identify issues quickly.

#### Acceptance Criteria

1. WHEN processing providers, THE Scraper SHALL log "Processing provider X of Y: [name]" for each provider
2. WHEN a provider is successfully processed, THE Scraper SHALL log the duration in milliseconds
3. WHEN all providers are processed, THE Scraper SHALL generate a comprehensive report including per-provider success/failure status
4. THE Scraper SHALL include error details in the report grouped by error type (timeout, navigation, parsing, LLM, other)
5. THE Scraper SHALL maintain existing report sections (summary, insurance statistics, validation issues, recommendations)

### Requirement 8: Backward Compatibility

**User Story:** As a developer, I want the new multi-page scraping to reuse existing functions and maintain compatibility, so that existing features and configurations continue to work.

#### Acceptance Criteria

1. THE Scraper SHALL reuse the existing fetchWebsite function for both homepage and Provider_Pages
2. THE Scraper SHALL reuse the existing extractText function for all content extraction
3. THE Scraper SHALL reuse the existing saveScrapeCache function with provider-specific filenames
4. THE Scraper SHALL reuse the existing validateProvider, normalizeProviderName, and file writing functions
5. THE Scraper SHALL maintain compatibility with all existing environment variables (SCRAPING_MODE, PAGE_LOAD_TIMEOUT, etc.)
6. THE Scraper SHALL preserve the existing report format and add new sections for per-provider errors

### Requirement 9: Practice Overview Handling

**User Story:** As a system administrator, I want the practice overview to still be extracted from the homepage, so that general practice information remains available.

#### Acceptance Criteria

1. WHEN the Scraper processes the homepage, THE Scraper SHALL extract practice overview information using the LLM
2. THE Scraper SHALL save the practice overview to data/practice/practice-overview.md as before
3. THE Scraper SHALL use a separate LLM call for practice overview extraction with appropriate prompts
4. IF practice overview extraction fails, THE Scraper SHALL log a warning but continue with provider processing
