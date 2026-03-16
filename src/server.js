// AI Phone Receptionist - Main Server
// This is the minimal demo version to prove the pipeline works

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const WebSocket = require('ws');
const http = require('http');
const https = require('https');
const fs = require('fs');
const config = require('./config');
const callHandler = require('./call-handler');
const prompts = require('./prompts');
const aiClient = require('./ai-client');
const providerLoader = require('./provider-loader');
const availabilityLoader = require('./availability-loader');
const errorBuffer = require('./error-buffer');
const { createProviderAdapter } = require('./realtime/provider-factory');
const SessionManager = require('./realtime/session-manager');
const RelayService = require('./realtime/relay-service');
const { createAuthMiddleware, createLoginRouter } = require('./admin-auth');
const { setupConsoleTimestamps } = require('./time-utils');
const emailTransport = require('./email-transport');
const cron = require('node-cron');
const { runDailyDigestAgent } = require('./agents/daily-digest-agent');
const path = require('path');

// Setup console logging with Pacific time timestamps
setupConsoleTimestamps();

const app = express();
app.set('trust proxy', true); // Trust X-Forwarded-* headers from reverse proxies/tunnels
const sessionManager = new SessionManager();

// Create HTTPS server if SSL certs are configured, otherwise fall back to HTTP
let server;
let useSSL = false;
if (config.server.sslCert && config.server.sslKey) {
  try {
    const sslOptions = {
      cert: fs.readFileSync(config.server.sslCert),
      key: fs.readFileSync(config.server.sslKey)
    };
    server = https.createServer(sslOptions, app);
    useSSL = true;
    console.log('🔒 SSL certificates loaded — HTTPS enabled');
  } catch (err) {
    console.error('❌ Failed to load SSL certificates:', err.message);
    console.log('⚠️  Falling back to HTTP');
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

// Check if realtime voice streaming is available
const realtimeAvailable = createProviderAdapter(config.realtime.provider, config) !== null;
if (realtimeAvailable) {
  console.log('🎙️ Realtime voice streaming is available');
} else {
  console.log('⚠️ OPENAI_API_KEY not set — real-time voice streaming unavailable, using Gather fallback');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Required for CSRF token validation
app.use(express.static('public'));

// ============================================================================
// CORS Configuration for Web Chat Widget
// ============================================================================
// Restricts cross-origin requests to the configured domain(s) only.
// In local development (no ALLOWED_ORIGIN set), falls back to localhost origins.
// Wildcard CORS is intentionally avoided in production.
//
// ALLOWED_ORIGIN can be:
// - Single origin: ALLOWED_ORIGIN=https://example.com
// - Multiple origins (comma-separated): ALLOWED_ORIGIN=https://example.com,https://www.example.com,https://staging.example.com

const allowedOrigins = process.env.ALLOWED_ORIGIN 
  ? process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim()).filter(origin => origin)
  : [];

const webchatCorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl)
    if (!origin) {
      return callback(null, true);
    }

    // In production: only allow the explicitly configured origins
    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Log the blocked origin server-side, but don't leak it to client
      console.warn(`🚫 CORS blocked request from origin: ${origin}`);
      return callback(new Error('CORS policy: origin not allowed'));
    }

    // In local development (no ALLOWED_ORIGIN set): allow localhost on any port
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // Log the blocked origin server-side, but don't leak it to client
    console.warn(`🚫 CORS blocked request from origin: ${origin}`);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
};

// IP whitelist middleware for admin routes
app.use('/admin', (req, res, next) => {
  const allowedIps = config.server.adminAllowedIps;
  
  // If no IPs configured, allow all (log warning)
  if (allowedIps.length === 0) {
    console.warn('⚠️  Admin panel accessed without IP restrictions');
    return next();
  }
  
  // Get client IP (handles proxies/load balancers)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() 
    || req.headers['x-real-ip'] 
    || req.socket.remoteAddress 
    || req.connection.remoteAddress;
  
  // Check if IP is whitelisted
  if (allowedIps.includes(clientIp)) {
    return next();
  }
  
  console.warn(`🚫 Admin access denied from IP: ${clientIp}`);
  res.status(403).send('Access denied');
});

// Auth middleware for admin routes (after IP whitelist)
app.use('/admin', createAuthMiddleware(config.admin.password, {
  sessionSecret: config.admin.sessionSecret,
  cookieName: 'admin_session',
}));

