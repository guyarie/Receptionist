'use strict';

const { generateText, tool } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const { execFile, exec } = require('child_process');
const { promisify } = require('util');
const pm2 = require('pm2');

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const REPO_ROOT = path.join(__dirname, '..', '..');
const INSTALLS_DIR = path.join(REPO_ROOT, 'installs');
const MANAGE_JS = path.join(REPO_ROOT, 'manage.js');
const PM2_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', 'pm2');
const PROMPT_PATH = path.join(REPO_ROOT, 'prompts', 'meta-admin-agent.txt');

const MAX_ITERATIONS = 15;

// In-memory sessions: sessionId → messages[]
const sessions = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function listInstallNames() {
  if (!fs.existsSync(INSTALLS_DIR)) return [];
  return fs.readdirSync(INSTALLS_DIR).filter(name => {
    const full = path.join(INSTALLS_DIR, name);
    return fs.statSync(full).isDirectory() && !name.startsWith('_') && !name.startsWith('.');
  });
}

function readInstallEnv(name) {
  const file = path.join(INSTALLS_DIR, name, '.env');
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return env;
}

function pm2Connect() {
  return new Promise((resolve, reject) => pm2.connect(err => err ? reject(err) : resolve()));
}

function pm2ListProcs() {
  return new Promise((resolve, reject) => pm2.list((err, list) => err ? reject(err) : resolve(list)));
}

async function getInstallsStatus() {
  const names = listInstallNames();
  await pm2Connect();
  let procs = [];
  try { procs = await pm2ListProcs(); } finally { pm2.disconnect(); }
  const pm2Map = new Map(procs.map(p => [p.name, p]));

  return names.map(name => {
    const env = readInstallEnv(name);
    const port = parseInt(env.PORT || '0', 10);
    const setupPort = parseInt(env.SETUP_PORT || String(port + 1), 10);
    const inSetup = (env.SETUP_MODE || '').toLowerCase() === 'true';
    const proc = pm2Map.get(`receptionist-${name}`);
    const status = proc ? proc.pm2_env.status : 'stopped';
    const logOutPath = proc ? proc.pm2_env.pm_out_log_path : null;
    const logErrPath = proc ? proc.pm2_env.pm_err_log_path : null;
    return {
      name,
      port,
      setupPort,
      inSetup,
      status,
      businessName: env.BUSINESS_NAME || '',
      publicUrl: env.PUBLIC_URL || '',
      logOutPath,
      logErrPath,
    };
  });
}

async function runManage(...args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [MANAGE_JS, ...args], {
      cwd: REPO_ROOT,
      timeout: 30000,
      env: process.env,
    });
    return (stdout + stderr).trim();
  } catch (err) {
    // execFile rejects on non-zero exit but stdout may still contain useful output
    return ((err.stdout || '') + (err.stderr || '') || err.message).trim();
  }
}

function tailFile(filePath, lines) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').slice(-lines).join('\n');
}

// ─── Tools ────────────────────────────────────────────────────────────────────

