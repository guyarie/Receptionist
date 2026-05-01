#!/usr/bin/env node
// Management CLI for multi-install Receptionist deployments.
// Usage: node manage.js <command> [name]
//
// Commands:
//   create <name>   Create a new install and start it in setup mode
//   start <name>    Start one install via PM2
//   start all       Start all installs via PM2
//   stop <name>     Stop one install via PM2
//   stop all        Stop all installs via PM2
//   status          List all installs and their PM2 state
//   nginx           Print nginx config snippets for all installs

'use strict';

const fs = require('fs');
const path = require('path');
const pm2 = require('pm2');

const REPO_ROOT = __dirname;
const INSTALLS_DIR = path.join(REPO_ROOT, 'installs');
const BASE_PORT = 3100; // installs get 3100, 3200, 3300 …
const PORT_STRIDE = 100; // SETUP_PORT = PORT + 1

// ============================================================================
// Helpers
// ============================================================================

function listInstalls() {
  if (!fs.existsSync(INSTALLS_DIR)) return [];
  return fs.readdirSync(INSTALLS_DIR).filter((name) => {
    const full = path.join(INSTALLS_DIR, name);
    return fs.statSync(full).isDirectory() && !name.startsWith('_') && !name.startsWith('.');
  });
}

function installDir(name) {
  return path.join(INSTALLS_DIR, name);
}

function envPath(name) {
  return path.join(installDir(name), '.env');
}

function readInstallEnv(name) {
  const file = envPath(name);
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, '$1');
  }
  return env;
}

function nextAvailablePort() {
  const usedPorts = new Set(
    listInstalls().map((n) => parseInt(readInstallEnv(n).PORT || '0', 10))
  );
  let port = BASE_PORT;
  while (usedPorts.has(port)) port += PORT_STRIDE;
  return port;
}

function pm2AppName(name) {
  return `receptionist-${name}`;
}

function pm2Connect() {
  return new Promise((resolve, reject) =>
    pm2.connect((err) => (err ? reject(err) : resolve()))
  );
}

function pm2Disconnect() {
  pm2.disconnect();
}

function pm2List() {
  return new Promise((resolve, reject) =>
    pm2.list((err, list) => (err ? reject(err) : resolve(list)))
  );
}

function pm2StartApp(name) {
  const env = readInstallEnv(name);
  const port = parseInt(env.PORT || BASE_PORT, 10);
  return new Promise((resolve, reject) =>
    pm2.start(
      {
        name: pm2AppName(name),
        script: path.join(REPO_ROOT, 'src', 'server.js'),
        cwd: REPO_ROOT,
        env: { INSTALL_DIR: installDir(name) },
        watch: false,
        autorestart: true,
      },
      (err) => (err ? reject(err) : resolve(port))
    )
  );
}

function pm2StopApp(name) {
  return new Promise((resolve, reject) =>
    pm2.stop(pm2AppName(name), (err) => (err ? reject(err) : resolve()))
  );
}

function pm2DeleteApp(name) {
  return new Promise((resolve, reject) =>
    pm2.delete(pm2AppName(name), (err) => (err ? reject(err) : resolve()))
  );
}

// ============================================================================
// Commands
// ============================================================================

async function cmdCreate(name) {
  if (!name) { console.error('Usage: manage.js create <name>'); process.exit(1); }
  if (!/^[a-z0-9-]+$/.test(name)) {
    console.error('Install name must be lowercase letters, numbers, and hyphens only.');
    process.exit(1);
  }

  const dir = installDir(name);
  if (fs.existsSync(dir)) {
    console.error(`Install "${name}" already exists at ${dir}`);
    process.exit(1);
  }

  const port = nextAvailablePort();
  const setupPort = port + 1;

  // Create directory structure
  for (const sub of [
    'data/providers', 'data/availability', 'data/prompts', 'data/practice', 'data/public',
    'runtime/call-summaries', 'runtime/agent-logs', 'runtime/chat-logs',
    'runtime/scrape-cache', 'runtime/backups',
  ]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }

  // Write seed .env
  fs.writeFileSync(
    envPath(name),
    [
      `# Install: ${name}`,
      `INSTALL_NAME=${name}`,
      `PORT=${port}`,
      `SETUP_PORT=${setupPort}`,
      `SETUP_MODE=true`,
      `# BUSINESS_NAME=`,
      `# PUBLIC_URL=https://${name}.yourdomain.com`,
      `# TWILIO_ACCOUNT_SID=`,
      `# TWILIO_AUTH_TOKEN=`,
      `# TWILIO_PHONE_NUMBER=`,
      `# ADMIN_PASSWORD=`,
      `# SESSION_SECRET=`,
    ].join('\n') + '\n'
  );

  console.log(`✅ Created install "${name}" at ${dir}`);
  console.log(`   Main port:  ${port}`);
  console.log(`   Setup port: ${setupPort}`);

  // Start in setup mode
  await pm2Connect();
  try {
    await pm2StartApp(name);
    console.log(`🚀 Started in setup mode — visit http://localhost:${setupPort}/setup`);
  } finally {
    pm2Disconnect();
  }
}