// Login router for admin authentication
app.use(createLoginRouter(config.admin.password, {
  sessionSecret: config.admin.sessionSecret,
  cookieName: 'admin_session',
}));

// Serve admin static files
app.use('/admin', express.static('public/admin'));

// Health check endpoint
app.get('/', (req, res) => {
  res.send('AI Phone Receptionist is running!');
});

// Chat API endpoint for web interface
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }
    
    // Initialize session if it doesn't exist
    // This will include the website context
    if (!aiClient.conversationHistory.has(sessionId)) {
      aiClient.initSession(sessionId);
    }
    
    // Process message directly with aiClient (not callHandler)
    const response = await aiClient.sendMessage(sessionId, message);
    
    res.json({ response });
    
  } catch (error) {
    console.error('❌ Chat API error:', error);
    errorBuffer.add(error, 'chat-api');
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// ============================================================================
// Public Web Chat Endpoint (stateless — no server-side session storage)
// ============================================================================

// POST /api/webchat
// Accepts the full conversation history from the client on every request.
// Returns the assistant's reply without storing any state server-side.
//
// Request body:
//   {
//     "sessionId": "client-generated-uuid",
//     "messages": [
//       { "role": "user", "content": "Hello" },
//       { "role": "assistant", "content": "Hi! How can I help?" },
//       { "role": "user", "content": "What are your hours?" }
//     ]
//   }
//
// Response:
//   { "reply": "We are open Monday–Friday...", "sessionId": "client-generated-uuid" }
// POST /api/webchat - Stateless chat endpoint for website widget
// Accepts conversation history and returns AI response without server-side storage
// Security: Validates input types, enforces limits, blocks role injection
// CORS: Restricted to ALLOWED_ORIGIN (or localhost in development)
app.options('/api/webchat', cors(webchatCorsOptions)); // Handle preflight OPTIONS requests
app.post('/api/webchat', cors(webchatCorsOptions), async (req, res) => {
  try {
    // Validate request body exists and is an object (not null, string, or array)
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be a JSON object' });
    }

    const { sessionId, messages } = req.body;

    // --- SessionId validation ---
    // Must be non-empty string for client-side session tracking
    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
      return res.status(400).json({ error: 'Missing or invalid sessionId' });
    }

    // DoS protection: Limit sessionId length (1000 chars = ~150 UUIDs)
    if (sessionId.length > 1000) {
      return res.status(400).json({ error: 'sessionId too long (max 1000 characters)' });
    }

    // --- Messages array validation ---
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    // DoS protection: Limit conversation history length
    // 1000 messages = ~500 turns, sufficient for long conversations
    if (messages.length > 1000) {
      return res.status(400).json({ error: 'Too many messages (max 1000)' });
    }

    // --- Individual message validation ---
    // Each message must have string 'role' and 'content' fields
    for (const msg of messages) {
      if (
        typeof msg !== 'object' ||
        msg === null ||
        typeof msg.role !== 'string' ||
        typeof msg.content !== 'string'
      ) {
        return res.status(400).json({
          error: 'Each message must be an object with string "role" and "content" fields'
        });
      }

      // DoS protection: Limit individual message size
      // 50000 chars = ~10000 words, sufficient for detailed responses
      if (msg.content.length > 50000) {
        return res.status(400).json({ error: 'Message content too long (max 50000 characters)' });
      }

      // Security: Only allow 'user' and 'assistant' roles
      // Blocks 'system' (prompt injection), 'function', 'tool' (privilege escalation)
      const allowedRoles = ['user', 'assistant'];
      if (!allowedRoles.includes(msg.role)) {
        return res.status(400).json({
          error: `Invalid message role "${msg.role}". Allowed roles: ${allowedRoles.join(', ')}`
        });
      }
    }

    // --- Call stateless AI method ---
    const reply = await aiClient.sendMessageWithHistory(messages);

    res.json({ response: reply, sessionId: sessionId.trim() });

  } catch (error) {
    console.error('❌ Webchat API error:', error);
    errorBuffer.add(error, 'webchat-api');
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Get greeting endpoint (for chat interface)
app.get('/api/greeting', (req, res) => {
  res.json({ greeting: prompts.webchatGreeting });
});

// Get current model info endpoint
app.get('/api/model-info', (req, res) => {
  res.json({ 
    model: config.openRouter.model,
    provider: 'OpenRouter'
  });
});

// Test endpoint to verify actual model being used
app.post('/api/test-model', async (req, res) => {
  try {
    const testMessage = 'Hello, what model are you?';
    const testSessionId = 'test-' + Date.now();
    
    // Initialize session
    aiClient.initSession(testSessionId);
    
    // Get the conversation history
    const messages = aiClient.conversationHistory.get(testSessionId);
    messages.push({
      role: 'user',
      content: testMessage
    });
    
    // Make direct API call to get full response
    const response = await aiClient.client.chat.completions.create({
      model: config.openRouter.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 150
    });
    
    // Clean up test session
    aiClient.endSession(testSessionId);
    
    // Return full response metadata
    res.json({
      requestedModel: config.openRouter.model,
      actualModel: response.model || 'Not provided in response',
      response: response.choices[0].message.content,
      usage: response.usage,
      fullResponse: response
    });
    
  } catch (error) {
    errorBuffer.add(error, 'test-model-api');
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
});

// Reload prompts endpoint (for live updates)
app.post('/reload-prompts', (req, res) => {
  try {
    prompts.reload();
    res.json({ success: true, message: 'Prompts reloaded successfully!' });
  } catch (error) {
    errorBuffer.add(error, 'reload-prompts');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Admin API Endpoints
// ============================================================================

// Redirect /admin to /admin/index.html
app.get('/admin', (req, res) => {
  res.redirect('/admin/index.html');
});

// Admin status endpoint - returns system status and health info
app.get('/admin/api/status', (req, res) => {
  try {
    const uptime = process.uptime();
    const activeCalls = callHandler.getActiveCallCount ? callHandler.getActiveCallCount() : 0;
    const recentErrors = errorBuffer.getAll().slice(0, 10); // Last 10 errors
    
    // Get prompts count
    let promptCount = 0;
    try {
      promptCount = prompts.getAll().length;
    } catch (err) {
      console.error('Error getting prompts:', err);
    }
    
    // Get availability count
    let availabilityCount = 0;
    try {
      availabilityCount = Object.keys(availabilityLoader.getAll()).length;
    } catch (err) {
      console.error('Error getting availability:', err);
    }
    
    // Get provider count
    let providerCount = 0;
    try {
      providerCount = Object.keys(providerLoader.getAll()).length;
    } catch (err) {
      console.error('Error getting providers:', err);
    }
    
    res.json({
      uptime: Math.round(uptime),
      activeCalls: activeCalls,
      model: config.openRouter.model,
      phoneNumber: config.twilio.phoneNumber,
      recentErrors: recentErrors,
      promptCount: promptCount,
      availabilityCount: availabilityCount,
      providerCount: providerCount
    });
  } catch (error) {
    console.error('❌ Admin status API error:', error);
    errorBuffer.add(error, 'admin-status-api');
    res.status(500).json({ error: 'Failed to retrieve status', details: error.message });
  }
});

// Admin prompts list endpoint
app.get('/admin/api/prompts', (req, res) => {
  try {
    const promptsList = prompts.getAll();
    res.json({ prompts: promptsList });
  } catch (error) {
    errorBuffer.add(error, 'admin-prompts-list-api');
    res.status(500).json({ error: 'Failed to retrieve prompts', details: error.message });
  }
});

// Admin prompt save endpoint
app.put('/admin/api/prompts/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Save prompt (will throw if content is invalid)
    prompts.savePrompt(filename, content);
    
    res.json({ success: true, message: `Prompt ${filename} saved successfully` });
  } catch (error) {
    errorBuffer.add(error, 'admin-prompt-save-api');
    
    // Check if it's a validation error
    if (error.message.includes('empty') || error.message.includes('whitespace')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to save prompt', details: error.message });
  }
});

// Admin call logs list endpoint (with pagination)
app.get('/admin/api/calls', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const callSummaryManager = require('./call-summary');
    const result = callSummaryManager.getSummariesPaginated(page, limit);
    
    res.json(result);
  } catch (error) {
    errorBuffer.add(error, 'admin-calls-list-api');
    res.status(500).json({ error: 'Failed to retrieve call logs', details: error.message });
  }
});

// Admin call log detail endpoint
app.get('/admin/api/calls/:id', (req, res) => {
  try {
    const { id } = req.params;
    const callSummaryManager = require('./call-summary');
    const summary = callSummaryManager.getSummaryById(id);
    
    if (!summary) {
      return res.status(404).json({ error: 'Call log not found' });
    }
    
    res.json(summary);
  } catch (error) {
    errorBuffer.add(error, 'admin-call-detail-api');
    res.status(500).json({ error: 'Failed to retrieve call log', details: error.message });
  }
});

// Admin delete all call logs endpoint
app.delete('/admin/api/calls', (req, res) => {
  try {
    const callSummaryManager = require('./call-summary');
    const deletedCount = callSummaryManager.deleteAllSummaries();

    console.log(`🗑️ All call logs deleted: ${deletedCount} files removed`);
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error('❌ Error deleting all call logs:', error);
    errorBuffer.add(error, 'admin-calls-delete-all-api');
    res.status(500).json({ error: 'Failed to delete call logs', details: error.message });
  }
});

// Admin delete single call log endpoint
app.delete('/admin/api/calls/:id', (req, res) => {
  try {
    const id = path.basename(req.params.id);
    const callSummaryManager = require('./call-summary');
    const deleted = callSummaryManager.deleteSummaryById(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    console.log(`🗑️ Call log deleted: ${id}`);
    res.json({ success: true, message: 'Call log deleted' });
  } catch (error) {
    console.error('❌ Error deleting call log:', error);
    errorBuffer.add(error, 'admin-call-delete-api');
    res.status(500).json({ error: 'Failed to delete call log', details: error.message });
  }
});

// Admin availability list endpoint
app.get('/admin/api/availability', (req, res) => {
  try {
    const filesMap = availabilityLoader.getAll();
    const files = Object.entries(filesMap).map(([filename, content]) => ({
      filename,
      content
    }));
    
    res.json({ files });
  } catch (error) {
    errorBuffer.add(error, 'admin-availability-list-api');
    res.status(500).json({ error: 'Failed to retrieve availability files', details: error.message });
  }
});

// Admin availability save endpoint
app.put('/admin/api/availability/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Ensure filename ends with .md
    const sanitizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Save availability file
    availabilityLoader.saveFile(sanitizedFilename, content);
    
    // Update AI context with new availability data
    const availabilityContext = availabilityLoader.getAIContext();
    aiClient.setAvailabilityContext(availabilityContext);
    
    res.json({ success: true, message: `Availability file ${sanitizedFilename} saved successfully` });
  } catch (error) {
    errorBuffer.add(error, 'admin-availability-save-api');
    res.status(500).json({ error: 'Failed to save availability file', details: error.message });
  }
});

// Admin provider profiles list endpoint
app.get('/admin/api/providers', (req, res) => {
  try {
    const filesMap = providerLoader.getAll();
    const files = Object.entries(filesMap).map(([filename, content]) => ({
      filename,
      content
    }));
    
    res.json({ files });
  } catch (error) {
    errorBuffer.add(error, 'admin-providers-list-api');
    res.status(500).json({ error: 'Failed to retrieve provider files', details: error.message });
  }
});

// Admin provider profile save endpoint
app.put('/admin/api/providers/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Ensure filename ends with .md
    const sanitizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Save provider file
    providerLoader.saveFile(sanitizedFilename, content);
    
    // Update AI context with new provider data
    const providerContext = providerLoader.getAIContext();
    aiClient.setWebsiteContext(providerContext);
    
    res.json({ success: true, message: `Provider file ${sanitizedFilename} saved successfully` });
  } catch (error) {
    errorBuffer.add(error, 'admin-provider-save-api');
    res.status(500).json({ error: 'Failed to save provider file', details: error.message });
  }
});

