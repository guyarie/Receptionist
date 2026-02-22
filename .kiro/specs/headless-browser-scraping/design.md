# Design Document: Headless Browser Scraping

## Overview

This design enhances the provider scraping system by replacing the axios HTTP client with Puppeteer, a headless browser automation library. The current implementation fetches static HTML which misses JavaScript-rendered content, particularly insurance information. By using Puppeteer to execute JavaScript and wait for dynamic content to load, we capture the complete page state before extraction.

The design maintains backward compatibility with the existing AI extraction pipeline, validation logic, and file generation system. The only change is in the content fetching layer, which now uses a headless browser instead of a simple HTTP client.

## Architecture

### Current Architecture
```
fetchWebsite(url) [axios]
  ↓
extractText(html) [cheerio]
  ↓
generateSummaries(text) [OpenRouter AI]
  ↓
writeProviderFiles(summaries)
  ↓
generateScrapingReport(results)
```

### New Architecture
```
fetchWebsite(url) [Puppeteer OR axios]
  ↓
extractText(html) [cheerio]
  ↓
generateSummaries(text) [OpenRouter AI]
  ↓
writeProviderFiles(summaries)
  ↓
generateScrapingReport(results)
```

The key change is that `fetchWebsite()` becomes mode-aware, using either Puppeteer or axios based on configuration. All downstream components remain unchanged.

## Components and Interfaces

### 1. Browser Manager Module

A new module `src/browser-manager.js` encapsulates Puppeteer operations:

```javascript
// src/browser-manager.js

/**
 * Launches a headless browser instance
 * @param {object} options - Browser launch options
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function launchBrowser(options = {})

/**
 * Fetches a URL using headless browser
 * @param {Browser} browser - Puppeteer browser instance
 * @param {string} url - URL to fetch
 * @param {object} options - Page options (timeout, waitUntil)
 * @returns {Promise<string>} Rendered HTML content
 */
async function fetchWithBrowser(browser, url, options = {})

/**
 * Closes browser instance safely
 * @param {Browser} browser - Puppeteer browser instance
 * @returns {Promise<void>}
 */
async function closeBrowser(browser)
```

### 2. Modified Scraper Module

The existing `src/scrape-providers.js` is modified to support both modes:

```javascript
// Configuration at top of file
const SCRAPING_MODE = process.env.SCRAPING_MODE || 'puppeteer'; // 'puppeteer' or 'axios'
const PAGE_LOAD_TIMEOUT = parseInt(process.env.PAGE_LOAD_TIMEOUT) || 10000;

/**
 * Fetches website content using configured method
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} HTML content
 */
async function fetchWebsite(url) {
  if (SCRAPING_MODE === 'puppeteer') {
    return fetchWithPuppeteer(url);
  } else {
    return fetchWithAxios(url);
  }
}

/**
 * Fetches website using Puppeteer (new)
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} Rendered HTML content
 */
async function fetchWithPuppeteer(url)

/**
 * Fetches website using axios (existing logic)
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} Static HTML content
 */
async function fetchWithAxios(url)
```

### 3. Configuration Interface

Environment variables control scraping behavior:

```bash
# .env additions
SCRAPING_MODE=puppeteer          # 'puppeteer' or 'axios'
PAGE_LOAD_TIMEOUT=10000          # Milliseconds to wait for page load
BROWSER_HEADLESS=true            # Run browser in headless mode
BROWSER_DISABLE_IMAGES=true      # Disable image loading for performance
```

## Data Models

No changes to existing data models. The scraper continues to produce:

