// Post-Call Agent — runs after each call ends
// Reads prompt from disk, uses Vercel AI SDK to generate summary and notify providers
// Uses manual tool loop because OpenRouter + AI SDK maxSteps doesn't reliably
// continue after tool calls.
const fs = require('fs');
const path = require('path');
const { generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const config = require('../config');
const { createTools } = require('./tools');
const { getFilenameSafeTimestamp } = require('../time-utils');

// Resolve prompt path at call time: data/prompts/ (user override) takes priority over prompts/ (repo default)
const DATA_PROMPT_PATH = path.join(__dirname, '..', '..', 'data', 'prompts', 'post-call-agent.txt');
const DEFAULT_PROMPT_PATH = path.join(__dirname, '..', '..', 'prompts', 'post-call-agent.txt');
function resolvePromptPath() {
  return fs.existsSync(DATA_PROMPT_PATH) ? DATA_PROMPT_PATH : DEFAULT_PROMPT_PATH;
}
const LOGS_DIR = path.join(__dirname, '..', '..', 'runtime', 'agent-logs');
const MAX_ITERATIONS = 10;

function ensureLogsDir() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function saveAgentLog(callSid, logData) {
  try {
    ensureLogsDir();
    const timestamp = getFilenameSafeTimestamp();
    const shortSid = callSid ? callSid.substring(0, 8) : 'unknown';
    const filename = `agent-${timestamp}-${shortSid}.json`;
    const filepath = path.join(LOGS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
    console.log(`🔍 Agent debug log saved: ${filename}`);
  } catch (err) {
    console.error('⚠️ Failed to save agent log:', err.message);
  }
}

async function runPostCallAgent(callData) {
  let promptInstructions;
  try {
    promptInstructions = fs.readFileSync(resolvePromptPath(), 'utf-8').trim();
  } catch (err) {
    console.error('❌ Failed to read post-call agent prompt:', err.message);
    throw err;
  }

  // Inject config values into prompt template
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  promptInstructions = promptInstructions.replace('{{ADMIN_EMAIL}}', adminEmail);

  const openai = createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: config.openRouter.apiKey,
  });

  const tools = createTools();
  // Use .chat() to force Chat Completions API — OpenRouter doesn't support the Responses API
  // which is the default in @ai-sdk/openai v3+ / AI SDK 5+
  const model = openai.chat(config.openRouter.model);

  const userMessage = `Call has ended. Here is the call data:

Call SID: ${callData.callSid}
Caller Phone: ${callData.from}
Twilio Number: ${callData.to}
Start Time: ${callData.startTime}
End Time: ${callData.endTime}

Conversation Transcript:
${callData.conversationHistory.map(m =>
    `${m.role === 'user' ? 'Caller' : 'AI Receptionist'}: ${m.content}`
  ).join('\n')}`;

  // Manual tool loop — OpenRouter doesn't reliably support maxSteps > 1
  const messages = [
    { role: 'system', content: promptInstructions },
    { role: 'user', content: userMessage }
  ];

  const startTime = Date.now();
  const logSteps = [];
  let iteration = 0;
  let lastResult = null;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`🤖 Agent iteration ${iteration}...`);

    const result = await generateText({
      model,
      messages,
      tools,
      maxSteps: 1,
    });

    const stepLog = { iteration };
    const toolCalls = result.toolCalls || [];
    const toolResults = result.toolResults || [];

    if (toolCalls.length > 0) {
      stepLog.toolCalls = toolCalls.map(tc => ({ tool: tc.toolName, args: tc.args }));
      stepLog.toolResults = toolResults.map(tr => ({
        tool: tr.toolName,
        result: typeof tr.result === 'string' ? tr.result : String(JSON.stringify(tr.result) || '').substring(0, 500)
      }));
      console.log(`   Iteration ${iteration}: called ${toolCalls.map(tc => tc.toolName).join(', ')}`);

      // Append the SDK-formatted response messages (assistant + tool results)
      // Strip providerOptions/providerMetadata that OpenRouter doesn't understand
      if (result.response && result.response.messages) {
        for (const msg of result.response.messages) {
          const clean = { role: msg.role };
          if (Array.isArray(msg.content)) {
            clean.content = msg.content.map(part => {
              const { providerOptions, providerMetadata, ...rest } = part;
              return rest;
            });
          } else {
            clean.content = msg.content;
          }
          messages.push(clean);
        }
      }
    }

    if (result.text) {
      stepLog.text = result.text;
    }
    stepLog.finishReason = result.finishReason;
    stepLog.usage = result.usage || null;
    logSteps.push(stepLog);

    lastResult = result;

    // If the model finished without requesting more tool calls, we're done
    if (result.finishReason === 'stop' || result.finishReason === 'end-turn' || toolCalls.length === 0) {
      console.log(`   Iteration ${iteration}: done (${result.finishReason})`);
      break;
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`🤖 Agent completed: ${iteration} iterations in ${elapsed}ms`);

  // Save debug log
  const logData = {
    callSid: callData.callSid,
    callerPhone: callData.from,
    timestamp: new Date().toISOString(),
    model: config.openRouter.model,
    elapsedMs: elapsed,
    totalIterations: iteration,
    steps: logSteps
  };
  saveAgentLog(callData.callSid, logData);

  return lastResult;
}

module.exports = { runPostCallAgent };
