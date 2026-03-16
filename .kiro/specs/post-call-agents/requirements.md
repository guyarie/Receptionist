# Requirements Document

## Introduction

AI-agent-driven post-call processing and notification system for the AI phone receptionist. The system replaces the current standalone call summary generation (`call-summary.js` `generateSummary()`) with an AI agent that handles everything after a call ends: generating the summary, saving it, deciding whether providers should be notified, and sending emails. A second agent runs on a daily schedule to compose and send a digest email to the practice admin. All decision-making lives in editable prompt instruction files (`prompts/`), not in application code. The code provides only: trigger points, thin tool adapter functions that wrap existing modules, and SMTP configuration. An AI SDK library (recommended: Vercel AI SDK `ai` package) handles the agent loop, tool-calling protocol, and multi-turn conversation mechanics.

## Glossary

- **Post_Call_Agent**: An AI agent triggered when a call ends. Replaces the current `generateSummary()` AI call. Receives the conversation transcript and call metadata, then uses tools and prompt instructions to generate a summary, save it, optionally notify providers via email. Behavior defined in `prompts/post-call-agent.txt`.
- **Daily_Digest_Agent**: An AI agent triggered on a daily schedule. Uses tools to read the day's call summaries and provider profiles, then composes and sends a digest email to the admin. Behavior defined in `prompts/daily-digest-agent.txt`.
- **Prompt_Instructions**: Editable text files in the `prompts/` directory that define all agent decision-making: when to email, who to email, what to include, whether to skip. No code changes needed to adjust behavior.
- **Agent_Tool**: A thin adapter function (10-20 lines) that wraps an existing module and exposes it as a callable tool for the AI agent. These are the code we write.
- **Call_Summary**: A JSON object containing caller phone, AI-generated summary text, full transcript, call duration, and metadata. Stored in `call-summaries/`.
- **Provider_Profile**: A markdown file in `data/providers/` containing a provider's credentials, email, phone, specialties, and scheduling details.
- **CallSummaryManager**: The existing singleton module (`src/call-summary.js`) that manages call summary file I/O.
- **Provider_Loader**: The existing singleton module (`src/provider-loader.js`) that loads provider profile markdown files.
- **Email_Transport**: A configured nodemailer SMTP transport used to send outgoing emails.
- **Admin_Email**: The email address configured via `ADMIN_EMAIL` environment variable to receive daily digest emails.

## Requirements

### Requirement 1: Agent Tool Adapters

**User Story:** As a developer, I want thin adapter functions that expose existing modules as callable tools for AI agents, so that agents can read data and perform actions without duplicating existing logic.

#### Acceptance Criteria

1. THE system SHALL provide a `save_call_summary` Agent_Tool that accepts call summary data and delegates to `CallSummaryManager.saveCallSummary()` to persist the summary as a JSON file.
2. THE system SHALL provide a `read_provider_profiles` Agent_Tool that delegates to `Provider_Loader.getAll()` and returns all Provider_Profile data including each provider's name, email, phone, specialties, and scheduling information.
3. THE system SHALL provide a `read_call_summaries` Agent_Tool that accepts an optional date filter parameter and delegates to `CallSummaryManager.getAllSummaries()`, returning matching Call_Summary objects sorted by start time in descending order.
4. THE system SHALL provide a `send_email` Agent_Tool that accepts recipient email address, subject line, and body text, and delegates to `Email_Transport.sendMail()` to deliver the email.
5. IF the `send_email` Agent_Tool is invoked with a missing or empty recipient email address, THEN THE `send_email` Agent_Tool SHALL return an error message to the agent indicating the email could not be sent.
6. IF the Email_Transport fails to deliver an email, THEN THE `send_email` Agent_Tool SHALL return an error message to the agent describing the failure.

### Requirement 2: Post-Call Agent Trigger and Summary Migration

**User Story:** As a practice administrator, I want an AI agent to automatically run after each call ends, replacing the current standalone summary generation, so that one agent flow handles summary creation, saving, and optional provider notification.

#### Acceptance Criteria

1. WHEN a call ends and the conversation transcript is available, THE system SHALL trigger the Post_Call_Agent with the full conversation transcript and call metadata (caller phone, call SID, start time, end time) as context.
2. THE Post_Call_Agent SHALL replace the current standalone `generateSummary()` AI call in `CallSummaryManager.saveCallSummary()`, absorbing summary generation into the agent flow.
3. THE Post_Call_Agent SHALL have access to the `save_call_summary`, `read_provider_profiles`, and `send_email` Agent_Tools.
4. THE Post_Call_Agent SHALL load its Prompt_Instructions from `prompts/post-call-agent.txt` on each invocation.
5. THE Post_Call_Agent trigger SHALL operate asynchronously and not block or delay the call teardown process.
6. IF the Post_Call_Agent encounters an error during execution, THEN THE system SHALL log the error and preserve the conversation transcript so no call data is lost.
7. WHEN the notification system is disabled (missing SMTP configuration), THE Post_Call_Agent SHALL still generate and save the call summary but skip any email-sending tool calls.

