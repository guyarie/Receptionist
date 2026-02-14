// Interactive chat test - talk to the AI directly without Twilio
const readline = require('readline');
const aiClient = require('./ai-client');
const WebsiteScraper = require('./website-scraper');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let sessionId = 'test-session-' + Date.now();

async function main() {
  console.log('🤖 AI Receptionist Test Chat');
  console.log('=' .repeat(50));
  console.log('Loading website data...\n');
  
  // Load website data
  const scraper = new WebsiteScraper('https://www.rtcbellevue.com/');
  try {
    await scraper.scrape();
    const websiteContext = scraper.getAIContext();
    aiClient.setWebsiteContext(websiteContext);
    console.log('✅ Website data loaded\n');
  } catch (error) {
    console.log('⚠️  Using cached website data\n');
  }
  
  // Initialize AI session
  aiClient.initSession(sessionId);
  
  console.log('Type your messages below. Type "exit" to quit.\n');
  console.log('Try asking:');
  console.log('  - "What types of therapy do you offer?"');
  console.log('  - "Do you have Spanish-speaking therapists?"');
  console.log('  - "Who specializes in trauma?"');
  console.log('  - "Can you help with child anxiety?"\n');
  console.log('=' .repeat(50));
  console.log('');
  
  // Start conversation loop
  askQuestion();
}

function askQuestion() {
  rl.question('You: ', async (input) => {
    const message = input.trim();
    
    if (message.toLowerCase() === 'exit') {
      console.log('\n👋 Goodbye!');
      aiClient.endSession(sessionId);
      rl.close();
      process.exit(0);
      return;
    }
    
    if (!message) {
      askQuestion();
      return;
    }
    
    try {
      const response = await aiClient.sendMessage(sessionId, message);
      console.log(`\n🤖 AI: ${response}\n`);
    } catch (error) {
      console.error(`\n❌ Error: ${error.message}\n`);
    }
    
    askQuestion();
  });
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Goodbye!');
  aiClient.endSession(sessionId);
  rl.close();
  process.exit(0);
});

main();
