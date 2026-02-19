# Tests for /api/webchat Endpoint

## Overview
This directory contains comprehensive tests for the `/api/webchat` endpoint, including unit tests, integration tests, and security/edge case validation.

## Test Files

### `unit/webchat-endpoint.test.js` (20 tests)
Unit tests focusing on:
- Input validation logic
- Request/response format
- AI client integration
- Stateless behavior verification

### `unit/webchat-integration.test.js` (9 tests)
Integration tests using supertest to test the actual HTTP endpoint:
- HTTP status codes
- Request/response handling
- Error handling
- End-to-end flow

### `unit/webchat-edge-cases.test.js` (31 tests)
Security and edge case tests covering:
- **Malformed Message Objects**: Nested objects, arrays, undefined values, wrong types
- **Role Injection Attempts**: System, function, tool roles, custom roles, case variations
- **SessionId Edge Cases**: Very long IDs, whitespace-only, wrong types, special characters
- **Messages Array Edge Cases**: Very large arrays, very long content, unicode, special chars
- **Malformed Request Bodies**: Null, string, array bodies, wrong Content-Type
- **Prototype Pollution**: `__proto__` and `constructor` injection attempts
- **Valid Edge Cases**: Alternating conversations, consecutive messages, whitespace handling

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Webchat Tests Only
```bash
npm test -- tests/unit/webchat
```

### Run Specific Test File
```bash
npm test -- tests/unit/webchat-edge-cases.test.js
```

### Run in Watch Mode (Development)
```bash
npx vitest
```

## Test Coverage Summary

**Total Tests**: 60 tests for `/api/webchat` endpoint  
**Status**: ✅ All passing

The tests verify all acceptance criteria from Issue #3 plus comprehensive security validation:

✅ POST /api/webchat endpoint exists  
✅ Accepts JSON body with messages and sessionId  
✅ Calls existing AI conversation logic  
✅ Returns assistant response as JSON  
✅ Does not store conversation server-side  
✅ Includes comprehensive input validation  
✅ Returns appropriate HTTP status codes on error  
✅ Protects against DoS attacks (length limits)  
✅ Blocks role injection attempts  
✅ Handles malformed inputs gracefully  
✅ Resistant to prototype pollution  

## Security Validation

The endpoint enforces strict validation rules documented in `docs/API.md`:

### DoS Protection Limits
- **SessionId**: Max 1000 characters
- **Messages Array**: Max 1000 messages
- **Message Content**: Max 50000 characters per message

### Role Whitelisting
- Only `"user"` and `"assistant"` roles allowed
- Blocks `"system"` (prompt injection)
- Blocks `"function"` and `"tool"` (privilege escalation)
- Case-sensitive validation (rejects "USER", "ASSISTANT")

### Input Type Validation
- Request body must be JSON object (not null, string, or array)
- SessionId must be non-empty string
- Messages must be non-empty array
- Each message must have string `role` and `content`

## Test Cases

### Input Validation (20 tests)
- Missing sessionId → 400
- Empty sessionId → 400
- Non-string sessionId → 400
- Missing messages → 400
- Empty messages array → 400
- Non-array messages → 400
- Missing message.role → 400
- Missing message.content → 400
- Invalid message.role (not 'user' or 'assistant') → 400
- Non-string message.role → 400
- Non-string message.content → 400
- Null message object → 400

### Edge Cases (31 tests)
- Deeply nested objects in content → 400
- Arrays as content → 400
- Very long sessionId (10000 chars) → 400
- Very large messages array (10000 messages) → 400
- Very long content (100000 chars) → 400
- System/function/tool roles → 400
- Case variation roles (USER, ASSISTANT) → 400
- Null/string/array request body → 400
- Prototype pollution attempts → Ignored safely
- Unicode and special characters → Accepted
- Extra message fields → Ignored safely

### Valid Requests (9 tests)
- Single user message → 200 with reply
- Full conversation history → 200 with reply
- Alternating user/assistant messages → 200
- Consecutive user messages → 200
- Whitespace in sessionId is trimmed
- SessionId is returned unchanged

### Error Handling
- AI client error → 500 with error message
- Malformed input → 400 with descriptive error

### Stateless Behavior
- No server-side session storage
- Each request is independent
- Full conversation context passed from client

## Response Format

**Success (200 OK)**
```json
{
  "reply": "Assistant message",
  "sessionId": "uuid"
}
```

**Error (400 Bad Request)**
```json
{
  "error": "Error description"
}
```

**Error (500 Internal Server Error)**
```json
{
  "error": "Failed to process message",
  "details": "Additional error details"
}
```

## Documentation

For API usage and integration:
- See `docs/API.md` for endpoint documentation
- See `docs/WIDGET-GUIDE.md` for website integration
- See `src/server.js` for inline code documentation
