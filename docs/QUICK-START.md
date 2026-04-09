# Quick Start Guide

## Step 1: Install

```bash
npm install
cp .env.example .env
npm start
```

The server will start in setup mode. You'll see:
```
⚠️  Missing required environment variables (setup mode): TWILIO_ACCOUNT_SID, ...
   Visit /setup to configure your receptionist.
🚀 Server running on port 3000
```

That's expected — the setup assistant will collect everything.

## Step 2: Open the setup assistant

Go to **http://localhost:3000/setup** in your browser.

The setup assistant is a conversational AI that walks you through the full configuration:

1. **First**, it asks for your OpenRouter API key (needed to power the assistant itself)
2. **Discovery** — you give it your website URL, it reads and summarizes your business
3. **Deep understanding** — it asks 3–5 targeted questions the website didn't answer
4. **Prompt design** — it writes your receptionist's personality and opening greeting, you review and refine
5. **Context files** — it creates provider profiles, availability schedules, and FAQs
6. **Credentials** — it guides you to each API key and stores them securely
7. **Validation** — it checks everything and tells you exactly what's ready

The whole process takes 10–20 minutes.

## Step 3: Restart and test

After setup, restart the server:

```bash
# Ctrl+C to stop, then:
npm start
```

Look for the confirmation lines in startup output:
```
🚀 Server running on port 3000
🎙️ Realtime voice streaming is available   ← if OPENAI_API_KEY is set
```

Or if you skipped the OpenAI key (that's fine):
```
⚠️ OPENAI_API_KEY not set — using Gather fallback
```

## Step 4: Expose your server for testing

Twilio needs a public HTTPS URL to reach your server. For local testing:

```bash
# Cloudflare Tunnel (free, no account needed)
cloudflared tunnel --url http://localhost:3000

# Or ngrok
ngrok http 3000
```

## Step 5: Connect your Twilio phone number

1. Go to [Twilio Console](https://console.twilio.com/) → Phone Numbers → your number
2. Under "Voice & Fax → A Call Comes In":
   - Set to **Webhook**
   - URL: `https://your-tunnel-url.trycloudflare.com/incoming-call`
   - Method: **POST**
3. Save

## Step 6: Call your number!

The AI will answer and introduce itself. Try asking about your business — it knows what it learned from your website and the setup conversation.

---

## After setup: the admin panel

The admin panel at **http://localhost:3000/admin** is where you manage the receptionist day-to-day:

| What | Where |
|---|---|
| View call transcripts and summaries | Call Logs |
| Edit the receptionist's personality | Prompts |
| Update staff profiles | Providers |
| Edit hours and schedules | Availability |
| Re-scrape your website for updates | Dashboard → Refresh Website |

The admin panel is password-protected once you've set `ADMIN_PASSWORD` during setup.

---

## Re-running setup

You can re-run setup at any time by visiting `/setup` again. The assistant will see what's already configured and offer to update specific parts.

---

## Voice modes

**Real-time streaming** (with `OPENAI_API_KEY`):
- Bidirectional audio via OpenAI Realtime API
- Low latency, supports natural interruptions
- Feels like a real phone conversation

**Turn-by-turn** (without `OPENAI_API_KEY`):
- Twilio speech recognition + OpenRouter AI
- Slightly higher latency per turn
- Still fully functional — a good starting point

Both modes produce transcripts and summaries. You can switch by adding or removing `OPENAI_API_KEY` from `.env` and restarting.

---

## Useful links

| | |
|---|---|
| Setup assistant | http://localhost:3000/setup |
| Admin panel | http://localhost:3000/admin |
| Web chat | http://localhost:3000/chat.html |
| Twilio Console | https://console.twilio.com/ |
| OpenRouter keys | https://openrouter.ai/keys |
| OpenAI keys | https://platform.openai.com/api-keys |

---

See [README.md](../README.md) for full configuration reference and production deployment instructions.
