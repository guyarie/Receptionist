# Post-Call Agent Testing

Test the post-call agent by replaying call transcripts through `runPostCallAgent` without placing actual phone calls. The agent's real tools still run (OpenRouter, provider profiles, email) — only the phone call itself is skipped.

## Quick Start

```bash
# Seed a fixture from an existing call summary
node tests/simulated_call_bank/seed-fixture.js runtime/call-summaries/call-2026-03-15-12-50-31-CAc26ac1.json

# Run all fixtures
npx vitest run --config tests/integration/vitest.integration.config.js

# Run a single fixture
FIXTURE=fixture-6864105d.json npx vitest run --config tests/integration/vitest.integration.config.js
```

## Creating Fixtures

### From a real call summary

Every completed call writes a summary JSON to `runtime/call-summaries/`. Convert any into a test fixture:

```bash
node tests/simulated_call_bank/seed-fixture.js runtime/call-summaries/<filename>.json
```

### By hand

Create a JSON file in `tests/simulated_call_bank/`:

```json
{
  "callSid": "CA00000000000000000000000000000000",
  "from": "+15551234567",
  "to": "+18005551234",
  "startTime": "2026-03-15T10:00:00",
  "endTime": "2026-03-15T10:05:00",
  "conversationHistory": [
    { "role": "assistant", "content": "Hello! How can I help you today?" },
    { "role": "user", "content": "I'm looking for an appointment." }
  ]
}
```

Required: `callSid`, `from`, `to`, `startTime`, `endTime`, `conversationHistory` (array of `{ role, content }`).

## Running Tests

Integration tests are excluded from the default `npm test` because they hit real OpenRouter.

```bash
# All fixtures
npx vitest run --config tests/integration/vitest.integration.config.js

# Single fixture
FIXTURE=fixture-6864105d.json npx vitest run --config tests/integration/vitest.integration.config.js
```

Each fixture has a 120-second timeout. The test reports which tools the agent called and whether it completed successfully.

## Typical Debugging Workflow

1. A bug is reported with a specific call
2. Find the summary in `runtime/call-summaries/`
3. Seed it: `node tests/simulated_call_bank/seed-fixture.js runtime/call-summaries/<file>.json`
4. Run it: `FIXTURE=fixture-<sid>.json npx vitest run tests/integration/post-call-agent.test.js`
5. Check `runtime/agent-logs/` for the detailed agent trace
6. Fix the issue and re-run to verify

## File Locations

| What | Where |
|---|---|
| Fixtures | `tests/simulated_call_bank/*.json` |
| Seed utility | `tests/simulated_call_bank/seed-fixture.js` |
| Fixture loader | `tests/simulated_call_bank/loader.js` |
| Integration test | `tests/integration/post-call-agent.test.js` |
| Agent debug logs | `runtime/agent-logs/` |
| Call summaries (input) | `runtime/call-summaries/` |