async function cmdStart(name) {
  const installs = name === 'all' ? listInstalls() : [name];
  if (installs.length === 0) { console.log('No installs found.'); return; }

  await pm2Connect();
  try {
    for (const n of installs) {
      if (!fs.existsSync(installDir(n))) {
        console.error(`Install "${n}" not found.`);
        continue;
      }
      const port = await pm2StartApp(n);
      const env = readInstallEnv(n);
      const inSetup = (env.SETUP_MODE || '').toLowerCase() === 'true';
      const url = inSetup
        ? `http://localhost:${parseInt(port) + 1}/setup`
        : `http://localhost:${port}/admin`;
      console.log(`▶  ${n}  →  ${url}`);
    }
  } finally {
    pm2Disconnect();
  }
}

async function cmdStop(name) {
  const installs = name === 'all' ? listInstalls() : [name];
  if (installs.length === 0) { console.log('No installs found.'); return; }

  await pm2Connect();
  try {
    for (const n of installs) {
      try {
        await pm2StopApp(n);
        await pm2DeleteApp(n);
        console.log(`⏹  ${n} stopped`);
      } catch {
        console.log(`   ${n} was not running`);
      }
    }
  } finally {
    pm2Disconnect();
  }
}

async function cmdStatus() {
  const installs = listInstalls();
  if (installs.length === 0) { console.log('No installs found in installs/.'); return; }

  await pm2Connect();
  let pm2Procs = [];
  try {
    pm2Procs = await pm2List();
  } finally {
    pm2Disconnect();
  }

  const pm2Map = new Map(pm2Procs.map((p) => [p.name, p]));

  console.log('');
  console.log('  NAME            PORT   SETUP  STATUS');
  console.log('  ' + '-'.repeat(50));
  for (const n of installs) {
    const env = readInstallEnv(n);
    const port = env.PORT || '?';
    const inSetup = (env.SETUP_MODE || '').toLowerCase() === 'true' ? 'yes' : 'no ';
    const proc = pm2Map.get(pm2AppName(n));
    const status = proc ? proc.pm2_env.status : 'stopped';
    console.log(`  ${n.padEnd(15)} ${String(port).padEnd(6)} ${inSetup}    ${status}`);
  }
  console.log('');
}

function cmdNginx() {
  const installs = listInstalls();
  if (installs.length === 0) { console.log('# No installs found.'); return; }

  for (const n of installs) {
    const env = readInstallEnv(n);
    const port = env.PORT || '?';
    const domain = (env.PUBLIC_URL || `http://${n}.yourdomain.com`)
      .replace(/^https?:\/\//, '');

    console.log(`
# Install: ${n}
server {
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`);
  }
}

// ============================================================================
// Entry point
// ============================================================================

const [,, cmd, arg] = process.argv;

(async () => {
  try {
    switch (cmd) {
      case 'create': await cmdCreate(arg); break;
      case 'start':  await cmdStart(arg || 'all'); break;
      case 'stop':   await cmdStop(arg || 'all'); break;
      case 'status': await cmdStatus(); break;
      case 'nginx':  cmdNginx(); break;
      default:
        console.log(`
AI Receptionist — install manager

  node manage.js create <name>   Create a new install and start setup
  node manage.js start <name>    Start one install
  node manage.js start all       Start all installs
  node manage.js stop <name>     Stop one install
  node manage.js stop all        Stop all installs
  node manage.js status          List all installs and their state
  node manage.js nginx           Print nginx config for all installs
`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
