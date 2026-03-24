# Project Structure

## Directory Layout
```
.
├── src/                    # Source code
│   ├── server.js          # Main Express server, Twilio webhooks, WebSocket
│   ├── config.js          # Environment configuration loader
│   ├── admin-auth.js      # Admin authentication (login, sessions, CSRF)
│   ├── ai-client.js       # OpenRouter AI client wrapper
│   ├── call-handler.js    # Call session management (turn-by-turn mode)
│   ├── call-summary.js    # Call summary generation and storage
│   ├── chat-logger.js     # Web chat conversation logger
│   ├── prompts.js         # Prompt loader (data/prompts/ override → prompts/ default)
│   ├── provider-loader.js # Provider profile loader (reads data/providers/)
│   ├── scrape-providers.js # Website scraper for provider profiles
│   ├── browser-manager.js # Puppeteer browser lifecycle management
│   ├── availability-loader.js # Availability schedule loader (reads data/availability/)
│   ├── email-transport.js # SMTP email sending
│   ├── error-buffer.js    # In-memory error ring buffer
│   ├── time-utils.js      # Timezone and timestamp helpers
│   ├── test-ai.js         # AI integration test script
│   ├── test-chat.js       # Command-line chat test script
│   ├── test-email.js      # Email transport test script
│   ├── agents/            # AI agent modules
│   │   ├── post-call-agent.js   # Post-call processing agent
│   │   ├── daily-digest-agent.js # Daily email digest agent
│   │   └── tools.js             # Shared tool definitions for agents
│   └── realtime/          # Real-time voice streaming components
│       ├── provider-adapter.js  # Base class for AI provider adapters
│       ├── provider-factory.js  # Factory for creating provider adapters
│       ├── openai-adapter.js    # OpenAI Realtime API adapter
│       ├── relay-service.js     # Audio relay between Twilio and provider
│       └── session-manager.js   # Active streaming session tracking
├── prompts/               # Repo-default AI prompts (checked into git)
│   ├── system-prompt.txt  # AI personality and behavior
│   ├── greeting.txt       # Voice call opening greeting
│   ├── webchat-greeting.txt # Web chat opening greeting
│   ├── follow-up.txt      # Follow-up prompt
│   ├── closing.txt        # Closing message
│   ├── no-speech-detected.txt # No speech message
│   ├── error.txt          # Error message
│   ├── scraping-instructions.txt # Provider scraping AI instructions
│   ├── post-call-agent.txt # Post-call agent instructions
│   ├── daily-digest-agent.txt # Daily digest agent instructions
│   └── README.md          # Prompt documentation
├── data/                  # User/deployment-specific data (gitignored)
│   ├── prompts/           # Prompt overrides (takes priority over prompts/)
│   ├── providers/         # Scraped provider profiles (*.md)
│   ├── practice/          # Scraped practice overview
│   └── availability/      # Provider availability schedules (*.md)
├── runtime/               # Generated output (gitignored, safe to wipe)
│   ├── call-summaries/    # Call summary JSON files
│   ├── agent-logs/        # Post-call agent debug logs
│   ├── chat-logs/         # Web chat conversation logs
│   ├── scrape-cache/      # Raw HTML/text scrape cache
│   └── backups/           # data/ snapshots before website refresh
├── public/                # Static files and web interfaces
│   ├── chat.html          # Web chat interface
│   ├── embed-chat.html    # Full-page embeddable chat
│   ├── chat-widget.js     # Embeddable chat widget
│   ├── widget-example.html # Widget demo page
│   └── admin/             # Admin dashboard (password-protected)
│       ├── index.html     # Dashboard home
│       ├── calls.html     # Call logs viewer
│       ├── chats.html     # Web chat logs viewer
│       ├── prompts.html   # Prompt editor
│       ├── providers.html # Provider profiles viewer
│       ├── availability.html # Availability editor
│       ├── admin.js       # Dashboard JavaScript
│       └── admin.css      # Dashboard styles
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   └── property/          # Property-based tests
├── deployment/            # Deployment scripts and templates
│   ├── start.sh          # Server startup script
│   ├── install-service.sh # Systemd service installer
│   └── ai-phone-receptionist.service.template # Systemd service template
├── docs/                  # User documentation
├── devdocs/               # Developer documentation
├── examples/              # Example data files and templates
├── .kiro/                 # Kiro IDE configuration
│   ├── specs/             # Feature specifications
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

## Data Directory Conventions

The project separates data into two gitignored directories:

### `data/` — User-customized content
Persists across deploys. Contains deployment-specific overrides and scraped content.
- `data/prompts/` overrides take priority over `prompts/` repo defaults
- Admin UI prompt editor writes to `data/prompts/`, never modifies repo defaults
- `data/public/` files are served instead of matching `public/` files (static override)

### `runtime/` — Generated output
Created automatically by the application. Safe to delete (will be regenerated).
- Call summaries, agent logs, and backups are written here
- Never committed to git

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
- Saves summaries to JSON files in runtime/call-summaries/
- Provides summary viewing interface and pagination

### `chat-logger.js`
- Logs web chat conversations to runtime/chat-logs/
- Tracks active sessions in memory, writes JSON per session

### `prompts.js`
- Loads prompt files with override priority: data/prompts/ → prompts/
- Provides reload functionality for live updates
- Admin UI reads/writes through this module
- Exports all prompts as properties

### `provider-loader.js`
- Loads provider profile markdown files from data/providers/
- Provides provider data to AI context and admin UI

### `scrape-providers.js`
- Scrapes practice website for provider profiles and practice info
- Writes provider profiles to data/providers/ and practice overview to data/practice/
- Caches raw scrape data in runtime/scrape-cache/
- Uses Puppeteer (via browser-manager.js) or Axios fallback

### `browser-manager.js`
- Manages Puppeteer browser lifecycle for website scraping
- Singleton browser instance reused across scrape operations

### `email-transport.js`
- SMTP email sending for notifications and daily digest
- Lazy initialization — validates config without connecting until first send

### `time-utils.js`
- Timezone-aware timestamp helpers (Pacific Time default)
- Filename-safe timestamp formatting

### `agents/post-call-agent.js`
- Runs after each call ends
- Generates summary, optionally sends provider notifications
- Reads prompt from data/prompts/ (override) or prompts/ (default)
- Saves debug logs to runtime/agent-logs/

### `agents/daily-digest-agent.js`
- Runs on cron schedule (Mon-Fri)
- Composes and sends daily call summary email to admin
- Reads prompt from data/prompts/ (override) or prompts/ (default)

### `agents/tools.js`
- Shared tool definitions for AI agents (save_call_summary, read_provider_profiles, read_call_summaries, send_email)

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
- **src/**: All source code
- **src/agents/**: AI agent modules (post-call, daily digest)
- **src/realtime/**: Real-time voice streaming components
- **prompts/**: Repo-default prompt files (checked into git)
- **data/**: User/deployment-specific data (gitignored) — overrides repo defaults
- **data/prompts/**: Prompt overrides (priority over prompts/)
- **data/providers/**: Scraped provider profiles
- **data/practice/**: Scraped practice overview
- **data/availability/**: Provider availability schedules
- **runtime/**: Generated output (gitignored, safe to wipe)
- **runtime/call-summaries/**: Call summary JSON files
- **runtime/agent-logs/**: Post-call agent debug logs
- **runtime/chat-logs/**: Web chat conversation logs
- **runtime/scrape-cache/**: Raw scrape cache
- **runtime/backups/**: data/ snapshots before website refresh
- **public/**: Static web assets and admin dashboard
- **examples/**: Example data files and templates
- **tests/**: Unit and property-based tests
