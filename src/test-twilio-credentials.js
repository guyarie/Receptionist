// Quick Twilio credentials test — run with: INSTALL_DIR=installs/dave node src/test-twilio-credentials.js
// Uses the same validate_twilio tool the setup agent calls.

if (!process.env.INSTALL_DIR) {
  console.error('Usage: INSTALL_DIR=installs/dave node src/test-twilio-credentials.js');
  process.exit(1);
}

require('./config');

const { createSetupTools } = require('./agents/setup-tools');

const tools = createSetupTools(() => {});

console.log('='.repeat(60));
console.log('Twilio Credentials Test');
console.log('='.repeat(60));
console.log('Install:      ', process.env.INSTALL_DIR);
console.log('Account SID:  ', process.env.TWILIO_ACCOUNT_SID || '(not set)');
console.log('Auth Token:   ', process.env.TWILIO_AUTH_TOKEN ? '***' + process.env.TWILIO_AUTH_TOKEN.slice(-4) : '(not set)');
console.log('Phone Number: ', process.env.TWILIO_PHONE_NUMBER || '(not set)');
console.log('='.repeat(60));
console.log();

tools.validate_twilio.execute({}).then(result => {
  console.log(result);
}).catch(err => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
