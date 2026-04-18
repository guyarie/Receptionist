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
const { getUser, getEventTypes } = require('./tools/calendly');
const { generateAuthUrl, exchangeCodeForTokens } = require('./tools/google-calendar');

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
    case 'check_url_reachable':
      return result;
    case 'validate_setup':
      return 'Setup validation complete';
    case 'validate_calendly':
      return result.startsWith('Connected') ? result.split('\n')[0] : result.substring(0, 120);
    case 'generate_gcal_auth_url':
      return 'Google authorization URL generated';
    case 'complete_gcal_auth':
      return result;
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
      execute: async (args) => {
        console.log(`[setup] save_context_file raw args:`, JSON.stringify(args));
        const { directory, filename, content } = args;
        console.log(`[setup] save_context_file called: ${directory}/${filename}`);
        if (!directory || !filename) {
          const msg = `save_context_file called with missing arguments (directory=${directory}, filename=${filename}) — the model did not provide required fields`;
          console.error(`[setup] ${msg}`);
          onEvent('tool_end', { name: 'save_context_file', summary: msg });
          return msg;
        }
        // Strip any leading 'data/' prefix the model may have mistakenly included
        const cleanDirectory = directory.replace(/^data\//, '');
        onEvent('tool_start', { name: 'save_context_file', label: `Saving ${cleanDirectory}/${filename}` });
        try {
          // Sanitize filename — no path traversal
          const safeName = path.basename(filename);
          const dirPath = path.join(DATA_DIR, cleanDirectory);
          console.log(`[setup] save_context_file: directory=${dirPath} file=${safeName} contentLength=${content?.length} (raw directory arg was: ${directory})`);
          fs.mkdirSync(dirPath, { recursive: true });
          console.log(`[setup] save_context_file: directory created/confirmed`);
          const filePath = path.join(dirPath, safeName);
          fs.writeFileSync(filePath, content, 'utf-8');
          console.log(`[setup] save_context_file: wrote ${filePath}`);
          const result = `Saved data/${cleanDirectory}/${safeName}`;
          onEvent('tool_end', { name: 'save_context_file', summary: result });
          return result;
        } catch (err) {
          console.error(`[setup] save_context_file ERROR: ${err.message}`, err);
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
    // check_url_reachable — verify a server URL is responding
    // ------------------------------------------------------------------
    check_url_reachable: tool({
      description: 'Check whether a server URL is reachable and responding. Use this to verify the server is live before configuring the Twilio webhook.',
      parameters: z.object({
        url: z.string().describe('The URL to check, e.g. https://yourdomain.com'),
      }),
      execute: async ({ url }) => {
        onEvent('tool_start', { name: 'check_url_reachable', label: `Checking ${url}` });
        try {
          const response = await axios.get(url, { timeout: 10000, validateStatus: () => true });
          const result = `✅ Server is reachable at ${url} (HTTP ${response.status})`;
          onEvent('tool_end', { name: 'check_url_reachable', summary: result });
          return result;
        } catch (err) {
          const result = `❌ Could not reach ${url}: ${err.message}`;
          onEvent('tool_end', { name: 'check_url_reachable', summary: result });
          return result;
        }
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
            TWILIO_PHONE_NUMBER: 'Twilio Phone Number',
            OPENROUTER_API_KEY: 'OpenRouter API Key (AI brain)',
            OPENAI_API_KEY: 'OpenAI API Key (required for real-time voice calls)',
          };

          const optional = {
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
          const hasGreeting = dataFiles.prompts.includes('webchat-greeting.txt');

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
    // ------------------------------------------------------------------
    // validate_calendly — test API token and list event types
    // ------------------------------------------------------------------
    validate_calendly: tool({
      description: 'Test a Calendly API token and list the account\'s event types. Use this after the user has entered their CALENDLY_API_TOKEN to verify it works and to help them choose which event type to use for scheduling.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'validate_calendly', label: 'Checking Calendly connection' });
        const apiToken = process.env.CALENDLY_API_TOKEN;
        if (!apiToken) {
          const msg = 'CALENDLY_API_TOKEN is not set — ask the user to enter it via request_secret first.';
          onEvent('tool_end', { name: 'validate_calendly', summary: msg });
          return msg;
        }
        try {
          const user = await getUser(apiToken);
          const eventTypes = await getEventTypes(apiToken, user.uri);
          const list = eventTypes.map((et, i) => `${i + 1}. ${et.name} (${et.duration} min) — URI: ${et.uri}`).join('\n');
          const result = `Connected as: ${user.name} (${user.email})\n\nEvent types:\n${list}`;
          onEvent('tool_end', { name: 'validate_calendly', summary: `Found ${eventTypes.length} event type(s)` });
          return result;
        } catch (err) {
          const msg = `Calendly connection failed: ${err.response?.data?.message || err.message}`;
          onEvent('tool_end', { name: 'validate_calendly', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // generate_gcal_auth_url — build the Google OAuth2 authorization URL
    // ------------------------------------------------------------------
    generate_gcal_auth_url: tool({
      description: 'Generate a Google OAuth2 authorization URL for Google Calendar access. Call this after the user has entered GCAL_CLIENT_ID. The user will visit the URL, authorize access, and be redirected to a page showing their authorization code.',
      parameters: z.object({
        setup_port: z.number().optional().describe('The port the setup server is running on (default 3001)'),
      }),
      execute: async ({ setup_port }) => {
        onEvent('tool_start', { name: 'generate_gcal_auth_url', label: 'Generating Google auth URL' });
        const clientId = process.env.GCAL_CLIENT_ID;
        if (!clientId) {
          const msg = 'GCAL_CLIENT_ID is not set — ask the user to enter it via set_config first.';
          onEvent('tool_end', { name: 'generate_gcal_auth_url', summary: msg });
          return msg;
        }
        const port = setup_port || process.env.SETUP_PORT || 3001;
        const redirectUri = `http://localhost:${port}/gcal-oauth.html`;
        const url = generateAuthUrl(clientId, redirectUri);
        onEvent('tool_end', { name: 'generate_gcal_auth_url', summary: 'Authorization URL generated' });
        return `Authorization URL:\n${url}\n\nRedirect URI (save this — you'll need it): ${redirectUri}`;
      },
    }),

    // ------------------------------------------------------------------
    // complete_gcal_auth — exchange OAuth code for tokens and save them
    // ------------------------------------------------------------------
    complete_gcal_auth: tool({
      description: 'Exchange a Google OAuth2 authorization code for a refresh token and save it to configuration. Call this after the user pastes the code they received from the Google authorization page.',
      parameters: z.object({
        code: z.string().describe('The authorization code the user copied from the Google redirect page'),
        redirect_uri: z.string().describe('The redirect URI used when generating the auth URL (must match exactly)'),
      }),
      execute: async ({ code, redirect_uri }) => {
        onEvent('tool_start', { name: 'complete_gcal_auth', label: 'Completing Google Calendar authorization' });
        const clientId = process.env.GCAL_CLIENT_ID;
        const clientSecret = process.env.GCAL_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          const msg = 'GCAL_CLIENT_ID and GCAL_CLIENT_SECRET must be set before completing authorization.';
          onEvent('tool_end', { name: 'complete_gcal_auth', summary: msg });
          return msg;
        }
        try {
          const tokens = await exchangeCodeForTokens(clientId, clientSecret, code.trim(), redirect_uri);
          if (!tokens.refresh_token) {
            const msg = 'Google did not return a refresh token. Make sure the OAuth2 consent screen was shown (try revoking access at myaccount.google.com/permissions and authorizing again).';
            onEvent('tool_end', { name: 'complete_gcal_auth', summary: msg });
            return msg;
          }
          writeEnvValue('GCAL_REFRESH_TOKEN', tokens.refresh_token);
          const result = 'Google Calendar authorized successfully. Refresh token saved to configuration.';
          onEvent('tool_end', { name: 'complete_gcal_auth', summary: result });
          return result;
        } catch (err) {
          const detail = err.response?.data?.error_description || err.response?.data?.error || err.message;
          const msg = `Authorization failed: ${detail}`;
          onEvent('tool_end', { name: 'complete_gcal_auth', summary: msg });
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
