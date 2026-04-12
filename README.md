# AI Phone Receptionist

An AI-powered voice receptionist for any business. Answers calls, handles inquiries, takes messages, and notifies your staff — configured entirely through a conversational setup experience.

Works for therapist offices, EV charging companies, medical practices, law firms, service businesses, and more. One codebase, any business.

## Quick Start

### Prerequisites
- Node.js v18 or higher
- Chrome or Chromium (for website crawling during setup)
- A Twilio account with a phone number ([twilio.com](https://twilio.com))
- An OpenRouter API key ([openrouter.ai/keys](https://openrouter.ai/keys))
- OpenAI API key for real-time voice ([platform.openai.com/api-keys](https://platform.openai.com/api-keys))

### Install

```bash
npm install
cp .env.example .env
npm start
```

Then open **http://localhost:3000/setup** in your browser.

The setup assistant will guide you through everything — crawling your website, designing your receptionist's personality, configuring all credentials, and preparing the AI context files. No manual file editing required.

### What setup does

1. **Crawls your website** — learns your business name, services, staff, and hours
2. **Asks clarifying questions** — builds understanding the website alone can't provide
3. **Writes your prompts** — designs the receptionist's personality, greeting, and behavior
4. **Creates context files** — provider profiles, availability schedules, FAQs
5. **Collects credentials** — guides you to each API key and stores them securely
6. **Validates everything** — tells you exactly what's ready and what's still missing

After setup, the admin panel at `/admin` handles day-to-day management: viewing call logs, editing prompts, updating provider profiles, and monitoring the system.

---

## How Calls Work

```
Caller dials → Twilio webhook → WebSocket stream → OpenAI Realtime API
     ↑                                                        ↓
  Audio plays ←────────────────────────────── Audio response
```

- Bidirectional audio via OpenAI Realtime API
- Low latency, supports natural interruptions
- `OPENAI_API_KEY` is required — calls are rejected with a message if it's not set

All calls produce transcripts and run the post-call agent.

---

## Admin Panel

Access at `http://localhost:3000/admin` (password protected once `ADMIN_PASSWORD` is set).

| Section | What it does |
|---|---|
| Dashboard | System status, active calls, recent errors |
| Call Logs | Transcripts and AI summaries for every call |
| Prompts | Edit any prompt without restarting the server |
| Providers | View and edit provider/staff profiles |
| Availability | Edit schedules |
| Refresh Website | Re-scrape your site and update provider profiles |

### Security

- **Password authentication** — set `ADMIN_PASSWORD` in `.env`
- **HMAC-signed session tokens** — stateless, no server-side session storage
- **CSRF protection** — double-submit token pattern
- **Rate limiting** — 5 failed login attempts per IP per 15 minutes
- **IP whitelist** — optional `ADMIN_ALLOWED_IPS` for extra restriction

---

## Data & File Structure

```
.
├── src/
│   ├── server.js                  # Express server, Twilio webhooks, admin API
│   ├── config.js                  # Environment variable loading and validation
│   ├── prompts.js                 # Prompt loader (data/ overrides prompts/)
│   ├── ai-client.js               # OpenRouter AI integration
│   ├── call-summary.js            # Post-call summary generation
│   ├── provider-loader.js         # Loads data/providers/*.md
│   ├── availability-loader.js     # Loads data/availability/*.md
│   ├── email-transport.js         # SMTP email sending
│   ├── admin-auth.js              # Admin authentication and sessions
│   ├── browser-manager.js         # Puppeteer browser lifecycle
│   ├── scrape-providers.js        # Website scraper (used by setup agent)
│   ├── agents/
│   │   ├── setup-agent.js         # Setup assistant — guides initial configuration
│   │   ├── setup-tools.js         # Tools for the setup agent
│   │   ├── post-call-agent.js     # Processes each call after it ends
│   │   ├── daily-digest-agent.js  # Sends daily email summaries
│   │   └── tools.js               # Shared tools (save summary, send email, etc.)
│   └── realtime/
│       ├── openai-adapter.js      # OpenAI Realtime API WebSocket adapter
│       ├── relay-service.js       # Bridges Twilio audio ↔ AI provider
│       ├── session-manager.js     # Active call session tracking
│       ├── provider-adapter.js    # Base class for AI provider adapters
│       └── provider-factory.js    # Adapter factory
├── prompts/                       # Default prompts (checked into git)
│   ├── system-prompt.txt          # AI personality and behavior
│   ├── greeting.txt               # Call opening
│   ├── setup-agent.txt            # Setup assistant instructions
│   └── ...                        # Post-call, digest, and utility prompts
├── data/                          # Deployment-specific files (gitignored)
│   ├── prompts/                   # Overrides for any file in prompts/
│   ├── providers/                 # Provider/staff profiles (*.md)
│   ├── availability/              # Availability schedules (*.md)
│   └── practice/                  # Business overview and FAQs
├── runtime/                       # Generated at runtime (gitignored)
│   ├── call-summaries/            # JSON transcript + summary per call
│   ├── agent-logs/                # Post-call agent debug logs
│   ├── chat-logs/                 # Web chat logs
│   ├── scrape-cache/              # Raw HTML cache from website scraping
│   └── backups/                   # data/ snapshots before each website refresh
├── public/
│   ├── setup/                     # Setup assistant web UI
│   └── admin/                     # Admin dashboard
├── docs/                          # Additional documentation
├── .env                           # Your configuration (not in git)
└── .env.example                   # Configuration template
```

### The `data/` override system

Any file in `data/prompts/` takes priority over the matching file in `prompts/`. This means:

- Repo updates never overwrite your configuration
- Your `data/` folder is everything you need to back up or migrate
- Git history stays clean — only code changes are tracked

### The `runtime/` folder

Created automatically. Safe to wipe (call logs will be lost, nothing else breaks).

---

## Configuration Reference

All configuration lives in `.env`. The setup assistant handles this for you, but here's the full reference:

```env
# Mode
SETUP_MODE=true              # Set to false when setup is complete

# Business
BUSINESS_NAME=Your Business
RECEPTIONIST_NAME=AI Receptionist
OWNER_NAME=Your Name
OWNER_PHONE=+12125551234
PUBLIC_URL=https://your-domain.com
TIMEZONE=America/Los_Angeles

# Twilio (phone calls)
TWILIO_PHONE_NUMBER=+12125551234

# AI
OPENROUTER_API_KEY=sk-or-xxx   # Required — powers text AI and summaries
OPENROUTER_MODEL=openai/gpt-4o
OPENAI_API_KEY=sk-xxx           # Optional — enables real-time voice streaming
OPENAI_REALTIME_VOICE=alloy     # alloy, echo, fable, onyx, nova, shimmer

# Server
PORT=3000
# SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
# SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# Admin
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-random-secret
ADMIN_ALLOWED_IPS=              # Leave empty to allow all IPs

# Email notifications (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM=receptionist@example.com
ADMIN_EMAIL=admin@example.com

# Daily digest
DIGEST_ENABLED=false
DIGEST_SCHEDULE_HOUR=18

# Post-call agent
POST_CALL_AGENT_MODE=active    # active | shadow | disabled

# Web chat CORS
ALLOWED_ORIGIN=https://yoursite.com
```

---

## Production Deployment

See [docs/DIGITALOCEAN-DEPLOYMENT.md](docs/DIGITALOCEAN-DEPLOYMENT.md) for a full guide.

Quick checklist:
- [ ] Point a domain at your server with SSL (Twilio requires HTTPS)
- [ ] Set `PUBLIC_URL=https://your-domain.com` in `.env`
- [ ] Set a strong `ADMIN_PASSWORD`
- [ ] Configure Twilio webhook: `https://your-domain.com/incoming-call`
- [ ] Set up systemd to keep the server running (see [docs/systemd-setup.md](docs/systemd-setup.md))

For local testing with a public URL, use:
```bash
cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000
```

---

## Troubleshooting

**Server won't start — "Missing required environment variables"**
Open `http://localhost:3000/setup` to configure missing credentials. Or ensure `SETUP_MODE=true` is in your `.env`.

**Setup agent gives an error immediately**
Your OpenRouter API key may be wrong. The setup page will prompt you to re-enter it.

**Call connects but no audio**
- Verify your tunnel/server is publicly accessible at the URL in your Twilio webhook config
- Check `PUBLIC_URL` matches the URL Twilio is calling

**Real-time voice not working**
- Confirm `OPENAI_API_KEY` is set in `.env`
- Check server startup logs for `🎙️ Realtime voice streaming is available`
- Twilio requires WSS (WebSocket over HTTPS) — you need SSL in production

**Admin panel — can't log in**
- Verify `ADMIN_PASSWORD` in `.env`
- Clear browser cookies and try again
- After 5 failed attempts, wait 15 minutes for the rate limit to reset

**AI gives wrong information**
- Review and update prompts via the admin panel → Prompts
- Add or update provider profiles via admin → Providers
- Re-run setup to regenerate context from your website
