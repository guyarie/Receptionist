# Requirements Document

## Introduction

This bugfix addresses an issue in the provider scraping system where professional titles (like "CGP", "CLC") are incorrectly used as the last name when generating filenames. The system currently removes some credentials (PhD, LMFT, etc.) but not all titles, causing the filename generation to treat remaining titles as the last name. This creates ambiguous filenames when multiple providers share the same first name and title.

## Glossary

- **Provider**: A therapist or clinician whose information is being scraped from the website
- **Credential**: A professional qualification or certification (e.g., PhD, LMFT, LCSW, PsyD, MD, CLC, CGP)
- **Title**: A professional designation that follows a name (subset of credentials)
- **Slug**: A URL-friendly version of a name used for filenames (e.g., "miri-arie" from "Miri Arie")
- **LLM**: Large Language Model used to extract provider information from web pages
- **Scraper**: The system component that extracts provider information from web pages
- **normalizeProviderName**: Function that converts a full name with credentials into a slug for filename generation

## Requirements

### Requirement 1: Accurate Filename Generation

**User Story:** As a developer, I want provider files to be named using the provider's actual first and last name, so that filenames are unique and meaningful.

#### Acceptance Criteria

1. WHEN the LLM extracts provider information, THE Scraper SHALL request a separate fileName field containing only the first and last name without credentials
2. WHEN generating a filename slug, THE Scraper SHALL use the fileName field directly instead of parsing the full name
3. FOR ALL providers with names like "Miri Arie, PhD, CGP", THE Scraper SHALL generate filenames like "miri-arie.md" not "miri-cgp.md"
4. WHEN the fileName field is missing or invalid, THE Scraper SHALL fall back to the normalizeProviderName function for backward compatibility

### Requirement 2: Enhanced LLM Response Format

**User Story:** As a developer, I want the LLM to return structured data with a dedicated fileName field, so that filename generation is reliable and doesn't depend on credential parsing.

#### Acceptance Criteria

1. WHEN generating the provider extraction prompt, THE Scraper SHALL request a fileName field in the JSON response
2. THE fileName field SHALL contain only the provider's first and last name without any credentials or titles
3. WHEN the LLM returns provider data, THE response SHALL include both the full name with credentials and the fileName field
4. THE fileName field SHALL be validated to ensure it contains only alphabetic characters and spaces

### Requirement 3: Backward Compatibility

**User Story:** As a developer, I want the system to handle legacy data and edge cases gracefully, so that the scraper remains robust.

#### Acceptance Criteria

1. WHEN the fileName field is missing from the LLM response, THE Scraper SHALL use normalizeProviderName as a fallback
2. WHEN the fileName field is empty or invalid, THE Scraper SHALL use normalizeProviderName as a fallback
3. THE normalizeProviderName function SHALL remain unchanged to support legacy code paths
4. WHEN processing existing cached data without fileName fields, THE Scraper SHALL continue to function correctly

### Requirement 4: Validation and Error Handling

**User Story:** As a developer, I want clear validation and error messages, so that I can debug filename generation issues.

#### Acceptance Criteria

1. WHEN the fileName field contains non-alphabetic characters (except spaces), THE Scraper SHALL log a warning and use the fallback
2. WHEN the fileName field is too long (>100 characters), THE Scraper SHALL truncate it and log a warning
3. WHEN filename generation fails, THE Scraper SHALL log the provider's full name and the error details
4. THE Scraper SHALL log which method was used for filename generation (fileName field vs normalizeProviderName fallback)
