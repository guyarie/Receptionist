# Project Structure

## Directory Layout
```
.
├── src/                    # Source code
│   ├── server.js          # Main Express server, Twilio webhooks, WebSocket
│   ├── config.js          # Environment configuration loader
│   ├── ai-client.js       # OpenRouter AI client wrapper
│   ├── call-handler.js    # Call session management (turn-by-turn mode)
│   ├── call-summary.js    # Call summary generation and storage
│   ├── prompts.js         # Prompt loader
│   ├── website-scraper.js # Website content scraper
│   ├── availability-loader.js # Availability schedule loader
│   ├── error-buffer.js    # In-memory error tracking
│   ├── test-ai.js         # AI integration test script
│   ├── test-chat.js       # Command-line chat test script
│   └── realtime/          # Real-time voice streaming components
│       ├── provider-adapter.js  # Base class for AI provider adapters
│       ├── provider-factory.js  # Factory for creating provider adapters
│       ├── openai-adapter.js    # OpenAI Realtime API adapter
│       ├── relay-service.js     # Audio relay between Twilio and provider
│       └── session-manager.js   # Active streaming session tracking
├── prompts/               # Editable AI prompts
│   ├── system-prompt.txt  # AI personality and behavior
│   ├── greeting.txt       # Initial greeting
│   ├── follow-up.txt      # Follow-up prompt
│   ├── closing.txt        # Closing message
│   ├── no-speech-detected.txt # No speech message
│   ├── error.txt          # Error message
│   └── README.md          # Prompt documentation
├── availability/          # Provider availability schedules
│   ├── example-provider.md # Example availability file
│   └── README.md          # Availability documentation
├── public/                # Static files and web interfaces
│   ├── chat.html          # Web chat interface
│   ├── chat-widget.js     # Embeddable chat widget
│   ├── widget-example.html # Widget demo page
│   └── admin/             # Admin dashboard
│       ├── index.html     # Dashboard home
│       ├── calls.html     # Call logs viewer
│       ├── prompts.html   # Prompt editor
│       ├── availability.html # Availability editor
│       ├── admin.js       # Dashboard JavaScript
│       └── admin.css      # Dashboard styles
├── data/                  # Data files
│   ├── custom-info.json   # Manual practice information (address, hours, etc.)
│   └── website-cache.json # Cached website data
├── call-summaries/        # Call summary logs (generated)
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   └── property/          # Property-based tests
├── deployment/            # Deployment scripts and templates
│   ├── start.sh          # Server startup script
│   ├── install-service.sh # Systemd service installer
│   └── ai-phone-receptionist.service.template # Systemd service template
├── docs/                  # User documentation
│   ├── QUICK-START.md     # Getting started guide
│   ├── CUSTOMIZATION-GUIDE.md # How to customize prompts
│   ├── WEBSITE-INTEGRATION.md # Website scraping documentation
│   └── WIDGET-GUIDE.md    # Chat widget integration guide
├── devdocs/               # Developer documentation
│   └── TESTING-GUIDE.md   # Testing instructions
├── temp/                  # Temporary/development files
│   └── Starting_point.txt # Original project requirements
├── .kiro/                 # Kiro IDE configuration
│   ├── specs/             # Feature specifications
│   │   ├── ai-phone-receptionist/     # Original feature spec
│   │   └── realtime-voice-streaming/  # Real-time streaming spec
│   └── steering/          # Project guidance documents
├── node_modules/          # Dependencies (not in git)
├── .env                   # Environment variables (not in git)
├── .env.example           # Example environment template
├── .gitignore             # Git ignore rules
├── package.json           # Node.js project manifest
├── package-lock.json      # Dependency lock file
├── vitest.config.js       # Test configuration
└── README.md              # Main project documentation
```

## Module Responsibilities

### `server.js`
- Express app setup and middleware
- `/incoming-call` - Initial webhook, returns streaming or Gather TwiML based on mode
- `/handle-speech` - Processes caller speech in turn-by-turn mode, returns AI response
- `/call-status` - Twilio callback for call completion
- `/media-stream` - WebSocket endpoint for real-time audio streaming
- `/api/chat` - Chat API for web interface
- `/api/greeting` - Returns greeting prompt
- `/api/model-info` - Returns current AI model info
- `/api/test-model` - Tests model and returns metadata
- `/call-summaries` - View all call summaries (HTML)
- `/website-data` - View scraped website data
- `/refresh-website` - Refresh website data
- `/reload-prompts` - Reload prompt files
- `/admin/*` - Admin dashboard API endpoints
- Health check endpoint at `/`

### `config.js`
- Loads and validates environment variables
- Exports configuration object
- Exits process if required vars missing

### `ai-client.js`
- Singleton OpenRouter client
- Manages conversation history per session
- `initSession()` - Creates new conversation with system prompt
- `sendMessage()` - Sends user message, returns AI response
- `endSession()` - Cleans up session data
- `setWebsiteContext()` - Sets website context for AI

### `call-handler.js`
- Bridges between server and AI client
- Manages call state and session lifecycle
- Processes text input from speech recognition
- Saves call summaries when calls end

### `call-summary.js`
- Generates AI summaries of conversations
- Saves summaries to JSON files in call-summaries/
- Provides summary viewing interface

### `prompts.js`
- Loads prompt files from prompts/ directory
- Provides reload functionality for live updates
- Exports all prompts as properties

### `website-scraper.js`
- Scrapes RTC website for practice information
- Extracts clinician details and services
- Caches data locally
- Provides formatted context for AI

### `realtime/provider-adapter.js`
- Abstract base class for AI provider adapters
- Defines common interface: connect, sendAudio, cancelResponse, close
- Defines callback properties for events

### `realtime/provider-factory.js`
- Factory function for creating provider adapters
- Returns appropriate adapter based on configuration
- Returns null when provider unavailable (triggers fallback)

### `realtime/openai-adapter.js`
- OpenAI Realtime API implementation
- WebSocket connection to OpenAI
- Handles audio streaming and transcription
- Manages session configuration

### `realtime/relay-service.js`
- Bridges Twilio Media Stream and AI provider
- Manages bidirectional audio relay
- Captures conversation transcripts
- Handles interruptions and cleanup
- Generates call summaries

### `realtime/session-manager.js`
- Tracks active streaming sessions
- Maps streamSid to RelayService instances
- Provides session lookup and cleanup

## Code Conventions
- CommonJS modules (`require`/`module.exports`)
- Console logging with emoji prefixes for visibility
- XML escaping for TwiML responses
- Error handling with fallback TwiML responses
- Session IDs: Twilio CallSid for speech-based, unique ID for web chat

## File Organization Rules
- **Root folder**: Only configuration files (package.json, .env, .gitignore, README.md)
- **docs/**: User-facing documentation
- **devdocs/**: Developer documentation
- **temp/**: Temporary and development files (not for production)
- **src/**: All source code
- **prompts/**: Editable prompt files
- **public/**: Static web assets
- **data/**: Data files and caches
- **call-summaries/**: Generated call logs
