# API Documentation

## Chat Endpoints

### POST /api/webchat

Stateless chat endpoint for website integration. Accepts full conversation history and returns AI response without server-side storage.

#### Request

```http
POST /api/webchat
Content-Type: application/json
```

```json
{
  "sessionId": "client-generated-uuid",
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" },
    { "role": "user", "content": "What are your hours?" }
  ]
}
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | Client-generated unique identifier for the conversation (e.g., UUID). Max 1000 characters. |
| `messages` | array | Yes | Array of message objects representing the conversation history. Max 1000 messages. |
| `messages[].role` | string | Yes | Message sender. Must be `"user"` or `"assistant"`. |
| `messages[].content` | string | Yes | Message text. Max 50000 characters. |

#### Response

**Success (200 OK)**
```json
{
  "reply": "We are open Monday through Friday, 9 AM to 5 PM.",
  "sessionId": "client-generated-uuid"
}
```

**Error (400 Bad Request)**
```json
{
  "error": "Missing or invalid sessionId"
}
```

**Error (500 Internal Server Error)**
```json
{
  "error": "Failed to process message",
  "details": "Error description"
}
```

#### Validation Rules

The endpoint enforces strict validation for security and stability:

1. **Request Body**: Must be a JSON object (not null, string, or array)
2. **SessionId**: 
   - Must be a non-empty string
   - Whitespace is trimmed
   - Maximum 1000 characters
3. **Messages Array**:
   - Must be a non-empty array
   - Maximum 1000 messages
4. **Individual Messages**:
   - Must be objects with `role` and `content` properties
   - Both properties must be strings
   - `role` must be exactly `"user"` or `"assistant"` (case-sensitive)
   - `content` maximum 50000 characters
   - Extra fields are ignored

#### Security Notes

- **Role Restriction**: Only `"user"` and `"assistant"` roles are allowed. System prompts cannot be injected via `"system"` role.
- **DoS Protection**: Length limits prevent resource exhaustion attacks.
- **Stateless Design**: No conversation data is stored server-side. Client must send full history with each request.
- **Input Validation**: All inputs are validated before processing. Malformed requests return 400 errors.

#### Example Usage

**JavaScript (Fetch API)**
```javascript
const response = await fetch('http://localhost:3000/api/webchat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: crypto.randomUUID(),
    messages: [
      { role: 'user', content: 'What services do you offer?' }
    ]
  })
});

const data = await response.json();
console.log(data.reply);
```

**cURL**
```bash
curl -X POST http://localhost:3000/api/webchat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "messages": [
      {"role": "user", "content": "What are your hours?"}
    ]
  }'
```

### GET /api/greeting

Returns the initial greeting message for the chat interface.

#### Response

```json
{
  "greeting": "Hello! Thank you for contacting us..."
}
```

### GET /api/model-info

Returns information about the current AI model being used.

#### Response

```json
{
  "model": "openai/gpt-4o",
  "provider": "OpenRouter"
}
```

## Integration

For website integration, see:
- [Widget Guide](WIDGET-GUIDE.md) - Embeddable chat widget
- [Quick Start](QUICK-START.md) - Getting started guide
