// AI Phone Receptionist - Main Server
// This is the minimal demo version to prove the pipeline works

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
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

const app = express();
const sessionManager = new SessionManager();
const server = http.createServer(app);

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
app.use(express.static('public'));

// Serve admin static files
app.use('/admin', express.static('public/admin'));

// CORS middleware for widget (allows embedding on external websites)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // In production, replace * with your website domain
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  next();
});

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

// Get greeting endpoint (for chat interface)
app.get('/api/greeting', (req, res) => {
  res.json({ greeting: prompts.greeting });
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
    console.log(`🎙️ Routing call ${callSid} to realtime streaming via wss://${host}/media-stream`);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream">
      <Parameter name="callSid" value="${callSid}" />
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
          <div>${new Date(call.startTime).toLocaleString()}</div>
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
          console.log(`🎬 Media stream started: ${streamSid} for call ${callSid}`);
          
          const adapter = createProviderAdapter(config.realtime.provider, config);
          if (!adapter) {
            console.error('❌ Failed to create provider adapter');
            ws.close();
            return;
          }
          
          relay = new RelayService(ws, adapter, callSid, streamSid, {
            from: data.start.customParameters?.from || 'unknown',
            to: data.start.customParameters?.to || 'unknown'
          });
          relay.sessionManager = sessionManager;
          sessionManager.addSession(streamSid, relay);
          
          await relay.initialize({
            systemPrompt: prompts.systemPrompt,
            websiteContext: providerLoader.getAIContext(),
            availabilityContext: availabilityLoader.getAIContext(),
            greeting: prompts.greeting
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
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📞 Webhook URL: http://localhost:${PORT}/incoming-call`);
      console.log(`🔌 WebSocket URL: ws://localhost:${PORT}/media-stream`);
      console.log(`\n✅ Configuration loaded:`);
      console.log(`   - Twilio Account: ${config.twilio.accountSid.substring(0, 10)}...`);
      console.log(`   - OpenRouter Model: ${config.openRouter.model}`);
      console.log(`   - Provider Profiles: ${Object.keys(providerLoader.getAll()).length} loaded`);
      console.log(`\n📝 Next steps:`);
      console.log(`   1. Fill in your .env file with credentials`);
      console.log(`   2. Run: cloudflared tunnel --url http://localhost:${PORT}`);
      console.log(`   3. Configure Twilio webhook with the tunnel URL`);
      console.log(`   4. Call your Twilio number to test!`);
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
