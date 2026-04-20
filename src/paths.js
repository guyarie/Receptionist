const path = require('path');

if (!process.env.INSTALL_DIR) {
  console.error('❌ INSTALL_DIR is not set. Use "node manage.js create <name>" to create an install, or "node manage.js start <name>" to start one.');
  process.exit(1);
}

const REPO_ROOT = path.join(__dirname, '..');
const INSTALL_DIR = path.resolve(process.env.INSTALL_DIR);

module.exports = {
  repoRoot: REPO_ROOT,
  installDir: INSTALL_DIR,
  dataDir: path.join(INSTALL_DIR, 'data'),
  runtimeDir: path.join(INSTALL_DIR, 'runtime'),
  envFile: path.join(INSTALL_DIR, '.env'),
  promptsDir: path.join(REPO_ROOT, 'prompts'),
};
