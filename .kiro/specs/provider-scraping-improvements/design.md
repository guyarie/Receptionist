# Design Document: Provider Scraping Improvements

## Overview

This design enhances the existing provider profile scraping system (`src/scrape-providers.js`) to eliminate duplicate provider files and improve insurance information extraction. The solution introduces name normalization, duplicate detection, enhanced AI prompting, and comprehensive data validation while maintaining the current architecture of fetching HTML, extracting text, using OpenRouter API for structured extraction, and writing markdown files.

## Architecture

The enhanced scraper maintains the existing pipeline architecture with new validation and normalization stages:

```
Website HTML → Text Extraction → AI Processing → Normalization → Validation → File Writing
                                                      ↓
                                              Duplicate Detection
```

Key architectural decisions:
- Name normalization occurs after AI extraction but before file operations
- Duplicate detection uses filesystem checks rather than maintaining state
- Validation is non-blocking (warnings only) to ensure scraping completes
- Enhanced prompting improves AI extraction without changing the API contract

## Components and Interfaces

### Name Normalizer

**Purpose:** Convert provider names to consistent, canonical slug format

**Interface:**
```javascript
/**
 * Normalize a provider name to a canonical slug
 * @param {string} fullName - Provider name with credentials, middle initials, etc.
 * @returns {string} Normalized slug (e.g., "jeffrey-gillman")
 */
function normalizeProviderName(fullName)

/**
 * Extract first and last name components from full name
 * @param {string} fullName - Provider name
 * @returns {object} { firstName: string, lastName: string }
 */
function extractNameComponents(fullName)
```

**Implementation approach:**
1. Remove credentials using regex pattern matching (PhD, LMFT, LCSW, PsyD, etc.)
2. Remove middle initials (single letters followed by period or standalone)
3. Extract first and last name (first word and last word after cleaning)
4. Apply existing `nameToSlug()` function to the cleaned name

**Credential patterns to remove:**
- PhD, PsyD, MD, DO
- LMFT, LCSW, LMHC, LPC, LPCC
- MA, MS, MSW, MEd
- Any combination with commas (e.g., "PhD, LMFT")

### Duplicate Detector

**Purpose:** Identify existing provider files to prevent duplicates

**Interface:**
```javascript
/**
 * Check if a provider file already exists
 * @param {string} slug - Normalized provider slug
 * @param {string} providersDir - Directory containing provider files
 * @returns {boolean} True if file exists
 */
function providerFileExists(slug, providersDir)

/**
 * Find existing provider file path
 * @param {string} slug - Normalized provider slug
 * @param {string} providersDir - Directory containing provider files
 * @returns {string|null} File path if exists, null otherwise
 */
function findExistingProviderFile(slug, providersDir)
```

**Implementation approach:**
- Use `fs.existsSync()` to check for file existence
- Construct expected file path from normalized slug
- Return boolean for existence checks, path for update operations

### Insurance Parser

**Purpose:** Extract and structure insurance information from AI-generated content

**Interface:**
```javascript
/**
 * Parse insurance information from provider content
 * @param {string} content - Provider markdown content
 * @returns {string[]} Array of insurance provider names
 */
function parseInsuranceFromContent(content)

/**
 * Validate insurance data structure
 * @param {any} insuranceData - Insurance data from AI response
 * @returns {string[]} Validated array of insurance names
 */
function validateInsuranceData(insuranceData)
```

**Implementation approach:**
- Extract insurance section from markdown using regex
- Parse bullet lists, comma-separated values, or paragraph mentions
- Return empty array if no insurance found (not placeholder text)
- Handle various formats: "- Aetna", "Accepts: Aetna, Blue Cross", "Aetna and Blue Cross"

### Data Validator

**Purpose:** Verify extracted provider data meets quality standards

**Interface:**
```javascript
/**
 * Validate provider data structure and content
 * @param {object} provider - Provider object from AI extraction
 * @returns {object} { valid: boolean, warnings: string[] }
 */
function validateProvider(provider)

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid format
 */
function isValidEmail(email)

/**
 * Validate phone number format
 * @param {string} phone - Phone number
 * @returns {boolean} True if valid format
 */
function isValidPhone(phone)
```

**Validation rules:**
- Required fields: name, content
- Email format: standard regex pattern
- Phone format: digits, spaces, parentheses, hyphens only
- Insurance: warn if empty array
- Credentials: warn if missing from content

### Enhanced Prompt Builder

**Purpose:** Construct improved AI extraction prompts with insurance emphasis

