// Quick SMTP test script — run with: node src/test-email.js
// Loads .env, initializes email transport, and sends a test email
require('dotenv').config();

const emailTransport = require('./email-transport');

async function main() {
  console.log('SMTP config:');
  console.log('  SMTP_HOST:', process.env.SMTP_HOST);
  console.log('  SMTP_PORT:', process.env.SMTP_PORT);
  console.log('  SMTP_USER:', process.env.SMTP_USER);
  console.log('  SMTP_PASS:', process.env.SMTP_PASS ? '***set***' : '***MISSING***');
  console.log('  SMTP_FROM:', process.env.SMTP_FROM);
  console.log();

  emailTransport.initialize();
  console.log('isConfigured:', emailTransport.isConfigured());
  console.log();

  if (!emailTransport.isConfigured()) {
    console.error('Email transport not configured — check SMTP env vars above');
    process.exit(1);
  }

  const to = process.argv[2] || process.env.SMTP_FROM;
  console.log(`Sending test email to: ${to}`);

  try {
    const result = await emailTransport.sendMail({
      to,
      subject: 'Receptionist — SMTP Test',
      body: 'If you received this, SMTP is working correctly.'
    });
    console.log('✅ Email sent successfully!');
    console.log('   messageId:', result.messageId);
    console.log('   response:', result.response);
  } catch (err) {
    console.error('❌ Email failed:', err.message);
    console.error('   Full error:', err);
  }
}

main();
