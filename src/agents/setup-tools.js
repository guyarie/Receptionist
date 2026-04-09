// Setup Agent Tools
// Tools available to the setup agent for configuring the receptionist system.
// All file writes go to data/ (gitignored, deployment-specific).
// Secrets are handled via request_secret — the frontend renders a secure input,
// so sensitive values never pass through the LLM.

const { tool } = require('ai');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const ENV_PATH = path.join(ROOT_DIR, '.env');

const ALLOWED_DIRECTORIES = ['prompts', 'providers', 'availability', 'practice'];

// ============================================================================
// Env file helpers
// ============================================================================

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
  const env = {};
  for (const line of lines) {
    const match = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  }
  return env;
}

function writeEnvValue(key, value) {
  let lines = [];
  if (fs.existsSync(ENV_PATH)) {
    lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
  }

  // Sanitize value: if it contains spaces or special chars, quote it
  const needsQuotes = /[\s#"'\\]/.test(value) && !value.startsWith('"');
  const formattedValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;
  const newLine = `${key}=${formattedValue}`;

  const existingIndex = lines.findIndex(l => l.match(new RegExp(`^${key}=`)));
  if (existingIndex >= 0) {
    lines[existingIndex] = newLine;
  } else {
    // Add after a blank line or at end
    if (lines[lines.length - 1] !== '') lines.push('');
    lines.push(newLine);
  }

  fs.writeFileSync(ENV_PATH, lines.join('\n'));

  // Reload into process.env
  try {
    require('dotenv').config({ path: ENV_PATH, override: true });
  } catch (_) {}
}

// ============================================================================
// HTML → text extraction
// ============================================================================

function extractTextFromHtml(html) {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (text.length > 8000) {
    text = text.substring(0, 8000) + '\n\n[Content truncated — page was very long]';
  }

  return text;
}

// ============================================================================
// Tool result summaries (shown in the UI as activity events)
// ============================================================================

function summarizeToolResult(toolName, result) {
  if (typeof result !== 'string') result = JSON.stringify(result);
  switch (toolName) {
    case 'crawl_url':
      return result.startsWith('Error') ? result : `Fetched page — extracted ${result.length} characters of content`;
    case 'save_context_file':
      return result;
    case 'read_context_file':
      return result.startsWith('Error') ? result : 'File read successfully';
    case 'list_context_files':
      return 'Listed existing configuration files';
    case 'set_config':
      return result;
    case 'request_secret':
      return 'Secret input form shown to user';
    case 'validate_setup':
      return 'Setup validation complete';
    default:
      return result.substring(0, 120);
  }
}

// ============================================================================
// Tool factory
// onEvent(type, data) is called by tools to push events to the SSE stream.
// ============================================================================

function createSetupTools(onEvent) {
  return {
    // ------------------------------------------------------------------
    // crawl_url — fetch and extract readable text from a URL
    // ------------------------------------------------------------------
    crawl_url: tool({
      description: 'Fetch the content of a URL and extract readable text. Use this to learn about the business from their website.',
      parameters: z.object({
        url: z.string().describe('The full URL to fetch, including https://'),
      }),
      execute: async ({ url }) => {
        onEvent('tool_start', { name: 'crawl_url', label: `Reading ${url}` });
        try {
          // Use puppeteer if available, axios as fallback
          let html;
          const scrapingMode = process.env.SCRAPING_MODE || 'puppeteer';

          if (scrapingMode === 'axios') {
            const response = await axios.get(url, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Receptionist-Setup/1.0)' },
              timeout: 15000,
            });
            html = response.data;
          } else {
            try {
              const { launchBrowser, fetchWithBrowser, closeBrowser } = require('../browser-manager');
              const browser = await launchBrowser();
              try {
                html = await fetchWithBrowser(browser, url, { timeout: 15000 });
              } finally {
                await closeBrowser(browser);
              }
            } catch (puppeteerErr) {
              console.warn('Puppeteer failed, falling back to axios:', puppeteerErr.message);
              const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Receptionist-Setup/1.0)' },
                timeout: 15000,
              });
              html = response.data;
            }
          }

          const text = extractTextFromHtml(html);
          const summary = summarizeToolResult('crawl_url', text);
          onEvent('tool_end', { name: 'crawl_url', summary });
          return text;
        } catch (err) {
          const msg = `Error fetching ${url}: ${err.message}`;
          onEvent('tool_end', { name: 'crawl_url', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // save_context_file — write a file to data/
    // ------------------------------------------------------------------
    save_context_file: tool({
      description: 'Save a configuration file for the receptionist. Use this to write prompts, provider profiles, availability schedules, and practice info.',
      parameters: z.object({
        directory: z.enum(['prompts', 'providers', 'availability', 'practice']).describe('The subdirectory within data/ to save the file in'),
        filename: z.string().describe('The filename, e.g. "system-prompt.txt" or "dr-jane-smith.md"'),
        content: z.string().describe('The full content of the file'),
      }),
      execute: async ({ directory, filename, content }) => {
        onEvent('tool_start', { name: 'save_context_file', label: `Saving ${directory}/${filename}` });
        try {
          // Sanitize filename — no path traversal
          const safeName = path.basename(filename);
          const dirPath = path.join(DATA_DIR, directory);
          fs.mkdirSync(dirPath, { recursive: true });
          fs.writeFileSync(path.join(dirPath, safeName), content, 'utf-8');
          const result = `Saved data/${directory}/${safeName}`;
          onEvent('tool_end', { name: 'save_context_file', summary: result });
          return result;
        } catch (err) {
          const msg = `Error saving file: ${err.message}`;
          onEvent('tool_end', { name: 'save_context_file', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // read_context_file — read a file from data/
    // ------------------------------------------------------------------
    read_context_file: tool({
      description: 'Read an existing configuration file from data/. Useful for reviewing what was previously saved.',
      parameters: z.object({
        directory: z.enum(['prompts', 'providers', 'availability', 'practice']).describe('The subdirectory within data/'),
        filename: z.string().describe('The filename to read'),
      }),
      execute: async ({ directory, filename }) => {
        onEvent('tool_start', { name: 'read_context_file', label: `Reading ${directory}/${filename}` });
        try {
          const safeName = path.basename(filename);
          const filePath = path.join(DATA_DIR, directory, safeName);
          if (!fs.existsSync(filePath)) {
            const msg = `File not found: data/${directory}/${safeName}`;
            onEvent('tool_end', { name: 'read_context_file', summary: msg });
            return msg;
          }
          const content = fs.readFileSync(filePath, 'utf-8');
          onEvent('tool_end', { name: 'read_context_file', summary: summarizeToolResult('read_context_file', content) });
          return content;
        } catch (err) {
          const msg = `Error reading file: ${err.message}`;
          onEvent('tool_end', { name: 'read_context_file', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // list_context_files — list all files in data/
    // ------------------------------------------------------------------
    list_context_files: tool({
      description: 'List all configuration files that have been saved. Use this at the start of setup to check the current state.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'list_context_files', label: 'Checking existing configuration' });
        try {
          const result = {};
          for (const dir of ALLOWED_DIRECTORIES) {
            const dirPath = path.join(DATA_DIR, dir);
            result[dir] = fs.existsSync(dirPath)
              ? fs.readdirSync(dirPath).filter(f => !f.startsWith('.'))
              : [];
          }
          onEvent('tool_end', { name: 'list_context_files', summary: summarizeToolResult('list_context_files', '') });
          return JSON.stringify(result, null, 2);
        } catch (err) {
          const msg = `Error listing files: ${err.message}`;
          onEvent('tool_end', { name: 'list_context_files', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // set_config — write a non-sensitive value to .env
    // ------------------------------------------------------------------
    set_config: tool({
      description: 'Write a non-sensitive configuration value to the .env file. Use for business name, timezone, receptionist name, etc. Do NOT use for API keys or passwords — use request_secret for those.',
      parameters: z.object({
        key: z.string().describe('The environment variable name, e.g. BUSINESS_NAME'),
        value: z.string().describe('The value to set'),
      }),
      execute: async ({ key, value }) => {
        onEvent('tool_start', { name: 'set_config', label: `Setting ${key}` });
        // Block secrets from being written via this tool
        const secretKeys = ['API_KEY', 'AUTH_TOKEN', 'PASSWORD', 'SECRET', 'PASS', 'SID'];
        if (secretKeys.some(s => key.toUpperCase().includes(s))) {
          const msg = `${key} looks like a sensitive value — use request_secret instead.`;
          onEvent('tool_end', { name: 'set_config', summary: msg });
          return msg;
        }
        try {
          writeEnvValue(key, value);
          const result = `Set ${key} in configuration`;
          onEvent('tool_end', { name: 'set_config', summary: result });
          return result;
        } catch (err) {
          const msg = `Error writing config: ${err.message}`;
          onEvent('tool_end', { name: 'set_config', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // request_secret — ask the user for a sensitive value via secure form
    // ------------------------------------------------------------------
    request_secret: tool({
      description: 'Ask the user to enter a sensitive value like an API key or password. The frontend will show a secure password input. The value will be saved to .env without passing through the AI. After calling this, end your current response — the conversation will automatically continue once the user submits the value.',
      parameters: z.object({
        key: z.string().describe('The environment variable name, e.g. OPENAI_API_KEY'),
        label: z.string().describe('Human-friendly label shown to the user, e.g. "OpenAI API Key"'),
        description: z.string().describe('Brief explanation shown below the input field, e.g. where to find this value'),
      }),
      execute: async ({ key, label, description }) => {
        // This event is intercepted by the frontend to render a password form.
        // It does NOT block — the agent finishes its turn normally.
        onEvent('secret_request', { key, label, description });
        return `Secret input form for "${label}" (${key}) has been shown to the user. Finish your current message with a brief note about where to find this value, then end your turn. The user will submit it and the conversation will continue automatically.`;
      },
    }),

    // ------------------------------------------------------------------
    // validate_setup — check overall configuration completeness
    // ------------------------------------------------------------------
    validate_setup: tool({
      description: 'Check what has been configured and what is still missing. Use this at the start of setup and at the end to give the user a status summary.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'validate_setup', label: 'Checking setup status' });
        try {
          const env = readEnvFile();

          const required = {
            TWILIO_ACCOUNT_SID: 'Twilio Account SID (phone calls)',
            TWILIO_AUTH_TOKEN: 'Twilio Auth Token (phone calls)',
            TWILIO_PHONE_NUMBER: 'Twilio Phone Number',
            OPENROUTER_API_KEY: 'OpenRouter API Key (AI brain)',
          };

          const optional = {
            OPENAI_API_KEY: 'OpenAI API Key (real-time voice — strongly recommended)',
            ADMIN_PASSWORD: 'Admin panel password',
            ADMIN_EMAIL: 'Admin email (for call notifications)',
            SMTP_HOST: 'Email server (for sending notifications)',
          };

          const configured = [];
          const missing = [];
          const optionalMissing = [];

          const looksReal = (v) => v && v.length > 5 && !v.includes('your_') && !v.includes('example');

          for (const [k, desc] of Object.entries(required)) {
            if (looksReal(env[k])) configured.push(`${k}: ${desc}`);
            else missing.push(`${k}: ${desc}`);
          }

          for (const [k, desc] of Object.entries(optional)) {
            if (!looksReal(env[k])) optionalMissing.push(`${k}: ${desc}`);
          }

          // Check data files
          const dataFiles = {};
          for (const dir of ALLOWED_DIRECTORIES) {
            const dirPath = path.join(DATA_DIR, dir);
            dataFiles[dir] = fs.existsSync(dirPath)
              ? fs.readdirSync(dirPath).filter(f => !f.startsWith('.'))
              : [];
          }

          const hasSystemPrompt = dataFiles.prompts.includes('system-prompt.txt');
          const hasGreeting = dataFiles.prompts.includes('greeting.txt');

          onEvent('tool_end', { name: 'validate_setup', summary: summarizeToolResult('validate_setup', '') });

          return JSON.stringify({
            configured,
            missing,
            optionalMissing,
            dataFiles,
            isReady: missing.length === 0 && hasSystemPrompt,
            notes: {
              hasSystemPrompt,
              hasGreeting,
              providerCount: dataFiles.providers.length,
              hasAvailability: dataFiles.availability.length > 0,
            },
          }, null, 2);
        } catch (err) {
          const msg = `Error during validation: ${err.message}`;
          onEvent('tool_end', { name: 'validate_setup', summary: msg });
          return msg;
        }
      },
    }),
  };
}

// Exported separately so the secret route in server.js can write secrets
// using the same env-writing logic as the tools.
function writeSecret(key, value) {
  writeEnvValue(key, value);
}

module.exports = { createSetupTools, writeSecret, summarizeToolResult };
