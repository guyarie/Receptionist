# Implementation Plan: Post-Call Agents

## Overview

Replace the standalone `generateSummary()` AI call with an AI agent-driven post-call processing pipeline using the Vercel AI SDK. Implement two agents (post-call and daily digest), shared tool adapters, email transport, prompt instruction files, and integrate into existing call flow. All agent decision-making lives in editable prompt files.

## Tasks

- [x] 1. Install dependencies and update configuration
  - [x] 1.1 Add new npm dependencies
    - Install `ai`, `@ai-sdk/openai`, `nodemailer`, `node-cron`, `zod` as production dependencies
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 4.1_

  - [x] 1.2 Add SMTP and notification config to `src/config.js`
    - Add `smtp` block with `host`, `port`, `user`, `pass`, `from` from env vars
    - Add `adminEmail` from `ADMIN_EMAIL` env var
    - Add `digestScheduleHour` from `DIGEST_SCHEDULE_HOUR` env var (default: 18)
    - _Requirements: 6.1, 4.4, 4.5, 4.7_

  - [x] 1.3 Update `.env.example` with new environment variables
    - Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL`, `DIGEST_SCHEDULE_HOUR`
    - _Requirements: 6.1, 4.4, 4.7_

- [x] 2. Implement email transport module
  - [x] 2.1 Create `src/email-transport.js`
    - Implement `initialize()` that reads SMTP env vars and creates nodemailer transport with `secure: true`
    - Implement `isConfigured()` returning boolean based on all 5 SMTP vars being present
    - Implement `sendMail({ to, subject, body })` that delegates to nodemailer
    - Log warning when SMTP not fully configured, log success when configured
    - SMTP init failure must not prevent app from starting
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 2.2 Write property test for SMTP configuration completeness
    - **Property 8: SMTP configuration completeness determines email availability**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 2.3 Write unit tests for email transport
    - Test `isConfigured()` returns false when any SMTP var is missing
    - Test `sendMail()` throws when transport not configured
    - Test transport uses `secure: true` (TLS)
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Implement agent tool adapters
  - [x] 3.1 Create `src/agents/tools.js` with shared tool definitions
    - Implement `save_call_summary` tool wrapping `CallSummaryManager.saveSummaryDirect()`
    - Implement `read_provider_profiles` tool wrapping `providerLoader.getAll()`
    - Implement `read_call_summaries` tool wrapping `CallSummaryManager.getAllSummaries()` with optional date filter
    - Implement `send_email` tool wrapping `emailTransport.sendMail()` with input validation and error handling
    - Each tool is a thin adapter (10-20 lines) using Vercel AI SDK `tool()` and `zod` schemas
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 3.2 Add `saveSummaryDirect()` method to `src/call-summary.js`
    - Accept a pre-built summary object (callSid, callerPhone, twilioNumber, startTime, endTime, duration, summary, fullTranscript)
    - Write it to disk as JSON in `call-summaries/` directory with the existing filename pattern
    - Keep existing `saveCallSummary()` as fallback for when agent system is unavailable
    - _Requirements: 1.1, 2.2, 2.6_

  - [ ]* 3.3 Write property test for call summary save round trip
    - **Property 1: Call summary save round trip**
    - **Validates: Requirements 1.1**

  - [ ]* 3.4 Write property test for provider profiles adapter transparency
    - **Property 2: Provider profiles adapter transparency**
    - **Validates: Requirements 1.2**

  - [ ]* 3.5 Write property test for call summaries date filtering
    - **Property 3: Call summaries date filtering and sort order**
    - **Validates: Requirements 1.3**

  - [ ]* 3.6 Write property test for send email input validation
    - **Property 4: Send email tool validates inputs and handles transport errors**
    - **Validates: Requirements 1.5, 1.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement post-call agent
  - [x] 5.1 Create `src/agents/post-call-agent.js`
    - Implement `runPostCallAgent(callData)` that reads prompt from `prompts/post-call-agent.txt` on each invocation
    - Use Vercel AI SDK `generateText()` with `createOpenAI` pointed at OpenRouter
    - Pass `save_call_summary`, `read_provider_profiles`, `send_email` tools
    - Build user message containing callSid, from, to, startTime, endTime, and full conversation transcript
    - Set `maxSteps: 10` for tool-calling loop
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

  - [x] 5.2 Create `prompts/post-call-agent.txt` prompt instructions
    - Instructions to analyze transcript, generate concise summary, save via `save_call_summary` tool
    - Instructions to use `read_provider_profiles` to look up provider contact info
    - Default guidance for matching caller inquiries to providers by name, specialty, context
    - Default guidance for composing notification emails with caller phone, timestamp, summary
    - Instructions to skip email when SMTP not configured (tool returns error)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.3 Write property test for post-call agent message completeness
    - **Property 5: Post-call agent receives complete call data**
    - **Validates: Requirements 2.1**

  - [ ]* 5.4 Write property test for prompt fresh-read behavior
    - **Property 6: Prompt files are read fresh from disk on each invocation**
    - **Validates: Requirements 2.4, 3.5, 4.3, 5.5**

  - [ ]* 5.5 Write property test for agent error transcript preservation
    - **Property 7: Agent errors preserve call transcript**
    - **Validates: Requirements 2.6**

- [x] 6. Implement daily digest agent
  - [x] 6.1 Create `src/agents/daily-digest-agent.js`
    - Implement `runDailyDigestAgent(adminEmail)` that reads prompt from `prompts/daily-digest-agent.txt` on each invocation
    - Use Vercel AI SDK `generateText()` with `createOpenAI` pointed at OpenRouter
    - Pass `read_call_summaries`, `read_provider_profiles`, `send_email` tools
    - Build user message with today's date and admin email address
    - Set `maxSteps: 10` for tool-calling loop
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.2 Create `prompts/daily-digest-agent.txt` prompt instructions
    - Instructions to use `read_call_summaries` to retrieve today's calls
    - Instructions to use `read_provider_profiles` to enrich digest with provider context
    - Default guidance for composing digest: total call count, per-call details, mentioned providers, patterns
    - Instructions to skip sending when no calls occurred
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 6.3 Write property test for digest schedule hour configurability
    - **Property 9: Digest schedule hour is configurable**
    - **Validates: Requirements 4.7**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Shadow mode — run agent in parallel with existing flow
  - [x] 8.1 Add shadow mode to `src/call-handler.js`
    - Keep the existing `callSummary.saveCallSummary()` call unchanged (current flow still produces the real summary)
    - After the existing save, also fire `runPostCallAgent()` asynchronously in shadow mode
    - The agent saves its summary to a separate shadow file (e.g., `call-summaries/shadow-{timestamp}-{callSid}.json`)
    - Log both summaries side-by-side for comparison (agent summary vs. existing summary)
    - Agent errors in shadow mode are logged but never affect the existing flow
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 8.2 Add shadow mode to `src/realtime/relay-service.js`
    - Same pattern: keep existing summary flow, also fire agent in shadow mode
    - Agent saves to shadow file, log comparison
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 8.3 Add shadow mode flag to config
    - Add `POST_CALL_AGENT_MODE` env var with values: `shadow` (default), `active`, `disabled`
    - `shadow`: run both flows in parallel, agent saves to shadow files
    - `active`: agent replaces existing flow (with fallback)
    - `disabled`: existing flow only, no agent
    - _Requirements: 2.1, 2.5_

- [ ] 9. Checkpoint — validate shadow mode output
  - Deploy with shadow mode enabled, make test calls, compare agent summaries vs. existing summaries
  - Verify agent produces equivalent or better summaries
  - Verify provider notification emails are correct (if SMTP configured)
  - Ask the user to review shadow output before proceeding to cutover

- [x] 10. Cutover — switch agent to active mode
  - [x] 10.1 Modify `src/call-handler.js` for active mode
    - When `POST_CALL_AGENT_MODE=active`, replace `callSummary.saveCallSummary()` with `runPostCallAgent()`
    - Catch errors, log them, and fall back to saving a basic summary via existing `saveCallSummary()`
    - Ensure call teardown is never blocked by agent errors
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x] 10.2 Modify `src/realtime/relay-service.js` for active mode
    - Same active mode pattern with fallback
    - _Requirements: 2.1, 2.2, 2.5, 2.6_

  - [x] 10.3 Clean up shadow mode artifacts
    - Remove shadow file writing logic (no longer needed once active mode is validated)
    - Keep the `POST_CALL_AGENT_MODE` config flag for `active`/`disabled` toggle
    - _Requirements: 2.1, 2.5_

  - [ ]* 10.4 Write unit tests for agent integration and fallback
    - Test post-call agent is called with correct call data from both call-handler and relay-service
    - Test fallback saves basic summary when agent throws
    - Test call teardown is not blocked by agent errors
    - Test mode switching (shadow/active/disabled)
    - _Requirements: 2.1, 2.5, 2.6_

- [x] 11. Add startup initialization and daily digest scheduling to server
  - [x] 11.1 Modify `src/server.js` for notification system startup
    - Import and call `emailTransport.initialize()` at startup
    - Verify prompt files exist (`prompts/post-call-agent.txt`, `prompts/daily-digest-agent.txt`), log warnings for missing
    - Log SMTP configuration status (enabled/disabled)
    - Schedule daily digest using `node-cron` at configured hour if `ADMIN_EMAIL` is set
    - Log scheduled digest time when enabled, log warning when `ADMIN_EMAIL` missing
    - Wrap digest agent call in try/catch so errors don't affect other functionality
    - Startup must not be blocked by notification system initialization
    - _Requirements: 4.1, 4.5, 4.6, 4.7, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 11.2 Write unit tests for startup and scheduling
    - Test daily digest is not scheduled when `ADMIN_EMAIL` is missing
    - Test startup logs include notification system status messages
    - Test digest scheduling uses configured hour
    - _Requirements: 4.5, 4.7, 7.1, 7.2, 7.3_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code uses CommonJS (`require`/`module.exports`) per project conventions
- Mock `nodemailer`, `fs`, and AI SDK `generateText` in tests to avoid real API calls
