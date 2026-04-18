# Testing the AI Without Phone Calls

Two ways to test the receptionist without placing a real call:

## Option 1: Command-Line Chat

```bash
npm run chat
```

Type messages, get responses. Type `exit` to quit.

Good for: quick prompt iteration, debugging AI responses, no browser needed.

## Option 2: Web Chat Interface

```bash
npm start
```

Then open **http://localhost:3000/chat.html** in your browser.

Good for: visual testing, showing others, testing conversation flow.

---

## What to Test

### Core behavior
- Does the AI respond?
- Does it use the information in your provider profiles?
- Are responses natural and conversational?
- Does it stay in character as a receptionist?

### With your business data loaded, ask:
- "What services do you offer?"
- "Who specializes in [something your business does]?"
- "Do you have anyone who speaks [language]?"
- "How do I schedule an appointment?"
- "Where are you located?"

### Edge cases
- Something you don't offer
- A vague or multi-part question
- A question not answered in the system prompt

---

## Development Workflow

1. Edit prompts in the admin panel (or `data/prompts/` directly)
2. Test with chat (`npm run chat` or web interface)
3. Iterate until responses are right
4. Make a real call for final validation

This saves time and Twilio costs.

---

## Troubleshooting

**Chat not working?**
```bash
npm install
node src/test-chat.js
```

**Web chat not loading?**
- Server must be running (`npm start`)
- Check http://localhost:3000/ first
- Check browser console for errors

**AI not responding?**
- Check `OPENROUTER_API_KEY` in `.env`
- Check server logs for errors

**Responses seem wrong?**
- Check `data/prompts/system-prompt.txt` (or `prompts/system-prompt.txt` if no override)
- Verify data loaded: check server logs on startup
