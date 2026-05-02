# AI Phone Receptionist

An AI-powered voice receptionist for any business. Answers calls, handles inquiries, takes messages, and notifies your staff — configured entirely through a conversational setup experience.

Works for therapist offices, EV charging companies, medical practices, law firms, service businesses, and more. One codebase, any business.

## Quick Start

### Prerequisites
- Node.js v18 or higher
- Chrome or Chromium (for website crawling during setup) — on Ubuntu/Debian, install the required system libraries first (see [Troubleshooting](#troubleshooting))
- A Twilio account with a phone number ([twilio.com](https://twilio.com))
- An OpenRouter API key ([openrouter.ai/keys](https://openrouter.ai/keys))
- OpenAI API key for real-time voice ([platform.openai.com/api-keys](https://platform.openai.com/api-keys))

```bash
npm install

# Add shared API keys (inherited by all installs)
cp installs/_defaults.env.example installs/_defaults.env
# edit installs/_defaults.env with your OPENROUTER_API_KEY, OPENAI_API_KEY, etc.

# Create your first install — auto-assigns a port and starts setup
node manage.js create demo1
# → Setup running at http://localhost:3101/setup

# Common management commands
node manage.js status          # list all installs and their state
node manage.js start all       # start all installs via PM2
node manage.js stop demo1      # stop one install
node manage.js nginx           # print nginx config for all installs
```

Each install lives in `installs/<name>/` with its own `.env`, `data/`, and `runtime/`. All installs share the same `src/` codebase.

### Running an install manually (without PM2)

`INSTALL_DIR` must be set for the server to know which install to use. For quick local runs:

```bash
# Check which installs exist
ls installs/

# Option 1 — inline
INSTALL_DIR=installs/<name> npm start

# Option 2 — create a .install file (gitignored), then just use npm run dev
echo "installs/<name>" > .install
npm run dev
```

On production with systemd or PM2, `INSTALL_DIR` is set in the service config — see [Production Deployment](#production-deployment).

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
├── src/                           # Shared codebase — all installs run from here
│   ├── server.js                  # Express server, Twilio webhooks, admin API
│   ├── config.js                  # Environment variable loading and validation
│   ├── paths.js                   # Resolves data/ and runtime/ from INSTALL_DIR
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
├── prompts/                       # Default prompts (checked into git, shared)
│   ├── system-prompt.txt          # AI personality and behavior
│   ├── greeting.txt               # Call opening
│   ├── setup-agent.txt            # Setup assistant instructions
│   └── ...                        # Post-call, digest, and utility prompts
├── installs/                      # One subdirectory per install (gitignored)
│   ├── _defaults.env.example      # Template for shared API keys (tracked)
│   ├── _defaults.env              # Shared API keys inherited by all installs (gitignored)
│   └── <name>/                    # Per-install directory
│       ├── .env                   # Install config (PORT, TWILIO_*, BUSINESS_NAME, …)
│       ├── data/
│       │   ├── prompts/           # Overrides for any file in prompts/
│       │   ├── providers/         # Provider/staff profiles (*.md)
│       │   ├── availability/      # Availability schedules (*.md)
│       │   └── practice/          # Business overview and FAQs
│       └── runtime/
│           ├── call-summaries/    # JSON transcript + summary per call
│           ├── agent-logs/        # Post-call agent debug logs
│           ├── chat-logs/         # Web chat logs
│           ├── scrape-cache/      # Raw HTML cache from website scraping
│           └── backups/           # data/ snapshots before each website refresh
├── public/
│   ├── setup/                     # Setup assistant web UI
│   └── admin/                     # Admin dashboard
├── manage.js                      # Multi-install CLI (create/start/stop/status/nginx)
└── docs/                          # Additional documentation
```

### Config inheritance

Configuration is loaded in three layers, with each layer overriding the previous:

1. `config/defaults.env` — repo defaults, checked in, no secrets
2. `installs/_defaults.env` — your shared API keys, gitignored, inherited by all installs
3. `installs/<name>/.env` — per-install overrides (PORT, TWILIO credentials, BUSINESS_NAME, etc.)

### The prompt override system

Any file in `installs/<name>/data/prompts/` takes priority over the matching file in `prompts/`. This means:

- Repo updates never overwrite your configuration
- `installs/<name>/data/` is everything you need to back up or migrate to another host
- Git history stays clean — only code changes are tracked

### The `runtime/` folder

Located at `installs/<name>/runtime/`. Created automatically. Safe to wipe (call logs will be lost, nothing else breaks).

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
- [ ] Point a domain (or subdomain) at your server with SSL — Twilio requires HTTPS
- [ ] Set `PUBLIC_URL=https://your-domain.com` in the install's `.env`
- [ ] Set a strong `ADMIN_PASSWORD` and `SESSION_SECRET`
- [ ] Configure Twilio webhook: `https://your-domain.com/incoming-call`
- [ ] Start all installs with PM2: `node manage.js start all`
- [ ] Configure nginx to route each subdomain to the right port: `node manage.js nginx`
- [ ] Persist PM2 across reboots: `pm2 save && pm2 startup`

For a public HTTPS URL without port forwarding, use Cloudflare Tunnel:
```bash
# Install (Linux amd64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Quick throwaway URL (changes on restart)
cloudflared tunnel --url http://localhost:3000

# Stable named tunnel (requires a domain on Cloudflare — recommended for production)
cloudflared tunnel login
cloudflared tunnel create receptionist
cloudflared tunnel route dns receptionist your-subdomain.yourdomain.com
cloudflared tunnel run --url http://localhost:3000 receptionist
```

Alternatively, for a quick throwaway URL:
```bash
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

**Server crashes with `EACCES` on port 443**
Linux requires root (or special capabilities) to bind ports below 1024. Keep `PORT=3000` and let a reverse proxy or the systemd service handle 443:
- **Reverse proxy (recommended):** Use nginx or Caddy to terminate SSL on 443 and forward to `localhost:3000`
- **Systemd with capabilities:** The included systemd service sets `AmbientCapabilities=CAP_NET_BIND_SERVICE`, which lets Node bind 443 directly without root — but only when run via `systemctl`, not `npm start`
- Twilio only requires the *public* URL to be HTTPS — the internal port the server listens on can be anything

**Admin panel — can't log in**
- Verify `ADMIN_PASSWORD` in `.env`
- Clear browser cookies and try again
- After 5 failed attempts, wait 15 minutes for the rate limit to reset

**Puppeteer fails to launch browser (Linux)**
Install the required Chrome system dependencies:
```bash
sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2t64
```
Note: Ubuntu 24.04+ uses `libasound2t64` instead of `libasound2`.

**AI gives wrong information**
- Review and update prompts via the admin panel → Prompts
- Add or update provider profiles via admin → Providers
- Re-run setup to regenerate context from your website