```javascript
// Output from generateSummaries()
{
  practiceOverview: string,
  providers: [
    {
      name: string,
      title: string,
      specialties: string[],
      insurance: string[],      // Now populated with dynamic content
      email: string,
      phone: string,
      bio: string
    }
  ]
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Complete Visible Content Capture

*For any* provider page with visible text content in a standard browser, the Puppeteer-based scraper should extract HTML that contains all that visible text content.

**Validates: Requirements 2.3, 2.4**

### Property 2: Output Format Consistency

*For any* provider data extracted by the scraper, the generated markdown file should match the established format structure (frontmatter with metadata fields, followed by bio section).

**Validates: Requirements 3.3**

### Property 3: Error Reporting Completeness

*For any* error that occurs during scraping (timeout, navigation failure, parsing error), the scraping report should contain details about that error including the provider name and error type.

**Validates: Requirements 4.4**

### Property 4: Resource Cleanup on Error

*For any* error that occurs during Puppeteer scraping, all browser instances should be properly closed and no browser processes should remain running after the scraper exits.

**Validates: Requirements 4.5**

## Error Handling

### Browser Launch Failures

When Puppeteer fails to launch a browser (missing Chrome/Chromium, insufficient permissions, etc.):
- Log clear error message with installation instructions
- Exit gracefully with non-zero exit code
- Suggest fallback to axios mode if available

```javascript
try {
  browser = await puppeteer.launch(options);
} catch (error) {
  console.error('❌ Failed to launch browser:', error.message);
  console.error('💡 Ensure Chrome/Chromium is installed');
  console.error('💡 Or set SCRAPING_MODE=axios to use fallback mode');
  process.exit(1);
}
```

### Page Load Timeouts

When a page fails to load within the timeout period:
- Log warning with provider name and URL
- Retry up to 3 times with exponential backoff
- After 3 failures, skip provider and continue
- Include failure in scraping report

```javascript
let retries = 0;
while (retries < 3) {
  try {
    await page.goto(url, { timeout: PAGE_LOAD_TIMEOUT });
    break;
  } catch (error) {
    retries++;
    if (retries === 3) {
      console.error(`❌ Failed to load ${url} after 3 attempts`);
      return null; // Skip this provider
    }
    await sleep(1000 * retries); // Exponential backoff
  }
}
```

### Navigation Errors

When page navigation fails (DNS errors, 404s, network issues):
- Log error with details
- Retry with same logic as timeouts
- Include in scraping report
- Continue with next provider

### Memory and Resource Issues

When browser consumes excessive memory:
- Set memory limits in Puppeteer launch options
- Monitor page count and close unused pages
- Restart browser instance if memory threshold exceeded
- Log resource usage in verbose mode

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure correctness:

**Unit Tests** focus on:
- Specific examples (Jeffrey Gillman's insurance data extraction)
- Edge cases (timeout handling, missing Chrome, malformed HTML)
- Integration points (browser manager → scraper → AI pipeline)
- Configuration switching (axios vs Puppeteer modes)
- Error conditions (launch failures, navigation errors)

**Property-Based Tests** focus on:
- Universal properties across all provider pages
- Content completeness verification
- Output format consistency
- Error handling guarantees
- Resource cleanup verification

### Property-Based Testing Configuration

We'll use **fast-check** for property-based testing in JavaScript:

```bash
npm install --save-dev fast-check
```

Each property test will:
- Run minimum 100 iterations to ensure comprehensive coverage
- Generate random test data (HTML structures, provider data, error conditions)
- Reference the design document property it validates
- Use tags in the format: `Feature: headless-browser-scraping, Property N: [property text]`

### Test Organization

```
tests/
├── unit/
│   ├── browser-manager.test.js      # Browser launch, page loading, cleanup
│   ├── scraper-integration.test.js  # Mode switching, configuration
│   ├── error-handling.test.js       # Timeout, retry, error reporting
│   └── backward-compat.test.js      # Output format, CLI options
└── property/
    ├── content-capture.property.js  # Property 1: Complete content capture
    ├── format-consistency.property.js # Property 2: Output format
    ├── error-reporting.property.js  # Property 3: Error completeness
    └── resource-cleanup.property.js # Property 4: Browser cleanup
