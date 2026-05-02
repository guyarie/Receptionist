/**
 * Manual live test: oversized instructions → text-only refusal detection
 *
 * Sends a real session to OpenAI Realtime with deliberately oversized instructions
 * (simulating the production OOM incident where 16 provider profiles exceeded the
 * API limit). Verifies that our onTextOnlyRefusal callback fires instead of the
 * relay silently hanging open.
 *
 * Usage:
 *   INSTALL_DIR=installs/dev node tests/integration/openai-refusal-live.js
 *
 * Costs a small amount of API credit. Do not run in CI.
 */

'use strict';

process.env.INSTALL_DIR = process.env.INSTALL_DIR || 'installs/dev';

const config = require('../../src/config');
const OpenAIAdapter = require('../../src/realtime/openai-adapter');

const TIMEOUT_MS = 30000;

// Generate a large provider context that mimics the production failure.
// Each profile is ~500 chars; 80 of them puts us well over the API limit.
function buildOversizedInstructions() {
  const profile = (i) => `
${'='.repeat(60)}
PROVIDER ${i}: Dr. Jane Smith ${i}, MD — Psychiatry
${'='.repeat(60)}
Specialty: Adult psychiatry, anxiety, depression, ADHD
Accepting new patients: Yes
Telehealth available: Yes
Insurance accepted: Aetna, Blue Cross, Cigna, United, Kaiser
Languages: English, Spanish
Address: ${100 + i} Medical Plaza Dr, Suite ${200 + i}, San Francisco, CA 9410${i % 10}
Phone: (415) 555-${String(1000 + i).padStart(4, '0')}
Bio: Dr. Smith ${i} completed her residency at UCSF and has been practicing for ${10 + (i % 20)} years.
She specialises in evidence-based treatments including CBT, DBT, and medication management.
She has a particular interest in treating patients with complex trauma and co-occurring disorders.
`;
  return Array.from({ length: 160 }, (_, i) => profile(i)).join('\n');
}

async function run() {
  const apiKey = config.openai?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌  OPENAI_API_KEY is not set — cannot run live test');
    process.exit(1);
  }

  const instructions = buildOversizedInstructions();
  console.log(`📏 Instructions size: ${(instructions.length / 1024).toFixed(1)} KB`);
  console.log('🔌 Connecting to OpenAI Realtime...');

  const adapter = new OpenAIAdapter(apiKey, 'alloy');

  const result = await Promise.race([
    new Promise((resolve) => {
      adapter.onTextOnlyRefusal = () => resolve('refusal');
      adapter.onAudioOutput    = () => resolve('audio');
      adapter.onError          = (err) => resolve(`error: ${err.message}`);
      adapter.connect({ systemPrompt: instructions }).catch((err) => resolve(`error: ${err.message}`));
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`No response within ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
    ),
  ]);

  adapter.close();

  if (result === 'refusal') {
    console.log('✅ PASS — onTextOnlyRefusal fired as expected');
    process.exit(0);
  } else if (result === 'audio') {
    console.error('❌ FAIL — got audio; instructions may not be large enough to trigger a refusal');
    process.exit(1);
  } else {
    console.error(`❌ FAIL — unexpected outcome: ${result}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ FAIL —', err.message);
  process.exit(1);
});
