# AI Phone Receptionist

AI-powered phone receptionist for any business. Configure via environment variables and prompt files.

## Quick Start Guide

### Prerequisites
- Node.js installed (v18 or higher)
- Twilio account with a phone number
- OpenRouter API key (for text chat and call summaries)
- OpenAI API key (optional, for real-time voice streaming)
- Domain name with SSL certificate (for production deployment)

### Step 1: Install Dependencies
```bash
npm install 
```

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```env
   # Required - Twilio Configuration
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   
   # Required - OpenRouter Configuration (for text chat and call summaries)
   OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxx
   OPENROUTER_MODEL=openai/gpt-4
   
   # Optional - Realtime Voice Streaming (enables low-latency conversational AI)
   OPENAI_API_KEY=sk-xxxxxxxxxxxxx
   OPENAI_REALTIME_VOICE=alloy
   REALTIME_AI_PROVIDER=openai
   
   # Server Configuration
   PORT=3000
   
   # Admin Panel Security
   ADMIN_ALLOWED_IPS=                    # Comma-separated IPs (leave empty to allow all)
   ADMIN_PASSWORD=your-secure-password   # Required for production
   SESSION_SECRET=your-random-secret     # Optional (uses ADMIN_PASSWORD if not set)
   ```

**Where to find these:**
- **Twilio credentials**: [Twilio Console](https://console.twilio.com/) → Account Info
- **Twilio phone number**: [Twilio Console](https://console.twilio.com/) → Phone Numbers → Buy a number
- **OpenRouter API key**: [OpenRouter](https://openrouter.ai/) → Keys
- **OpenAI API key** (optional): [OpenAI Platform](https://platform.openai.com/api-keys) → Create new secret key

**Voice Streaming Mode:**
- **With `OPENAI_API_KEY` set**: Uses real-time bidirectional audio streaming (low latency, natural interruptions)
- **Without `OPENAI_API_KEY`**: Falls back to turn-by-turn speech recognition (Gather-based, still works great!)

**Available voices for realtime streaming**: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

### Step 2.5: Setup Data Folder

The `data/` folder contains all deployment-specific files. It is **gitignored** — your customizations stay on your server and are never overwritten by repo updates.

#### Files you can provide in `data/`

| File / Folder | Purpose | Required? |
|---|---|---|
| `data/prompts/system-prompt.txt` | Main AI system prompt (replaces repo default) | Recommended |
| `data/prompts/greeting.txt` | Voice call opening greeting | Optional |
| `data/prompts/webchat-greeting.txt` | Web chat opening greeting | Optional |
| `data/prompts/post-call-agent.txt` | Post-call processing instructions | Optional |
| `data/prompts/daily-digest-agent.txt` | Daily email digest instructions | Optional |
| `data/providers/*.md` | Provider/staff profiles (AI-generated via `npm run scrape-providers`) | Recommended |
| `data/practice/custom-info.json` | Business address, hours, parking, and other details | Recommended |
| `data/public/embed-chat.html` | Custom-branded full-page chat UI (replaces repo default) | Optional |
| `data/public/` *(any file)* | Any file here is served instead of the matching file in `public/` | Optional |

**Override priority:** `data/` always wins over the repo defaults. You only need to provide the files you want to customize.

#### Runtime folder (`runtime/`)

The `runtime/` folder is created automatically and holds everything the software generates. It is gitignored — never committed.

| Folder | Contents |
|---|---|
| `runtime/call-summaries/` | JSON file per call — transcript, summary, metadata |
| `runtime/agent-logs/` | Debug logs from the post-call agent |
| `runtime/backups/` | `tar.gz` snapshots of `data/` created before each "Refresh Website Data" |

To generate provider profiles by scraping your website:

```bash
npm run scrape-providers
```

This will create markdown files in `data/providers/` with AI-generated summaries of your business and staff.

#### Puppeteer Setup for Website Scraping

The scraper uses **Puppeteer** (headless Chrome) by default to capture JavaScript-rendered content like insurance information. This requires Chrome/Chromium to be installed on your system.

**System Dependencies:**

- **Windows**: Chrome is usually already installed. If not, [download Chrome](https://www.google.com/chrome/)
- **Linux (Ubuntu/Debian)**:
  ```bash
  sudo apt-get update
  sudo apt-get install -y chromium-browser
  ```
- **Linux (CentOS/RHEL)**:
  ```bash
  sudo yum install -y chromium
  ```
- **macOS**: Chrome is usually already installed. If not, [download Chrome](https://www.google.com/chrome/)

**Configuration Options:**

The scraper behavior can be customized via environment variables in your `.env` file:

```env
# Scraping mode: 'puppeteer' (default) or 'axios' (fallback)
SCRAPING_MODE=puppeteer

# Multi-page scraping: visit individual provider pages for complete data
MULTI_PAGE_SCRAPING=true         # Enable multi-page scraping (recommended)

# Puppeteer settings
PAGE_LOAD_TIMEOUT=10000          # Page load timeout in milliseconds
BROWSER_HEADLESS=true            # Run browser in headless mode
BROWSER_DISABLE_IMAGES=true      # Disable images for faster scraping
BROWSER_DISABLE_CSS=false        # Disable CSS (not recommended)

# Retry settings
MAX_RETRIES=3                    # Retry attempts for failed pages
RETRY_DELAY=1000                 # Initial retry delay in milliseconds
```

**Multi-Page Scraping:**

By default, the scraper visits each provider's individual page to extract complete information. This provides:

- **Complete insurance details**: Individual provider pages often list accepted insurance plans that aren't on the homepage
- **Detailed specialties**: More comprehensive information about therapeutic approaches and areas of expertise
- **Better accuracy**: AI processes each provider separately with full context from their dedicated page
- **Resilient processing**: If one provider page fails, others continue processing successfully
- **Per-provider caching**: Each provider's content is cached separately for easier debugging

**Performance expectations:**
- Single-page mode: ~30-60 seconds for 10 providers (homepage only)
- Multi-page mode: ~40-90 seconds for 10 providers (visits each provider page)

The additional time is worthwhile for significantly better data quality, especially for insurance information. To use the faster single-page mode (not recommended), set `MULTI_PAGE_SCRAPING=false` in your `.env` file.

**Troubleshooting:**

- **"Failed to launch browser" error**:
  - Ensure Chrome/Chromium is installed (see system dependencies above)
  - On Linux servers, you may need additional dependencies:
    ```bash
    sudo apt-get install -y ca-certificates fonts-liberation libappindicator3-1 \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 \
      libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 \
      libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
      libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
      libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
      libxss1 libxtst6 lsb-release wget xdg-utils
    ```
  - Fallback: Set `SCRAPING_MODE=axios` in `.env` to use simple HTTP client (may miss dynamic content)

- **"Page load timeout" errors**:
  - Increase `PAGE_LOAD_TIMEOUT` in `.env` (e.g., `PAGE_LOAD_TIMEOUT=30000` for 30 seconds)
  - Check your internet connection
  - Verify the website URL is correct

- **Missing insurance or dynamic content**:
  - Ensure `SCRAPING_MODE=puppeteer` (not axios)
  - Increase `PAGE_LOAD_TIMEOUT` to allow more time for JavaScript to execute
  - Check that the website actually contains the expected content

- **Scraping is slow**:
  - Ensure `BROWSER_DISABLE_IMAGES=true` to skip image downloads
  - Reduce `PAGE_LOAD_TIMEOUT` if pages load quickly
  - The scraper reuses a single browser instance for all pages, which helps performance

- **Docker/Container environments**:
  - Add `--no-sandbox` flag by setting environment variable (handled automatically in production mode)
  - Ensure sufficient memory allocation (at least 512MB recommended)
  - Install Chrome/Chromium in your Dockerfile

### Step 3: Test AI Integration (Optional)

Before setting up the phone system, test that your OpenRouter API key works:

```bash
npm run test-ai
```

You should see a conversation between the test script and the AI.

### Step 4: Start the Server

```bash
npm start
```

You should see:
```
🚀 Server running on port 3000
📞 Webhook URL: http://localhost:3000/incoming-call
🎙️ Realtime voice streaming is available
✅ Configuration loaded
```

Or if you didn't set `OPENAI_API_KEY`:
```
🚀 Server running on port 3000
📞 Webhook URL: http://localhost:3000/incoming-call
⚠️ OPENAI_API_KEY not set — real-time voice streaming unavailable, using Gather fallback
✅ Configuration loaded
```

### Step 5: Expose Your Server

For local testing, use a tunnel service to expose your server:

**Option A: Cloudflare Tunnel (Quick Test)**
```bash
cloudflared tunnel --url http://localhost:3000
```

**Option B: ngrok**
```bash
ngrok http 3000
```

For production deployment with SSL, see [DIGITALOCEAN-DEPLOYMENT.md](docs/DIGITALOCEAN-DEPLOYMENT.md).

### Step 6: Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/) → Phone Numbers
2. Click on your phone number
3. Scroll to "Voice & Fax" section
4. Under "A CALL COMES IN":
   - Select: **Webhook**
   - URL: `https://your-tunnel-url.trycloudflare.com/incoming-call`
   - HTTP Method: **POST**
5. Click **Save**

### Step 7: Test the System! 🎉

Call your Twilio phone number!

You should hear:
> "Hello! Thank you for calling [Your Business]. I'm your AI receptionist. How can I help you today?"

Try saying:
- "I need help finding a therapist"
- "What types of therapy do you offer?"
- "Do you accept insurance?"

The AI will respond naturally to your questions!

## Troubleshooting

### "Missing required environment variables"
- Make sure your `.env` file exists and has all required values
- Check that there are no extra spaces in your `.env` file

### "OpenRouter API error"
- Verify your API key is correct
- Check that you have credits in your OpenRouter account
- Try the test script: `npm run test-ai`

### "Call connects but no audio"
- Make sure Cloudflare Tunnel is running
- Verify the webhook URL in Twilio matches your tunnel URL
- Check the server logs for errors

### "Can't access admin panel"
- If you see a login page, enter the password from your `ADMIN_PASSWORD` environment variable
- If you forgot the password, update it in `.env` and restart the server
- Check that cookies are enabled in your browser
- Clear browser cookies and try again if you're having session issues

### "Admin login shows 'Too many attempts'"
- Wait 15 minutes for the rate limit to reset
- Check that you're using the correct password from `.env`
- Restart the server to clear the rate limiter (development only)

### "AI doesn't respond"
- Check server logs for errors
- Verify OpenRouter API key is valid
- Make sure you're speaking clearly and waiting for the prompt

## Project Structure
```
.
├── src/
│   ├── server.js              # Main Express server with Twilio webhooks
│   ├── config.js              # Configuration loader
│   ├── admin-auth.js          # Admin authentication (login, sessions, CSRF)
│   ├── ai-client.js           # OpenRouter AI integration
│   ├── call-handler.js        # Call session management (Gather mode)
│   ├── call-summary.js        # Call summary generation
│   ├── realtime/              # Real-time voice streaming components
│   │   ├── provider-adapter.js    # Base class for AI providers
│   │   ├── provider-factory.js    # Provider adapter factory
│   │   ├── openai-adapter.js      # OpenAI Realtime API adapter
│   │   ├── relay-service.js       # Audio relay between Twilio and provider
│   │   └── session-manager.js     # Active session tracking
│   └── test-ai.js             # AI testing script
├── prompts/                   # Editable AI prompts
├── public/                    # Web chat interface and admin UI
│   └── admin/                 # Admin dashboard (password-protected)
│       ├── login.html         # Login page
│       ├── index.html         # Dashboard home
│       ├── calls.html         # Call logs
│       ├── prompts.html       # Prompt editor
│       ├── availability.html  # Availability editor
│       ├── providers.html     # Provider profiles
│       ├── admin.js           # Admin UI JavaScript
│       └── admin.css          # Admin UI styles
├── .env                       # Environment variables (not in git)
├── .env.example               # Example environment variables
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## How It Works

### Real-Time Voice Streaming Mode (with OPENAI_API_KEY)

1. **Caller dials** your Twilio number
2. **Twilio sends webhook** to `/incoming-call`
3. **Server returns TwiML** with `<Connect><Stream>` to open bidirectional audio WebSocket
4. **Twilio streams audio** to server via WebSocket at `/media-stream`
5. **Server relays audio** to OpenAI Realtime API
6. **OpenAI processes audio** in real-time, generates responses with voice
7. **Server streams audio back** to caller via Twilio
8. **Natural conversation** with low latency and interruption support
9. **Call summary generated** when call ends

### Turn-by-Turn Mode (without OPENAI_API_KEY - fallback)

1. **Caller dials** your Twilio number
2. **Twilio sends webhook** to `/incoming-call`
3. **Server returns TwiML** with greeting and speech recognition (`<Gather>`)
4. **Caller speaks**, Twilio converts speech to text
5. **Text sent to** `/handle-speech` endpoint
6. **AI processes** the text via OpenRouter and generates response
7. **Server returns TwiML** with AI response as speech (`<Say>`)
8. **Loop continues** until caller hangs up
9. **Call summary generated** when call ends

## Admin Panel Security

The admin dashboard at `/admin` is protected by password authentication. This prevents unauthorized access to sensitive information like call logs, prompts, and provider data.

### Setting Up Admin Authentication

1. **Set admin password** in your `.env` file:
   ```env
   ADMIN_PASSWORD=your-secure-password-here
   ```

2. **Optional: Set a separate session secret** for additional security:
   ```env
   SESSION_SECRET=your-random-secret-key-here
   ```
   If not set, `ADMIN_PASSWORD` will be used as the session secret.

3. **Restart the server** to apply changes:
   ```bash
   npm start
   ```

4. **Access the admin panel** at `http://localhost:3000/admin`
   - You'll be redirected to the login page
   - Enter your admin password
   - You'll stay logged in for 24 hours

### Security Features

- **Password Protection**: All admin routes require authentication
- **Session Cookies**: Stateless HMAC-signed tokens (no server-side storage)
- **CSRF Protection**: Double-submit token pattern prevents cross-site attacks
- **Rate Limiting**: 5 failed login attempts per IP within 15 minutes
- **Constant-Time Comparison**: Prevents timing attacks on password verification
- **IP Whitelisting**: Optional additional layer (set `ADMIN_ALLOWED_IPS` in `.env`)

### Development Mode

During development, you can leave `ADMIN_PASSWORD` unset to disable authentication:
- The server will log a warning: `⚠️ ADMIN_PASSWORD not set or empty — admin panel is unprotected`
- Admin panel will be accessible without login
- **Never deploy to production without setting ADMIN_PASSWORD**

### Logout

Click the "Logout" button in the admin navigation (top right) to end your session.

## Features

- **Dual Voice Modes**: Real-time streaming (low latency) or turn-by-turn (fallback)
- **Natural Conversations**: Context-aware responses with interruption support (streaming mode)
- **Web Chat Interface**: Browser-based chat for testing and customer support
- **Secure Admin Dashboard**: Password-protected panel to view call logs, edit prompts, manage availability
- **Call Summaries**: AI-generated summaries of all conversations
- **Website Integration**: Automatically scrapes practice information
- **Customizable Prompts**: Edit AI personality and responses without code changes
- **Graceful Fallback**: Works without OpenAI API key using Gather-based speech
- **Production-Ready Security**: CSRF protection, rate limiting, session management

## Next Steps

Now that you have a working system, you can:
- [ ] **Set a strong admin password** for production deployment
- [ ] Test both voice modes (with and without OPENAI_API_KEY)
- [ ] Customize prompts in the `prompts/` directory
- [ ] Access the admin dashboard at `http://localhost:3000/admin`
- [ ] Review call summaries and transcripts
- [ ] Add custom availability schedules
- [ ] Integrate with your practice management system
- [ ] Deploy to production with systemd (see `docs/systemd-setup.md`)

See the `.kiro/specs/` directory for detailed feature specifications!

## Support

If you run into issues:
1. Check the server logs for error messages
2. Verify all environment variables are set correctly
3. Test the AI client separately with `npm run test-ai`
4. Make sure Cloudflare Tunnel is running and accessible
