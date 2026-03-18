# ChargeWizards Deployment Log

*This file tracks what we've built, tested, and deployed on top of the base Receptionist platform. Updated with each significant change.*

---

## Deployment: ChargeWizards (San Mateo, CA)
- **URL:** https://receptionist.chargewizards.com
- **Server:** DigitalOcean droplet ($6/mo)
- **Branch:** `chargewizards`
- **Contact:** PJ (pj@chargewizards.com)

---

## 2026-03-10 — Initial Deployment

### Architecture
- **Webchat model:** Claude Sonnet via Anthropic direct API
- **Fallback:** OpenRouter (same model, auto-switches on any error)
- **Voice:** OpenAI Realtime API (key installed, not yet active)
- **Hosting:** DigitalOcean droplet, SSL via Let's Encrypt
- **Call routing:** Twilio (websocket)

### Customizations (in `data/`, not tracked)
- System prompt: 11-field lead qualification checklist
- Knowledge base: EV charger pricing, service areas, rebates, DPM differentiator
- Guardrails: Blocked financing hallucinations, competitor recommendations
- `custom-info.json`: ChargeWizards business details

### Chat UI
- Apple-style design (Inter font, iMessage bubbles, subtle shadows)
- Self-hosted logo with transparent background
- Paperclip attachment icon for photo uploads
- Mobile-responsive, full-screen on phones
- No suggestion chips (cleaner UX)

### Regression Testing

**v1 — Single-turn (1,000 calls):** 12% qualification. Misleading — bot is multi-turn by design, single-turn scoring was wrong methodology.

**v2 — Multi-turn (24 persona scenarios):**

| Model | Avg Score | Name | Phone | Email | City | Housing | EV Type |
|-------|-----------|------|-------|-------|------|---------|---------|
| Claude Sonnet | **90%** | 96% | 100% | 75% | 96% | 71% | 67% |
| GPT-4o Mini | **82%** | 63% | 79% | 54% | 75% | 100% | 100% |

**Decision:** Claude Sonnet. Contact info collection is non-negotiable — a lead without a phone number is worthless.

### Issues Created
- [#16](https://github.com/guyarie/Receptionist/issues/16) — Prompt externalization via `data/` folder override
- [#17](https://github.com/guyarie/Receptionist/issues/17) — Regression test framework for pre-deployment validation

### Pending
- Embed chat widget on chargewizards.com (Wix Custom Code)
- Lead notification system (Telegram/email on qualified leads)
- Voice channel activation (OpenAI Realtime)
- Replace placeholder reviews on website with real Yelp/Google reviews
- PR generic improvements to main (Issues #16, #17)

---


---

## 2026-03-16 — Codebase Un-Fork + Major Feature Updates

### Codebase Genericized (Issue #24)
All business-specific references removed from `src/` and `public/`. The codebase is now fully generic — any business can deploy by setting `.env` variables:

| Variable | Purpose |
|---|---|
| `BUSINESS_NAME` | Company name (greetings, admin UI) |
| `OWNER_NAME` | Owner name (transfers, logs) |
| `RECEPTIONIST_NAME` | AI receptionist name |
| `OWNER_PHONE` | Transfer target phone number |
| `PUBLIC_URL` | Production domain (lead alert links) |

New template files added:
- `.env.example` — all env vars documented
- `prompts/system-prompt.example.txt` — generic prompt template
- `prompts/greeting.example.txt` — generic greeting
- `prompts/webchat-greeting.example.txt` — generic webchat greeting

### Voice Calls — Lead Detection Fixed
- Voice calls now trigger lead detection and Telegram alerts
- Root cause: voice calls use OpenAI Realtime API via `relay-service.js`, which bypassed `call-handler.js` lead tracking
- Fix: lead tracking + DB save added to `relay-service.js cleanup()`

### SQLite Database
- Customer records: name, email, city, address, vehicle, notes
- Interactions table supports types: `call`, `chat`, `sms`, `email`
- Returning caller lookup checks DB first, falls back to JSON file scanning
- API: `GET /api/customers`, `GET /api/customers/:phone`

### Email Sync Endpoint
- `POST /api/email-sync` — receives email interaction data from external sources
- Enables returning caller recognition for customers who also emailed
- Protected by `LEADS_API_KEY`

### Prompt Improvements
- **Vendor/supplier handling** — 3 caller paths: customer (qualify), vendor/partner (take message), off-topic (2-strike exit)
- **Language switching** — detects non-English callers and responds in their language
- **Pacing rule** — pauses after initial qualifying to ask "do you have any questions?"
- **Contact-before-photos** — ensures name + phone collected before requesting photo uploads

### Returning Caller Recognition (Issue #21)
- Looks up caller phone in SQLite DB
- Injects customer context into system prompt (name, email, city, vehicle, previous interactions)
- Personalizes greeting: "Hi [Name], good to hear from you again"
- Skips re-asking for known info

### Telegram Lead Alerts
- Configurable via `TELEGRAM_THREAD_ID` for forum topic routing
- Links use `PUBLIC_URL` env var (no longer hardcoded)
- Alerts include admin link + full transcript link

### Bug Fixes
- Telegram link interpolation — template literal broken during genericization, fixed
- Widget auto-focus guard on touch devices (Issue #20)
- Transfer detection regex genericized
- Call hangup detection working via Twilio API

### Warm Transfer (Issue #23 — deployed, testing in progress)
- Conference-based transfer with recording
- Endpoints: `/transfer-to-owner`, `/transfer-fallback`, `/transfer-status`, `/recording-complete`
- Transfer triggers defined in system prompt (7 categories)
- Recordings saved to `/call-recordings/`

### SMS Handler
- `/incoming-sms` endpoint
- Conversation history per phone number
- Integrated with lead detection

### Issues Filed
- [#20](https://github.com/guyarie/Receptionist/issues/20) — Mobile widget fixes
- [#21](https://github.com/guyarie/Receptionist/issues/21) — Returning caller recognition
- [#23](https://github.com/guyarie/Receptionist/issues/23) — Post-interaction review pipeline
- [#24](https://github.com/guyarie/Receptionist/issues/24) — Codebase un-forked, fully generic

---

*Last updated: 2026-03-16*
