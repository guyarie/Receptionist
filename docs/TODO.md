# TODO / Roadmap

Planned improvements, in rough priority order. See commit history for what's already shipped.

---

## Setup agent: next steps

### Re-runnable setup
The setup agent currently starts a fresh conversation each time `/setup` is opened. It should instead:
- Read existing `data/` files and `.env` values at the start of each session
- Summarize what's already configured
- Offer to update specific sections ("update your provider profiles", "redo the system prompt", "add new credentials") rather than starting from scratch
- Be safe to re-run without overwriting things the user wants to keep

This is low complexity — the agent already has `list_context_files` and `validate_setup` tools. The main work is in the system prompt and session initialization logic.

### In-call dynamic context loading
Currently, all provider profiles and availability data are loaded once at server startup and injected into the system prompt as a block. For businesses with many providers, this is token-heavy and imprecise.

The better pattern: the in-call AI calls a tool (e.g., `load_provider_context("Dr. Jane Smith")`) when a caller asks about a specific person, and the tool returns that provider's profile just-in-time.

What needs to happen:
1. **Runtime side**: Extend `openai-adapter.js` to support function calling during a live Realtime session (OpenAI Realtime API supports this via `session.update` + tool definitions)
2. **Context side**: Add a `get_provider_info(name)` tool that reads from `data/providers/`
3. **Setup side**: The setup agent already creates the context files in the right format. It should also generate a brief "context strategy" description in the system prompt that tells the in-call AI when and how to load additional context.

The setup agent should be updated to reflect this: even before the runtime implementation is complete, it should write prompts as if dynamic loading works (telling the AI "you can look up provider details when asked").

### Deployment packaging for non-technical users
The current flow assumes the user can clone a git repo and run `npm start`. The goal is: someone downloads something and runs a setup agent. Options to evaluate:

- **Docker image** — `docker run -p 3000:3000 receptionist` with a volume for `data/`; probably the best balance of simplicity and reliability
- **`npx` launcher** — `npx ai-receptionist` downloads and starts the server
- **Hosted / SaaS version** — users don't run the server at all; they configure through a web interface and the server is managed for them

The setup agent UI and flow works well for all of these. The packaging question is separate from the agent itself.

---

## Admin panel improvements

### Setup agent link from admin panel
Add a link or button in the admin dashboard to re-open the setup assistant. Useful for: adding new providers, updating the system prompt, or onboarding a new deployment to an existing account.

### Setup completion indicator
Show a persistent banner or status indicator when `SETUP_MODE=true` is still set, prompting the user to complete setup or visit `/setup`.

---

## Call handling

### Receptionist should not tell the caller to call the same number they just called

The AI sometimes suggests the caller call back on the same Twilio number they're already on, which doesn't make sense. The system prompt should be updated (or a guardrail added) to prevent this.



### In-call tool calling (prerequisite for dynamic context)
The OpenAI Realtime API supports function calling, but `openai-adapter.js` doesn't implement it yet. This is the foundation for dynamic context loading and other in-call behaviors (e.g., looking up appointment availability via an external API).

Implementation sketch:
- Add tool definitions to the `session.update` payload in `openai-adapter.js`
- Handle `response.function_call_arguments.done` events from OpenAI
- Execute the tool and inject the result back via `conversation.item.create`
- Resume the response

### Multi-business / multi-tenant support
Currently one server = one business. For a hosted version, the server would need to route incoming calls to the correct business configuration based on the Twilio number dialed.

---

## Infrastructure

### Persistent setup sessions
Setup sessions are currently in-memory only. If the server restarts mid-setup, the conversation is lost. For a better experience, serialize the setup conversation to a file (e.g., `runtime/setup-session.json`) so the user can pick up where they left off after a restart.

### Automated backups
The admin panel already creates a backup of `data/` before refreshing website data. A cron job to do this daily (or on a schedule) would protect against accidental prompt overwrites.
