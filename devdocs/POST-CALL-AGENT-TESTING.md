# Post-Call Agent Testing

Test the post-call agent by replaying real (or hand-crafted) call transcripts through `runPostCallAgent` without placing actual phone calls. The agent's real tools still run (OpenRouter, provider profiles, email, etc.) — only the phone call itself is skipped.

## Quick Start

All commands are run from the project root (where `package.json` lives).

```bash
# Seed a fixture from an existing call summary
node tests/simulated_call_bank/seed-fixture.js call-summaries/call-2026-03-15-12-50-31-CAc26ac1.json

# Run all fixtures through the agent
npx vitest run --config tests/integration/vitest.integration.config.js

# Run a single fixture
FIXTURE=fixture-6864105d.json npx vitest run --config tests/integration/vitest.integration.config.js
```

## Creating Fixtures

### From a real call summary

Every completed call writes a summary JSON to `call-summaries/`. Convert any of those into a test fixture:

```bash
node tests/simulated_call_bank/seed-fixture.js call-summaries/<filename>.json
```

This reads the summary, maps the fields to the format `runPostCallAgent` expects, and writes a fixture to `tests/simulated_call_bank/`.

The seed utility handles both the older flat summary format and the newer nested format automatically.

### By hand

Create a JSON file in `tests/simulated_call_bank/` with this shape:

```json
{
  "callSid": "CA00000000000000000000000000000000",
  "from": "+15551234567",
  "to": "+18005551234",
  "startTime": "2026-03-15T10:00:00",
  "endTime": "2026-03-15T10:05:00",
  "conversationHistory": [
    { "role": "assistant", "content": "Hello! How can I help you today?" },
    { "role": "user", "content": "I'm looking for a therapist for my child." }
  ]
}
```

Required fields: `callSid`, `from`, `to`, `startTime`, `endTime`, `conversationHistory` (array of `{ role, content }`).

## Running the Tests

Integration tests are excluded from the default `npx vitest run` because they hit real OpenRouter. Run them explicitly:

```bash
# All fixtures
npx vitest run --config tests/integration/vitest.integration.config.js

# Single fixture
FIXTURE=fixture-6864105d.json npx vitest run --config tests/integration/vitest.integration.config.js
```

Each fixture gets a 120-second timeout. The test reports which tools the agent called and whether it completed successfully.

## What Happens During a Test Run

1. The loader reads and validates all `.json` files from `tests/simulated_call_bank/`
2. For each fixture, `runPostCallAgent(fixtureData)` is called
3. The agent runs its full loop — reads provider profiles, generates a summary, may send emails
4. Agent debug logs are written to `data/agent_logs/`
5. The test reports pass/fail and tool calls for each fixture

## Typical Workflow

1. A bug is reported with a specific call
2. Find the call summary in `call-summaries/`
3. Seed it: `node tests/simulated_call_bank/seed-fixture.js call-summaries/<file>.json`
4. Run it: `FIXTURE=fixture-<sid>.json npx vitest run tests/integration/post-call-agent.test.js`
5. Check `data/agent_logs/` for the detailed agent trace
6. Fix the issue, re-run to verify

## File Locations

| What | Where |
|------|-------|
| Fixtures | `tests/simulated_call_bank/*.json` |
| Seed utility | `tests/simulated_call_bank/seed-fixture.js` |
| Fixture loader | `tests/simulated_call_bank/loader.js` |
| Integration test | `tests/integration/post-call-agent.test.js` |
| Agent debug logs | `data/agent_logs/` |
| Call summaries (input) | `call-summaries/` |
