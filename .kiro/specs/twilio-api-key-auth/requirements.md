# Requirements Document

## Introduction

This feature migrates Twilio authentication from account-level auth tokens to API key-based authentication. The current implementation uses `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`, but the Twilio SDK is not yet used in the codebase (the application only receives webhooks). This migration prepares the system for future Twilio API usage with improved security through scoped permissions and easier credential rotation.

## Glossary

- **API_Key**: Scoped credential with limited permissions that can be rotated independently
- **API_Secret**: The secret value paired with an API key for authentication
- **Config_Module**: The configuration loader module (src/config.js) that validates and exports environment variables
- **Environment_File**: The .env file containing sensitive credentials
- **Validation_System**: The configuration validation logic that ensures required credentials are present

## Requirements

### Requirement 1: API Key Environment Variables

**User Story:** As a system administrator, I want to use API key-based authentication, so that I can implement better security practices with scoped permissions and easier credential rotation.

#### Acceptance Criteria

1. THE Config_Module SHALL accept `TWILIO_API_KEY` as a required environment variable
2. THE Config_Module SHALL accept `TWILIO_API_SECRET` as a required environment variable
3. THE Config_Module SHALL use API key credentials for authentication configuration
4. THE Config_Module SHALL no longer accept or use `TWILIO_AUTH_TOKEN`

### Requirement 2: Configuration Validation

**User Story:** As a system administrator, I want the system to validate that API key credentials are provided, so that I can catch configuration errors early.

#### Acceptance Criteria

1. WHEN `TWILIO_API_KEY` is not provided, THE Validation_System SHALL reject the configuration and exit with an error message
2. WHEN `TWILIO_API_SECRET` is not provided, THE Validation_System SHALL reject the configuration and exit with an error message
3. THE Validation_System SHALL include `TWILIO_API_KEY` and `TWILIO_API_SECRET` in the list of required environment variables
4. THE Validation_System SHALL remove `TWILIO_AUTH_TOKEN` from the list of required environment variables

### Requirement 3: Environment File Documentation

**User Story:** As a developer, I want clear documentation of the API key credentials, so that I can configure the system correctly.

#### Acceptance Criteria

1. THE Environment_File template SHALL document `TWILIO_API_KEY` with an example format
2. THE Environment_File template SHALL document `TWILIO_API_SECRET` with an example format
3. THE Environment_File template SHALL explain the purpose of API keys
4. THE Environment_File template SHALL provide instructions for obtaining API keys from Twilio Console
5. THE Environment_File template SHALL remove `TWILIO_AUTH_TOKEN` documentation

### Requirement 4: Configuration Export Structure

**User Story:** As a developer, I want a clean configuration structure for API keys, so that future Twilio SDK integration is straightforward.

#### Acceptance Criteria

1. THE Config_Module SHALL export `twilio.apiKey` property containing the API key
2. THE Config_Module SHALL export `twilio.apiSecret` property containing the API secret
3. THE Config_Module SHALL remove the `twilio.authToken` property from exports
4. THE Config_Module SHALL maintain the existing `twilio.accountSid` property unchanged
5. THE Config_Module SHALL maintain the existing `twilio.phoneNumber` property unchanged

### Requirement 5: README Documentation Updates

**User Story:** As a developer, I want updated setup instructions in the README, so that I can configure the system with API keys.

#### Acceptance Criteria

1. THE README SHALL document `TWILIO_API_KEY` in the configuration section
2. THE README SHALL document `TWILIO_API_SECRET` in the configuration section
3. THE README SHALL remove references to `TWILIO_AUTH_TOKEN`
4. THE README SHALL provide instructions for creating API keys in Twilio Console
5. THE README SHALL update the "Where to find these" section with API key instructions