**Interface:**
```javascript
/**
 * Build enhanced scraping prompt with insurance emphasis
 * @param {string} baseInstructions - Base scraping instructions
 * @param {string} websiteContent - Extracted website text
 * @returns {string} Complete prompt for AI
 */
function buildEnhancedPrompt(baseInstructions, websiteContent)
```

**Prompt enhancements:**
1. Multiple emphatic statements about insurance importance
2. Examples of insurance information locations
3. Explicit JSON structure for insurance field
4. Checklist reminder to verify insurance extraction
5. Instructions to search multiple content sections

**Enhanced prompt additions:**
```
CRITICAL: Insurance information is ESSENTIAL for each provider.
- Look for sections mentioning "Insurance", "Accepted Insurance", "Insurance Accepted"
- Check provider bio sections for insurance mentions
- Search for insurance company names (Aetna, Blue Cross, Cigna, UnitedHealthcare, etc.)
- If found, extract as array of strings: "insurance": ["Aetna", "Blue Cross Blue Shield"]
- If not found, return empty array: "insurance": []
- DO NOT use placeholder text like "Insurance information not provided"

VERIFICATION CHECKLIST:
[ ] Did I check for insurance information in the provider's section?
[ ] Did I search for common insurance provider names?
[ ] Did I return an array (not a string) for insurance?
```

### Report Generator

**Purpose:** Generate detailed scraping reports for administrators

**Interface:**
```javascript
/**
 * Generate scraping report
 * @param {object} results - Scraping results with providers and operations
 * @returns {string} Formatted report content
 */
function generateScrapingReport(results)

/**
 * Write report to file
 * @param {string} reportContent - Report text
 * @param {string} reportsDir - Reports directory path
 * @returns {string} Report file path
 */
function writeReport(reportContent, reportsDir)
```

**Report structure:**
```
Provider Scraping Report
Generated: [timestamp]

Summary:
- Total providers processed: X
- New files created: Y
- Existing files updated: Z
- Validation warnings: W

Providers:
1. [Name] → [slug].md [NEW/UPDATED]
   Warnings: [list of warnings]
   Insurance: [found/missing]

Validation Issues:
- [Provider]: Missing insurance information
- [Provider]: Invalid email format

Recommendations:
[Suggestions based on validation results]
```

## Data Models

### Provider Object (from AI)

```javascript
{
  name: string,              // Full name with credentials
  slug: string,              // AI-generated slug (will be replaced)
  content: string,           // Markdown content
  insurance: string[]        // NEW: Array of insurance providers
}
```

### Enhanced Provider Object (after normalization)

```javascript
{
  name: string,              // Original full name
  normalizedSlug: string,    // Canonical slug from normalizer
  originalSlug: string,      // AI-generated slug
  content: string,           // Markdown content
  insurance: string[],       // Insurance providers
  validation: {
    warnings: string[],
    hasInsurance: boolean,
    hasValidEmail: boolean,
    hasValidPhone: boolean
  }
}
```

### Scraping Results

