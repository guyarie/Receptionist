# Customization Guide

After the setup assistant has configured your receptionist, you can fine-tune everything through the admin panel — no code changes needed.

## The admin panel

Go to **http://localhost:[PORT]/admin** and log in with your admin password. The port is whatever `PORT` is set to in your `.env` (default `443` for production HTTPS; if you're running behind a reverse proxy on port 3000, use that instead).

### Editing prompts

Admin → **Prompts** shows all active prompts with their source (override vs. default) and an inline editor.

Key prompts to know:

| Prompt | What it controls |
|---|---|
| `system-prompt.txt` | The receptionist's core personality, knowledge, and behavior rules |
| `webchat-greeting.txt` | Opening message shown in the web chat widget |
| `post-call-agent.txt` | How the AI processes each call after it ends |
| `daily-digest-agent.txt` | What goes into the daily email summary |

**Tips for effective prompts:**
- Be specific — vague instructions produce vague behavior
- Describe what to do, not just what not to do
- Include examples of good responses for tricky scenarios
- Read prompts aloud — if it sounds robotic, it'll sound robotic on the phone

### Editing provider profiles

Admin → **Providers** shows all staff/provider profiles. Each profile is a markdown file the AI consults when a caller asks about a specific person.

Format:
```markdown
# Dr. Jane Smith, Licensed Psychologist

**Specialties:** Anxiety, depression, trauma, EMDR
**Email:** jane@example.com
**Phone:** +12125551234
**Insurance Accepted:** Blue Cross, Aetna, United, out-of-pocket
**Availability:** Monday–Thursday, 9 AM–5 PM
**Notes for receptionist:** Accepting new patients. Has a waitlist for trauma specialization.
```

### Editing availability

Admin → **Availability** holds schedule information. The AI uses this to answer questions about hours and booking.

### Refreshing from your website

Admin → Dashboard → **Refresh Website Data** re-scrapes your website and regenerates provider profiles. It takes a backup of your `data/` folder first.

---

## Manual file editing

For larger changes, you can edit files directly in `data/`:

```
data/
├── prompts/             ← overrides prompts/ defaults
│   ├── system-prompt.txt
│   ├── webchat-greeting.txt
│   └── ...
├── providers/           ← one .md file per staff member
├── availability/        ← schedule files
└── practice/            ← business overview, FAQs
```

Any file in `data/prompts/` takes priority over the matching file in `prompts/`. You only need to create files for things you want to customize.

After editing files manually, use Admin → Dashboard → **Reload All** (or `curl -X POST http://localhost:[PORT]/admin/api/reload`) to apply changes without restarting. Replace `[PORT]` with the value of `PORT` in your `.env`.

---

## Changing the AI voice

In `.env`:
```env
OPENAI_REALTIME_VOICE=nova
```

Available options: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

Restart the server to apply.

## Changing the AI model

In `.env`:
```env
OPENROUTER_MODEL=openai/gpt-4o
```

OpenRouter supports many models. See [openrouter.ai/models](https://openrouter.ai/models) for options. The model affects response quality and cost for text-based processing (summaries, post-call agent). Real-time voice always uses OpenAI's Realtime API regardless of this setting.

## Voice

The system uses OpenAI Realtime API exclusively. `OPENAI_API_KEY` is required — without it the server starts but rejects incoming calls with a message to try again later.

---

## Post-call agent

The post-call agent runs after every call ends. It:
- Saves a structured summary to `runtime/call-summaries/`
- Decides whether to email a staff member based on the call content
- Logs a debug trace to `runtime/agent-logs/`

Control it via `.env`:
```env
POST_CALL_AGENT_MODE=active    # active | shadow | disabled
```

- `active` — agent runs and drives all post-call processing
- `shadow` — agent runs alongside the fallback flow (for testing)
- `disabled` — simple AI summary only, no agent

Customize agent behavior by editing `data/prompts/post-call-agent.txt` in the admin panel.

## Daily digest

When enabled, the system emails a summary of the previous day's calls each weekday afternoon.

```env
DIGEST_ENABLED=true
DIGEST_SCHEDULE_HOUR=18       # Hour (0–23) in your configured timezone
ADMIN_EMAIL=you@example.com
```

Requires SMTP to be configured. Customize the digest format in `data/prompts/daily-digest-agent.txt`.

---

## Testing changes

After editing prompts:
1. Admin panel → Prompts → Edit and save (reloads automatically)
2. Make a test call
3. Review the result in Admin → Call Logs

For significant prompt changes, use the test chat at **http://localhost:[PORT]/test-widget.html** as a quick feedback loop before making a real call. Replace `[PORT]` with `SETUP_PORT` (default `3001`) if running in setup mode, or `PORT` if the server is running in production mode — both values are in your `.env`.
