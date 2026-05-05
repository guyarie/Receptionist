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

const { installDir, dataDir: DATA_DIR, envFile: ENV_PATH } = require('../paths');
const ROOT_DIR = installDir;

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
    case 'collect_secret':
      return 'Secret input form shown to user';
    case 'send_email':
      return result;
    case 'check_url_reachable':
      return result;
    case 'validate_setup':
      return 'Setup validation complete';
    case 'validate_openai':
    case 'validate_openrouter':
    case 'validate_email':
    case 'validate_twilio':
      return result.substring(0, 120);
    case 'validate_calendly':
      return result.startsWith('Connected') ? result.split('\n')[0] : result.substring(0, 120);
    case 'configure_nginx':
      return result.substring(0, 120);
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
              onEvent('tool_start', { name: 'crawl_url', label: 'Launching browser...' });
              const browser = await launchBrowser();
              try {
                onEvent('tool_start', { name: 'crawl_url', label: `Loading page...` });
                html = await fetchWithBrowser(browser, url, { timeout: 15000 });
              } finally {
                await closeBrowser(browser);
              }
            } catch (puppeteerErr) {
              console.warn('Puppeteer failed, falling back to axios:', puppeteerErr.message);
              onEvent('tool_start', { name: 'crawl_url', label: 'Browser unavailable, fetching with axios...' });
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
        path: z.string().describe('Path relative to data/, e.g. "prompts/system-prompt.txt" or "providers/dr-jane-smith.md"'),
        content: z.string().describe('The full content of the file'),
      }),
      execute: async ({ path: filePath, content }) => {
        // Strip leading data/ if the model included it
        const cleanPath = filePath.replace(/^data\//, '');
        const parts = cleanPath.split('/');
        const directory = parts[0];
        const filename = parts.slice(1).join('/');

        if (!ALLOWED_DIRECTORIES.includes(directory) || !filename) {
          const msg = `Invalid path "${filePath}" — must be <directory>/<filename> where directory is one of: ${ALLOWED_DIRECTORIES.join(', ')}`;
          onEvent('tool_end', { name: 'save_context_file', summary: msg });
          return msg;
        }

        onEvent('tool_start', { name: 'save_context_file', label: `Saving data/${cleanPath}` });
        try {
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
      description: 'Read an existing configuration file from data/, or the special path ".env.example" to see all available configuration fields with their descriptions. Note: {{PLACEHOLDER}} strings in data/ files are intentional — they are substituted at runtime from .env. Do not treat them as missing configuration.',
      parameters: z.object({
        path: z.string().describe('Path relative to data/, e.g. "prompts/system-prompt.txt". Use ".env.example" to read the full list of supported config fields.'),
      }),
      execute: async ({ path: filePath }) => {
        // Block attempts to read .env directly — it contains secrets and isn't in data/
        if (filePath === '.env' || filePath === 'data/.env') {
          const msg = 'Cannot read .env directly — it contains secrets. Use validate_setup to check what is configured, or read_context_file(".env.example") to see the list of available fields.';
          onEvent('tool_end', { name: 'read_context_file', summary: msg });
          return msg;
        }

        // Special case: allow reading .env.example from the project root
        if (filePath === '.env.example') {
          const envExamplePath = path.join(ROOT_DIR, '.env.example');
          onEvent('tool_start', { name: 'read_context_file', label: 'Reading .env.example' });
          try {
            const content = fs.readFileSync(envExamplePath, 'utf-8');
            onEvent('tool_end', { name: 'read_context_file', summary: 'Read .env.example successfully' });
            return content;
          } catch (err) {
            const msg = `Error reading .env.example: ${err.message}`;
            onEvent('tool_end', { name: 'read_context_file', summary: msg });
            return msg;
          }
        }

        const cleanPath = filePath.replace(/^data\//, '');
        onEvent('tool_start', { name: 'read_context_file', label: `Reading data/${cleanPath}` });
        try {
          const absPath = path.join(DATA_DIR, cleanPath);
          if (!fs.existsSync(absPath)) {
            const msg = `File not found: data/${cleanPath}`;
            onEvent('tool_end', { name: 'read_context_file', summary: msg });
            return msg;
          }
          const content = fs.readFileSync(absPath, 'utf-8');
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
        const reservedKeys = ['PORT', 'SETUP_PORT', 'INSTALL_NAME'];
        if (reservedKeys.includes(key.toUpperCase())) {
          const msg = `${key} is managed by manage.js and cannot be changed via setup.`;
          onEvent('tool_end', { name: 'set_config', summary: msg });
          return msg;
        }
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
    // collect_secret — show a secure input form for any sensitive value.
    // The value is written directly to the target file without passing through the LLM.
    // ------------------------------------------------------------------
    collect_secret: tool({
      description: 'Show a secure input form for the user to enter a sensitive value. The value is stored directly in the specified file without passing through the AI.',
      parameters: z.object({
        file: z.string().describe('The file to store the secret in, e.g. ".env"'),
        key: z.string().describe('The environment variable name, e.g. "OPENAI_API_KEY"'),
        label: z.string().describe('A human-friendly description of what this secret is, e.g. "OpenAI key for the voice conversation agent"'),
      }),
      execute: async ({ file, key, label }) => {
        onEvent('secret_request', { file, key, label });
        return `Secure input form for ${label} is now shown. Tell the user where to find this value, then end your turn — the conversation continues automatically once they submit.`;
      },
    }),

    // ------------------------------------------------------------------
    // web_search — search the web for instructions or documentation
    // ------------------------------------------------------------------
    web_search: tool({
      description: 'Search the web for documentation, setup instructions, or troubleshooting help. Use this when the user mentions a specific service or tool you need configuration details for.',
      parameters: z.object({
        query: z.string().describe('The search query, e.g. "Resend SMTP configuration settings"'),
      }),
      execute: async ({ query }) => {
        onEvent('tool_start', { name: 'web_search', label: `Searching: ${query}` });
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) {
          const msg = 'Web search is not configured (TAVILY_API_KEY not set).';
          onEvent('tool_end', { name: 'web_search', summary: msg });
          return msg;
        }
        try {
          const response = await axios.post('https://api.tavily.com/search', {
            api_key: apiKey,
            query,
            search_depth: 'basic',
            max_results: 5,
            include_answer: true,
          }, { timeout: 15000 });

          const { answer, results } = response.data;
          const snippets = results.map(r => `[${r.title}](${r.url})\n${r.content}`).join('\n\n');
          const output = [answer && `Summary: ${answer}`, snippets].filter(Boolean).join('\n\n');
          onEvent('tool_end', { name: 'web_search', summary: `Found ${results.length} results` });
          return output;
        } catch (err) {
          const msg = `Search failed: ${err.message}`;
          onEvent('tool_end', { name: 'web_search', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // send_email — shared with post-call agent; re-initializes transport
    // so credentials saved earlier in the setup session are picked up.
    // ------------------------------------------------------------------
    send_email: (() => {
      const emailTransport = require('../email-transport');
      const { createTools } = require('./tools');
      const { send_email } = createTools();
      return tool({
        ...send_email,
        execute: async (args) => {
          onEvent('tool_start', { name: 'send_email', label: `Sending email to ${args.to}` });
          emailTransport.initialize();
          const result = await send_email.execute(args);
          const summary = result.success ? `✅ Email sent to ${args.to}` : `❌ ${result.error}`;
          onEvent('tool_end', { name: 'send_email', summary });
          return result;
        },
      });
    })(),

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
            BUSINESS_NAME: 'Business name',
            OWNER_NAME: 'Owner name',
            RECEPTIONIST_NAME: 'Receptionist name',
            TIMEZONE: 'Timezone',
            TWILIO_PHONE_NUMBER: 'Twilio phone number',
            TWILIO_ACCOUNT_SID: 'Twilio Account SID',
            TWILIO_AUTH_TOKEN: 'Twilio Auth Token',
            OPENROUTER_API_KEY: 'OpenRouter API key (AI brain)',
            OPENAI_API_KEY: 'OpenAI API key (real-time voice)',
            ADMIN_PASSWORD: 'Admin panel password',
          };

          const configured = [];
          const missing = [];
          const optionalConfigured = [];
          const optionalMissing = [];

          const isSet = (v) => v && v.trim() !== '';

          for (const [k, desc] of Object.entries(required)) {
            if (isSet(env[k])) configured.push(`${k}: ${desc}`);
            else missing.push(`${k}: ${desc}`);
          }

          // Optional checks — some are multi-key (email sending key)
          const optionalChecks = [
            { label: 'Admin email (for call notifications)', ok: isSet(env['ADMIN_EMAIL']) },
            { label: 'Email sending key (RESEND_API_KEY or SMTP_PASS)', ok: isSet(env['RESEND_API_KEY']) || isSet(env['SMTP_PASS']) },
            { label: 'Email from address (SMTP_FROM)', ok: isSet(env['SMTP_FROM']) },
            { label: 'Web chat CORS origin (ALLOWED_ORIGIN)', ok: isSet(env['ALLOWED_ORIGIN']) },
            { label: 'Public URL — cosmetic only, used in logs and prompt templates (PUBLIC_URL)', ok: isSet(env['PUBLIC_URL']) },
            { label: 'Calendly API token (scheduling)', ok: isSet(env['CALENDLY_API_TOKEN']) },
            { label: 'Calendly event type URI (scheduling)', ok: isSet(env['CALENDLY_EVENT_TYPE_URI']) },
          ];
          for (const { label, ok } of optionalChecks) {
            if (ok) optionalConfigured.push(label);
            else optionalMissing.push(label);
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
            optionalConfigured,
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
    // validate_openai — test OpenAI API key and check realtime model access
    // ------------------------------------------------------------------
    validate_openai: tool({
      description: 'Verify the OpenAI API key is valid and that the realtime voice model is accessible. Call this after the user has entered their OPENAI_API_KEY.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'validate_openai', label: 'Checking OpenAI API key' });
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          const msg = 'OPENAI_API_KEY is not set — ask the user to enter it first.';
          onEvent('tool_end', { name: 'validate_openai', summary: msg });
          return msg;
        }
        try {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = `❌ OpenAI API key rejected (${res.status}): ${body?.error?.message || res.statusText}`;
            onEvent('tool_end', { name: 'validate_openai', summary: msg });
            return msg;
          }
          const { data: models } = await res.json();
          const realtimeModel = models.find(m => m.id.includes('realtime'));
          let result = `✅ API key valid — ${models.length} models available`;
          result += realtimeModel
            ? `\n✅ Realtime model accessible: ${realtimeModel.id}`
            : '\n⚠️  No realtime model found — this key may not have access to gpt-4o-realtime';
          onEvent('tool_end', { name: 'validate_openai', summary: result.split('\n')[0] });
          return result;
        } catch (err) {
          const msg = `❌ OpenAI validation failed: ${err.message}`;
          onEvent('tool_end', { name: 'validate_openai', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // validate_openrouter — test OpenRouter API key and show credit balance
    // ------------------------------------------------------------------
    validate_openrouter: tool({
      description: 'Verify the OpenRouter API key is valid and show the remaining credit balance. Call this after the user has entered their OPENROUTER_API_KEY.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'validate_openrouter', label: 'Checking OpenRouter API key' });
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
          const msg = 'OPENROUTER_API_KEY is not set — ask the user to enter it first.';
          onEvent('tool_end', { name: 'validate_openrouter', summary: msg });
          return msg;
        }
        try {
          const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const msg = `❌ OpenRouter API key rejected (${res.status}): ${body?.error?.message || res.statusText}`;
            onEvent('tool_end', { name: 'validate_openrouter', summary: msg });
            return msg;
          }
          const { data } = await res.json();
          const limit = data.limit != null ? `$${data.limit.toFixed(2)} limit` : 'no limit';
          const usage = data.usage != null ? `$${data.usage.toFixed(4)} used` : 'usage unknown';
          const result = `✅ API key valid — ${usage}, ${limit}${data.label ? ` (${data.label})` : ''}`;
          onEvent('tool_end', { name: 'validate_openrouter', summary: result });
          return result;
        } catch (err) {
          const msg = `❌ OpenRouter validation failed: ${err.message}`;
          onEvent('tool_end', { name: 'validate_openrouter', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // validate_email — verify Resend API key and from address are working
    // ------------------------------------------------------------------
    validate_email: tool({
      description: 'Verify the email configuration is valid (Resend API key and from address). Call this after the user has entered their email credentials.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'validate_email', label: 'Checking email configuration' });
        const apiKey = process.env.RESEND_API_KEY;
        const fromAddress = process.env.SMTP_FROM;

        if (!apiKey) {
          const msg = 'RESEND_API_KEY is not set — ask the user to enter it first.';
          onEvent('tool_end', { name: 'validate_email', summary: msg });
          return msg;
        }
        if (!fromAddress) {
          const msg = 'SMTP_FROM is not set — ask the user to set it via set_config.';
          onEvent('tool_end', { name: 'validate_email', summary: msg });
          return msg;
        }
        try {
          const res = await fetch('https://api.resend.com/api-keys', {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const errMsg = body?.message || res.statusText || '';
            // Restricted keys (send-only) return 401 on management endpoints — that's fine
            if (res.status !== 401 || !errMsg.toLowerCase().includes('restricted')) {
              const msg = `❌ Resend API key rejected (${res.status}): ${errMsg}`;
              onEvent('tool_end', { name: 'validate_email', summary: msg });
              return msg;
            }
          }
          const result = `✅ Resend API key valid\n✅ From address: ${fromAddress}`;
          onEvent('tool_end', { name: 'validate_email', summary: result.split('\n')[0] });
          return result;
        } catch (err) {
          const msg = `❌ Email validation failed: ${err.message}`;
          onEvent('tool_end', { name: 'validate_email', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // validate_twilio — test Account SID + Auth Token and phone number
    // ------------------------------------------------------------------
    validate_twilio: tool({
      description: 'Verify that the Twilio Account SID, Auth Token, and phone number are valid and working. Call this after the user has entered their Twilio credentials to confirm they are correct.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'validate_twilio', label: 'Checking Twilio credentials' });
        const accountSid  = process.env.TWILIO_ACCOUNT_SID;
        const authToken   = process.env.TWILIO_AUTH_TOKEN;
        const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken) {
          const msg = 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must both be set — ask the user to enter them first.';
          onEvent('tool_end', { name: 'validate_twilio', summary: msg });
          return msg;
        }

        try {
          const twilio = require('twilio')(accountSid, authToken);
          const account = await twilio.api.accounts(accountSid).fetch();
          let result = `✅ Credentials valid — account "${account.friendlyName}" (${account.status})`;

          if (phoneNumber) {
            const numbers = await twilio.incomingPhoneNumbers.list({ phoneNumber });
            if (numbers.length === 0) {
              result += `\n❌ Phone number ${phoneNumber} was not found on this account`;
            } else {
              result += `\n✅ Phone number ${phoneNumber} confirmed (${numbers[0].friendlyName})`;
            }
          } else {
            result += '\n⚠️  TWILIO_PHONE_NUMBER not set — skipping number check';
          }

          onEvent('tool_end', { name: 'validate_twilio', summary: result.split('\n')[0] });
          return result;
        } catch (err) {
          const msg = `❌ Twilio authentication failed: ${err.message}`;
          onEvent('tool_end', { name: 'validate_twilio', summary: msg });
          return msg;
        }
      },
    }),

    // ------------------------------------------------------------------
    // configure_nginx — write nginx server block for this install
    // ------------------------------------------------------------------
    configure_nginx: tool({
      description: 'Generate and save the nginx server block for this install. Sets PUBLIC_URL, finds the SSL cert automatically, and writes installs/<name>/nginx.conf. The admin must run `sudo node manage.js deploy-nginx` to activate it.',
      parameters: z.object({
        domain: z.string().describe('The full public domain for this install, e.g. dave.phone.16jets.com'),
      }),
      execute: async ({ domain }) => {
        onEvent('tool_start', { name: 'configure_nginx', label: `Configuring nginx for ${domain}` });
        try {
          const env = readEnvFile();
          const port = env.PORT || process.env.PORT || '3000';

          // Find a wildcard or exact cert covering this domain
          let certPath, keyPath;
          const leDir = '/etc/letsencrypt/live';
          if (fs.existsSync(leDir)) {
            const certs = fs.readdirSync(leDir).filter(n => !n.startsWith('README'));
            // Prefer longest matching parent domain (most specific wildcard wins)
            const match = certs
              .filter(c => domain === c || domain.endsWith('.' + c))
              .sort((a, b) => b.length - a.length)[0];
            if (match) {
              certPath = `${leDir}/${match}/fullchain.pem`;
              keyPath = `${leDir}/${match}/privkey.pem`;
            }
          }

          const proxy = [
            `        proxy_pass http://127.0.0.1:${port};`,
            `        proxy_http_version 1.1;`,
            `        proxy_set_header Upgrade $http_upgrade;`,
            `        proxy_set_header Connection "upgrade";`,
            `        proxy_set_header Host $host;`,
            `        proxy_set_header X-Forwarded-Proto $scheme;`,
            `        proxy_set_header X-Real-IP $remote_addr;`,
            `        proxy_read_timeout 3600s;`,
            `        proxy_send_timeout 3600s;`,
          ].join('\n');

          let nginxConf;
          if (certPath) {
            nginxConf = [
              `server {`,
              `    listen 80;`,
              `    server_name ${domain};`,
              `    return 301 https://$host$request_uri;`,
              `}`,
              ``,
              `server {`,
              `    listen 443 ssl;`,
              `    server_name ${domain};`,
              ``,
              `    ssl_certificate ${certPath};`,
              `    ssl_certificate_key ${keyPath};`,
              ``,
              `    location / {`,
              proxy,
              `    }`,
              `}`,
            ].join('\n');
          } else {
            nginxConf = [
              `server {`,
              `    listen 80;`,
              `    server_name ${domain};`,
              ``,
              `    location / {`,
              proxy,
              `    }`,
              `}`,
            ].join('\n');
          }

          const nginxConfPath = path.join(ROOT_DIR, 'nginx.conf');
          fs.writeFileSync(nginxConfPath, nginxConf + '\n', 'utf-8');

          writeEnvValue('PUBLIC_URL', `https://${domain}`);

          const result = certPath
            ? `nginx config saved with SSL (cert: ${certPath}). Run \`sudo node manage.js deploy-nginx\` to activate.`
            : `nginx config saved (no matching SSL cert found — HTTP only). Ensure certbot has run for ${domain} first.`;

          onEvent('tool_end', { name: 'configure_nginx', summary: result });
          return result;
        } catch (err) {
          const msg = `Error configuring nginx: ${err.message}`;
          onEvent('tool_end', { name: 'configure_nginx', summary: msg });
          return msg;
        }
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
