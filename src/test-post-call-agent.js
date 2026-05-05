// Quick post-call agent test — run with: INSTALL_DIR=installs/dave node src/test-post-call-agent.js
// Loads the install's config, runs the real agent against a sample AC installation call,
// and prints a full trace including tool calls and any errors.

const path = require('path');

if (!process.env.INSTALL_DIR) {
  console.error('Usage: INSTALL_DIR=installs/dave node src/test-post-call-agent.js');
  process.exit(1);
}

// Config must be loaded before other modules that depend on paths.js / dotenv
const config = require('./config');
const emailTransport = require('./email-transport');
const { runPostCallAgent } = require('./agents/post-call-agent');

emailTransport.initialize();

const SAMPLE_CALL = {
  callSid: 'CAtest00000000000000000000000000000',
  from: '+15550000001',
  to: process.env.TWILIO_PHONE_NUMBER || '+15550000000',
  startTime: new Date(Date.now() - 90_000).toISOString(),
  endTime: new Date().toISOString(),
  conversationHistory: [
    { role: 'assistant', content: 'Hello, thank you for calling. How can I help you today?' },
    { role: 'user',      content: 'Hi, I want to get a quote for a new AC installation at my house.' },
    { role: 'assistant', content: 'Great! We can definitely help with that. May I get your name and the best number to reach you?' },
    { role: 'user',      content: 'Sure, my name is Test User, phone is 555-123-4567.' },
    { role: 'assistant', content: 'Perfect. And what city or address is the installation for?' },
    { role: 'user',      content: '123 Main Street, Seattle, WA.' },
    { role: 'assistant', content: 'Thank you! Someone from our team will follow up with you shortly for a quote. Have a great day!' },
    { role: 'user',      content: 'Thanks, bye.' },
  ],
};

console.log('='.repeat(60));
console.log('Post-Call Agent Test');
console.log('='.repeat(60));
console.log('Install:       ', process.env.INSTALL_DIR);
console.log('Admin email:   ', process.env.ADMIN_EMAIL || '(not set)');
console.log('Email ready:   ', emailTransport.isConfigured());
console.log('Model:         ', process.env.POST_CALL_AGENT_MODEL || config.openRouter?.model || '(default)');
console.log('='.repeat(60));
console.log();

async function main() {
  try {
    const result = await runPostCallAgent(SAMPLE_CALL);

    console.log();
    console.log('--- Agent finished ---');
    console.log('Finish reason:', result?.finishReason);

    const toolCalls = result?.toolCalls || [];
    if (toolCalls.length > 0) {
      console.log('Tools called:  ', toolCalls.map(tc => tc.toolName).join(', '));
    } else {
      console.log('Tools called:   (none detected in result)');
    }

    if (result?.text) {
      console.log('\nAgent final text:\n', result.text);
    }

    console.log('\n✅ Agent completed without throwing.');
  } catch (err) {
    console.error('\n❌ Agent threw an error:');
    console.error('  message:', err.message);
    if (err.cause) console.error('  cause:  ', err.cause?.message || err.cause);
    if (err.responseBody) console.error('  body:   ', err.responseBody);
    console.error('\nFull error:');
    console.error(err);
    process.exit(1);
  }
}

main();
