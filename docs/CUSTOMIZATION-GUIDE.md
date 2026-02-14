# AI Receptionist Customization Guide

## 🎨 Quick Customization

All the text your AI receptionist says is now in editable files in the `prompts/` folder!

### Files You Can Edit

```
prompts/
├── system-prompt.txt          # AI's personality and behavior
├── greeting.txt               # First thing callers hear
├── follow-up.txt              # After each response
├── closing.txt                # Before hanging up
├── no-speech-detected.txt     # When AI can't hear
├── error.txt                  # When there's a problem
└── README.md                  # Detailed guide
```

## 🚀 How to Make Changes

### Method 1: Edit and Restart (Recommended)

1. **Edit any file** in the `prompts/` folder
2. **Restart the server:**
   - Stop: Press `Ctrl+C` in the terminal running `npm start`
   - Start: Run `npm start` again
3. **Test:** Call your number to hear the changes

### Method 2: Live Reload (Advanced)

1. **Edit any file** in the `prompts/` folder
2. **Reload without restarting:**
   ```bash
   curl -X POST http://localhost:3000/reload-prompts
   ```
3. **Test:** Call your number to hear the changes

## 📝 Common Customizations

### Make the Greeting More Personal

Edit `prompts/greeting.txt`:
```
Hi! Thanks for calling Relational Therapy Collective. This is Sarah, your AI assistant. What brings you in today?
```

### Add Practice Information

Edit `prompts/system-prompt.txt` and add:
```
Additional information to share:
- We offer individual, couples, and family therapy
- We accept most major insurance plans
- We have evening and weekend appointments available
- Our office is located at [address]
```

### Change the Tone

**More Casual:**
```
Hey there! Thanks for calling RTC. I'm the AI receptionist. What's up?
```

**More Formal:**
```
Good day. You have reached the Relational Therapy Collective. I am the automated receptionist. How may I direct your inquiry?
```

**More Warm/Empathetic:**
```
Hello, and thank you for reaching out to the Relational Therapy Collective. I know it takes courage to make this call. I'm here to help you find the support you need. How can I assist you today?
```

### Add Specific Instructions

Edit `prompts/system-prompt.txt` and add:
```
When callers ask about:
- Pricing: Mention that sessions are $150-200, with insurance coverage available
- Availability: Let them know we typically have openings within 1-2 weeks
- Crisis situations: Immediately provide 988 (Suicide & Crisis Lifeline) or 911
```

## 🎯 Testing Your Changes

1. **Call your number:** +1 (855) 707-2970
2. **Listen carefully** to how it sounds
3. **Ask different questions** to test the AI's responses
4. **Iterate:** Keep tweaking until it sounds perfect!

## 💡 Pro Tips

### Keep It Natural
- Write how people actually talk on the phone
- Avoid overly formal or robotic language
- Read your prompts out loud before testing

### Keep It Brief
- Long messages lose callers' attention
- Aim for 10-15 seconds per message
- Get to the point quickly

### Be Specific in System Prompt
- The more specific you are, the better the AI performs
- Include examples of good responses
- Mention what NOT to do

### Test Edge Cases
- What if someone is in crisis?
- What if they ask about something you don't offer?
- What if they're confused or frustrated?

## 🔧 Advanced: Voice Selection

Currently using: **Polly.Joanna** (female, US English)

To change the voice, edit `src/server.js` and replace `Polly.Joanna` with:

**Female voices:**
- `Polly.Joanna` - US English (current)
- `Polly.Kendra` - US English
- `Polly.Kimberly` - US English
- `Polly.Salli` - US English
- `Polly.Amy` - British English

**Male voices:**
- `Polly.Joey` - US English
- `Polly.Justin` - US English (child)
- `Polly.Matthew` - US English
- `Polly.Brian` - British English

After changing, restart the server.

## 📊 Monitoring Calls

Watch the server logs while testing:
```
📞 Incoming call received
💬 Caller said: "I need help finding a therapist"
🤖 AI: "I'd be happy to help you find a therapist..."
```

This helps you understand:
- What callers are saying
- How the AI is responding
- Where improvements are needed

## 🆘 Troubleshooting

**Changes not taking effect?**
- Make sure you saved the file
- Restart the server (Ctrl+C, then `npm start`)
- Check for typos in the prompt files

**AI not following instructions?**
- Be more specific in `system-prompt.txt`
- Add examples of desired behavior
- Test with different phrasings

**Voice sounds wrong?**
- Check the voice name in `src/server.js`
- Make sure it's spelled correctly
- Restart after changing

## 📚 Next Steps

Once you're happy with the basic customization:
1. Add real data (Excel file, website)
2. Implement appointment booking
3. Add crisis detection
4. Set up permanent Cloudflare Tunnel

See `tasks.md` for the full roadmap!
