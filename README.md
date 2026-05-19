# AI Phone Receptionist

An AI-powered voice receptionist for any business. Answers calls, handles inquiries, takes messages, and notifies your staff — configured entirely through a conversational setup experience.

Works for therapist offices, EV charging companies, medical practices, law firms, service businesses, and more. One codebase, any business.

## Quick Start

### Prerequisites
- Node.js v18 or higher
- PM2 (process manager) — `npm install -g pm2`
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
node manage.js status                  # list all installs and their state
node manage.js start all               # start all installs via PM2
node manage.js stop demo1              # stop one install
node manage.js nginx                   # print nginx config for all installs (including meta-admin)
sudo node manage.js deploy-nginx       # deploy nginx configs and reload nginx

# Meta Admin — browser-based install manager
node manage.js meta-admin start        # start the meta-admin server (port 3099)
node manage.js meta-admin stop         # stop it
node manage.js meta-admin status       # check if it's running
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
6. **Configures nginx** — asks for the subdomain and writes `installs/<name>/nginx.conf`
7. **Validates everything** — tells you exactly what's ready and what's still missing

After setup, the admin panel at `/admin` handles day-to-day management: viewing call logs, editing prompts, updating provider profiles, and monitoring the system.

---

## Meta Admin

A browser-based install manager that lets you start, stop, create, and monitor installs without touching a terminal.

Access at `http://localhost:3099` (or your configured domain) after starting it:

```bash
node manage.js meta-admin start
```

### What the admin agent can do

| Ask the agent to… | What happens |
|---|---|
| "List all installs" | Shows status, port, business name for every install |
| "Start the demo1 install" | Starts it via PM2 |
| "Stop all running installs" | Stops everything |
| "Restart the grace install" | Stop + start |
| "Create a new install called clinic2" | Creates the directory structure, starts in setup mode |
| "Show the last 100 log lines for dave" | Reads PM2 log files |
| "Show nginx config for all installs" | Generates nginx server blocks |
| "Deploy nginx" | Runs `sudo node manage.js deploy-nginx` |

The install status grid at the top of the page refreshes automatically after each agent action. Clicking **Open Admin** or **Open Setup** on a card opens that install's management UI.

### Setup

**Password** — add to `installs/_defaults.env`:
```env
META_ADMIN_PASSWORD=your-secure-password
META_ADMIN_SESSION_SECRET=a-random-string
```

**Port** — defaults to `3099`. Override with `META_ADMIN_PORT` in `installs/_defaults.env`.

**Model** — defaults to `openai/gpt-4o-mini` via OpenRouter. Override with `META_ADMIN_MODEL`.

**Persist across reboots** — after starting with `node manage.js meta-admin start`, save the PM2 process list:
```bash
pm2 save
```

### nginx block

To access the meta-admin from a public domain, `node manage.js nginx` prints its block alongside the install configs. The block uses `proxy_buffering off` (required for SSE chat streaming):

```nginx
server {
    server_name admin.phone.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3099;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        # Required for SSE streaming (chat responses)
        proxy_buffering off;
        proxy_cache off;
    }
}
```

Set the actual domain with `META_ADMIN_DOMAIN=admin.phone.yourdomain.com` in `installs/_defaults.env` so `node manage.js nginx` outputs the right `server_name`. SSL is handled by the wildcard cert like any other subdomain.

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

Access at `http://localhost:<PORT>/admin` (password protected once `ADMIN_PASSWORD` is set).

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
│   │   ├── meta-admin-agent.js    # Install manager agent (start/stop/create/logs)
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
│   ├── meta-admin-agent.txt       # Meta Admin agent instructions
│   └── ...                        # Post-call, digest, and utility prompts
├── installs/                      # One subdirectory per install (gitignored)
│   ├── _defaults.env.example      # Template for shared API keys (tracked)
│   ├── _defaults.env              # Shared API keys inherited by all installs (gitignored)
│   └── <name>/                    # Per-install directory
│       ├── .env                   # Install config (PORT, TWILIO_*, BUSINESS_NAME, …)
│       ├── nginx.conf             # nginx server block — written by setup agent
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
│   ├── admin/                     # Per-install admin dashboard
│   └── meta-admin/                # Meta Admin web UI (install manager)
├── manage.js                      # Multi-install CLI (create/start/stop/status/nginx/meta-admin)
├── meta-admin.js                  # Meta Admin server (port 3099)
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

