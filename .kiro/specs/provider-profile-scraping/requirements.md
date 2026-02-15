# Requirements Document

## Introduction

The AI Phone Receptionist currently scrapes the RTC website and dumps the entire raw text into the AI context. The clinician extraction logic is broken (the clinicians array is always empty), and the raw text dump is inefficient. This feature replaces the current approach with a smarter pipeline: a standalone scraping process that sends raw website content to the AI to generate clean, structured markdown summaries per provider and for the practice overall. These summaries are stored as individual markdown files, managed through the admin dashboard, and used as the AI context instead of raw text.

## Glossary

- **Scrape_Script**: A standalone Node.js script that fetches the RTC website, sends the raw content to OpenRouter, and writes the AI-generated markdown summaries to disk.
- **Provider_Profile**: A markdown file containing a structured summary of a single clinician/provider, stored in `data/providers/`.
- **Practice_Overview**: A markdown file containing a structured summary of the overall practice, stored as `data/providers/practice-overview.md`.
- **Provider_Loader**: A module that loads all provider markdown files from `data/providers/` and provides them to the AI context, following the same pattern as the existing AvailabilityLoader.
- **Admin_Dashboard**: The existing web-based admin interface at `public/admin/` used to manage the system.
- **AI_Context**: The combined text injected into the AI system prompt to give the receptionist knowledge about the practice and its providers.
- **OpenRouter_API**: The AI API service used to generate responses, accessed via the OpenAI-compatible client.

## Requirements

### Requirement 1: Standalone Scrape-and-Summarize Script

**User Story:** As a system administrator, I want a standalone script that scrapes the RTC website and uses AI to generate clean provider profile markdown files, so that the AI receptionist has accurate, well-structured practice information.

#### Acceptance Criteria

1. WHEN the Scrape_Script is executed, THE Scrape_Script SHALL fetch the HTML content from the configured RTC website URL.
2. WHEN the HTML content is fetched, THE Scrape_Script SHALL extract the text content from the page body, excluding scripts, styles, navigation, and footer elements.
3. WHEN the extracted text is available, THE Scrape_Script SHALL send the text to the OpenRouter_API with a prompt instructing it to produce one Practice_Overview markdown summary and one Provider_Profile markdown summary per clinician found.
4. WHEN the OpenRouter_API returns the generated summaries, THE Scrape_Script SHALL write each summary as a separate markdown file in the `data/providers/` directory.
5. WHEN writing Provider_Profile files, THE Scrape_Script SHALL use a kebab-case filename derived from the provider name (e.g., `miri-arie.md`).
6. WHEN writing the Practice_Overview file, THE Scrape_Script SHALL name it `practice-overview.md`.
7. IF the `data/providers/` directory does not exist, THEN THE Scrape_Script SHALL create it before writing files.
8. IF the website fetch fails, THEN THE Scrape_Script SHALL log a descriptive error and exit with a non-zero exit code.
9. IF the OpenRouter_API call fails, THEN THE Scrape_Script SHALL log a descriptive error and exit with a non-zero exit code.

### Requirement 2: Provider Profile Loader Module

**User Story:** As a developer, I want a module that loads provider markdown files from disk and provides them as AI context, so that the receptionist can answer questions about providers using clean structured data.

#### Acceptance Criteria

1. THE Provider_Loader SHALL load all `.md` files from the `data/providers/` directory into memory on initialization.
2. WHEN the Provider_Loader loads files, THE Provider_Loader SHALL store each file as a mapping of filename to content.
3. THE Provider_Loader SHALL provide a method that returns all loaded files as a combined string suitable for AI_Context injection.
4. THE Provider_Loader SHALL provide a method that returns all loaded files as a map of filename to content.
5. THE Provider_Loader SHALL provide a method that returns the content of a single file by filename.
6. THE Provider_Loader SHALL provide a method that saves content to a file and updates the in-memory map.
7. THE Provider_Loader SHALL provide a method that reloads all files from disk.
8. IF the `data/providers/` directory does not exist, THEN THE Provider_Loader SHALL create it.

