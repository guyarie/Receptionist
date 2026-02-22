# Requirements Document

## Introduction

This specification addresses critical issues in the provider profile scraping system for Relational Therapy Collective (RTC). The current scraper creates duplicate provider files due to inconsistent name normalization and fails to extract insurance information despite it being present on the website. These improvements will ensure data quality, eliminate duplicates, and provide complete provider information for the AI phone receptionist.

## Glossary

- **Scraper**: The system component that fetches website content and extracts provider information
- **Provider_Profile**: A markdown file containing information about a single therapist or clinician
- **Slug**: A URL-friendly identifier derived from a provider's name (e.g., "jeffrey-gillman")
- **Name_Normalizer**: Component responsible for converting provider names to consistent slug format
- **AI_Extractor**: The OpenRouter API client that processes HTML content and returns structured provider data
- **Duplicate_Detector**: Component that identifies when multiple profiles represent the same provider
- **Insurance_Parser**: Component that extracts insurance acceptance information from website content
- **Data_Validator**: Component that verifies extracted provider data meets quality standards

## Requirements

### Requirement 1: Provider Name Normalization

**User Story:** As a system administrator, I want provider names to be normalized consistently before file creation, so that the same provider is never represented by multiple files.

#### Acceptance Criteria

1. WHEN a provider name contains a middle initial, THE Name_Normalizer SHALL remove the middle initial before generating the slug
2. WHEN a provider name contains credentials (PhD, LMFT, etc.), THE Name_Normalizer SHALL remove credentials before generating the slug
3. WHEN a provider name contains special characters or punctuation, THE Name_Normalizer SHALL remove them before generating the slug
4. THE Name_Normalizer SHALL convert all names to lowercase before slug generation
5. WHEN multiple whitespace characters appear in a name, THE Name_Normalizer SHALL collapse them to single spaces
6. THE Name_Normalizer SHALL generate slugs using only the first and last name components

### Requirement 2: Duplicate Detection

**User Story:** As a system administrator, I want the scraper to detect existing provider files before creating new ones, so that duplicate profiles are prevented.

#### Acceptance Criteria

1. WHEN the scraper processes a provider, THE Duplicate_Detector SHALL check if a file with the normalized slug already exists
2. IF a matching file exists, THEN THE Scraper SHALL update the existing file instead of creating a new one
3. WHEN checking for duplicates, THE Duplicate_Detector SHALL use the normalized slug for comparison
4. THE Scraper SHALL log when an existing file is being updated versus when a new file is created
5. WHEN updating an existing file, THE Scraper SHALL preserve the original filename

### Requirement 3: Insurance Information Extraction

**User Story:** As a phone receptionist AI, I want complete insurance information for each provider, so that I can accurately answer caller questions about insurance acceptance.

#### Acceptance Criteria

1. WHEN the AI_Extractor processes website content, THE Insurance_Parser SHALL identify all insurance provider names mentioned for each therapist
2. WHEN insurance information is found, THE Insurance_Parser SHALL extract it into a structured list format
3. IF no insurance information is found for a provider, THEN THE Insurance_Parser SHALL return an empty list rather than a placeholder message
4. THE AI_Extractor SHALL include explicit instructions emphasizing the importance of insurance extraction
5. WHEN the scraping prompt is constructed, THE System SHALL include examples of insurance information formats to guide extraction
6. THE Insurance_Parser SHALL handle various insurance mention formats (bullet lists, paragraphs, comma-separated lists)

### Requirement 4: Data Quality Validation

**User Story:** As a system administrator, I want extracted provider data to be validated before file creation, so that incomplete or malformed profiles are detected early.

#### Acceptance Criteria

1. WHEN a provider profile is extracted, THE Data_Validator SHALL verify that required fields are present (name, credentials, contact)
2. IF required fields are missing, THEN THE Data_Validator SHALL log a warning with the provider name and missing fields
3. WHEN insurance information is empty, THE Data_Validator SHALL log a warning indicating potential extraction failure
4. THE Data_Validator SHALL verify that email addresses match standard email format patterns
5. THE Data_Validator SHALL verify that phone numbers contain only digits, spaces, parentheses, and hyphens
6. WHEN validation warnings are generated, THE System SHALL write them to a validation report file
7. THE Scraper SHALL continue processing even when validation warnings occur

### Requirement 5: Enhanced AI Extraction Prompt

**User Story:** As a developer, I want the AI extraction prompt to be more effective at finding insurance information, so that extraction accuracy improves.

#### Acceptance Criteria

1. THE AI_Extractor SHALL include multiple emphatic statements about insurance importance in the prompt
2. THE AI_Extractor SHALL provide examples of where insurance information typically appears on provider pages
3. THE AI_Extractor SHALL instruct the AI to search multiple sections of content for insurance mentions
4. THE AI_Extractor SHALL specify the exact JSON structure expected for insurance data (array of strings)
5. WHEN constructing the prompt, THE System SHALL include a checklist reminder to verify insurance extraction

### Requirement 6: Extraction Result Reporting

**User Story:** As a system administrator, I want detailed reporting on the scraping process, so that I can identify issues and verify data quality.

#### Acceptance Criteria

1. WHEN scraping completes, THE Scraper SHALL generate a summary report with provider count and file operations
2. THE Report SHALL list all providers processed with their normalized slugs
3. THE Report SHALL indicate which files were created versus updated
4. THE Report SHALL include validation warnings for each provider
5. THE Report SHALL highlight providers with missing insurance information
6. THE Report SHALL be written to a timestamped file in a reports directory
7. THE Scraper SHALL display a summary of the report to the console upon completion
