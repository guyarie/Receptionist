# Design Document: Provider Filename Fix

## Overview

This bugfix modifies the provider scraping system to generate accurate filenames based on providers' actual names rather than professional titles. The solution adds a dedicated `fileName` field to the LLM response format, which contains only the first and last name without credentials. This approach is more reliable than parsing credentials from the full name string.

The fix maintains backward compatibility by keeping the existing `normalizeProviderName` function as a fallback for cases where the `fileName` field is missing or invalid.

## Architecture

The provider scraping system follows this flow:

1. **Provider Link Extraction**: Extract provider links from the main page
2. **Page Fetching**: Fetch individual provider pages
3. **LLM Extraction**: Send page content to LLM for structured data extraction
4. **Filename Generation**: Convert provider name to a slug for the filename
5. **File Writing**: Save provider data to markdown files

This bugfix modifies steps 3 and 4 to use a dedicated `fileName` field instead of parsing the full name.

## Components and Interfaces

### Modified Functions

#### `generateProviderPrompt(providerName, text)`

**Current Behavior:**
- Generates a prompt asking the LLM to return JSON with: name, content, email, phone, insurance
- The name field contains the full name with credentials

**New Behavior:**
- Add a `fileName` field to the requested JSON structure
- Explicitly instruct the LLM to provide first and last name only in this field
- Keep the existing `name` field unchanged for backward compatibility

**Interface:**
```javascript
function generateProviderPrompt(providerName, text)
// Input: providerName (string), text (string)
// Output: prompt string with updated JSON structure request
```

**Updated JSON Structure:**
```json
{
  "name": "Full Name with Credentials",
  "fileName": "FirstName LastName",
  "content": "Complete markdown content for provider file",
  "email": "email@example.com or null",
  "phone": "phone number or null",
  "insurance": ["Insurance Provider 1", "Insurance Provider 2"] or []
}
```

#### `callLLMForProvider(providerName, text)`

**Current Behavior:**
- Calls LLM with provider prompt
- Parses JSON response
- Validates required fields (name, content)
- Returns provider data object

**New Behavior:**
- Same as current, but also extract the `fileName` field from the response
- Validate that `fileName` contains only alphabetic characters and spaces
- Log a warning if `fileName` is missing or invalid
- Return provider data object with the new `fileName` field

**Interface:**
```javascript
async function callLLMForProvider(providerName, text)
// Input: providerName (string), text (string)
// Output: Promise<{name, fileName, content, email, phone, insurance}>
```

#### `processSingleProvider(providerLink, browser, index, total)`

**Current Behavior:**
- Fetches provider page
- Calls `callLLMForProvider` to extract data
- Uses `normalizeProviderName(providerData.name)` to generate slug
- Writes provider file using the slug

**New Behavior:**
- Same fetch and extraction steps
- Check if `providerData.fileName` exists and is valid
- If valid: use `nameToSlug(providerData.fileName)` to generate slug
- If invalid/missing: fall back to `normalizeProviderName(providerData.name)`
- Log which method was used for filename generation
- Write provider file using the slug

**Interface:**
```javascript
async function processSingleProvider(providerLink, browser, index, total)
// Input: providerLink (object), browser (Browser), index (number), total (number)
// Output: Promise<{success, providerName, slug, operation, warnings, error, duration}>
```

### Helper Functions

#### `validateFileName(fileName)`

**New Function:**
A helper function to validate the fileName field from the LLM response.

**Validation Rules:**
- Must be a non-empty string
- Must contain at least one alphabetic character
- Should only contain letters, spaces, and hyphens
- Should not exceed 100 characters

**Interface:**
```javascript
function validateFileName(fileName)
// Input: fileName (string)
// Output: boolean (true if valid, false otherwise)
```

**Implementation:**
```javascript
function validateFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }
  
  const trimmed = fileName.trim();
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) {
    return false;
  }
  
  // Should only contain letters, spaces, and hyphens
  if (!/^[a-zA-Z\s-]+$/.test(trimmed)) {
    return false;
  }
  
  // Should not be too long
  if (trimmed.length > 100) {
    return false;
  }
  
  return true;
}
```

## Data Models

### Provider Data Object (Enhanced)

