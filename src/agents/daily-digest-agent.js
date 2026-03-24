// Daily Digest Agent — runs on a cron schedule to send daily call digest
// Reads prompt from disk, uses Vercel AI SDK to compose and send digest email
const fs = require('fs');
const path = require('path');
const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const config = require('../config');
const { createTools } = require('./tools');

// Resolve prompt path at call time: data/prompts/ (user override) takes priority over prompts/ (repo default)
const DATA_PROMPT_PATH = path.join(__dirname, '..', '..', 'data', 'prompts', 'daily-digest-agent.txt');
const DEFAULT_PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', 'daily-digest-agent.txt');
function resolvePromptPath() {
  return fs.existsSync(DATA_PROMPT_PATH) ? DATA_PROMPT_PATH : DEFAULT_PROMPT_PATH;
}

async function runDailyDigestAgent(adminEmail) {
  // Read prompt from disk on each invocation (no caching)
  let promptInstructions;
  try {
    promptInstructions = fs.readFileSync(resolvePromptPath(), 'utf-8').trim();
  } catch (err) {
    console.error('❌ Failed to read daily digest agent prompt:', err.message);
    throw err;
  }

  const openai = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouter.apiKey,
  });

  const tools = createTools();

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const userMessage = `It is now time to generate the daily digest.
Today's date: ${today}
Admin email: ${adminEmail}

Please read today's call summaries, review them, and compose a digest email to send to the admin.`;

  const result = await generateText({
    model: openai(config.openRouter.model),
    system: promptInstructions,
    prompt: userMessage,
    tools,
    maxSteps: 10,
  });

  return result;
}

module.exports = { runDailyDigestAgent };
