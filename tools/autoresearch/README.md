# Autoresearch — Automated Prompt Optimization

Inspired by [Karpathy's autoresearch method](https://github.com/karpathy/autoresearch). Automatically tests your receptionist's system prompt against simulated conversations, scores it, suggests improvements, and deploys them — only if they actually improve the score.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Scenarios   │────▶│  Simulate    │────▶│   Score     │
│  (your test  │     │  conversations│     │  against    │
│   cases)     │     │  via webchat  │     │  criteria   │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                    ┌──────────────┐     ┌──────▼──────┐
                    │  Deploy if   │◀────│  Generate   │
                    │  score ↑     │     │  improvement│
                    └──────────────┘     └─────────────┘
```

1. **Define scenarios** — Simulated customer conversations (new patient, price inquiry, emergency, spam, etc.)
2. **Define criteria** — What "good" looks like (short greeting, captures contact info, handles trolls, etc.)
3. **Run baseline** — Score the current prompt against all scenarios
4. **Improve** — AI analyzes failures, suggests ONE surgical prompt edit, tests it
5. **Keep or revert** — If score improves, the change sticks. If not, it rolls back automatically.

## Quick Start

### 1. Copy and configure

```bash
cd tools/autoresearch
cp .env.example .env
# Edit .env with your server details
```

### 2. Create your scenarios

Edit `scenarios.json` — each scenario is a simulated customer conversation:

```json
[
  {
    "id": "new-patient",
    "description": "New patient calling to schedule an appointment",
    "messages": [
      "Hi, I'd like to schedule an appointment",
      "I'm a new patient",
      "My name is Sarah, I'm in downtown",
      "555-123-4567"
    ]
  }
]
```

### 3. Define your criteria

Edit `criteria.json` — what the receptionist should do in each scenario:

```json
{
  "criteria": [
    {
      "id": "greeting",
      "question": "Is the greeting short and natural (under 2 sentences)?",
      "applies_to": ["new-patient", "returning-patient", "price-inquiry"]
    },
    {
      "id": "contact-capture",
      "question": "Did the receptionist collect at least name and phone number?",
      "applies_to": ["new-patient", "price-inquiry"]
    }
  ]
}
```

### 4. Run it

```bash
# Score current prompt
python3 run.py baseline

# Run one improvement round (suggest + test + deploy/revert)
python3 run.py improve

# Run N improvement rounds
python3 run.py loop 5

# Show history
python3 run.py report
```

## Configuration

### `.env` file

```bash
# Server where receptionist is deployed
REMOTE_HOST=root@your-server-ip
REMOTE_PASS=your-ssh-password
REMOTE_PROMPT=/opt/receptionist/prompts/system-prompt.txt

# Receptionist webchat API endpoint
RECEPTIONIST_URL=https://your-receptionist-url.com

# Scorer model (uses OpenRouter — key fetched from server's .env)
# The scorer evaluates David's responses against your criteria
```

### Scenarios

Each scenario simulates a customer interaction. The `messages` array contains what the customer says — the receptionist responds via the webchat API.

**Tips for writing good scenarios:**
- Cover your most common call types (70% of your volume)
- Include edge cases (spam, out-of-area, angry customer)
- Include at least one multi-language scenario if applicable
- Keep messages realistic — short, sometimes misspelled, sometimes vague

### Criteria

Each criterion is a yes/no question that a scoring model evaluates. The `applies_to` array maps criteria to scenarios.

**Tips for writing good criteria:**
- Be specific and measurable ("Did the receptionist ask for a phone number?" not "Was the receptionist helpful?")
- Test one thing per criterion
- Include both positive criteria (what to do) and negative criteria (what NOT to do)

## Automation

Run autoresearch on a schedule (e.g., weekly) to continuously improve your receptionist:

```bash
# Example cron: every Monday at 4am
0 4 * * 1 cd /path/to/tools/autoresearch && python3 run.py loop 3 >> /var/log/autoresearch.log 2>&1
```

## How Scoring Works

1. Each scenario is played through the webchat API
2. The full conversation is sent to GPT-4o (via OpenRouter) with the criteria
3. GPT-4o evaluates each applicable criterion as PASS or FAIL
4. Score = total passes / total checks across all scenarios

## How Improvement Works

1. All failures are collected and sent to GPT-4o
2. GPT-4o suggests ONE surgical edit to the system prompt
3. The edit is applied and the full baseline is re-run
4. If score improves → change is kept, logged to `changelog.md`
5. If score doesn't improve → change is reverted, also logged

**Safety:** The original prompt is always backed up to `prompt-backup.txt` before any changes. You can always restore it.

## Files

| File | Purpose |
|---|---|
| `run.py` | Main runner — baseline, improve, loop, report |
| `scorer.py` | Calls OpenRouter to evaluate conversations |
| `scenarios.json` | Your test scenarios (customize these!) |
| `criteria.json` | Your scoring criteria (customize these!) |
| `.env` | Server credentials (never committed) |
| `.env.example` | Template for `.env` |
| `changelog.md` | Auto-generated log of all prompt changes |
| `results/` | JSON results from each run |
| `prompt-backup.txt` | Backup of original prompt |
| `prompt-current.txt` | Current prompt (synced from server) |
