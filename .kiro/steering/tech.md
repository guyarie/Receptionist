# Technology Stack

## Runtime & Language
- **Node.js** (v20 LTS recommended, v22+ supported)
- **JavaScript** (CommonJS modules)
- No TypeScript (planned for future)

## Core Dependencies
- `express` (v5.2.1) - Web server and webhook handling
- `twilio` (v5.12.1) - Phone system integration
- `openai` (v6.18.0) - OpenRouter API client
- `ws` (v8.19.0) - WebSocket support for real-time audio
- `dotenv` (v17.2.4) - Environment configuration

## External Services
- **Twilio** - Phone number, voice calls, speech-to-text
- **OpenRouter** - AI model access (GPT-4)
- **Cloudflare Tunnel** - Public URL for webhooks

## Common Commands

### Development
```bash
npm start          # Start the server
npm run dev        # Start in dev mode (same as start)
npm run test-ai    # Test OpenRouter API integration
```

### Setup
```bash
npm install                # Install dependencies
copy .env.example .env     # Create environment file
npm start                  # Start the server
```

## Configuration
All configuration via `.env` file:
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `OPENROUTER_API_KEY` - OpenRouter API key (required)
- `OPENROUTER_MODEL` - AI model (default: openai/gpt-4)
- `OPENAI_API_KEY` - OpenAI API key (optional, enables real-time streaming)
- `OPENAI_REALTIME_VOICE` - Voice for real-time mode (default: alloy)
- `REALTIME_AI_PROVIDER` - Provider for real-time streaming (default: openai)
- `PORT` - Server port (default: 3000)

## Architecture Notes
- Dual voice modes: real-time streaming (OpenAI Realtime API) or turn-by-turn (Twilio Gather)
- Real-time mode: Bidirectional audio via WebSocket (Twilio Media Streams → Relay Service → OpenAI)
- Turn-by-turn mode: Uses TwiML `<Gather>` for speech recognition, `<Say>` for responses
- Graceful fallback: System works without OPENAI_API_KEY using Gather-based flow
- WebSocket endpoint at `/media-stream` handles real-time audio relay
- Stateful conversation history stored in memory (Map for turn-by-turn, RelayService for streaming)
- Call summaries generated for both modes using OpenRouter
