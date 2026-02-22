# Design Document: Twilio API Key Authentication

## Overview

This design migrates the Twilio authentication mechanism from account-level auth tokens to API key-based authentication. The change is straightforward since the Twilio SDK is not currently used in the codebase - we're only updating configuration files and documentation to prepare for future API usage.

The migration involves:
- Updating environment variable names and validation
- Modifying the config module structure
- Updating documentation files

## Architecture

No architectural changes are required. This is purely a configuration migration that affects:
- Environment variable loading (`src/config.js`)
- Environment template (`.env.example`)
- Setup documentation (`README.md`)
- Test fixtures (`tests/unit/vad-config.test.js`)

The application will continue to receive webhooks from Twilio without any functional changes.

## Components and Interfaces

### Config Module (`src/config.js`)

**Current Structure:**
```javascript
const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  // ... other config
};
```

**New Structure:**
```javascript
const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    apiKey: process.env.TWILIO_API_KEY,
    apiSecret: process.env.TWILIO_API_SECRET,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  // ... other config
};
```

**Validation Changes:**
- Remove `TWILIO_AUTH_TOKEN` from required variables array
- Add `TWILIO_API_KEY` to required variables array
- Add `TWILIO_API_SECRET` to required variables array

### Environment Template (`.env.example`)

**Current:**
```
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

**New:**
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret_here
TWILIO_PHONE_NUMBER=+1234567890
```

Add documentation comment explaining how to create API keys in Twilio Console.

### README Documentation

Update the following sections:
1. **Step 2: Configure Environment Variables** - Replace auth token with API key/secret
2. **Where to find these** - Add instructions for creating API keys
3. **Troubleshooting** - Update any references to auth tokens

## Data Models

No data models are affected. This is a configuration-only change.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system - essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Validation Completeness

*For any* configuration validation run, if `TWILIO_API_KEY` is missing, the system should reject the configuration and exit with an error.

**Validates: Requirements 2.1**

### Property 2: Configuration Validation Completeness

*For any* configuration validation run, if `TWILIO_API_SECRET` is missing, the system should reject the configuration and exit with an error.

**Validates: Requirements 2.2**

### Property 3: Configuration Export Structure

*For any* loaded configuration, the `config.twilio` object should contain `apiKey` and `apiSecret` properties and should not contain an `authToken` property.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 4: Environment Variable Loading

*For any* valid environment configuration with `TWILIO_API_KEY` set, the loaded config should have `config.twilio.apiKey` equal to the environment variable value.

**Validates: Requirements 1.1, 1.3**

### Property 5: Environment Variable Loading

*For any* valid environment configuration with `TWILIO_API_SECRET` set, the loaded config should have `config.twilio.apiSecret` equal to the environment variable value.

**Validates: Requirements 1.2, 1.3**

## Error Handling

The existing error handling in `config.js` is sufficient:
- Missing required variables trigger process exit with error message
- The error message lists all missing variables

No additional error handling is needed since we're not adding validation logic beyond presence checks.

## Testing Strategy

### Unit Tests

Unit tests should verify:
- Config module loads API key and secret correctly when provided
- Config module rejects configuration when API key is missing
- Config module rejects configuration when API secret is missing
- Config module does not export `authToken` property
- Existing tests that stub `TWILIO_AUTH_TOKEN` are updated to stub the new variables

### Property-Based Tests

Property tests should verify:
- Configuration validation properties (Properties 1-2)
- Configuration export structure (Property 3)
- Environment variable loading (Properties 4-5)

Each property test should run a minimum of 100 iterations and be tagged with:
```javascript
// Feature: twilio-api-key-auth, Property N: [property description]
```

### Integration Considerations

Since the Twilio SDK is not currently used, no integration tests are needed. The application will continue to receive webhooks without any functional changes.

When the Twilio SDK is eventually integrated, additional tests should verify that the API key credentials work correctly with the SDK's authentication mechanism.