// Admin refresh providers endpoint - reload from disk
app.post('/admin/api/refresh-providers', (req, res) => {
  try {
    // Reload provider profiles
    providerLoader.reload();
    const providerContext = providerLoader.getAIContext();
    aiClient.setWebsiteContext(providerContext);
    
    res.json({ 
      success: true, 
      message: 'Provider profiles reloaded successfully',
      providerCount: Object.keys(providerLoader.getAll()).length
    });
  } catch (error) {
    errorBuffer.add(error, 'admin-refresh-providers-api');
    res.status(500).json({ error: 'Failed to reload provider profiles', details: error.message });
  }
});

// Admin reload endpoint - reload prompts, availability, and provider profiles
app.post('/admin/api/reload', (req, res) => {
  try {
    // Reload prompts
    prompts.reload();
    
    // Reload availability
    availabilityLoader.reload();
    const availabilityContext = availabilityLoader.getAIContext();
    aiClient.setAvailabilityContext(availabilityContext);
    
    // Reload provider profiles
    providerLoader.reload();
    const websiteContext = providerLoader.getAIContext();
    aiClient.setWebsiteContext(websiteContext);
    
    res.json({ 
      success: true, 
      message: 'Prompts, availability, and provider profiles reloaded successfully',
      promptCount: prompts.getAll().length,
      availabilityCount: Object.keys(availabilityLoader.getAll()).length,
      providerCount: Object.keys(providerLoader.getAll()).length
    });
  } catch (error) {
    errorBuffer.add(error, 'admin-reload-api');
    res.status(500).json({ error: 'Failed to reload data', details: error.message });
  }
});

