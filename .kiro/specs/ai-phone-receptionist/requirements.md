# Requirements Document: AI Phone Receptionist — Friends & Family Release

## Introduction

This document specifies the requirements for the friends-and-family release of the AI Phone Receptionist for Relational Therapy Collective (RTC). The system is a working demo that answers inbound phone calls using Twilio's `<Gather>` verb for speech recognition and OpenRouter (GPT-4) for AI responses. This release focuses on making the system operable by a non-developer office manager on a mini-PC, adding an admin web UI, provider availability via markdown files, and improving call log accessibility. The system stays on Node.js/CommonJS with the existing Gather-based call flow.

## Glossary

- **System**: The AI Phone Receptionist Node.js application
- **Caller**: A person calling the RTC phone number
- **Office_Manager**: The non-developer staff member who operates the system day-to-day
- **Provider**: A therapist or clinician at RTC
- **Admin_UI**: A web-based dashboard served by the Express app at `/admin`
- **Prompt_File**: A text file in the `prompts/` directory that controls AI behavior
- **Availability_File**: A markdown file in the `availability/` directory containing a provider's schedule info
- **Call_Log**: A JSON file in `call-summaries/` containing a call transcript and AI-generated summary
- **Twilio**: Third-party telephony service handling inbound calls and speech recognition
- **OpenRouter**: AI model API service providing GPT-4 responses
- **Cloudflare_Tunnel**: Secure tunneling service exposing the local server to the public internet
- **Gather**: Twilio's TwiML verb that performs speech-to-text on caller audio
- **TwiML**: Twilio Markup Language used to control call flow

## Requirements

### Requirement 1: Admin Web UI Dashboard

**User Story:** As an Office_Manager, I want a web dashboard so that I can monitor system status and access management features without developer help.

#### Acceptance Criteria

1. WHEN the Office_Manager navigates to `/admin`, THE Admin_UI SHALL display a dashboard showing server uptime, active call count, and recent errors
2. WHEN the System encounters an error, THE Admin_UI SHALL display the error message and timestamp on the dashboard
3. THE Admin_UI SHALL provide navigation links to prompt editing, call logs, provider availability, and system controls
4. THE Admin_UI SHALL be served by the existing Express app without requiring additional server processes
5. THE Admin_UI SHALL function in modern desktop browsers (Chrome, Firefox, Edge) without requiring installation of additional software

### Requirement 2: Prompt Editing

**User Story:** As an Office_Manager, I want to edit AI prompt files through the browser so that I can customize the receptionist's behavior without accessing the file system.

#### Acceptance Criteria

1. WHEN the Office_Manager opens the prompt editor, THE Admin_UI SHALL display a list of all Prompt_File names with their current content
2. WHEN the Office_Manager modifies a Prompt_File and clicks save, THE System SHALL write the updated content to the corresponding file on disk and reload prompts into memory
3. IF the Office_Manager submits an empty Prompt_File, THEN THE System SHALL reject the save and display a validation error
4. WHEN a Prompt_File is saved successfully, THE System SHALL display a confirmation message
5. THE Admin_UI SHALL provide a text area for each Prompt_File that preserves whitespace and line breaks

### Requirement 3: Provider Availability

**User Story:** As an Office_Manager, I want providers to maintain their own availability in markdown files so that the AI can reference current scheduling information during calls.

#### Acceptance Criteria

1. THE System SHALL read all markdown files from the `availability/` directory on startup and make their content available to the AI
2. WHEN a call is initiated, THE System SHALL include the combined provider availability content in the AI conversation context
3. WHEN the Office_Manager views the availability section in the Admin_UI, THE Admin_UI SHALL display each Availability_File name and its content
4. WHEN the Office_Manager edits an Availability_File through the Admin_UI and saves, THE System SHALL write the updated content to disk
5. THE System SHALL provide an API endpoint to reload availability data without restarting the server
6. IF the `availability/` directory does not exist on startup, THEN THE System SHALL create it and log a notice

