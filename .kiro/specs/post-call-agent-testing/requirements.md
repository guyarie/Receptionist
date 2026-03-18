# Requirements Document

## Introduction

A test suite for the post-call processing agent that allows developers to replay simulated or real call data through the agent without making actual phone calls. The suite stores call fixtures in `tests/simulated_call_bank/`, provides a runner that can execute the agent against a single call or all calls, and lets the real agent tools run (OpenRouter, provider profiles, etc.) — the only thing avoided is placing actual phone calls. This eliminates the need to place real calls when debugging post-call agent bugs.

## Glossary

- **Test_Runner**: The vitest-based test harness that loads call fixtures and executes the post-call agent against them
- **Call_Fixture**: A JSON file in `tests/simulated_call_bank/` containing simulated or real call data (callSid, from, to, startTime, endTime, conversationHistory)
- **Post_Call_Agent**: The existing `runPostCallAgent` function in `src/agents/post-call-agent.js` that processes call data after a call ends
- **Agent_Log**: The JSON debug log saved by the post-call agent to `data/agent_logs/`
- **Call_Bank**: The `tests/simulated_call_bank/` directory containing call fixture files

## Requirements

### Requirement 1: Call Fixture Storage

**User Story:** As a developer, I want to store simulated call data as JSON fixtures in a dedicated directory, so that I can replay them through the post-call agent without making real calls.

#### Acceptance Criteria

1. THE Call_Bank SHALL store call fixture files as JSON in `tests/simulated_call_bank/`
2. WHEN a call fixture is loaded, THE Test_Runner SHALL validate that the fixture contains the required fields: callSid, from, to, startTime, endTime, and conversationHistory
3. THE Call_Fixture SHALL use the same data shape as the `callData` parameter accepted by the Post_Call_Agent: `{ callSid, from, to, startTime, endTime, conversationHistory: [{ role, content }] }`
4. WHEN a call fixture has an invalid or missing required field, THE Test_Runner SHALL report a clear validation error identifying the fixture file and the missing field

### Requirement 2: Single Call Execution

**User Story:** As a developer, I want to run the post-call agent against a specific call fixture, so that I can debug a particular call scenario in isolation.

#### Acceptance Criteria

1. WHEN a specific fixture filename is provided, THE Test_Runner SHALL execute the Post_Call_Agent with only that fixture's call data
2. WHEN the Post_Call_Agent completes processing a single fixture, THE Test_Runner SHALL report which tools were called and their arguments
3. IF the specified fixture file does not exist, THEN THE Test_Runner SHALL report an error identifying the missing file

### Requirement 3: All Calls Execution

**User Story:** As a developer, I want to run the post-call agent against all call fixtures in the bank, so that I can verify agent behavior across a range of scenarios.

#### Acceptance Criteria

1. WHEN no specific fixture is specified, THE Test_Runner SHALL execute the Post_Call_Agent against every fixture file in the Call_Bank
2. THE Test_Runner SHALL report results for each fixture independently, including pass/fail status and tool calls made
3. IF the Call_Bank directory is empty, THEN THE Test_Runner SHALL report that no fixtures were found

### Requirement 4: Seed Fixtures from Real Call Data

**User Story:** As a developer, I want to easily create new fixtures from existing call summaries, so that I can reproduce real-world bugs without manually crafting test data.

#### Acceptance Criteria

1. THE Test_Runner SHALL provide a utility function that converts a call summary JSON (from `call-summaries/`) into the call fixture format expected by the Post_Call_Agent
2. WHEN converting a call summary, THE utility SHALL map `fullTranscript[].speaker` back to `conversationHistory[].role` (Caller → user, AI Receptionist → assistant)
3. WHEN converting a call summary, THE utility SHALL preserve callSid, callerPhone (as `from`), twilioNumber (as `to`), startTime, and endTime
