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

### Issues & PRs

| Issue | PR | Status | Description |
|-------|-----|--------|-------------|
| [#16](https://github.com/guyarie/Receptionist/issues/16) | [#18](https://github.com/guyarie/Receptionist/pull/18) | Awaiting review | Prompt externalization — `data/prompts/` overrides repo defaults |
| [#17](https://github.com/guyarie/Receptionist/issues/17) | [#19](https://github.com/guyarie/Receptionist/pull/19) | Awaiting review | Regression test framework for pre-deployment validation |

**PR #18 — Prompt Externalization:**
- `resolvePromptPath()` checks `data/prompts/` first, falls back to `prompts/`
- `savePrompt()` writes to `data/prompts/` (gitignored), never modifies repo files
- Tested: override → fallback → save → admin UI source field — all pass

**PR #19 — Regression Test Framework:**
- Standalone runner: `node tests/regression/runner.js --url <your-server>`
- 5 default scenarios (medical/office themed, generic for all users)
- Configurable fields, keywords, thresholds via `data/tests/config.json` override
- Markdown report with per-scenario and per-field breakdowns
- CI-friendly: exit code 1 if below threshold
- Live test against ChargeWizards production: **92% average, PASSED**

### Pending
- Embed chat widget on chargewizards.com (Wix Custom Code)
- Lead notification system (Telegram/email on qualified leads)
- Voice channel activation (OpenAI Realtime)
- Replace placeholder reviews on website with real Yelp/Google reviews

---

*Last updated: 2026-03-10*
