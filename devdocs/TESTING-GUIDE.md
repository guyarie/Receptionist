# Testing Guide - Chat with AI Without Phone Calls

## 🎯 Two Ways to Test

You now have two ways to test the AI receptionist without making phone calls:

### Option 1: Command-Line Chat (Quick & Simple)

**Start the chat:**
```bash
npm run chat
```

**What you'll see:**
```
🤖 AI Receptionist Test Chat
==================================================
Loading website data...

✅ Website data loaded

Type your messages below. Type "exit" to quit.

Try asking:
  - "What types of therapy do you offer?"
  - "Do you have Spanish-speaking therapists?"
  - "Who specializes in trauma?"
  - "Can you help with child anxiety?"

==================================================

You: _
```

**How to use:**
- Type your message and press Enter
- The AI will respond immediately
- Type "exit" to quit
- Press Ctrl+C to force quit

**Perfect for:**
- Quick testing
- Debugging prompts
- Testing AI responses
- No browser needed

---

### Option 2: Web Chat Interface (Visual & Interactive)

**Start the server:**
```bash
npm start
```

**Open in browser:**
```
http://localhost:3000/chat.html
```

**What you'll see:**
- Beautiful chat interface
- Suggestion buttons for common questions
- Real-time typing indicators
- Conversation history
- Mobile-friendly design

**Perfect for:**
- Visual testing
- Showing to others
- Testing conversation flow
- More realistic experience

---

## 🧪 What to Test

### Basic Functionality
- ✅ Does the AI respond?
- ✅ Does it use website information?
- ✅ Are responses natural and conversational?
- ✅ Does it stay in character as a receptionist?

### Website Integration
Ask questions that require website knowledge:
- "What types of therapy do you offer?"
- "Do you have any therapists who speak Spanish?"
- "Who specializes in trauma?"
- "Can you help with EMDR?"
- "Do you offer couples therapy?"
- "Who works with children?"

### Clinician Information
- "Tell me about Dr. Miri Arie"
- "Who can help with anxiety?"
- "Do you have anyone who does medication management?"
- "Who offers parent coaching?"

### Contact Information
- "How do I schedule an appointment?"
- "What's your phone number?"
- "What's your email?"
- "Where are you located?"

### Edge Cases
- Ask about something not offered
- Ask in different languages (if applicable)
- Ask vague questions
- Ask multiple questions at once

---

## 📊 Comparing to Phone Calls

### Advantages of Chat Testing:
✅ **Instant** - No need to call
✅ **Free** - No Twilio minutes used
✅ **Convenient** - Test anytime
✅ **Debuggable** - See full conversation
✅ **Fast iteration** - Change prompts and test immediately
✅ **No tunnel needed** - Works offline

### When to Use Phone Testing:
- Testing speech recognition
- Testing voice quality
- Testing real-world scenarios
- Final validation before launch

---

## 🔄 Development Workflow

**Recommended workflow:**

1. **Edit prompts** in `prompts/` folder
2. **Test with chat** (`npm run chat` or web interface)
3. **Iterate quickly** until responses are perfect
4. **Test with phone** for final validation

This saves time and Twilio costs!

---

## 💡 Tips

### Command-Line Chat
- Keep the terminal window open
- Use arrow keys to repeat previous messages
- Copy/paste long questions for testing
- Great for rapid testing

### Web Chat
- Open browser dev tools (F12) to see API calls
- Refresh page to start new conversation
- Test on mobile by accessing from phone on same network
- Share URL with team for feedback

### Both Methods
- The AI has the same knowledge as phone calls
- Responses should be identical to phone
- Test edge cases and unusual questions
- Try to break it!

---

## 🐛 Troubleshooting

**Command-line chat not working?**
```bash
# Make sure server dependencies are installed
npm install

# Try running directly
node src/test-chat.js
```

**Web chat not loading?**
- Make sure server is running (`npm start`)
- Check http://localhost:3000/ works first
- Try http://localhost:3000/chat.html
- Check browser console for errors

**AI not responding?**
- Check OpenRouter API key in `.env`
- Verify server logs for errors
- Test with `npm run test-ai` first

**Responses seem wrong?**
- Check `prompts/system-prompt.txt`
- Verify website data loaded (check server logs)
- View website data: http://localhost:3000/website-data

---

## 📝 Example Test Session

```
You: What types of therapy do you offer?

AI: We offer a variety of therapy services including individual therapy, 
couples therapy, family therapy, child and teen therapy, parent coaching, 
life coaching, group therapy, and medication management. We also specialize 
in EMDR and selective mutism treatment.

You: Do you have any Spanish-speaking therapists?

AI: Yes! Dr. Rebeca Marin is a licensed clinical psychologist who provides 
therapy in both English and Spanish. She specializes in couples therapy and 
works with clients dealing with trauma, depression, anxiety, and interpersonal 
relationships.

You: How do I schedule an appointment?

AI: To schedule an appointment, you can contact the specific clinician directly. 
For general inquiries, you can email therapy@rtcbellevue.com or call 
(425) 279-5017. Note that the main phone number is for inquiries only - 
for scheduling, please reach out to your chosen therapist directly from our team page.
```

---

## 🎯 Next Steps

Once you're happy with the chat responses:
1. Update Twilio webhook URL
2. Test with actual phone calls
3. Get feedback from real users
4. Continue iterating!

---

**Happy Testing! 🚀**