// ============================================================================
// Twilio Webhook Endpoints
// ============================================================================

// Twilio webhook endpoint - returns TwiML to start conversation
app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const to = req.body.To;
  
  console.log(`📞 Incoming call: ${callSid} from ${from}`);

  if (realtimeAvailable) {
    // Use real-time bidirectional audio streaming via Twilio Media Streams
    const host = req.headers.host;
    // Use wss:// when SSL is enabled or behind a TLS-terminating proxy
    const isSecure = useSSL
      || req.headers['x-forwarded-proto'] === 'https' 
      || req.protocol === 'https'
      || !host.includes('localhost');
    const protocol = isSecure ? 'wss' : 'ws';
    console.log(`🎙️ Routing call ${callSid} to realtime streaming via ${protocol}://${host}/media-stream`);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${protocol}://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
      <Parameter name="from" value="${escapeXml(from)}" />
      <Parameter name="to" value="${escapeXml(to)}" />
    </Stream>
  </Connect>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  } else {
    // Fallback: Gather-based speech recognition (turn-by-turn)
    callHandler.startCall(callSid, { from, to });
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(prompts.greeting)}</Say>
  <Gather input="speech" action="/handle-speech" timeout="5" speechTimeout="auto">
  </Gather>
  <Say voice="Polly.Joanna">I didn't hear anything. Goodbye!</Say>
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
  }
});

