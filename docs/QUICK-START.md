# Quick Start Guide

## ✅ What You Have Now

A working AI phone receptionist that:
- Answers calls to +1 (855) 707-2970
- Greets callers naturally
- Responds to questions using AI
- Maintains conversation context
- All text is customizable via text files

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

### Start Everything

**Terminal 1 - Server:**
```bash
npm start
```

**Terminal 2 - Cloudflare Tunnel:**
```bash
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
```

### Stop Everything

- Press `Ctrl+C` in each terminal

### Check Status

- Server: http://localhost:3000/
- Should see: "AI Phone Receptionist is running!"

## 📞 Testing

1. **Call:** +1 (855) 707-2970
2. **Listen** to the greeting
3. **Speak** your question
4. **Wait** for AI response
5. **Continue** the conversation

## 🔧 Common Tasks

### Change the Greeting
Edit `prompts/greeting.txt`, restart server, test

### Change AI Personality
Edit `prompts/system-prompt.txt`, restart server, test

### Reload Prompts Without Restarting
```bash
curl -X POST http://localhost:3000/reload-prompts
```

### View Server Logs
Watch the terminal running `npm start` to see:
- Incoming calls
- What callers say
- AI responses

## 📁 Project Structure

```
.
├── src/
│   ├── server.js          # Main server
│   ├── ai-client.js       # OpenRouter integration
│   ├── prompts.js         # Prompt loader
│   └── config.js          # Configuration
├── prompts/               # Editable text files
│   ├── greeting.txt
│   ├── system-prompt.txt
│   └── ...
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

**Changes not working?**
- Make sure you saved the file
- Restart the server
- Check for typos

**Tunnel URL changed?**
- This is normal for free tunnels
- Update webhook URL in Twilio console
- Look for new URL in tunnel logs

## 📚 Documentation

- `README.md` - Full setup guide
- `CUSTOMIZATION-GUIDE.md` - How to customize prompts
- `prompts/README.md` - Detailed prompt guide
- `tasks.md` - Full implementation roadmap

## 🎯 Next Steps

1. **Customize prompts** to match your practice
2. **Test with real scenarios** (insurance questions, booking, etc.)
3. **Get feedback** from staff/test callers
4. **Add real data** (Excel file, website)
5. **Implement booking** and other features

See `tasks.md` for the complete roadmap!

## 💡 Tips

- Test frequently as you make changes
- Read prompts out loud before testing
- Keep messages brief (10-15 seconds)
- Be specific in system prompt
- Monitor server logs during calls
- Iterate based on feedback

## 🔗 Important URLs

- **Your phone number:** +1 (855) 707-2970
- **Twilio Console:** https://console.twilio.com/
- **OpenRouter:** https://openrouter.ai/
- **Server:** http://localhost:3000/

---

**Need help?** Check the documentation files or review the server logs for error messages.
