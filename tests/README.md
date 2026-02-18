# Tests for /api/webchat Endpoint

## Overview
This directory contains tests for the `/api/webchat` endpoint that was added to support stateless web chat functionality.

## Test Files

### `unit/webchat-endpoint.test.js`
Unit tests focusing on:
- Input validation logic
- Request/response format
- AI client integration
- Stateless behavior verification

### `unit/webchat-integration.test.js`
Integration tests using supertest to test the actual HTTP endpoint:
- HTTP status codes
- Request/response handling
- Error handling
- End-to-end flow

## Running Tests

### Install Test Dependencies
```bash
npm install --save-dev supertest
```

### Run All Tests
```bash
npm test
```

### Run Specific Test File
```bash
npx vitest tests/unit/webchat-endpoint.test.js
```

### Run in Watch Mode
```bash
npx vitest
```

## Test Coverage

The tests verify all acceptance criteria from Issue #3:

✅ POST /api/webchat endpoint exists  
✅ Accepts JSON body with messages and sessionId  
✅ Calls existing AI conversation logic  
✅ Returns assistant response as JSON  
✅ Does not store conversation server-side  
✅ Includes basic input validation  
✅ Returns appropriate HTTP status codes on error  

## Test Cases

### Input Validation
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

### Valid Requests
- Single user message → 200 with reply
- Full conversation history → 200 with reply
- Whitespace in sessionId is trimmed
- SessionId is returned unchanged

### Error Handling
- AI client error → 500 with error message

### Stateless Behavior
- No server-side session storage
- Each request is independent
- Full conversation context passed from client

## Response Format

```json
{
  "reply": "Assistant message",
  "sessionId": "uuid"
}
```

## Error Response Format

```json
{
  "error": "Error description",
  "details": "Additional error details (optional)"
}
```
