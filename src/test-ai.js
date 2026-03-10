// Test script for AI client
const aiClient = require('./ai-client');

async function testAI() {
  console.log('🧪 Testing AI Client...\n');
  
  const sessionId = 'test-session-' + Date.now();
  
  try {
    // Initialize session
    aiClient.initSession(sessionId);
    
    // Test conversation
    const response1 = await aiClient.sendMessage(sessionId, 'Hi, I need an EV charger installed.');
    console.log('\n---\n');
    
    const response2 = await aiClient.sendMessage(sessionId, 'What types of chargers do you install?');
    console.log('\n---\n');
    
    const response3 = await aiClient.sendMessage(sessionId, 'Do you accept insurance?');
    console.log('\n---\n');
    
    // Clean up
    aiClient.endSession(sessionId);
    
    console.log('✅ AI Client test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testAI();
