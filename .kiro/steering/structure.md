# Project Structure

## Directory Layout
```
.
├── src/                    # Source code
│   ├── server.js          # Main Express server, Twilio webhooks, WebSocket
│   ├── config.js          # Environment configuration loader
│   ├── ai-client.js       # OpenRouter AI client wrapper
│   ├── call-handler.js    # Call session management
│   ├── call-summary.js    # Call summary generation and storage
│   ├── prompts.js         # Prompt loader
│   ├── website-scraper.js # Website content scraper
│   ├── test-ai.js         # AI integration test script
│   └── test-chat.js       # Command-line chat test script
├── prompts/               # Editable AI prompts
│   ├── system-prompt.txt  # AI personality and behavior
│   ├── greeting.txt       # Initial greeting
│   ├── follow-up.txt      # Follow-up prompt
│   ├── closing.txt        # Closing message
│   ├── no-speech-detected.txt # No speech message
│   ├── error.txt          # Error message
│   └── README.md          # Prompt documentation
├── public/                # Static files and web interfaces
│   ├── chat.html          # Web chat interface
│   ├── chat-widget.js     # Embeddable chat widget
│   └── widget-example.html # Widget demo page
├── data/                  # Data files
│   ├── custom-info.json   # Manual practice information (address, hours, etc.)
│   └── website-cache.json # Cached website data
├── call-summaries/        # Call summary logs (generated)
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
│   └── steering/          # Project guidance documents
├── node_modules/          # Dependencies (not in git)
├── .env                   # Environment variables (not in git)
├── .env.example           # Example environment template
├── .gitignore             # Git ignore rules
├── package.json           # Node.js project manifest
├── package-lock.json      # Dependency lock file
└── README.md              # Main project documentation
```

## Module Responsibilities

### `server.js`
- Express app setup and middleware
- `/incoming-call` - Initial webhook, returns greeting TwiML
- `/handle-speech` - Processes caller speech, returns AI response
- `/call-status` - Twilio callback for call completion
- `/api/chat` - Chat API for web interface
- `/api/greeting` - Returns greeting prompt
- `/api/model-info` - Returns current AI model info
- `/api/test-model` - Tests model and returns metadata
- `/call-summaries` - View all call summaries (HTML)
- `/website-data` - View scraped website data
- `/refresh-website` - Refresh website data
- `/reload-prompts` - Reload prompt files
- `/media-stream` - WebSocket endpoint (future use)
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