```javascript
{
  name: string,           // Full name with credentials (e.g., "Miri Arie, PhD, CGP")
  fileName: string,       // First and last name only (e.g., "Miri Arie")
  content: string,        // Markdown content for provider file
  email: string | null,   // Email address or null
  phone: string | null,   // Phone number or null
  insurance: string[]     // Array of insurance provider names
}
```

### Result Object (Unchanged)

The result object returned by `processSingleProvider` remains unchanged:

```javascript
{
  success: boolean,
  providerName: string,
  slug: string,
  operation: 'created' | 'updated' | 'skipped',
  warnings: string[],
  error: {
    type: string,
    message: string,
    url: string
  } | null,
  duration: number
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN the LLM extracts provider information, THE Scraper SHALL request a separate fileName field containing only the first and last name without credentials
  Thoughts: This is about the structure of the prompt sent to the LLM. We can test that the generated prompt contains instructions for the fileName field and that it specifies "first and last name only".
  Testable: yes - example

1.2 WHEN generating a filename slug, THE Scraper SHALL use the fileName field directly instead of parsing the full name
  Thoughts: This is about the logic flow in processSingleProvider. We can test that when a valid fileName is present, it's used for slug generation. This applies to all valid fileName values.
  Testable: yes - property

1.3 FOR ALL providers with names like "Miri Arie, PhD, CGP", THE Scraper SHALL generate filenames like "miri-arie.md" not "miri-cgp.md"
  Thoughts: This is a specific example that demonstrates the bug being fixed. It's testing the end-to-end behavior with a concrete case.
  Testable: yes - example

1.4 WHEN the fileName field is missing or invalid, THE Scraper SHALL fall back to the normalizeProviderName function for backward compatibility
  Thoughts: This is about error handling behavior. We can test that when fileName is missing, null, empty, or invalid, the system falls back to normalizeProviderName. This should hold for all invalid inputs.
  Testable: yes - property

2.1 WHEN generating the provider extraction prompt, THE Scraper SHALL request a fileName field in the JSON response
  Thoughts: This is the same as 1.1 - testing that the prompt includes the fileName field request.
  Testable: yes - example

2.2 THE fileName field SHALL contain only the provider's first and last name without any credentials or titles
  Thoughts: This is about the LLM's behavior, which we cannot directly test in unit tests. However, we can test that our validation function correctly identifies valid fileName values.
  Testable: no

2.3 WHEN the LLM returns provider data, THE response SHALL include both the full name with credentials and the fileName field
  Thoughts: This is about the LLM response structure. We can test that our parsing logic correctly extracts both fields when present.
  Testable: yes - example

2.4 THE fileName field SHALL be validated to ensure it contains only alphabetic characters and spaces
  Thoughts: This is about the validation function behavior. We can test that validateFileName correctly accepts valid names and rejects invalid ones across many inputs.
  Testable: yes - property

3.1 WHEN the fileName field is missing from the LLM response, THE Scraper SHALL use normalizeProviderName as a fallback
  Thoughts: This is the same as 1.4 - testing fallback behavior.
  Testable: yes - property

3.2 WHEN the fileName field is empty or invalid, THE Scraper SHALL use normalizeProviderName as a fallback
  Thoughts: This is the same as 1.4 - testing fallback behavior.
  Testable: yes - property

3.3 THE normalizeProviderName function SHALL remain unchanged to support legacy code paths
  Thoughts: This is about code structure, not functional behavior. We can verify this by checking that normalizeProviderName still works as before.
  Testable: yes - example

3.4 WHEN processing existing cached data without fileName fields, THE Scraper SHALL continue to function correctly
  Thoughts: This is an integration test scenario. We can test that the system handles objects without fileName fields gracefully.
  Testable: yes - example

4.1 WHEN the fileName field contains non-alphabetic characters (except spaces), THE Scraper SHALL log a warning and use the fallback
  Thoughts: This is about validation and error handling. We can test that invalid characters trigger the fallback across many inputs.
  Testable: yes - property

4.2 WHEN the fileName field is too long (>100 characters), THE Scraper SHALL truncate it and log a warning
  Thoughts: This is about length validation. We can test that names over 100 characters are handled correctly.
  Testable: yes - edge-case

4.3 WHEN filename generation fails, THE Scraper SHALL log the provider's full name and the error details
  Thoughts: This is about logging behavior, which is difficult to test in unit tests without mocking the logger.
  Testable: no

4.4 THE Scraper SHALL log which method was used for filename generation (fileName field vs normalizeProviderName fallback)
  Thoughts: This is about logging behavior, which is difficult to test in unit tests without mocking the logger.
  Testable: no

### Property Reflection

After reviewing the prework, I've identified the following redundancies:

- Properties 1.4, 3.1, and 3.2 all test the same fallback behavior - these can be combined into one comprehensive property
- Properties 1.2 and the combined fallback property together cover the complete filename generation logic
- Property 4.1 is essentially part of the validation property (2.4) - they can be combined

The remaining properties provide unique validation value:
- Property 2.4 + 4.1 (combined): Validates that the validation function works correctly across all inputs
- Property 1.2 + fallback (combined): Validates that filename generation uses the correct source
- Examples 1.1, 1.3, 2.1, 2.3, 3.3, 3.4: Provide concrete test cases for specific scenarios
- Edge case 4.2: Tests length boundary condition

### Correctness Properties

**Property 1: Filename generation uses correct source**
*For any* provider data object, if it contains a valid fileName field, then the slug generation should use nameToSlug(fileName); otherwise, it should use normalizeProviderName(name)
**Validates: Requirements 1.2, 1.4, 3.1, 3.2**

**Property 2: Filename validation correctness**
*For any* string input, validateFileName should return true if and only if the string contains at least one alphabetic character, contains only letters/spaces/hyphens, and is not longer than 100 characters
**Validates: Requirements 2.4, 4.1**

## Error Handling

### Validation Errors

**Missing fileName field:**
- Log: `⚠️ fileName field missing for provider: [name], using normalizeProviderName fallback`
- Action: Use `normalizeProviderName(providerData.name)` as fallback
- Continue processing normally

**Invalid fileName field:**
- Log: `⚠️ Invalid fileName for provider: [name] (fileName: [value]), using normalizeProviderName fallback`
- Action: Use `normalizeProviderName(providerData.name)` as fallback
- Continue processing normally

**fileName too long:**
- Log: `⚠️ fileName truncated from [original length] to 100 characters for provider: [name]`
- Action: Truncate to 100 characters and continue
- Continue processing normally

### LLM Response Errors

**Existing error handling remains unchanged:**
- Invalid JSON: Throw error with type 'llm'
- Missing required fields (name, content): Throw error with type 'llm'
- API call failures: Throw error with type 'llm'

The new `fileName` field is optional, so its absence does not cause an error—only a fallback to the existing logic.

## Testing Strategy

### Dual Testing Approach

This bugfix will use both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and the concrete bug scenario
- **Property tests**: Verify universal properties across all inputs

### Unit Testing

Unit tests will focus on:

1. **Concrete bug scenario**: Test that "Miri Arie, PhD, CGP" generates "miri-arie.md" not "miri-cgp.md"
2. **Prompt generation**: Verify that the generated prompt includes fileName field instructions
3. **Response parsing**: Verify that both name and fileName fields are extracted correctly
4. **Fallback behavior**: Test specific cases where fallback is triggered (missing field, null, empty string)
5. **Integration**: Test that processSingleProvider correctly uses fileName when available

### Property-Based Testing

Property tests will verify universal correctness properties:

1. **Property 1: Filename generation uses correct source** (100+ iterations)
   - Generate random provider data objects with/without valid fileName fields
   - Verify that slug generation uses the correct source based on fileName validity
   - Tag: **Feature: provider-filename-fix, Property 1: Filename generation uses correct source**

2. **Property 2: Filename validation correctness** (100+ iterations)
   - Generate random strings with various characteristics
   - Verify that validateFileName returns true/false correctly based on the validation rules
   - Tag: **Feature: provider-filename-fix, Property 2: Filename validation correctness**

### Testing Library

For JavaScript/Node.js, we'll use **fast-check** as the property-based testing library. It integrates well with Vitest (our existing test framework) and provides powerful generators for creating test data.

### Test Configuration

- Minimum 100 iterations per property test
- Each property test references its design document property in a comment
- Tests run as part of the existing Vitest test suite
