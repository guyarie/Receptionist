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
npm install                                    # Install dependencies
copy .env.example .env                         # Create environment file
cloudflared tunnel --url http://localhost:3000 # Expose server publicly
```

## Configuration
All configuration via `.env` file:
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `OPENROUTER_API_KEY` - OpenRouter API key
- `OPENROUTER_MODEL` - AI model (default: openai/gpt-4)
- `PORT` - Server port (default: 3000)

## Architecture Notes
- Uses TwiML (Twilio Markup Language) for call flow
- Speech recognition via Twilio's `<Gather>` verb
- WebSocket endpoint exists but not yet used (future real-time audio)
- Stateful conversation history stored in memory (Map)
