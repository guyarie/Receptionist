# Implementation Plan: Twilio API Key Authentication

## Overview

This implementation migrates Twilio authentication from account-level auth tokens to API key-based authentication. The changes are configuration-only since the Twilio SDK is not currently used in the codebase.

## Tasks

- [ ] 1. Update config.js to use API key credentials
  - Replace `TWILIO_AUTH_TOKEN` with `TWILIO_API_KEY` and `TWILIO_API_SECRET` in validation
  - Update the `config.twilio` object to export `apiKey` and `apiSecret` instead of `authToken`
  - Remove `authToken` from the config exports
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ]* 1.1 Write unit tests for config.js changes
  - Test that config loads API key and secret correctly
  - Test that validation rejects missing API key
  - Test that validation rejects missing API secret
  - Test that authToken is not in exports
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 4.1, 4.2, 4.3_

- [ ]* 1.2 Write property test for configuration validation
  - **Property 1: Configuration validation completeness (API key)**
  - **Validates: Requirements 2.1**

- [ ]* 1.3 Write property test for configuration validation
  - **Property 2: Configuration validation completeness (API secret)**
  - **Validates: Requirements 2.2**

- [ ]* 1.4 Write property test for configuration export structure
  - **Property 3: Configuration export structure**
  - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ]* 1.5 Write property test for environment variable loading
  - **Property 4: Environment variable loading (API key)**
  - **Property 5: Environment variable loading (API secret)**
  - **Validates: Requirements 1.1, 1.2, 1.3**

- [ ] 2. Update .env.example with API key documentation
  - Replace `TWILIO_AUTH_TOKEN` with `TWILIO_API_KEY` and `TWILIO_API_SECRET`
  - Add example values showing correct format (SK prefix for API key)
  - Add comment explaining how to create API keys in Twilio Console
  - Add comment explaining the security benefits of API keys
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Update README.md with API key setup instructions
  - Update "Step 2: Configure Environment Variables" section to use API keys
  - Update "Where to find these" section with API key creation instructions
  - Remove all references to `TWILIO_AUTH_TOKEN`
  - Add link to Twilio Console API Keys page
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4. Update test fixtures to use API key credentials
  - Update `tests/unit/vad-config.test.js` to stub `TWILIO_API_KEY` and `TWILIO_API_SECRET`
  - Remove `TWILIO_AUTH_TOKEN` stubs from test files
  - _Requirements: 1.1, 1.2_

- [ ] 5. Checkpoint - Verify all changes
  - Ensure all tests pass
  - Verify config.js loads correctly with new environment variables
  - Verify .env.example has clear documentation
  - Ask the user if questions arise

## Notes

- This is a configuration-only migration - no functional changes to the application
- The Twilio SDK is not currently used, so no SDK integration changes are needed
- Tasks marked with `*` are optional testing tasks and can be skipped for faster implementation
- When the Twilio SDK is eventually integrated, these credentials will be ready to use