### Requirement 3: Updated AI Context Building

**User Story:** As a system administrator, I want the AI receptionist to use the clean provider markdown summaries instead of raw website text, so that the AI gives more accurate and relevant answers about the practice and its providers.

#### Acceptance Criteria

1. WHEN the server starts, THE server SHALL load provider profiles via the Provider_Loader and set the combined content as the website context on the AI client.
2. WHEN the AI client builds a session system prompt, THE AI client SHALL include the provider profile content in the practice information section.
3. THE server SHALL stop passing raw scraped website text to the AI client as context.
4. WHEN provider profiles are updated via the Admin_Dashboard, THE server SHALL refresh the AI_Context with the updated provider profile content.
5. WHEN the real-time streaming relay initializes, THE relay SHALL receive the provider profile context instead of raw website text.

### Requirement 4: Admin Dashboard Provider Profiles Tab

**User Story:** As a system administrator, I want a "Provider Profiles" tab in the admin dashboard to view and edit the generated provider markdown files, so that I can correct or enhance the AI-generated summaries.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a "Provider Profiles" navigation item linking to a dedicated page.
2. WHEN a user visits the Provider Profiles page, THE Admin_Dashboard SHALL load and display all Provider_Profile files from the Provider_Loader.
3. WHEN displaying a Provider_Profile, THE Admin_Dashboard SHALL show the filename as a label and the content in an editable textarea.
4. WHEN a user edits a Provider_Profile and clicks save, THE Admin_Dashboard SHALL send the updated content to the server API and persist it to disk.
5. WHEN a Provider_Profile is saved successfully, THE Admin_Dashboard SHALL display a success notification.
6. IF a Provider_Profile save fails, THEN THE Admin_Dashboard SHALL display an error notification with the failure reason.
7. THE Admin_Dashboard SHALL provide a button to create a new Provider_Profile file with a user-specified filename and content.
8. WHEN creating a new Provider_Profile, THE Admin_Dashboard SHALL validate that the filename ends with `.md` and contains only letters, numbers, hyphens, underscores, and dots.
9. THE Admin_Dashboard SHALL provide a button to reload provider profiles from disk.
10. WHEN provider profiles are saved or reloaded, THE Admin_Dashboard SHALL trigger an AI_Context refresh so the receptionist uses the latest data.

### Requirement 5: Server API Endpoints for Provider Profiles

**User Story:** As a developer, I want API endpoints to list, read, save, and reload provider profiles, so that the admin dashboard and other clients can manage provider data.

#### Acceptance Criteria

1. THE server SHALL expose a GET endpoint at `/admin/api/providers` that returns all provider profile files as a JSON array of filename and content objects.
2. THE server SHALL expose a PUT endpoint at `/admin/api/providers/:filename` that accepts a JSON body with a `content` field and saves the provider profile to disk.
3. WHEN a PUT request is received with an empty content field, THE server SHALL return a 400 status with an error message.
4. WHEN a PUT request is received with a filename that does not end in `.md`, THE server SHALL append `.md` to the filename before saving.
5. WHEN a provider profile is saved via the API, THE server SHALL update the AI_Context with the latest provider profile data.
6. THE server SHALL expose a POST endpoint at `/admin/api/refresh-providers` that reloads provider profiles from disk and updates the AI_Context.

### Requirement 6: Scrape Script Integration with npm

**User Story:** As a system administrator, I want to run the scrape-and-summarize process via an npm script, so that I can easily regenerate provider profiles when the website changes.

#### Acceptance Criteria

1. THE package.json SHALL include a script entry (e.g., `scrape-providers`) that runs the Scrape_Script.
2. WHEN the `scrape-providers` npm script is executed, THE Scrape_Script SHALL complete the full scrape-summarize-write pipeline and exit.
3. THE Scrape_Script SHALL log progress messages indicating each stage: fetching, extracting, summarizing, and writing files.
