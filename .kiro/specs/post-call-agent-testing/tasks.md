# Implementation Plan: Post-Call Agent Testing

## Overview

Build a lean test harness that replays stored call fixtures through the real `runPostCallAgent` function. Three components: fixture loader/validator, seed utility, and integration test file. Property tests use fast-check to verify fixture validation, seed conversion, and speaker mapping. Integration tests are excluded from the default vitest run.

## Tasks

- [x] 1. Create fixture loader and validator
  - [x] 1.1 Create `tests/simulated_call_bank/loader.js` with `loadAllFixtures()`, `loadFixture(filename)`, and `validateFixture(data, filename)`
    - Read all `.json` files from `tests/simulated_call_bank/`
    - Validate required fields: `callSid`, `from`, `to`, `startTime`, `endTime`, `conversationHistory`
    - Validate `conversationHistory` is an array of `{ role, content }` objects
    - Throw errors that include both the filename and the missing field name
    - `loadAllFixtures()` returns `[{ filename, data }]`, returns empty array if directory is empty or missing
    - `loadFixture(filename)` returns `{ filename, data }` or throws with the missing filename in the message
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.2 Write property test for fixture validation (Property 1)
    - **Property 1: Fixture validation rejects missing fields with informative errors**
    - Use fast-check to generate JSON objects missing one or more required fields
    - Assert `validateFixture` throws with both filename and missing field name in the error message
    - Place in `tests/property/post-call-agent-testing.property.test.js`
    - **Validates: Requirements 1.2, 1.4**

- [x] 2. Create seed utility
  - [x] 2.1 Create `tests/simulated_call_bank/seed-fixture.js` CLI script
    - Accept a call summary JSON path as CLI argument
    - Handle both flat and nested summary structures (check if `summary` is an object with `callerPhone`)
    - Map `callerPhone` → `from`, `twilioNumber` → `to`, preserve `callSid`, `startTime`, `endTime`
    - Map `fullTranscript[].speaker` to `conversationHistory[].role`: `"Caller"` → `"user"`, `"AI Receptionist"` → `"assistant"`, unknown → `"user"`
    - Map `fullTranscript[].message` to `conversationHistory[].content`
    - Write output fixture to `tests/simulated_call_bank/`
    - Usage: `node tests/simulated_call_bank/seed-fixture.js call-summaries/call-2026-03-15-12-50-31-CAc26ac1.json`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 2.2 Write property test for seed conversion (Property 2)
    - **Property 2: Seed conversion preserves fields and produces valid fixtures**
    - Use fast-check to generate valid call summary objects (both flat and nested)
    - Assert converted fixture preserves `callSid`, maps `callerPhone` → `from`, `twilioNumber` → `to`, preserves `startTime` and `endTime`
    - Assert `conversationHistory` is a valid array of `{ role, content }` objects
    - Place in `tests/property/post-call-agent-testing.property.test.js`
    - **Validates: Requirements 4.1, 4.3**

  - [ ]* 2.3 Write property test for speaker-to-role mapping (Property 3)
    - **Property 3: Speaker-to-role mapping is correct**
    - Use fast-check to generate transcript entries with speaker `"Caller"` or `"AI Receptionist"`
    - Assert `"Caller"` maps to `"user"`, `"AI Receptionist"` maps to `"assistant"`, and `content` equals original `message`
    - Place in `tests/property/post-call-agent-testing.property.test.js`
    - **Validates: Requirements 4.2**

- [x] 3. Seed a sample fixture and checkpoint
  - [x] 3.1 Run the seed utility against `call-summaries/call-2026-03-15-12-50-31-CAc26ac1.json` to create a sample fixture in `tests/simulated_call_bank/`
    - Verify the output fixture passes `validateFixture`
    - _Requirements: 1.1, 1.3, 4.1_

  - [x] 3.2 Checkpoint - Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create integration test file
  - [x] 4.1 Create `tests/integration/post-call-agent.test.js`
    - Use vitest `describe`/`it` blocks
    - Load fixtures via the loader module
    - Support `FIXTURE` env var to run a single fixture
    - For each fixture, call `runPostCallAgent(fixture.data)` and assert it completes without throwing
    - Report which tools were called (from agent result/logs)
    - Handle agent errors per-fixture (catch, report as failure, continue to next)
    - Set a generous test timeout (120s+) since these hit real OpenRouter
    - Report "no fixtures found" if call bank is empty
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 4.2 Exclude integration tests from default vitest run
    - Add `tests/integration/post-call-agent.test.js` to the `exclude` array in `vitest.config.js`
    - _Requirements: 3.1_

- [x] 5. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Integration tests hit real OpenRouter and should be run manually: `npx vitest run tests/integration/post-call-agent.test.js`
- Single fixture run: `FIXTURE=sample-call.json npx vitest run tests/integration/post-call-agent.test.js`
- Property tests use fast-check (already in the project)
- All code is CommonJS (require/module.exports)