**Meta Admin** (set in `installs/_defaults.env`, shared across all installs):
```env
META_ADMIN_PASSWORD=your-secure-password
META_ADMIN_SESSION_SECRET=a-random-string
META_ADMIN_PORT=3099                        # defaults to 3099
META_ADMIN_DOMAIN=admin.phone.16jets.com    # used by `node manage.js nginx`
META_ADMIN_MODEL=openai/gpt-4o-mini         # OpenRouter model for the agent
```

---

## Production Deployment

### Checklist

- [ ] Install nginx and PM2 (see below)
- [ ] Set up a public domain with SSL pointing at this machine (see below)
- [ ] Run setup for each install — the setup agent writes `installs/<name>/nginx.conf` and sets `PUBLIC_URL`
- [ ] Deploy nginx: `sudo node manage.js deploy-nginx`
- [ ] Configure Twilio webhook for each number (see below)
- [ ] Persist PM2 across reboots: `pm2 save && pm2 startup`

---

### PM2 (process manager)

PM2 runs all installs as background processes and restarts them if they crash.

```bash
# Install globally (one time)
npm install -g pm2

# manage.js wraps PM2 — you rarely need to call pm2 directly
node manage.js start all       # start all installs
node manage.js stop all        # stop all installs
node manage.js status          # show port, setup state, and PM2 status

# Direct PM2 commands (useful for logs and restarts)
pm2 list                       # show all processes
pm2 logs receptionist-dave     # tail logs for one install
pm2 logs                       # tail all logs
pm2 restart receptionist-dave  # restart one install
pm2 restart all                # restart everything

# Survive reboots — run once after first deploy
pm2 save
pm2 startup                    # prints a command — run it as instructed
sudo systemctl start pm2-receptionist
```

PM2 process names follow the pattern `receptionist-<install-name>`.

> **Running as a dedicated service user?** If PM2 is managed by a `receptionist` user, run `pm2 save` and `pm2 startup` as that user (`sudo su - receptionist`), then paste the printed command as your admin user and run `sudo systemctl start pm2-receptionist`. See [Deployment Guide](docs/DEPLOYMENT.md) for the full walkthrough.

---

### Self-hosted: domain, DNS, and SSL

This is the setup for hosting multiple receptionists on a home or office machine (mini PC, etc.) behind a residential internet connection.

**What's running here:**
- Domain: `16jets.com` registered at Cloudflare
- Dynamic DNS: `holdens-box.duckdns.org` → public IP (updated every 5 min by cron)
- DNS: `*.phone.16jets.com` CNAME → `holdens-box.duckdns.org`
- Router: TCP ports 80 and 443 forwarded to `192.168.6.164` (mini PC)
- nginx on mini PC: terminates SSL, routes each subdomain to its install port
- SSL: wildcard cert for `*.phone.16jets.com` via certbot + Cloudflare DNS plugin

#### 1. DuckDNS (dynamic IP)

DuckDNS keeps a hostname updated to your current public IP. Check if the updater cron is running:

```bash
crontab -l | grep duck
```

If missing, add it (`crontab -e`):

```
*/5 * * * * curl -s "https://www.duckdns.org/update?domains=holdens-box&token=YOUR_TOKEN&ip=" > /dev/null
```

Verify the hostname resolves: `dig holdens-box.duckdns.org +short`

#### 2. Cloudflare DNS

In the Cloudflare dashboard for `16jets.com`, DNS records:

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `phone` | `holdens-box.duckdns.org` | DNS only (grey) |
| CNAME | `*.phone` | `holdens-box.duckdns.org` | DNS only (grey) |

**Important:** proxy must be grey (DNS only), not orange. Cloudflare's proxy breaks WebSocket connections that Twilio requires.

#### 3. Router port forwarding

