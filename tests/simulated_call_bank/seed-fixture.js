// Seed utility: converts a call summary JSON into a call fixture for the simulated call bank
// Usage: node tests/simulated_call_bank/seed-fixture.js call-summaries/call-2026-03-15-12-50-31-CAc26ac1.json
// Also exports convertSummaryToFixture for use in property tests

const fs = require('fs');
const path = require('path');

const CALL_BANK_DIR = __dirname;

/**
 * Maps a transcript speaker name to a conversation role.
 * "Caller" → "user", "AI Receptionist" → "assistant", unknown → "user"
 */
function mapSpeakerToRole(speaker) {
  if (speaker === 'AI Receptionist') return 'assistant';
  return 'user';
}

/**
 * Derives an endTime ISO string from a startTime and a duration string like "116 seconds".
 * Returns empty string if parsing fails.
 */
function deriveEndTime(startTime, durationStr) {
  try {
    const match = durationStr.match(/(\d+)/);
    if (!match) return '';
    const seconds = parseInt(match[1], 10);
    // Parse as local (no Z suffix) to match the startTime format from getPacificTimeISO()
    const start = new Date(startTime + 'Z'); // treat input as UTC for arithmetic
    if (isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + seconds * 1000);
    // Return in same format as startTime (YYYY-MM-DDTHH:MM:SS, no Z)
    return end.toISOString().replace('Z', '').replace(/\.\d{3}$/, '');
  } catch {
    return '';
  }
}

/**
 * Converts a call summary (flat or nested) into the fixture format
 * expected by runPostCallAgent.
 *
 * @param {object} raw - The raw call summary JSON
 * @returns {object} A fixture with callSid, from, to, startTime, endTime, conversationHistory
 */
function convertSummaryToFixture(raw) {
  // Detect nested vs flat: nested has summary as an object with callerPhone
  const isNested = raw.summary && typeof raw.summary === 'object' && raw.summary.callerPhone;

  let callSid, callerPhone, twilioNumber, startTime, endTime, fullTranscript;

  if (isNested) {
    callSid = raw.callSid;
    callerPhone = raw.summary.callerPhone;
    twilioNumber = raw.summary.twilioNumber || '';
    startTime = raw.summary.callDate || raw.summary.startTime || '';
    endTime = raw.summary.endTime || '';
    fullTranscript = raw.summary.fullTranscript || [];
    // Derive endTime from startTime + duration when missing
    if (!endTime && startTime && raw.summary.duration) {
      endTime = deriveEndTime(startTime, raw.summary.duration);
    }
  } else {
    callSid = raw.callSid;
    callerPhone = raw.callerPhone || '';
    twilioNumber = raw.twilioNumber || '';
    startTime = raw.startTime || '';
    endTime = raw.endTime || '';
    fullTranscript = raw.fullTranscript || [];
    if (!endTime && startTime && raw.duration) {
      endTime = deriveEndTime(startTime, raw.duration);
    }
  }

  const conversationHistory = fullTranscript.map(entry => ({
    role: mapSpeakerToRole(entry.speaker),
    content: entry.message,
  }));

  return {
    callSid,
    from: callerPhone,
    to: twilioNumber,
    startTime,
    endTime,
    conversationHistory,
  };
}

// CLI entry point
if (require.main === module) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node tests/simulated_call_bank/seed-fixture.js <call-summary-json-path>');
    process.exit(1);
  }

  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  const fixture = convertSummaryToFixture(raw);

  // Derive output filename from callSid short form (last 8 hex chars)
  const sidShort = fixture.callSid ? fixture.callSid.slice(-8) : 'unknown';
  const outName = `fixture-${sidShort}.json`;
  const outPath = path.join(CALL_BANK_DIR, outName);

  fs.writeFileSync(outPath, JSON.stringify(fixture, null, 2) + '\n', 'utf-8');
  console.log(`Fixture written to ${outPath}`);
}

module.exports = { convertSummaryToFixture, mapSpeakerToRole };
