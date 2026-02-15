# Quick Start Guide

## ✅ What You Have Now

A working AI phone receptionist with two voice modes:

**Real-Time Streaming Mode** (with OPENAI_API_KEY):
- Low-latency bidirectional audio
- Natural interruptions supported
- Conversational flow like a real person
- Uses OpenAI Realtime API

**Turn-by-Turn Mode** (fallback without OPENAI_API_KEY):
- Traditional speech recognition
- Reliable and cost-effective
- Uses Twilio Gather + OpenRouter

Both modes include:
- Natural conversation with context awareness
- AI-generated call summaries
- Web chat interface
- Admin dashboard for call logs and settings

## 🎨 Customize Your AI

All prompts are in the `prompts/` folder:

```
prompts/
├── greeting.txt               # "Hello! Thank you for calling..."
├── system-prompt.txt          # AI personality and behavior
├── follow-up.txt              # "Is there anything else?"
├── closing.txt                # "Thank you for calling!"
├── no-speech-detected.txt     # "I didn't catch that..."
└── error.txt                  # "Technical difficulties..."
```

**To make changes:**
1. Edit any file in `prompts/`
2. Restart: `Ctrl+C` then `npm start`
3. Test: Call your number

See `CUSTOMIZATION-GUIDE.md` for detailed instructions and examples.

## 🚀 Running the System

### Check Your Mode

When you start the server, look for:

**Real-Time Streaming Mode:**
```
🎙️ Realtime voice streaming is available
```

**Turn-by-Turn Mode (Fallback):**
```
⚠️ OPENAI_API_KEY not set — real-time voice streaming unavailable, using Gather fallback
```

### Start Everything

**Terminal 1 - Server:**
```bash
npm start
```

**Terminal 2 - Expose Server (for local testing):**

For local development, use a tunnel service like ngrok or Cloudflare Tunnel:
```bash
# Example with ngrok
ngrok http 3000

# Or with Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000
```

For production deployment with SSL, see [DIGITALOCEAN-DEPLOYMENT.md](DIGITALOCEAN-DEPLOYMENT.md).

### Stop Everything

- Press `Ctrl+C` in each terminal

### Check Status

- Server: http://localhost:3000/
- Admin Dashboard: http://localhost:3000/admin
- Should see: "AI Phone Receptionist is running!"

## 📞 Testing

### Test a Call

1. **Call** your Twilio phone number
2. **Listen** to the greeting
3. **Speak** your question
4. **In Real-Time Mode**: You can interrupt the AI naturally
5. **In Turn-by-Turn Mode**: Wait for the AI to finish before speaking
6. **Continue** the conversation

### Test the Web Chat

1. Open http://localhost:3000/chat.html
2. Type a message
3. Get instant AI responses
4. Test different scenarios

### View Call Logs

1. Open http://localhost:3000/admin
2. Click "Call Logs"
3. Review transcripts and AI summaries
4. See both streaming and turn-by-turn calls

## 🔧 Common Tasks

### Switch Between Voice Modes

**Enable Real-Time Streaming:**
1. Get an OpenAI API key from https://platform.openai.com/api-keys
2. Add to `.env`: `OPENAI_API_KEY=sk-xxxxxxxxxxxxx`
3. Restart server
4. Look for: `🎙️ Realtime voice streaming is available`

**Use Turn-by-Turn Mode:**
1. Remove or comment out `OPENAI_API_KEY` in `.env`
2. Restart server
3. Look for: `⚠️ ... using Gather fallback`

### Change the Voice (Real-Time Mode Only)

Edit `.env`:
```env
OPENAI_REALTIME_VOICE=nova
```

