# Backup — Gather Fallback Mode

This folder contains code that powered the **turn-by-turn Gather fallback** — the mode that handled calls via Twilio speech recognition when no OpenAI API key was set.

The system now requires the OpenAI Realtime API (`OPENAI_API_KEY`). This code is preserved here in case you ever need to restore the fallback.

## Contents

| File | What it was |
|---|---|
| `src/call-handler.js` | Managed Gather call sessions — start, process, end |
| `gather-routes.js` | The server.js routes that handled Gather calls |
| `prompts/follow-up.txt` | Spoken after each AI response: "Is there anything else?" |
| `prompts/closing.txt` | Spoken before hanging up |
| `prompts/no-speech-detected.txt` | Spoken when Twilio didn't detect speech |
| `prompts/error.txt` | Spoken on processing errors |

## How to restore

1. Copy `src/call-handler.js` back to `src/`
2. Copy the prompt files back to `prompts/`
3. In `src/server.js`:
   - Add `const callHandler = require('./call-handler');` with the other imports
   - Restore the `else` branch in `/incoming-call` (see `gather-routes.js`)
   - Restore the `/handle-speech` route
   - Restore the `/call-status` body (`callHandler.endCall(callSid)`)
4. In `src/prompts.js`:
   - Add `followUp`, `closing`, `noSpeechDetected`, `error` back to the `files` map in `loadAllPrompts()`
   - Add them back to `getDefaultPrompt()`, `getAll()`, and add their getters
