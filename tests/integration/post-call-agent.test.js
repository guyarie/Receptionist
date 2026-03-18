// Integration test: runs real post-call agent against call bank fixtures
// These tests hit real OpenRouter — excluded from default vitest run
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { loadAllFixtures, loadFixture } = require('../simulated_call_bank/loader.js');
const { runPostCallAgent } = require('../../src/agents/post-call-agent.js');
const emailTransport = require('../../src/email-transport.js');

// Initialize email transport so send_email tool works (normally done by server.js at startup)
emailTransport.initialize();

const FIXTURE_ENV = process.env.FIXTURE || null;
const TEST_TIMEOUT = 120_000; // 120s — agent calls real OpenRouter

/**
 * Extract tool call names from the agent result's steps/logs.
 * The agent returns a Vercel AI SDK result; tool calls live in toolCalls or
 * are captured in the agent log steps written to disk. We inspect the result
 * object for any toolCalls array that the SDK exposes.
 */
function extractToolNames(result) {
  if (!result) return [];
  // Vercel AI SDK generateText result may have toolCalls at top level
  if (Array.isArray(result.toolCalls)) {
    return result.toolCalls.map(tc => tc.toolName || tc.name || 'unknown');
  }
  // Some SDK versions nest under steps
  if (Array.isArray(result.steps)) {
    return result.steps
      .flatMap(s => s.toolCalls || [])
      .map(tc => tc.toolName || tc.name || 'unknown');
  }
  return [];
}

describe('Post-Call Agent Integration', () => {
  let fixtures;

  // Load fixtures once before all tests
  if (FIXTURE_ENV) {
    // Single fixture mode
    try {
      const single = loadFixture(FIXTURE_ENV);
      fixtures = [single];
    } catch (err) {
      // Will be reported inside the test block
      fixtures = null;
    }
  } else {
    fixtures = loadAllFixtures();
  }

  if (FIXTURE_ENV && fixtures === null) {
    it(`should find fixture "${FIXTURE_ENV}"`, () => {
      expect.fail(`Fixture not found: ${FIXTURE_ENV}`);
    });
  } else if (!fixtures || fixtures.length === 0) {
    it('should have fixtures in the call bank', () => {
      console.log('⚠️  No fixtures found in tests/simulated_call_bank/');
      expect.fail('No fixtures found — seed some with: node tests/simulated_call_bank/seed-fixture.js <call-summary.json>');
    });
  } else {
    for (const fixture of fixtures) {
      it(
        `should complete without throwing for fixture: ${fixture.filename}`,
        async () => {
          let result;
          try {
            result = await runPostCallAgent(fixture.data);
          } catch (err) {
            // Report the error clearly, then fail this fixture
            console.error(`❌ Agent error for ${fixture.filename}:`, err.message);
            expect.fail(`Agent threw for fixture "${fixture.filename}": ${err.message}`);
          }

          // Report which tools were called
          const tools = extractToolNames(result);
          if (tools.length > 0) {
            console.log(`✅ ${fixture.filename} — tools called: ${tools.join(', ')}`);
          } else {
            console.log(`✅ ${fixture.filename} — completed (no tool calls detected in result)`);
          }
        },
        TEST_TIMEOUT
      );
    }
  }
});
