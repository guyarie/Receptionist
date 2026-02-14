# Real-Time Voice Streaming Feature

## Overview

The AI Phone Receptionist now supports two voice interaction modes:

1. **Real-Time Streaming Mode** (with `OPENAI_API_KEY`)
   - Low-latency bidirectional audio streaming
   - Natural interruptions supported
   - Uses OpenAI Realtime API via WebSocket
   - Conversational flow like talking to a real person

2. **Turn-by-Turn Mode** (fallback without `OPENAI_API_KEY`)
   - Traditional speech recognition using Twilio Gather
   - Reliable and cost-effective
   - Uses OpenRouter for AI responses
   - Works without additional API keys

## Architecture

### Real-Time Streaming Flow

```
Caller → Twilio → Media Stream WebSocket → Relay Service → OpenAI Realtime API
                                              ↓
                                    Session Manager tracks active calls
                                              ↓
                                    Call Summary generated on cleanup
```

### Components

- **Provider Adapter** (`src/realtime/provider-adapter.js`): Abstract base class defining the interface for AI providers
- **OpenAI Adapter** (`src/realtime/openai-adapter.js`): Concrete implementation for OpenAI Realtime API
- **Provider Factory** (`src/realtime/provider-factory.js`): Creates appropriate adapter based on configuration
- **Relay Service** (`src/realtime/relay-service.js`): Bridges Twilio and AI provider, manages audio relay
- **Session Manager** (`src/realtime/session-manager.js`): Tracks active streaming sessions

### Server Integration

The server (`src/server.js`) automatically detects which mode to use:

```javascript
const realtimeAvailable = createProviderAdapter(config.realtime.provider, config) !== null;
```

- When `realtimeAvailable` is true: Returns `<Connect><Stream>` TwiML
- When `realtimeAvailable` is false: Returns `<Gather>` TwiML (existing behavior)

## Configuration

Add to `.env`:

```env
# Optional - enables real-time streaming
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_REALTIME_VOICE=alloy
REALTIME_AI_PROVIDER=openai
```

Available voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

## Features

### Real-Time Mode Features

- **Low Latency**: Sub-second response times
- **Natural Interruptions**: Caller can interrupt AI mid-sentence
- **Continuous Audio**: No turn-taking delays
- **Transcription**: Automatic transcription of both sides
- **Call Summaries**: AI-generated summaries using OpenRouter

### Backward Compatibility

- All existing features work unchanged
- Web chat continues to use OpenRouter
- Admin dashboard works with both modes
- Call summaries generated for both modes
- Graceful fallback when OpenAI key not set

## Testing

### Test Real-Time Mode

1. Set `OPENAI_API_KEY` in `.env`
2. Restart server
3. Look for: `🎙️ Realtime voice streaming is available`
4. Call your Twilio number
5. Try interrupting the AI while it's speaking

### Test Turn-by-Turn Mode

1. Remove `OPENAI_API_KEY` from `.env`
2. Restart server
3. Look for: `⚠️ ... using Gather fallback`
4. Call your Twilio number
5. Wait for AI to finish before speaking

## Implementation Details

### Audio Format

- Twilio Media Streams use G.711 μ-law (8kHz)
- OpenAI Realtime API supports `g711_ulaw` natively
- No audio conversion needed

### Session Lifecycle

1. Twilio opens WebSocket to `/media-stream`
2. Server receives `start` event with callSid and streamSid
3. Relay Service created and added to Session Manager
4. Provider adapter connects to OpenAI
5. Audio flows bidirectionally
6. On call end, cleanup generates call summary
7. Session removed from Session Manager

### Error Handling

- Provider connection failures trigger cleanup
- Errors added to error buffer for admin dashboard
- Idempotent cleanup prevents double-cleanup issues
- Graceful degradation on provider errors

## Monitoring

### Server Logs

Real-time mode logs:
```
🎙️ Realtime voice streaming is available
🔌 Media stream WebSocket connected
🎬 Media stream started: MS001 for call CA123
🛑 Media stream stopped
```

Turn-by-turn mode logs:
```
⚠️ OPENAI_API_KEY not set — using Gather fallback
📞 Incoming call: CA123 from +1234567890
💬 Caller said: "I need help finding a therapist"
```

### Admin Dashboard

- View call logs for both modes
- Transcripts captured for streaming calls
- Call summaries generated for all calls
- Error buffer shows streaming-related errors

## Cost Considerations

### Real-Time Mode
- OpenAI Realtime API charges per audio minute
- Higher cost but better user experience
- Recommended for production use

### Turn-by-Turn Mode
- Twilio speech recognition charges per request
- OpenRouter charges per token
- Lower cost, suitable for budget-conscious deployments

## Future Enhancements

- Support for additional providers (Google Gemini Live, custom STT+LLM+TTS)
- Voice activity detection tuning
- Custom audio processing pipeline
- Multi-language support
- Advanced interruption handling

## Troubleshooting

### Real-time streaming not working

1. Check `OPENAI_API_KEY` is set in `.env`
2. Verify OpenAI API key has credits
3. Look for `🎙️ Realtime voice streaming is available` on startup
4. Check WebSocket connection logs
5. Monitor for provider errors in logs

### Audio quality issues

1. Check internet connection stability
2. Try different voice in `.env`
3. Monitor server logs for dropped connections
4. Check Twilio Media Stream quality

### Fallback not working

1. Verify OpenRouter API key is set
2. Check existing Gather-based flow works
3. Review server logs for errors

## Documentation

- **Spec**: `.kiro/specs/realtime-voice-streaming/`
- **Requirements**: `.kiro/specs/realtime-voice-streaming/requirements.md`
- **Design**: `.kiro/specs/realtime-voice-streaming/design.md`
- **Tasks**: `.kiro/specs/realtime-voice-streaming/tasks.md`

## Testing

Run tests:
```bash
npm test
```

All tests pass (18 tests across 4 test files).
