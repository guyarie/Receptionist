# Chat Widget Integration Guide

## Overview
The AI Receptionist Chat Widget allows you to embed the same AI assistant from your phone system directly into your website. Visitors can chat with the AI to get information about services, clinicians, and contact details.

## Quick Start

### 1. Test the Widget Locally
Visit http://localhost:3000/widget-example.html to see the widget in action.

### 2. Add to Your Website
Add these two code snippets to your website's HTML, just before the closing `</body>` tag:

```html
<!-- Configure the widget (optional) -->
<script>
  window.RTCChatConfig = {
    apiUrl: 'https://your-server-url.com',  // Your production server URL
    position: 'bottom-right',                // or 'bottom-left'
    primaryColor: '#667eea',                 // Your brand color
    title: 'Chat with us'                    // Widget title
  };
</script>

<!-- Include the widget script -->
<script src="https://your-server-url.com/chat-widget.js"></script>
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | `http://localhost:3000` | Your server URL (required for production) |
| `position` | string | `'bottom-right'` | Widget position: `'bottom-right'` or `'bottom-left'` |
| `primaryColor` | string | `'#667eea'` | Hex color code for widget theme |
| `title` | string | `'Chat with us'` | Text shown in widget header |

## Features

✅ **Floating Chat Button** - Unobtrusive button in corner of page  
✅ **Expandable Window** - Full chat interface when clicked  
✅ **Same AI** - Uses the same AI receptionist as your phone system  
✅ **Customizable** - Match your brand colors and positioning  
✅ **Mobile Responsive** - Works on all devices  
✅ **Easy Integration** - Just 2 lines of code  
✅ **Session Persistence** - Maintains conversation context  

## Production Deployment

### Step 1: Update Server URL
When deploying to production, you'll need to:

1. Get a permanent server URL (not the temporary Cloudflare tunnel)
2. Update the `apiUrl` in the widget configuration
3. Host the `chat-widget.js` file on your server

### Step 2: Configure CORS for Web Chat
The server uses secure CORS configuration to control which websites can use the chat widget.

**Set the `ALLOWED_ORIGIN` environment variable in your `.env` file:**

```bash
# Single website
ALLOWED_ORIGIN=https://www.yourpractice.com

# Multiple websites (comma-separated)
ALLOWED_ORIGIN=https://www.yourpractice.com,https://staging.yourpractice.com,https://yourpractice.squarespace.com
```

**Important notes:**
- Include the full origin (protocol + domain + port if non-standard)
- No trailing slashes
- Separate multiple origins with commas
- In local development, localhost is automatically allowed (no configuration needed)
- The server will log configured origins on startup

### Step 3: Add to Website
Add the widget code to your website's template or footer so it appears on all pages.

## Example Integration

For WordPress, Squarespace, or other CMS platforms:
1. Go to your theme's footer settings
2. Add the widget code to the "Custom HTML" or "Footer Scripts" section
3. Save and publish

## Testing

1. **Local Testing**: Visit http://localhost:3000/widget-example.html
2. **Production Testing**: After deployment, visit your website and click the chat button
3. **Mobile Testing**: Test on mobile devices to ensure responsive behavior

## Troubleshooting

**Widget doesn't appear:**
- Check browser console for errors
- Verify the script URL is correct
- Ensure JavaScript is enabled

**Can't connect to server:**
- Verify `apiUrl` is correct
- Check CORS settings if on different domain
- Ensure server is running

**Styling conflicts:**
- The widget uses inline styles to avoid conflicts
- All widget elements are prefixed with `rtc-chat-`

## Support

For issues or questions, contact your development team or refer to the main README.md file.