Forward TCP ports 80 and 443 to `192.168.6.164` (mini PC LAN IP).  
On eero: Settings → Network settings → Reservations & port forwarding.  
Set a DHCP reservation for the mini PC's MAC address so its IP stays fixed.

#### 4. nginx

```bash
# Install
sudo apt install nginx -y
sudo systemctl enable --now nginx

# After running setup for each install, deploy all nginx configs
sudo node manage.js deploy-nginx
```

`deploy-nginx` copies each `installs/<name>/nginx.conf` to `/etc/nginx/sites-available/`, creates symlinks in `sites-enabled/`, tests the config, and reloads nginx. Run it again any time you add a new install.

#### 5. Wildcard SSL cert (certbot + Cloudflare)

```bash
# Install certbot and Cloudflare DNS plugin
sudo apt install certbot python3-certbot-dns-cloudflare -y

# Create a Cloudflare API token:
# Cloudflare dashboard → My Profile → API Tokens → Create Token
# Use "Edit zone DNS" template, scope to zone: 16jets.com

# Save the token
sudo mkdir -p /etc/letsencrypt
sudo nano /etc/letsencrypt/cloudflare.ini
# Contents:
#   dns_cloudflare_api_token = YOUR_TOKEN_HERE
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

# Get the wildcard cert (covers all *.phone.16jets.com subdomains)
sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d "phone.16jets.com" \
  -d "*.phone.16jets.com"

# Cert lives at:
#   /etc/letsencrypt/live/phone.16jets.com/fullchain.pem
#   /etc/letsencrypt/live/phone.16jets.com/privkey.pem
# Certbot sets up auto-renewal automatically.
```

The setup agent's `configure_nginx` tool auto-detects this cert when writing `installs/<name>/nginx.conf`.

---

### Twilio webhook

Each install needs its own Twilio phone number pointing to its public URL.

1. Go to Twilio console → **Phone Numbers** → **Active Numbers** → click your number
2. Under **Voice & Fax** → **"A call comes in"**:
   - Set to **Webhook**
   - URL: `https://<subdomain>.phone.16jets.com/incoming-call`
   - Method: **HTTP POST**
3. Save

The subdomain must match what was set during setup (stored as `PUBLIC_URL` in the install's `.env`).

To check what URL an install is using:

```bash
grep PUBLIC_URL installs/<name>/.env
```

---

### Cloudflare Tunnel (alternative to port forwarding)

If port forwarding isn't available, use a Cloudflare Tunnel instead. Requires a domain on Cloudflare.

```bash
# Install (Linux amd64)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Create a stable named tunnel
cloudflared tunnel login
cloudflared tunnel create receptionist
cloudflared tunnel route dns receptionist your-subdomain.yourdomain.com
cloudflared tunnel run --url http://localhost:3000 receptionist
```

For a quick throwaway URL (changes on restart, good for testing):
```bash
cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000
```

---

## Troubleshooting

**Server won't start — "Missing required environment variables"**
Open `http://localhost:<SETUP_PORT>/setup` to configure missing credentials. Or ensure `SETUP_MODE=true` is in your `.env`.

**Setup agent gives an error immediately**
Your OpenRouter API key may be wrong. The setup page will prompt you to re-enter it.

**Call connects but no audio**
- Verify your tunnel/server is publicly accessible at the URL in your Twilio webhook config
- Check `PUBLIC_URL` matches the URL Twilio is calling

**Real-time voice not working**
- Confirm `OPENAI_API_KEY` is set in `.env`
- Check server startup logs for `🎙️ Realtime voice streaming is available`
- Twilio requires WSS (WebSocket over HTTPS) — you need SSL in production

**nginx deploy fails**
- Run `sudo nginx -t` to see the specific config error
- Check that certbot ran successfully and the cert paths in `nginx.conf` exist
- Make sure port 80/443 are forwarded to this machine before testing externally

**Server crashes with `EACCES` on port 443**
Linux requires root (or special capabilities) to bind ports below 1024. Keep `PORT=3000` and let nginx handle 443:
- nginx terminates SSL on 443 and forwards to `localhost:<PORT>`
- Twilio only requires the *public* URL to be HTTPS — the internal port can be anything

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
