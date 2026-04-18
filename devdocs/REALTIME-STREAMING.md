# Real-Time Voice Streaming

## Overview

The server supports two voice interaction modes:

1. **Real-Time Streaming** (with `OPENAI_API_KEY`)
   - Low-latency bidirectional audio via OpenAI Realtime API
   - Natural interruptions supported
   - Feels like talking to a real person

2. **Turn-by-Turn Fallback** (without `OPENAI_API_KEY`)
   - Traditional Twilio Gather speech recognition
   - Uses OpenRouter for AI responses
   - Reliable but with turn-taking delays

`OPENAI_API_KEY` is required for production. Without it the server starts but rejects incoming calls.

## Architecture

```
Caller → Twilio → Media Stream WebSocket → Relay Service → OpenAI Realtime API
                                              ↓
                                    Session Manager (tracks active calls)
                                              ↓
                                    Call Summary generated on cleanup
```

**Components:**

| File | Role |
|---|---|
| `src/realtime/openai-adapter.js` | OpenAI Realtime API implementation |
| `src/realtime/provider-adapter.js` | Abstract base class for AI providers |
| `src/realtime/provider-factory.js` | Creates the right adapter from config |
| `src/realtime/relay-service.js` | Bridges Twilio ↔ AI provider, manages audio |
| `src/realtime/session-manager.js` | Tracks active streaming sessions |

## Configuration

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_REALTIME_VOICE=alloy        # alloy | echo | fable | onyx | nova | shimmer
REALTIME_AI_PROVIDER=openai

# VAD tuning (Voice Activity Detection)
OPENAI_VAD_SILENCE_DURATION_MS=600  # raise if AI cuts off slow speakers
OPENAI_VAD_PREFIX_PADDING_MS=300    # raise if start of speech gets clipped
```

## Session Lifecycle

1. Twilio opens WebSocket to `/media-stream`
2. Server receives `start` event with `callSid` and `streamSid`
3. Relay Service created and registered with Session Manager
4. Adapter connects to OpenAI Realtime API
5. Audio flows bidirectionally (G.711 μ-law, 8kHz — no conversion needed)
6. On call end, cleanup generates call summary
7. Session removed from Session Manager

## Startup Logs

Real-time available:
```
🎙️ Realtime voice streaming is available
🔌 Media stream WebSocket connected
🎬 Media stream started: MS001 for call CA123
```

Fallback mode:
```
⚠️ OPENAI_API_KEY not set — using Gather fallback
```

## Troubleshooting

**Real-time not working**
1. Check `OPENAI_API_KEY` is set and has credits
2. Look for `🎙️ Realtime voice streaming is available` on startup
3. Check WebSocket connection logs

**Audio quality issues**
1. Try a different voice in `.env`
2. Monitor for dropped connections in logs
3. Check server internet stability

**Fallback not working**
1. Verify `OPENROUTER_API_KEY` is set
2. Check existing Gather flow works independently