function createMetaAdminTools(onEvent) {
  return {
    list_installs: tool({
      description: 'List all Receptionist installs with their current status, ports, and business names.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'list_installs', label: 'Checking install status…' });
        try {
          const installs = await getInstallsStatus();
          if (installs.length === 0) {
            onEvent('tool_end', { name: 'list_installs', summary: 'No installs found' });
            return 'No installs found.';
          }
          const rows = installs.map(i => {
            const state = i.status === 'online'
              ? (i.inSetup ? 'running (setup mode)' : 'running')
              : i.status;
            const url = i.inSetup
              ? `http://localhost:${i.setupPort}/setup`
              : `http://localhost:${i.port}/admin`;
            const biz = i.businessName ? ` | ${i.businessName}` : '';
            return `${i.name}: ${state} | port ${i.port}${biz} | ${url}`;
          });
          onEvent('tool_end', { name: 'list_installs', summary: `${installs.length} install(s)` });
          return rows.join('\n');
        } catch (err) {
          onEvent('tool_end', { name: 'list_installs', summary: `Error: ${err.message}` });
          return `Error: ${err.message}`;
        }
      },
    }),

    start_install: tool({
      description: 'Start a Receptionist install via PM2. Use name "all" to start every install.',
      parameters: z.object({
        name: z.string().describe('Install name, or "all"'),
      }),
      execute: async ({ name }) => {
        onEvent('tool_start', { name: 'start_install', label: `Starting ${name}…` });
        const out = await runManage('start', name);
        onEvent('tool_end', { name: 'start_install', summary: out.split('\n')[0].slice(0, 80) });
        return out;
      },
    }),

    stop_install: tool({
      description: 'Stop a Receptionist install. Use name "all" to stop every install.',
      parameters: z.object({
        name: z.string().describe('Install name, or "all"'),
      }),
      execute: async ({ name }) => {
        onEvent('tool_start', { name: 'stop_install', label: `Stopping ${name}…` });
        const out = await runManage('stop', name);
        onEvent('tool_end', { name: 'stop_install', summary: out.split('\n')[0].slice(0, 80) });
        return out;
      },
    }),

    restart_install: tool({
      description: 'Restart a Receptionist install (stop then start).',
      parameters: z.object({
        name: z.string().describe('Install name'),
      }),
      execute: async ({ name }) => {
        onEvent('tool_start', { name: 'restart_install', label: `Restarting ${name}…` });
        const stopOut = await runManage('stop', name);
        const startOut = await runManage('start', name);
        const out = [stopOut, startOut].filter(Boolean).join('\n');
        onEvent('tool_end', { name: 'restart_install', summary: out.split('\n')[0].slice(0, 80) });
        return out;
      },
    }),

    create_install: tool({
      description: 'Create a new Receptionist install. It will start automatically in setup mode.',
      parameters: z.object({
        name: z.string().describe('Install name — lowercase letters, numbers, and hyphens only'),
      }),
      execute: async ({ name }) => {
        onEvent('tool_start', { name: 'create_install', label: `Creating install "${name}"…` });
        const out = await runManage('create', name);
        onEvent('tool_end', { name: 'create_install', summary: out.split('\n')[0].slice(0, 80) });
        return out;
      },
    }),

    get_logs: tool({
      description: 'Get recent log output from a Receptionist install.',
      parameters: z.object({
        name: z.string().describe('Install name'),
        lines: z.number().optional().describe('Number of lines to fetch (default 60)'),
      }),
      execute: async ({ name, lines = 60 }) => {
        onEvent('tool_start', { name: 'get_logs', label: `Fetching logs for ${name}…` });
        try {
          // Prefer reading log files directly from PM2 process metadata
          const installs = await getInstallsStatus();
          const install = installs.find(i => i.name === name);
          if (install && (install.logOutPath || install.logErrPath)) {
            const out = tailFile(install.logOutPath, lines);
            const err = tailFile(install.logErrPath, Math.min(lines, 20));
            const combined = [out, err ? `\n--- stderr ---\n${err}` : ''].join('').trim();
            onEvent('tool_end', { name: 'get_logs', summary: `${combined.split('\n').length} lines` });
            return combined || 'No logs yet.';
          }
          // Fallback: pm2 CLI
          const { stdout } = await execAsync(
            `"${PM2_BIN}" logs receptionist-${name} --nostream --lines ${lines} 2>&1`,
            { timeout: 10000 }
          );
          const result = stdout.trim() || 'No logs available.';
          onEvent('tool_end', { name: 'get_logs', summary: `${result.split('\n').length} lines` });
          return result;
        } catch (err) {
          onEvent('tool_end', { name: 'get_logs', summary: `Error: ${err.message}` });
          return `Error fetching logs: ${err.message}`;
        }
      },
    }),

    get_nginx_config: tool({
      description: 'Get the nginx server block configuration for one or all installs.',
      parameters: z.object({
        name: z.string().optional().describe('Install name, or omit for all installs'),
      }),
      execute: async ({ name } = {}) => {
        onEvent('tool_start', { name: 'get_nginx_config', label: 'Generating nginx config…' });
        const installs = name ? [name] : listInstallNames();
        const configs = installs.map(n => {
          const env = readInstallEnv(n);
          const port = env.PORT || '?';
          const domain = (env.PUBLIC_URL || `http://${n}.yourdomain.com`).replace(/^https?:\/\//, '');
          return [
            `# Install: ${n}`,
            `server {`,
            `    server_name ${domain};`,
            ``,
            `    location / {`,
            `        proxy_pass http://127.0.0.1:${port};`,
            `        proxy_http_version 1.1;`,
            `        proxy_set_header Upgrade $http_upgrade;`,
            `        proxy_set_header Connection "upgrade";`,
            `        proxy_set_header Host $host;`,
            `        proxy_set_header X-Forwarded-Proto $scheme;`,
            `        proxy_set_header X-Real-IP $remote_addr;`,
            `    }`,
            `}`,
          ].join('\n');
        });
        const result = configs.join('\n\n') || 'No installs found.';
        onEvent('tool_end', { name: 'get_nginx_config', summary: `Config for ${installs.length} install(s)` });
        return result;
      },
    }),

    deploy_nginx: tool({
      description: 'Deploy nginx config files for all installs and reload nginx. Requires sudo.',
      parameters: z.object({}),
      execute: async () => {
        onEvent('tool_start', { name: 'deploy_nginx', label: 'Deploying nginx config…' });
        try {
          const { stdout, stderr } = await execAsync(
            `sudo ${process.execPath} "${MANAGE_JS}" deploy-nginx`,
            { cwd: REPO_ROOT, timeout: 30000 }
          );
          const out = (stdout + stderr).trim();
          onEvent('tool_end', { name: 'deploy_nginx', summary: out.split('\n')[0].slice(0, 80) });
          return out;
        } catch (err) {
          const detail = ((err.stdout || '') + (err.stderr || '') || err.message).trim();
          onEvent('tool_end', { name: 'deploy_nginx', summary: 'Error — may need manual sudo' });
          return `${detail}\n\nNote: deploy-nginx requires sudo. Run manually:\n  sudo node manage.js deploy-nginx`;
        }
      },
    }),
  };
}