```

### Key Test Scenarios

**Unit Test Examples:**
1. Jeffrey Gillman insurance extraction (validates specific known data)
2. Timeout handling with mock slow-loading page
3. Browser launch failure simulation
4. Axios mode fallback verification
5. Configuration option parsing

**Property Test Examples:**
1. For any HTML with visible text, extracted content contains that text
2. For any provider data, output markdown matches format schema
3. For any error type, scraping report includes error details
4. For any error during scraping, no browser processes remain

### Test Data

Create test fixtures:
- `tests/fixtures/sample-provider-page.html` - Complete provider page with insurance data
- `tests/fixtures/dynamic-content-page.html` - Page with JavaScript-loaded content
- `tests/fixtures/minimal-provider-page.html` - Minimal valid provider page
- `tests/fixtures/malformed-page.html` - Invalid HTML for error testing

### Continuous Integration

Tests should run on:
- Windows (development environment)
- Linux (production environment)
- Both Node.js v20 and v22

CI environment needs:
- Chrome/Chromium installed
- Sufficient memory for headless browser
- Network access for integration tests (or mocked)

## Implementation Notes

### Puppeteer Configuration

Recommended launch options for production:

```javascript
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions'
  ],
  defaultViewport: {
    width: 1280,
    height: 720
  }
});
```

### Performance Optimization

To minimize performance impact:
1. Disable images: `page.setRequestInterception(true)` and block image requests
2. Disable CSS: Block stylesheet requests
3. Reuse browser instance across all provider pages
4. Set aggressive timeout (10s default)
5. Use `waitUntil: 'domcontentloaded'` instead of `'networkidle0'`

### Wait Strategy

For dynamic content, use a smart wait strategy:

```javascript
// Wait for specific selectors that indicate content is loaded
await page.waitForSelector('.provider-insurance', { 
  timeout: 5000 
}).catch(() => {
  // Insurance section might not exist, continue anyway
});

// Or wait for network to be mostly idle
await page.goto(url, { 
  waitUntil: 'networkidle2',  // Wait until 2 or fewer connections
  timeout: PAGE_LOAD_TIMEOUT 
});
```

### Backward Compatibility

To ensure seamless transition:
1. Keep axios implementation intact as fallback
2. Default to Puppeteer but allow easy switching
3. Maintain identical output format
4. Preserve all existing CLI options
5. Keep same error exit codes

### Migration Path

Recommended rollout:
1. Deploy with `SCRAPING_MODE=axios` (no change)
2. Test Puppeteer mode in development
3. Run both modes and compare outputs
4. Switch to `SCRAPING_MODE=puppeteer` in production
5. Monitor for issues, fallback to axios if needed
6. After stable period, make Puppeteer the default

## Dependencies

New dependencies to add:

```json
{
  "dependencies": {
    "puppeteer": "^22.0.0"
  },
  "devDependencies": {
    "fast-check": "^3.15.0"
  }
}
```

Puppeteer will automatically download a compatible Chrome binary (~170MB) during installation.

## Configuration Reference

Complete environment variable reference:

```bash
# Scraping mode selection
SCRAPING_MODE=puppeteer          # 'puppeteer' or 'axios' (default: puppeteer)

# Puppeteer-specific settings
PAGE_LOAD_TIMEOUT=10000          # Page load timeout in ms (default: 10000)
BROWSER_HEADLESS=true            # Run browser in headless mode (default: true)
BROWSER_DISABLE_IMAGES=true      # Disable image loading (default: true)
BROWSER_DISABLE_CSS=false        # Disable CSS loading (default: false)

# Retry settings
MAX_RETRIES=3                    # Max retry attempts for failed pages (default: 3)
RETRY_DELAY=1000                 # Initial retry delay in ms (default: 1000)
```

## Security Considerations

### Sandboxing

Puppeteer runs Chrome in a sandbox by default. In production environments (especially containers), you may need `--no-sandbox` flag, but this reduces security isolation.

### Resource Limits

Set memory and CPU limits to prevent resource exhaustion:
- Use Docker memory limits if containerized
- Set Node.js `--max-old-space-size` flag
- Monitor browser process memory usage
- Implement circuit breaker for repeated failures

### Input Validation

Even though we control the URLs being scraped, validate:
- URL format before passing to Puppeteer
- Response content type (should be HTML)
- Response size (reject excessively large responses)

## Monitoring and Observability

Add metrics for:
- Scraping duration per provider
- Success/failure rates
- Browser launch time
- Memory usage during scraping
- Insurance data extraction success rate

Log structured data for analysis:

```javascript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  provider: providerName,
  mode: SCRAPING_MODE,
  duration: elapsedMs,
  success: true,
  insuranceFound: hasInsurance
}));
```