// Call status callback - triggered when call ends
app.post('/call-status', async (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  
  console.log(`📊 Call status update: ${callSid} - ${callStatus}`);
  
  if (callStatus === 'completed') {
    // End call and save summary
    await callHandler.endCall(callSid);
  }
  
  res.sendStatus(200);
});

// View all call summaries
app.get('/call-summaries', (req, res) => {
  const callSummaryManager = require('./call-summary');
  const summaries = callSummaryManager.getAllSummaries();
  
  // Return as HTML for easy viewing
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Call Summaries - RTC</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 20px auto; padding: 20px; }
    h1 { color: #667eea; }
    .call { border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
    .call-header { background: #f5f5f5; padding: 10px; margin: -15px -15px 15px -15px; border-radius: 8px 8px 0 0; }
    .call-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px; }
    .info-item { padding: 8px; background: #f9f9f9; border-radius: 4px; }
    .info-label { font-weight: bold; color: #666; font-size: 12px; }
    .summary { background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
    .transcript { background: #f8f9fa; padding: 10px; border-radius: 4px; }
    .message { margin-bottom: 10px; padding: 8px; border-left: 3px solid #667eea; }
    .caller { border-left-color: #28a745; }
  </style>
</head>
<body>
  <h1>📞 Call Summaries</h1>
  <p>Total calls: ${summaries.length}</p>
  ${summaries.map(call => `
    <div class="call">
      <div class="call-header">
        <strong>Call ID:</strong> ${call.callSid}
      </div>
      <div class="call-info">
        <div class="info-item">
          <div class="info-label">Caller Phone</div>
          <div>${call.callerPhone}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Twilio Number</div>
          <div>${call.twilioNumber}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Start Time</div>
          <div>${new Date(call.startTime).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Duration</div>
          <div>${call.duration}</div>
        </div>
      </div>
      <div class="summary">
        <strong>📝 Summary:</strong><br>
        ${call.summary}
      </div>
      <details>
        <summary><strong>Full Transcript</strong></summary>
        <div class="transcript">
          ${call.fullTranscript.map(msg => `
            <div class="message ${msg.speaker === 'Caller' ? 'caller' : ''}">
              <strong>${msg.speaker}:</strong> ${msg.message}
            </div>
          `).join('')}
        </div>
      </details>
    </div>
  `).join('')}
</body>
</html>
  `;
  
  res.send(html);
});

// Handle speech input from caller
app.post('/handle-speech', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  const callSid = req.body.CallSid;
  
  console.log(`💬 Caller said: "${speechResult}"`);
  
  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(prompts.noSpeechDetected)}</Say>
  <Gather input="speech" action="/handle-speech" timeout="5" speechTimeout="auto">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
  <Hangup/>
</Response>`;
    res.type('text/xml');
    res.send(twiml);
    return;
  }
  
  try {
    // Process with AI
    const aiResponse = await callHandler.processText(callSid, speechResult);
    
    // Return AI response and continue listening
    // Don't add follow-up prompt - let the AI's natural response flow
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(aiResponse)}</Say>
  <Gather input="speech" action="/handle-speech" timeout="5" speechTimeout="auto">
  </Gather>
  <Say voice="Polly.Joanna">${escapeXml(prompts.closing)}</Say>
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.send(twiml);
    
  } catch (error) {
    console.error('❌ Error handling speech:', error);
    errorBuffer.add(error, 'handle-speech');
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(prompts.error)}</Say>
  <Hangup/>
</Response>`;
    
    res.type('text/xml');
    res.send(twiml);
  }
});

// Helper function to escape XML special characters
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// WebSocket server for Twilio Media Streams (for future real-time implementation)
const wss = new WebSocket.Server({ server, path: '/media-stream' });

wss.on('connection', (ws) => {
  console.log('🔌 Media stream WebSocket connected');
  let relay = null;

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          const callSid = data.start.customParameters?.callSid || data.start.callSid;
          const streamSid = data.start.streamSid;
          const callerPhone = data.start.customParameters?.from || 'unknown';
          const twilioNumber = data.start.customParameters?.to || 'unknown';
          
          console.log(`🎬 Media stream started: ${streamSid} for call ${callSid} from ${callerPhone}`);
          
          const adapter = createProviderAdapter(config.realtime.provider, config);
          if (!adapter) {
            console.error('❌ Failed to create provider adapter');
            ws.close();
            return;
          }
          
          relay = new RelayService(ws, adapter, callSid, streamSid, {
            from: callerPhone,
            to: twilioNumber
          });
          relay.sessionManager = sessionManager;
          sessionManager.addSession(streamSid, relay);
          
          await relay.initialize({
            systemPrompt: prompts.systemPrompt,
            websiteContext: providerLoader.getAIContext(),
            availabilityContext: availabilityLoader.getAIContext(),
            greeting: prompts.greeting,
            callerPhone: callerPhone
          });
          break;

        case 'media':
          if (relay) relay.handleTwilioMedia(data.media.payload);
          break;

        case 'stop':
          console.log('🛑 Media stream stopped');
          if (relay) await relay.cleanup();
          break;
      }
    } catch (error) {
      console.error('❌ Error processing WebSocket message:', error);
      errorBuffer.add(error, 'websocket-message');
    }
  });

  ws.on('close', async () => {
    console.log('🔌 Media stream WebSocket closed');
    if (relay) await relay.cleanup();
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    errorBuffer.add(error, 'websocket-connection');
    if (relay) relay.cleanup();
  });
});

// ============================================================================
// Notification System Initialization
// ============================================================================
function initializeNotificationSystem() {
  // --- SMTP transport (lazy — only validates config, no TLS connection yet) ---
  emailTransport.initialize();

  // --- Verify post-call agent prompt exists ---
  const promptPath = path.join(__dirname, '..', 'prompts', 'post-call-agent.txt');
  if (fs.existsSync(promptPath)) {
    console.log('📋 Post-call agent prompt loaded');
  } else {
    console.warn('⚠️ Post-call agent prompt not found at prompts/post-call-agent.txt');
  }

  // --- Daily digest cron job (configurable hour, Mon-Fri) ---
  if (config.digestEnabled && config.adminEmail) {
    const hour = config.digestScheduleHour;
    cron.schedule(`0 ${hour} * * 1-5`, async () => {
      console.log('⏰ Running daily digest agent...');
      try {
        await runDailyDigestAgent();
        console.log('✅ Daily digest completed');
      } catch (err) {
        console.error('❌ Daily digest failed:', err.message);
        errorBuffer.add(err, 'daily-digest-cron');
      }
    }, { timezone: 'America/Los_Angeles' });
    console.log(`📅 Daily digest scheduled (${hour}:00 Pacific, Mon-Fri) → ${config.adminEmail}`);
  } else if (!config.digestEnabled) {
    console.log('ℹ️ Daily digest disabled (DIGEST_ENABLED is not true)');
  } else {
    console.log('ℹ️ Daily digest not configured (no ADMIN_EMAIL set)');
  }
}

// Start server
const PORT = config.server.port;

// Load provider profiles and availability before starting server
(async () => {
  try {
    // Load provider profiles
    providerLoader.loadAll();
    const providerContext = providerLoader.getAIContext();
    aiClient.setWebsiteContext(providerContext);
    
    // Load availability files
    availabilityLoader.loadAll();
    const availabilityContext = availabilityLoader.getAIContext();
    aiClient.setAvailabilityContext(availabilityContext);
    
    server.listen(PORT, () => {
      const scheme = useSSL ? 'https' : 'http';
      const wsScheme = useSSL ? 'wss' : 'ws';
      
      // Use PUBLIC_URL from env if set, otherwise show localhost
      const publicUrl = process.env.PUBLIC_URL || `${scheme}://localhost:${PORT}`;
      const baseUrl = publicUrl.replace(/\/$/, ''); // Remove trailing slash if present
      
      console.log(`🚀 Server running on port ${PORT} (${useSSL ? 'HTTPS' : 'HTTP'})`);
      console.log(`📞 Webhook URL: ${baseUrl}/incoming-call`);
      console.log(`🔌 WebSocket URL: ${baseUrl.replace(/^http/, 'ws')}/media-stream`);
      console.log(`\n✅ Configuration loaded:`);
      console.log(`   - Twilio Account: ${config.twilio.accountSid.substring(0, 10)}...`);
      console.log(`   - OpenRouter Model: ${config.openRouter.model}`);
      console.log(`   - Provider Profiles: ${Object.keys(providerLoader.getAll()).length} loaded`);
      if (allowedOrigins.length > 0) {
        console.log(`   - Web Chat CORS Origins: ${allowedOrigins.join(', ')}`);
      } else {
        console.log(`   - Web Chat CORS Origins: localhost only (set ALLOWED_ORIGIN for production)`);
      }
      console.log(`\n🔐 Admin Panel Security:`);
      if (config.admin.password) {
        console.log(`   - Authentication: ENABLED (password set, ${config.admin.password.length} chars)`);
        console.log(`   - Session Secret: ${config.admin.sessionSecret ? 'Set' : 'Using password as secret'}`);
      } else {
        console.log(`   - Authentication: DISABLED (no password set - admin panel is unprotected!)`);
      }
      if (config.server.adminAllowedIps.length > 0) {
        console.log(`   - IP Whitelist: ${config.server.adminAllowedIps.join(', ')}`);
      } else {
        console.log(`   - IP Whitelist: None (all IPs allowed)`);
      }
      if (!useSSL) {
        console.log(`\n⚠️  Running without SSL — Twilio Media Streams requires HTTPS/WSS`);
        console.log(`   Set SSL_CERT_PATH and SSL_KEY_PATH in .env for production`);
      }
      if (!process.env.PUBLIC_URL) {
        console.log(`\n💡 Tip: Set PUBLIC_URL in .env to show your actual webhook URL`);
      }

      // Initialize notification system (non-blocking)
      initializeNotificationSystem();
    });
  } catch (error) {
    console.error('❌ Failed to initialize server:', error.message);
    errorBuffer.add(error, 'server-startup');
    console.log('⚠️  Starting server with limited functionality...');
    
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} (with errors during startup)`);
    });
  }
})();