// ─── Session management ───────────────────────────────────────────────────────

function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    const prompt = fs.readFileSync(PROMPT_PATH, 'utf-8').trim();
    sessions.set(sessionId, [{ role: 'system', content: prompt }]);
  }
  return sessions.get(sessionId);
}

function clearSession(sessionId) {
  sessions.delete(sessionId);
}

// ─── Agent turn ───────────────────────────────────────────────────────────────

async function runMetaAdminTurn(sessionId, userMessage, onEvent) {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const openai = createOpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey });
  const model = openai.chat(
    process.env.META_ADMIN_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
  );

  const messages = getOrCreateSession(sessionId);
  messages.push({ role: 'user', content: userMessage });

  const tools = createMetaAdminTools(onEvent);
  let iteration = 0;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    const result = await generateText({ model, messages, tools, maxSteps: 1 });
    const toolCalls = result.toolCalls || [];

    if (toolCalls.length > 0) {
      if (result.response?.messages) {
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

    if (result.finishReason === 'stop' || result.finishReason === 'end-turn' || toolCalls.length === 0) {
      const text = result.text || '';
      if (text) messages.push({ role: 'assistant', content: text });
      return text;
    }
  }

  return 'Reached maximum iterations. Please send another message to continue.';
}

module.exports = { runMetaAdminTurn, getInstallsStatus, clearSession };
