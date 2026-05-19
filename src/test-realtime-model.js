// Test whether a given realtime model is accessible with the configured OpenAI key.
// Run with: INSTALL_DIR=installs/dave node src/test-realtime-model.js [model]
// Defaults to gpt-realtime-2 if no model is specified.

if (!process.env.INSTALL_DIR) {
  console.error('Usage: INSTALL_DIR=installs/dave node src/test-realtime-model.js [model]');
  process.exit(1);
}

require('./config');
const WebSocket = require('ws');

const model = process.argv[2] || 'gpt-realtime-2';
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY is not set in this install.');
  process.exit(1);
}

console.log('='.repeat(60));
console.log('Realtime Model Access Test');
console.log('='.repeat(60));
console.log('Install:', process.env.INSTALL_DIR);
console.log('Model:  ', model);
console.log('='.repeat(60));
console.log();
console.log('Connecting...');

const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
  }
});

const timeout = setTimeout(() => {
  console.error('❌ Timed out waiting for response (10s)');
  ws.terminate();
  process.exit(1);
}, 10000);

ws.on('open', () => {
  console.log('WebSocket opened — waiting for server response...');
});

ws.on('message', (data) => {
  clearTimeout(timeout);
  const event = JSON.parse(data.toString());
  if (event.type === 'session.created') {
    console.log(`✅ Access confirmed — session created`);
    console.log(`   Model:   ${event.session?.model}`);
    console.log(`   Session: ${event.session?.id}`);
  } else if (event.type === 'error') {
    console.error(`❌ Access denied: ${event.error?.message}`);
    console.error(`   Code: ${event.error?.code}`);
  } else {
    console.log(`Received event: ${event.type}`);
  }
  ws.close();
});

ws.on('error', (err) => {
  clearTimeout(timeout);
  console.error('❌ Connection error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  process.exit(0);
});