### Requirement 4: Call Log Access

**User Story:** As an Office_Manager, I want to browse call logs through the admin dashboard so that I can review caller interactions and follow up as needed.

#### Acceptance Criteria

1. WHEN the Office_Manager opens the call logs section, THE Admin_UI SHALL display a list of all Call_Log entries sorted by most recent first
2. WHEN the Office_Manager selects a Call_Log entry, THE Admin_UI SHALL display the caller phone number, call duration, AI-generated summary, and full transcript
3. THE Admin_UI SHALL display call logs with pagination or scrolling when more than 20 entries exist
4. THE System SHALL continue to generate Call_Log files using the existing call summary mechanism

### Requirement 5: System Controls

**User Story:** As an Office_Manager, I want to see system health and control basic operations so that I can keep the receptionist running without developer intervention.

#### Acceptance Criteria

1. THE Admin_UI SHALL display current system status including: server running state, OpenRouter model name, Twilio phone number, and server uptime
2. WHEN the Office_Manager clicks a reload button, THE System SHALL reload all Prompt_File content and Availability_File content without restarting the server
3. WHEN the Office_Manager clicks a refresh website data button, THE System SHALL re-scrape the RTC website and update the cached content
4. IF the OpenRouter API is unreachable, THEN THE System SHALL display a warning on the Admin_UI dashboard

### Requirement 6: AI Context with Provider Availability

**User Story:** As a Caller, I want the AI to know about provider availability so that I can get scheduling information during my call.

#### Acceptance Criteria

1. WHEN the AI session is initialized for a call, THE System SHALL include the content of all Availability_File documents in the system prompt context
2. WHEN the AI session is initialized for a call, THE System SHALL include the scraped website data and custom practice information in the system prompt context
3. THE System SHALL not book appointments or modify Availability_File content during calls; the AI SHALL only reference availability information read-only
4. WHEN no Availability_File documents exist, THE System SHALL instruct the AI to tell callers that specific scheduling information is not currently available

### Requirement 7: Call Handling with Gather

**User Story:** As a Caller, I want to have a natural phone conversation with the AI receptionist so that I can get information about therapy services.

#### Acceptance Criteria

1. WHEN a Caller dials the Twilio phone number, THE System SHALL answer with a TwiML response containing the greeting Prompt_File content
2. WHEN the Caller speaks, THE System SHALL use Twilio Gather to convert speech to text and send the text to OpenRouter for an AI response
3. WHEN the OpenRouter API returns a response, THE System SHALL deliver the response to the Caller using TwiML `<Say>` and continue listening with another Gather
4. IF the Caller does not speak within the timeout period, THE System SHALL play the no-speech-detected prompt and continue listening
5. IF the OpenRouter API fails during a call, THEN THE System SHALL play the error Prompt_File content and end the call gracefully
6. WHEN a call ends, THE System SHALL generate a Call_Log with an AI summary of the conversation

### Requirement 8: Error Handling and Logging

**User Story:** As an Office_Manager, I want the system to handle errors gracefully and log them so that I can identify and report problems.

#### Acceptance Criteria

1. WHEN any API call to OpenRouter fails, THE System SHALL log the error with a timestamp and context to the console
2. WHEN a file read or write operation fails, THE System SHALL log the error and continue operating without crashing
3. THE System SHALL store the last 50 errors in memory so the Admin_UI can display recent errors without reading log files
4. WHEN the System starts, THE System SHALL validate that required environment variables are present and exit with a clear message if any are missing

### Requirement 9: Deployment Support

**User Story:** As an Office_Manager, I want the system to start automatically and run reliably so that the receptionist is available during business hours.

#### Acceptance Criteria

1. THE System SHALL provide a startup script that the Office_Manager can run to start the server
2. THE System SHALL provide documentation for setting up auto-start on boot using systemd on Linux
3. THE System SHALL use cross-platform file paths so the code runs on both Windows (development) and Linux (deployment)
4. THE System SHALL load all configuration from environment variables via a `.env` file
