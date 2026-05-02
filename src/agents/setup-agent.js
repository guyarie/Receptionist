// Setup Agent
// Conversational agent that guides users through configuring the receptionist system.
// Sessions are stored in memory — each browser tab gets its own conversation.
// Uses the same manual tool loop pattern as post-call-agent.js since OpenRouter
// doesn't reliably support maxSteps > 1 with the Vercel AI SDK.

const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const fs = require('fs');
const path = require('path');
const { createSetupTools } = require('./setup-tools');

const PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', 'setup-agent.txt');
const MAX_ITERATIONS = 20;

// In-memory sessions: sessionId -> messages[]
const sessions = new Map();

function getSystemPrompt() {
  return fs.readFileSync(PROMPT_PATH, 'utf-8').trim();
}

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, [
      { role: 'system', content: getSystemPrompt() },
    ]);
  }
  return sessions.get(sessionId);
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Run one turn of the setup agent conversation.
 *
 * @param {string} sessionId  - Identifies the browser session
 * @param {string} userMessage - The user's latest message
 * @param {function} onEvent  - Callback: onEvent(type, data) pushes SSE events to the client
 * @returns {Promise<string>} - The agent's final text response for this turn
 */
async function runSetupTurn(sessionId, userMessage, onEvent) {
  // Lazy-load the API key — it may have just been saved to .env during this session
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Please enter it using the form above to continue.'
    );
  }

  const openai = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey,
  });
  const model = openai.chat(process.env.SETUP_AGENT_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o');

  const messages = getOrCreateSession(sessionId);
  messages.push({ role: 'user', content: userMessage });

  const tools = createSetupTools(onEvent);
  let iteration = 0;

  console.log(`🛠️  [setup:${sessionId.slice(0, 8)}] User: ${userMessage.slice(0, 80)}${userMessage.length > 80 ? '…' : ''}`);

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const result = await generateText({
      model,
      messages,
      tools,
      maxSteps: 1,
    });

    const toolCalls = result.toolCalls || [];

    if (toolCalls.length > 0) {
      console.log(`🛠️  [setup:${sessionId.slice(0, 8)}] Iteration ${iteration}: called ${toolCalls.map(tc => tc.toolName).join(', ')}`);
      // Append tool call + results into the message history for the next iteration.
      // Strip providerOptions/providerMetadata that OpenRouter doesn't understand.
      if (result.response && result.response.messages) {
        for (const msg of result.response.messages) {
          const clean = { role: msg.role };
          if (Array.isArray(msg.content)) {
            clean.content = msg.content.map(({ providerOptions, providerMetadata, ...rest }) => rest);
          } else {
            clean.content = msg.content;
          }
          messages.push(clean);
        }
      }
    }

    // Done when the model produces a final text response without further tool calls
    if (result.finishReason === 'stop' || result.finishReason === 'end-turn' || toolCalls.length === 0) {
      const text = result.text || '';
      if (text) {
        messages.push({ role: 'assistant', content: text });
      }
      console.log(`🛠️  [setup:${sessionId.slice(0, 8)}] Done in ${iteration} iteration(s)`);
      return text;
    }
  }

  console.log(`🛠️  [setup:${sessionId.slice(0, 8)}] Hit max iterations (${MAX_ITERATIONS})`);
  return 'I reached the maximum number of steps. Please send another message to continue.';
}

module.exports = { runSetupTurn, clearSession };
