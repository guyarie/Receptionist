# AI Phone Receptionist

AI-powered phone receptionist for Relational Therapy Collective (RTC).

## Quick Start Guide

### Prerequisites
- Node.js installed (v18 or higher)
- Twilio account with a phone number
- OpenRouter API key
- Cloudflare Tunnel (cloudflared)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and fill in your credentials:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxx
   OPENROUTER_MODEL=openai/gpt-4
   PORT=3000
   ```

**Where to find these:**
- **Twilio credentials**: [Twilio Console](https://console.twilio.com/) → Account Info
- **Twilio phone number**: [Twilio Console](https://console.twilio.com/) → Phone Numbers → Buy a number
- **OpenRouter API key**: [OpenRouter](https://openrouter.ai/) → Keys

### Step 3: Test AI Integration (Optional)

Before setting up the phone system, test that your OpenRouter API key works:

```bash
npm run test-ai
```

You should see a conversation between the test script and the AI.

### Step 4: Start the Server

```bash
npm start
```

You should see:
```
🚀 Server running on port 3000
📞 Webhook URL: http://localhost:3000/incoming-call
✅ Configuration loaded
```

### Step 5: Setup Cloudflare Tunnel

**Option A: Quick Test (Temporary URL)**

In a **separate terminal**, run:
```bash
cloudflared tunnel --url http://localhost:3000
```

This will give you a temporary public URL like:
```
https://abc-def-123.trycloudflare.com
```

**Option B: Permanent Tunnel (Recommended for production)**

1. Install cloudflared: Download from [Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

2. Authenticate:
   ```bash
   cloudflared tunnel login
   ```

3. Create a tunnel:
   ```bash
   cloudflared tunnel create rtc-receptionist
   ```

4. Configure the tunnel (create `config.yml`):
   ```yaml
   tunnel: rtc-receptionist
   credentials-file: C:\Users\YourUser\.cloudflared\UUID.json
   
   ingress:
     - hostname: voice.yourdomain.com
       service: http://localhost:3000
     - service: http_status:404
   ```

5. Route DNS:
   ```bash
   cloudflared tunnel route dns rtc-receptionist voice.yourdomain.com
   ```

6. Run the tunnel:
   ```bash
   cloudflared tunnel run rtc-receptionist
   ```

### Step 6: Configure Twilio Webhook

1. Go to [Twilio Console](https://console.twilio.com/) → Phone Numbers
2. Click on your phone number
3. Scroll to "Voice & Fax" section
4. Under "A CALL COMES IN":
   - Select: **Webhook**
   - URL: `https://your-tunnel-url.trycloudflare.com/incoming-call`
   - HTTP Method: **POST**
5. Click **Save**

### Step 7: Test the System! 🎉

Call your Twilio phone number!

You should hear:
> "Hello! Thank you for calling the Relational Therapy Collective. I'm your AI receptionist. How can I help you today?"

Try saying:
- "I need help finding a therapist"
- "What types of therapy do you offer?"
- "Do you accept insurance?"

The AI will respond naturally to your questions!

## Troubleshooting

### "Missing required environment variables"
- Make sure your `.env` file exists and has all required values
- Check that there are no extra spaces in your `.env` file

### "OpenRouter API error"
- Verify your API key is correct
- Check that you have credits in your OpenRouter account
- Try the test script: `npm run test-ai`

### "Call connects but no audio"
- Make sure Cloudflare Tunnel is running
- Verify the webhook URL in Twilio matches your tunnel URL
- Check the server logs for errors

### "AI doesn't respond"
- Check server logs for errors
- Verify OpenRouter API key is valid
- Make sure you're speaking clearly and waiting for the prompt

## Project Structure
```
.
├── src/
│   ├── server.js         # Main Express server with Twilio webhooks
│   ├── config.js         # Configuration loader
│   ├── ai-client.js      # OpenRouter AI integration
│   ├── call-handler.js   # Call session management
│   └── test-ai.js        # AI testing script
├── .env                  # Environment variables (not in git)
├── .env.example          # Example environment variables
├── package.json          # Node.js dependencies
└── README.md            # This file
```

## How It Works

1. **Caller dials** your Twilio number
2. **Twilio sends webhook** to `/incoming-call`
3. **Server returns TwiML** with greeting and speech recognition
4. **Caller speaks**, Twilio converts speech to text
5. **Text sent to** `/handle-speech` endpoint
6. **AI processes** the text and generates response
7. **Server returns TwiML** with AI response as speech
8. **Loop continues** until caller hangs up

## Next Steps

Now that you have a working demo, you can:
- [ ] Add data integration (Excel files, website content)
- [ ] Implement tool calling (insurance lookup, availability checking)
- [ ] Add crisis detection
- [ ] Implement appointment booking
- [ ] Add proper error handling
- [ ] Convert to TypeScript for better type safety

See `tasks.md` for the full implementation plan!

## Support

If you run into issues:
1. Check the server logs for error messages
2. Verify all environment variables are set correctly
3. Test the AI client separately with `npm run test-ai`
4. Make sure Cloudflare Tunnel is running and accessible