Available voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`

### Change the Greeting

Edit `prompts/greeting.txt`, restart server, test

### Change AI Personality

Edit `prompts/system-prompt.txt`, restart server, test

### Reload Prompts Without Restarting

```bash
curl -X POST http://localhost:3000/reload-prompts
```

Or use the admin dashboard: http://localhost:3000/admin → Prompts

### View Server Logs

Watch the terminal running `npm start` to see:
- Incoming calls and mode (streaming vs. turn-by-turn)
- What callers say (transcripts)
- AI responses
- WebSocket connections (streaming mode)
- Errors and warnings

## 📁 Project Structure

```
.
├── src/
│   ├── server.js              # Main server with dual-mode support
│   ├── ai-client.js           # OpenRouter integration
│   ├── call-handler.js        # Turn-by-turn call management
│   ├── call-summary.js        # Call summary generation
│   ├── prompts.js             # Prompt loader
│   ├── config.js              # Configuration
│   └── realtime/              # Real-time streaming components
│       ├── provider-adapter.js    # Base adapter class
│       ├── openai-adapter.js      # OpenAI Realtime API
│       ├── relay-service.js       # Audio relay service
│       ├── session-manager.js     # Session tracking
│       └── provider-factory.js    # Adapter factory
├── prompts/               # Editable text files
│   ├── greeting.txt
│   ├── system-prompt.txt
│   └── ...
├── public/                # Web interfaces
│   ├── chat.html         # Web chat
│   └── admin/            # Admin dashboard
├── .env                   # Your credentials
├── package.json           # Dependencies
└── README.md             # Full documentation
```

## 🆘 Troubleshooting

**Call doesn't connect?**
- Check both server and tunnel are running
- Verify webhook URL in Twilio console

**AI doesn't respond?**
- Check server logs for errors
- Verify OpenRouter API key in `.env`
- Test with: `npm run test-ai`

**Real-time streaming not working?**
- Verify `OPENAI_API_KEY` is set in `.env`
- Check for: `🎙️ Realtime voice streaming is available` on startup
- Look for WebSocket connection logs: `🔌 Media stream WebSocket connected`
- Check OpenAI API key has sufficient credits

**Audio quality issues (streaming mode)?**
- Check your internet connection
- Try a different voice in `.env`: `OPENAI_REALTIME_VOICE=nova`
- Monitor server logs for errors

**Turn-by-turn mode too slow?**
- This is normal for Gather-based mode
- Consider enabling real-time streaming with `OPENAI_API_KEY`

**Changes not working?**
- Make sure you saved the file
- Restart the server
- Check for typos

**Tunnel URL changed?**
- This is normal for free tunnels
- Update webhook URL in Twilio console
- Look for new URL in tunnel logs

## 📚 Documentation

- `README.md` - Full setup guide with dual-mode instructions
- `CUSTOMIZATION-GUIDE.md` - How to customize prompts
- `prompts/README.md` - Detailed prompt guide
- `.kiro/specs/realtime-voice-streaming/` - Real-time streaming feature spec
- `.kiro/specs/ai-phone-receptionist/` - Original feature spec

## 🎯 Next Steps

1. **Test both voice modes** to see the difference
2. **Customize prompts** to match your practice
3. **Try the admin dashboard** at http://localhost:3000/admin
4. **Review call summaries** to see transcripts and AI analysis
5. **Test with real scenarios** (insurance questions, booking, etc.)
6. **Get feedback** from staff/test callers
7. **Deploy to production** (see `docs/systemd-setup.md`)

## 💡 Tips

- **Real-time mode** provides the best user experience but requires OpenAI API key
- **Turn-by-turn mode** is reliable and works without additional setup
- Test frequently as you make changes
- Read prompts out loud before testing
- Keep messages brief (10-15 seconds)
- Be specific in system prompt
- Monitor server logs during calls
- Use the admin dashboard to review call quality
- Iterate based on feedback

## 🔗 Important URLs

- **Server:** http://localhost:3000/
- **Admin Dashboard:** http://localhost:3000/admin
- **Web Chat:** http://localhost:3000/chat.html
- **Twilio Console:** https://console.twilio.com/
- **OpenRouter:** https://openrouter.ai/
- **OpenAI Platform:** https://platform.openai.com/

---

**Need help?** Check the documentation files or review the server logs for error messages.