### Requirement 3: Post-Call Agent Prompt Instructions

**User Story:** As a practice administrator, I want to control how the post-call agent generates summaries, decides which providers to notify, and composes emails, by editing a prompt file rather than changing code.

#### Acceptance Criteria

1. THE Prompt_Instructions file `prompts/post-call-agent.txt` SHALL contain instructions that direct the Post_Call_Agent to: analyze the conversation transcript, generate a concise call summary, save the summary using the `save_call_summary` tool, decide whether any providers should be notified, and send notification emails using the `send_email` tool.
2. THE Prompt_Instructions SHALL instruct the Post_Call_Agent to use the `read_provider_profiles` tool to look up provider contact information before sending any emails.
3. THE Prompt_Instructions SHALL include default guidance for matching caller inquiries to providers based on names, specialties, and context mentioned in the conversation.
4. THE Prompt_Instructions SHALL include default guidance for composing notification emails that include the caller phone number, call timestamp, and a summary of what the caller was looking for.
5. THE Prompt_Instructions file SHALL be read from disk on each agent invocation, allowing edits to take effect without code changes or application restarts.

### Requirement 4: Daily Digest Agent Trigger

**User Story:** As a practice administrator, I want a daily AI agent to review all calls and send me a digest email, so that I have a complete picture of call activity without checking the dashboard.

#### Acceptance Criteria

1. THE system SHALL trigger the Daily_Digest_Agent once per day at a configurable time (default: 6:00 PM Pacific Time) using a scheduled timer.
2. THE Daily_Digest_Agent SHALL have access to the `read_call_summaries`, `read_provider_profiles`, and `send_email` Agent_Tools.
3. THE Daily_Digest_Agent SHALL load its Prompt_Instructions from `prompts/daily-digest-agent.txt` on each invocation.
4. THE system SHALL configure the digest recipient address from the `ADMIN_EMAIL` environment variable and provide the address to the Daily_Digest_Agent as context.
5. IF the `ADMIN_EMAIL` environment variable is not configured, THEN THE system SHALL log a warning at startup and skip scheduling the Daily_Digest_Agent.
6. IF the Daily_Digest_Agent encounters an error during execution, THEN THE system SHALL log the error and not affect other application functionality.
7. THE Daily_Digest_Agent scheduling SHALL be configurable via a `DIGEST_SCHEDULE_HOUR` environment variable (0-23, default: 18 for 6 PM Pacific).

### Requirement 5: Daily Digest Agent Prompt Instructions

**User Story:** As a practice administrator, I want to control how the daily digest is composed and what it includes, by editing a prompt file rather than changing code.

#### Acceptance Criteria

1. THE Prompt_Instructions file `prompts/daily-digest-agent.txt` SHALL contain instructions that direct the Daily_Digest_Agent to use the `read_call_summaries` tool to retrieve the current day's call data, review the summaries, and compose a digest email.
2. THE Prompt_Instructions SHALL instruct the Daily_Digest_Agent to use the `read_provider_profiles` tool to enrich the digest with provider context when calls reference specific providers.
3. THE Prompt_Instructions SHALL include default guidance for composing a digest that includes: total call count, per-call details (caller phone, timestamp, duration, summary, mentioned providers), and any notable patterns.
4. THE Prompt_Instructions SHALL instruct the Daily_Digest_Agent to skip sending the digest when no calls occurred during the day.
5. THE Prompt_Instructions file SHALL be read from disk on each agent invocation, allowing edits to take effect without code changes or application restarts.

### Requirement 6: Email Transport Configuration

**User Story:** As a system administrator, I want to configure email sending via environment variables, so that I can set up SMTP credentials without modifying code.

#### Acceptance Criteria

1. THE Email_Transport SHALL be configured using the following environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
2. WHEN any required SMTP environment variable is missing, THE system SHALL log a warning at startup and disable the `send_email` Agent_Tool (returning an error message to any agent that attempts to use the tool).
3. THE Email_Transport SHALL use TLS encryption when connecting to the SMTP server.
4. IF the SMTP connection fails at startup validation, THEN THE system SHALL log the error and allow the rest of the application to continue running.

### Requirement 7: Notification System Startup and Status

**User Story:** As a developer, I want the notification system to report its status at startup, so that I can verify the agent infrastructure is properly configured.

#### Acceptance Criteria

1. WHEN the application starts, THE system SHALL verify SMTP configuration and log whether the email notification capability is enabled or disabled.
2. WHEN email capability is enabled, THE system SHALL log the scheduled time for the Daily_Digest_Agent.
3. WHEN the application starts, THE system SHALL verify that the Prompt_Instructions files (`prompts/post-call-agent.txt` and `prompts/daily-digest-agent.txt`) exist and log warnings for any missing files.
4. THE notification system startup SHALL not block or delay the main application startup.