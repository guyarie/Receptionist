#!/usr/bin/env node

/**
 * Regression Test Runner for AI Receptionist
 * 
 * Runs multi-turn conversation scenarios against the webchat API and scores
 * how well the bot qualifies each caller by collecting required fields.
 * 
 * Usage:
 *   node tests/regression/runner.js [options]
 * 
 * Options:
 *   --url <base-url>        Override the API base URL (e.g. https://example.com)
 *   --threshold <number>    Override the minimum passing score (0-100)
 *   --config <path>         Path to a custom config file
 *   --scenarios <path>      Path to a custom scenarios directory
 *   --verbose               Show full conversation transcripts
 *   --help                  Show this help message
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { verbose: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        opts.url = args[++i];
        break;
      case '--threshold':
        opts.threshold = Number(args[++i]);
        break;
      case '--config':
        opts.configPath = args[++i];
        break;
      case '--scenarios':
        opts.scenariosPath = args[++i];
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--help':
        console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[0]);
        process.exit(0);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Config & scenario loading
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_CONFIG = path.join(__dirname, 'config.json');
const DEFAULT_SCENARIOS = path.join(__dirname, 'scenarios');
const DATA_CONFIG = path.join(PROJECT_ROOT, 'data', 'tests', 'config.json');
const DATA_SCENARIOS = path.join(PROJECT_ROOT, 'data', 'tests', 'scenarios');
const REPORTS_DIR = path.join(PROJECT_ROOT, 'data', 'tests', 'reports');

function loadConfig(overridePath) {
  // Priority: CLI flag > data/ override > default
  const candidates = [overridePath, DATA_CONFIG, DEFAULT_CONFIG].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`📋 Config: ${path.relative(PROJECT_ROOT, p)}`);
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  console.error('❌ No config file found');
  process.exit(1);
}

function loadScenarios(overridePath) {
  const candidates = [overridePath, DATA_SCENARIOS, DEFAULT_SCENARIOS].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
      if (files.length > 0) {
        console.log(`📂 Scenarios: ${path.relative(PROJECT_ROOT, dir)} (${files.length} files)`);
        return files.map(f => {
          const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          data._file = f;
          return data;
        });
      }
    }
  }
  console.error('❌ No scenario files found');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API interaction
// ---------------------------------------------------------------------------

async function sendConversation(baseUrl, endpoint, messages) {
  const sessionId = crypto.randomUUID();
  const conversationHistory = [];
  const botResponses = [];

  for (const userMessage of messages) {
    conversationHistory.push({ role: 'user', content: userMessage });

    const url = `${baseUrl}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, messages: conversationHistory }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const reply = data.reply || data.response || data.message || '';
    botResponses.push(reply);
    conversationHistory.push({ role: 'assistant', content: reply });
  }

  return { sessionId, conversationHistory, botResponses };
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreConversation(botResponses, userMessages, fields) {
  const allBotText = botResponses.join('\n').toLowerCase();
  const allUserText = userMessages.join('\n').toLowerCase();
  const allText = (allBotText + '\n' + allUserText).toLowerCase();

  const results = fields.map(field => {
    // A field is "collected" if:
    // 1. The bot ASKED for it (keywords appear in bot responses), OR
    // 2. The customer provided it AND it appeared in the conversation context
    //    (indicating the bot engaged with that information)
    const botAsked = field.keywords.some(kw => allBotText.includes(kw.toLowerCase()));
    const mentionedInConversation = field.keywords.some(kw => allText.includes(kw.toLowerCase()));

    return {
      name: field.name,
      collected: botAsked || mentionedInConversation,
      botAsked,
      mentionedInConversation,
    };
  });

  const collected = results.filter(r => r.collected).length;
  const score = fields.length > 0 ? Math.round((collected / fields.length) * 100) : 0;

  return { results, collected, total: fields.length, score };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport(scenarioResults, config, opts) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const avgScore = scenarioResults.length > 0
    ? Math.round(scenarioResults.reduce((s, r) => s + r.scoring.score, 0) / scenarioResults.length)
    : 0;
  const passed = avgScore >= (opts.threshold ?? config.threshold);

  const lines = [];
  lines.push(`# Regression Test Report`);
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Target:** ${opts.url || config.apiUrl}${config.endpoint}`);
  lines.push(`**Threshold:** ${opts.threshold ?? config.threshold}%`);
  lines.push(`**Result:** ${passed ? '✅ PASSED' : '❌ FAILED'} (${avgScore}% average)`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Scenario | Score | Fields Collected |');
  lines.push('|----------|-------|-----------------|');
  for (const r of scenarioResults) {
    const icon = r.scoring.score >= (opts.threshold ?? config.threshold) ? '✅' : '❌';
    lines.push(`| ${r.name} | ${icon} ${r.scoring.score}% | ${r.scoring.collected}/${r.scoring.total} |`);
  }
  lines.push('');

  // Field breakdown
  lines.push('## Field Coverage');
  lines.push('');
  const fieldNames = config.fields.map(f => f.name);
  lines.push('| Field | ' + scenarioResults.map(r => r.name.substring(0, 15)).join(' | ') + ' |');
  lines.push('|-------|' + scenarioResults.map(() => '---').join('|') + '|');
  for (const fieldName of fieldNames) {
    const cells = scenarioResults.map(r => {
      const f = r.scoring.results.find(x => x.name === fieldName);
      return f && f.collected ? '✅' : '❌';
    });
    lines.push(`| ${fieldName} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // Per-scenario details
  lines.push('## Scenario Details');
  lines.push('');
  for (const r of scenarioResults) {
    lines.push(`### ${r.name}`);
    lines.push(`> ${r.description}`);
    lines.push('');
    lines.push(`**Score:** ${r.scoring.score}% (${r.scoring.collected}/${r.scoring.total} fields)`);
    lines.push('');
    for (const f of r.scoring.results) {
      const icon = f.collected ? '✅' : '❌';
      const detail = f.botAsked ? 'bot asked' : (f.mentionedInConversation ? 'in conversation' : 'not collected');
      lines.push(`- ${icon} **${f.name}** — ${detail}`);
    }
    lines.push('');

    if (r.error) {
      lines.push(`**⚠️ Error:** ${r.error}`);
      lines.push('');
    }
  }

  return { text: lines.join('\n'), timestamp, avgScore, passed };
}

// ---------------------------------------------------------------------------
// Console output
// ---------------------------------------------------------------------------

function printResults(scenarioResults, report, config, opts) {
  console.log('\n' + '='.repeat(60));
  console.log('  REGRESSION TEST RESULTS');
  console.log('='.repeat(60));

  for (const r of scenarioResults) {
    const icon = r.scoring.score >= (opts.threshold ?? config.threshold) ? '✅' : '❌';
    console.log(`\n${icon} ${r.name}: ${r.scoring.score}% (${r.scoring.collected}/${r.scoring.total} fields)`);

    for (const f of r.scoring.results) {
      console.log(`   ${f.collected ? '✓' : '✗'} ${f.name}`);
    }

    if (r.error) {
      console.log(`   ⚠️  Error: ${r.error}`);
    }

    if (opts.verbose && r.conversation) {
      console.log('\n   Conversation:');
      for (const msg of r.conversation) {
        const prefix = msg.role === 'user' ? '   👤' : '   🤖';
        const text = msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : '');
        console.log(`${prefix} ${text}`);
      }
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`  Average Score: ${report.avgScore}% | Threshold: ${opts.threshold ?? config.threshold}% | ${report.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('-'.repeat(60) + '\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('\n🧪 AI Receptionist — Regression Test Runner\n');

  const config = loadConfig(opts.configPath);
  const scenarios = loadScenarios(opts.scenariosPath);

  const baseUrl = opts.url || config.apiUrl;
  const endpoint = config.endpoint;

  console.log(`🌐 Target: ${baseUrl}${endpoint}`);
  console.log(`📊 Threshold: ${opts.threshold ?? config.threshold}%`);
  console.log(`🔬 Fields: ${config.fields.map(f => f.name).join(', ')}`);
  console.log(`📝 Scenarios: ${scenarios.length}\n`);

  const scenarioResults = [];

  for (const scenario of scenarios) {
    process.stdout.write(`  Running: ${scenario.name}...`);

    try {
      const { conversationHistory, botResponses } = await sendConversation(
        baseUrl, endpoint, scenario.messages
      );

      const scoring = scoreConversation(botResponses, scenario.messages, config.fields);

      scenarioResults.push({
        name: scenario.name,
        description: scenario.description || '',
        scoring,
        conversation: conversationHistory,
      });

      console.log(` ${scoring.score}%`);
    } catch (err) {
      // On error, score as 0 and continue
      scenarioResults.push({
        name: scenario.name,
        description: scenario.description || '',
        scoring: {
          results: config.fields.map(f => ({ name: f.name, collected: false, botAsked: false, mentionedInConversation: false })),
          collected: 0,
          total: config.fields.length,
          score: 0,
        },
        error: err.message,
      });
      console.log(` ERROR: ${err.message}`);
    }
  }

  const report = generateReport(scenarioResults, config, opts);
  printResults(scenarioResults, report, config, opts);

  // Save report
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `report-${report.timestamp}.md`);
  fs.writeFileSync(reportPath, report.text);
  console.log(`📄 Report saved: ${path.relative(PROJECT_ROOT, reportPath)}\n`);

  // Exit code
  process.exit(report.passed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