```javascript
{
  practiceOverview: string,
  providers: EnhancedProvider[],
  operations: {
    created: string[],       // Slugs of new files
    updated: string[],       // Slugs of updated files
  },
  validationSummary: {
    totalWarnings: number,
    providersWithoutInsurance: string[],
    providersWithInvalidContact: string[]
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Name normalization is idempotent

*For any* provider name string, normalizing it twice should produce the same result as normalizing it once.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

### Property 2: Normalized names contain only valid slug characters

*For any* provider name string, the normalized slug should contain only lowercase letters, hyphens, and no consecutive hyphens.

**Validates: Requirements 1.3, 1.4**

### Property 3: Name variants normalize to same slug

*For any* provider represented by multiple name variants (with/without middle initial, with/without credentials), all variants should normalize to the same canonical slug.

**Validates: Requirements 1.1, 1.2, 1.6**

### Property 4: Duplicate detection prevents file overwrites

*For any* set of providers where multiple entries have the same normalized slug, only one file should exist after scraping completes.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 5: Insurance data is always an array

*For any* provider object returned by the AI extractor, the insurance field should be an array (empty or populated), never a string or placeholder message.

**Validates: Requirements 3.3, 4.3**

### Property 6: Validation warnings are non-blocking

*For any* provider with validation warnings, the scraper should still create or update the provider file and continue processing remaining providers.

**Validates: Requirements 4.7**

### Property 7: Email validation accepts standard formats

*For any* email address matching the pattern `[local]@[domain].[tld]`, the email validator should return true.

**Validates: Requirements 4.4**

### Property 8: Phone validation accepts standard formats

*For any* phone number containing only digits, spaces, parentheses, and hyphens, the phone validator should return true.

**Validates: Requirements 4.5**

### Property 9: Report generation is comprehensive

*For any* scraping execution, the generated report should include counts for all providers processed, files created, files updated, and validation warnings.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

## Error Handling

### Name Normalization Errors
- **Empty name input**: Return empty string, log warning
- **Name with no alphabetic characters**: Return empty string, log warning
- **Extremely long names**: Truncate to reasonable length (100 chars), log warning

### Duplicate Detection Errors
- **Filesystem access errors**: Log error, assume file doesn't exist, continue
- **Permission errors**: Log error, attempt to create file anyway

### AI Extraction Errors
- **Invalid JSON response**: Log full response, exit with error (existing behavior)
- **Missing required fields**: Log warning, use empty values, continue
- **Malformed insurance data**: Convert to empty array, log warning

### Validation Errors
- **Invalid email format**: Log warning, include in report, continue
- **Invalid phone format**: Log warning, include in report, continue
- **Missing insurance**: Log warning, include in report, continue

### File Writing Errors
- **Directory creation failure**: Exit with error (existing behavior)
- **File write failure**: Log error, continue with next provider
- **Report write failure**: Log error to console, continue (report is optional)

### Error Recovery Strategy
- Validation errors are non-blocking (warnings only)
- File operation errors are logged but don't stop processing
- AI extraction errors are fatal (maintain existing behavior)
- All errors are included in the final report

## Testing Strategy

### Unit Testing

Unit tests will verify specific examples and edge cases:

**Name Normalization:**
- "Jeffrey B. Gillman, PhD" → "jeffrey-gillman"
- "Miri Arie, PhD, LMFT" → "miri-arie"
- "John Q. Public" → "john-public"
- "Mary-Jane O'Brien, LCSW" → "mary-jane-obrien"

**Duplicate Detection:**
- File exists returns true for existing files
- File exists returns false for non-existent files
- Finding existing file returns correct path

**Insurance Parsing:**
- Bullet list format extraction
- Comma-separated format extraction
- Paragraph mention extraction
- Empty section handling

**Validation:**
- Valid email formats pass
- Invalid email formats fail
- Valid phone formats pass
- Invalid phone formats fail

### Property-Based Testing

Property tests will verify universal correctness across randomized inputs using a JavaScript property-based testing library (fast-check). Each test will run a minimum of 100 iterations.

**Configuration:**
- Library: fast-check (npm package)
- Minimum iterations: 100 per property
- Tag format: `// Feature: provider-scraping-improvements, Property N: [property text]`

**Property Test Implementation:**

1. **Idempotence test** (Property 1):
   - Generate random provider names with credentials and middle initials
   - Verify `normalize(normalize(name)) === normalize(name)`
   - Tag: `// Feature: provider-scraping-improvements, Property 1: Name normalization is idempotent`

2. **Slug character validation** (Property 2):
   - Generate random provider names
   - Verify normalized slug matches `/^[a-z]+(-[a-z]+)*$/`
   - Tag: `// Feature: provider-scraping-improvements, Property 2: Normalized names contain only valid slug characters`

3. **Name variant equivalence** (Property 3):
   - Generate base name, create variants with/without middle initial and credentials
   - Verify all variants normalize to same slug
   - Tag: `// Feature: provider-scraping-improvements, Property 3: Name variants normalize to same slug`

4. **Insurance array type** (Property 5):
   - Generate random provider objects
   - Verify insurance field is always an array
   - Tag: `// Feature: provider-scraping-improvements, Property 5: Insurance data is always an array`

5. **Email validation** (Property 7):
   - Generate valid email addresses
   - Verify validator returns true for all valid formats
   - Tag: `// Feature: provider-scraping-improvements, Property 7: Email validation accepts standard formats`

6. **Phone validation** (Property 8):
   - Generate valid phone numbers with various formatting
   - Verify validator returns true for all valid formats
   - Tag: `// Feature: provider-scraping-improvements, Property 8: Phone validation accepts standard formats`

**Testing Balance:**
- Unit tests focus on specific examples and integration between components
- Property tests verify universal correctness across all possible inputs
- Both approaches are complementary and necessary for comprehensive coverage
- Property tests catch edge cases that unit tests might miss
- Unit tests provide concrete examples that document expected behavior
